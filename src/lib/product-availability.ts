import type { ProductItem } from "@/domain/site-content";
import { normalizeText } from "@/lib/catalog";

export type AvailabilityFilter = "all" | "sold-out" | "available";
export type VisibilityFilter = "all" | "active" | "inactive";
export type ProductAvailabilityUpdate = Pick<ProductItem, "id" | "status" | "soldOut">;

export function isProductActive(product: Pick<ProductItem, "status">) {
  return product.status === "published";
}

export function filterProductAvailability(products: ProductItem[], query: string, availability: AvailabilityFilter, visibility: VisibilityFilter) {
  const normalized = normalizeText(query);
  return products.filter((product) => {
    if (availability === "sold-out" && !product.soldOut) return false;
    if (availability === "available" && product.soldOut) return false;
    if (visibility === "active" && !isProductActive(product)) return false;
    if (visibility === "inactive" && isProductActive(product)) return false;
    return !normalized || [String(product.id), product.sku, product.name, product.brand]
      .some((value) => normalizeText(value).includes(normalized));
  });
}
