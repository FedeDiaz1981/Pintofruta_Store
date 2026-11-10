const assert = require('node:assert/strict');
const { modules } = require('./test-hero-links.cjs');

const valid = { name:'Producto de prueba',detail:'Detalle de prueba',brand:'Marca',categoryIds:'[1]',publicPrice:'1500',memberPrice:'1200' };

function actionFixture(options = {}) {
  const calls = { queries:[], writes:[], allocations:0, refreshes:[] };
  const query = async (sql,values) => {
    calls.queries.push({sql,values});
    if(sql==='schema' && options.offline) throw new Error('private database error');
    if(sql.includes('from products')) return {rows:options.missingProduct?[]:[{sku:'PF0007',status:'published',image:'keep-image',featured_priority:null}]};
    if(sql.includes('select id, name from categories')) return {rows:options.categories??[{id:1,name:'Natural'}]};
    if(sql.startsWith('select name from brands')) return {rows:options.missingBrand?[]:[{name:'Marca'}]};
    if(sql.includes('insert into products')) {
      if(options.writeCode) throw Object.assign(new Error('private SQL error'),{code:options.writeCode});
      calls.writes.push({sql,values});
    }
    return {rows:[]};
  };
  const actions=modules({
    '@/infrastructure/db/postgres':{postgresPool:{query}},
    '@/infrastructure/site-content/schema':{siteContentSchemaSql:'schema'},
    '@/infrastructure/db/product-ids':{allocateProductIds:async()=>{calls.allocations++;return[101]},ensureProductIdSequence:async()=>{}},
    '@/infrastructure/auth/pintofruta-auth':{requireAdminViewer:async()=>{if(options.unauthorized)throw new Error('No autorizado')},createSupabaseServiceClient(){}},
    'next/cache':{revalidatePath:path=>calls.refreshes.push(path)},
  })('src/app/admin/actions.ts');
  return {calls,save:async record=>{
    const data=new FormData();data.set('table','products');data.set('payload_json',typeof record==='string'?record:JSON.stringify(record));
    return actions.saveAdminRecord(data);
  }};
}

async function main() {
  const load=modules();
  const {getProductFieldErrors,parseProductCategoryIds,PRODUCT_REQUIRED_FIELDS}=load('src/lib/product-validation.ts');
  assert.deepEqual(getProductFieldErrors(valid),{});
  for(const field of PRODUCT_REQUIRED_FIELDS) for(const value of [undefined,null,'','   ']) {
    assert.ok(getProductFieldErrors({...valid,[field]:value})[field],`${field}: ${String(value)}`);
    const fixture=actionFixture();const result=await fixture.save({...valid,[field]:value});
    assert.equal(result.ok,false);assert.ok(result.errors[field]);assert.equal(fixture.calls.queries.length,0);assert.equal(fixture.calls.allocations,0);
  }
  for(const key of ['name','detail','brand']) for(const value of [1,true,[],{},'bad\u0000text']) assert.ok(getProductFieldErrors({...valid,[key]:value})[key]);
  assert.deepEqual(getProductFieldErrors({publicPrice:1},['publicPrice']),{});
  assert.deepEqual(getProductFieldErrors({publicPrice:0},['publicPrice']),{});
  assert.deepEqual(getProductFieldErrors({memberPrice:''},['memberPrice']),{});
  for(const key of ['publicPrice','memberPrice']) for(const value of [-1,'NaN','Infinity',Infinity,NaN,2147483648,true,{},[]]) {
    assert.ok(getProductFieldErrors({...valid,[key]:value})[key],`${key}: ${String(value)}`);
  }
  for(const key of ['publicPrice','memberPrice']) for(const value of [1.5,1.55,'1,50']) {
    assert.deepEqual(getProductFieldErrors({...valid,[key]:value})[key],undefined,`${key}: ${String(value)}`);
  }
  assert.deepEqual(getProductFieldErrors({...valid,publicPrice:1,memberPrice:2147483647}),{});
  assert.deepEqual(getProductFieldErrors({...valid,featuredPriority:-5}),{});
  for(const value of [1.2,2147483648,-2147483649,'abc']) assert.ok(getProductFieldErrors({...valid,featuredPriority:value}).featuredPriority);
  for(const value of [[], '[0]', '[-1]', '[1.5]', '[2147483648]', '[true]', 'bad JSON', '{}', '1']) assert.ok(getProductFieldErrors({...valid,categoryIds:value}).categoryIds);
  assert.deepEqual(parseProductCategoryIds('["2",1,2]'),[2,1]);
  for(const payload of ['null','[]','"string"','{bad']) {
    const fixture=actionFixture();assert.equal((await fixture.save(payload)).ok,false);assert.equal(fixture.calls.queries.length,0);
  }
  console.log('OK required text, whitespace-only values, positive decimal price bounds, optional priority, category arrays and malformed payloads; invalid input rejected before DB access.');

  const content={products:[],brands:[],categories:[],users:[],heroSlides:[],banners:[],packs:[]};
  const table=load('src/application/admin-crud.ts').getAdminTableDefinitions(content).find(table=>table.key==='products');
  for(const key of PRODUCT_REQUIRED_FIELDS) assert.equal(table.fields.find(field=>field.key===key).required,true,key);
  for(const key of ['publicPrice','memberPrice']) assert.equal(table.fields.find(field=>field.key===key).required,false,key);
  assert.equal(table.fields.find(field=>field.key==='image').required,false);

  for(const [options,payload,field] of [
    [{missingBrand:true},valid,'brand'],
    [{categories:[]},valid,'categoryIds'],
    [{categories:[{id:1,name:'Natural'}]},{...valid,categoryIds:'[1,2]'},'categoryIds'],
  ]) {
    const fixture=actionFixture(options);const result=await fixture.save(payload);
    assert.equal(result.ok,false);assert.ok(result.errors[field]);assert.equal(fixture.calls.writes.length,0);assert.equal(fixture.calls.allocations,0);
  }
  for(const id of [0,-1,1.5,'abc',2147483648]) {
    const fixture=actionFixture();assert.equal((await fixture.save({...valid,id})).ok,false);assert.equal(fixture.calls.writes.length,0);
  }
  const missing=actionFixture({missingProduct:true});
  assert.equal((await missing.save({...valid,id:7})).ok,false);assert.equal(missing.calls.writes.length,0);
  const cleared=actionFixture();
  assert.equal((await cleared.save({...valid,id:7,categoryIds:[]})).ok,false);assert.equal(cleared.calls.queries.length,0,'Editing cannot silently restore cleared categories');

  const created=actionFixture();
  assert.deepEqual(await created.save({...valid,name:'  Producto  ',detail:' Detalle ',brand:' Marca '}),{ok:true});
  const inserted=created.calls.writes[0].values;
  assert.equal(inserted[0],101);assert.equal(inserted[1],'PF0101');assert.equal(inserted[2],'Producto');assert.equal(inserted[3],'Detalle');
  assert.equal(inserted[9],'Marca');assert.equal(inserted[13],1500);assert.equal(inserted[14],1200);assert.equal(inserted[15],null);
  assert.equal(created.calls.allocations,1);assert.ok(created.calls.refreshes.includes('/admin'));
  const edited=actionFixture();assert.deepEqual(await edited.save({...valid,id:7}),{ok:true});
  assert.equal(edited.calls.writes[0].values[0],7);assert.equal(edited.calls.writes[0].values[1],'PF0007');assert.equal(edited.calls.writes[0].values[15],'keep-image');
  assert.equal(edited.calls.allocations,0);
  assert.match(edited.calls.queries.find(query=>query.sql.includes('from products')).sql,/deleted_at is null/);
  console.log('OK registered brands/all category IDs, deleted/stale products, auto-generated ID/SKU, optional image and successful create/edit persistence.');

  const unauthorized=actionFixture({unauthorized:true});
  await assert.rejects(()=>unauthorized.save(valid),/No autorizado/);assert.equal(unauthorized.calls.queries.length,0);
  for(const options of [{offline:true},{writeCode:'23503'},{writeCode:'23505'},{writeCode:'XX000'}]) {
    const fixture=actionFixture(options);const result=await fixture.save(valid);
    assert.equal(result.ok,false);assert.equal(fixture.calls.writes.length,0);assert.equal(fixture.calls.refreshes.length,0);
    assert.equal(JSON.stringify(result).includes('private'),false);
  }
  console.log('OK authorization, connection failures, foreign-key/duplicate errors and safe structured responses; no real application database modified.');
}
module.exports={valid,actionFixture};
if(require.main===module) main().catch(error=>{console.error(error);process.exitCode=1});
