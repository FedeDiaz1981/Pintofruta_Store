import "server-only";

import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { postgresPool } from "@/infrastructure/db/postgres";
import { allocateProductIds } from "@/infrastructure/db/product-ids";
import { storeImageOnSupabase } from "@/infrastructure/storage/supabase-storage";

const TOKEN_PREFIX = "pfex_live_";
const MAX_ROWS = 5000;

export type ExcelSyncProduct = {
  id: number;
  sku?: string;
  name?: string;
  detail?: string;
  presentation?: string;
  brand?: string;
  publicPrice?: number;
  memberPrice?: number;
  categoryId?: number;
  categoryIds?: number[];
  stock?: number | null;
  soldOut?: boolean;
  status?: string;
};

export type ExcelSyncPayload = {
  workbookId?: string;
  products?: ExcelSyncProduct[];
  brands?: Array<{ id?: string; name: string; active?: boolean }>;
  categories?: Array<{ id?: number; name: string; visible?: boolean }>;
  newProducts?: Array<{ name: string; detail?: string; presentation?: string; brand: string; publicPrice?: number; memberPrice?: number; categoryId?: number; categoryName?: string; image?: string; imageBase64?: string; imageName?: string; imageType?: string; status?: string }>;
};

function hashToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function cleanText(value: unknown, max = 500) {
  const text = String(value ?? "").trim();
  return text.length > max ? text.slice(0, max) : text;
}

function normalized(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function validInteger(value: unknown, min = 0) {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= 2_147_483_647;
}

function validMoney(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && Math.abs(value * 100 - Math.round(value * 100)) < 1e-8 && value >= 0 && value <= 2_147_483_647;
}

function validProduct(product: ExcelSyncProduct) {
  if (!validInteger(product.id, 1)) return "El ID del producto no es válido.";
  if (product.name !== undefined && !cleanText(product.name, 500)) return `El producto ${product.id} no tiene nombre.`;
  if (product.publicPrice !== undefined && !validMoney(product.publicPrice)) return `El precio público del producto ${product.id} no es válido.`;
  if (product.memberPrice !== undefined && !validMoney(product.memberPrice)) return `El precio logueado del producto ${product.id} no es válido.`;
  if (product.categoryId !== undefined && !validInteger(product.categoryId, 1)) return `La categoría del producto ${product.id} no es válida.`;
  if (product.categoryIds !== undefined && (!Array.isArray(product.categoryIds) || product.categoryIds.some((id) => !validInteger(id, 1)))) {
    return `Las categorías del producto ${product.id} no son válidas.`;
  }
  if (product.status !== undefined && product.status !== "published" && product.status !== "inactive") return `El estado del producto ${product.id} no es válido.`;
  return null;
}

export async function createExcelSyncToken(label: string, createdBy: number | null, expiresAt: Date | null) {
  if (!postgresPool) throw new Error("DATABASE_URL no está configurada.");
  const raw = `${TOKEN_PREFIX}${randomBytes(32).toString("base64url")}`;
  const id = randomUUID();
  await postgresPool.query(
    `insert into excel_sync_tokens (id, label, token_hash, expires_at, created_by)
     values ($1, $2, $3, $4, $5)`,
    [id, cleanText(label, 120) || "Planilla Excel", hashToken(raw), expiresAt, createdBy],
  );
  return { id, token: raw };
}

export async function revokeExcelSyncToken(id: string) {
  if (!postgresPool) throw new Error("DATABASE_URL no está configurada.");
  const result = await postgresPool.query("update excel_sync_tokens set active = false where id = $1", [id]);
  return result.rowCount === 1;
}

export async function authenticateExcelSyncToken(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const fixedToken = process.env.EXCEL_SYNC_FIXED_TOKEN?.trim();
  if (!token.startsWith(TOKEN_PREFIX) && token !== fixedToken) return null;
  if (fixedToken && hashToken(token) === hashToken(fixedToken)) {
    return { id: "fixed", scopes: ["catalog:read", "catalog:write"] };
  }
  if (!postgresPool) return null;
  const digest = hashToken(token);
  const result = await postgresPool.query<{ id: string; scopes: unknown }>(
    `select id, scopes from excel_sync_tokens
     where token_hash = $1 and active = true and (expires_at is null or expires_at > now())
     limit 1`,
    [digest],
  );
  const row = result.rows[0];
  if (!row) return null;
  await postgresPool.query(
    "update excel_sync_tokens set last_used_at = now(), last_used_ip = $2 where id = $1",
    [row.id, request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null],
  );
  const scopes = Array.isArray(row.scopes) ? row.scopes.map(String) : [];
  return { id: row.id, scopes };
}

async function queryCatalog(client: Pick<PoolClient, "query">) {
  const [products, brands, categories] = await Promise.all([
    client.query(`select id, sku, name, detail, presentation, brand, public_price, member_price,
      category_id, category_ids, stock, sold_out, status, updated_at
      from products where deleted_at is null order by id`),
    client.query("select id, code, name, active from brands order by name"),
    client.query("select id, name, slug, visible from categories where deleted_at is null order by id"),
  ]);
  return { products: products.rows, brands: brands.rows, categories: categories.rows };
}

function tsv(value: unknown) {
  return String(value ?? "").replace(/[\t\r\n]/g, " ");
}

export async function catalogResponse(format: string) {
  if (!postgresPool) throw new Error("DATABASE_URL no está configurada.");
  const catalog = await queryCatalog(postgresPool);
  if (format !== "tsv") return catalog;
  const lines = [
    "[PRODUCTS]",
    "id\tsku\tname\tdetail\tpresentation\tbrand\tpublic_price\tmember_price\tcategory_id\tcategory_ids\tstock\tsold_out\tstatus",
    ...catalog.products.map((p) => [p.id, p.sku, p.name, p.detail, p.presentation, p.brand, p.public_price, p.member_price, p.category_id, JSON.stringify(p.category_ids ?? []), p.stock ?? "", p.sold_out ? 1 : 0, p.status].map(tsv).join("\t")),
    "[BRANDS]",
    "id\tcode\tname\tactive",
    ...catalog.brands.map((b) => [b.id, b.code, b.name, b.active ? 1 : 0].map(tsv).join("\t")),
    "[CATEGORIES]",
    "id\tname\tslug\tvisible",
    ...catalog.categories.map((c) => [c.id, c.name, c.slug, c.visible ? 1 : 0].map(tsv).join("\t")),
  ];
  return lines.join("\r\n") + "\r\n";
}

export async function applyExcelSync(payload: ExcelSyncPayload) {
  if (!postgresPool) throw new Error("DATABASE_URL no está configurada.");
  const products = payload.products ?? [];
  const brands = payload.brands ?? [];
  const categories = payload.categories ?? [];
  const newProducts = payload.newProducts ?? [];
  if (products.length + brands.length + categories.length > MAX_ROWS) throw new Error("La sincronización supera el límite de filas permitido.");
  for (const product of products) {
    const error = validProduct(product);
    if (error) throw new Error(error);
  }
  if (products.length + brands.length + categories.length + newProducts.length > MAX_ROWS) throw new Error("La sincronizacion supera el limite de filas permitido.");
  for (const product of newProducts) {
    if (!cleanText(product.name, 500) || !cleanText(product.brand, 160)) throw new Error("El nuevo producto necesita nombre y marca.");
    if (product.publicPrice !== undefined && !validMoney(product.publicPrice)) throw new Error("El precio p\u00fablico del nuevo producto no es v\u00e1lido.");
    if (product.memberPrice !== undefined && !validMoney(product.memberPrice)) throw new Error("El precio logueado del nuevo producto no es v\u00e1lido.");
    if (product.categoryId !== undefined && !validInteger(product.categoryId, 1)) throw new Error("La categoria del nuevo producto no es valida.");
    if (product.imageBase64 !== undefined && (!product.imageBase64 || product.imageBase64.length > 7_000_000)) throw new Error("La imagen del nuevo producto es invalida o supera el limite de tamaño.");
    if (product.status !== undefined && product.status !== "published" && product.status !== "inactive") throw new Error("El estado del nuevo producto no es valido.");
  }
  const client = await postgresPool.connect();
  let productsUpdated = 0;
  let productsCreated = 0;
  const createdProductIds: number[] = [];
  let brandsUpdated = 0;
  let categoriesUpdated = 0;
  try {
    await client.query("begin");
    await client.query("set local lock_timeout = '10s'");
    await client.query("lock table brands, categories, products in share row exclusive mode");

    const categoryByName = new Map<string, number>();
    const existingCategories = await client.query<{ id: number; name: string }>("select id, name from categories where deleted_at is null");
    for (const row of existingCategories.rows) categoryByName.set(normalized(row.name), row.id);
    for (const category of categories) {
      const name = cleanText(category.name, 160);
      if (!name) throw new Error("No se puede guardar una categoría sin nombre.");
      const slug = normalized(name).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "categoria";
      let existingId = category.id && validInteger(category.id, 1) ? category.id : categoryByName.get(normalized(name));
      if (existingId) {
        await client.query("update categories set name = $2, visible = coalesce($3, visible) where id = $1 and deleted_at is null", [existingId, name, category.visible ?? null]);
      } else {
        const bySlug = await client.query<{ id: number }>("select id from categories where slug = $1 and deleted_at is null limit 1", [slug]);
        if (bySlug.rows[0]) {
          existingId = bySlug.rows[0].id;
          await client.query("update categories set name = $2, visible = coalesce($3, visible) where id = $1 and deleted_at is null", [existingId, name, category.visible ?? null]);
        } else {
          const next = await client.query<{ id: number }>("select coalesce(max(id), 0) + 1 as id from categories");
          const id = next.rows[0].id;
          await client.query("insert into categories (id, name, slug, visible) values ($1, $2, $3, $4)", [id, name, slug, category.visible ?? true]);
          existingId = id;
        }
        categoryByName.set(normalized(name), existingId);
      }
      categoriesUpdated++;
    }

    const brandByName = new Map<string, string>();
    const existingBrands = await client.query<{ id: string; name: string }>("select id, name from brands");
    for (const row of existingBrands.rows) brandByName.set(normalized(row.name), row.id);
    for (const brand of brands) {
      const name = cleanText(brand.name, 160);
      if (!name) throw new Error("No se puede guardar una marca sin nombre.");
      const existingId = brand.id || brandByName.get(normalized(name));
      if (existingId) await client.query("update brands set name = $2, active = coalesce($3, active) where id = $1", [existingId, name, brand.active ?? null]);
      else {
        const id = `excel-${randomUUID()}`;
        await client.query("insert into brands (id, code, name, featured, active) values ($1, $1, $2, false, $3)", [id, name, brand.active ?? true]);
        brandByName.set(normalized(name), id);
      }
      brandsUpdated++;
    }

    if (products.length) {
      const productIds = [...new Set(products.map((product) => product.id))];
      const existing = await client.query<{ id: number }>("select id from products where id = any($1::int[]) and deleted_at is null", [productIds]);
      if (existing.rowCount !== productIds.length) {
        const existingIds = new Set(existing.rows.map((row) => row.id));
        const missing = productIds.find((id) => !existingIds.has(id));
        throw new Error(`El producto ${missing} no existe o fue eliminado.`);
      }
      const updated = await client.query(
        `with incoming as (
           select * from jsonb_to_recordset($1::jsonb) as x(
             id integer, name text, detail text, presentation text, brand text,
             "publicPrice" numeric(12,2), "memberPrice" numeric(12,2), stock integer,
             sold_out boolean, status text, "categoryId" integer
           )
         )
         update products p
         set name = coalesce(i.name, p.name),
             detail = coalesce(i.detail, p.detail),
             presentation = coalesce(i.presentation, p.presentation),
             brand = coalesce(i.brand, p.brand),
             public_price = coalesce(i."publicPrice", p.public_price),
             member_price = coalesce(i."memberPrice", p.member_price),
             stock = i.stock,
             sold_out = coalesce(i.sold_out, p.sold_out),
             status = coalesce(i.status, p.status),
             category_id = coalesce(i."categoryId", p.category_id),
             category_name = coalesce(c.name, p.category_name),
             category_ids = case when c.id is not null then jsonb_build_array(c.id) else p.category_ids end,
             category_names = case when c.id is not null then jsonb_build_array(c.name) else p.category_names end,
             updated_at = now()
         from incoming i
         left join categories c on c.id = i."categoryId" and c.deleted_at is null
         where p.id = i.id and p.deleted_at is null`,
        [JSON.stringify(products)],
      );
      productsUpdated = updated.rowCount ?? 0;
    }

    if (newProducts.length) {
      const ids = await allocateProductIds(client, newProducts.length);
      const knownBrands = new Set((await client.query<{ name: string }>("select name from brands")).rows.map((row) => normalized(row.name)));
      for (let index = 0; index < newProducts.length; index += 1) {
        const product = newProducts[index];
        const brand = cleanText(product.brand, 160);
        if (!knownBrands.has(normalized(brand))) {
          const brandId = `excel-${randomUUID()}`;
          await client.query("insert into brands (id, code, name, featured, active) values ($1, $1, $2, false, true)", [brandId, brand]);
          knownBrands.add(normalized(brand));
        }
        const name = cleanText(product.name, 500);
        const detail = cleanText(product.detail || name, 2000);
        const presentation = cleanText(product.presentation, 160);
        let category: { id: number; name: string } | undefined;
        if (product.categoryId !== undefined) {
          const categoryResult = await client.query<{ id: number; name: string }>("select id, name from categories where id = $1 and deleted_at is null limit 1", [product.categoryId]);
          category = categoryResult.rows[0];
          if (!category) throw new Error(`La categoria ${product.categoryId} no existe.`);
        } else {
          const categoryName = cleanText(product.categoryName, 160) || "Sin categoria";
          const categoryResult = await client.query<{ id: number; name: string }>("select id, name from categories where deleted_at is null and lower(name) = lower($1) limit 1", [categoryName]);
          category = categoryResult.rows[0];
          if (!category) {
            const slugBase = normalized(categoryName).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "categoria";
            let slug = slugBase;
            let suffix = 2;
            while ((await client.query("select 1 from categories where slug = $1 and deleted_at is null limit 1", [slug])).rowCount) slug = `${slugBase}-${suffix++}`;
            const next = await client.query<{ id: number }>("select coalesce(max(id), 0) + 1 as id from categories");
            category = { id: next.rows[0].id, name: categoryName };
            await client.query("insert into categories (id, name, slug, visible) values ($1, $2, $3, true)", [category.id, category.name, slug]);
          }
        }
        let image = cleanText(product.image, 2000) || null;
        if (!image && product.imageBase64) {
          const imageBytes = Buffer.from(product.imageBase64, "base64");
          if (!imageBytes.length || imageBytes.length > 5_000_000) throw new Error("La imagen del nuevo producto supera el limite de 5 MB.");
          const imageFile = new File([imageBytes], cleanText(product.imageName, 180) || `${name}.png`, { type: cleanText(product.imageType, 120) || "image/png" });
          image = await storeImageOnSupabase(imageFile, "products", `${brand}-${name}`);
        }
        await client.query(
          `insert into products (id, sku, name, detail, presentation, category_id, category_name, category_ids, category_names, brand,
             vegano, kosher, testeado_en_animales, public_price, member_price, image, status, sold_out, featured, featured_priority,
             trending, stock, views_count, sales_count, description, source_section)
           values ($1, $2, $3, $4, $5, $6, $7, jsonb_build_array($6::integer), jsonb_build_array($7::text), $8,
             false, false, null, $9, $10, $11, $12, false, false, null, false, null, 0, 0, $4, null)`,
          [ids[index], `imp-${randomUUID()}`, name, detail, presentation, category.id, category.name, brand, product.publicPrice ?? 0, product.memberPrice ?? 0, image, product.status ?? "published"],
        );
        productsCreated += 1;
        createdProductIds.push(ids[index]);
      }
    }

    if (false) {
    for (const product of products) {
      const exists = await client.query<{ id: number }>("select id from products where id = $1 and deleted_at is null", [product.id]);
      if (!exists.rows[0]) throw new Error(`El producto ${product.id} no existe o fue eliminado.`);
      const categoryIds = product.categoryIds?.length ? product.categoryIds : product.categoryId ? [product.categoryId] : undefined;
      if (categoryIds) {
        const check = await client.query<{ id: number }>("select id from categories where id = any($1::int[]) and deleted_at is null", [categoryIds]);
        if (check.rowCount !== categoryIds!.length) throw new Error(`El producto ${product.id} referencia una categoría inexistente.`);
      }
      const fields: string[] = [];
      const values: unknown[] = [];
      const add = (sql: string, value: unknown) => { fields.push(`${sql} = $${values.length + 1}`); values.push(value); };
      if (product.name !== undefined) add("name", cleanText(product.name));
      if (product.detail !== undefined) add("detail", cleanText(product.detail, 2000));
      if (product.presentation !== undefined) add("presentation", cleanText(product.presentation, 160));
      if (product.brand !== undefined) add("brand", cleanText(product.brand, 160));
      if (product.publicPrice !== undefined) add("public_price", product.publicPrice);
      if (product.memberPrice !== undefined) add("member_price", product.memberPrice);
      if (product.stock !== undefined) add("stock", product.stock);
      if (product.soldOut !== undefined) add("sold_out", product.soldOut);
      if (product.status !== undefined) add("status", product.status);
      if (categoryIds) {
        add("category_id", categoryIds![0]);
        add("category_ids", JSON.stringify(categoryIds!));
        const category = await client.query<{ name: string }>("select name from categories where id = $1", [categoryIds![0]]);
        add("category_name", category.rows[0].name);
        add("category_names", JSON.stringify((await client.query<{ name: string }>("select name from categories where id = any($1::int[]) order by id", [categoryIds!])).rows.map((row) => row.name)));
      }
      if (fields.length) {
        values.push(product.id);
        await client.query(`update products set ${fields.join(", ")}, updated_at = now() where id = $${values.length}`, values);
        productsUpdated++;
      }
    }
    }
    await client.query("commit");
    return { productsUpdated, productsCreated, createdProductIds, brandsUpdated, categoriesUpdated };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
