import ExcelJS from "exceljs";
import { appendFileSync } from "node:fs";
import { postgresPool } from "@/infrastructure/db/postgres";
import { normalizeText } from "@/lib/catalog";
import {
  downloadOrderExcelTemplate,
  getActiveOrderExcelTemplate,
  type OrderTemplateAudience,
} from "@/infrastructure/order-template";
import { getTemplateRowMapKey } from "@/lib/order-template-row-map-key";
import { packageRemitoWorkbook, REMITO_CONTENT_TYPE } from "@/lib/order-excel-package";

export type OrderExcelRequestItem = {
  kind?: "product" | "pack";
  sku?: string;
  id?: number;
  name?: string;
  brand?: string;
  presentation?: string;
  publicPrice?: number;
  memberPrice?: number;
  image?: string | null;
  quantity?: number;
};

export type OrderExcelViewer = {
  authenticated: boolean;
  canSeePrices: boolean;
  name?: string | null;
  email?: string | null;
};

type ProductDbRow = {
  sku: string;
  name: string;
  brand: string;
  presentation: string;
  public_price: number;
  member_price: number;
  image: string | null;
  template_row_map: unknown;
};

type PackDbRow = {
  id: number;
  apodo: string;
  title: string;
  category: string;
  public_price: number;
  image: string | null;
};

type PackCountRow = {
  pack_id: number;
  total: number;
};

type ResolvedOrderLine = {
  kind: "product" | "pack";
  sku: string;
  name: string;
  brand: string;
  presentation: string;
  quantity: number;
  publicPrice: number;
  memberPrice: number;
  unitPrice: number;
  subtotal: number;
  image?: string | null;
  templateRowMap?: Record<string, number>;
};

const ORDER_TEMPLATE_KEY = "pedido_excel";
const ORDER_TIME_ZONE = "America/Argentina/Buenos_Aires";

const COLUMN_ALIASES: Record<string, string[]> = {
  sku: ["sku", "codigo", "código"],
  name: ["producto", "nombre", "detalle", "detalle / variedad", "detalle variedad", "variedad"],
  brand: ["marca"],
  presentation: ["presentacion", "presentación"],
  quantity: ["cantidad"],
  publicPrice: ["precio", "precio publico", "precio público", "valor"],
  subtotal: ["subtotal"],
  selected: ["seleccionado", "marcado", "pedido"],
};

const REMITO_COLUMN_ALIASES: Record<string, string[]> = {
  detail: ["detalle", "detalle / variedad", "detalle variedad", "producto", "nombre"],
  quantity: ["cant", "cantidad"],
  price: ["precio", "precio unitario", "precio x unidad", "precio por unidad", "valor"],
  total: ["total", "subtotal"],
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

function formatRemitoDate(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const parts = new Intl.DateTimeFormat("es-AR", {
    timeZone: ORDER_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  }).formatToParts(date);
  const getPart = (type: string) => parts.find((part) => part.type === type)?.value ?? "";

  return [getPart("day"), getPart("month"), getPart("year")].filter(Boolean).join("-");
}

function getRemitoFileName(generatedAt: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: ORDER_TIME_ZONE,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(generatedAt));
  const part = (type: string) => parts.find((entry) => entry.type === type)?.value ?? "";
  return `Remito_${part("year")}-${part("month")}-${part("day")}_${part("hour")}-${part("minute")}-${part("second")}.xlsm`;
}

function resolveAudience(viewer: OrderExcelViewer): OrderTemplateAudience {
  return viewer.authenticated && viewer.canSeePrices ? "member" : "guest";
}

function traceExcel(step: string, details: Record<string, unknown> = {}) {
  try {
    appendFileSync(
      "pedido-excel-trace.log",
      `${new Date().toISOString()} ${step} ${JSON.stringify(details)}\n`,
      "utf8",
    );
  } catch {
    // Ignorado a propósito.
  }
}

function toExcelJsBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
}

function cloneStyle<T>(value: T): T {
  if (value && typeof value === "object") {
    return JSON.parse(JSON.stringify(value)) as T;
  }

  return value;
}

function getExcelColumnLetter(columnNumber: number) {
  let column = "";
  let remaining = Math.max(1, Math.floor(columnNumber));

  while (remaining > 0) {
    const modulo = (remaining - 1) % 26;
    column = String.fromCharCode(65 + modulo) + column;
    remaining = Math.floor((remaining - modulo) / 26);
  }

  return column;
}

function getCellAddress(rowNumber: number, columnNumber: number) {
  return `${getExcelColumnLetter(columnNumber)}${rowNumber}`;
}

function getRangeAddress(startRow: number, startColumn: number, endRow: number, endColumn: number) {
  return `${getCellAddress(startRow, startColumn)}:${getCellAddress(endRow, endColumn)}`;
}

function setWorkbookRecalculation(workbook: ExcelJS.Workbook) {
  workbook.calcProperties.fullCalcOnLoad = true;
}

function copyRowTemplate(sourceRow: ExcelJS.Row, targetRow: ExcelJS.Row) {
  targetRow.height = sourceRow.height;
  targetRow.hidden = sourceRow.hidden;

  sourceRow.eachCell({ includeEmpty: true }, (sourceCell, columnNumber) => {
    const targetCell = targetRow.getCell(columnNumber);
    targetCell.style = cloneStyle(sourceCell.style);
    if (sourceCell.numFmt) {
      targetCell.numFmt = sourceCell.numFmt;
    }
    if (sourceCell.alignment) {
      targetCell.alignment = cloneStyle(sourceCell.alignment);
    }
    if (sourceCell.border) {
      targetCell.border = cloneStyle(sourceCell.border);
    }
    if (sourceCell.fill) {
      targetCell.fill = cloneStyle(sourceCell.fill);
    }
    if (sourceCell.font) {
      targetCell.font = cloneStyle(sourceCell.font);
    }
    if (sourceCell.protection) {
      targetCell.protection = cloneStyle(sourceCell.protection);
    }
  });
}

function normalizeCandidateValue(value: unknown) {
  return normalizeText(collapseWhitespace(String(value ?? ""))).trim();
}

function buildLookupMap(lines: ResolvedOrderLine[]) {
  const lookup = new Map<string, ResolvedOrderLine>();

  for (const line of lines) {
    const candidates = [
      line.sku,
      line.name,
      `${line.name} ${line.brand}`.trim(),
      `${line.name} ${line.presentation}`.trim(),
    ];

    for (const candidate of candidates) {
      const normalized = normalizeCandidateValue(candidate);
      if (normalized && !lookup.has(normalized)) {
        lookup.set(normalized, line);
      }
    }
  }

  return lookup;
}

function parseTemplateRowMap(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.entries(value as Record<string, unknown>).reduce<Record<string, number>>((acc, [key, currentValue]) => {
    const rowNumber = Math.floor(Number(currentValue));
    if (key && Number.isFinite(rowNumber) && rowNumber > 0) {
      acc[key] = rowNumber;
    }
    return acc;
  }, {});
}

function tokenizeForSimilarity(value: unknown) {
  const normalized = normalizeCandidateValue(value);
  if (!normalized) {
    return [];
  }

  return normalized
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length > 1);
}

function textSimilarity(left: unknown, right: unknown) {
  const normalizedLeft = normalizeCandidateValue(left);
  const normalizedRight = normalizeCandidateValue(right);

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

function getRowMeaningfulText(row: ExcelJS.Row, columnMap: Map<string, number>) {
  const values = [
    columnMap.get("sku"),
    columnMap.get("name"),
    columnMap.get("brand"),
    columnMap.get("presentation"),
    columnMap.get("quantity"),
    columnMap.get("publicPrice"),
    columnMap.get("subtotal"),
  ]
    .filter((columnNumber): columnNumber is number => Boolean(columnNumber))
    .map((columnNumber) => row.getCell(columnNumber).value);

  return values.map((value) => normalizeCandidateValue(value)).filter(Boolean).join(" ");
}

function pickBestMatchingLine(row: ExcelJS.Row, lines: ResolvedOrderLine[], columnMap: Map<string, number>) {
  const skuColumn = columnMap.get("sku");
  const nameColumn = columnMap.get("name");
  const brandColumn = columnMap.get("brand");
  const presentationColumn = columnMap.get("presentation");

  const rowSku = skuColumn ? normalizeCandidateValue(row.getCell(skuColumn).value) : "";
  if (rowSku) {
    const exactSkuMatch = lines.find((line) => normalizeCandidateValue(line.sku) === rowSku);
    if (exactSkuMatch) {
      return exactSkuMatch;
    }
  }

  const rowBrand = brandColumn ? normalizeCandidateValue(row.getCell(brandColumn).value) : "";
  const rowName = nameColumn ? normalizeCandidateValue(row.getCell(nameColumn).value) : "";
  const rowPresentation = presentationColumn ? normalizeCandidateValue(row.getCell(presentationColumn).value) : "";
  const rowComposite = getRowMeaningfulText(row, columnMap);

  const brandCandidates = rowBrand
    ? lines.filter((line) => {
        const lineBrand = normalizeCandidateValue(line.brand);
        return lineBrand && (lineBrand === rowBrand || lineBrand.includes(rowBrand) || rowBrand.includes(lineBrand));
      })
    : lines;

  const searchPool = brandCandidates.length > 0 ? brandCandidates : lines;

  let bestLine: ResolvedOrderLine | null = null;
  let bestScore = 0;

  for (const line of searchPool) {
    const lineSku = normalizeCandidateValue(line.sku);
    const lineBrand = normalizeCandidateValue(line.brand);
    const lineName = normalizeCandidateValue(line.name);
    const linePresentation = normalizeCandidateValue(line.presentation);

    const skuScore = rowSku ? textSimilarity(rowSku, lineSku) : 0;
    const brandScore = rowBrand ? textSimilarity(rowBrand, lineBrand) : 0;
    const nameScore = rowName ? textSimilarity(rowName, lineName) : 0;
    const detailScore = rowName ? textSimilarity(rowName, `${lineName} ${linePresentation}`) : 0;
    const presentationScore = rowPresentation ? textSimilarity(rowPresentation, linePresentation) : 0;
    const compositeScore = rowComposite ? textSimilarity(rowComposite, `${lineSku} ${lineBrand} ${lineName} ${linePresentation}`) : 0;

    const score =
      Math.max(skuScore * 1.2, 0) +
      brandScore * 0.35 +
      Math.max(nameScore, detailScore) * 0.55 +
      presentationScore * 0.1 +
      compositeScore * 0.2;

    if (score > bestScore) {
      bestScore = score;
      bestLine = line;
    }
  }

  if (bestScore >= 0.7) {
    return bestLine;
  }

  return null;
}

function getExactTemplateRow(
  line: ResolvedOrderLine,
  template: { id: number; template_key: string; audience: OrderTemplateAudience } | null | undefined,
) {
  if (!template || !line.templateRowMap) {
    return null;
  }

  const stableKey = getTemplateRowMapKey(template);
  const legacyKey = String(template.id);
  const rowNumber = Number(line.templateRowMap[stableKey] ?? line.templateRowMap[legacyKey]);
  if (!Number.isFinite(rowNumber) || rowNumber <= 0) {
    return null;
  }

  return Math.floor(rowNumber);
}

async function resolveRequestedLines(items: OrderExcelRequestItem[], viewer: OrderExcelViewer) {
  if (!postgresPool) {
    return items
      .map((item) => {
        const quantity = Math.max(1, Number(item.quantity) || 1);
        const publicPrice = Math.max(0, Number(item.publicPrice) || 0);
        const memberPrice = Math.max(0, Number(item.memberPrice ?? item.publicPrice) || 0);
        const unitPrice = viewer.authenticated && viewer.canSeePrices && memberPrice > 0 ? memberPrice : publicPrice;

        return {
          kind: item.kind === "pack" ? "pack" : "product",
          sku: item.sku || `ITEM-${Date.now()}`,
          name: item.name || "Producto",
          brand: item.brand || "",
          presentation: item.presentation || "",
          quantity,
          publicPrice,
          memberPrice,
          unitPrice,
          subtotal: unitPrice * quantity,
          image: item.image ?? null,
        } satisfies ResolvedOrderLine;
      })
      .filter((item) => item.sku);
  }

  const normalizedItems = items
    .map((item) => ({
      kind: item.kind === "pack" ? "pack" : "product",
      sku: collapseWhitespace(String(item.sku ?? "")).trim(),
      id: Number(item.id ?? 0) || null,
      quantity: Math.max(1, Number(item.quantity) || 1),
      fallback: item,
    }))
    .filter((item) => item.sku || item.id);

  const productSkus = [...new Set(normalizedItems.filter((item) => item.kind === "product" && item.sku).map((item) => item.sku))];
  const packIds = [...new Set(normalizedItems.filter((item) => item.kind === "pack" && item.id).map((item) => Number(item.id)))];

  const [productResult, packResult, packCountResult] = await Promise.all([
    productSkus.length > 0
      ? postgresPool.query<ProductDbRow>(
          `
            select sku, name, brand, presentation, public_price, member_price, image, template_row_map
            from products
            where deleted_at is null
              and sku = any($1::text[])
          `,
          [productSkus],
        )
      : Promise.resolve({ rows: [] } as { rows: ProductDbRow[] }),
    packIds.length > 0
      ? postgresPool.query<PackDbRow>(
          `
            select id, apodo, title, category, public_price, image
            from promotion_packs
            where active = true
              and id = any($1::int[])
          `,
          [packIds],
        )
      : Promise.resolve({ rows: [] } as { rows: PackDbRow[] }),
    packIds.length > 0
      ? postgresPool.query<PackCountRow>(
          `
            select pack_id, count(*)::int as total
            from promotion_pack_items
            where pack_id = any($1::int[])
            group by pack_id
          `,
          [packIds],
        )
      : Promise.resolve({ rows: [] } as { rows: PackCountRow[] }),
  ]);

  const productMap = new Map(productResult.rows.map((row) => [row.sku, row]));
  const packMap = new Map(packResult.rows.map((row) => [row.id, row]));
  const packCountMap = new Map(packCountResult.rows.map((row) => [row.pack_id, row.total]));

  return normalizedItems.map((item) => {
    const fallback = item.fallback;

    if (item.kind === "pack") {
      const packId = item.id ?? Number((item.sku || "").replace(/^PACK-/, ""));
      const pack = Number.isFinite(packId) ? packMap.get(packId) : null;
      const packCount = pack ? packCountMap.get(pack.id) ?? 0 : 0;
      const publicPrice = Math.max(0, Number(pack?.public_price ?? fallback.publicPrice ?? 0) || 0);
      const quantity = item.quantity;

      return {
        kind: "pack" as const,
        sku: item.sku || `PACK-${packId}`,
        name: pack?.title || fallback.name || "Promoción",
        brand: pack?.category || fallback.brand || "Promoción",
        presentation: fallback.presentation || `${packCount} productos incluidos`,
        quantity,
        publicPrice,
        memberPrice: publicPrice,
        unitPrice: publicPrice,
        subtotal: publicPrice * quantity,
        image: pack?.image ?? fallback.image ?? null,
      } satisfies ResolvedOrderLine;
    }

    const product = item.sku ? productMap.get(item.sku) : null;
    const publicPrice = Math.max(0, Number(product?.public_price ?? fallback.publicPrice ?? 0) || 0);
    const memberPrice = Math.max(0, Number(product?.member_price ?? fallback.memberPrice ?? publicPrice) || publicPrice);
    const unitPrice = viewer.authenticated && viewer.canSeePrices && memberPrice > 0 ? memberPrice : publicPrice;

    return {
      kind: "product" as const,
      sku: item.sku || `ITEM-${product?.sku || "UNKNOWN"}`,
      name: product?.name || fallback.name || "Producto",
      brand: product?.brand || fallback.brand || "",
      presentation: product?.presentation || fallback.presentation || "",
      quantity: item.quantity,
      publicPrice,
      memberPrice,
      unitPrice,
      subtotal: unitPrice * item.quantity,
      image: product?.image ?? fallback.image ?? null,
      templateRowMap: parseTemplateRowMap(product?.template_row_map),
    } satisfies ResolvedOrderLine;
  });
}

function buildFallbackWorkbook(lines: ResolvedOrderLine[], viewer: OrderExcelViewer, generatedAt: string) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "PintoFruta";
  workbook.created = new Date(generatedAt);
  workbook.modified = new Date(generatedAt);
  workbook.properties.date1904 = false;
  setWorkbookRecalculation(workbook);

  const remitoSheet = workbook.addWorksheet("REMITO");
  writeRegisterSheet(remitoSheet, lines, viewer, generatedAt);
  return workbook;
}

function getHeaderColumnMap(sheet: ExcelJS.Worksheet, headerRow: number) {
  const headerMap = new Map<string, number>();
  const row = sheet.getRow(headerRow);

  row.eachCell((cell, columnNumber) => {
    const normalized = normalizeHeader(cell.value);
    if (normalized) {
      headerMap.set(normalized, columnNumber);
    }
  });

  const resolvedMap = new Map<string, number>();
  for (const [key, aliases] of Object.entries(COLUMN_ALIASES)) {
    const match = aliases
      .map((alias) => normalizeHeader(alias))
      .find((alias) => headerMap.has(alias));
    if (match) {
      resolvedMap.set(key, headerMap.get(match) as number);
    }
  }

  return resolvedMap;
}

function getHeaderColumnMapByAliases(sheet: ExcelJS.Worksheet, headerRow: number, aliases: Record<string, string[]>) {
  const headerMap = new Map<string, number>();
  const row = sheet.getRow(headerRow);

  row.eachCell((cell, columnNumber) => {
    const normalized = normalizeHeader(cell.value);
    if (normalized) {
      headerMap.set(normalized, columnNumber);
    }
  });

  const resolvedMap = new Map<string, number>();
  for (const [key, options] of Object.entries(aliases)) {
    const match = options.map((alias) => normalizeHeader(alias)).find((alias) => headerMap.has(alias));
    if (match) {
      resolvedMap.set(key, headerMap.get(match) as number);
    }
  }

  return resolvedMap;
}

function findLabelRow(sheet: ExcelJS.Worksheet, label: string, startRow: number, maxRows: number) {
  const normalizedLabel = normalizeHeader(label);

  for (let rowNumber = startRow; rowNumber <= Math.min(maxRows, sheet.rowCount || maxRows); rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    let found = false;

    row.eachCell((cell) => {
      if (normalizeHeader(cell.value) === normalizedLabel) {
        found = true;
      }
    });

    if (found) {
      return rowNumber;
    }
  }

  return null;
}

function findRemitoTable(sheet: ExcelJS.Worksheet) {
  const headerRow = findHeaderRow(sheet, 2, 24, REMITO_COLUMN_ALIASES);
  if (!headerRow) {
    return null;
  }

  const columnMap = getHeaderColumnMapByAliases(sheet, headerRow, REMITO_COLUMN_ALIASES);
  const detailColumn = columnMap.get("detail");
  const quantityColumn = columnMap.get("quantity");
  const priceColumn = columnMap.get("price");
  const totalColumn = columnMap.get("total");

  if (!detailColumn || !quantityColumn || !priceColumn || !totalColumn) {
    return null;
  }

  const totalRow = findLabelRow(sheet, "TOTAL", headerRow + 1, headerRow + 120) ?? null;

  return {
    headerRow,
    totalRow,
    detailColumn,
    quantityColumn,
    priceColumn,
    totalColumn,
  };
}

function findHeaderRow(
  sheet: ExcelJS.Worksheet,
  minMatches = 2,
  maxRows = 12,
  aliases: Record<string, string[]> = COLUMN_ALIASES,
) {
  for (let rowNumber = 1; rowNumber <= Math.min(maxRows, sheet.rowCount || maxRows); rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    let matches = 0;

    row.eachCell((cell) => {
      const normalized = normalizeHeader(cell.value);
      if (!normalized) {
        return;
      }

      for (const aliasList of Object.values(aliases)) {
        if (aliasList.some((alias) => normalizeHeader(alias) === normalized)) {
          matches += 1;
          break;
        }
      }
    });

    if (matches >= minMatches) {
      return rowNumber;
    }
  }

  return null;
}

function markSelectedRows(
  sheet: ExcelJS.Worksheet,
  lines: ResolvedOrderLine[],
  template: { id: number; template_key: string; audience: OrderTemplateAudience } | null | undefined,
) {
  const headerRow = findHeaderRow(sheet, 2, 20);
  if (!headerRow) {
    return false;
  }

  const columnMap = getHeaderColumnMap(sheet, headerRow);
  const skuColumn = columnMap.get("sku");
  const nameColumn = columnMap.get("name");
  const brandColumn = columnMap.get("brand");
  const presentationColumn = columnMap.get("presentation");
  if (!skuColumn && !nameColumn) {
    return false;
  }

  const quantityColumn = columnMap.get("quantity");
  const selectedColumn = columnMap.get("selected");
  const subtotalColumn = columnMap.get("subtotal");
  const publicPriceColumn = columnMap.get("publicPrice");

  const lineMap = buildLookupMap(lines);
  const exactRowMap = new Map<number, ResolvedOrderLine>();
  for (const line of lines) {
    const exactRow = getExactTemplateRow(line, template);
    if (exactRow) {
      exactRowMap.set(exactRow, line);
    }
  }

  function writeQuantity(row: ExcelJS.Row, line: ResolvedOrderLine) {
    row.getCell(1).value = line.quantity;
    row.getCell(1).numFmt = "#,##0";
    row.getCell(1).alignment = {
      horizontal: "center",
      vertical: "middle",
    };

    if (quantityColumn && quantityColumn !== 1) {
      row.getCell(quantityColumn).value = line.quantity;
      row.getCell(quantityColumn).numFmt = "#,##0";
    }
  }

  let paintedRows = 0;

  for (const [rowNumber, line] of exactRowMap.entries()) {
    if (rowNumber <= headerRow) {
      continue;
    }

    const row = sheet.getRow(rowNumber);
    if (!row || rowNumber > (sheet.rowCount || rowNumber)) {
      continue;
    }

    writeQuantity(row, line);
    if (selectedColumn) {
      row.getCell(selectedColumn).value = "SI";
    }
    if (subtotalColumn) {
      row.getCell(subtotalColumn).value = line.subtotal;
      row.getCell(subtotalColumn).numFmt = "#,##0";
    }
    if (nameColumn && (!row.getCell(nameColumn).value || normalizeText(String(row.getCell(nameColumn).value ?? "")) === "")) {
      row.getCell(nameColumn).value = line.name;
    }
    if (brandColumn && (!row.getCell(brandColumn).value || normalizeText(String(row.getCell(brandColumn).value ?? "")) === "")) {
      row.getCell(brandColumn).value = line.brand;
    }
    if (presentationColumn && (!row.getCell(presentationColumn).value || normalizeText(String(row.getCell(presentationColumn).value ?? "")) === "")) {
      row.getCell(presentationColumn).value = line.presentation;
    }
    if (publicPriceColumn) {
      row.getCell(publicPriceColumn).value = line.unitPrice;
      row.getCell(publicPriceColumn).numFmt = "#,##0";
    }

    row.eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF7EEE4" } };
    });
    paintedRows += 1;
  }

  for (let rowNumber = headerRow + 1; rowNumber <= (sheet.rowCount || headerRow + lines.length + 10); rowNumber += 1) {
    if (exactRowMap.has(rowNumber)) {
      continue;
    }

    const row = sheet.getRow(rowNumber);
    const rowHasProductSignal = [
      skuColumn ? row.getCell(skuColumn).value : null,
      nameColumn ? row.getCell(nameColumn).value : null,
      presentationColumn ? row.getCell(presentationColumn).value : null,
      quantityColumn ? row.getCell(quantityColumn).value : null,
      publicPriceColumn ? row.getCell(publicPriceColumn).value : null,
      subtotalColumn ? row.getCell(subtotalColumn).value : null,
    ].some((value) => normalizeCandidateValue(value) !== "");

    if (!rowHasProductSignal) {
      continue;
    }

    const candidateValues = [
      skuColumn ? row.getCell(skuColumn).value : null,
      nameColumn ? row.getCell(nameColumn).value : null,
      brandColumn ? row.getCell(brandColumn).value : null,
      presentationColumn ? row.getCell(presentationColumn).value : null,
    ];
    const candidateLine = candidateValues
      .map((value) => normalizeCandidateValue(value))
      .find((candidate) => candidate && lineMap.has(candidate));
    const line = candidateLine ? lineMap.get(candidateLine) ?? null : pickBestMatchingLine(row, lines, columnMap);
    const matchedLine = line ?? pickBestMatchingLine(row, lines, columnMap);

    if (!matchedLine) {
      continue;
    }

    writeQuantity(row, matchedLine);
    if (selectedColumn) {
      row.getCell(selectedColumn).value = "SI";
    }
    if (subtotalColumn) {
      row.getCell(subtotalColumn).value = matchedLine.subtotal;
      row.getCell(subtotalColumn).numFmt = '#,##0';
    }
    if (nameColumn && (!row.getCell(nameColumn).value || normalizeText(String(row.getCell(nameColumn).value ?? "")) === "")) {
      row.getCell(nameColumn).value = matchedLine.name;
    }
    if (brandColumn && (!row.getCell(brandColumn).value || normalizeText(String(row.getCell(brandColumn).value ?? "")) === "")) {
      row.getCell(brandColumn).value = matchedLine.brand;
    }
    if (presentationColumn && (!row.getCell(presentationColumn).value || normalizeText(String(row.getCell(presentationColumn).value ?? "")) === "")) {
      row.getCell(presentationColumn).value = matchedLine.presentation;
    }
    if (publicPriceColumn) {
      row.getCell(publicPriceColumn).value = matchedLine.unitPrice;
      row.getCell(publicPriceColumn).numFmt = '#,##0';
    }

    row.eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF7EEE4" } };
    });
    paintedRows += 1;
  }

  return paintedRows > 0;
}

const remitoPalette = {
  lightBlue: "FFDDEBF7",
  paleBlue: "FFEAF5FB",
  border: "FF1F1F1F",
  text: "FF000000",
  white: "FFFFFFFF",
  muted: "FF666666",
  danger: "FFC00000",
};

const REMITO_ACTION_HEADER = "Quitar";
const REMITO_ACTION_VALUE = "X";

function styleRemitoCell(cell: ExcelJS.Cell, options: { bold?: boolean; fill?: string; align?: "left" | "center" | "right" } = {}) {
  cell.font = { ...(cell.font ?? {}), bold: options.bold ?? false, color: { argb: remitoPalette.text } };
  cell.alignment = { vertical: "middle", horizontal: options.align ?? "left", wrapText: options.align === "left" };
  cell.border = {
    top: { style: "thin", color: { argb: remitoPalette.border } },
    left: { style: "thin", color: { argb: remitoPalette.border } },
    bottom: { style: "thin", color: { argb: remitoPalette.border } },
    right: { style: "thin", color: { argb: remitoPalette.border } },
  };

  if (options.fill) {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: options.fill } };
  }
}

function styleRemitoRow(sheet: ExcelJS.Worksheet, rowNumber: number, firstColumn: number, lastColumn: number, options: { bold?: boolean; fill?: string } = {}) {
  const row = sheet.getRow(rowNumber);

  for (let columnNumber = firstColumn; columnNumber <= lastColumn; columnNumber += 1) {
    const align = columnNumber === firstColumn ? "left" : "right";
    styleRemitoCell(row.getCell(columnNumber), { ...options, align });
  }
}

function centerRemitoRow(sheet: ExcelJS.Worksheet, rowNumber: number, firstColumn: number, lastColumn: number) {
  const row = sheet.getRow(rowNumber);

  for (let columnNumber = firstColumn; columnNumber <= lastColumn; columnNumber += 1) {
    row.getCell(columnNumber).alignment = { vertical: "middle", horizontal: "center" };
  }
}

function getRemitoActionColumn(sheet: ExcelJS.Worksheet, headerRow: number, preferredColumn: number) {
  const header = sheet.getRow(headerRow);
  const scanUntil = Math.max(sheet.columnCount || 0, preferredColumn);

  for (let columnNumber = 1; columnNumber <= scanUntil; columnNumber += 1) {
    const normalized = normalizeHeader(header.getCell(columnNumber).value);
    if (normalized === "quitar" || normalized === "eliminar") {
      return columnNumber;
    }
  }

  return preferredColumn;
}

function styleRemitoActionCell(cell: ExcelJS.Cell, isHeader = false) {
  cell.font = { bold: true, color: { argb: isHeader ? remitoPalette.text : remitoPalette.danger } };
  cell.alignment = { vertical: "middle", horizontal: "center" };
  cell.border = {
    top: { style: "thin", color: { argb: remitoPalette.border } },
    left: { style: "thin", color: { argb: remitoPalette.border } },
    bottom: { style: "thin", color: { argb: remitoPalette.border } },
    right: { style: "thin", color: { argb: remitoPalette.border } },
  };
  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: isHeader ? remitoPalette.lightBlue : remitoPalette.white },
  };
}

function setRemitoDeleteAction(cell: ExcelJS.Cell) {
  cell.value = {
    text: REMITO_ACTION_VALUE,
    hyperlink: `#'REMITO'!A${cell.row}`,
    tooltip: "Eliminar esta fila del remito",
  };
}

function setRemitoMacroRanges(sheet: ExcelJS.Worksheet, headerRow: number, actionColumn: number, totalRow: number, totalColumn: number) {
  sheet.workbook.definedNames.add(`'REMITO'!$${getExcelColumnLetter(actionColumn)}$${headerRow}`, "RemitoQuitar");
  sheet.workbook.definedNames.add(`'REMITO'!$${getExcelColumnLetter(totalColumn)}$${totalRow}`, "RemitoTotal");
}

function writeRemitoTitle(sheet: ExcelJS.Worksheet, rowNumber: number, generatedAt: string, lastColumn: number) {
  const titleCell = sheet.getRow(rowNumber).getCell(1);
  titleCell.value = `REMITO        ${formatRemitoDate(generatedAt)}`;
  titleCell.font = { bold: true, size: 24, color: { argb: remitoPalette.text } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };

  for (let columnNumber = 1; columnNumber <= lastColumn; columnNumber += 1) {
    styleRemitoCell(sheet.getRow(rowNumber).getCell(columnNumber), { bold: true, align: "center" });
  }
}

function setRemitoAutoFilter(sheet: ExcelJS.Worksheet, headerRow: number, firstColumn: number, lastColumn: number, lastDataRow: number) {
  sheet.autoFilter = getRangeAddress(headerRow, firstColumn, Math.max(headerRow, lastDataRow), lastColumn);
}

function getLineUnitPrice(line: ResolvedOrderLine, viewer: OrderExcelViewer) {
  return viewer.authenticated && viewer.canSeePrices ? line.memberPrice || line.unitPrice : line.publicPrice || line.unitPrice;
}

function getLineSubtotalFormula(rowNumber: number, quantityColumn: number, priceColumn: number) {
  return `${getCellAddress(rowNumber, quantityColumn)}*${getCellAddress(rowNumber, priceColumn)}`;
}

function getSubtotalFormula(headerRow: number, lastDataRow: number, totalColumn: number) {
  const column = getExcelColumnLetter(totalColumn);
  // The text header keeps the range valid even after every product row is deleted.
  return `SUBTOTAL(109,${column}$${headerRow}:${column}${Math.max(headerRow, lastDataRow)})`;
}

function getRemitoTextHeight(text: string, width: number, fontSize: number) {
  const charactersPerLine = Math.max(1, Math.floor(width * (11 / fontSize) * 0.8));
  const lineCount = text.split(/\r?\n/).reduce((count, line) => count + Math.max(1, Math.ceil(line.length / charactersPerLine)), 0);
  return Math.min(409, Math.ceil(lineCount * fontSize * 1.35 + 7));
}

function sizeRemitoSheet(sheet: ExcelJS.Worksheet, layout: {
  headerRow: number; totalRow: number; detailColumn: number; quantityColumn: number;
  priceColumn: number; totalColumn: number; actionColumn: number;
}) {
  const { headerRow, totalRow, detailColumn, quantityColumn, priceColumn, totalColumn, actionColumn } = layout;
  const numberFormat = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
  sheet.getColumn(detailColumn).width = 94;
  sheet.getColumn(actionColumn).width = 12;

  for (const [columnNumber, minimumWidth] of [[quantityColumn, 12], [priceColumn, 18], [totalColumn, 20]]) {
    let width = Math.max(minimumWidth, sheet.getRow(headerRow).getCell(columnNumber).text.length + 5);
    for (let rowNumber = headerRow + 1; rowNumber <= totalRow; rowNumber += 1) {
      const cell = sheet.getRow(rowNumber).getCell(columnNumber);
      const value = cell.type === ExcelJS.ValueType.Formula ? cell.result : cell.value;
      if (typeof value === "number") {
        width = Math.max(width, Math.ceil(numberFormat.format(value).length * (12 / 11)) + 5);
      }
    }
    sheet.getColumn(columnNumber).width = width;
  }

  for (let rowNumber = headerRow; rowNumber <= totalRow; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    for (const columnNumber of [detailColumn, quantityColumn, priceColumn, totalColumn, actionColumn]) {
      const cell = row.getCell(columnNumber);
      cell.font = { ...cell.font, name: "Calibri", size: 12 };
    }
    const detail = row.getCell(detailColumn);
    detail.alignment = { ...detail.alignment, wrapText: true, shrinkToFit: false };
    row.height = Math.max(rowNumber === totalRow ? 30 : 24, getRemitoTextHeight(detail.text, 94, 12));
  }
  sheet.getRow(headerRow).height = 28;

  // Merged title/customer cells need an explicit height because Excel AutoFit skips them.
  const lastColumn = sheet.columnCount;
  for (let rowNumber = 1; rowNumber < headerRow; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    let height = row.height ?? 22;
    row.eachCell((cell, columnNumber) => {
      if (cell.master.address !== cell.address || !cell.text) return;
      let width = sheet.getColumn(columnNumber).width ?? 12;
      for (let nextColumn = columnNumber + 1; nextColumn <= lastColumn; nextColumn += 1) {
        if (row.getCell(nextColumn).master.address !== cell.address) break;
        width += sheet.getColumn(nextColumn).width ?? 12;
      }
      cell.alignment = { ...cell.alignment, wrapText: true };
      height = Math.max(height, getRemitoTextHeight(cell.text, width, cell.font?.size ?? 12));
    });
    row.height = Math.min(409, height);
  }
}

function writeRegisterSheet(sheet: ExcelJS.Worksheet, lines: ResolvedOrderLine[], viewer: OrderExcelViewer, generatedAt: string) {
  const palette = {
    dark: "4D2E1A",
    primary: "A86D45",
    cream: "FBF6EE",
    border: "E4D2BA",
    muted: "FF7A6652",
  };

  const table = findRemitoTable(sheet);
  if (table) {
    const { headerRow, totalRow, detailColumn, quantityColumn, priceColumn, totalColumn } = table;
    const firstDataRow = headerRow + 1;
    const currentLastDataRow = totalRow ? totalRow - 1 : Math.max(sheet.rowCount, firstDataRow);
    const currentCapacity = Math.max(0, currentLastDataRow - firstDataRow + 1);
    const firstColumn = Math.min(detailColumn, quantityColumn, priceColumn, totalColumn);
    const lastColumn = Math.max(detailColumn, quantityColumn, priceColumn, totalColumn);
    const actionColumn = getRemitoActionColumn(sheet, headerRow, lastColumn + 1);
    const tableLastColumn = Math.max(lastColumn, actionColumn);
    writeRemitoTitle(sheet, 1, generatedAt, tableLastColumn);

    if (totalRow && lines.length > currentCapacity) {
      const extraRows = lines.length - currentCapacity;
      sheet.insertRows(totalRow, Array.from({ length: extraRows }, () => []), "i");
    } else if (totalRow && lines.length < currentCapacity) {
      sheet.spliceRows(firstDataRow + lines.length, currentCapacity - lines.length);
    }

    const detailTemplateRow = sheet.getRow(firstDataRow);
    const lastLineRow = firstDataRow + lines.length - 1;
    const summaryRowNumber = firstDataRow + lines.length;
    const summaryResult = lines.reduce((sum, line) => {
      const quantity = Math.max(1, Number(line.quantity) || 1);
      return sum + quantity * getLineUnitPrice(line, viewer);
    }, 0);

    sheet.getColumn(actionColumn).width = Math.max(Number(sheet.getColumn(actionColumn).width ?? 0), 10);
    sheet.getRow(headerRow).getCell(actionColumn).value = REMITO_ACTION_HEADER;
    styleRemitoRow(sheet, headerRow, firstColumn, tableLastColumn, { bold: true, fill: remitoPalette.lightBlue });
    styleRemitoActionCell(sheet.getRow(headerRow).getCell(actionColumn), true);
    centerRemitoRow(sheet, headerRow, firstColumn, tableLastColumn);
    sheet.properties.outlineLevelRow = 0;
    sheet.properties.outlineProperties = { summaryBelow: false, summaryRight: false };

    lines.forEach((line, index) => {
      const rowNumber = firstDataRow + index;
      const row = sheet.getRow(rowNumber);

      if (rowNumber !== firstDataRow) {
        copyRowTemplate(detailTemplateRow, row);
      }

      const quantity = Math.max(1, Number(line.quantity) || 1);
      const unitPrice = getLineUnitPrice(line, viewer);
      const total = quantity * unitPrice;

      row.getCell(detailColumn).value = line.name;
      row.getCell(quantityColumn).value = quantity;
      row.getCell(priceColumn).value = unitPrice;
      row.getCell(totalColumn).value = {
        formula: getLineSubtotalFormula(rowNumber, quantityColumn, priceColumn),
        result: total,
      };

      row.getCell(quantityColumn).numFmt = "#,##0";
      row.getCell(priceColumn).numFmt = "#,##0";
      row.getCell(totalColumn).numFmt = "#,##0";
      setRemitoDeleteAction(row.getCell(actionColumn));

      styleRemitoRow(sheet, rowNumber, firstColumn, tableLastColumn);
      row.getCell(detailColumn).font = { ...(row.getCell(detailColumn).font ?? {}), bold: true };
      styleRemitoActionCell(row.getCell(actionColumn));
      row.outlineLevel = 0;
      row.hidden = false;
    });

    const summaryRow = sheet.getRow(summaryRowNumber);
    for (let column = firstColumn; column <= tableLastColumn; column += 1) {
      summaryRow.getCell(column).value = null;
    }
    summaryRow.outlineLevel = 0;
    summaryRow.hidden = false;
    summaryRow.getCell(detailColumn).value = "TOTAL";
    summaryRow.getCell(actionColumn).value = "";
    summaryRow.getCell(totalColumn).value = {
      formula: getSubtotalFormula(headerRow, lastLineRow, totalColumn),
      result: summaryResult,
    };
    summaryRow.getCell(totalColumn).numFmt = "#,##0";
    styleRemitoRow(sheet, summaryRowNumber, firstColumn, tableLastColumn, { bold: true, fill: remitoPalette.lightBlue });
    setRemitoAutoFilter(sheet, headerRow, firstColumn, tableLastColumn, lastLineRow);
    setRemitoMacroRanges(sheet, headerRow, actionColumn, summaryRowNumber, totalColumn);
    sizeRemitoSheet(sheet, { headerRow, totalRow: summaryRowNumber, detailColumn, quantityColumn, priceColumn, totalColumn, actionColumn });

    return;
  }

  const startRow = Math.max(1, sheet.actualRowCount + 1);
  if (startRow === 1) {
    sheet.columns = [
      { header: "Detalle", key: "detail", width: 78 },
      { header: "Cant", key: "quantity", width: 10 },
      { header: "Precio", key: "price", width: 14 },
      { header: "Total", key: "total", width: 14 },
      { header: REMITO_ACTION_HEADER, key: "remove", width: 10 },
    ];
    sheet.views = [{ state: "frozen", ySplit: startRow + 3 }];
    sheet.pageSetup = { orientation: "landscape", paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
    sheet.properties.defaultRowHeight = 22;
    sheet.properties.outlineLevelRow = 0;
    sheet.properties.outlineProperties = { summaryBelow: false, summaryRight: false };
  }

  sheet.mergeCells(startRow, 1, startRow, 5);
  writeRemitoTitle(sheet, startRow, generatedAt, 5);

  sheet.mergeCells(startRow + 1, 1, startRow + 1, 5);
  sheet.getCell(startRow + 1, 1).value = `Generado el ${new Date(generatedAt).toLocaleString("es-AR", { timeZone: ORDER_TIME_ZONE })} - ${
    viewer.authenticated && viewer.canSeePrices ? "Precios de miembro" : "Precios públicos"
  }`;
  sheet.getCell(startRow + 1, 1).font = { italic: true, color: { argb: palette.muted } };

  const tableHeaderRow = sheet.getRow(startRow + 3);
  const headers = ["Detalle", "Cant", "Precio", "Total", REMITO_ACTION_HEADER];
  headers.forEach((header, index) => {
    const cell = tableHeaderRow.getCell(index + 1);
    cell.value = header;
  });
  styleRemitoRow(sheet, startRow + 3, 1, 5, { bold: true, fill: remitoPalette.lightBlue });
  styleRemitoActionCell(tableHeaderRow.getCell(5), true);
  centerRemitoRow(sheet, startRow + 3, 1, 5);

  lines.forEach((line, index) => {
    const rowNumber = startRow + 4 + index;
    const row = sheet.getRow(rowNumber);
    const quantity = Math.max(1, Number(line.quantity) || 1);
    const unitPrice = getLineUnitPrice(line, viewer);
    const total = unitPrice * quantity;

    row.getCell(1).value = line.name;
    row.getCell(2).value = quantity;
    row.getCell(3).value = unitPrice;
    row.getCell(4).value = {
      formula: getLineSubtotalFormula(rowNumber, 2, 3),
      result: total,
    };
    styleRemitoRow(sheet, rowNumber, 1, 5);
    row.getCell(1).font = { ...(row.getCell(1).font ?? {}), bold: true };
    row.getCell(2).numFmt = "#,##0";
    row.getCell(3).numFmt = "#,##0";
    row.getCell(4).numFmt = "#,##0";
    setRemitoDeleteAction(row.getCell(5));
    styleRemitoActionCell(row.getCell(5));
  });

  const lastDataRow = startRow + 3 + lines.length;
  const totalRow = sheet.getRow(startRow + 4 + lines.length);
  totalRow.getCell(1).value = "TOTAL";
  totalRow.getCell(5).value = "";
  totalRow.getCell(4).value = {
    formula: getSubtotalFormula(startRow + 3, lastDataRow, 4),
    result: lines.reduce((sum, line) => {
      const quantity = Math.max(1, Number(line.quantity) || 1);
      return sum + quantity * getLineUnitPrice(line, viewer);
    }, 0),
  };
  totalRow.getCell(4).numFmt = "#,##0";
  styleRemitoRow(sheet, startRow + 4 + lines.length, 1, 5, { bold: true, fill: remitoPalette.lightBlue });
  setRemitoAutoFilter(sheet, startRow + 3, 1, 5, lastDataRow);
  setRemitoMacroRanges(sheet, startRow + 3, 5, totalRow.number, 4);
  sizeRemitoSheet(sheet, { headerRow: startRow + 3, totalRow: totalRow.number, detailColumn: 1, quantityColumn: 2, priceColumn: 3, totalColumn: 4, actionColumn: 5 });
}

function populateWorkbook(
  workbook: ExcelJS.Workbook,
  lines: ResolvedOrderLine[],
  viewer: OrderExcelViewer,
  generatedAt: string,
) {
  const remitoSheet =
    workbook.worksheets.find((sheet) => normalizeHeader(sheet.name) === "remito") ??
    workbook.worksheets[1] ??
    workbook.worksheets[0] ??
    workbook.addWorksheet("REMITO");

  remitoSheet.name = "REMITO";

  // The remito is the only customer-facing export sheet.
  for (const sheet of [...workbook.worksheets]) {
    if (sheet.id !== remitoSheet.id) {
      workbook.removeWorksheet(sheet.id);
    }
  }

  writeRegisterSheet(remitoSheet, lines, viewer, generatedAt);
}

export async function buildOrderExcelFile({
  items,
  viewer,
  generatedAt = new Date().toISOString(),
}: {
  items: OrderExcelRequestItem[];
  viewer: OrderExcelViewer;
  generatedAt?: string;
}) {
  const audience = resolveAudience(viewer);
  console.info("[pedido/excel] build:start", {
    audience,
    items: items.length,
    authenticated: viewer.authenticated,
    canSeePrices: viewer.canSeePrices,
  });
  traceExcel("build:start", {
    audience,
    items: items.length,
    authenticated: viewer.authenticated,
    canSeePrices: viewer.canSeePrices,
  });
  const lines = await resolveRequestedLines(items, viewer);
  console.info("[pedido/excel] build:resolved-lines", {
    lines: lines.length,
    skus: lines.map((line) => line.sku).slice(0, 10),
  });
  traceExcel("build:resolved-lines", {
    lines: lines.length,
    skus: lines.map((line) => line.sku).slice(0, 10),
  });
  const template = await getActiveOrderExcelTemplate(audience);
  console.info("[pedido/excel] build:template", template
    ? {
        id: template.id,
        fileName: template.file_name,
        bucket: template.storage_bucket,
        path: template.storage_path,
      }
    : null);
  traceExcel(
    "build:template",
    template
      ? {
          id: template.id,
          fileName: template.file_name,
          bucket: template.storage_bucket,
          path: template.storage_path,
        }
      : {},
  );

  if (template) {
    console.info("[pedido/excel] build:download-template:start");
    traceExcel("build:download-template:start");
    const templateFile = await downloadOrderExcelTemplate(template);
    if (templateFile?.buffer) {
      console.info("[pedido/excel] build:download-template:ok", {
        fileName: templateFile.fileName,
        mimeType: templateFile.mimeType,
        size: templateFile.buffer.length,
      });
      traceExcel("build:download-template:ok", {
        fileName: templateFile.fileName,
        mimeType: templateFile.mimeType,
        size: templateFile.buffer.length,
      });
      const workbook = new ExcelJS.Workbook();
      console.info("[pedido/excel] build:workbook-load:start");
      traceExcel("build:workbook-load:start");
      await workbook.xlsx.load(toExcelJsBuffer(templateFile.buffer));
      setWorkbookRecalculation(workbook);
      console.info("[pedido/excel] build:workbook-load:done");
      traceExcel("build:workbook-load:done");
      console.info("[pedido/excel] build:populate:start", { templateId: template.id });
      traceExcel("build:populate:start", { templateId: template.id });
      populateWorkbook(workbook, lines, viewer, generatedAt);
      console.info("[pedido/excel] build:populate:done");
      traceExcel("build:populate:done");
      console.info("[pedido/excel] build:write-buffer:start");
      traceExcel("build:write-buffer:start");
      const buffer = await packageRemitoWorkbook(Buffer.from(await workbook.xlsx.writeBuffer()));
      console.info("[pedido/excel] build:write-buffer:done", { size: buffer.length });
      traceExcel("build:write-buffer:done", { size: buffer.length });
      return {
        buffer,
        fileName: getRemitoFileName(generatedAt),
        contentType: REMITO_CONTENT_TYPE,
        audience,
        usedTemplate: true,
        lines,
      };
    }
  }

  console.info("[pedido/excel] build:fallback:start");
  traceExcel("build:fallback:start");
  const workbook = buildFallbackWorkbook(lines, viewer, generatedAt);
  const buffer = await packageRemitoWorkbook(Buffer.from(await workbook.xlsx.writeBuffer()));
  console.info("[pedido/excel] build:fallback:done", { size: buffer.length });
  traceExcel("build:fallback:done", { size: buffer.length });

  return {
    buffer,
    fileName: getRemitoFileName(generatedAt),
    contentType: REMITO_CONTENT_TYPE,
    audience,
    usedTemplate: false,
    lines,
  };
}
