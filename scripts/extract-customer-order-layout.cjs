const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const ExcelJS = require('exceljs');
const JSZip = require('jszip');
const sharp = require('sharp');

(async () => {
  const input = process.argv[2];
  assert.ok(input, 'Indica el Excel de referencia.');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(input);
  const sheet = workbook.getWorksheet('PEDIDO CLIENTE');
  assert.ok(sheet, 'Falta la solapa PEDIDO CLIENTE.');
  const rowStyle = number => ({ height: sheet.getRow(number).height, styles: Array.from({ length: 6 }, (_, i) => sheet.getRow(number).getCell(i + 1).style) });
  const headerRows = Array.from({ length: 14 }, (_, i) => ({
    height: sheet.getRow(i + 1).height,
    cells: Array.from({ length: 6 }, (_, c) => {
      const cell = sheet.getRow(i + 1).getCell(c + 1);
      return { value: cell.type === ExcelJS.ValueType.Merge || cell.formula ? null : cell.value, style: cell.style };
    }),
  }));
  headerRows[8].cells[0].value = 'LISTA';
  for (let r = 3; r <= 7; r++) headerRows[r].cells[2].value = null;
  const logo = await fs.readFile(path.resolve('public/assets/images/logo/logo-Pintofruta.png'));
  const logoMetadata = await sharp(logo).metadata();
  const remito = workbook.getWorksheet('REMITO');
  assert.ok(remito, 'Falta la solapa REMITO.');
  const zip = await JSZip.loadAsync(await fs.readFile(input));
  const layout = {
    sheetName: 'PEDIDO CLIENTE',
    columns: sheet.columns.slice(0, 6).map(column => ({ width: column.width })),
    headerRows,
    merges: sheet.model.merges.filter(range => Number(range.split(':').at(-1).replace(/\D/g, '')) <= 14),
    groupRow: rowStyle(15), firstProductRow: rowStyle(16), productRow: rowStyle(18),
    pageSetup: sheet.pageSetup,
    logo: { data: logo.toString('base64'), extension: 'png', width: logoMetadata.width, height: logoMetadata.height },
    remito: {
      columns: remito.columns.slice(0, 4).map(column => ({ width: column.width })),
      headerRows: Array.from({ length: 5 }, (_, i) => ({
        height: remito.getRow(i + 1).height,
        cells: Array.from({ length: 4 }, (_, column) => {
          const cell = remito.getRow(i + 1).getCell(column + 1);
          return { value: i < 3 || cell.type === ExcelJS.ValueType.Merge || cell.formula ? null : cell.value, style: cell.style };
        }),
      })),
      merges: remito.model.merges,
      pageSetup: remito.pageSetup,
    },
    themeXml: await zip.file('xl/theme/theme1.xml').async('string'),
  };
  const output = path.resolve('src/lib/customer-order-template.json');
  await fs.writeFile(output, JSON.stringify(layout, null, 2) + '\n');
  console.log(JSON.stringify({ output, bytes: (await fs.stat(output)).size, headerRows: layout.headerRows.length, columns: layout.columns.length, logo: layout.logo.extension, remito: true, oldProductsIncluded: false }));
})().catch(error => { console.error(error); process.exitCode = 1; });
