"use client";

import Image from "next/image";
import { useState } from "react";
import { CartAddButton } from "@/components/cart/cart-add-button";
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
  const [quickQuantity, setQuickQuantity] = useState(1);
  const isNew = isNewArrival({
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  });
  const inventoryLabel = getInventoryLabel(product);
  const isOutOfStock = product.stock != null ? product.stock <= 0 : product.status !== "published";

  return (
    <article className="group flex h-full min-h-[24.5rem] flex-col overflow-hidden rounded-[1.5rem] border border-[rgba(74,57,38,0.16)] bg-white shadow-[0_10px_28px_rgba(74,57,38,0.08)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_38px_rgba(74,57,38,0.14)]">
      <button type="button" onClick={() => onSelect?.(product)} className="block w-full text-left">
        <div className="relative aspect-[1/1] w-full overflow-hidden bg-[linear-gradient(180deg,rgba(252,249,243,1),rgba(246,240,230,1))]">
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
                sizes="(max-width: 768px) 82vw, 19rem"
              />
            </div>
          </div>
        </div>
      </button>

      <div className="flex flex-1 flex-col justify-between gap-3 border-t border-[rgba(74,57,38,0.08)] px-4 py-4">
        <div className="text-center">
          <h3 className="line-clamp-2 text-balance text-[0.92rem] font-semibold leading-[1.25] tracking-tight text-[var(--pf-text)] sm:text-[0.96rem]">
            {product.name}
          </h3>
          {product.presentation ? (
            <p className="mt-1 line-clamp-1 text-[11px] uppercase tracking-[0.16em] text-[var(--pf-muted)]">
              {product.presentation}
            </p>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-3 rounded-[1.1rem] border border-[rgba(168,109,69,0.14)] bg-[rgba(255,251,245,0.8)] p-2">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setQuickQuantity((current) => Math.max(1, current - 1))}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-[rgba(168,109,69,0.16)] bg-white text-sm font-bold text-[var(--pf-text)] transition hover:bg-[rgba(248,242,232,0.95)]"
              aria-label="Disminuir cantidad"
            >
              -
            </button>
            <span className="min-w-8 text-center text-sm font-bold text-[var(--pf-text)]">{quickQuantity}</span>
            <button
              type="button"
              onClick={() => setQuickQuantity((current) => current + 1)}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-[rgba(168,109,69,0.16)] bg-white text-sm font-bold text-[var(--pf-text)] transition hover:bg-[rgba(248,242,232,0.95)]"
              aria-label="Aumentar cantidad"
            >
              +
            </button>
          </div>

          <CartAddButton
            product={product}
            quantity={quickQuantity}
            className="rounded-full px-4 py-2 text-xs font-semibold normal-case shadow-none"
          >
            Agregar
          </CartAddButton>
        </div>
      </div>
    </article>
  );
}
