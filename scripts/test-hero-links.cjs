const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

function modules(mocks = {}) {
  const cache = new Map();
  function load(input) {
    const file = path.resolve(input);
    if (cache.has(file)) return cache.get(file).exports;
    const result = { exports: {} };
    cache.set(file, result);
    const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText;
    const resolve = id => {
      if (id in mocks) return mocks[id];
      if (id.endsWith('.css')) return new Proxy({}, { get: (_, key) => key === '__esModule' ? false : String(key) });
      if (!id.startsWith('@/') && !id.startsWith('.')) return require(id);
      const base = id.startsWith('@/') ? path.resolve('src', id.slice(2)) : path.resolve(path.dirname(file), id);
      if (id.endsWith('.json')) return require(base);
      return load(fs.existsSync(base+'.ts') ? base+'.ts' : base+'.tsx');
    };
    new Function('require', 'module', 'exports', source)(resolve, result, result.exports);
    return result.exports;
  }
  return load;
}

const heroFixture = { id:7, order:1, title:'Catalogo', subtitle:'Nuestros productos', badge:'Catalogo',
  image:'/assets/images/logo/logo-Pintofruta.png', link:'/galeria?featured=1', imageLink:'/producto/prueba', active:true };
const productFixture = { id:21, sku:'BANNER-21', name:'Miel de prueba', detail:'Miel', presentation:'450 g', categoryId:1,
  categoryName:'Natural', brand:'Prueba', publicPrice:5000, memberPrice:4000, status:'published', soldOut:false,
  featured:false, vegano:false, kosher:false, image:heroFixture.image };

function actions(query, authorized = true, revalidated = []) {
  return modules({
    '@/infrastructure/db/postgres': { postgresPool:{ query } },
    '@/infrastructure/auth/pintofruta-auth': { requireAdminViewer:async()=>{ if (!authorized) throw new Error('No autorizado'); }, createSupabaseServiceClient(){} },
    '@/infrastructure/site-content/schema': { siteContentSchemaSql:'' },
    'next/cache': { revalidatePath:(...args)=>revalidated.push(args) },
  })('src/app/admin/actions.ts');
}

function form(imageLink, extra = {}) {
  const data = new FormData();
  data.set('table','hero_slides');
  data.set('payload_json',JSON.stringify({ ...heroFixture, imageLink, ...extra }));
  return data;
}

async function main() {
  const load = modules();
  const { resolveHeroImageHref } = load('src/lib/hero-links.ts');
  for (const [value,expected] of [
    [undefined,null],[null,null],[' ',null],['/producto/prueba','/producto/prueba'],['galeria?type=packs','/galeria?type=packs'],
    [' /galeria.html?featured=1 ','/galeria?featured=1'],['busqueda.html?q=miel','/busqueda?q=miel'],
    ['https://example.com/promo?a=1#oferta','https://example.com/promo?a=1#oferta'],['http://example.com','http://example.com/'],
    ['https://example.com/galeria.html','https://example.com/galeria.html'],
    ['javascript:alert(1)',null],['JaVaScRiPt:alert(1)',null],['data:text/html,test',null],['mailto:test@example.com',null],
    ['//example.com',null],['\\\\example.com',null],['https://',null],['https:example.com',null],['java\nscript:alert(1)',null],
  ]) assert.equal(resolveHeroImageHref(value),expected,String(value));

  const { BannerImageLink } = load('src/components/site/banner-image-link.tsx');
  const renderImage = imageLink => renderToStaticMarkup(React.createElement(BannerImageLink,{slide:{...heroFixture,imageLink}},React.createElement('img',{src:heroFixture.image,alt:'Producto'})));
  assert.match(renderImage('/producto/prueba'),/href="\/producto\/prueba"/);
  assert.match(renderImage('https://example.com/promo'),/href="https:\/\/example.com\/promo"/);
  for (const value of [undefined,'','javascript:alert(1)']) assert.doesNotMatch(renderImage(value),/<a\b/);
  const { HeroCarousel } = load('src/components/site/hero-carousel.tsx');
  const { SpotlightBanner } = load('src/components/site/spotlight-banner.tsx');
  const hero = renderToStaticMarkup(React.createElement(HeroCarousel,{slides:[heroFixture]}));
  assert.equal((hero.match(/href="\/producto\/prueba"/g)||[]).length,2,'Both mobile and desktop images have an independent URL');
  assert.equal((hero.match(/href="\/galeria\?featured=1"/g)||[]).length,2,'The original button destinations are preserved');
  const spotlight = renderToStaticMarkup(React.createElement(SpotlightBanner,{slide:heroFixture}));
  assert.match(spotlight,/href="\/producto\/prueba"/);
  assert.match(spotlight,/href="\/galeria\?featured=1"/);
  assert.equal((spotlight.match(/href="\/producto\/prueba"/g)||[]).length,2,'Mobile and desktop spotlight keep the independent image URL');
  assert.equal((spotlight.match(/href="\/galeria\?featured=1"/g)||[]).length,2,'Mobile and desktop spotlight preserve the button destination');
  assert.equal(renderToStaticMarkup(React.createElement(SpotlightBanner,{slide:null})), '');
  const productSlide = {...heroFixture,imageAction:'product',imageProductId:21,imageProduct:productFixture};
  const productHero = renderToStaticMarkup(React.createElement(HeroCarousel,{slides:[productSlide]}));
  assert.equal((productHero.match(/aria-haspopup="dialog"/g)||[]).length,2);
  assert.doesNotMatch(productHero,/href="\/producto\/prueba"/,'Product mode must not follow the stale image URL');
  assert.equal((productHero.match(/href="\/galeria\?featured=1"/g)||[]).length,2);
  for(const product of [undefined,{...productFixture,status:'inactive'},{...productFixture,soldOut:true},{...productFixture,id:22}]) {
    const html=renderToStaticMarkup(React.createElement(BannerImageLink,{slide:{...productSlide,imageProduct:product}},React.createElement('img',{alt:'Producto'})));
    assert.match(html,/disabled=""/);
    assert.doesNotMatch(html,/<a\b/);
  }
  console.log('OK internal/external URLs, legacy route normalization, unsafe scheme rejection and optional images; independent links in mobile, desktop and spotlight.');

  const heroRow = { id:7,order_index:1,title:'Catalogo',subtitle:'Nuestros productos',badge:'Catalogo',image:heroFixture.image,image_mobile:null,
    link:heroFixture.link,image_link:heroFixture.imageLink,image_action:'product',image_product_id:21,active:true,home_spotlight:true };
  const mapped = load('src/infrastructure/site-content/mappers.ts').mapSiteContentDocument({ heroSlides:[heroRow],products:[],brands:[],categories:[],users:[],banners:[] });
  assert.equal(mapped.heroSlides[0].imageLink,heroFixture.imageLink);
  assert.equal(mapped.heroSlides[0].imageAction,'product');
  assert.equal(mapped.heroSlides[0].imageProductId,21);
  const table = load('src/application/admin-crud.ts').getAdminTableDefinitions(mapped).find(table=>table.key==='hero_slides');
  assert.equal(table.fields.find(field=>field.key==='imageLink').required,false);
  assert.equal(table.fields.find(field=>field.key==='link').label,'Enlace del bot\u00f3n');
  assert.equal(table.fields.find(field=>field.key==='imageAction').kind,'hero_image_action');
  assert.equal(table.fields.find(field=>field.key==='imageProductId').hidden,true);
  for(const product of [productFixture,{...productFixture,status:'inactive'},{...productFixture,soldOut:true},undefined]) {
    const home=modules({ '@/infrastructure/site-content.repository':{getSiteContent:async()=>({...mapped,products:product?[product]:[]})} })('src/application/catalog.ts');
    const model=await home.getHomePageViewModel();
    assert.deepEqual(model.heroSlides[0].imageProduct,product?.status==='published'&&!product.soldOut?product:undefined);
    assert.deepEqual(model.spotlightSlide.imageProduct,model.heroSlides[0].imageProduct);
  }
  const repository = modules({
    react:{...React,cache:fn=>fn},
    '@/infrastructure/site-content/schema': { siteContentSchemaSql:'schema' },
    '@/infrastructure/db/postgres': { postgresPool:{query:async sql=>{
      if (sql.includes('from hero_slides')) { assert.match(sql,/image_link/); return {rows:[heroRow]}; }
      return {rows:[]};
    }} },
  })('src/infrastructure/site-content.repository.ts');
  assert.equal((await repository.getSiteContent()).heroSlides[0].imageLink,heroFixture.imageLink);
  const queries=[];
  const revalidated=[];
  const save=actions(async(sql,values)=>{queries.push({sql,values});return{rows:[]};},true,revalidated);
  await save.saveAdminRecord(form('/producto/prueba'));
  let query=queries.find(query=>query.sql.includes('insert into hero_slides'));
  assert.match(query.sql,/image_link = excluded.image_link/);
  assert.equal(query.values[7],heroFixture.link);
  assert.equal(query.values[8],heroFixture.imageLink);
  queries.length=0;
  await save.saveAdminRecord(form(''));
  query=queries.find(query=>query.sql.includes('insert into hero_slides'));
  assert.equal(query.values[8],null,'Clearing the optional URL removes only the image link');
  queries.length=0;
  await assert.rejects(()=>save.saveAdminRecord(form('javascript:alert(1)')),/http\/https/);
  assert.equal(queries.some(query=>query.sql.includes('insert into hero_slides')),false);
  await assert.rejects(()=>actions(async()=>{throw new Error('Must not access DB');},false).saveAdminRecord(form('/producto/prueba')),/No autorizado/);
  assert.ok(revalidated.some(args=>args[0]==='/'));
  const productQueries=[];
  const saveProduct=actions(async(sql,values)=>{productQueries.push({sql,values});return{rows:sql.startsWith('select id from products')?[{id:21}]:[]};});
  await saveProduct.saveAdminRecord(form('javascript:ignored',{imageAction:'product',imageProductId:21}));
  query=productQueries.find(query=>query.sql.includes('insert into hero_slides'));
  assert.equal(query.values[8],null);assert.equal(query.values[11],'product');assert.equal(query.values[12],21);
  assert.equal(query.values[7],heroFixture.link);
  assert.match(productQueries.find(query=>query.sql.startsWith('select id from products')).sql,/deleted_at is null.*sold_out/);
  for(const id of [undefined,'',0,-1,'21abc',2.5,2147483648]) await assert.rejects(()=>saveProduct.saveAdminRecord(form('',{imageAction:'product',imageProductId:id})),/Seleccion/);
  await assert.rejects(()=>saveProduct.saveAdminRecord(form('',{imageAction:'invalid'})),/v.lida/);
  await assert.rejects(()=>actions(async()=>({rows:[]})).saveAdminRecord(form('',{imageAction:'product',imageProductId:21})),/disponible/);
  console.log('OK product-mode persistence, required/valid/available product checks, no URL fallback, hidden/sold-out products excluded, independent button links.');
  console.log('OK administration field, repository mapping/read, authorized persistence, clearing the URL and revalidation.');
  if (process.env.HERO_LINKS_TEST_DATABASE_URL) await integration(load);
}

async function integration(load) {
  const url = new URL(process.env.HERO_LINKS_TEST_DATABASE_URL);
  assert.ok(['localhost','127.0.0.1','[::1]'].includes(url.hostname));
  const { Client }=require('pg');
  const client=new Client({connectionString:url.href});
  await client.connect();
  try {
    await client.query('create temporary table hero_slides(id integer primary key,order_index integer,title text,subtitle text,badge text,image text,image_mobile text,link text,active boolean,home_spotlight boolean)');
    const schema=load('src/infrastructure/site-content/schema.ts').siteContentSchemaSql;
    const migration=schema.split('\n').filter(line=>line.includes('alter table hero_slides add column if not exists')).join('\n');
    assert.ok(migration);
    await client.query(migration);
    await client.query(migration);
    const save=actions((sql,params)=>sql?client.query(sql,params):Promise.resolve({rows:[]}));
    await save.saveAdminRecord(form('/producto/prueba'));
    let row=(await client.query('select * from hero_slides where id=7')).rows[0];
    assert.equal(row.image_link,heroFixture.imageLink);assert.equal(row.link,heroFixture.link);
    await save.saveAdminRecord(form('https://example.com/oferta'));
    row=(await client.query('select * from hero_slides where id=7')).rows[0];
    assert.equal(row.image_link,'https://example.com/oferta');assert.equal(row.link,heroFixture.link);
    await save.saveAdminRecord(form(''));
    row=(await client.query('select * from hero_slides where id=7')).rows[0];
    assert.equal(row.image_link,null);assert.equal(row.link,heroFixture.link);
    assert.equal((await client.query('select count(*)::int as n from hero_slides')).rows[0].n,1);
    await client.query("create temporary table products(id integer primary key,status text,sold_out boolean,deleted_at timestamptz); insert into products values(21,'published',false,null)");
    await save.saveAdminRecord(form('',{imageAction:'product',imageProductId:21}));
    row=(await client.query('select * from hero_slides where id=7')).rows[0];
    assert.equal(row.image_action,'product');assert.equal(row.image_product_id,21);assert.equal(row.image_link,null);
    await client.query('update products set sold_out=true where id=21');
    await assert.rejects(()=>save.saveAdminRecord(form('',{imageAction:'product',imageProductId:21})),/disponible/);
    await client.query("update products set sold_out=false,status='inactive' where id=21");
    await assert.rejects(()=>save.saveAdminRecord(form('',{imageAction:'product',imageProductId:21})),/disponible/);
    await client.query("update products set status='published',deleted_at=now() where id=21");
    await assert.rejects(()=>save.saveAdminRecord(form('',{imageAction:'product',imageProductId:21})),/disponible/);
    await save.saveAdminRecord(form('https://example.com/oferta',{imageAction:'url',imageProductId:21}));
    row=(await client.query('select * from hero_slides where id=7')).rows[0];
    assert.equal(row.image_action,'url');assert.equal(row.image_product_id,null);assert.equal(row.image_link,'https://example.com/oferta');
    console.log('OK PostgreSQL migration is repeatable; create/update/clear in temporary tables, with the button URL unchanged.');
  } finally { await client.end(); }
}

module.exports={modules,heroFixture,productFixture};
if(require.main===module) main().catch(error=>{console.error(error);process.exitCode=1;});
