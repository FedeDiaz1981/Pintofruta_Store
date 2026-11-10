import { randomBytes } from "node:crypto";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import template from "@/lib/customer-order-template.json";
import { normalizeText } from "@/lib/catalog";
import { resolveProductUnitPrice } from "@/lib/pricing";
import { normalizeWorkbookFonts } from "@/lib/excel-workbook-compat";
import { addCustomerOrderRemito } from "@/lib/customer-order-remito";
import { attachCustomerOrderMacros } from "@/lib/customer-order-package";
export { CUSTOMER_ORDER_CONTENT_TYPE } from "@/lib/customer-order-package";

export type CustomerOrderAudience = "public" | "member";
export type CustomerOrderProduct = {
  id: number;
  name: string;
  brand: string;
  presentation: string;
  public_price: number;
  member_price: number;
  status: string;
  sold_out: boolean;
  deleted_at?: Date | string | null;
};

export const CUSTOMER_ORDER_PRODUCTS_SQL = `select id, name, brand, presentation, public_price, member_price, status, sold_out, deleted_at
  from products where deleted_at is null and status = 'published' and coalesce(sold_out, false) = false
  order by brand, name, id`;

function textHeight(text: string, width: number, fontSize: number) {
  const charactersPerLine = Math.max(1, Math.floor(width * (11 / fontSize) * 0.8));
  const lines = text.split(/\r?\n/).reduce((total, line) => total + Math.max(1, Math.ceil(line.length / charactersPerLine)), 0);
  return Math.min(409, Math.ceil(lines * fontSize * 1.35 + 7));
}

export async function buildCustomerOrderFile(products: CustomerOrderProduct[], audience: CustomerOrderAudience, generatedAt = new Date()) {
  if (audience !== "public" && audience !== "member") throw new Error("Elegí una lista pública o con descuento.");
  const available = products.filter(product =>
    product.status === "published" &&
    !product.sold_out &&
    !product.deleted_at &&
    (audience === "member" ? Number(product.member_price) > 0 || Number(product.public_price) > 0 : Number(product.public_price) > 0),
  );
  const groups = new Map<string, { name: string; products: CustomerOrderProduct[] }>();
  for (const product of [...available].sort((a, b) => a.brand.localeCompare(b.brand, "es", { sensitivity: "base" }) || a.name.localeCompare(b.name, "es", { sensitivity: "base", numeric: true }) || a.id - b.id)) {
    const name = product.brand.trim() || "Sin marca";
    const key = normalizeText(name);
    const group = groups.get(key) ?? { name, products: [] };
    group.products.push(product);
    groups.set(key, group);
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Pintofruta";
  workbook.created = generatedAt;
  workbook.modified = generatedAt;
  workbook.calcProperties.fullCalcOnLoad = true;
  const sheet = workbook.addWorksheet(template.sheetName, {
    pageSetup: { ...template.pageSetup, printTitlesRow: "14:14" } as Partial<ExcelJS.PageSetup>,
    views: [{ state: "normal", activeCell: "C4", zoomScale: 90, showGridLines: true }],
  });
  sheet.columns = template.columns;
  for (const header of template.headerRows) {
    const row = sheet.addRow(header.cells.map(cell => structuredClone(cell.value) as ExcelJS.CellValue));
    row.height = header.height;
    header.cells.forEach((cell, index) => {
      row.getCell(index + 1).style = structuredClone(cell.style) as Partial<ExcelJS.Style>;
      row.getCell(index + 1).protection = { locked: true };
    });
  }
  for (const merge of template.merges) sheet.mergeCellsWithoutStyle(merge);
  for (let number = 4; number <= 8; number++) {
    const cell = sheet.getCell(`C${number}`);
    cell.value = null;
    for (const column of [3, 4]) {
      const input = sheet.getRow(number).getCell(column);
      input.protection = { locked: false };
      input.alignment = { ...input.alignment, wrapText: true, vertical: "middle" };
    }
  }
  const logoId = workbook.addImage({ base64: template.logo.data, extension: "png" });
  const logoWidth = 220;
  sheet.addImage(logoId, { tl: { col: 1.02, row: 0.9 }, ext: { width: logoWidth, height: logoWidth * template.logo.height / template.logo.width } });

  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(generatedAt).map(part => [part.type, part.value]));
  sheet.getCell("A9").value = `LISTA ${audience === "public" ? "PÚBLICA" : "CON DESCUENTO"}    ${parts.day}-${parts.month}-${parts.year.slice(-2)}`;
  for (const group of groups.values()) {
    const heading = sheet.addRow([null, null, group.name]);
    heading.height = Math.max(template.groupRow.height, textHeight(group.name, template.columns[2].width, 16));
    template.groupRow.styles.forEach((style, index) => {
      heading.getCell(index + 1).style = structuredClone(style) as Partial<ExcelJS.Style>;
      heading.getCell(index + 1).protection = { locked: true };
    });
    heading.getCell(3).alignment = { vertical: "middle", wrapText: true };
    group.products.forEach((product, index) => {
      const price = resolveProductUnitPrice({ publicPrice: product.public_price, memberPrice: product.member_price }, { authenticated: audience === "member", canSeePrices: true });
      if (!Number.isFinite(price) || price < 0) throw new Error(`El producto #${product.id} no tiene un precio válido.`);
      const row = sheet.addRow([null, product.brand, product.name, product.presentation, price]);
      const model = index === 0 ? template.firstProductRow : template.productRow;
      model.styles.forEach((style, column) => {
        const cell = row.getCell(column + 1);
        cell.style = structuredClone(style) as Partial<ExcelJS.Style>;
        cell.protection = { locked: column !== 0 };
        cell.alignment = { ...cell.alignment, vertical: "middle", wrapText: column >= 1 && column <= 3 };
      });
      const detail = row.getCell(3);
      const prefixLength = product.name.toLocaleLowerCase("es").startsWith(product.brand.toLocaleLowerCase("es")) ? product.brand.length : 0;
      detail.value = { richText: [
        ...(prefixLength ? [{ text: product.name.slice(0, prefixLength) }] : []),
        { text: product.name.slice(prefixLength), font: { ...detail.font, bold: true } },
      ] };
      const quantity = row.getCell(1);
      quantity.dataValidation = { type: "whole", operator: "between", formulae: [0, 2147483647], allowBlank: true,
        showErrorMessage: true, errorStyle: "stop", errorTitle: "Cantidad inválida", error: "Ingresá una cantidad entera mayor o igual a cero." };
      const validQuantity = `IFERROR(AND(ISNUMBER(A${row.number}),A${row.number}>0,MOD(A${row.number},1)=0),0)`;
      row.getCell(6).value = { formula: `IF(${validQuantity},A${row.number}*E${row.number},0)`, result: 0 };
      row.getCell(7).value = { formula: `IF(${validQuantity},COUNT($G$14:G${row.number - 1})+1,"")`, result: "" };
      row.height = Math.max(model.height, ...[2, 3, 4].map(column => textHeight(row.getCell(column).text, sheet.getColumn(column).width ?? 10, row.getCell(column).font.size ?? 9)));
    });
  }
  const lastRow = Math.max(15, sheet.rowCount);
  sheet.getColumn(7).hidden = true;
  sheet.getCell("F7").value = { formula: `SUM(F15:F${lastRow})`, result: 0 };
  sheet.autoFilter = `A14:F${Math.max(14, sheet.rowCount)}`;
  sheet.pageSetup.printArea = `A1:F${Math.max(14, sheet.rowCount)}`;
  for (let column = 1; column <= 6; column++) {
    sheet.getRow(14).getCell(column).alignment = { ...sheet.getRow(14).getCell(column).alignment, wrapText: true, vertical: "middle" };
  }
  await sheet.protect(randomBytes(24).toString("hex"), {
    selectLockedCells: true, selectUnlockedCells: true, autoFilter: true, formatColumns: true, formatRows: true,
    insertRows: false, deleteRows: false, insertColumns: false, deleteColumns: false, sort: false, spinCount: 10000,
  });
  const remito = addCustomerOrderRemito(workbook, lastRow, available.length, `${parts.day}-${parts.month}-${parts.year.slice(-2)}`);
  await remito.protect(randomBytes(24).toString("hex"), {
    selectLockedCells: true, selectUnlockedCells: true, autoFilter: true, formatColumns: true, formatRows: true,
    insertRows: false, deleteRows: false, insertColumns: false, deleteColumns: false, sort: false, spinCount: 10000,
  });
  const zip = await JSZip.loadAsync(Buffer.from(await workbook.xlsx.writeBuffer()));
  zip.file("xl/theme/theme1.xml", template.themeXml);
  const namespace = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
  const parser = new DOMParser();
  const serializer = new XMLSerializer();
  const drawing = parser.parseFromString(await zip.file("xl/drawings/drawing1.xml")!.async("string"), "application/xml");
  for (const anchor of Array.from(drawing.getElementsByTagNameNS("http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing", "oneCellAnchor"))) {
    // editAs belongs to twoCellAnchor; a one-cell image keeps its explicit pixel size.
    anchor.removeAttribute("editAs");
  }
  zip.file("xl/drawings/drawing1.xml", serializer.serializeToString(drawing));
  for (const entry of zip.file(/^xl\/worksheets\/sheet\d+\.xml$/)) {
    const sheetXml = parser.parseFromString(await entry.async("string"), "application/xml");
    const properties = sheetXml.getElementsByTagNameNS(namespace, "sheetPr")[0];
    const outline = properties?.getElementsByTagNameNS(namespace, "outlinePr")[0];
    const pageSetup = properties?.getElementsByTagNameNS(namespace, "pageSetUpPr")[0];
    if (outline && pageSetup) properties.insertBefore(outline, pageSetup);
    zip.file(entry.name, serializer.serializeToString(sheetXml));
  }
  const workbookXml = parser.parseFromString(await zip.file("xl/workbook.xml")!.async("string"), "application/xml");
  const calculation = workbookXml.getElementsByTagNameNS(namespace, "calcPr")[0];
  calculation.setAttribute("calcMode", "auto");
  calculation.setAttribute("forceFullCalc", "1");
  calculation.setAttribute("calcOnSave", "1");
  for (const name of Array.from(workbookXml.getElementsByTagNameNS(namespace, "definedName"))) {
    if (name.getAttribute("name") === "_xlnm.Print_Area" && name.getAttribute("localSheetId") === "1") {
      // Excel's dynamic print area ends at the moving TOTAL, rather than printing unused formula rows.
      name.textContent = `OFFSET('REMITO'!$A$1,0,0,COUNT('PEDIDO CLIENTE'!$G$15:$G$${lastRow})+6,4)`;
    }
  }
  zip.file("xl/workbook.xml", serializer.serializeToString(workbookXml));
  await attachCustomerOrderMacros(zip, remito.rowCount);
  await normalizeWorkbookFonts(zip);
  return {
    buffer: await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }),
    fileName: `Pedido_cliente_${audience === "public" ? "publica" : "con_descuento"}_${parts.year}-${parts.month}-${parts.day}_${parts.hour}${parts.minute}${parts.second}.xlsm`,
    productCount: available.length,
  };
}
