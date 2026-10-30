const assert=require('node:assert/strict');
const {modules}=require('./test-hero-links.cjs');

const base={id:1,sku:'PF-001',name:'Chocolate orgánico con maní',detail:'Caja de bombones',description:'Endulzado con stévia y cacao',brand:'Coloniál',categoryId:1,categoryName:'Sin azúcar',categoryNames:['Sin azúcar','Kosher'],presentation:'10 unidades',status:'published',soldOut:false,publicPrice:5000,memberPrice:4500,featured:false,vegano:true,kosher:true};
const products=[base,
  {...base,id:2,sku:'COCO-02',name:'Aceite de coco',detail:'Extra virgen',description:'Ideal para cocina',brand:'Marca Natural',categoryName:'Orgánico',categoryNames:['Orgánico']},
  {...base,id:3,sku:'PRIVADO',status:'inactive',description:'Privado'},
  {...base,id:4,sku:'PF-004',name:'Chocolate con avellanas',detail:'Tableta',description:'Con stevia',brand:'Colonial',soldOut:true},
];

async function main(){
  const {createTextSearch,createProductSearch}=modules()('src/lib/search.ts');
  for(const query of ['mani chocolate','COLONIAL MANÍ','stevia caja colonial','  CHOCÓLATE\tORGÁNICO\nMANÍ  ','kosher sin-azucar','PF-001 10 unidades','CHOC ORG','chocolate chocolate']){
    assert.equal(createProductSearch(query)(base),true,query);
  }
  for(const query of ['chocolate nuez','colonial coco','stevia inexistente'])assert.equal(createProductSearch(query)(base),false,query);
  for(const query of ['',null,undefined,'  ','...'])assert.equal(createProductSearch(query)({}),true,String(query));
  assert.equal(createTextSearch('CAFE organico')({title:'Café',tags:['Orgánico']}),true);
  assert.equal(createTextSearch('cafe\u0301')(['CAFÉ']),true);
  assert.equal(createTextSearch('551')({id:551}),true);
  assert.equal(createTextSearch('missing')([null,undefined,{},[]]),false);
  assert.equal(createTextSearch('description')({description:'Sólo cacao'}),false,'Object keys are not searchable content');
  const cyclic={name:'Café'};cyclic.self=cyclic;assert.equal(createTextSearch('cafe')(cyclic),true);
  assert.equal(createProductSearch('chocolate colonial')({name:'Chocolate'}),false,'Words cannot come from different records');
  assert.equal(createProductSearch('chocolate colonial')({brand:'Colonial'}),false);
  assert.equal(createProductSearch('asset-name')({...base,image:'/asset-name.png'}),false,'Technical image paths are not public search text');
  console.log('OK all words across fields, arbitrary order, accents/case, composed Unicode, punctuation, partial words, ID/SKU, repeated/empty queries and safe nested records.');

  const pack={id:1,title:'Combo desayuno',description:'Promoción especial',category:'Desayuno',apodo:'Combo uno',publicPrice:8000,active:true,items:products.slice(0,2).map(product=>({productId:product.id,quantity:1,product}))};
  const content={products,packs:[pack,{...pack,id:2,active:false},{...pack,id:3,items:[]}],brands:[{id:'organic',name:'Orgánica del Sur',active:true}],categories:[],users:[{id:1,name:'José García',email:'jose@example.test',role:'Cliente'}],heroSlides:[],banners:[]};
  const snapshot=JSON.stringify(content);
  const load=modules({'@/infrastructure/site-content.repository':{getSiteContent:async()=>content},'@/infrastructure/db/postgres':{postgresPool:null}});
  const catalog=load('src/application/catalog.ts');
  const ids=rows=>rows.map(row=>row.id);
  assert.deepEqual(ids(await catalog.searchCatalog({query:'MANÍ COLONIAL'})),[1]);
  assert.deepEqual(ids(await catalog.searchCatalog({query:'stevia CHOCOLATE'})),[1,4],'Descriptions and brands are searchable; sold-out published products stay visible');
  assert.deepEqual(ids(await catalog.searchCatalog({query:'mani',brand:'otra'})),[]);
  assert.deepEqual(ids(await catalog.searchCatalog({query:'cocina natural',category:'organico'})),[2]);
  assert.deepEqual(ids(await catalog.searchCatalog({query:'privado'})),[],'Public search must never expose inactive records');
  assert.deepEqual(ids((await catalog.getGalleryPageViewModel({query:'COLONIAL STEVIA'})).products),[1,4]);
  assert.deepEqual(ids((await catalog.getPacksGalleryPageViewModel('COCINA colonial desayuno')).packs),[1],'Pack search combines its own text and included product data');
  assert.deepEqual(ids((await catalog.getPacksGalleryPageViewModel('inexistente')).packs),[]);

  const tables=load('src/application/admin-crud.ts').getAdminTableDefinitions(content);
  const adminProducts=tables.find(table=>table.key==='products').rows;
  assert.deepEqual(ids(adminProducts.filter(createTextSearch('STEViA colonial'))),[1,4]);
  assert.deepEqual(ids(adminProducts.filter(createTextSearch('privado chocolate'))),[3],'Admin keeps inactive products available for management');
  assert.deepEqual(ids(tables.find(table=>table.key==='brands').rows.filter(createTextSearch('sur ORGANICA'))),['organic']);
  assert.deepEqual(ids(tables.find(table=>table.key==='users').rows.filter(createTextSearch('GARCIA jose'))),[1]);
  const {filterProductAvailability}=load('src/lib/product-availability.ts');
  assert.deepEqual(ids(filterProductAvailability(products,'STEViA colonial','all','active')),[1,4]);
  assert.deepEqual(ids(filterProductAvailability(products,'stevia CHOC','sold-out','active')),[4]);
  const {filterDuplicateProducts}=load('src/lib/product-duplicates.ts');
  const groups=[{key:'1:3',name:base.name,brand:base.brand,products:[products[0],products[2]],match:'exact'}];
  assert.equal(filterDuplicateProducts(groups,'caja COLONIAL stevia').length,1);
  assert.equal(filterDuplicateProducts(groups,'caja colonial inexistente').length,0);
  assert.equal(JSON.stringify(content),snapshot,'Searching must never mutate products, prices, status or duplicates');
  console.log('OK storefront/gallery/packs, admin products/brands/users, availability and duplicate filters; existing visibility and flags preserved.');
  console.log('All search tests passed; no real database accessed or modified.');
}
main().catch(error=>{console.error(error);process.exitCode=1});
