import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { postgresPool } from "@/infrastructure/db/postgres";
import { allocateProductIds } from "@/infrastructure/db/product-ids";
import { normalizeText } from "@/lib/catalog";
import { parsePriceList, planPriceListImport, PriceListError, MAX_PRICE_LIST_BYTES, type ImportDecision, type PriceListProduct, type ExcelImportPlan } from "@/lib/price-list";

export type { ExcelImportPlan } from "@/lib/price-list";

export async function readPriceListProducts(client: Pick<PoolClient, "query">) {
  const result = await client.query<PriceListProduct>(
    "select id, name, brand, public_price, member_price from products where deleted_at is null order by id",
  );
  return result.rows;
}

async function readFile(file: File) {
  if (!/\.xlsx?$/i.test(file.name) || file.size <= 0 || file.size > MAX_PRICE_LIST_BYTES) {
    throw new PriceListError("Subi un archivo .xlsx o .xls de hasta 10 MB.");
  }
  try { return parsePriceList(Buffer.from(await file.arrayBuffer())); }
  catch (error) {
    if (error instanceof PriceListError) throw error;
    throw new PriceListError("No se pudo leer el Excel. Descarga la lista actualizada y vuelve a intentarlo.");
  }
}

export async function buildExcelImportPlan(file: File, decisions: ImportDecision[] = []) {
  if (!postgresPool) throw new Error("DATABASE_URL no esta configurada.");
  const parsed = await readFile(file);
  const products = await readPriceListProducts(postgresPool);
  return planPriceListImport(parsed, products, decisions, file.name);
}

async function ensureBrands(client: PoolClient, plan: ExcelImportPlan) {
  const brands = (await client.query<{ name: string }>("select name from brands")).rows;
  const existing = new Map(brands.map((brand) => [normalizeText(brand.name).trim(), brand.name]));
  const names = new Map<string, string>();
  for (const row of plan.rows) {
    if (row.action !== "create" && row.action !== "update") continue;
    const key = normalizeText(row.brand).trim();
    if (!names.has(key)) names.set(key, existing.get(key) ?? row.brand);
    if (!existing.has(key)) {
      const id = `import-${randomUUID()}`;
      await client.query("insert into brands (id, code, name, image, featured, active) values ($1,$1,$2,null,false,true)", [id, row.brand]);
      existing.set(key, row.brand);
    }
  }
  return names;
}

async function defaultCategory(client: PoolClient) {
  const result = await client.query<{ id: number; name: string }>(
    "select id, name from categories where deleted_at is null and lower(name) = 'sin categoria' order by id limit 1",
  );
  if (result.rows[0]) return result.rows[0];
  const next = await client.query<{ id: number }>("select coalesce(max(id),0)+1 as id from categories");
  const category = { id: next.rows[0].id, name: "Sin categoria" };
  await client.query("insert into categories (id,name,slug,visible) values ($1,$2,'sin-categoria',true)", [category.id, category.name]);
  return category;
}

export async function applyExcelImport(file: File, decisions: ImportDecision[], expectedRevision: string) {
  if (!postgresPool) throw new Error("DATABASE_URL no esta configurada.");
  if (!/^[a-f0-9]{64}$/.test(expectedRevision)) throw new PriceListError("Previsualiza y confirma la lista antes de importarla.");
  const parsed = await readFile(file);
  const client = await postgresPool.connect();
  try {
    await client.query("begin");
    await client.query("set local lock_timeout = '10s'");
    // Read the catalog and allocate IDs under the same lock as the writes.
    await client.query("lock table brands, categories, products in share row exclusive mode");
    const products = await readPriceListProducts(client);
    const plan = planPriceListImport(parsed, products, decisions, file.name);
    if (plan.revision !== expectedRevision) throw new PriceListError("La lista o el catalogo cambiaron. Vuelve a previsualizar antes de confirmar.", 409);
    if (plan.errors.length || plan.unresolvedRows) throw new PriceListError("La lista tiene errores o coincidencias pendientes. Revisa la vista previa.");
    const names = await ensureBrands(client, plan);
    const category = plan.createdProducts ? await defaultCategory(client) : null;
    const newIds = await allocateProductIds(client, plan.createdProducts);
    let newIndex = 0;
    const changes = plan.rows.filter((row) => row.action === "create" || row.action === "update").map((row) => ({
      id: row.action === "create" ? newIds[newIndex++] : row.productId,
      sku: `imp-${randomUUID()}`,
      name: row.name,
      brand: names.get(normalizeText(row.brand).trim()) ?? row.brand,
      public_price: row.publicPrice,
      member_price: row.memberPrice,
      action: row.action,
    }));
    const updates = changes.filter((row) => row.action === "update");
    const creates = changes.filter((row) => row.action === "create");
    if (updates.length) {
      await client.query(
        `update products as product set name=source.name, brand=source.brand,
           public_price=source.public_price, member_price=source.member_price, updated_at=now()
         from jsonb_to_recordset($1::jsonb) as source(id integer, name text, brand text, public_price integer, member_price integer)
         where product.id=source.id and product.deleted_at is null`,
        [JSON.stringify(updates)],
      );
    }
    if (creates.length && category) {
      await client.query(
        `insert into products (
          id,sku,name,detail,presentation,category_id,category_name,category_ids,category_names,brand,
          vegano,kosher,testeado_en_animales,public_price,member_price,image,status,sold_out,
          featured,featured_priority,trending,stock,views_count,sales_count,description,source_section
        ) select source.id,source.sku,source.name,source.name,'',$2,$3,
          jsonb_build_array($2::integer),jsonb_build_array($3::text),source.brand,false,false,null,
          source.public_price,source.member_price,null,'published',false,false,null,false,null,0,0,source.name,null
          from jsonb_to_recordset($1::jsonb) as source(id integer, sku text, name text, brand text, public_price integer, member_price integer)`,
        [JSON.stringify(creates), category.id, category.name],
      );
    }
    await client.query("commit");
    return plan;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
