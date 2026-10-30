const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const ExcelJS = require('exceljs');
const JSZip = require('jszip');
const {DOMParser,XMLSerializer} = require('@xmldom/xmldom');
const {HyperFormula} = require('hyperformula');
const {modules} = require('./test-hero-links.cjs');

const products = [
  {id:1,name:'Marca A Chocolate 100 g',brand:'Marca A',presentation:'100 g',public_price:5000,member_price:4000,status:'published',sold_out:false},
  {id:2,name:'Marca B Miel 450 g',brand:'Marca B',presentation:'450 g',public_price:8000,member_price:6000,status:'published',sold_out:false},
  {id:3,name:'Marca A Cacao sin descuento',brand:'Marca A',presentation:'200 g',public_price:3000,member_price:0,status:'published',sold_out:false},
  {id:4,name:'NO MOSTRAR AGOTADO',brand:'Marca A',presentation:'',public_price:1,member_price:1,status:'published',sold_out:true},
  {id:5,name:'NO MOSTRAR INACTIVO',brand:'Marca A',presentation:'',public_price:1,member_price:1,status:'inactive',sold_out:false},
  {id:6,name:'NO MOSTRAR ELIMINADO',brand:'Marca A',presentation:'',public_price:1,member_price:1,status:'published',sold_out:false,deleted_at:'2026-10-01'},
];
const namespace='http://schemas.openxmlformats.org/spreadsheetml/2006/main';

async function readCustomerOrderWorkbook(buffer) {
  const zip=await JSZip.loadAsync(buffer);
  const document=new DOMParser().parseFromString(await zip.file('xl/workbook.xml').async('string'),'application/xml');
  // ExcelJS 4.4 can only read static Print_Area references. Strip that metadata in
  // this in-memory inspection copy; validate the actual dynamic formula separately.
  for(const name of Array.from(document.getElementsByTagNameNS(namespace,'definedName'))){
    if(name.getAttribute('name')==='_xlnm.Print_Area'&&name.textContent.startsWith('OFFSET('))name.parentNode.removeChild(name);
  }
  zip.file('xl/workbook.xml',new XMLSerializer().serializeToString(document));
  // ExcelJS converts a formula cell carrying an OOXML hyperlink into plain text.
  // Remove only link metadata from this inspection copy so calculation tests keep
  // the formulas. The original hyperlinks are checked directly in the ZIP below.
  for(const entry of zip.file(/^xl\/worksheets\/sheet\d+\.xml$/)){
    const sheet=new DOMParser().parseFromString(await entry.async('string'),'application/xml');
    for(const links of Array.from(sheet.getElementsByTagNameNS(namespace,'hyperlinks')))links.parentNode.removeChild(links);
    zip.file(entry.name,new XMLSerializer().serializeToString(sheet));
  }
  const book=new ExcelJS.Workbook();await book.xlsx.load(await zip.generateAsync({type:'nodebuffer'}));return book;
}

function formulaSheets(book) {
  return Object.fromEntries(book.worksheets.map(sheet=>[sheet.name,Array.from({length:sheet.rowCount},(_,r)=>Array.from({length:Math.max(7,sheet.columnCount)},(_,c)=>{
    const cell=sheet.getRow(r+1).getCell(c+1);return cell.type===ExcelJS.ValueType.Merge?null:cell.formula?'='+cell.formula:cell.value&&typeof cell.value==='object'?cell.text:cell.value;
  }))]));
}

async function main(){
  const load=modules();const {buildCustomerOrderFile,CUSTOMER_ORDER_PRODUCTS_SQL}=load('src/lib/customer-order.ts');
  assert.match(CUSTOMER_ORDER_PRODUCTS_SQL,/deleted_at is null/);assert.match(CUSTOMER_ORDER_PRODUCTS_SQL,/status = 'published'/);assert.match(CUSTOMER_ORDER_PRODUCTS_SQL,/coalesce\(sold_out, false\) = false/);
  assert.ok(!/\bstock\b/.test(CUSTOMER_ORDER_PRODUCTS_SQL),'Availability is independent of numeric stock');
  const template=require('../src/lib/customer-order-template.json');
  const files=[];
  for(const audience of ['public','member']){
    // 02:30 UTC belongs to the previous date in Argentina.
    const file=await buildCustomerOrderFile(products,audience,new Date('2026-10-30T02:30:45Z'));
    assert.equal(file.productCount,3);assert.match(file.fileName,/2026-10-29_233045\.xlsm$/);
    assert.ok(file.fileName.includes(audience==='public'?'_publica_':'_con_descuento_'));
    const book=await readCustomerOrderWorkbook(file.buffer);
    assert.deepEqual(book.worksheets.map(s=>s.name),['PEDIDO CLIENTE','REMITO']);const sheet=book.getWorksheet('PEDIDO CLIENTE');assert.ok(sheet);
    const remito=book.getWorksheet('REMITO');
    assert.deepEqual(sheet.getRow(14).values.slice(1),['CANTIDAD','MARCA','DETALLE / VARIEDAD','PRESENTACIÓN','PRECIO','SUBTOTAL']);
    assert.equal(sheet.getColumn(7).hidden,true);assert.deepEqual(sheet.columns.slice(0,6).map(c=>c.width),template.columns.map(c=>c.width));
    assert.notEqual(remito.getColumn(5).hidden,true);assert.equal(remito.getColumn(6).hidden,true);assert.equal(remito.getCell('E5').text,'Quitar');
    assert.equal(sheet.getImages().length,1);assert.equal(sheet.getCell('C3').text,'DATOS');
    const image=sheet.getImages()[0];assert.ok(Math.abs(image.range.ext.width/image.range.ext.height-template.logo.width/template.logo.height)<0.001,'Logo aspect ratio is preserved');
    assert.equal(sheet.views[0].state,'normal');assert.equal(remito.views[0].state,'normal');
    assert.ok(sheet.getCell('A9').text.includes(audience==='public'?'PÚBLICA':'CON DESCUENTO'));assert.ok(sheet.getCell('A9').text.endsWith('29-10-26'));
    for(const address of ['C4','C5','C6','C7','C8']){assert.equal(sheet.getCell(address).value,null);assert.equal(sheet.getCell(address).protection.locked,false);}
    for(const address of ['D4','D5','D6','D7','D8'])assert.equal(sheet.getCell(address).protection.locked,false,'Both cells of merged customer inputs must remain editable');
    for(const address of ['A4','C3','F7','E16','C16'])assert.notEqual(sheet.getCell(address).protection?.locked,false);
    const rows=[];sheet.eachRow(row=>{if(row.number>=15&&typeof row.getCell(5).value==='number')rows.push(row);});
    for(let number=6;number<=remito.rowCount;number++){
      const totalFormula=remito.getCell(`D${number}`).formula;
      assert.ok(!/\bSUBTOTAL\s*\(/i.test(totalFormula),'Excel would exclude nested subtotal formulas from the grand total');
      assert.ok(totalFormula.includes(`SUM($D$5:D${number-1})`),'The moving grand total directly adds every preceding subtotal');
    }
    assert.equal(rows.length,3);assert.equal(rows[0].getCell(3).text,'Marca A Cacao sin descuento');
    for(const row of rows){
      const fixture=products.find(p=>p.name===row.getCell(3).text);assert.ok(fixture);
      assert.equal(row.getCell(1).value,null);assert.equal(row.getCell(1).protection.locked,false);
      assert.equal(row.getCell(1).dataValidation.type,'whole');assert.ok(row.getCell(6).formula.includes(`A${row.number}*E${row.number}`));
      assert.ok(row.getCell(7).formula.includes('COUNT($G$14:G'));
      assert.equal(row.getCell(5).value,audience==='member'&&fixture.member_price>0?fixture.member_price:fixture.public_price);
      assert.ok(row.height>=21);assert.equal(row.getCell(3).alignment.wrapText,true);
    }
    const grids=formulaSheets(book);
    const calc=HyperFormula.buildFromSheets(grids,{licenseKey:'gpl-v3'});const sheetId=calc.getSheetId('PEDIDO CLIENTE');const remitoId=calc.getSheetId('REMITO');
    const remitoCell=(r,c)=>calc.getCellValue({sheet:remitoId,row:r-1,col:c-1});
    function assertTotalMatchesSubtotals(){
      let sum=0,total,totalRows=0;
      for(let number=6;number<=remito.rowCount;number++){
        if(remitoCell(number,6)>0)sum+=remitoCell(number,4);
        if(remitoCell(number,1)==='TOTAL'){total=remitoCell(number,4);totalRows++;}
      }
      assert.equal(totalRows,1);assert.equal(total,sum,'Grand total equals the sum of every selected line subtotal');
      assert.equal(total,calc.getCellValue({sheet:sheetId,row:6,col:5}),'Both sheets remain synchronized');
    }
    const deleteFromRemito=line=>{
      if(remitoCell(line,5)!=='X')return false;
      const position=remitoCell(line,6);
      assert.ok(Number.isInteger(position)&&position>0);
      calc.setCellContents({sheet:sheetId,row:15+position-2,col:0},[[null]]);
      return true;
    };
    assert.equal(remitoCell(6,1),'TOTAL');assert.equal(remitoCell(6,4),0);
    assertTotalMatchesSubtotals();
    for(const [r,value] of [[4,'20303030301'],[5,'Cliente de prueba'],[6,'CP 1223 Alberti 582'],[7,'8 a 21'],[8,'1155555555']])calc.setCellContents({sheet:sheetId,row:r-1,col:2},[[value]]);
    assert.ok(remitoCell(2,1).includes('Cliente de prueba'));assert.ok(remitoCell(2,1).includes('1155555555'));assert.ok(remitoCell(2,1).includes('CUIT 20303030301'));
    assert.equal(remitoCell(3,1),'CP 1223 Alberti 582   8 a 21'.replace(/ +/g,' '));
    let expected=0;
    for(const [index,row] of rows.entries()){
      calc.setCellContents({sheet:sheetId,row:row.number-1,col:0},[[index+2]]);
      expected+=(index+2)*row.getCell(5).value;
      assert.equal(calc.getCellValue({sheet:sheetId,row:row.number-1,col:5}),(index+2)*row.getCell(5).value);
      assert.equal(remitoCell(6+index,1),row.getCell(3).text);assert.equal(remitoCell(6+index,2),index+2);assert.equal(remitoCell(6+index,3),row.getCell(5).value);assert.equal(remitoCell(6+index,4),(index+2)*row.getCell(5).value);
      assert.equal(remitoCell(6+index,5),'X');
      assertTotalMatchesSubtotals();
    }
    assert.equal(calc.getCellValue({sheet:sheetId,row:6,col:5}),expected,'The header total recalculates across all brands');
    assert.equal(remitoCell(6+rows.length,1),'TOTAL');assert.equal(remitoCell(6+rows.length,4),expected);
    calc.setCellContents({sheet:sheetId,row:rows[0].number-1,col:0},[[7]]);
    assert.equal(remitoCell(6+rows.length,4),expected+5*rows[0].getCell(5).value,'Changing an existing quantity updates the total');assertTotalMatchesSubtotals();
    calc.setCellContents({sheet:sheetId,row:rows[0].number-1,col:0},[[2]]);assertTotalMatchesSubtotals();
    assert.equal(calc.calculateFormula(`=COUNT('PEDIDO CLIENTE'!$G$15:$G$${sheet.rowCount})+6`,remitoId),rows.length+6,'Print area height includes only headers, selections and total');
    calc.setCellContents({sheet:sheetId,row:rows[0].number-1,col:0},[[null]]);
    assert.equal(calc.getCellValue({sheet:sheetId,row:6,col:5}),expected-2*rows[0].getCell(5).value,'Clearing a quantity recalculates the total');
    assert.equal(remitoCell(6,1),rows[1].getCell(3).text,'Removing a selection compacts the remito');
    assert.equal(remitoCell(8,1),'TOTAL');assert.equal(remitoCell(9,1),'');assert.equal(remitoCell(9,4),'');
    assertTotalMatchesSubtotals();
    for(const invalid of [-1,1.5,'abc',0]){
      calc.setCellContents({sheet:sheetId,row:rows[0].number-1,col:0},[[invalid]]);
      assert.equal(remitoCell(6,1),rows[1].getCell(3).text);assert.equal(remitoCell(8,1),'TOTAL');
      assert.equal(calc.getCellValue({sheet:sheetId,row:6,col:5}),expected-2*rows[0].getCell(5).value);
      assertTotalMatchesSubtotals();
    }
    for(const row of rows)calc.setCellContents({sheet:sheetId,row:row.number-1,col:0},[[null]]);
    assert.equal(remitoCell(6,1),'TOTAL');assert.equal(remitoCell(6,4),0);assert.equal(remitoCell(7,1),'');
    assertTotalMatchesSubtotals();
    calc.setCellContents({sheet:sheetId,row:rows.at(-1).number-1,col:0},[[5]]);
    assert.equal(remitoCell(6,1),rows.at(-1).getCell(3).text);assert.equal(remitoCell(7,1),'TOTAL');assert.equal(remitoCell(7,4),5*rows.at(-1).getCell(5).value);
    for(const [index,row] of rows.entries())calc.setCellContents({sheet:sheetId,row:row.number-1,col:0},[[index+2]]);
    assert.equal(deleteFromRemito(7),true,'Delete middle line through its source mapping');
    assert.equal(calc.getCellValue({sheet:sheetId,row:rows[1].number-1,col:0}),null);
    assert.equal(remitoCell(6,1),rows[0].getCell(3).text);assert.equal(remitoCell(7,1),rows[2].getCell(3).text);assert.equal(remitoCell(8,1),'TOTAL');assert.equal(remitoCell(8,5),'');
    assert.equal(remitoCell(8,4),expected-3*rows[1].getCell(5).value);
    assertTotalMatchesSubtotals();
    assert.equal(deleteFromRemito(6),true);assert.equal(remitoCell(6,1),rows[2].getCell(3).text);assert.equal(remitoCell(7,4),4*rows[2].getCell(5).value);
    assert.equal(deleteFromRemito(6),true);assert.equal(remitoCell(6,1),'TOTAL');assert.equal(remitoCell(6,4),0);assert.equal(deleteFromRemito(6),false,'Total and empty rows have no delete action');
    assertTotalMatchesSubtotals();
    calc.setCellContents({sheet:sheetId,row:rows[1].number-1,col:0},[[1]]);assert.equal(remitoCell(6,1),rows[1].getCell(3).text);assert.equal(remitoCell(6,5),'X','A removed product can be selected again');
    calc.destroy();
    const zip=await JSZip.loadAsync(file.buffer,{checkCRC32:true});
    assert.equal(await zip.file('xl/theme/theme1.xml').async('string'),template.themeXml);
    assert.ok(zip.file('xl/vbaProject.bin'),'Click-to-delete VBA is embedded');
    assert.equal((await zip.file('xl/vbaProject.bin').async('nodebuffer')).subarray(0,8).toString('hex'),'d0cf11e0a1b11ae1');
    assert.match(await zip.file('[Content_Types].xml').async('string'),/application\/vnd\.ms-excel\.sheet\.macroEnabled\.main\+xml/);
    assert.match(await zip.file('xl/_rels/workbook.xml.rels').async('string'),/relationships\/vbaProject/);
    const strings=await zip.file('xl/sharedStrings.xml').async('string');assert.ok(!strings.includes('NO MOSTRAR'));assert.ok(!strings.includes('GRAVIOLA'),'No original product rows carried over');
    const parser=new DOMParser();for(const entry of zip.file(/\.xml$/)){const doc=parser.parseFromString(await entry.async('string'),'application/xml');assert.equal(doc.getElementsByTagName('parsererror').length,0,entry.name);}
    const sheetXml=await zip.file('xl/worksheets/sheet1.xml').async('string');assert.ok(sheetXml.indexOf('<outlinePr')<sheetXml.indexOf('<pageSetUpPr'),'Worksheet properties follow Excel schema order');
    assert.ok(!sheetXml.includes('<pane'),'The entire sheet scrolls together');
    assert.match(await zip.file('xl/drawings/drawing1.xml').async('string'),/oneCellAnchor/);
    const remitoXml=await zip.file('xl/worksheets/sheet2.xml').async('string');assert.ok(!remitoXml.includes('<pane'));assert.ok(remitoXml.includes('conditionalFormatting'));
    const remitoDoc=parser.parseFromString(remitoXml,'application/xml');const links=Array.from(remitoDoc.getElementsByTagNameNS(namespace,'hyperlink'));
    assert.equal(links.length,rows.length,'Every product slot has an actual internal hyperlink');
    for(const [index,link] of links.entries()){assert.equal(link.getAttribute('ref'),`E${6+index}`);assert.equal(link.getAttribute('location'),`'REMITO'!A${6+index}`);assert.equal(link.getAttribute('r:id'),null);}
    assert.ok(remitoXml.indexOf('<hyperlinks')<remitoXml.indexOf('<pageMargins'),'Internal hyperlinks follow the worksheet schema order');
    assert.match(remitoXml,/codeName="Sheet2"/);assert.match(sheetXml,/codeName="Sheet1"/);
    const workbookXml=await zip.file('xl/workbook.xml').async('string');assert.match(workbookXml,/OFFSET\('REMITO'/,'Printed remito stops immediately after its moving total');
    assert.match(workbookXml,/codeName="ThisWorkbook"/);
    for(const name of ['PedidoQuitar','PedidoOrigen','PedidoIndice'])assert.ok(book.definedNames.model.some(entry=>entry.name===name),name);
    assert.ok(!Object.keys(zip.files).some(name=>/pivotCache/.test(name)),'No stale original pivot-cache product data');
    assert.match(await zip.file('xl/workbook.xml').async('string'),/calcMode="auto"/);
    files.push(file);
  }
  const empty=await buildCustomerOrderFile([], 'public');const emptyBook=await readCustomerOrderWorkbook(empty.buffer);assert.equal(emptyBook.worksheets[0].getCell('F7').result,0);
  const long=await buildCustomerOrderFile([{...products[0],name:'Marca A '+('Producto muy largo '.repeat(45))}], 'member');const longBook=await readCustomerOrderWorkbook(long.buffer);assert.ok(longBook.worksheets[0].getRow(16).height>40);
  const duplicated=await buildCustomerOrderFile([products[0],{...products[0],id:99,public_price:7000}], 'public');
  const duplicatedBook=await readCustomerOrderWorkbook(duplicated.buffer);
  const duplicateCalc=HyperFormula.buildFromSheets(formulaSheets(duplicatedBook),{licenseKey:'gpl-v3'});
  const duplicateSource=duplicateCalc.getSheetId('PEDIDO CLIENTE'),duplicateRemito=duplicateCalc.getSheetId('REMITO');
  duplicateCalc.setCellContents({sheet:duplicateSource,row:15,col:0},[[2]]);duplicateCalc.setCellContents({sheet:duplicateSource,row:16,col:0},[[3]]);
  assert.equal(duplicateCalc.getCellValue({sheet:duplicateRemito,row:5,col:0}),duplicateCalc.getCellValue({sheet:duplicateRemito,row:6,col:0}));
  const duplicatePosition=duplicateCalc.getCellValue({sheet:duplicateRemito,row:6,col:5});
  duplicateCalc.setCellContents({sheet:duplicateSource,row:15+duplicatePosition-2,col:0},[[null]]);
  assert.equal(duplicateCalc.getCellValue({sheet:duplicateSource,row:15,col:0}),2,'Deleting the second same-name product must preserve the first');
  assert.equal(duplicateCalc.getCellValue({sheet:duplicateSource,row:16,col:0}),null);
  assert.equal(duplicateCalc.getCellValue({sheet:duplicateRemito,row:6,col:0}),'TOTAL');assert.equal(duplicateCalc.getCellValue({sheet:duplicateRemito,row:6,col:3}),10000);duplicateCalc.destroy();
  await assert.rejects(()=>buildCustomerOrderFile(products,'bad'),/Elegí/);
  console.log('OK exact template header, logo, colors, 6 columns, brands, available products, both price lists, Argentina date, protection and long names.');
  console.log('OK REMITO delete actions and source-row mapping: removing first/middle/last products, duplicate names, totals, re-selection, both price lists, actual hyperlinks, XLSM/VBA bindings and valid XML.');
  let viewer=null,queries=0,offline=false;
  const route=modules({
    '@/infrastructure/auth/pintofruta-auth':{getCurrentViewer:async()=>viewer},
    '@/infrastructure/db/postgres':{postgresPool:{query:async(sql)=>{queries++;assert.equal(sql,CUSTOMER_ORDER_PRODUCTS_SQL);if(offline)throw new Error('private connection detail');return {rows:products};}}},
  })('src/app/api/admin/customer-order/route.ts');
  for(const user of [null,{authenticated:true,isAdmin:false}]){viewer=user;assert.equal((await route.GET(new Request('http://localhost/api/admin/customer-order?audience=member'))).status,403);}
  assert.equal(queries,0);viewer={authenticated:true,isAdmin:true};
  for(const audience of ['', 'invalid'])assert.equal((await route.GET(new Request('http://localhost/api/admin/customer-order?audience='+audience))).status,400);
  assert.equal(queries,0);
  for(const audience of ['public','member']){const response=await route.GET(new Request('http://localhost/api/admin/customer-order?audience='+audience));assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'application/vnd.ms-excel.sheet.macroEnabled.12');assert.match(response.headers.get('content-disposition'),/\.xlsm"$/);assert.equal(response.headers.get('cache-control'),'private, no-store');assert.equal(response.headers.get('x-product-count'),'3');}
  offline=true;const originalError=console.error;console.error=()=>{};try{const response=await route.GET(new Request('http://localhost/api/admin/customer-order?audience=public'));assert.equal(response.status,500);assert.equal((await response.text()).includes('private'),false);}finally{console.error=originalError;}
  await fs.mkdir('artifacts/customer-order-analysis',{recursive:true});for(const file of files)await fs.writeFile('artifacts/customer-order-analysis/'+file.fileName,file.buffer);
  console.log('OK admin-only download, explicit price choice, current catalog query, response headers and safe connection errors. No application data modified.');
}
module.exports={readCustomerOrderWorkbook};
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
