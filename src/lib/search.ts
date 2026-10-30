import type { ProductItem } from "@/domain/site-content";
import { normalizeText } from "@/lib/catalog";

function normalizeSearchText(value: string) {
  return normalizeText(value).replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function collectSearchValues(value: unknown, seen: WeakSet<object>): string[] {
  if (value == null) return [];
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return [String(value)];
  if (typeof value !== "object" || seen.has(value)) return [];
  seen.add(value);
  return Object.values(value).flatMap(entry => collectSearchValues(entry, seen));
}

/** Every word must occur somewhere in the record; order and field boundaries do not matter. */
export function createTextSearch(query: string | null | undefined) {
  const terms = [...new Set(normalizeSearchText(query ?? "").split(" ").filter(Boolean))];
  return (values: unknown) => {
    if (!terms.length) return true;
    const text = normalizeSearchText(collectSearchValues(values, new WeakSet()).join(" "));
    return terms.every(term => text.includes(term));
  };
}

type SearchableProduct = Partial<Pick<ProductItem, "id" | "sku" | "name" | "detail" | "description" | "brand" | "presentation" | "categoryName" | "categoryNames">>;

export function productSearchValues(product: SearchableProduct) {
  return [product.id, product.sku, product.name, product.detail, product.description, product.brand,
    product.presentation, product.categoryName, product.categoryNames];
}

export function createProductSearch(query: string | null | undefined) {
  const matches = createTextSearch(query);
  return (product: SearchableProduct) => matches(productSearchValues(product));
}
