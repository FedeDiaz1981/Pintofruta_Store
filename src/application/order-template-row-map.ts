import ExcelJS from "exceljs";
import type { PoolClient } from "pg";
import type { ProductItem } from "@/domain/site-content";
import { postgresPool } from "@/infrastructure/db/postgres";
import { downloadOrderExcelTemplate, getActiveOrderExcelTemplate, type OrderTemplateAudience } from "@/infrastructure/order-template";
import { normalizeText } from "@/lib/catalog";
import { getTemplateRowMapKey } from "@/lib/order-template-row-map-key";

const HEADER_ALIASES: Record<string, string[]> = {
  sku: ["sku", "codigo", "código"],
  name: ["producto", "nombre", "detalle", "detalle / variedad", "detalle variedad", "variedad"],
  brand: ["marca"],
  presentation: ["presentacion", "presentación"],
  quantity: ["cantidad"],
  publicPrice: ["precio", "precio publico", "precio público", "valor"],
  subtotal: ["subtotal"],
};

function collapseWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeHeader(value: unknown) {
  return normalizeText(collapseWhitespace(String(value ?? "")))
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCellText(value: unknown) {
  return normalizeText(collapseWhitespace(String(value ?? ""))).trim();
}

function toExcelJsBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
}

function tokenizeForSimilarity(value: unknown) {
  const normalized = normalizeCellText(value);
  if (!normalized) {
    return [];
  }

  return normalized
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length > 1);
}

function textSimilarity(left: unknown, right: unknown) {
  const normalizedLeft = normalizeCellText(left);
  const normalizedRight = normalizeCellText(right);

  if (!normalizedLeft || !normalizedRight) {
    return 0;
  }

  if (normalizedLeft === normalizedRight) {
    return 1;
  }

  if (normalizedLeft.includes(normalizedRight) || normalizedRight.includes(normalizedLeft)) {
    return 0.95;
  }

  const leftTokens = tokenizeForSimilarity(normalizedLeft);
  const rightTokens = tokenizeForSimilarity(normalizedRight);
  if (leftTokens.length === 0 || rightTokens.length === 0) {
    return 0;
  }

  const rightSet = new Set(rightTokens);
  const intersection = leftTokens.filter((token) => rightSet.has(token)).length;
  if (intersection === 0) {
    return 0;
  }

  const unionSize = new Set([...leftTokens, ...rightTokens]).size;
  const overlap = intersection / Math.min(leftTokens.length, rightTokens.length);
  const jaccard = intersection / unionSize;

  return Math.max(jaccard, overlap * 0.9);
}

function getRowText(row: ExcelJS.Row) {
  const values: string[] = [];

  row.eachCell({ includeEmpty: false }, (cell) => {
    const normalized = normalizeCellText(cell.value);
    if (normalized) {
      values.push(normalized);
    }
  });

  return values.join(" ");
}

function parseTemplateRowMap(value: unknown) {
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return {};
      }

      return Object.entries(parsed as Record<string, unknown>).reduce<Record<string, number>>((acc, [key, currentValue]) => {
        const rowNumber = Math.floor(Number(currentValue));
        if (key && Number.isFinite(rowNumber) && rowNumber > 0) {
          acc[key] = rowNumber;
        }
        return acc;
      }, {});
    } catch {
      return {};
    }
  }

  if (value && typeof value === "object" && !Array.isArray(value)) {
    return Object.entries(value as Record<string, unknown>).reduce<Record<string, number>>((acc, [key, currentValue]) => {
      const rowNumber = Math.floor(Number(currentValue));
      if (key && Number.isFinite(rowNumber) && rowNumber > 0) {
        acc[key] = rowNumber;
      }
      return acc;
    }, {});
  }

  return {};
}

function findHeaderRow(sheet: ExcelJS.Worksheet) {
  const maxRows = Math.min(sheet.rowCount || 0, 25);

  for (let rowNumber = 1; rowNumber <= maxRows; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const columnMap = new Map<string, number>();
    let matches = 0;

    row.eachCell({ includeEmpty: false }, (cell, columnNumber) => {
      const normalized = normalizeHeader(cell.value);
      if (!normalized) {
        return;
      }

      for (const [key, aliases] of Object.entries(HEADER_ALIASES)) {
        if (columnMap.has(key)) {
          continue;
        }

        if (aliases.some((alias) => normalizeHeader(alias) === normalized)) {
          columnMap.set(key, columnNumber);
          matches += 1;
          break;
        }
      }
    });

    if (matches >= 2) {
      return {
        rowNumber,
        columnMap,
      };
    }
  }

  return null;
}

function detectRowForProduct(
  sheet: ExcelJS.Worksheet,
  product: Pick<ProductItem, "sku" | "name" | "brand" | "presentation">,
) {
  const header = findHeaderRow(sheet);
  if (!header) {
    return null;
  }

  const skuColumn = header.columnMap.get("sku");
  const nameColumn = header.columnMap.get("name");
  const brandColumn = header.columnMap.get("brand");
  const presentationColumn = header.columnMap.get("presentation");

  const targetSku = normalizeCellText(product.sku);
  const targetName = normalizeCellText(product.name);
  const targetBrand = normalizeCellText(product.brand);
  const targetPresentation = normalizeCellText(product.presentation);
  const targetComposite = [targetSku, targetName, targetBrand, targetPresentation].filter(Boolean).join(" ");

  let bestRow: number | null = null;
  let bestScore = 0;

  for (let rowNumber = header.rowNumber + 1; rowNumber <= (sheet.rowCount || header.rowNumber); rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const rowText = getRowText(row);
    if (!rowText) {
      continue;
    }

    const rowSku = skuColumn ? normalizeCellText(row.getCell(skuColumn).value) : "";
    const rowName = nameColumn ? normalizeCellText(row.getCell(nameColumn).value) : "";
    const rowBrand = brandColumn ? normalizeCellText(row.getCell(brandColumn).value) : "";
    const rowPresentation = presentationColumn ? normalizeCellText(row.getCell(presentationColumn).value) : "";

    if (targetSku && rowSku && rowSku === targetSku) {
      return rowNumber;
    }

    const skuScore = textSimilarity(rowSku, targetSku);
    const nameScore = textSimilarity(rowName, targetName);
    const brandScore = textSimilarity(rowBrand, targetBrand);
    const presentationScore = textSimilarity(rowPresentation, targetPresentation);
    const rowCompositeScore = textSimilarity(rowText, targetComposite);

    const score =
      Math.max(skuScore * 1.3, 0) +
      Math.max(nameScore * 1.0, 0) +
      Math.max(brandScore * 0.35, 0) +
      Math.max(presentationScore * 0.2, 0) +
      Math.max(rowCompositeScore * 0.85, 0);

    if (score > bestScore) {
      bestScore = score;
      bestRow = rowNumber;
    }
  }

  return bestScore >= 1.25 ? bestRow : null;
}

async function resolveWorkbookForAudience(audience: OrderTemplateAudience) {
  const template = await getActiveOrderExcelTemplate(audience);
  if (!template) {
    return null;
  }

  const downloaded = await downloadOrderExcelTemplate(template);
  if (!downloaded) {
    return null;
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(toExcelJsBuffer(downloaded.buffer));

  return {
    template,
    workbook,
  };
}

type TemplateSyncProduct = Pick<ProductItem, "id" | "sku" | "name" | "brand" | "presentation"> & {
  templateRowMap: Record<string, number>;
};

async function loadProductsForTemplateSync(client: PoolClient) {
  const result = await client.query<{
    id: number;
    sku: string;
    name: string;
    brand: string;
    presentation: string;
    template_row_map: unknown;
  }>(
    `
      select id, sku, name, brand, presentation, template_row_map
      from products
      where deleted_at is null
      order by id
    `,
  );

  return result.rows.map<TemplateSyncProduct>((row) => ({
    id: row.id,
    sku: row.sku,
    name: row.name,
    brand: row.brand,
    presentation: row.presentation,
    templateRowMap: parseTemplateRowMap(row.template_row_map),
  }));
}

export async function enrichProductsWithActiveTemplateRowMaps(products: ProductItem[]) {
  const workbooks = await Promise.all([resolveWorkbookForAudience("guest"), resolveWorkbookForAudience("member")]);
  const activeTemplates = workbooks.filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

  if (activeTemplates.length === 0) {
    return products;
  }

  const enrichedProducts = products.map((product) => ({ ...product, templateRowMap: { ...(product.templateRowMap ?? {}) } }));

  for (const { template, workbook } of activeTemplates) {
    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      continue;
    }

    const stableKey = getTemplateRowMapKey(template);
    const legacyKey = String(template.id);

    for (const product of enrichedProducts) {
      const currentMap = product.templateRowMap ?? {};

      if (currentMap[stableKey] || currentMap[legacyKey]) {
        continue;
      }

      const inferredRow = detectRowForProduct(worksheet, product);
      if (inferredRow) {
        currentMap[stableKey] = inferredRow;
      }

      product.templateRowMap = currentMap;
    }
  }

  return enrichedProducts;
}

export async function syncProductsWithUploadedTemplateRowMaps(file: File, audience: OrderTemplateAudience) {
  if (!postgresPool) {
    return { updatedProducts: 0 };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(toExcelJsBuffer(buffer));

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error("No se encontró una hoja válida en el template Excel.");
  }

  const client = await postgresPool.connect();

  try {
    const products = await loadProductsForTemplateSync(client);
    const templateKey = getTemplateRowMapKey({ template_key: "pedido_excel", audience });
    const updates = products
      .map((product) => {
        const inferredRow = detectRowForProduct(worksheet, product);
        if (!inferredRow) {
          return null;
        }

        const cleanedMap = Object.entries(product.templateRowMap ?? {}).reduce<Record<string, number>>((acc, [key, value]) => {
          if (!/^\d+$/.test(key)) {
            acc[key] = value;
          }
          return acc;
        }, {});

        cleanedMap[templateKey] = inferredRow;
        return {
          id: product.id,
          templateRowMap: cleanedMap,
        };
      })
      .filter((item): item is { id: number; templateRowMap: Record<string, number> } => Boolean(item));

    if (updates.length === 0) {
      return { updatedProducts: 0 };
    }

    await client.query("begin");

    try {
      for (const update of updates) {
        await client.query(
          `
            update products
            set template_row_map = $2::jsonb,
                updated_at = now()
            where id = $1
          `,
          [update.id, JSON.stringify(update.templateRowMap)],
        );
      }

      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    }

    return { updatedProducts: updates.length };
  } finally {
    client.release();
  }
}
