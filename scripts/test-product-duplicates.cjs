const assert = require('node:assert/strict');
const {modules} = require('./test-hero-links.cjs');
const load = modules();

const { findDuplicateProducts, filterDuplicateProducts, countDuplicateProducts } = load('src/lib/product-duplicates.ts');
const product = (id, name, brand, status = 'published') => ({ id, name, brand, status, sku: `SKU${id}` });
const products = [
  product(5, 'T\u00e9 VERDE 250g', 'Org\u00e1nica'),
  product(1, ' te verde 250g ', 'organica', 'inactive'),
  product(7, 'TE-VERDE 250g', 'ORGANICA'),
  product(2, 'Te verde 500g', 'Organica'),
  product(3, 'Te verde 250g', 'Otra marca'),
  product(4, 'Miel 450g', 'Bioway'),
  product(6, 'MIEL 450g', 'BIOWAY', 'inactive'),
  product(8, '   ', 'Organica'),
  product(9, '', 'Organica'),
];
const snapshot = JSON.stringify(products);
const groups = findDuplicateProducts(products);
assert.equal(groups.length, 2);
assert.equal(countDuplicateProducts(groups), 5, 'Counts all distinct products involved, not just extra copies');
assert.deepEqual(groups.find(group => group.products.length === 3).products.map(item => item.id), [1, 5, 7]);
assert.equal(groups.flatMap(group => group.products).filter(item => item.status === 'inactive').length, 2);
assert.equal(JSON.stringify(products), snapshot, 'Input order and products must not be mutated');
assert.deepEqual(findDuplicateProducts([]), []);
assert.deepEqual(findDuplicateProducts([products[0], products[0]]), [], 'The same product ID is not a duplicate record');
assert.deepEqual(findDuplicateProducts(products.filter(item => [2, 3, 8, 9].includes(item.id))), [], 'Different presentations/brands and blank names must not match');
assert.equal(filterDuplicateProducts(groups, 'TE VERDE').length, 1);
assert.equal(filterDuplicateProducts(groups, 'org\u00e1nica').length, 1);
assert.equal(filterDuplicateProducts(groups, 'SKU5')[0].products.length, 3, 'Search must retain the whole comparison group');
assert.equal(filterDuplicateProducts(groups, '7')[0].products.length, 3);
assert.equal(filterDuplicateProducts(groups, 'no existe').length, 0);
assert.equal(filterDuplicateProducts(groups, '').length, 2);
const afterDelete = findDuplicateProducts(products.filter(item => item.id !== 6));
assert.equal(countDuplicateProducts(afterDelete), 3, 'Removing the second copy resolves the whole pair');
assert.equal(countDuplicateProducts(findDuplicateProducts(products.filter(item => ![1, 5, 6].includes(item.id)))), 0);
console.log('OK normalized names/brands, distinct IDs, active and inactive records, variant isolation, stable ordering and no input mutations.');
console.log('OK involved-product counts, grouped search, missing/empty results and recalculation after duplicate removal.');

function pair(left, right, expected, label, options = {}) {
  const result = findDuplicateProducts([
    { ...product(101, left, options.leftBrand ?? 'MK ORGANIC'), presentation: options.leftPresentation },
    { ...product(102, right, options.rightBrand ?? 'MK ORGANIC', 'inactive'), presentation: options.rightPresentation },
  ]);
  assert.equal(result.length, expected ? 1 : 0, label);
  if (expected) assert.equal(countDuplicateProducts(result), 2, label);
  return result;
}

const nibs = 'MK ORGANIC NIBS DE CACAO 25gr fuente de magnesio, potacio, hierro, fosforo, selenio y antioxidantes.';
const similar = pair(nibs, 'MK ORGANIC NIBS CACAO 25 g fuente de magnesio, potasio, hierro, f\u00f3sforo, selenio y antioxidantes', true, 'User example: descriptions, spelling, accent and unit formatting');
assert.equal(similar[0].match, 'similar');
assert.equal(groups.every(group => group.match === 'exact'), true);
pair(nibs, 'MKORGANIC CACAO NIBS 25g', true, 'Reordered words, compact brand and omitted marketing text');
pair('Barrita chocolate 25gr', 'Barrita chocoltae 25g', true, 'Small transposition in a longer word');
pair('Choc Menta CAJA 20u', 'CAJA 20 unidades Chocolate Menta', true, 'Abbreviation and word/quantity reordering');
pair('Miel 0,5 kg', 'Miel 500 gramos', true, 'Equivalent decimal weights');
pair('Jugo 1 litro', 'Jugo 1000 cc', true, 'Equivalent volume units');
pair('Barrita caja 12x25g', 'Barrita caja 12 u 25 gr', true, 'Equivalent box quantity notation');
pair('Barritas proteicas mani caja 16u 50g', 'Barritas proteicas mani 16u 50g', true, 'Optional packaging word with identical quantities');
pair('Barritas 16u 50g', 'Barritas 16u 50g SIN STOCK', true, 'Availability annotations are not part of product identity');
pair('Barritas SIN AZUCAR pasas 16u 45g', 'Barritas SIN A ZUCAR pasas 16u 45g SIN STCOK', true, 'Split word typo and historical availability annotation');
pair('Vitamina 30 caps', 'Vitamina 30 c\u00e1psulas', true, 'Equivalent capsule notation');
pair(nibs, nibs.replace('25gr', '100gr'), false, 'The 25g and 100g products in the live catalog must remain separate');
pair('Miel 450g', 'Miel 450ml', false, 'Weight and volume are not interchangeable');
pair('Caja barritas 12u 25g', 'Caja barritas 24u 25g', false, 'Different pack quantities');
pair('Chocolate 70% 25g', 'Chocolate 80% 25g', false, 'Different cocoa percentages');
pair('Barrita chocolate 25g vainilla', 'Barrita chocolate 25g frutilla', false, 'Different flavors after the quantity');
pair('Chocolate almendra 25g fuente de magnesio hierro y fosforo', 'Chocolate naranja 25g fuente de magnesio hierro y fosforo', false, 'Shared marketing text must not drown out a flavor difference');
pair('Galletitas 150g sin azucar', 'Galletitas 150g con azucar', false, 'Opposing dietary variants');
pair('Galletitas 150g', 'Galletitas 150g sin azucar', false, 'A missing dietary qualification is not assumed equivalent');
pair('Arroz integral 500g', 'Arroz blanco 500g', false, 'Different product variants');
pair('Bebida de coco 250ml', 'Bebida de cacao 250ml', false, 'Short similar ingredient words must not match');
pair('Desodorante roll on aloe vera 60ml protege y refresca', 'Desodorante roll on calendula y aloe vera 60ml protege y refresca', false, 'An extra ingredient is not just an optional descriptor');
pair('Energy gel amino frutilla caja 12u 32g', 'Energy gel frutilla caja 12u 32g', false, 'An extra formulation word cannot be assumed optional');
pair('Miel 450g', 'Miel 450 gramos', false, 'Different brands', { rightBrand: 'Otra marca' });
pair('Aceite', 'Aceite', false, 'Presentation metadata protects names without quantities', { leftPresentation: '25 gr', rightPresentation: '100gr' });
pair('Bebida cacao 250ml', 'Bebida cacao 250 ml', true, 'Brand whitespace variants', { leftBrand:'MK ORGANIC', rightBrand:'MKORGANIC' });
const bridge = [product(1, 'MK ORGANIC Nibs cacao 25g', 'MK ORGANIC'), product(2, 'MK ORGANIC Nibs cacao', 'MK ORGANIC'), product(3, 'MK ORGANIC Nibs cacao 100g', 'MK ORGANIC')];
assert.deepEqual(findDuplicateProducts(bridge)[0].products.map(item => item.id), [1, 2], 'An unspecified presentation must not bridge 25g and 100g into one group');
assert.deepEqual(findDuplicateProducts([...bridge].reverse()), findDuplicateProducts(bridge), 'Fuzzy grouping must be independent of input order');
console.log('OK similar names, unit/abbreviation normalization, word order, spelling and description changes.');
console.log('OK guards for brands, sizes, pack counts, percentages, flavors, dietary variants and transitive bridges.');
