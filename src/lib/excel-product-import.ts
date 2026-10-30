import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { postgresPool } from "@/infrastructure/db/postgres";
import { allocateProductIds } from "@/infrastructure/db/product-ids";
import { normalizeText } from "@/lib/catalog";
import { getProductFieldErrors, parseProductCategoryIds, PRODUCT_INTEGER_MAX } from "@/lib/product-validation";
import { parsePriceList, planPriceListImport, PriceListError, MAX_PRICE_LIST_BYTES, type ImportDecision, type PriceListProduct, type ExcelImportPlan } from "@/lib/price-list";

export type { ExcelImportPlan } from "@/lib/price-list";

export async function readPriceListProducts(client: Pick<PoolClient, "query">) {
  const result = await client.query<PriceListProduct>(
    "select id, name, brand, public_price, member_price from products where deleted_at is null order by id",
  );
  return result.rows;
}

async function readImportProducts(client: Pick<PoolClient, "query">): Promise<PriceListProduct[]> {
  const products = await client.query<PriceListProduct & { detail: string; category_id: number; category_ids: unknown; featured_priority: number | null }>(
    "select id, name, brand, public_price, member_price, detail, category_id, category_ids, featured_priority from products where deleted_at is null order by id",
  );
  const categories = await client.query<{ id: number }>("select id from categories where deleted_at is null");
  const validCategories = new Set(categories.rows.map((category) => category.id));
  const brands = await client.query<{ name: string }>("select name from brands");
  const canonicalBrands = new Map(brands.rows.map((brand) => [normalizeText(brand.name).trim(), brand.name]));
  return products.rows.map((product) => {
    const storedIds = parseProductCategoryIds(product.category_ids);
    const categoryIds = storedIds?.length ? storedIds : [product.category_id];
    const errors = getProductFieldErrors({ detail: product.detail, categoryIds, featuredPriority: product.featured_priority }, ["detail", "categoryIds", "featuredPriority"]);
    if (!storedIds || !validCategories.has(product.category_id) || categoryIds.some((id) => !validCategories.has(id))) {
      errors.categoryIds = "Las categorias del producto faltan o fueron eliminadas.";
    }
    return {
      id: product.id, name: product.name, brand: product.brand, public_price: product.public_price, member_price: product.member_price,
      validationErrors: Object.values(errors),
      brandNeedsSync: canonicalBrands.get(normalizeText(product.brand).trim()) !== product.brand,
    };
  });
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
  const products = await readImportProducts(postgresPool);
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
  if (!Number.isInteger(next.rows[0]?.id) || next.rows[0].id <= 0 || next.rows[0].id > PRODUCT_INTEGER_MAX) {
    throw new PriceListError("No se puede generar un ID valido para la categoria. Revisa las categorias antes de importar.");
  }
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
    const products = await readImportProducts(client);
    const plan = planPriceListImport(parsed, products, decisions, file.name);
    if (plan.revision !== expectedRevision) throw new PriceListError("La lista o el catalogo cambiaron. Vuelve a previsualizar antes de confirmar.", 409);
    if (!plan.createdProducts && !plan.updatedProducts) throw new PriceListError("No hay cambios validos para importar. Revisa los motivos en la vista previa.");
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
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
