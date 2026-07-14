"use server";

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
  const id = record.id ? toNumber(record.id) : await nextNumericId("products");
  await postgresPool!.query(
    `
      insert into products (
        id, sku, name, detail, presentation, category_id, category_name, brand,
        vegano, kosher, testeado_en_animales, public_price, member_price, image,
        status, featured, trending, stock, description, source_section
      ) values (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20
      )
      on conflict (id) do update set
        sku = excluded.sku,
        name = excluded.name,
        detail = excluded.detail,
        presentation = excluded.presentation,
        category_id = excluded.category_id,
        category_name = excluded.category_name,
        brand = excluded.brand,
        vegano = excluded.vegano,
        kosher = excluded.kosher,
        testeado_en_animales = excluded.testeado_en_animales,
        public_price = excluded.public_price,
        member_price = excluded.member_price,
        image = excluded.image,
        status = excluded.status,
        featured = excluded.featured,
        trending = excluded.trending,
        stock = excluded.stock,
        description = excluded.description,
        source_section = excluded.source_section,
        updated_at = now()
    `,
    [
      id,
      toStringValue(record.sku),
      toStringValue(record.name),
      toStringValue(record.detail) || toStringValue(record.name) || toStringValue(record.sku),
      toStringValue(record.presentation),
      toNumber(record.categoryId),
      toStringValue(record.categoryName),
      toStringValue(record.brand),
      toBoolean(record.vegano),
      toBoolean(record.kosher),
      record.testeadoEnAnimales == null ? null : toBoolean(record.testeadoEnAnimales),
      toNumber(record.publicPrice),
      toNumber(record.memberPrice),
      toStringValue(record.image) || null,
      toStringValue(record.status) || "published",
      toBoolean(record.featured),
      record.trending == null || record.trending === "" ? null : toBoolean(record.trending),
      record.stock == null || record.stock === "" ? null : toNumber(record.stock),
      toStringValue(record.description) || null,
      toStringValue(record.sourceSection) || null,
    ],
  );
}

async function saveBrand(record: PayloadRecord) {
  const code = toStringValue(record.code);
  const id = await resolveTextId("brands", toStringValue(record.id), [toStringValue(record.id), code, toStringValue(record.name)]);
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
    [id, code || id, toStringValue(record.name), toStringValue(record.image) || null, toBoolean(record.featured)],
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
      toStringValue(record.role) || "customer",
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

async function saveRow(table: AdminTableKey, record: PayloadRecord) {
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

  await saveRow(table, payload);
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
