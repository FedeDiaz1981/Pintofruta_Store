"use server";

import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { revalidatePath } from "next/cache";
import { postgresPool } from "@/infrastructure/db/postgres";
import { siteContentSchemaSql } from "@/infrastructure/site-content/schema";
import { normalizeText } from "@/lib/catalog";
import type { AdminTableKey } from "@/application/admin-crud";

type PayloadRecord = Record<string, string | number | boolean | null | undefined>;

function toBoolean(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value !== 0;
  }

  if (typeof value === "string") {
    return value === "true" || value === "on" || value === "1";
  }

  return false;
}

function toNumber(value: unknown) {
  if (typeof value === "number") {
    return value;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toStringValue(value: unknown) {
  if (value == null) {
    return "";
  }

  return String(value).trim();
}

function slugify(value: string) {
  return normalizeText(value).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function parseNumberArray(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => toNumber(item)).filter((item) => Number.isFinite(item) && item > 0);
  }

  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.map((item) => toNumber(item)).filter((item) => Number.isFinite(item) && item > 0);
      }
    } catch {
      return value
        .split(",")
        .map((item) => toNumber(item.trim()))
        .filter((item) => Number.isFinite(item) && item > 0);
    }
  }

  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return [value];
  }

  return [];
}

function parseStringArray(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => toStringValue(item)).filter(Boolean);
  }

  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.map((item) => toStringValue(item)).filter(Boolean);
      }
    } catch {
      return value
        .split(",")
        .map((item) => toStringValue(item))
        .filter(Boolean);
    }
  }

  return [];
}

function generateSku(id: number) {
  return `PF${String(id).padStart(4, "0")}`;
}

function isFileValue(value: unknown): value is File {
  return typeof File !== "undefined" && value instanceof File;
}

async function storeUploadedImage(file: File, scope: string, fallbackName: string) {
  const extension = extname(file.name || "").toLowerCase() || ".png";
  const safeName = slugify(fallbackName || file.name || "imagen");
  const fileName = `${safeName}-${Date.now()}-${randomUUID().slice(0, 8)}${extension}`;
  const uploadsDir = join(process.cwd(), "public", "uploads", scope);
  const targetPath = join(uploadsDir, fileName);
  const relativePath = `/uploads/${scope}/${fileName}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    await mkdir(uploadsDir, { recursive: true });
    await writeFile(targetPath, buffer);
    return relativePath;
  } catch (error) {
    console.warn(`No se pudo guardar la imagen en disco para ${scope}; se usará base64 embebido.`, error);
  }

  const mimeType = file.type || "image/png";
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

type PackItemDraft = {
  productId: number;
  quantity: number;
  order: number;
};

function getJsonPayload(formData: FormData): PayloadRecord {
  const raw = formData.get("payload_json");

  if (typeof raw !== "string" || !raw.trim()) {
    return {};
  }

  try {
    return JSON.parse(raw) as PayloadRecord;
  } catch {
    return {};
  }
}

async function ensureDatabase() {
  if (!postgresPool) {
    throw new Error("DATABASE_URL no está configurada.");
  }

  await postgresPool.query(siteContentSchemaSql);
}

async function nextNumericId(table: string) {
  const result = await postgresPool!.query<{ next_id: number }>(`select coalesce(max(id), 0) + 1 as next_id from ${table}`);
  return result.rows[0]?.next_id ?? 1;
}

async function resolveTextId(table: string, providedId: string, fallbackParts: string[]) {
  const normalized = toStringValue(providedId);
  if (normalized) {
    return normalized;
  }

  const generated = slugify(fallbackParts.filter(Boolean).join("-"));
  if (generated) {
    return generated;
  }

  const nextId = await nextNumericId(table);
  return String(nextId);
}

async function saveProduct(record: PayloadRecord) {
  const providedId = record.id == null || record.id === "" ? 0 : toNumber(record.id);
  const existingResult = providedId
    ? await postgresPool!.query<{
        sku: string;
        presentation: string;
        category_id: number;
        category_name: string;
        category_ids: unknown;
        category_names: unknown;
        status: string;
        image: string | null;
        featured_priority: number | null;
        trending: boolean | null;
        stock: number | null;
        views_count: number | null;
        sales_count: number | null;
        description: string | null;
        source_section: string | null;
      }>(
        `select sku, presentation, category_id, category_name, category_ids, category_names, status, image,
                featured_priority, stock, views_count, sales_count, description, source_section
         from products
         where id = $1
         limit 1`,
        [providedId],
      )
    : null;
  const existing = existingResult?.rows[0];
  const id = providedId || (await nextNumericId("products"));

  const selectedCategoryIds = parseNumberArray(record.categoryIds);
  const existingCategoryIds = parseNumberArray(existing?.category_ids);
  const existingCategoryNames = parseStringArray(existing?.category_names);
  const fallbackCategoryIds = existingCategoryIds.length > 0 ? existingCategoryIds : existing?.category_id ? [existing.category_id] : [];
  const categoryIds = selectedCategoryIds.length > 0 ? selectedCategoryIds : fallbackCategoryIds;

  if (categoryIds.length === 0) {
    throw new Error("El producto necesita al menos una categoria.");
  }

  const categoryResult = await postgresPool!.query<{ id: number; name: string }>(
    `select id, name from categories where id = any($1::int[]) and deleted_at is null order by id`,
    [categoryIds],
  );
  const categoryMap = new Map(categoryResult.rows.map((row) => [row.id, row.name]));
  const resolvedCategoryNames = categoryIds
    .map((categoryId) => categoryMap.get(categoryId))
    .filter((value): value is string => Boolean(value));
  const categoryNames = resolvedCategoryNames.length > 0 ? resolvedCategoryNames : existingCategoryNames.length > 0 ? existingCategoryNames : [existing?.category_name || ""];
  const primaryCategoryId = categoryIds[0];
  const primaryCategoryName = categoryNames[0] || existing?.category_name || "";
  const sku = toStringValue(record.sku) || existing?.sku || generateSku(id);
  const name = toStringValue(record.name);
  const detail = toStringValue(record.detail) || name || sku;
  const presentation = toStringValue(record.presentation) || existing?.presentation || "";
  const active =
    record.active == null || record.active === ""
      ? String(existing?.status ?? "").toLowerCase() !== "inactive"
      : toBoolean(record.active);
  const status = active ? "published" : "inactive";
  const image = toStringValue(record.image) || existing?.image || null;
  const featuredPriority =
    record.featuredPriority == null || record.featuredPriority === ""
      ? existing?.featured_priority ?? null
      : toNumber(record.featuredPriority);
  const stock = record.stock == null || record.stock === "" ? existing?.stock ?? null : toNumber(record.stock);
  const viewsCount =
    record.viewsCount == null || record.viewsCount === "" ? existing?.views_count ?? 0 : toNumber(record.viewsCount);
  const salesCount =
    record.salesCount == null || record.salesCount === "" ? existing?.sales_count ?? 0 : toNumber(record.salesCount);
  const description = toStringValue(record.description) || existing?.description || null;
  const sourceSection = toStringValue(record.sourceSection) || existing?.source_section || null;

  await postgresPool!.query(
    `
      insert into products (
        id, sku, name, detail, presentation, category_id, category_name, category_ids, category_names, brand,
        vegano, kosher, testeado_en_animales, public_price, member_price, image,
        status, featured, featured_priority, stock, views_count, sales_count, description, source_section
      ) values (
        $1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24
      )
      on conflict (id) do update set
        sku = excluded.sku,
        name = excluded.name,
        detail = excluded.detail,
        presentation = excluded.presentation,
        category_id = excluded.category_id,
        category_name = excluded.category_name,
        category_ids = excluded.category_ids,
        category_names = excluded.category_names,
        brand = excluded.brand,
        vegano = excluded.vegano,
        kosher = excluded.kosher,
        testeado_en_animales = excluded.testeado_en_animales,
        public_price = excluded.public_price,
        member_price = excluded.member_price,
        image = excluded.image,
        status = excluded.status,
        featured = excluded.featured,
        featured_priority = excluded.featured_priority,
        stock = excluded.stock,
        views_count = excluded.views_count,
        sales_count = excluded.sales_count,
        description = excluded.description,
        source_section = excluded.source_section,
        updated_at = now()
    `,
    [
      id,
      sku,
      name,
      detail,
      presentation,
      primaryCategoryId,
      primaryCategoryName,
      JSON.stringify(categoryIds),
      JSON.stringify(categoryNames),
      toStringValue(record.brand),
      toBoolean(record.vegano),
      toBoolean(record.kosher),
      record.testeadoEnAnimales == null ? null : toBoolean(record.testeadoEnAnimales),
      toNumber(record.publicPrice),
      toNumber(record.memberPrice),
      image,
      status,
      toBoolean(record.featured),
      featuredPriority,
      stock,
      viewsCount,
      salesCount,
      description,
      sourceSection,
    ],
  );
}

async function saveBrand(record: PayloadRecord) {
  const name = toStringValue(record.name);
  const code = toStringValue(record.code) || slugify(name);
  const id = await resolveTextId("brands", toStringValue(record.id), [toStringValue(record.id), code, name]);
  const existingResult = await postgresPool!.query<{ featured: boolean | null }>(
    "select featured from brands where id = $1 limit 1",
    [id],
  );
  const existing = existingResult.rows[0];
  const featured = existing?.featured ?? false;
  await postgresPool!.query(
    `
      insert into brands (id, code, name, image, featured)
      values ($1, $2, $3, $4, $5)
      on conflict (id) do update set
        code = excluded.code,
        name = excluded.name,
        image = excluded.image,
        featured = excluded.featured
    `,
    [id, code || id, name, toStringValue(record.image) || null, featured],
  );
}

async function saveCategory(record: PayloadRecord) {
  const id = record.id ? toNumber(record.id) : await nextNumericId("categories");
  await postgresPool!.query(
    `
      insert into categories (id, name, slug, visible)
      values ($1, $2, $3, $4)
      on conflict (id) do update set
        name = excluded.name,
        slug = excluded.slug,
        visible = excluded.visible
    `,
    [id, toStringValue(record.name), toStringValue(record.slug) || slugify(toStringValue(record.name)), toBoolean(record.visible)],
  );
}

async function saveUser(record: PayloadRecord) {
  const id = record.id ? toNumber(record.id) : await nextNumericId("users");
  const rawRole = toStringValue(record.role);
  const normalizedRole = (() => {
    const value = rawRole.toLowerCase();
    if (value === "admin" || value === "administrador") {
      return "Administrador";
    }
    if (value === "customer" || value === "client" || value === "cliente") {
      return "Cliente";
    }
    return rawRole || "Cliente";
  })();

  await postgresPool!.query(
    `
      insert into users (id, name, email, role, can_see_prices, active)
      values ($1, $2, $3, $4, $5, $6)
      on conflict (id) do update set
        name = excluded.name,
        email = excluded.email,
        role = excluded.role,
        can_see_prices = excluded.can_see_prices,
        active = excluded.active
    `,
    [
      id,
      toStringValue(record.name),
      toStringValue(record.email),
      normalizedRole,
      toBoolean(record.canSeePrices),
      toBoolean(record.active),
    ],
  );
}

async function saveHeroSlide(record: PayloadRecord) {
  const id = record.id ? toNumber(record.id) : await nextNumericId("hero_slides");
  await postgresPool!.query(
    `
      insert into hero_slides (
        id, order_index, title, subtitle, badge, image, image_mobile, link, active, home_spotlight
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      on conflict (id) do update set
        order_index = excluded.order_index,
        title = excluded.title,
        subtitle = excluded.subtitle,
        badge = excluded.badge,
        image = excluded.image,
        image_mobile = excluded.image_mobile,
        link = excluded.link,
        active = excluded.active,
        home_spotlight = excluded.home_spotlight
    `,
    [
      id,
      toNumber(record.order),
      toStringValue(record.title),
      toStringValue(record.subtitle),
      toStringValue(record.badge),
      toStringValue(record.image),
      toStringValue(record.imageMobile) || null,
      toStringValue(record.link),
      toBoolean(record.active),
      record.homeSpotlight == null || record.homeSpotlight === "" ? null : toBoolean(record.homeSpotlight),
    ],
  );
}

async function saveBanner(record: PayloadRecord) {
  const id = record.id ? toNumber(record.id) : await nextNumericId("banners");
  await postgresPool!.query(
    `
      insert into banners (id, text, order_index, active)
      values ($1, $2, $3, $4)
      on conflict (id) do update set
        text = excluded.text,
        order_index = excluded.order_index,
        active = excluded.active
    `,
    [id, toStringValue(record.text), toNumber(record.order), toBoolean(record.active)],
  );
}

function parsePackItems(value: unknown): PackItemDraft[] {
  if (typeof value !== "string" || !value.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown[];

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((item, index) => {
        if (!item || typeof item !== "object") {
          return null;
        }

        const candidate = item as Record<string, unknown>;
        const productId = toNumber(candidate.productId);
        const quantity = Math.max(1, toNumber(candidate.quantity) || 1);
        const order = Math.max(1, toNumber(candidate.order) || index + 1);

        if (!productId) {
          return null;
        }

        return { productId, quantity, order };
      })
      .filter((item): item is PackItemDraft => Boolean(item))
      .sort((left, right) => left.order - right.order);
  } catch {
    return [];
  }
}

async function savePack(record: PayloadRecord, formData: FormData) {
  const client = await postgresPool!.connect();

  try {
    await client.query("begin");

    const id = record.id ? toNumber(record.id) : await nextNumericId("promotion_packs");
    const title = toStringValue(record.title);
    const apodo = toStringValue(record.apodo) || slugify(title);
    const items = parsePackItems(record.items_json);
    const uploadedImage = formData.get("image_file");
    const image =
      isFileValue(uploadedImage) && uploadedImage.size > 0
        ? await storeUploadedImage(uploadedImage, "promociones", title || apodo || `promocion-${id}`)
        : toStringValue(record.image) || null;

    if (!title) {
      throw new Error("El pack necesita un título.");
    }

    if (toNumber(record.publicPrice) <= 0) {
      throw new Error("El pack necesita un precio final válido.");
    }

    if (items.length === 0) {
      throw new Error("El pack debe incluir al menos un producto.");
    }

    if (!image) {
      throw new Error("La promoción necesita una imagen.");
    }

    await client.query(
      `
        insert into promotion_packs (
          id, apodo, title, description, category, public_price, image, active, featured, order_index
        ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        on conflict (id) do update set
          apodo = excluded.apodo,
          title = excluded.title,
          description = excluded.description,
          category = excluded.category,
          public_price = excluded.public_price,
          image = excluded.image,
          active = excluded.active,
          featured = excluded.featured,
          order_index = excluded.order_index,
          updated_at = now()
      `,
      [
        id,
        apodo,
        title,
        toStringValue(record.description),
        toStringValue(record.category),
        toNumber(record.publicPrice),
        image,
        toBoolean(record.active),
        toBoolean(record.featured),
        toNumber(record.order),
      ],
    );

    await client.query("delete from promotion_pack_items where pack_id = $1", [id]);

    for (const item of items) {
      await client.query(
        `
          insert into promotion_pack_items (pack_id, product_id, quantity, order_index)
          values ($1, $2, $3, $4)
        `,
        [id, item.productId, item.quantity, item.order],
      );
    }

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

async function saveSearchScope(record: PayloadRecord) {
  const id = await resolveTextId("header_search_scopes", toStringValue(record.id), [toStringValue(record.label), toStringValue(record.href)]);
  await postgresPool!.query(
    `
      insert into header_search_scopes (id, label, href, sort_order)
      values ($1, $2, $3, $4)
      on conflict (id) do update set
        label = excluded.label,
        href = excluded.href,
        sort_order = excluded.sort_order
    `,
    [id, toStringValue(record.label), toStringValue(record.href), toNumber(record.sort_order)],
  );
}

async function saveHeaderSection(record: PayloadRecord) {
  const id = await resolveTextId("header_sections", toStringValue(record.id), [toStringValue(record.label), toStringValue(record.href)]);
  await postgresPool!.query(
    `
      insert into header_sections (id, label, icon, href, sort_order)
      values ($1, $2, $3, $4, $5)
      on conflict (id) do update set
        label = excluded.label,
        icon = excluded.icon,
        href = excluded.href,
        sort_order = excluded.sort_order
    `,
    [id, toStringValue(record.label), toStringValue(record.icon), toStringValue(record.href), toNumber(record.sort_order)],
  );
}

async function saveHeaderGroup(record: PayloadRecord) {
  const id = await resolveTextId("header_groups", toStringValue(record.id), [toStringValue(record.section_id), toStringValue(record.label)]);
  await postgresPool!.query(
    `
      insert into header_groups (id, section_id, label, href, sort_order)
      values ($1, $2, $3, $4, $5)
      on conflict (id) do update set
        section_id = excluded.section_id,
        label = excluded.label,
        href = excluded.href,
        sort_order = excluded.sort_order
    `,
    [
      id,
      toStringValue(record.section_id),
      toStringValue(record.label),
      toStringValue(record.href),
      toNumber(record.sort_order),
    ],
  );
}

async function saveHeaderGroupItem(record: PayloadRecord) {
  const id = await resolveTextId("header_group_items", toStringValue(record.id), [toStringValue(record.group_id), toStringValue(record.label)]);
  await postgresPool!.query(
    `
      insert into header_group_items (id, group_id, label, href, sort_order)
      values ($1, $2, $3, $4, $5)
      on conflict (id) do update set
        group_id = excluded.group_id,
        label = excluded.label,
        href = excluded.href,
        sort_order = excluded.sort_order
    `,
    [id, toStringValue(record.group_id), toStringValue(record.label), toStringValue(record.href), toNumber(record.sort_order)],
  );
}

async function saveMeta(record: PayloadRecord) {
  await postgresPool!.query(
    `
      insert into site_content_meta (
        id, session_role, view_mode, active_admin_panel, panel_search_query,
        active_modal_action, ping, next_ids
      ) values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)
      on conflict (id) do update set
        session_role = excluded.session_role,
        view_mode = excluded.view_mode,
        active_admin_panel = excluded.active_admin_panel,
        panel_search_query = excluded.panel_search_query,
        active_modal_action = excluded.active_modal_action,
        ping = excluded.ping,
        next_ids = excluded.next_ids
    `,
    [
      1,
      toStringValue(record.session_role) || null,
      toStringValue(record.view_mode) || null,
      toStringValue(record.active_admin_panel) || null,
      toStringValue(record.panel_search_query) || null,
      toStringValue(record.active_modal_action) || null,
      toBoolean(record.ping),
      toStringValue(record.next_ids) || "{}",
    ],
  );
}

async function saveRow(table: AdminTableKey, record: PayloadRecord, formData: FormData) {
  switch (table) {
    case "products":
      return saveProduct(record);
    case "brands":
      return saveBrand(record);
    case "categories":
      return saveCategory(record);
    case "users":
      return saveUser(record);
    case "hero_slides":
      return saveHeroSlide(record);
    case "banners":
      return saveBanner(record);
    case "packs":
      return savePack(record, formData);
    case "header_search_scopes":
      return saveSearchScope(record);
    case "header_sections":
      return saveHeaderSection(record);
    case "header_groups":
      return saveHeaderGroup(record);
    case "header_group_items":
      return saveHeaderGroupItem(record);
    case "site_content_meta":
      return saveMeta(record);
    default:
      throw new Error(`Tabla no soportada: ${table satisfies never}`);
  }
}

async function deleteRow(table: AdminTableKey, id: string) {
  switch (table) {
    case "products":
      await postgresPool!.query("delete from products where id = $1", [toNumber(id)]);
      return;
    case "brands":
      await postgresPool!.query("delete from brands where id = $1", [toStringValue(id)]);
      return;
    case "categories":
      await postgresPool!.query("delete from categories where id = $1", [toNumber(id)]);
      return;
    case "users":
      await postgresPool!.query("delete from users where id = $1", [toNumber(id)]);
      return;
    case "hero_slides":
      await postgresPool!.query("delete from hero_slides where id = $1", [toNumber(id)]);
      return;
    case "banners":
      await postgresPool!.query("delete from banners where id = $1", [toNumber(id)]);
      return;
    case "packs":
      await postgresPool!.query("delete from promotion_packs where id = $1", [toNumber(id)]);
      return;
    case "header_search_scopes":
      await postgresPool!.query("delete from header_search_scopes where id = $1", [toStringValue(id)]);
      return;
    case "header_sections":
      await postgresPool!.query("delete from header_sections where id = $1", [toStringValue(id)]);
      return;
    case "header_groups":
      await postgresPool!.query("delete from header_groups where id = $1", [toStringValue(id)]);
      return;
    case "header_group_items":
      await postgresPool!.query("delete from header_group_items where id = $1", [toStringValue(id)]);
      return;
    case "site_content_meta":
      await postgresPool!.query("delete from site_content_meta where id = 1");
      return;
    default:
      throw new Error(`Tabla no soportada: ${table satisfies never}`);
  }
}

function getIdsPayload(formData: FormData) {
  const raw = formData.get("ids_json");

  if (typeof raw !== "string" || !raw.trim()) {
    return [] as string[];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.map((item) => String(item)).filter(Boolean);
  } catch {
    return [];
  }
}

function refreshAdminViews() {
  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath("/galeria");
  revalidatePath("/busqueda");
  revalidatePath("/carrito");
  revalidatePath("/producto/[sku]");
}

export async function saveAdminRecord(formData: FormData) {
  await ensureDatabase();

  const table = String(formData.get("table") || "") as AdminTableKey;
  const payload = getJsonPayload(formData);

  if (!table) {
    throw new Error("Falta la tabla.");
  }

  await saveRow(table, payload, formData);
  refreshAdminViews();
}

export async function deleteAdminRecord(formData: FormData) {
  await ensureDatabase();

  const table = String(formData.get("table") || "") as AdminTableKey;
  const id = String(formData.get("id") || "");

  if (!table || !id) {
    throw new Error("Falta la tabla o el id.");
  }

  await deleteRow(table, id);
  refreshAdminViews();
}

export async function deleteAdminRecords(formData: FormData) {
  await ensureDatabase();

  const table = String(formData.get("table") || "") as AdminTableKey;
  const ids = getIdsPayload(formData);

  if (!table || ids.length === 0) {
    throw new Error("Falta la tabla o los ids.");
  }

  for (const id of ids) {
    await deleteRow(table, id);
  }

  refreshAdminViews();
}
