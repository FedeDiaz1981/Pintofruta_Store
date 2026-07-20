import * as XLSX from "xlsx";
import type { PoolClient } from "pg";
import { postgresPool } from "@/infrastructure/db/postgres";
import { siteContentSchemaSql } from "@/infrastructure/site-content/schema";
import { normalizeText } from "@/lib/catalog";

export type ExcelImportMode = "guest" | "member";
export type ExcelImportAction = "preview" | "apply";

type DbProductRow = {
  id: number;
  sku: string;
  name: string;
  detail: string;
  presentation: string;
  category_id: number;
  category_name: string;
  brand: string;
  vegano: boolean;
  kosher: boolean;
  testeado_en_animales: boolean | null;
  public_price: number;
  member_price: number;
  image: string | null;
  status: string;
  featured: boolean;
  featured_priority: number | null;
  trending: boolean | null;
  stock: number | null;
  views_count: number | null;
  sales_count: number | null;
  description: string | null;
  source_section: string | null;
  deleted_at: string | null;
};

type DbBrandRow = {
  id: string;
  code: string;
  name: string;
  image: string | null;
  featured: boolean;
  active: boolean;
};

type DbCategoryRow = {
  id: number;
  name: string;
  slug: string;
  visible: boolean;
  deleted_at: string | null;
};

type SourceWorkbookRow = {
  rowNumber: number;
  brand: string;
  detail: string;
  presentation: string;
  price: number;
  section: string;
  outOfStock: boolean;
  categoryLabel: string;
  categorySlug: string;
  categoryId: number;
  brandId: string;
  productKey: string;
};

type PreviewRow = SourceWorkbookRow & {
  action: "create" | "update" | "skip";
  productId?: number;
  sku?: string;
  currentPrice?: number;
  currentPriceField?: "public_price" | "member_price";
  notes: string[];
};

type PlannedBrand = {
  id: string;
  code: string;
  name: string;
  image: string | null;
  featured: boolean;
  active: boolean;
  existed: boolean;
};

type PlannedCategory = {
  id: number;
  name: string;
  slug: string;
  visible: boolean;
  existed: boolean;
};

type PlannedProduct = {
  id: number;
  sku: string;
  name: string;
  detail: string;
  presentation: string;
  category_id: number;
  category_name: string;
  brand: string;
  vegano: boolean;
  kosher: boolean;
  testeado_en_animales: boolean | null;
  public_price: number;
  member_price: number;
  image: string | null;
  status: string;
  featured: boolean;
  featured_priority: number | null;
  trending: boolean | null;
  stock: number | null;
  views_count: number;
  sales_count: number;
  description: string | null;
  source_section: string | null;
  existed: boolean;
};

export interface ExcelImportPlan {
  mode: ExcelImportMode;
  fileName: string;
  sheetName: string;
  totalRows: number;
  parsedRows: number;
  createdProducts: number;
  updatedProducts: number;
  createdBrands: number;
  createdCategories: number;
  ignoredRows: number;
  warnings: string[];
  rows: PreviewRow[];
}

const headerLabels = new Set(["cantidad", "marca", "detalle / variedad", "presentacion", "presentación", "precio", "subtotal"]);

const categorySynonymMap: Record<string, string[]> = {
  "sin gluten": ["sin tacc", "tacc", "gluten free"],
  vegano: ["vegana"],
  "sin azúcar": ["sin azucar", "sin azucar agregado", "sin azucar añadida", "sin azucar anadida"],
  orgánico: ["organico", "ecologico", "ecológica", "ecologico"],
  keto: ["low carb", "lowcarb"],
  proteico: ["proteica", "protein", "proteínas", "proteinas"],
  kosher: ["kosher"],
  natural: ["naturales", "natural"],
};

function collapseWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function cleanCellValue(value: unknown) {
  if (value == null) {
    return "";
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "";
  }

  return collapseWhitespace(String(value));
}

function stripStockText(value: string) {
  return collapseWhitespace(value.replace(/\bSIN\s+STOCK\b/gi, "").replace(/\s{2,}/g, " "));
}

function parsePrice(value: unknown) {
  if (typeof value === "number") {
    return Math.round(value);
  }

  const raw = cleanCellValue(value);
  if (!raw) {
    return 0;
  }

  const digits = raw.replace(/[^\d-]/g, "");
  const parsed = Number(digits);
  return Number.isFinite(parsed) ? Math.round(parsed) : 0;
}

function slugify(value: string) {
  return normalizeText(value).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function buildBrandCode(name: string) {
  return slugify(name) || "brand";
}

function buildCategorySlug(name: string) {
  return slugify(name) || "categoria";
}

function getLeadingFamilyLabel(text: string) {
  const normalized = collapseWhitespace(text).replace(/^[A-Z]\s+/, "");
  const lowerIndex = normalized.search(/[a-záéíóúñ]/);

  if (lowerIndex > 0) {
    return collapseWhitespace(normalized.slice(0, lowerIndex));
  }

  return collapseWhitespace(normalized);
}

function buildCategoryAliases(category: DbCategoryRow) {
  const aliases = new Set<string>();
  const name = normalizeText(category.name);
  const slug = normalizeText(category.slug).replace(/-/g, " ");

  if (name) {
    aliases.add(name);
  }

  if (slug) {
    aliases.add(slug);
  }

  const nameVariants = categorySynonymMap[name];
  for (const alias of nameVariants ?? []) {
    aliases.add(normalizeText(alias));
  }

  if (name.includes("vegano")) {
    aliases.add("vegana");
  }

  if (name.includes("sin gluten") || name.includes("gluten")) {
    aliases.add("sin tacc");
    aliases.add("tacc");
  }

  return [...aliases].filter(Boolean);
}

function scoreCategoryMatch(text: string, category: DbCategoryRow) {
  const normalizedText = normalizeText(text);
  const normalizedName = normalizeText(category.name);
  const normalizedSlug = normalizeText(category.slug).replace(/-/g, " ");

  const aliases = buildCategoryAliases(category);
  let score = 0;

  if (!normalizedName) {
    return score;
  }

  if (normalizedText === normalizedName) {
    score = Math.max(score, 1200 + normalizedName.length);
  }

  if (normalizedText.includes(normalizedName)) {
    score = Math.max(score, 1000 + normalizedName.length);
  }

  if (normalizedSlug && normalizedText.includes(normalizedSlug)) {
    score = Math.max(score, 950 + normalizedSlug.length);
  }

  for (const alias of aliases) {
    if (alias && normalizedText.includes(alias)) {
      score = Math.max(score, 800 + alias.length);
    }
  }

  const categoryTokens = normalizedName
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length > 2);
  const tokenMatches = categoryTokens.filter((token) => normalizedText.includes(token)).length;

  if (categoryTokens.length > 0) {
    score = Math.max(score, tokenMatches * 40 + categoryTokens.length * 5);
  }

  return score;
}

function resolveCategoryFromText(text: string, categories: DbCategoryRow[]) {
  const visibleCategories = categories.filter((category) => category.deleted_at == null && category.visible);
  const ranked = visibleCategories
    .map((category) => ({
      category,
      score: scoreCategoryMatch(text, category),
    }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score || right.category.name.length - left.category.name.length);

  return ranked[0]?.category ?? null;
}

function resolveFallbackCategory(categories: DbCategoryRow[]) {
  return (
    categories.find((category) => category.deleted_at == null && category.visible && normalizeText(category.name) === "natural") ??
    categories.find((category) => category.deleted_at == null && category.visible) ??
    null
  );
}

function isHeaderRow(row: unknown[]) {
  const values = row.slice(0, 6).map((value) => normalizeText(String(value ?? "")));
  if (values.length === 0) {
    return false;
  }

  return values.some((value) => headerLabels.has(value));
}

function isSectionRow(row: unknown[]) {
  const brand = cleanCellValue(row[1]);
  const detail = cleanCellValue(row[2]);
  const presentation = cleanCellValue(row[3]);
  const price = parsePrice(row[4]);

  return !brand && !presentation && !price && Boolean(detail);
}

function buildProductKey(brand: string, detail: string, presentation: string) {
  return [
    normalizeText(brand),
    normalizeText(detail),
    normalizeText(presentation),
  ]
    .filter(Boolean)
    .join("|");
}

function buildAlternativeProductKeys(row: SourceWorkbookRow) {
  const normalizedBrand = normalizeText(row.brand);
  const normalizedDetail = normalizeText(row.detail);
  const normalizedFamily = normalizeText(row.categoryLabel);
  const normalizedPresentation = normalizeText(row.presentation);

  return [
    [normalizedBrand, normalizedDetail, normalizedPresentation].filter(Boolean).join("|"),
    [normalizedBrand, normalizedDetail].filter(Boolean).join("|"),
    [normalizedBrand, normalizedFamily, normalizedPresentation].filter(Boolean).join("|"),
    [normalizedBrand, normalizedFamily].filter(Boolean).join("|"),
  ].filter(Boolean);
}

function buildProductRowLookup(product: DbProductRow, mode: ExcelImportMode) {
  return {
    rowNumber: 0,
    brand: product.brand,
    detail: product.detail,
    presentation: product.presentation,
    price: mode === "guest" ? product.public_price : product.member_price,
    section: product.source_section ?? product.category_name,
    outOfStock: (product.stock ?? 0) <= 0,
    categoryLabel: product.category_name,
    categorySlug: buildCategorySlug(product.category_name),
    categoryId: product.category_id,
    brandId: buildBrandCode(product.brand),
    productKey: buildProductKey(product.brand, product.detail, product.presentation),
  } satisfies SourceWorkbookRow;
}

function findMatchingProduct(row: SourceWorkbookRow, products: DbProductRow[]) {
  const rowKeys = buildAlternativeProductKeys(row);

  for (const product of products) {
    const productRow = buildProductRowLookup(product, "guest");
    const productKeys = buildAlternativeProductKeys(productRow);

    if (rowKeys.some((key) => productKeys.includes(key))) {
      return product;
    }
  }

  return null;
}

function generateSku(row: SourceWorkbookRow, nextId: number) {
  const base = slugify(`${row.brand}-${row.categoryLabel}-${row.detail}`) || "importado";
  return `imp-${base.slice(0, 36)}-${nextId}`;
}

function extractWorkbookRows(sheet: XLSX.WorkSheet) {
  const rawRows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    blankrows: false,
    defval: null,
  }) as unknown[][];

  const rows: SourceWorkbookRow[] = [];
  const warnings: string[] = [];
  let currentSection = "";

  for (let index = 0; index < rawRows.length; index += 1) {
    const row = rawRows[index] ?? [];
    const rowNumber = index + 1;

    if (isHeaderRow(row)) {
      continue;
    }

    if (isSectionRow(row)) {
      const sectionText = stripStockText(cleanCellValue(row[2]));
      currentSection = collapseWhitespace(getLeadingFamilyLabel(sectionText));
      continue;
    }

    const brand = stripStockText(cleanCellValue(row[1]));
    const detail = stripStockText(cleanCellValue(row[2]));
    const presentation = stripStockText(cleanCellValue(row[3]));
    const price = parsePrice(row[4]);

    if (!brand && !detail && !presentation && !price) {
      continue;
    }

    if (!brand || !detail || !price) {
      warnings.push(`Fila ${rowNumber}: se omitió por datos incompletos.`);
      continue;
    }

    const familyLabel = collapseWhitespace(currentSection || getLeadingFamilyLabel(detail) || brand);
    const categoryLabel = collapseWhitespace(currentSection || getLeadingFamilyLabel(detail) || brand);
    const categorySlug = buildCategorySlug(categoryLabel);

    rows.push({
      rowNumber,
      brand,
      detail,
      presentation,
      price,
      section: familyLabel,
      outOfStock: /sin\s+stock/i.test(`${cleanCellValue(row[1])} ${cleanCellValue(row[2])}`),
      categoryLabel,
      categorySlug,
      categoryId: 0,
      brandId: buildBrandCode(brand),
      productKey: buildProductKey(brand, detail, presentation),
    });
  }

  return { rows, warnings };
}

async function ensureDatabase() {
  if (!postgresPool) {
    throw new Error("DATABASE_URL no está configurada.");
  }

  await postgresPool.query(siteContentSchemaSql);
}

async function loadCatalogState(client: PoolClient) {
  const [products, brands, categories] = await Promise.all([
    client.query<DbProductRow>(
      `
        select id, sku, name, detail, presentation, category_id, category_name, brand,
               vegano, kosher, testeado_en_animales, public_price, member_price, image,
               status, featured, featured_priority, trending, stock, views_count,
               sales_count, description, source_section, deleted_at
        from products
        where deleted_at is null
        order by id
      `,
    ),
    client.query<DbBrandRow>(
      `
        select id, code, name, image, featured, active
        from brands
        order by name
      `,
    ),
    client.query<DbCategoryRow>(
      `
        select id, name, slug, visible, deleted_at
        from categories
        order by id
      `,
    ),
  ]);

  return {
    products: products.rows,
    brands: brands.rows,
    categories: categories.rows,
  };
}

function buildExistingMaps(products: DbProductRow[], brands: DbBrandRow[], categories: DbCategoryRow[]) {
  const productMap = new Map<string, DbProductRow>();
  const brandMap = new Map<string, DbBrandRow>();
  const categoryMap = new Map<string, DbCategoryRow>();

  for (const product of products) {
    const keys = [
      buildProductKey(product.brand, product.detail, product.presentation),
      buildProductKey(product.brand, product.name, product.presentation),
      buildProductKey(product.brand, product.detail, ""),
      buildProductKey(product.brand, product.name, ""),
    ];

    for (const key of keys) {
      if (key && !productMap.has(key)) {
        productMap.set(key, product);
      }
    }
  }

  for (const brand of brands) {
    const keys = [normalizeText(brand.id), normalizeText(brand.code), normalizeText(brand.name)];

    for (const key of keys) {
      if (key && !brandMap.has(key)) {
        brandMap.set(key, brand);
      }
    }
  }

  for (const category of categories.filter((item) => item.deleted_at == null)) {
    const keys = [normalizeText(category.name), normalizeText(category.slug)];

    for (const key of keys) {
      if (key && !categoryMap.has(key)) {
        categoryMap.set(key, category);
      }
    }
  }

  return { productMap, brandMap, categoryMap };
}

function buildPlanWithCatalog(params: {
  fileName: string;
  mode: ExcelImportMode;
  sheetName: string;
  workbookRows: SourceWorkbookRow[];
  warnings: string[];
  productMap: Map<string, DbProductRow>;
  brandMap: Map<string, DbBrandRow>;
  categoryMap: Map<string, DbCategoryRow>;
  categories: DbCategoryRow[];
}) {
  const { fileName, mode, sheetName, workbookRows, warnings, productMap, brandMap, categoryMap, categories } = params;
  const rows: PreviewRow[] = [];
  const plannedBrands = new Map<string, PlannedBrand>();
  const plannedCategories = new Map<string, PlannedCategory>();
  const plannedProducts = new Map<string, PlannedProduct>();
  const productList = [...productMap.values()];

  const nextProductIdStart = Math.max(0, ...[...productMap.values()].map((product) => product.id)) + 1;
  const nextCategoryIdStart = Math.max(0, ...[...categoryMap.values()].map((category) => category.id)) + 1;

  let nextProductId = nextProductIdStart;
  let nextCategoryId = nextCategoryIdStart;

  for (const sourceRow of workbookRows) {
    const brandKey = normalizeText(sourceRow.brand);
    const brandRow = brandMap.get(brandKey);
    const categoryRow =
      resolveCategoryFromText(`${sourceRow.detail} ${sourceRow.section} ${sourceRow.brand}`, categories) ??
      resolveFallbackCategory(categories) ??
      categoryMap.get(normalizeText(sourceRow.categoryLabel));
    const matchedProduct = productMap.get(sourceRow.productKey) ?? findMatchingProduct(sourceRow, productList);

    const brandId = brandRow?.id ?? buildBrandCode(sourceRow.brand);
    let categoryId = categoryRow?.id ?? 0;
    let categoryLabel = categoryRow?.name ?? sourceRow.categoryLabel;
    const currentPrice = matchedProduct ? (mode === "guest" ? matchedProduct.public_price : matchedProduct.member_price) : undefined;
    const targetField = mode === "guest" ? "public_price" : "member_price";
    const notes: string[] = [];

    if (!brandRow) {
      plannedBrands.set(brandId, {
        id: brandId,
        code: brandId,
        name: sourceRow.brand,
        image: null,
        featured: false,
        active: true,
        existed: false,
      });
    } else if (!brandRow.active) {
      plannedBrands.set(brandId, {
        id: brandRow.id,
        code: brandRow.code,
        name: brandRow.name,
        image: brandRow.image,
        featured: brandRow.featured,
        active: true,
        existed: true,
      });
    }

    const plannedCategoryKey = normalizeText(categoryLabel || sourceRow.categoryLabel || sourceRow.section || sourceRow.brand);

    if (!categoryRow) {
      if (!plannedCategories.has(plannedCategoryKey)) {
        categoryId = nextCategoryId++;
        plannedCategories.set(plannedCategoryKey, {
          id: categoryId,
          name: categoryLabel,
          slug: sourceRow.categorySlug,
          visible: true,
          existed: false,
        });
      } else {
        categoryId = plannedCategories.get(plannedCategoryKey)?.id ?? nextCategoryId++;
      }
    } else {
      categoryId = categoryRow.id;

      if (!categoryRow.visible) {
        plannedCategories.set(plannedCategoryKey, {
          id: categoryRow.id,
          name: categoryRow.name,
          slug: categoryRow.slug,
          visible: true,
          existed: true,
        });
      }
    }

    if (categoryId === 0) {
      const fallbackCategory = plannedCategories.get(plannedCategoryKey);
      categoryId = fallbackCategory?.id ?? nextCategoryId++;
      categoryLabel = fallbackCategory?.name ?? categoryLabel;
    }

    if (!matchedProduct) {
      const plannedKey = sourceRow.productKey;

      if (!plannedProducts.has(plannedKey)) {
        const productId = nextProductId++;

        plannedProducts.set(plannedKey, {
          id: productId,
          sku: generateSku(sourceRow, productId),
          name: sourceRow.detail,
          detail: sourceRow.detail,
          presentation: sourceRow.presentation,
          category_id: categoryId,
          category_name: sourceRow.section,
          brand: sourceRow.brand,
          vegano: normalizeText(`${sourceRow.section} ${sourceRow.detail}`).includes("vegano"),
          kosher: normalizeText(`${sourceRow.section} ${sourceRow.detail}`).includes("kosher"),
          testeado_en_animales: null,
          public_price: sourceRow.price,
          member_price: sourceRow.price,
          image: null,
          status: sourceRow.outOfStock ? "published" : "published",
          featured: false,
          featured_priority: null,
          trending: false,
          stock: sourceRow.outOfStock ? 0 : null,
          views_count: 0,
          sales_count: 0,
          description: sourceRow.detail,
          source_section: sourceRow.section,
          existed: false,
        });
      }

      rows.push({
        ...sourceRow,
        categoryLabel,
        categoryId,
        action: "create",
        notes,
        sku: plannedProducts.get(plannedKey)?.sku,
      });
      continue;
    }

    const plannedProduct: PlannedProduct = {
      id: matchedProduct.id,
      sku: matchedProduct.sku,
      name: sourceRow.detail,
      detail: sourceRow.detail,
      presentation: sourceRow.presentation,
      category_id: categoryId,
      category_name: sourceRow.section,
      brand: sourceRow.brand,
      vegano: normalizeText(`${sourceRow.section} ${sourceRow.detail}`).includes("vegano"),
      kosher: normalizeText(`${sourceRow.section} ${sourceRow.detail}`).includes("kosher"),
      testeado_en_animales: matchedProduct.testeado_en_animales,
      public_price: mode === "guest" ? sourceRow.price : matchedProduct.public_price,
      member_price: mode === "member" ? sourceRow.price : matchedProduct.member_price,
      image: matchedProduct.image,
      status: "published",
      featured: matchedProduct.featured,
      featured_priority: matchedProduct.featured_priority,
      trending: matchedProduct.trending,
      stock: sourceRow.outOfStock ? 0 : matchedProduct.stock,
      views_count: matchedProduct.views_count ?? 0,
      sales_count: matchedProduct.sales_count ?? 0,
      description: matchedProduct.description ?? sourceRow.detail,
      source_section: sourceRow.section,
      existed: true,
    };

    const matchedBy = matchedProduct.id ? `ID ${matchedProduct.id}` : "coincidencia";

    const previewRow: PreviewRow = {
      ...sourceRow,
      categoryLabel,
      categoryId,
      action: "update",
      productId: matchedProduct.id,
      sku: matchedProduct.sku,
      currentPrice,
      currentPriceField: targetField,
      notes: matchedBy ? [matchedBy] : notes,
    };

    plannedProducts.set(sourceRow.productKey, plannedProduct);

    rows.push(previewRow);
  }

  return {
    plan: {
      fileName,
      mode,
      sheetName,
      totalRows: workbookRows.length,
      parsedRows: rows.length,
      createdProducts: [...plannedProducts.values()].filter((product) => !product.existed).length,
      updatedProducts: [...plannedProducts.values()].filter((product) => product.existed).length,
      createdBrands: [...plannedBrands.values()].filter((brand) => !brand.existed).length,
      createdCategories: [...plannedCategories.values()].filter((category) => !category.existed).length,
      ignoredRows: warnings.length,
      warnings,
      rows,
    } satisfies ExcelImportPlan,
    plannedBrands,
    plannedCategories,
    plannedProducts,
  };
}

async function upsertBrand(client: PoolClient, brand: PlannedBrand) {
  await client.query(
    `
      insert into brands (id, code, name, image, featured, active)
      values ($1, $2, $3, $4, $5, $6)
      on conflict (id) do update set
        code = excluded.code,
        name = excluded.name,
        image = excluded.image,
        featured = excluded.featured,
        active = excluded.active
    `,
    [brand.id, brand.code, brand.name, brand.image, brand.featured, brand.active],
  );
}

async function upsertCategory(client: PoolClient, category: PlannedCategory) {
  await client.query(
    `
      insert into categories (id, name, slug, visible, deleted_at)
      values ($1, $2, $3, $4, null)
      on conflict (id) do update set
        name = excluded.name,
        slug = excluded.slug,
        visible = excluded.visible,
        deleted_at = null
    `,
    [category.id, category.name, category.slug, category.visible],
  );
}

async function upsertProduct(client: PoolClient, product: PlannedProduct, mode: ExcelImportMode) {
  await client.query(
    `
      insert into products (
        id, sku, name, detail, presentation, category_id, category_name, brand,
        vegano, kosher, testeado_en_animales, public_price, member_price, image,
        status, featured, featured_priority, trending, stock, views_count, sales_count,
        description, source_section, deleted_at, created_at, updated_at
      ) values (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,null,now(),now()
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
        public_price = case when $24 = 'guest' then excluded.public_price else products.public_price end,
        member_price = case when $24 = 'member' then excluded.member_price else products.member_price end,
        image = coalesce(excluded.image, products.image),
        status = excluded.status,
        featured = products.featured,
        featured_priority = products.featured_priority,
        trending = products.trending,
        stock = excluded.stock,
        views_count = products.views_count,
        sales_count = products.sales_count,
        description = excluded.description,
        source_section = excluded.source_section,
        deleted_at = null,
        updated_at = now()
    `,
    [
      product.id,
      product.sku,
      product.name,
      product.detail,
      product.presentation,
      product.category_id,
      product.category_name,
      product.brand,
      product.vegano,
      product.kosher,
      product.testeado_en_animales,
      product.public_price,
      product.member_price,
      product.image,
      product.status,
      product.featured,
      product.featured_priority,
      product.trending,
      product.stock,
      product.views_count,
      product.sales_count,
      product.description,
      product.source_section,
      mode,
    ],
  );
}

async function applyImportPlan(plan: {
  plannedBrands: Map<string, PlannedBrand>;
  plannedCategories: Map<string, PlannedCategory>;
  plannedProducts: Map<string, PlannedProduct>;
  mode: ExcelImportMode;
}) {
  if (!postgresPool) {
    throw new Error("DATABASE_URL no está configurada.");
  }

  const client = await postgresPool.connect();

  try {
    await client.query("begin");

    for (const brand of plan.plannedBrands.values()) {
      await upsertBrand(client, brand);
    }

    for (const category of plan.plannedCategories.values()) {
      await upsertCategory(client, category);
    }

    for (const product of plan.plannedProducts.values()) {
      await upsertProduct(client, product, plan.mode);
    }

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function buildExcelImportPlan(file: File, mode: ExcelImportMode) {
  await ensureDatabase();

  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames.includes("PEDIDO CLIENTE") ? "PEDIDO CLIENTE" : workbook.SheetNames[0] ?? "Sheet1";
  const sheet = workbook.Sheets[sheetName];

  if (!sheet) {
    throw new Error("No se encontró la hoja PEDIDO CLIENTE.");
  }

  const { rows: workbookRows, warnings: parseWarnings } = extractWorkbookRows(sheet);

  const client = await postgresPool!.connect();

  try {
    const catalog = await loadCatalogState(client);
    const { productMap, brandMap, categoryMap } = buildExistingMaps(catalog.products, catalog.brands, catalog.categories);
    const { plan, plannedBrands, plannedCategories, plannedProducts } = buildPlanWithCatalog({
      fileName: file.name,
      mode,
      sheetName,
      workbookRows,
      warnings: parseWarnings,
      productMap,
      brandMap,
      categoryMap,
      categories: catalog.categories,
    });

    return {
      plan,
      internal: {
        plannedBrands,
        plannedCategories,
        plannedProducts,
      },
    };
  } finally {
    client.release();
  }
}

export async function applyExcelImport(file: File, mode: ExcelImportMode) {
  const { plan, internal } = await buildExcelImportPlan(file, mode);
  await applyImportPlan({
    plannedBrands: internal.plannedBrands,
    plannedCategories: internal.plannedCategories,
    plannedProducts: internal.plannedProducts,
    mode,
  });

  return plan;
}
