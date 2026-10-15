const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const ExcelJS = require('exceljs');
const JSZip = require('jszip');
const { DOMParser } = require('@xmldom/xmldom');
const { HyperFormula } = require('hyperformula');

let templateBuffer = null;
let mailMode = 'sent';
let capturedMail = null;
let capturedMailParams = null;
const context = {
  console: { info() {}, warn() {} },
  require(id) {
    if (id === 'node:fs') return { appendFileSync() {} };
    if (id === '@/infrastructure/db/postgres') return { postgresPool: null };
    if (id === '@/lib/catalog') return { normalizeText: s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() };
    if (id === '@/lib/order-template-row-map-key') return { getTemplateRowMapKey: () => 'fixture' };
    if (id === '@/lib/order-email') return { sendOrderExcelByEmail: async (params) => {
      capturedMailParams = params;
      if (mailMode === 'throw') throw new Error('SMTP fixture failure');
      return mailMode === 'sent' ? { sent: true } : { sent: false, reason: 'SMTP fixture disabled' };
    } };
    if (id === '@/infrastructure/site-content.repository') return { getSiteContent: async () => ({ orderNotificationEmail: 'orders@example.test' }) };
    if (id === 'nodemailer') return { createTransport: () => ({ sendMail: async (params) => { capturedMail = params; } }) };
    if (id === '@/infrastructure/order-template') return {
      getActiveOrderExcelTemplate: async () => templateBuffer ? { id: 1, file_name: 'remito.xlsx' } : null,
      downloadOrderExcelTemplate: async () => ({ buffer: templateBuffer, fileName: 'remito.xlsx' }),
    };
    if (id.startsWith('@/lib/')) return loadModule(path.join('src', id.slice(2) + '.ts'));
    return require(id);
  },
};
const modules = new Map();
function loadModule(file) {
  if (modules.has(file)) return modules.get(file).exports;
  const moduleValue = { exports: {} };
  modules.set(file, moduleValue);
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  new Function('require', 'module', 'exports', 'console', source)(context.require, moduleValue, moduleValue.exports, context.console);
  return moduleValue.exports;
}
const { buildOrderExcelFile } = loadModule('src/lib/order-excel.ts');

const items = [
  { sku: 'A', name: 'Producto A', quantity: 2, publicPrice: 100, memberPrice: 80 },
  { sku: 'B', name: 'Producto B', quantity: 3, publicPrice: 50, memberPrice: 40 },
  { sku: 'C', name: 'Producto C', quantity: 1, publicPrice: 25, memberPrice: 20 },
];

async function makeTemplate(capacity, shifted = false) {
  const workbook = new ExcelJS.Workbook();
  workbook.addWorksheet('Lista');
  workbook.definedNames.add("'Lista'!$A$1:$C$20", '_xlnm._FilterDatabase');
  const sheet = workbook.addWorksheet('REMITO');
  sheet.mergeCells('A1:D1');
  sheet.getCell('A1').value = 'REMITO - fecha vieja';
  sheet.mergeCells('A4:D4');
  sheet.getCell('A4').value = 'el transportista entrega y cobra: NO ESPERA a que controlen';
  sheet.getRow(5).values = shifted ? ['Codigo', 'Detalle', 'Cant', 'Precio', 'Total'] : ['Detalle', 'Cant', 'Precio', 'Total'];
  for (const column of sheet.columns) column.width = 4;
  for (let i = 0; i < capacity; i++) {
    sheet.getRow(6 + i).values = shifted ? ['old', 'Producto viejo', 8, 10, 80] : ['Producto viejo', 8, 10, 80];
    sheet.getRow(6 + i).hidden = true;
    sheet.getRow(6 + i).outlineLevel = 1;
    sheet.getRow(6 + i).height = 12;
  }
  sheet.getRow(6 + capacity).getCell(shifted ? 2 : 1).value = 'TOTAL';
  sheet.getRow(6 + capacity).getCell(shifted ? 5 : 4).value = 999;
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

async function verify(label, template, member = false, orderItems = items) {
  templateBuffer = template;
  const result = await buildOrderExcelFile({
    items: orderItems,
    viewer: { authenticated: member, canSeePrices: member },
    generatedAt: '2026-10-15T01:00:00Z',
  });
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(result.buffer);
  assert.equal(workbook.worksheets.length, 1);
  const zip = await JSZip.loadAsync(result.buffer);
  const workbookXml = await zip.file('xl/workbook.xml').async('string');
  assert.match(workbookXml, /fullCalcOnLoad="1"/);
  assert.equal(result.fileName, 'Remito_2026-10-14_22-00-00.xlsm');
  assert.equal(result.contentType, 'application/vnd.ms-excel.sheet.macroEnabled.12');
  assert.match(workbookXml, /codeName="ThisWorkbook"/);
  assert.match(workbookXml, /name="RemitoTotal"/);
  assert.match(workbookXml, /name="RemitoQuitar"/);
  assert.doesNotMatch(workbookXml, /_xlnm\._FilterDatabase/);
  assert.ok((await zip.file('xl/vbaProject.bin').async('nodebuffer')).subarray(0, 8).equals(Buffer.from('d0cf11e0a1b11ae1', 'hex')));
  const typesXml = await zip.file('[Content_Types].xml').async('string');
  assert.match(typesXml, /application\/vnd.ms-excel.sheet.macroEnabled.main\+xml/);
  const worksheetXml = await zip.file(Object.keys(zip.files).find(name => /^xl\/worksheets\/sheet\d+\.xml$/.test(name))).async('string');
  assert.doesNotMatch(worksheetXml, /dataValidations/);
  assert.match(worksheetXml, /codeName="Sheet1"/);
  const xml = new DOMParser().parseFromString(worksheetXml, 'application/xml');
  const properties = Array.from(xml.getElementsByTagName('sheetPr')[0].childNodes).map(node => node.nodeName);
  if (properties.includes('outlinePr') && properties.includes('pageSetUpPr')) {
    assert.ok(properties.indexOf('outlinePr') < properties.indexOf('pageSetUpPr'));
  }
  const stylesXml = new DOMParser().parseFromString(await zip.file('xl/styles.xml').async('string'), 'application/xml');
  for (const font of Array.from(stylesXml.getElementsByTagName('font'))) {
    const size = font.getElementsByTagName('sz')[0];
    const color = font.getElementsByTagName('color')[0];
    if (size && color) {
      const elements = Array.from(font.childNodes);
      assert.ok(elements.indexOf(size) < elements.indexOf(color));
    }
  }
  const sheet = workbook.worksheets[0];
  assert.match(sheet.getCell('A1').text, /REMITO\s+14-10-26/);
  let headerRow;
  let totalRow;
  const columns = {};
  sheet.eachRow(row => {
    row.eachCell(cell => {
      if (cell.value === 'Quitar') headerRow = row.number;
      if (cell.value === 'TOTAL') totalRow = row.number;
    });
  });
  sheet.getRow(headerRow).eachCell((cell, col) => { columns[String(cell.value).trim().toLowerCase()] = col; });
  const quantity = columns.cant - 1;
  const price = columns.precio - 1;
  const subtotal = columns.total - 1;
  const action = columns.quitar - 1;
  const firstData = headerRow;
  assert.ok(sheet.getColumn(columns.cant).width >= 12);
  assert.ok(sheet.getColumn(columns.precio).width >= 18);
  assert.ok(sheet.getColumn(columns.total).width >= 20);
  assert.equal(sheet.getRow(headerRow).height, 28);
  assert.ok(sheet.getRow(totalRow).height >= 30);
  assert.ok(sheet.getRow(1).height >= 40);
  const expected = orderItems.reduce((sum, item) => sum + item.quantity * (member ? item.memberPrice : item.publicPrice), 0);
  assert.equal(sheet.getRow(totalRow).getCell(subtotal + 1).result, expected);
  assert.equal(sheet.getRow(headerRow).getCell(subtotal + 1).fill.fgColor.argb, 'FFDDEBF7');
  assert.equal(sheet.getRow(totalRow).getCell(subtotal + 1).fill.fgColor.argb, 'FFDDEBF7');
  assert.ok(sheet.autoFilter.endsWith(`${sheet.getColumn(action + 1).letter}${Math.max(headerRow, totalRow - 1)}`));
  const data = Array.from({ length: sheet.rowCount }, (_, row) =>
    Array.from({ length: sheet.columnCount }, (_, col) => {
      const cell = sheet.getCell(row + 1, col + 1);
      return cell.formula ? `=${cell.formula}` : cell.hyperlink ? cell.text : cell.value ?? null;
    }));
  const engine = HyperFormula.buildFromArray(data, { licenseKey: 'gpl-v3', precisionRounding: 15 });
  if (process.env.DEBUG_EXCEL) console.log(JSON.stringify({ data, evaluated: engine.getSheetValues(0) }, null, 2));
  const address = (row, col) => ({ sheet: 0, row, col });
  let summary = totalRow - 1;
  const checkTotal = value => assert.equal(engine.getCellValue(address(summary, subtotal)), value, `${label}: total`);
  checkTotal(expected);
  if (orderItems.length) {
    const originalQty = orderItems[0].quantity;
    const originalPrice = member ? orderItems[0].memberPrice : orderItems[0].publicPrice;
    engine.setCellContents(address(firstData, quantity), [[5]]);
    checkTotal(expected + (5 - originalQty) * originalPrice);
    engine.setCellContents(address(firstData, price), [[12.5]]);
    checkTotal(expected - originalQty * originalPrice + 62.5);
    engine.setCellContents(address(firstData, quantity), [[originalQty]]);
    engine.setCellContents(address(firstData, price), [[originalPrice]]);
    checkTotal(expected);
    let remaining = [...orderItems];
    while (remaining.length) {
      const index = remaining.length === 3 ? 1 : remaining.length - 1;
      engine.removeRows(0, [firstData + index, 1]);
      summary -= 1;
      remaining.splice(index, 1);
      checkTotal(remaining.reduce((sum, item) => sum + item.quantity * (member ? item.memberPrice : item.publicPrice), 0));
    }
  }
  engine.destroy();
  for (let row = headerRow + 1; row < totalRow; row++) {
    assert.equal(sheet.getRow(row).hidden, false);
    assert.equal(sheet.getRow(row).outlineLevel, 0);
    assert.equal(sheet.getRow(row).getCell(action + 1).text, 'X');
    assert.ok(sheet.getRow(row).height >= 24);
    assert.equal(sheet.getRow(row).getCell(columns.detalle).alignment.wrapText, true);
    assert.equal(sheet.getRow(row).getCell(columns.detalle).font.size, 12);
    assert.match(worksheetXml, new RegExp(`ref="${sheet.getColumn(action + 1).letter}${row}"[^>]*location="'REMITO'!A${row}"`));
  }
  if (label === 'long-names-large-amounts') {
    assert.ok(sheet.getRow(headerRow + 2).height > sheet.getRow(headerRow + 1).height);
    assert.ok(sheet.getRow(headerRow + 3).height >= 50);
    assert.ok(sheet.getColumn(columns.total).width > 20);
  }
  if (process.env.REMITO_TEST_OUTPUT_DIR) {
    fs.mkdirSync(process.env.REMITO_TEST_OUTPUT_DIR, { recursive: true });
    fs.writeFileSync(path.join(process.env.REMITO_TEST_OUTPUT_DIR, `${label}.xlsm`), result.buffer);
  }
  console.log(`OK ${label}: total ${expected}, quantity/price changes, row deletion, macro packaging and filename`);
  return result;
}

async function verifyDelivery() {
  templateBuffer = null;
  const { POST } = loadModule('src/app/api/pedido/excel/route.ts');
  for (const mode of ['sent', 'skipped', 'throw']) {
    mailMode = mode;
    const response = await POST(new Request('http://localhost/api/pedido/excel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    }));
    assert.equal(response.status, 200);
    assert.match(response.headers.get('x-file-name'), /^Remito_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.xlsm$/);
    assert.equal(capturedMailParams.contentType, 'application/vnd.ms-excel.sheet.macroEnabled.12');
    if (mode === 'sent') {
      assert.equal(response.headers.get('x-email-sent'), 'true');
      assert.equal((await response.json()).fileName, capturedMailParams.fileName);
    } else {
      assert.equal(response.headers.get('content-type'), capturedMailParams.contentType);
      assert.equal(response.headers.get('x-email-sent'), 'false');
      assert.ok(response.headers.get('content-disposition').includes(capturedMailParams.fileName));
      assert.ok(Buffer.from(await response.arrayBuffer()).equals(capturedMailParams.buffer));
    }
  }
  const mail = loadModule('src/lib/order-email.ts');
  const previousEnv = Object.fromEntries(['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS'].map(key => [key, process.env[key]]));
  try {
    Object.assign(process.env, { SMTP_HOST: 'smtp.example.test', SMTP_PORT: '465', SMTP_USER: 'test@example.test', SMTP_PASS: 'fixture' });
    assert.equal((await mail.sendOrderExcelByEmail(capturedMailParams)).sent, true);
    assert.equal(capturedMail.attachments[0].filename, capturedMailParams.fileName);
    assert.equal(capturedMail.attachments[0].contentType, capturedMailParams.contentType);
    assert.ok(capturedMail.attachments[0].content.equals(capturedMailParams.buffer));
    assert.match(capturedMail.text, /macros/);
    assert.match(capturedMail.html, /\.xlsm/);
  } finally {
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
  console.log('OK delivery: email attachment, MIME, timestamp filename, download fallback and SMTP error; no real mail sent');
}

(async () => {
  await verify('fallback', null);
  await verify('fallback-member', null, true);
  await verify('template-shrink', await makeTemplate(8));
  await verify('template-expand', await makeTemplate(1));
  await verify('template-reordered-columns', await makeTemplate(3, true));
  await verify('single-product', null, false, items.slice(0, 1));
  await verify('empty-order', null, false, []);
  await verify('long-names-large-amounts', await makeTemplate(4), false, [
    { sku: 'A', name: 'PRODUCTO CORTO', quantity: 3, publicPrice: 11000 },
    { sku: 'B', name: 'BENOT BARRITA CHOCOLATE SEMIAMARGO VEGANO CROCANTE Y FRUTOS ROJOS CAJA 24u CON SEMILLAS DE GIRASOL Y ALMENDRAS', quantity: 2, publicPrice: 21400 },
    { sku: 'C', name: 'PRODUCTO CON DESCRIPCION\nSEGUNDA LINEA\nTERCERA LINEA', quantity: 2, publicPrice: 26300 },
    { sku: 'D', name: 'IMPORTE GRANDE', quantity: 1234, publicPrice: 9876543210 },
  ]);
  if (process.env.REMITO_TEST_TEMPLATE) {
    await verify('user-template', fs.readFileSync(process.env.REMITO_TEST_TEMPLATE));
  }
  await verifyDelivery();
})().catch(error => { console.error(error); process.exitCode = 1; });
