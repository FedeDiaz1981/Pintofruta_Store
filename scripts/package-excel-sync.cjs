const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const JSZip = require('jszip');
const { DOMParser, XMLSerializer } = require('@xmldom/xmldom');

const root = path.resolve(__dirname, '..');
const input = process.argv[2] || 'C:\\Users\\Usuario\\Desktop\\I 08-10-26.xlsx';
const output = process.argv[3] || path.join(root, 'artifacts', 'PintoFruta_Catalogo_Sincronizador.xlsm');
const vbaPath = path.join(root, 'artifacts', 'excel-sync-vba-project.bin');
const localEnv = fs.existsSync(path.join(root, '.env.local')) ? fs.readFileSync(path.join(root, '.env.local'), 'utf8') : '';
const fixedToken = process.env.EXCEL_SYNC_FIXED_TOKEN || localEnv.match(/^EXCEL_SYNC_FIXED_TOKEN=(.+)$/m)?.[1]?.trim() || 'REEMPLAZAR_TOKEN';

function styleHeader(row) {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3B6B5A' } };
  row.alignment = { vertical: 'middle' };
}

function cellText(value) {
  if (value && Array.isArray(value.richText)) return value.richText.map((part) => part.text || '').join('');
  if (value && typeof value === 'object' && 'text' in value) return String(value.text || '');
  return String(value ?? '');
}

function stripBrand(value, brand) {
  const text = cellText(value).trim();
  const prefix = cellText(brand).trim();
  if (!prefix) return text;
  if (text.toLowerCase().startsWith(prefix.toLowerCase())) return text.slice(prefix.length).trim();
  return text;
}

async function addSheets() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(input);
  const remito = workbook.getWorksheet('REMITO');
  if (remito) workbook.removeWorksheet(remito.id);
  const pedido = workbook.getWorksheet('PEDIDO CLIENTE');
  pedido.name = 'PRECIOS';
  pedido.spliceRows(1, 13);
  for (const merge of [...pedido.model.merges]) pedido.unMergeCells(merge);
  for (let rowNumber = 1; rowNumber <= pedido.rowCount; rowNumber += 1) {
    const row = pedido.getRow(rowNumber);
    const brand = cellText(row.getCell(2).value);
    const detail = cellText(row.getCell(3).value);
    const publicPrice = row.getCell(5).value;
    const separator = !brand && detail;
    row.getCell(1).value = rowNumber === 1 ? 'ACTIVO' : (brand ? 'SI' : '');
    const nextBrand = rowNumber < pedido.rowCount ? cellText(pedido.getRow(rowNumber + 1).getCell(2).value) : '';
    row.getCell(2).value = rowNumber === 1 ? 'ID' : '';
    row.getCell(3).value = separator ? String(nextBrand || '').trim() : stripBrand(detail, brand);
    row.getCell(4).value = publicPrice;
    row.getCell(5).value = rowNumber === 1 ? 'PRECIO CON DESCUENTO' : '';
    if (separator && rowNumber > 1) {
      for (const column of [3, 4, 5]) {
        row.getCell(column).alignment = { horizontal: 'centerContinuous', vertical: 'middle', wrapText: true };
        row.getCell(column).font = { bold: true, size: 16 };
      }
    }
  }
  pedido.getCell('A1').value = 'ACTIVO';
  pedido.getCell('B1').value = 'DETALLE / VARIEDAD';
  pedido.getCell('C1').value = 'PRESENTACIÓN';
  pedido.getCell('D1').value = 'PRECIO PÚBLICO';
  pedido.getCell('E1').value = 'PRECIO CON DESCUENTO';
  pedido.getCell('C1').value = 'PRECIO PÚBLICO';
  pedido.getCell('D1').value = 'PRECIO CON DESCUENTO';
  pedido.spliceColumns(5, 2);
  pedido.getCell('B1').value = 'ID';
  pedido.getCell('C1').value = 'DETALLE / VARIEDAD';
  pedido.getCell('D1').value = 'PUBLICO';
  pedido.getCell('E1').value = 'DESCUENTO';
  pedido.columns = [
    { width: 20 },
    { width: 20 },
    { width: 108 },
    { width: 18 },
    { width: 20 },
  ];
  pedido.autoFilter = `A1:E${Math.max(1, pedido.rowCount)}`;
  pedido.getRow(1).height = 28;
  pedido.getRow(1).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  for (let rowNumber = 2; rowNumber <= pedido.rowCount; rowNumber += 1) {
    const row = pedido.getRow(rowNumber);
    const isSeparator = !row.getCell(1).value && row.getCell(3).value;
    pedido.getCell(`A${rowNumber}`).dataValidation = { type: 'list', allowBlank: true, formulae: ['"SI,NO"'] };
    pedido.getCell(`A${rowNumber}`).alignment = { horizontal: 'center', vertical: 'middle' };
    pedido.getCell(`B${rowNumber}`).alignment = { horizontal: 'center', vertical: 'middle' };
    pedido.getCell(`C${rowNumber}`).alignment = { horizontal: isSeparator ? 'center' : 'left', vertical: 'middle', wrapText: true };
    pedido.getCell(`D${rowNumber}`).numFmt = '$ #,##0.00';
    pedido.getCell(`E${rowNumber}`).numFmt = '$ #,##0.00';
    pedido.getCell(`D${rowNumber}`).alignment = { horizontal: 'right', vertical: 'middle' };
    pedido.getCell(`E${rowNumber}`).alignment = { horizontal: 'right', vertical: 'middle' };
    row.height = isSeparator ? 30 : Math.min(60, Math.max(22, 18 * Math.ceil(String(row.getCell(3).value || '').length / 120)));
  }
  for (let rowNumber = 1; rowNumber <= pedido.rowCount; rowNumber += 1) {
    const publicCell = pedido.getCell(`D${rowNumber}`);
    const discountCell = pedido.getCell(`E${rowNumber}`);
    if (publicCell.font) discountCell.font = { name: publicCell.font.name, size: publicCell.font.size, bold: publicCell.font.bold, italic: publicCell.font.italic, color: publicCell.font.color };
    if (publicCell.fill) discountCell.fill = { type: publicCell.fill.type, pattern: publicCell.fill.pattern, fgColor: publicCell.fill.fgColor, bgColor: publicCell.fill.bgColor };
    if (publicCell.border) discountCell.border = { top: publicCell.border.top, left: publicCell.border.left, bottom: publicCell.border.bottom, right: publicCell.border.right, diagonal: publicCell.border.diagonal };
    if (publicCell.alignment) discountCell.alignment = { horizontal: publicCell.alignment.horizontal, vertical: publicCell.alignment.vertical, wrapText: publicCell.alignment.wrapText };
    discountCell.numFmt = publicCell.numFmt;
  }
  pedido.spliceRows(1, 0, [], []);
  pedido.getCell('A3').value = 'ACTIVO';
  pedido.getCell('B3').value = 'ID';
  pedido.getCell('C3').value = 'DETALLE / VARIEDAD';
  pedido.getCell('D3').value = 'PUBLICO';
  pedido.getCell('E3').value = 'DESCUENTO';
  for (const column of [1, 2, 3, 4, 5]) {
    const header = pedido.getCell(3, column);
    header.font = { name: 'Montserrat Medium', size: 11, bold: true, color: { argb: 'FF000000' } };
    header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E2F3' } };
    header.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  }
  pedido.getRow(3).height = 28;
  for (let rowNumber = 4; rowNumber <= pedido.rowCount; rowNumber += 1) {
    const publicCell = pedido.getCell(`D${rowNumber}`);
    const discountCell = pedido.getCell(`E${rowNumber}`);
    discountCell.font = { name: publicCell.font?.name || 'Montserrat Medium', size: publicCell.font?.size || 9, bold: publicCell.font?.bold === true, italic: publicCell.font?.italic === true, color: publicCell.font?.color || { argb: 'FF000000' } };
    discountCell.border = { top: publicCell.border?.top, left: publicCell.border?.left, bottom: publicCell.border?.bottom, right: publicCell.border?.right };
    discountCell.alignment = { horizontal: publicCell.alignment?.horizontal || 'right', vertical: publicCell.alignment?.vertical || 'middle', wrapText: publicCell.alignment?.wrapText };
    discountCell.numFmt = publicCell.numFmt || '$ #,##0.00';
  }
  pedido.autoFilter = `A3:E${Math.max(3, pedido.rowCount)}`;
  pedido.views = [{ state: 'frozen', ySplit: 3 }];
  const products = workbook.addWorksheet('PRODUCTOS');
  products.addRow(['ID', 'SKU', 'NOMBRE', 'DETALLE', 'PRESENTACION', 'MARCA', 'PRECIO PUBLICO', 'PRECIO LOGUEADO', 'CATEGORIA ID', 'CATEGORIAS ID', 'STOCK', 'AGOTADO', 'ESTADO']);
  styleHeader(products.getRow(1));
  products.columns = [12, 18, 42, 60, 18, 28, 16, 18, 14, 20, 12, 12, 14].map((width) => ({ width }));
  products.autoFilter = 'A1:L1';
  products.views = [{ state: 'frozen', ySplit: 1 }];
  products.state = 'hidden';

  const brands = workbook.addWorksheet('MARCAS');
  brands.addRow(['ID', 'CODIGO', 'NOMBRE', 'ACTIVA']);
  styleHeader(brands.getRow(1));
  brands.columns = [{ width: 28 }, { width: 28 }, { width: 42 }, { width: 12 }];
  brands.autoFilter = 'A1:D1';
  brands.views = [{ state: 'frozen', ySplit: 1 }];
  brands.state = 'hidden';

  const categories = workbook.addWorksheet('CATEGORIAS');
  categories.addRow(['ID', 'NOMBRE', 'SLUG', 'VISIBLE']);
  styleHeader(categories.getRow(1));
  categories.columns = [{ width: 12 }, { width: 42 }, { width: 42 }, { width: 12 }];
  categories.autoFilter = 'A1:D1';
  categories.views = [{ state: 'frozen', ySplit: 1 }];
  categories.state = 'hidden';

  const config = workbook.addWorksheet('CONFIGURACION');
  config.addRows([
    ['URL API', 'http://localhost:3000/api/integrations/excel/sync'],
    ['TOKEN', fixedToken],
    ['ULTIMA ACTUALIZACION', ''],
    ['INSTRUCCIONES', 'La clave fija ya está cargada. No modificar B2 salvo que se reemplace la clave del servidor.'],
  ]);
  styleHeader(config.getRow(1));
  config.columns = [{ width: 28 }, { width: 100 }];
  config.getCell('B2').protection = { locked: false };
  config.state = 'veryHidden';

  const backup = workbook.addWorksheet('BACKUP_PRECIOS');
  backup.addRow(['FECHA', 'ACTIVO', 'ID', 'DETALLE / VARIEDAD', 'PUBLICO', 'DESCUENTO', 'FILA ORIGEN']);
  styleHeader(backup.getRow(1));
  backup.columns = [{ width: 22 }, { width: 12 }, { width: 12 }, { width: 90 }, { width: 16 }, { width: 16 }, { width: 12 }];
  backup.state = 'veryHidden';

  pedido.getCell('A1').value = 'ACTUALIZAR BASE';
  pedido.getCell('A1').font = { name: 'Montserrat Medium', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  pedido.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3B6B5A' } };
  pedido.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  pedido.getCell('A1').border = { top: { style: 'thin', color: { argb: 'FF2D5146' } }, left: { style: 'thin', color: { argb: 'FF2D5146' } }, bottom: { style: 'thin', color: { argb: 'FF2D5146' } }, right: { style: 'thin', color: { argb: 'FF2D5146' } } };
  pedido.getCell('B1').value = 'ENVIAR CAMBIOS';
  pedido.getCell('B1').font = { name: 'Montserrat Medium', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  pedido.getCell('B1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFA86D45' } };
  pedido.getCell('B1').alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  pedido.getCell('B1').border = { top: { style: 'thin', color: { argb: 'FF895638' } }, left: { style: 'thin', color: { argb: 'FF895638' } }, bottom: { style: 'thin', color: { argb: 'FF895638' } }, right: { style: 'thin', color: { argb: 'FF895638' } } };
  pedido.getCell('C1').value = 'ORDENAR DETALLES POR MARCA';
  pedido.getCell('C1').font = { name: 'Montserrat Medium', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  pedido.getCell('C1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF5B7891' } };
  pedido.getCell('C1').alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  pedido.getCell('C1').border = { top: { style: 'thin', color: { argb: 'FF466276' } }, left: { style: 'thin', color: { argb: 'FF466276' } }, bottom: { style: 'thin', color: { argb: 'FF466276' } }, right: { style: 'thin', color: { argb: 'FF466276' } } };
  pedido.getCell('D1').value = null;
  pedido.getCell('D1').font = {};
  pedido.getCell('D1').fill = { type: 'pattern', pattern: 'none' };
  pedido.getCell('D1').alignment = { horizontal: 'general', vertical: 'bottom', wrapText: false };
  pedido.getCell('D1').border = {};
  // La fila de acciones queda sin celdas combinadas y con altura suficiente
  // para que ACTUALIZAR BASE se muestre completo en dos líneas.
  pedido.getRow(1).height = 38;
  pedido.getRow(2).height = 8;
  for (let rowNumber = 4; rowNumber <= pedido.rowCount; rowNumber += 1) {
    const publicCell = pedido.getCell(`D${rowNumber}`);
    const discountCell = pedido.getCell(`E${rowNumber}`);
    discountCell.style = JSON.parse(JSON.stringify(publicCell.style));
    discountCell.numFmt = publicCell.numFmt || '$ #,##0.00';
  }
  /* La planilla de pedidos ya no forma parte del sincronizador. */
  if (false) {
  importSheet.getCell('A2').value = 'Pegá aquí el contenido de la solapa PEDIDO CLIENTE. Luego volvé a PRECIOS y presioná IMPORTAR PEDIDO.';
  importSheet.addRow(['CANTIDAD', 'MARCA', 'DETALLE / VARIEDAD', 'PRESENTACIÓN', 'PRECIO', 'SUBTOTAL', 'ID EN SITIO', 'RESULTADO', 'DETALLE EN SITIO']);
  importSheet.columns = [{ width: 12 }, { width: 28 }, { width: 90 }, { width: 18 }, { width: 16 }, { width: 16 }, { width: 14 }, { width: 24 }, { width: 90 }];
  }
  const outsideLastColumn = pedido.columnCount;
  for (let columnNumber = 6; columnNumber <= outsideLastColumn; columnNumber += 1) {
    const column = pedido.getColumn(columnNumber);
    column.style = {};
    column.hidden = false;
    for (let rowNumber = 1; rowNumber <= pedido.rowCount; rowNumber += 1) {
      const cell = pedido.getCell(rowNumber, columnNumber);
      cell.value = null;
      cell.style = {};
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const zip = await JSZip.loadAsync(buffer);
  const parser = new DOMParser();
  const serializer = new XMLSerializer();
  const readXml = async (name) => parser.parseFromString(await zip.file(name).async('string'), 'application/xml');
  const writeXml = (name, doc) => zip.file(name, serializer.serializeToString(doc));
  const sheetNs = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';

  const workbookXml = await readXml('xl/workbook.xml');
  let workbookPr = workbookXml.getElementsByTagNameNS(sheetNs, 'workbookPr')[0];
  if (!workbookPr) { workbookPr = workbookXml.createElementNS(sheetNs, 'workbookPr'); workbookXml.documentElement.insertBefore(workbookPr, workbookXml.documentElement.firstChild); }
  workbookPr.setAttribute('codeName', 'ThisWorkbook');
  const workbookProtection = workbookXml.createElementNS(sheetNs, 'workbookProtection');
  workbookProtection.setAttribute('lockStructure', '1');
  workbookProtection.setAttribute('workbookPassword', 'CB8A');
  workbookXml.documentElement.insertBefore(workbookProtection, workbookPr.nextSibling);
  writeXml('xl/workbook.xml', workbookXml);
  for (let index = 1; index <= workbook.worksheets.length; index += 1) {
    const name = `xl/worksheets/sheet${index}.xml`;
    const doc = await readXml(name);
    if (index === 1) {
      for (const tag of ['drawing', 'legacyDrawing', 'legacyDrawingHF']) {
        for (const node of Array.from(doc.getElementsByTagNameNS(sheetNs, tag))) node.parentNode.removeChild(node);
      }
      const autoFilters = Array.from(doc.getElementsByTagNameNS(sheetNs, 'autoFilter'));
      if (autoFilters.length > 0) {
        const detailFilter = doc.createElementNS(sheetNs, 'filterColumn');
        detailFilter.setAttribute('colId', '2');
        detailFilter.setAttribute('hiddenButton', '1');
        autoFilters[0].appendChild(detailFilter);
      }
    }
    for (const protection of Array.from(doc.getElementsByTagNameNS(sheetNs, 'sheetProtection'))) {
      protection.parentNode.removeChild(protection);
    }
    let sheetPr = doc.getElementsByTagNameNS(sheetNs, 'sheetPr')[0];
    if (!sheetPr) { sheetPr = doc.createElementNS(sheetNs, 'sheetPr'); doc.documentElement.insertBefore(sheetPr, doc.documentElement.firstChild); }
    sheetPr.setAttribute('codeName', `Sheet${index}`);
    writeXml(name, doc);
  }
  const types = await readXml('[Content_Types].xml');
  for (const node of Array.from(types.getElementsByTagName('Override'))) {
    if (node.getAttribute('PartName') === '/xl/workbook.xml') node.setAttribute('ContentType', 'application/vnd.ms-excel.sheet.macroEnabled.main+xml');
  }
  const typesRoot = types.documentElement;
  const vbaOverride = types.createElementNS(typesRoot.namespaceURI, 'Override');
  vbaOverride.setAttribute('PartName', '/xl/vbaProject.bin');
  vbaOverride.setAttribute('ContentType', 'application/vnd.ms-office.vbaProject');
  typesRoot.appendChild(vbaOverride);
  writeXml('[Content_Types].xml', types);
  const rels = await readXml('xl/_rels/workbook.xml.rels');
  const vbaRel = rels.createElementNS('http://schemas.openxmlformats.org/package/2006/relationships', 'Relationship');
  vbaRel.setAttribute('Id', 'rIdPintoFrutaExcelSyncVba');
  vbaRel.setAttribute('Type', 'http://schemas.microsoft.com/office/2006/relationships/vbaProject');
  vbaRel.setAttribute('Target', 'vbaProject.bin');
  rels.documentElement.appendChild(vbaRel);
  writeXml('xl/_rels/workbook.xml.rels', rels);
  zip.file('xl/vbaProject.bin', fs.readFileSync(vbaPath));
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));
  console.log(`Generated ${output}`);
}

addSheets().catch((error) => { console.error(error); process.exitCode = 1; });
