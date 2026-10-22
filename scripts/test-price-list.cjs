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
  for (const value of [-1, 1.5, '$1.234,50', '', 'no', true, 2147483648]) {
    assert.ok(parsePriceList(buffer([[10, 'Nombre', 'Marca', value, 1]])).errors.length, `Reject invalid price ${value}`);
  }
  assert.equal(parsePriceList(buffer([[10, 'Nombre', 'Marca', 0, 0]])).rows[0].publicPrice, 0);
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
  fs.mkdirSync('artifacts/price-list', { recursive: true });
  fs.writeFileSync('artifacts/price-list/lista-protegida.xlsx', exported);
  console.log('OK protected export, editable columns/new rows, filters and exact round trip');

  let viewer = null;
  let called = false;
  const routeLoad = modules({
    '@/infrastructure/auth/pintofruta-auth': { getCurrentViewer: async () => viewer },
    '@/infrastructure/db/postgres': { postgresPool: null },
    '@/lib/excel-product-import': { buildExcelImportPlan: async () => { called = true; return plan([row10]); }, applyExcelImport: async () => { called = true; return plan([row10]); } },
    'next/cache': { revalidatePath() {} },
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
  console.log('OK both endpoints reject anonymous/non-admin requests before accessing files or catalog');

  const queries = [];
  let currentProducts = structuredClone(products);
  let failInsert = false;
  const mockClient = {
    async query(sql, params) {
      queries.push({ sql, params });
      if (sql.startsWith('select id, name, brand')) return { rows: currentProducts };
      if (sql === 'select name from brands') return { rows: [{ name: 'BIOWAY' }, { name: 'OTRA' }] };
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
  currentProducts = products.map(product => ({ ...product, public_price: product.public_price + 1 }));
  queries.length = 0;
  await assert.rejects(() => persistence.applyExcelImport(input, [], preview.revision), /cambiaron/);
  assert.ok(queries.some(query => query.sql === 'rollback'));
  assert.ok(!queries.some(query => query.sql.startsWith('update products') || query.sql.startsWith('insert into')));
  currentProducts = structuredClone(products);
  failInsert = true;
  queries.length = 0;
  await assert.rejects(() => persistence.applyExcelImport(input, [], preview.revision), /fixture write failure/);
  assert.ok(queries.some(query => query.sql === 'rollback'));
  assert.ok(!queries.some(query => query.sql === 'commit'));
  await assert.rejects(() => persistence.applyExcelImport(input, [], ''), /Previsualiza/);
  const pendingFile = file([ambiguous]);
  const pendingPreview = await persistence.buildExcelImportPlan(pendingFile);
  await assert.rejects(() => persistence.applyExcelImport(pendingFile, [], pendingPreview.revision), /pendientes/);
  console.log('OK transactional writes, preserved fields, locked ID allocation, no deletes, stale previews, unresolved cases and rollback');

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
    await assert.rejects(() => persistence.applyExcelImport(input, [], preview.revision), /cambiaron/);
    assert.equal((await client.query('select count(*)::int as count from products')).rows[0].count, 2);
    await client.query('delete from products where id=101');
    const again = await persistence.buildExcelImportPlan(input);
    await persistence.applyExcelImport(input, [], again.revision);
    assert.equal((await client.query("select id from products where name='Nuevo jabon'")).rows[0].id, 102, 'Deleted IDs must not be reused');
    const allocator = idAllocator.allocateProductIds;
    const other = new Client({ connectionString: url.href });
    await other.connect();
    try {
      await other.query(`set search_path to "${schemaName}",pg_temp,pg_catalog`);
      await other.query('create temporary table products(id integer)');
      await other.query('insert into products values(102)');
      const allocated = (await Promise.all([allocator(client, 3), allocator(other, 3)])).flat();
      assert.equal(new Set(allocated).size, 6, 'Concurrent callers must reserve distinct IDs');
      assert.ok(allocated.every(id => id > 102));
    } finally { await other.end(); }
    console.log('OK real PostgreSQL integration, preserved fields, physical deletion without ID reuse and concurrent ID allocation');
  } finally {
    await client.query(`drop schema if exists "${schemaName}" cascade`);
    await client.end();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
