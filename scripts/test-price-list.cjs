const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const ts = require('typescript');
const XLSX = require('xlsx');
const ExcelJS = require('exceljs');
const JSZip = require('jszip');

function modules(mocks = {}) {
  const cache = new Map();
  function load(file) {
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} };
    cache.set(file, module);
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText;
    const resolve = id => id in mocks ? mocks[id] : id.startsWith('@/') ? load(path.join('src', `${id.slice(2)}.ts`)) : require(id);
    new Function('require', 'module', 'exports', code)(resolve, module, module.exports);
    return module.exports;
  }
  return load;
}
const load = modules();
const lib = load('src/lib/price-list.ts');
const { PRICE_LIST_HEADERS, parsePriceList, planPriceListImport, parseImportDecisions, createPriceListWorkbook } = lib;
const products = [
  { id: 10, name: 'BIOWAY MIEL SOLIDA 450g', brand: 'BIOWAY', public_price: 5000, member_price: 4500 },
  { id: 11, name: 'BIOWAY MIEL SOLIDA 900g', brand: 'BIOWAY', public_price: 9000, member_price: 8000 },
  { id: 12, name: 'TE VERDE 20u', brand: 'OTRA', public_price: 2200, member_price: 2000 },
];
function buffer(rows, headers = PRICE_LIST_HEADERS) {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([[...headers], ...rows]), 'Lista de precios');
  return XLSX.write(book, { type: 'buffer', bookType: 'xlsx' });
}
function file(rows) { return new File([buffer(rows)], 'lista.xlsx'); }
const row10 = [10, products[0].name, 'BIOWAY', 5000, 4500];
function plan(rows, decisions = [], catalog = products) {
  return planPriceListImport(parsePriceList(buffer(rows)), catalog, decisions, 'lista.xlsx');
}

async function main() {
  assert.equal(plan([[10, 'NOMBRE COMPLETAMENTE CAMBIADO', 'BIOWAY', 5100, 4600]]).rows[0].productId, 10);
  assert.equal(plan([[10, 'NOMBRE COMPLETAMENTE CAMBIADO', 'BIOWAY', 5100, 4600]]).createdProducts, 0);
  assert.equal(plan([row10]).unchangedProducts, 1);
  assert.equal(plan([[12, products[2].name, 'OTRA', 2200, 2000], row10]).rows[1].productId, 10);
  assert.equal(plan([row10]).rows.length, 1, 'Omitted rows must not generate deletes');
  assert.ok(plan([[999, 'Unknown', 'BIOWAY', 1, 1]]).errors.some(error => error.includes('no existe')));
  assert.ok(plan([row10, row10]).errors.some(error => error.includes('repetido')));
  assert.equal(plan([[null, 'JABON DE COCO', 'NUEVA MARCA', 100, 80]]).createdProducts, 1);
  const ambiguous = [null, 'BIOWAY MIEL SOLIDA 450g', 'BIOWAY', 5100, 4600];
  const pending = plan([ambiguous]);
  assert.equal(pending.unresolvedRows, 1);
  assert.equal(pending.createdProducts, 0);
  assert.ok(pending.rows[0].candidates.some(candidate => candidate.id === 10));
  assert.ok(pending.rows[0].candidates.some(candidate => candidate.id === 11));
  assert.equal(plan([ambiguous], [{ rowNumber: 2, productId: 10 }]).updatedProducts, 1);
  assert.equal(plan([ambiguous], [{ rowNumber: 2, productId: 'new' }]).createdProducts, 1);
  assert.ok(plan([ambiguous], [{ rowNumber: 2, productId: 12 }]).errors.length);
  assert.ok(plan([row10], [{ rowNumber: 2, productId: 'new' }]).errors.length);
  assert.ok(plan([row10, ambiguous], [{ rowNumber: 3, productId: 10 }]).errors.some(error => error.includes('repetido')));
  assert.ok(plan([[null, 'JABON', 'NUEVA', 1, 1], [null, 'JABON', 'NUEVA', 1, 1]]).errors.some(error => error.includes('repetido')));
  assert.notEqual(plan([row10]).revision, plan([row10], [], products.map(product => ({ ...product, name: `${product.name} cambiado` }))).revision);
  assert.equal(parsePriceList(buffer([[10, 'Nombre', 'Marca', '$ 1.234,00', '1.000']])).rows[0].publicPrice, 1234);
  for (const value of [-1, 'no', true, 2147483648]) {
    for (const prices of [[value, 1], [1, value]]) {
      const parsed = parsePriceList(buffer([[10, 'Nombre', 'Marca', ...prices]]));
      assert.ok(parsed.errors.some(error => error.startsWith('Fila 2:')), `Reject invalid price ${value}`);
      assert.equal(parsed.rows.length, 1, 'Invalid rows remain visible with their original data');
      assert.equal(parsed.rows[0].rawValues[prices[0]===value?'publicPrice':'memberPrice'],String(value));
      assert.equal(planPriceListImport(parsed,products,[],'invalid.xlsx').rows[0].action,'error');
    }
  }
  for (const value of [1.5, 1.55, '$1.234,50']) {
    for (const prices of [[value, 1], [1, value]]) {
      const parsed = parsePriceList(buffer([[10, 'Nombre', 'Marca', ...prices]]));
      assert.equal(parsed.errors.length, 0, `Accept decimal price ${value}`);
      assert.equal(parsed.rows.length, 1);
    }
  }
  for (const value of [0, '0', '$ 0,00', '']) {
    const parsed = parsePriceList(buffer([[10, 'Nombre', 'Marca', value, value]]));
    assert.equal(parsed.errors.length, 0, `Accept zero/blank price ${value}`);
    assert.equal(parsed.rows[0].publicPrice, 0);
    assert.equal(parsed.rows[0].memberPrice, 0);
  }
  assert.equal(parsePriceList(buffer([[10, 'Nombre', 'Marca', 1, 2147483647]])).errors.length, 0);
  for (const row of [[10,'Nombre\u0000invalido','Marca',1,1],[10,'Nombre','Marca\u0000invalida',1,1]]) {
    assert.ok(parsePriceList(buffer([row])).errors.length);
  }
  assert.ok(parsePriceList(buffer([[10, '', 'Marca', 1, 1]])).errors.length);
  assert.throws(() => parsePriceList(buffer([row10], ['ID', 'Nombre', 'Marca', 'Precio', 'Precio logueado'])));
  assert.throws(() => parsePriceList(buffer([row10], ['ID', 'Nombre', 'Marca', 'Precio publico', 'Precio publico'])));
  assert.throws(() => parseImportDecisions('bad json'));
  assert.throws(() => parseImportDecisions('[{"rowNumber":2,"productId":10},{"rowNumber":2,"productId":11}]'));
  assert.throws(() => parseImportDecisions('[{"rowNumber":2,"productId":-1}]'));
  const formulaBook = XLSX.utils.book_new();
  const formulaSheet = XLSX.utils.aoa_to_sheet([[...PRICE_LIST_HEADERS], row10]);
  formulaSheet.D2 = { t: 'n', f: '1+1', v: 2 };
  XLSX.utils.book_append_sheet(formulaBook, formulaSheet, 'Lista de precios');
  assert.ok(parsePriceList(XLSX.write(formulaBook, { type: 'buffer', bookType: 'xlsx' })).errors.length);
  console.log('OK parsing, ID matching, missing/reordered rows, candidates, decisions, duplicate IDs, prices and formulas');

  const exported = await createPriceListWorkbook(products);
  const parsed = parsePriceList(exported);
  assert.equal(parsed.errors.length, 0);
  assert.equal(planPriceListImport(parsed, products, [], 'export.xlsx').unchangedProducts, products.length);
  const excel = new ExcelJS.Workbook();
  await excel.xlsx.load(exported);
  const sheet = excel.worksheets[0];
  assert.notEqual(sheet.getCell('A2').protection?.locked, false);
  assert.equal(sheet.getCell('B2').protection.locked, false);
  assert.notEqual(sheet.getCell('B1').protection?.locked, false);
  assert.equal(sheet.getColumn(2).protection.locked, false, 'New product names remain editable in blank rows');
  assert.equal(sheet.getColumn(5).protection.locked, false);
  const zip = await JSZip.loadAsync(exported);
  const xml = await zip.file('xl/worksheets/sheet1.xml').async('string');
  assert.match(xml, /sheetProtection[^>]*selectLockedCells="1"/);
  assert.match(xml, /sheetProtection[^>]*autoFilter="0"/);
  assert.match(xml, /sheetProtection[^>]*hashValue=/);
  assert.match(xml, /<formula1>1<\/formula1>/, 'Excel validates the same positive minimum as the server');
  fs.mkdirSync('artifacts/price-list', { recursive: true });
  fs.writeFileSync('artifacts/price-list/lista-protegida.xlsx', exported);
  console.log('OK protected export, editable columns/new rows, filters and exact round trip');

  let viewer = null;
  let called = false;
  let routeError;
  const refreshes = [];
  const routeLoad = modules({
    '@/infrastructure/auth/pintofruta-auth': { getCurrentViewer: async () => viewer },
    '@/infrastructure/db/postgres': { postgresPool: null },
    '@/lib/excel-product-import': { buildExcelImportPlan: async () => { called = true; if(routeError) throw routeError; return plan([row10]); }, applyExcelImport: async () => { called = true; if(routeError) throw routeError; return plan([row10]); } },
    'next/cache': { revalidatePath(path) { refreshes.push(path); } },
  });
  const route = routeLoad('src/app/api/admin/excel-import/route.ts');
  const download = routeLoad('src/app/api/admin/price-list/route.ts');
  for (const user of [null, { authenticated: true, isAdmin: false }]) {
    viewer = user;
    assert.equal((await route.POST(new Request('http://localhost/api/admin/excel-import', { method: 'POST' }))).status, 403);
    assert.equal((await download.GET()).status, 403);
  }
  assert.equal(called, false);
  viewer = { authenticated: true, isAdmin: true };
  const data = new FormData(); data.set('action', 'preview'); data.set('file', file([row10]));
  assert.equal((await route.POST(new Request('http://localhost/api/admin/excel-import', { method: 'POST', body: data }))).status, 200);
  const originalError = console.error;
  try {
    console.error = () => {};
    const {PriceListError} = routeLoad(path.join('src','lib','price-list.ts'));
    for (const [error, status] of [[new PriceListError('Fila 2: precio invalido'),400], ...['55P03','40P01','40001','23503','23505'].map(code=>[Object.assign(new Error('private SQL details'),{code}),409]), [new Error('private connection'),500]]) {
      routeError = error;
      for (const action of ['preview','apply']) {
        const requestData = new FormData(); requestData.set('action',action); requestData.set('file',file([row10]));
        const response = await route.POST(new Request('http://localhost/api/admin/excel-import',{method:'POST',body:requestData}));
        assert.equal(response.status,status);
        const result = await response.json();
        assert.equal(result.ok,false); assert.equal(result.error.includes('private'),false);
      }
    }
    assert.equal(refreshes.length,0,'Failures must not invalidate pages as a successful import');
  } finally { console.error = originalError; routeError = undefined; }
  console.log('OK both endpoints reject anonymous/non-admin requests before accessing files or catalog');

  const queries = [];
  const importProducts = products.map(product=>({...product,detail:'Detalle existente',category_id:1,category_ids:[1],featured_priority:null}));
  let currentProducts = structuredClone(importProducts);
  let currentBrands = [{name:'BIOWAY'},{name:'OTRA'}];
  let validCategories = [{id:1}];
  let failInsert = false;
  const mockClient = {
    async query(sql, params) {
      queries.push({ sql, params });
      if (sql.startsWith('select id, name, brand')) return { rows: currentProducts };
      if (sql === 'select name from brands') return { rows: currentBrands };
      if (sql === 'select id from categories where deleted_at is null') return { rows: validCategories };
      if (sql.startsWith('select id, name from categories')) return { rows: [{ id: 1, name: 'Sin categoria' }] };
      if (sql.includes('max(id)') && sql.includes('from products')) return { rows: [{ id: 101 }] };
      if (sql.startsWith('insert into products') && failInsert) throw new Error('fixture write failure');
      return { rows: [] };
    },
    release() { queries.push({ sql: 'release' }); },
  };
  const persistenceLoad = modules({ '@/infrastructure/db/postgres': { postgresPool: { query: (...args) => mockClient.query(...args), connect: async () => mockClient } } });
  const persistence = persistenceLoad('src/lib/excel-product-import.ts');
  const input = file([[10, 'MIEL RENOMBRADA', 'BIOWAY', 5200, 4700], [null, 'JABON', 'NUEVA', 100, 90]]);
  const preview = await persistence.buildExcelImportPlan(input);
  await persistence.applyExcelImport(input, [], preview.revision);
  assert.ok(queries.findIndex(query => query.sql.startsWith('lock table')) < queries.findIndex(query => query.sql.startsWith('update products')));
  const update = queries.find(query => query.sql.startsWith('update products'));
  assert.ok(!/\b(stock|sold_out|status|image|sku|category_id|detail|presentation)\s*=/.test(update.sql));
  assert.equal(JSON.parse(update.params[0])[0].id, 10);
  const insert = queries.find(query => query.sql.startsWith('insert into products'));
  assert.equal(JSON.parse(insert.params[0])[0].id, 101, 'New IDs are reserved by the database allocator');
  assert.ok(!insert.sql.includes('on conflict'), 'A new row collision must fail instead of overwriting');
  assert.ok(!queries.some(query => /^delete\b/i.test(query.sql)));
  assert.ok(queries.some(query => query.sql === 'commit'));
  currentProducts = importProducts.map(product => ({ ...product, public_price: product.public_price + 1 }));
  queries.length = 0;
  await assert.rejects(() => persistence.applyExcelImport(input, [], preview.revision), /cambiaron/);
  assert.ok(queries.some(query => query.sql === 'rollback'));
  assert.ok(!queries.some(query => query.sql.startsWith('update products') || query.sql.startsWith('insert into')));
  currentProducts = structuredClone(importProducts);
  failInsert = true;
  queries.length = 0;
  await assert.rejects(() => persistence.applyExcelImport(input, [], preview.revision), /fixture write failure/);
  assert.ok(queries.some(query => query.sql === 'rollback'));
  assert.ok(!queries.some(query => query.sql === 'commit'));
  await assert.rejects(() => persistence.applyExcelImport(input, [], ''), /Previsualiza/);
  const pendingFile = file([ambiguous]);
  const pendingPreview = await persistence.buildExcelImportPlan(pendingFile);
  await assert.rejects(() => persistence.applyExcelImport(pendingFile, [], pendingPreview.revision), /No hay cambios validos/);
  console.log('OK transactional writes, preserved fields, locked ID allocation, no deletes, stale previews, unresolved cases and rollback');

  failInsert = false;
  for (const invalid of [{detail:''},{detail:'  '},{detail:'bad\u0000text'}, {category_ids:[],category_id:null}, {category_ids:[999]}, {category_ids:[1,999]}, {category_ids:[1,true]}, {category_ids:'bad JSON'}, {category_id:999}, {featured_priority:1.5}]) {
    currentProducts = importProducts.map(product=>product.id===10?{...product,...invalid}:product);
    const badFile = file([row10,[null,'Nuevo valido','NUEVA',100,90]]);
    const invalidPreview = await persistence.buildExcelImportPlan(badFile);
    assert.equal(invalidPreview.rows[0].action,'error');
    assert.ok(invalidPreview.errors.some(error=>error.includes('Fila 2: Producto #10:') && error.includes('administracion')));
    queries.length = 0;
    await persistence.applyExcelImport(badFile,[],invalidPreview.revision);
    assert.ok(queries.some(query=>query.sql==='commit'));
    assert.ok(!queries.some(query=>query.sql.startsWith('update products')),'An invalid existing row is never updated');
    const inserted = queries.find(query=>query.sql.startsWith('insert into products'));
    assert.equal(JSON.parse(inserted.params[0]).length,1,'The valid new row is still imported');
    assert.equal(invalidPreview.skippedProducts,1);
  }
  currentProducts = structuredClone(importProducts);
  validCategories = [];
  assert.equal((await persistence.buildExcelImportPlan(file([row10]))).rows[0].action,'error','Deleted categories block the import');
  validCategories = [{id:1}];
  currentProducts[0].category_ids = [];
  assert.equal((await persistence.buildExcelImportPlan(file([row10]))).unchangedProducts,1,'Legacy primary category remains valid');
  currentProducts = structuredClone(importProducts);
  const validPreview = await persistence.buildExcelImportPlan(file([row10]));
  currentProducts[0].detail = '';
  queries.length = 0;
  await assert.rejects(()=>persistence.applyExcelImport(file([row10]),[],validPreview.revision),/cambiaron/);
  assert.ok(!queries.some(query=>/^(insert|update|commit)/.test(query.sql)));
  currentProducts = structuredClone(importProducts);
  for (const brands of [[{name:'OTRA'}],[{name:'Bioway'},{name:'OTRA'}]]) {
    currentBrands = brands;
    const syncPreview = await persistence.buildExcelImportPlan(file([row10]));
    assert.equal(syncPreview.updatedProducts,1,'Unchanged product with unregistered/noncanonical brand must be synchronized');
    assert.notEqual(syncPreview.revision,validPreview.revision);
    queries.length = 0;
    await persistence.applyExcelImport(file([row10]),[],syncPreview.revision);
    const brandInsert = queries.find(query=>query.sql.startsWith('insert into brands'));
    assert.equal(Boolean(brandInsert),brands.length===1);
    const update = queries.find(query=>query.sql.startsWith('update products'));
    assert.equal(JSON.parse(update.params[0])[0].brand,brands.length===1?'BIOWAY':'Bioway');
  }
  queries.length = 0;
  const invalidFile = file([[10,'Nombre','Marca',-1,1]]);
  const invalidPreview = await persistence.buildExcelImportPlan(invalidFile);
  queries.length = 0;
  await assert.rejects(()=>persistence.applyExcelImport(invalidFile,[],invalidPreview.revision),/No hay cambios validos/);
  assert.ok(!queries.some(query=>/^(insert|update|commit)/.test(query.sql)),'A file without valid changes never writes');
  currentBrands = [{name:'BIOWAY'},{name:'OTRA'}];
  currentProducts = structuredClone(importProducts);
  const mixed = file([[10,'MIEL RENOMBRADA','BIOWAY',5100,4600],[11,'Invalido','BIOWAY',-1,1],ambiguous,[null,'Jabon prueba','NUEVA',100,90],[12,products[2].name,'OTRA',2200,2000]]);
  const mixedPreview = await persistence.buildExcelImportPlan(mixed);
  assert.equal(mixedPreview.updatedProducts,1); assert.equal(mixedPreview.createdProducts,1);
  assert.equal(mixedPreview.skippedProducts,3); assert.equal(mixedPreview.unresolvedRows,1); assert.equal(mixedPreview.unchangedProducts,1);
  assert.ok(mixedPreview.rows[1].errors.length); assert.equal(mixedPreview.rows[1].rawValues.publicPrice,'-1');
  queries.length = 0;
  await persistence.applyExcelImport(mixed,[],mixedPreview.revision);
  assert.deepEqual(JSON.parse(queries.find(query=>query.sql.startsWith('update products')).params[0]).map(row=>row.id),[10]);
  assert.equal(JSON.parse(queries.find(query=>query.sql.startsWith('insert into products')).params[0]).length,1);
  const repeated = file([row10,[10,'Invalid duplicate','BIOWAY',0,1],[null,'Jabon prueba','NUEVA',100,90]]);
  const repeatedPreview = await persistence.buildExcelImportPlan(repeated);
  assert.equal(repeatedPreview.rows[0].action,'error','An invalid duplicate ID must also exclude the other occurrence');
  assert.equal(repeatedPreview.rows[1].action,'error'); assert.equal(repeatedPreview.createdProducts,1);
  console.log('OK shared validations, original rejected values/reasons, registry synchronization and importing only valid rows alongside invalid, unresolved and unchanged rows');

  if (process.env.PRICE_LIST_TEST_DATABASE_URL) await integration();
  console.log('All price-list tests passed. No application database was modified.');
}

async function integration() {
  const url = new URL(process.env.PRICE_LIST_TEST_DATABASE_URL);
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname), 'Integration tests only accept a local test database');
  const { Client } = require('pg');
  const client = new Client({ connectionString: url.href });
  await client.connect();
  const schemaName = `price_list_test_${randomUUID().replaceAll('-', '')}`;
  try {
    await client.query(`create schema "${schemaName}"`);
    await client.query(`set search_path to "${schemaName}",pg_temp,pg_catalog`);
    // Temporary tables shadow application tables and disappear when this session ends.
    const schema = modules()('src/infrastructure/site-content/schema.ts').siteContentSchemaSql;
    for (const name of ['categories', 'brands', 'products']) {
      const ddl = schema.match(new RegExp(`create table if not exists ${name} \\([\\s\\S]*?\\n  \\);`, 'i'))?.[0];
      assert.ok(ddl, `Find actual schema for ${name}`);
      await client.query(ddl.replace('create table if not exists', 'create temporary table'));
    }
    await client.query("insert into categories(id,name,slug,visible) values(1,'Original','original',true)");
    await client.query("insert into brands(id,code,name,featured,active) values('bioway','bioway','BIOWAY',false,false)");
    await client.query(`insert into products(id,sku,name,detail,presentation,category_id,category_name,brand,vegano,kosher,public_price,member_price,status,sold_out,featured,image,stock)
      values(10,'KEEP-SKU','BIOWAY MIEL SOLIDA 450g','Keep detail','450g',1,'Original','BIOWAY',true,true,5000,4500,'inactive',true,true,'keep-image',null),
      (100,'DELETED','Deleted','Deleted','',1,'Original','BIOWAY',false,false,1,1,'inactive',false,false,null,null)`);
    await client.query('update products set deleted_at=now() where id=100');
    const idAllocator = modules()('src/infrastructure/db/product-ids.ts');
    await idAllocator.ensureProductIdSequence(client);
    await client.query('delete from products where id=100');
    const persistence = modules({ '@/infrastructure/db/postgres': { postgresPool: {
      query: (...args) => client.query(...args), connect: async () => ({ query: (...args) => client.query(...args), release() {} }),
    } } })('src/lib/excel-product-import.ts');
    const input = file([[10, 'Nombre editado', 'BIOWAY', 6000, 5500], [null, 'Nuevo jabon', 'NUEVA', 100, 90]]);
    const preview = await persistence.buildExcelImportPlan(input);
    await persistence.applyExcelImport(input, [], preview.revision);
    const updated = (await client.query('select * from products where id=10')).rows[0];
    assert.equal(updated.name, 'Nombre editado');
    assert.equal(updated.public_price, 6000);
    assert.equal(updated.member_price, 5500);
    assert.equal(updated.sku, 'KEEP-SKU');
    assert.equal(updated.detail, 'Keep detail');
    assert.equal(updated.status, 'inactive');
    assert.equal(updated.sold_out, true);
    assert.equal(updated.featured, true);
    assert.equal(updated.image, 'keep-image');
    assert.equal(updated.category_id, 1);
    assert.equal((await client.query("select active from brands where id='bioway'")).rows[0].active, false);
    const created = (await client.query('select * from products where id=101')).rows[0];
    assert.equal(created.name, 'Nuevo jabon');
    assert.equal(created.sold_out, false);
    assert.equal(created.stock, null);
    assert.equal(created.category_name, 'Sin categoria');
    const {getProductFieldErrors,parseProductCategoryIds} = modules()('src/lib/product-validation.ts');
    for (const product of [updated,created]) {
      assert.deepEqual(getProductFieldErrors({
        name:product.name,detail:product.detail,brand:product.brand,
        categoryIds:parseProductCategoryIds(product.category_ids)?.length?product.category_ids:[product.category_id],
        publicPrice:product.public_price,memberPrice:product.member_price,featuredPriority:product.featured_priority,
      }),{},'Imported products satisfy manual save validation');
      assert.ok((await client.query('select name from brands where name=$1',[product.brand])).rowCount);
    }
    const invalid = file([[10,'No debe guardarse','BIOWAY',0,100],[null,'Tampoco debe guardarse','MARCA INVALIDA',100,90]]);
    const invalidPlan = await persistence.buildExcelImportPlan(invalid);
    assert.ok(invalidPlan.errors.some(error=>error.startsWith('Fila 2:')));
    await persistence.applyExcelImport(invalid,[],invalidPlan.revision);
    assert.equal((await client.query('select name from products where id=10')).rows[0].name,'Nombre editado');
    assert.equal((await client.query("select count(*)::int as count from brands where name='MARCA INVALIDA'")).rows[0].count,1);
    assert.equal((await client.query("select count(*)::int as count from products where name='Tampoco debe guardarse'")).rows[0].count,1,'A valid row is imported even when another row has an invalid price');
    await client.query("delete from products where name='Tampoco debe guardarse'");

    await client.query("update products set detail='' where id=10");
    const badMetadata = file([[10,'Cambio bloqueado','BIOWAY',6100,5500],[null,'Nuevo bloqueado','MARCA BLOQUEADA',100,90]]);
    const metadataPlan = await persistence.buildExcelImportPlan(badMetadata);
    assert.equal(metadataPlan.rows[0].action,'error');
    await persistence.applyExcelImport(badMetadata,[],metadataPlan.revision);
    assert.equal((await client.query('select name from products where id=10')).rows[0].name,'Nombre editado');
    assert.equal((await client.query("select count(*)::int as count from products where name='Nuevo bloqueado'")).rows[0].count,1,'Existing invalid metadata does not block other valid rows');
    await client.query("delete from products where name='Nuevo bloqueado'");
    await client.query("update products set detail='Keep detail' where id=10");

    // Force a database failure after the first update and brand creation: both must roll back.
    await client.query("alter table products add constraint test_write_failure check (name <> 'Fallo controlado')");
    const failure = file([[10,'Cambio a revertir','BIOWAY',6100,5500],[null,'Fallo controlado','MARCA ROLLBACK',100,90]]);
    const failurePlan = await persistence.buildExcelImportPlan(failure);
    assert.equal(failurePlan.errors.length,0);
    await assert.rejects(()=>persistence.applyExcelImport(failure,[],failurePlan.revision),error=>error.code==='23514');
    assert.equal((await client.query('select name from products where id=10')).rows[0].name,'Nombre editado');
    assert.equal((await client.query("select count(*)::int as count from brands where name='MARCA ROLLBACK'")).rows[0].count,0);
    await client.query('alter table products drop constraint test_write_failure');
    await assert.rejects(() => persistence.applyExcelImport(input, [], preview.revision), /cambiaron/);
    assert.equal((await client.query('select count(*)::int as count from products')).rows[0].count, 2);
    await client.query('delete from products where id=101');
    const again = await persistence.buildExcelImportPlan(input);
    await persistence.applyExcelImport(input, [], again.revision);
    const latestId = (await client.query("select id from products where name='Nuevo jabon'")).rows[0].id;
    assert.ok(latestId > 102, 'Deleted IDs and IDs reserved by failed transactions must not be reused');
    const allocator = idAllocator.allocateProductIds;
    const other = new Client({ connectionString: url.href });
    await other.connect();
    try {
      await other.query(`set search_path to "${schemaName}",pg_temp,pg_catalog`);
      await other.query('create temporary table products(id integer)');
      await other.query('insert into products values($1)',[latestId]);
      const allocated = (await Promise.all([allocator(client, 3), allocator(other, 3)])).flat();
      assert.equal(new Set(allocated).size, 6, 'Concurrent callers must reserve distinct IDs');
      assert.ok(allocated.every(id => id > latestId));
    } finally { await other.end(); }
    console.log('OK real PostgreSQL integration, preserved fields, physical deletion without ID reuse and concurrent ID allocation');
  } finally {
    await client.query(`drop schema if exists "${schemaName}" cascade`);
    await client.end();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
