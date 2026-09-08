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

function formatCurrencyValue(value: number) {
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(value));
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

  const palette = {
    dark: "4D2E1A",
    primary: "A86D45",
    primarySoft: "D9B68D",
    cream: "FBF6EE",
    sand: "F5E9D8",
    border: "E4D2BA",
    muted: "7A6652",
  };

  const baseColumns = [
    { header: "Detalle", key: "detail", width: 56 },
    { header: "Cant", key: "quantity", width: 12 },
    { header: "Precio", key: "unitPrice", width: 18 },
    { header: "Total", key: "total", width: 18 },
  ] as const;

  const summary = [
    ["Pedido exportado", "PintoFruta"],
    ["Tipo de precio", viewer.authenticated && viewer.canSeePrices ? "Logueado / miembro" : "Público / invitado"],
    ["Fecha", new Date(generatedAt).toLocaleString("es-AR")],
    ["Cantidad de líneas", String(lines.length)],
    ["Total", formatCurrencyValue(lines.reduce((sum, line) => sum + line.subtotal, 0))],
  ];

  for (const [sheetName, subtitle] of [["REMITO", "Registro del pedido"]] as const) {
    const sheet = workbook.addWorksheet(sheetName, {
      views: [{ state: "frozen", ySplit: 6 }],
      pageSetup: { orientation: "landscape", paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    });

    sheet.columns = baseColumns as unknown as ExcelJS.Column[];
    sheet.properties.defaultRowHeight = 22;
    sheet.getRow(1).height = 28;

    sheet.mergeCells("A1:D1");
    sheet.getCell("A1").value = `PintoFruta - ${sheetName}`;
    sheet.getCell("A1").font = { bold: true, size: 18, color: { argb: "FFFFFFFF" } };
    sheet.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: palette.dark } };
    sheet.getCell("A1").alignment = { vertical: "middle", horizontal: "center" };
    sheet.getCell("A1").border = {
      top: { style: "thin", color: { argb: palette.dark } },
      left: { style: "thin", color: { argb: palette.dark } },
      bottom: { style: "thin", color: { argb: palette.dark } },
      right: { style: "thin", color: { argb: palette.dark } },
    };

    sheet.mergeCells("A2:D2");
    sheet.getCell("A2").value = subtitle;
    sheet.getCell("A2").font = { italic: true, size: 11, color: { argb: palette.muted } };
    sheet.getCell("A2").alignment = { vertical: "middle", horizontal: "left" };

    for (let rowIndex = 0; rowIndex < summary.length; rowIndex += 1) {
      const [label, value] = summary[rowIndex];
      const row = sheet.getRow(3 + rowIndex);
      row.getCell(1).value = label;
      row.getCell(2).value = value;
      row.getCell(1).font = { bold: true, color: { argb: palette.dark } };
      row.getCell(2).font = { color: { argb: palette.dark } };
      row.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: palette.cream } };
      row.getCell(2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: palette.cream } };
    }

    const headerRow = sheet.getRow(8);
    baseColumns.forEach((column, index) => {
      const cell = headerRow.getCell(index + 1);
      cell.value = column.header;
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: palette.primary } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = {
        top: { style: "thin", color: { argb: palette.border } },
        left: { style: "thin", color: { argb: palette.border } },
        bottom: { style: "thin", color: { argb: palette.border } },
        right: { style: "thin", color: { argb: palette.border } },
      };
    });

    lines.forEach((line, index) => {
      const row = sheet.getRow(9 + index);
      row.values = [line.name, line.quantity, line.unitPrice, line.subtotal];
      row.eachCell((cell, columnNumber) => {
        cell.border = {
          top: { style: "thin", color: { argb: palette.border } },
          left: { style: "thin", color: { argb: palette.border } },
          bottom: { style: "thin", color: { argb: palette.border } },
          right: { style: "thin", color: { argb: palette.border } },
        };
        cell.alignment = { vertical: "middle", horizontal: columnNumber > 1 ? "right" : "left" };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: index % 2 === 0 ? "FFFCF8F2" : "FFF8F1E7" } };
      });
      row.getCell(2).numFmt = '#,##0';
      row.getCell(3).numFmt = '#,##0';
      row.getCell(4).numFmt = '#,##0';
          });

    const totalRow = sheet.getRow(9 + lines.length + 1);
    totalRow.getCell(1).value = "TOTAL";
    totalRow.getCell(1).font = { bold: true, color: { argb: palette.dark } };
    totalRow.getCell(4).value = lines.reduce((sum, line) => sum + line.subtotal, 0);
    totalRow.getCell(4).font = { bold: true, color: { argb: palette.dark } };
    totalRow.getCell(4).numFmt = '#,##0';
  }

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

function writeRegisterSheet(sheet: ExcelJS.Worksheet, lines: ResolvedOrderLine[], viewer: OrderExcelViewer, generatedAt: string) {
  const palette = {
    dark: "4D2E1A",
    primary: "A86D45",
    cream: "FBF6EE",
    border: "E4D2BA",
    muted: "7A6652",
  };

  const table = findRemitoTable(sheet);
  if (table) {
    const { headerRow, totalRow, detailColumn, quantityColumn, priceColumn, totalColumn } = table;
    const firstDataRow = headerRow + 1;
    const currentLastDataRow = totalRow ? totalRow - 1 : Math.max(sheet.rowCount, firstDataRow);
    const currentCapacity = Math.max(0, currentLastDataRow - firstDataRow + 1);

    if (totalRow && lines.length > currentCapacity) {
      const extraRows = lines.length - currentCapacity;
      sheet.insertRows(totalRow, Array.from({ length: extraRows }, () => []), "i");
    }

    const detailTemplateRow = sheet.getRow(firstDataRow);
    const lastLineRow = firstDataRow + lines.length - 1;

    lines.forEach((line, index) => {
      const rowNumber = firstDataRow + index;
      const row = sheet.getRow(rowNumber);

      if (rowNumber !== firstDataRow) {
        copyRowTemplate(detailTemplateRow, row);
      }

      const quantity = Math.max(1, Number(line.quantity) || 1);
      const unitPrice = viewer.authenticated && viewer.canSeePrices ? line.memberPrice || line.unitPrice : line.publicPrice || line.unitPrice;
      const total = quantity * unitPrice;

      row.getCell(detailColumn).value = line.name;
      row.getCell(quantityColumn).value = quantity;
      row.getCell(priceColumn).value = unitPrice;
      row.getCell(totalColumn).value = total;

      row.getCell(quantityColumn).numFmt = "#,##0";
      row.getCell(priceColumn).numFmt = "#,##0";
      row.getCell(totalColumn).numFmt = "#,##0";

      row.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
        cell.border = {
          top: { style: "thin", color: { argb: palette.border } },
          left: { style: "thin", color: { argb: palette.border } },
          bottom: { style: "thin", color: { argb: palette.border } },
          right: { style: "thin", color: { argb: palette.border } },
        };
        cell.alignment = {
          vertical: "middle",
          horizontal: columnNumber === detailColumn ? "left" : "right",
        };
      });
    });

    if (totalRow) {
      const summaryRow = sheet.getRow(totalRow + Math.max(0, lines.length - currentCapacity));
      summaryRow.getCell(detailColumn).value = "TOTAL";
      summaryRow.getCell(totalColumn).value = lines.reduce((sum, line) => {
        const quantity = Math.max(1, Number(line.quantity) || 1);
        const unitPrice = viewer.authenticated && viewer.canSeePrices ? line.memberPrice || line.unitPrice : line.publicPrice || line.unitPrice;
        return sum + quantity * unitPrice;
      }, 0);
      summaryRow.getCell(totalColumn).numFmt = "#,##0";
      summaryRow.getCell(detailColumn).font = { bold: true, color: { argb: palette.dark } };
      summaryRow.getCell(totalColumn).font = { bold: true, color: { argb: palette.dark } };
    }

    return;
  }

  const startRow = Math.max(1, sheet.actualRowCount + 1);
  if (startRow === 1) {
    sheet.columns = [
      { header: "Detalle", key: "detail", width: 34 },
      { header: "Cantidad", key: "quantity", width: 12 },
      { header: "Precio", key: "price", width: 18 },
      { header: "Total", key: "total", width: 18 },
    ];
  }

  sheet.mergeCells(startRow, 1, startRow, 4);
  sheet.getCell(startRow, 1).value = "Remito";
  sheet.getCell(startRow, 1).font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } };
  sheet.getCell(startRow, 1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: palette.dark } };
  sheet.getCell(startRow, 1).alignment = { horizontal: "center", vertical: "middle" };

  sheet.mergeCells(startRow + 1, 1, startRow + 1, 4);
  sheet.getCell(startRow + 1, 1).value = `Generado el ${new Date(generatedAt).toLocaleString("es-AR")} - ${
    viewer.authenticated && viewer.canSeePrices ? "Precios de miembro" : "Precios públicos"
  }`;
  sheet.getCell(startRow + 1, 1).font = { italic: true, color: { argb: palette.muted } };

  const tableHeaderRow = sheet.getRow(startRow + 3);
  const headers = ["Detalle", "Cant", "Precio", "Total"];
  headers.forEach((header, index) => {
    const cell = tableHeaderRow.getCell(index + 1);
    cell.value = header;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: palette.primary } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      top: { style: "thin", color: { argb: palette.border } },
      left: { style: "thin", color: { argb: palette.border } },
      bottom: { style: "thin", color: { argb: palette.border } },
      right: { style: "thin", color: { argb: palette.border } },
    };
  });

  lines.forEach((line, index) => {
    const row = sheet.getRow(startRow + 4 + index);
    const unitPrice = viewer.authenticated && viewer.canSeePrices ? line.memberPrice || line.unitPrice : line.publicPrice || line.unitPrice;
    const total = unitPrice * Math.max(1, Number(line.quantity) || 1);

    row.values = [
      undefined,
      line.name,
      line.quantity,
      unitPrice,
      total,
    ];
    row.eachCell((cell, columnNumber) => {
      cell.border = {
        top: { style: "thin", color: { argb: palette.border } },
        left: { style: "thin", color: { argb: palette.border } },
        bottom: { style: "thin", color: { argb: palette.border } },
        right: { style: "thin", color: { argb: palette.border } },
      };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: index % 2 === 0 ? "FFFCF8F2" : "FFF8F1E7" } };
      cell.alignment = { vertical: "middle", horizontal: columnNumber === 2 ? "left" : "right" };
    });
    row.getCell(2).numFmt = "#,##0";
    row.getCell(3).numFmt = "#,##0";
    row.getCell(4).numFmt = "#,##0";
  });

  const totalRow = sheet.getRow(startRow + 5 + lines.length);
  totalRow.getCell(3).value = "Total";
  totalRow.getCell(3).font = { bold: true, color: { argb: palette.dark } };
  totalRow.getCell(4).value = lines.reduce((sum, line) => {
    const quantity = Math.max(1, Number(line.quantity) || 1);
    const unitPrice = viewer.authenticated && viewer.canSeePrices ? line.memberPrice || line.unitPrice : line.publicPrice || line.unitPrice;
    return sum + quantity * unitPrice;
  }, 0);
  totalRow.getCell(4).font = { bold: true, color: { argb: palette.dark } };
  totalRow.getCell(4).numFmt = "#,##0";
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
      console.info("[pedido/excel] build:workbook-load:done");
      traceExcel("build:workbook-load:done");
      console.info("[pedido/excel] build:populate:start", { templateId: template.id });
      traceExcel("build:populate:start", { templateId: template.id });
      populateWorkbook(workbook, lines, viewer, generatedAt);
      console.info("[pedido/excel] build:populate:done");
      traceExcel("build:populate:done");
      console.info("[pedido/excel] build:write-buffer:start");
      traceExcel("build:write-buffer:start");
      const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
      console.info("[pedido/excel] build:write-buffer:done", { size: buffer.length });
      traceExcel("build:write-buffer:done", { size: buffer.length });
      return {
        buffer,
        fileName: templateFile.fileName || `pedido-pintofruta-${audience}.xlsx`,
        audience,
        usedTemplate: true,
        lines,
      };
    }
  }

  console.info("[pedido/excel] build:fallback:start");
  traceExcel("build:fallback:start");
  const workbook = buildFallbackWorkbook(lines, viewer, generatedAt);
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  console.info("[pedido/excel] build:fallback:done", { size: buffer.length });
  traceExcel("build:fallback:done", { size: buffer.length });

  return {
    buffer,
    fileName: `pedido-pintofruta-${audience}.xlsx`,
    audience,
    usedTemplate: false,
    lines,
  };
}
