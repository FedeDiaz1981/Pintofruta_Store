"use client";

import Image from "next/image";
import type { ProductItem } from "@/domain/site-content";
import { isNewArrival, publicAsset } from "@/lib/catalog";

function getInventoryLabel(product: ProductItem) {
  if (product.stock == null) {
    return null;
  }

  if (product.stock <= 0) {
    return "Agotado";
  }

  return `${product.stock} unidades`;
}

export function ProductCard({
  product,
  onSelect,
}: {
  product: ProductItem;
  onSelect?: (product: ProductItem) => void;
}) {
  const isNew = isNewArrival({
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  });
  const inventoryLabel = getInventoryLabel(product);
  const isOutOfStock = product.stock != null ? product.stock <= 0 : product.status !== "published";

  return (
    <button
      type="button"
      onClick={() => onSelect?.(product)}
      className="group block h-full w-full text-left"
    >
      <article className="flex h-full min-h-[18rem] flex-col overflow-hidden rounded-[1.4rem] border border-[rgba(74,57,38,0.14)] bg-white shadow-[0_10px_28px_rgba(74,57,38,0.08)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_38px_rgba(74,57,38,0.14)]">
        <div className="relative flex-[1.15] overflow-hidden bg-[linear-gradient(180deg,rgba(252,249,243,1),rgba(246,240,230,1))]">
          <div className="absolute left-3 top-3 z-10">
            {isNew ? (
              <span className="inline-flex items-center justify-center rounded-full border border-[rgba(168,109,69,0.2)] bg-[rgba(129,84,44,0.96)] px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-white shadow-[0_10px_20px_rgba(74,57,38,0.18)]">
                Novedad
              </span>
            ) : null}
          </div>

          <div className="absolute right-3 top-3 z-10">
            {isOutOfStock ? (
              <span className="inline-flex items-center justify-center rounded-full border border-[rgba(216,75,57,0.18)] bg-[#d84b39] px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-white shadow-[0_10px_20px_rgba(74,57,38,0.18)]">
                {inventoryLabel ?? "Agotado"}
              </span>
            ) : null}
          </div>

          <div className="absolute inset-0 p-4">
            <div className="relative h-full w-full overflow-hidden rounded-[1.15rem] bg-[rgba(255,255,255,0.94)] shadow-[0_18px_36px_rgba(74,57,38,0.10)]">
              <Image
                src={publicAsset(product.image)}
                alt={product.name}
                fill
                className="object-contain p-4 transition duration-500 group-hover:scale-[1.03]"
                sizes="(max-width: 768px) 80vw, 24rem"
              />
            </div>
          </div>
        </div>

        <div className="flex min-h-[7.2rem] flex-col justify-center border-t border-[rgba(74,57,38,0.08)] px-4 py-4 text-center">
          <h3 className="line-clamp-2 text-[1rem] font-medium leading-6 text-[var(--pf-text)]">{product.name}</h3>
        </div>
      </article>
    </button>
  );
}
