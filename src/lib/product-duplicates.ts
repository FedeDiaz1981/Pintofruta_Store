import type { ProductItem } from "@/domain/site-content";
import { normalizeText } from "@/lib/catalog";
import { distance } from "fastest-levenshtein";

export type DuplicateProductGroup = {
  key: string;
  name: string;
  brand: string;
  products: ProductItem[];
  match: "exact" | "similar";
};

function identity(value: string) {
  return normalizeText(value).replace(/[^a-z0-9]+/g, " ").trim();
}

const STOP_WORDS = new Set("a de del la las los el y e para en al por fuente rico rica ricos ricas aporta contiene contenido nuevo nueva x".split(" "));
const OPTIONAL_CORE_WORDS = new Set("caja pack envase frasco presentacion producto".split(" "));
const VARIANTS = new Set("vainilla frutilla fresa chocolate cacao coco naranja limon limonada arandano frambuesa frutos rojo rojos mani almendra avellana banana menta durazno manzana pera integral blanco blanca negro negra natural entero entera descremado descremada dulce salado salada amargo amarga sin con vegano vegana gluten tacc azucar stevia solido solida liquido liquida polvo capsula comprimido".split(" "));
const WORD_ALIASES: Record<string, string> = { choc: "chocolate", choco: "chocolate", org: "organico", organic: "organico", organica: "organico" };
const UNIT_VALUES: Record<string, [string, number]> = {
  kg: ["g", 1000], kgs: ["g", 1000], kilo: ["g", 1000], kilos: ["g", 1000], kilogramo: ["g", 1000], kilogramos: ["g", 1000],
  g: ["g", 1], gr: ["g", 1], grs: ["g", 1], gramo: ["g", 1], gramos: ["g", 1],
  l: ["ml", 1000], lt: ["ml", 1000], lts: ["ml", 1000], litro: ["ml", 1000], litros: ["ml", 1000],
  ml: ["ml", 1], cc: ["ml", 1], mililitro: ["ml", 1], mililitros: ["ml", 1],
  u: ["u", 1], un: ["u", 1], und: ["u", 1], unid: ["u", 1], unidad: ["u", 1], unidades: ["u", 1],
  cap: ["cap", 1], caps: ["cap", 1], capsula: ["cap", 1], capsulas: ["cap", 1], comprimido: ["tab", 1], comprimidos: ["tab", 1],
};
const QUANTITY = /\d+(?:\.\d+)?(?:g|ml|u|cap|tab|pct)?/g;

function canonicalName(value: string) {
  return normalizeText(value)
    .replace(/\bsin\s+(?:stock|stcok)\b/g, " ")
    .replace(/(\d),(?=\d)/g, "$1.")
    .replace(/([a-z])(\d)/g, "$1 $2")
    .replace(/\b(s|c)\s*\/\s*(?=azucar|tacc|gluten)/g, (_, prefix: string) => prefix === "s" ? "sin " : "con ")
    .replace(/\b(sin|con)(azucar|tacc|gluten)\b/g, "$1 $2")
    .replace(/\b(\d+)\s*x\s*(?=\d)/g, "$1u ")
    .replace(/\bx\s*(\d+)\b/g, "$1u")
    .replace(/(\d+(?:\.\d+)?)\s*([a-z]+)\b/g, (original: string, amount: string, unit: string) => {
      const converted = UNIT_VALUES[unit];
      return converted ? `${Number((Number(amount) * converted[1]).toFixed(6))}${converted[0]}` : original;
    })
    .replace(/(\d+(?:\.\d+)?)\s*%/g, "$1pct");
}

type ProductProfile = {
  product: ProductItem;
  brand: string;
  exactName: string;
  quantities: string;
  core: string[];
  words: string[];
};

function profile(product: ProductItem): ProductProfile {
  const name = canonicalName(product.name);
  const brandWords = identity(product.brand).split(" ");
  const excluded = new Set([...brandWords, brandWords.join("")]);
  const words = (value: string) => [...new Set(identity(value.replace(QUANTITY, " ")).split(" ")
    .filter((word) => word && !STOP_WORDS.has(word) && !excluded.has(word)).map((word) => WORD_ALIASES[word] ?? word))];
  const firstQuantity = name.search(/\d/);
  const quantities = name.match(QUANTITY) ?? canonicalName(product.presentation ?? "").match(QUANTITY) ?? [];
  const allWords = words(name);
  return {
    product, brand: identity(product.brand).replace(/ /g, ""), exactName: identity(product.name),
    quantities: [...new Set(quantities)].sort().join("|"),
    core: firstQuantity > 0 ? words(name.slice(0, firstQuantity)) : allWords, words: allWords,
  };
}

function differences(left: string[], right: string[]) {
  const unmatchedLeft = left.filter((word) => !right.includes(word));
  const unmatchedRight = right.filter((word) => !left.includes(word));
  // Match exact words first, then tolerate small spelling errors without reusing a word.
  for (let index = unmatchedLeft.length - 1; index >= 0; index--) {
    const word = unmatchedLeft[index];
    const match = unmatchedRight.findIndex((other) => {
      const length = Math.max(word.length, other.length);
      if (Math.min(word.length, other.length) < 4 || Math.abs(word.length - other.length) > 2) return false;
      const edits = distance(word, other);
      return edits <= (length >= 8 ? 2 : 1) && edits / length <= 0.25;
    });
    if (match >= 0) { unmatchedLeft.splice(index, 1); unmatchedRight.splice(match, 1); }
  }
  return [unmatchedLeft, unmatchedRight];
}

function matches(left: ProductProfile, right: ProductProfile) {
  if (left.brand !== right.brand) return false;
  if (left.quantities && right.quantities && left.quantities !== right.quantities) return false;
  if (left.exactName === right.exactName) return true;
  if (!left.brand || !left.words.length || !right.words.length) return false;
  const [leftExtra, rightExtra] = differences(left.words, right.words);
  if (!leftExtra.length && !rightExtra.length) return true;
  const [leftCore, rightCore] = differences(left.core, right.core);
  if (leftCore.length && rightCore.length) return false;
  const extraCore = leftCore.length + rightCore.length;
  if (extraCore > 1 || (extraCore && (Math.min(left.core.length, right.core.length) < 2 || !OPTIONAL_CORE_WORDS.has([...leftCore, ...rightCore][0])))) return false;
  if ([...leftCore, ...rightCore, ...leftExtra, ...rightExtra].some((word) => VARIANTS.has(word))) return false;
  if (leftExtra.length && rightExtra.length) return false;
  return Math.min(left.core.length, right.core.length) >= 1;
}

export function findDuplicateProducts(products: ProductItem[]): DuplicateProductGroup[] {
  const seen = new Set<number>();
  const buckets = new Map<string, ProductProfile[][]>();
  for (const product of [...products].sort((a, b) => a.id - b.id)) {
    if (seen.has(product.id) || !identity(product.name)) continue;
    seen.add(product.id);
    const candidate = profile(product);
    const groups = buckets.get(candidate.brand) ?? [];
    // Every member must match: a vague intermediate record cannot bridge two variants.
    const group = groups.find((items) => items.every((item) => matches(item, candidate)));
    if (group) group.push(candidate);
    else groups.push([candidate]);
    buckets.set(candidate.brand, groups);
  }
  return [...buckets.values()].flat().filter((items) => items.length > 1).map((items) => ({
    key: items.map((item) => item.product.id).join(":"), name: items[0].product.name, brand: items[0].product.brand,
    products: items.map((item) => item.product),
    match: items.every((item) => item.exactName === items[0].exactName) ? "exact" as const : "similar" as const,
  })).sort((a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" }) || a.key.localeCompare(b.key));
}

export function filterDuplicateProducts(groups: DuplicateProductGroup[], query: string) {
  const normalized = normalizeText(query);
  return groups.filter((group) => !normalized || group.products.some((product) =>
    [String(product.id), product.sku, product.name, product.brand].some((value) => normalizeText(value).includes(normalized))));
}

export function countDuplicateProducts(groups: DuplicateProductGroup[]) {
  return groups.reduce((total, group) => total + group.products.length, 0);
}
