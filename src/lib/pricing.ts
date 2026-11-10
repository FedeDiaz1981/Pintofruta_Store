import type { ViewerSession } from "@/domain/viewer";
import type { PackItem, ProductItem } from "@/domain/site-content";

type PricingViewer = Pick<ViewerSession, "authenticated" | "canSeePrices"> | null | undefined;

function canUseMemberPrice(viewer: PricingViewer) {
  return Boolean(viewer?.authenticated && viewer.canSeePrices);
}

export function resolveProductUnitPrice(product: Pick<ProductItem, "publicPrice" | "memberPrice">, viewer?: PricingViewer) {
  if (canUseMemberPrice(viewer) && Number.isFinite(product.memberPrice) && product.memberPrice > 0) {
    return product.memberPrice;
  }

  return product.publicPrice;
}

export function isProductVisibleForViewer(
  product: Pick<ProductItem, "publicPrice" | "memberPrice">,
  viewer?: PricingViewer,
) {
  const publicPrice = Number(product.publicPrice) || 0;
  const memberPrice = Number(product.memberPrice) || 0;

  // Visitantes no deben recibir productos que se mostrar\u00edan a $0.
  if (!canUseMemberPrice(viewer)) return publicPrice > 0;

  // Un cliente logueado puede usar el precio miembro o, si no existe,
  // el precio p\u00fablico. Si ambos son cero, tampoco debe verlo.
  return memberPrice > 0 || publicPrice > 0;
}

export function resolvePackUnitPrice(pack: Pick<PackItem, "publicPrice">) {
  return pack.publicPrice;
}

