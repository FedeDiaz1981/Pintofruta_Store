import { createHash, randomBytes } from "node:crypto";
import ExcelJS from "exceljs";
import * as XLSX from "xlsx";
import JSZip from "jszip";
import { normalizeText } from "@/lib/catalog";
import { normalizeWorkbookFonts } from "@/lib/excel-workbook-compat";
import { getProductFieldErrors } from "@/lib/product-validation";

export const PRICE_LIST_HEADERS = ["ID", "Nombre", "Marca", "Precio publico", "Precio logueado"] as const;
export const MAX_PRICE_LIST_ROWS = 10000;
export const MAX_PRICE_LIST_BYTES = 10 * 1024 * 1024;

export type PriceListProduct = {
  id: number;
  name: string;
  brand: string;
  public_price: number;
  member_price: number;
  validationErrors?: string[];
  brandNeedsSync?: boolean;
};

export type PriceListRow = {
  rowNumber: number;
  id: number | null;
  name: string;
  brand: string;
  publicPrice: number;
  memberPrice: number;
  errors?: string[];
  rawValues?: { id: string; publicPrice: string; memberPrice: string };
};

export type ImportDecision = { rowNumber: number; productId: number | "new" };
export type ImportCandidate = PriceListProduct & { score: number };
export type PriceListPreviewRow = PriceListRow & {
  action: "create" | "update" | "unchanged" | "resolve" | "error";
  productId?: number;
  current?: PriceListProduct;
  candidates: ImportCandidate[];
  errors: string[];
};

export type ExcelImportPlan = {
  fileName: string;
  sheetName: string;
  createdProducts: number;
  updatedProducts: number;
  unchangedProducts: number;
  unresolvedRows: number;
  skippedProducts: number;
  errors: string[];
  rows: PriceListPreviewRow[];
  revision: string;
};

export class PriceListError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
    this.name = "PriceListError";
  }
}

function text(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function key(value: string) {
  return normalizeText(value).replace(/[^a-z0-9]+/g, " ").trim();
}

function price(value: unknown, field: "publicPrice" | "memberPrice") {
  const label = field === "publicPrice" ? "Precio publico" : "Precio logueado";
  if (value == null || text(value) === "") throw new Error(`${label}: falta completar el precio.`);
  let numeric = value;
  if (typeof value === "string") {
    let raw = value.trim().replace(/ARS|\$|\s/gi, "");
    if (!/^[\d.,]+$/.test(raw)) throw new Error(`${label}: el precio no es valido.`);
    if (raw.includes(",")) {
      if (!/^\d+(?:\.\d{3})*(?:,\d{1,2})?$/.test(raw)) throw new Error(`${label}: el precio no es valido.`);
      raw = raw.replace(/\./g, "").replace(",", ".");
    } else if (/^\d{1,3}(?:\.\d{3})+$/.test(raw)) {
      raw = raw.replace(/\./g, "");
    } else if (!/^\d+(?:\.\d{1,2})?$/.test(raw)) throw new Error(`${label}: el precio no es valido.`);
    numeric = Number(raw);
  }
  const errors = getProductFieldErrors({ [field]: numeric }, [field]);
  if (errors[field]) throw new Error(`${label}: ${errors[field]}`);
  return Number(numeric);
}

export function parsePriceList(buffer: Buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer", sheetRows: MAX_PRICE_LIST_ROWS + 2 });
  const sheetName = workbook.SheetNames.includes("Lista de precios") ? "Lista de precios" : workbook.SheetNames[0];
  const sheet = sheetName ? workbook.Sheets[sheetName] : undefined;
  if (!sheet || !sheet["!ref"]) throw new PriceListError("El Excel no contiene una lista de precios.");
  const range = XLSX.utils.decode_range(sheet["!fullref"] ?? sheet["!ref"]);
  if (range.e.r > MAX_PRICE_LIST_ROWS) throw new PriceListError(`La lista admite hasta ${MAX_PRICE_LIST_ROWS} filas.`);
  const headerValues = Array.from({ length: range.e.c + 1 }, (_, column) => key(text(sheet[XLSX.utils.encode_cell({ r: 0, c: column })]?.v)));
  const columns = PRICE_LIST_HEADERS.map((label) => {
    const normalized = key(label);
    if (headerValues.filter((value) => value === normalized).length !== 1) {
      throw new PriceListError(`La primera fila debe contener una sola columna "${label}". Descarga la lista actualizada.`);
    }
    return headerValues.indexOf(normalized);
  });
  const rows: PriceListRow[] = [];
  const errors: string[] = [];
  for (let r = 1; r <= range.e.r; r += 1) {
    const cells = columns.map((c) => sheet[XLSX.utils.encode_cell({ r, c })]);
    if (cells.every((cell) => !cell || (!cell.f && cell.t !== "e" && text(cell.v) === ""))) continue;
    const rowNumber = r + 1;
    const rowErrors: string[] = [];
    if (cells.some((cell) => cell?.f || cell?.t === "e")) rowErrors.push("No se admiten formulas ni celdas con errores.");
    const rawId = cells[0]?.v;
    let id = rawId == null || text(rawId) === "" ? null : Number(rawId);
    if (id !== null && (!Number.isInteger(id) || id <= 0 || id > 2147483647 || !/^\d+$/.test(text(rawId)))) {
      rowErrors.push("El ID debe ser un entero positivo o estar vacio para un producto nuevo.");
      id = null;
    }
    const name = text(cells[1]?.v);
    const brand = text(cells[2]?.v);
    rowErrors.push(...Object.values(getProductFieldErrors({ name, brand }, ["name", "brand"])));
    if (name.length > 1000) rowErrors.push("El nombre supera los 1000 caracteres permitidos.");
    if (brand.length > 200) rowErrors.push("La marca supera los 200 caracteres permitidos.");
    const prices = { publicPrice: 0, memberPrice: 0 };
    for (const [field, column] of [["publicPrice", 3], ["memberPrice", 4]] as const) {
      try { prices[field] = price(cells[column]?.v, field); }
      catch (error) { rowErrors.push(error instanceof Error ? error.message : "Precio invalido."); }
    }
    rows.push({ rowNumber, id, name, brand, ...prices, errors: rowErrors,
      ...(rowErrors.length ? { rawValues: { id: text(rawId), publicPrice: text(cells[3]?.v), memberPrice: text(cells[4]?.v) } } : {}),
    });
    errors.push(...rowErrors.map((message) => `Fila ${rowNumber}: ${message}`));
  }
  if (!rows.length && !errors.length) errors.push("La lista no contiene productos.");
  return { sheetName, rows, errors };
}

export function parseImportDecisions(value: unknown): ImportDecision[] {
  if (value === null || value === "" || value === undefined) return [];
  let parsed: unknown;
  try { parsed = typeof value === "string" ? JSON.parse(value) : value; }
  catch { throw new PriceListError("Las decisiones de coincidencias no son validas."); }
  if (!Array.isArray(parsed) || parsed.length > MAX_PRICE_LIST_ROWS) throw new PriceListError("Las decisiones no son validas.");
  const seen = new Set<number>();
  return parsed.map((item) => {
    if (!item || typeof item !== "object") throw new PriceListError("Decision invalida.");
    const { rowNumber, productId } = item;
    if (!Number.isInteger(rowNumber) || rowNumber < 2 || rowNumber > MAX_PRICE_LIST_ROWS + 1 || seen.has(rowNumber)
      || (productId !== "new" && (!Number.isInteger(productId) || productId <= 0 || productId > 2147483647))) {
      throw new PriceListError("Decision invalida o repetida.");
    }
    seen.add(rowNumber);
    return { rowNumber, productId };
  });
}

function candidateScore(row: PriceListRow, product: PriceListProduct) {
  const name = key(row.name);
  const other = key(product.name);
  const sameBrand = key(row.brand) === key(product.brand);
  if (name === other) return sameBrand ? 1 : 0.92;
  const left = new Set(name.split(" ").filter(Boolean));
  const right = new Set(other.split(" ").filter(Boolean));
  const overlap = [...left].filter((token) => right.has(token)).length;
  const similarity = overlap / (left.size + right.size - overlap || 1);
  if (similarity >= 0.8) return similarity;
  if (sameBrand && similarity >= 0.4) return Math.min(0.99, similarity + 0.15);
  return 0;
}

export function planPriceListImport(
  parsed: ReturnType<typeof parsePriceList>,
  products: PriceListProduct[],
  decisions: ImportDecision[],
  fileName: string,
): ExcelImportPlan {
  const byId = new Map(products.map((product) => [product.id, product]));
  const byRow = new Map(decisions.map((decision) => [decision.rowNumber, decision.productId]));
  const errors = parsed.rows.length ? [] : [...parsed.errors];
  const rows: PriceListPreviewRow[] = parsed.rows.map((row) => {
    const decision = byRow.get(row.rowNumber);
    const candidates = row.id === null && !row.errors?.length
      ? products.map((product) => ({ ...product, score: candidateScore(row, product) }))
        .filter((product) => product.score > 0).sort((a, b) => b.score - a.score || a.id - b.id).slice(0, 6)
      : [];
    const result: PriceListPreviewRow = { ...row, action: "create", candidates, errors: [...(row.errors ?? [])] };
    if (!result.errors.length) result.errors.push(...Object.values(getProductFieldErrors(row, ["name", "brand", "publicPrice", "memberPrice"])));
    if (row.id !== null && decision !== undefined) result.errors.push("Una fila con ID no admite elegir otro producto.");
    const targetId = row.id ?? (typeof decision === "number" ? decision : null);
    if (row.id === null && typeof decision === "number" && !candidates.some((item) => item.id === decision)) {
      result.errors.push("La coincidencia elegida ya no esta disponible. Revisa las opciones.");
    }
    if (targetId !== null) {
      const current = byId.get(targetId);
      if (!current) result.errors.push(`El ID ${targetId} no existe o fue eliminado.`);
      else {
        result.productId = targetId;
        result.current = current;
        result.errors.push(...(current.validationErrors ?? []).map((error) => `Producto #${targetId}: ${error} Corregilo en administracion antes de importar.`));
        result.action = row.name === current.name && row.brand === current.brand
          && row.publicPrice === current.public_price && row.memberPrice === current.member_price && !current.brandNeedsSync ? "unchanged" : "update";
      }
    } else if (candidates.length && decision !== "new") result.action = "resolve";
    return result;
  });
  for (const decision of decisions) {
    if (!parsed.rows.some((row) => row.rowNumber === decision.rowNumber)) throw new PriceListError(`La decision para la fila ${decision.rowNumber} no corresponde al archivo. Vuelve a previsualizar.`);
  }
  const targets = new Map<number, PriceListPreviewRow>();
  const newNames = new Map<string, PriceListPreviewRow>();
  for (const row of rows) {
    const previous = row.productId ? targets.get(row.productId) : row.action === "create" && !row.errors.length ? newNames.get(`${key(row.brand)}|${key(row.name)}`) : undefined;
    if (previous) {
      const message = row.productId ? `El ID ${row.productId} esta repetido en las filas ${previous.rowNumber} y ${row.rowNumber}.`
        : `Producto nuevo repetido en las filas ${previous.rowNumber} y ${row.rowNumber}.`;
      previous.errors.push(message);
      row.errors.push(message);
    }
    if (row.productId) targets.set(row.productId, row);
    else if (row.action === "create" && !row.errors.length) newNames.set(`${key(row.brand)}|${key(row.name)}`, row);
  }
  for (const row of rows) {
    if (row.errors.length) row.action = "error";
    errors.push(...row.errors.map((message) => `Fila ${row.rowNumber}: ${message}`));
  }
  const revision = createHash("sha256").update(JSON.stringify({ parsed, decisions, products: [...products].sort((a, b) => a.id - b.id) })).digest("hex");
  return {
    fileName, sheetName: parsed.sheetName, rows, errors, revision,
    createdProducts: rows.filter((row) => row.action === "create").length,
    updatedProducts: rows.filter((row) => row.action === "update").length,
    unchangedProducts: rows.filter((row) => row.action === "unchanged").length,
    unresolvedRows: rows.filter((row) => row.action === "resolve").length,
    skippedProducts: rows.filter((row) => row.action !== "create" && row.action !== "update").length,
  };
}

export async function createPriceListWorkbook(products: PriceListProduct[]) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Pintofruta";
  const sheet = workbook.addWorksheet("Lista de precios", { views: [{ state: "frozen", xSplit: 1, ySplit: 1, activeCell: "B2" }] });
  sheet.columns = [{ width: 12 }, { width: 80 }, { width: 25 }, { width: 22 }, { width: 22 }];
  for (let column = 2; column <= 5; column += 1) sheet.getColumn(column).protection = { locked: false };
  sheet.addRow([...PRICE_LIST_HEADERS]);
  const header = sheet.getRow(1);
  header.height = 30;
  header.eachCell((cell) => {
    cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF426458" } };
    cell.alignment = { vertical: "middle" };
    cell.protection = { locked: true };
  });
  for (const product of products) {
    const row = sheet.addRow([product.id, product.name, product.brand, product.public_price, product.member_price]);
    row.height = Math.max(26, Math.ceil(product.name.length / 72) * 16 + 8, Math.ceil(product.brand.length / 22) * 16 + 8);
    row.eachCell((cell, column) => {
      cell.font = { name: "Calibri", size: 11, color: { argb: column === 1 ? "FF68746F" : "FF24302B" } };
      cell.alignment = { vertical: "middle", wrapText: column === 2 || column === 3 };
      cell.protection = { locked: column === 1 };
      if (column >= 4) cell.numFmt = '#,##0';
      if (row.number % 2 === 0) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F6F3" } };
    });
  }
  const validations = (sheet as ExcelJS.Worksheet & {
    dataValidations: { add(range: string, rule: ExcelJS.DataValidation): void };
  }).dataValidations;
  for (let column = 4; column <= 5; column += 1) {
    sheet.getColumn(column).numFmt = '#,##0';
    validations.add(`${XLSX.utils.encode_col(column - 1)}2:${XLSX.utils.encode_col(column - 1)}1048576`, {
      type: "whole", operator: "between", formulae: [1, 2147483647], allowBlank: true,
      showErrorMessage: true, errorTitle: "Precio invalido", error: "Ingresa un precio entero mayor que cero.", errorStyle: "stop",
    });
  }
  sheet.autoFilter = `A1:E${Math.max(1, products.length + 1)}`;
  await sheet.protect(randomBytes(24).toString("hex"), {
    selectLockedCells: false, selectUnlockedCells: true, autoFilter: true,
    insertRows: false, deleteRows: false, insertColumns: false, deleteColumns: false,
    formatCells: false, formatColumns: true, formatRows: true, sort: false, spinCount: 10000,
  });
  const zip = await JSZip.loadAsync(Buffer.from(await workbook.xlsx.writeBuffer()));
  await normalizeWorkbookFonts(zip);
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}
