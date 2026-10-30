const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function modules(mocks = {}) {
  const cache = new Map();
  function load(file) {
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} };
    cache.set(file, module);
    const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText;
    const resolve = id => id in mocks ? mocks[id] : id.startsWith('@/') ? load(path.join('src', `${id.slice(2)}.ts`)) : require(id);
    new Function('require', 'module', 'exports', source)(resolve, module, module.exports);
    return module.exports;
  }
  return load;
}

const products = [
  { id: 1, sku: 'A1', name: 'Aceite de coco', brand: 'Marca A', status: 'published', soldOut: false, stock: 0 },
  { id: 2, sku: 'B2', name: 'Te verde', brand: 'Marca B', status: 'inactive', soldOut: true, stock: 500 },
  { id: 3, sku: 'C3', name: 'Miel', brand: 'Marca A', status: 'published', soldOut: true, stock: 100 },
  { id: 4, sku: 'D4', name: 'Jabon', brand: 'Marca C', status: 'inactive', soldOut: false, stock: 0 },
];

function actionModules(query, authorized = true, revalidated = []) {
  return modules({
    '@/infrastructure/auth/pintofruta-auth': { requireAdminViewer: async () => { if (!authorized) throw new Error('No autorizado.'); }, createSupabaseServiceClient() {} },
    '@/infrastructure/db/postgres': { postgresPool: { query } },
    '@/infrastructure/site-content/schema': { siteContentSchemaSql: '' },
    'next/cache': { revalidatePath: (...args) => revalidated.push(args) },
  })('src/app/admin/actions.ts');
}

async function main() {
  const load = modules();
  const { filterProductAvailability, isProductActive } = load('src/lib/product-availability.ts');
  const filter = (availability = 'all', visibility = 'all', query = '') => filterProductAvailability(products, query, availability, visibility).map(product => product.id);
  assert.deepEqual(filter(), [1, 2, 3, 4]);
  assert.deepEqual(filter('sold-out'), [2, 3]);
  assert.deepEqual(filter('available'), [1, 4], 'Availability does not use stock quantities');
  assert.deepEqual(filter('all', 'inactive'), [2, 4]);
  assert.deepEqual(filter('all', 'active'), [1, 3], 'Active scope must match the administration overview');
  assert.deepEqual(filter('sold-out', 'active'), [3]);
  assert.deepEqual(filter('available', 'inactive'), [4]);
  assert.deepEqual(filter('all', 'all', 'COCO'), [1]);
  assert.deepEqual(filter('all', 'all', 't\u00e9 verde'), [2]);
  assert.deepEqual(filter('all', 'all', 'B2'), [2]);
  assert.deepEqual(filter('all', 'all', '4'), [4]);
  assert.deepEqual(filter('all', 'all', 'Marca A'), [1, 2, 3, 4], 'Each partial term can match anywhere, including the brand');
  assert.deepEqual(filter('all', 'all', 'marca coco'), [1], 'Terms can be split between brand and name');
  assert.equal(isProductActive({ status: 'draft' }), false);
  for (const [visibility, query, expected] of [
    ['active', '', [2, 1, 1]],
    ['inactive', '', [2, 1, 1]],
    ['all', '', [4, 2, 2]],
    ['active', 'coco', [1, 0, 1]],
    ['inactive', 'Marca C', [2, 1, 1]],
    ['all', 'sin resultados', [0, 0, 0]],
  ]) {
    const scope = filterProductAvailability(products, query, 'all', visibility);
    const soldOut = filterProductAvailability(scope, '', 'sold-out', 'all');
    const available = filterProductAvailability(scope, '', 'available', 'all');
    assert.deepEqual([scope.length, soldOut.length, available.length], expected, 'Tab counts must share the selected visibility and search scope');
    assert.equal(soldOut.length + available.length, scope.length);
  }
  const deactivated = products.map(product => product.id === 1 ? { ...product, status: 'inactive' } : product);
  assert.equal(filterProductAvailability(deactivated, '', 'all', 'active').length, 1);
  assert.equal(filterProductAvailability(deactivated, '', 'all', 'inactive').length, 3);
  const content = { products, brands: [], categories: [], users: [], heroSlides: [], banners: [], packs: [] };
  const viewModel = load('src/application/admin-crud.ts').buildAdminCrudViewModel(content, { counts: {} });
  const adminProducts = viewModel.tables.find(table => table.key === 'products').rows;
  assert.equal(adminProducts.length, 4, 'Administration must retain inactive products for reactivation');
  assert.deepEqual(adminProducts.filter(product => product.active === false).map(product => product.id), [2, 4]);
  assert.equal(viewModel.productAvailabilityRows.length, 4);
  assert.deepEqual(viewModel.productSelectionRows.map(product => product.id).sort(), [1, 3]);
  const catalog = modules({
    '@/infrastructure/site-content.repository': { getSiteContent: async () => content },
    '@/infrastructure/db/postgres': { postgresPool: null },
  })('src/application/catalog.ts');
  assert.equal(await catalog.getProductBySku('B2'), null, 'Inactive products cannot be viewed through their direct URL');
  assert.equal((await catalog.getProductBySku('C3')).soldOut, true, 'Sold-out published products remain visible');
  assert.deepEqual((await catalog.searchCatalog()).map(product => product.id), [1, 3]);
  console.log('OK all products including inactive, independent stock flag, combined filters, search, existing selectors and public visibility');

  const queries = [];
  const revalidated = [];
  let current = { id: 1, status: 'inactive', sold_out: true };
  const query = async (sql, params) => {
    queries.push({ sql, params });
    if (!sql) return { rows: [] };
    if (params[1] === 999) return { rows: [] };
    if (sql.includes('set status')) current = { ...current, status: params[0] };
    if (sql.includes('set sold_out')) current = { ...current, sold_out: params[0] };
    return { rows: [{ ...current }] };
  };
  const actions = actionModules(query, true, revalidated);
  assert.deepEqual(await actions.setProductSoldOut(1, false), { id: 1, status: 'inactive', soldOut: false });
  assert.deepEqual(await actions.setProductActive(1, true), { id: 1, status: 'published', soldOut: false });
  assert.deepEqual(await actions.setProductSoldOut(1, true), { id: 1, status: 'published', soldOut: true });
  assert.deepEqual(await actions.setProductActive(1, false), { id: 1, status: 'inactive', soldOut: true });
  for (const { sql } of queries.filter(query => query.sql)) {
    assert.match(sql, /where id = \$2 and deleted_at is null returning id, status, sold_out/);
    assert.doesNotMatch(sql, /\bstock\s*=/);
    assert.ok(!(sql.includes('set status') && sql.includes('set sold_out')));
  }
  const count = queries.length;
  await assert.rejects(() => actions.setProductActive(0, true), /inv/);
  await assert.rejects(() => actions.setProductSoldOut(1, 'false'), /inv/);
  await assert.rejects(() => actions.setProductActive(1, 'false'), /inv/);
  assert.equal(queries.length, count, 'Invalid inputs must not access the database');
  await assert.rejects(() => actionModules(query, false).setProductActive(1, true), /autorizado/);
  await assert.rejects(() => actionModules(query, false).setProductSoldOut(1, true), /autorizado/);
  assert.equal(queries.length, count);
  const before = revalidated.length;
  await assert.rejects(() => actions.setProductActive(999, true), /no existe/);
  assert.equal(revalidated.length, before, 'Missing rows must not report success');
  for (const route of ['/admin', '/', '/galeria', '/busqueda', '/carrito', '/producto/[sku]']) assert.ok(revalidated.some(args => args[0] === route));
  await assert.rejects(() => actionModules(async () => { throw new Error('database unavailable'); }).setProductActive(1, false), /database unavailable/);
  console.log('OK server authorization, boolean validation, missing/deleted products, isolated flag updates, errors and revalidation');
  if (process.env.PRODUCT_AVAILABILITY_TEST_DATABASE_URL) await integration();
  console.log('Product availability tests passed; no application data was changed.');
}

async function integration() {
  const url = new URL(process.env.PRODUCT_AVAILABILITY_TEST_DATABASE_URL);
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname));
  const { Client } = require('pg');
  const client = new Client({ connectionString: url.href });
  await client.connect();
  try {
    await client.query(`create temporary table products(id integer primary key, status text, sold_out boolean, stock integer,
      deleted_at timestamptz, updated_at timestamptz, image text, public_price integer)`);
    await client.query("insert into products values(1,'inactive',true,0,null,now(),'keep-image',100), (2,'published',false,500,now(),now(),'keep-deleted',200)");
    const actions = actionModules((...args) => client.query(...args));
    await actions.setProductSoldOut(1, false);
    let row = (await client.query('select * from products where id=1')).rows[0];
    assert.equal(row.status, 'inactive'); assert.equal(row.sold_out, false); assert.equal(row.stock, 0);
    await actions.setProductActive(1, true);
    await actions.setProductSoldOut(1, true);
    await actions.setProductActive(1, false);
    row = (await client.query('select * from products where id=1')).rows[0];
    assert.equal(row.status, 'inactive'); assert.equal(row.sold_out, true); assert.equal(row.stock, 0);
    assert.equal(row.image, 'keep-image'); assert.equal(row.public_price, 100);
    await assert.rejects(() => actions.setProductActive(2, false), /no existe/);
    await assert.rejects(() => actions.setProductSoldOut(2, true), /no existe/);
    const deleted = (await client.query('select * from products where id=2')).rows[0];
    assert.equal(deleted.status, 'published'); assert.equal(deleted.sold_out, false);
    console.log('OK real PostgreSQL flag toggles and deleted-row protection in session-only temporary tables');
  } finally { await client.end(); }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
