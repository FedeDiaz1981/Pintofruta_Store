"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState, useRef } from "react";
import type { ProductItem } from "@/domain/site-content";
import { publicAsset } from "@/lib/catalog";
import { ProductDetailModal } from "@/components/site/product-detail-modal";

function getDiscountLabel(product: ProductItem) {
  if (!product.memberPrice || product.memberPrice <= 0 || product.memberPrice >= product.publicPrice) {
    return null;
  }

  const discount = Math.round((1 - product.memberPrice / product.publicPrice) * 100);
  return discount > 0 ? `${discount}% OFF` : null;
}

function getInventoryLabel(product: ProductItem) {
  if (product.stock == null) {
    return null;
  }

  if (product.stock <= 0) {
    return "Agotado";
  }

  return `${product.stock} unidades`;
}

function ProductBadge({ children, className }: { children: string; className: string }) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full border border-white/70 bg-white/92 px-3 py-2 text-center text-[10px] font-black uppercase leading-none tracking-[0.14em] shadow-[0_8px_18px_rgba(74,57,38,0.14)] ${className}`}
    >
      {children}
    </span>
  );
}

function ProductSeal({ label }: { label: string }) {
  return (
    <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-black/10 bg-black/92 text-[9px] font-black uppercase leading-none tracking-[0.12em] text-white shadow-[0_8px_16px_rgba(0,0,0,0.18)]">
      {label}
    </span>
  );
}

export function FeaturedProductsCarousel({ products }: { products: ProductItem[] }) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<ProductItem | null>(null);

  const scrollByCards = (direction: number) => {
    const track = trackRef.current;
    if (!track) {
      return;
    }

    const card = track.querySelector<HTMLElement>("[data-featured-card]");
    const cardWidth = card?.offsetWidth ?? 300;
    const gap = 16;

    track.scrollBy({
      left: direction * (cardWidth + gap),
      behavior: "smooth",
    });
  };

  if (products.length === 0) {
    return null;
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => scrollByCards(-1)}
        className="absolute left-0 top-1/2 z-20 -translate-x-2 -translate-y-1/2 rounded-full border border-[rgba(74,57,38,0.14)] bg-white p-3 text-[var(--pf-text)] shadow-[0_16px_30px_rgba(74,57,38,0.16)] transition hover:bg-[var(--pf-surface-warm)] hover:scale-105"
        aria-label="Ver productos anteriores"
      >
        <ChevronLeft className="size-6" />
      </button>

      <button
        type="button"
        onClick={() => scrollByCards(1)}
        className="absolute right-0 top-1/2 z-20 translate-x-2 -translate-y-1/2 rounded-full border border-[rgba(74,57,38,0.14)] bg-white p-3 text-[var(--pf-text)] shadow-[0_16px_30px_rgba(74,57,38,0.16)] transition hover:bg-[var(--pf-surface-warm)] hover:scale-105"
        aria-label="Ver productos siguientes"
      >
        <ChevronRight className="size-6" />
      </button>

      <div
        ref={trackRef}
        className="no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3 pr-2 scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {products.map((product) => {
          const discountLabel = getDiscountLabel(product);
          const inventoryLabel = getInventoryLabel(product);
          const isOutOfStock = product.stock != null ? product.stock <= 0 : product.status !== "published";
          return (
            <button
              key={product.id}
              type="button"
              onClick={() => setSelectedProduct(product)}
              className="group block w-[min(82vw,18rem)] shrink-0 snap-start sm:w-[18.5rem] lg:w-[19rem]"
            >
              <article
                data-featured-card
                className="flex h-full min-h-[23rem] flex-col overflow-hidden rounded-[1.5rem] border border-[rgba(74,57,38,0.16)] bg-white shadow-[0_10px_28px_rgba(74,57,38,0.08)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_38px_rgba(74,57,38,0.14)]"
              >
                <div className="relative flex-1 bg-[linear-gradient(180deg,rgba(252,249,243,1),rgba(246,240,230,1))] p-4">
                  <div className="absolute left-3 top-3 z-10">
                    {discountLabel ? <ProductBadge className="min-h-14 min-w-14 bg-[#bf3a2b] px-0 py-0 text-white">{discountLabel}</ProductBadge> : null}
                  </div>
                  <div className="absolute right-3 top-3 z-10">
                    {isOutOfStock ? (
                      <ProductBadge className="bg-[#d84b39] text-white">{inventoryLabel ?? "Agotado"}</ProductBadge>
                    ) : null}
                  </div>

                  <div className="relative flex h-full min-h-[15rem] items-center justify-center overflow-hidden rounded-[1.25rem]">
                    <Image
                      src={publicAsset(product.image)}
                      alt={product.name}
                      fill
                      className="object-contain p-4 transition duration-500 group-hover:scale-[1.04]"
                      sizes="(max-width: 768px) 82vw, 19rem"
                    />
                  </div>

                  <div className="absolute bottom-3 left-3 flex flex-wrap gap-2">
                    {product.vegano ? <ProductSeal label="Vegano" /> : null}
                    {product.kosher ? <ProductSeal label="Kosher" /> : null}
                    {product.testeadoEnAnimales === false ? <ProductSeal label="Cruelty free" /> : null}
                  </div>
                </div>

                <div className="border-t border-[rgba(74,57,38,0.08)] px-4 py-4 text-center">
                  <h3 className="line-clamp-2 text-[0.98rem] font-medium leading-6 text-[var(--pf-text)]">
                    {product.name}
                  </h3>
                  <p className="mt-1 text-xs uppercase tracking-[0.18em] text-[var(--pf-muted)]">
                    {product.presentation}
                  </p>
                </div>
              </article>
            </button>
          );
        })}
      </div>

      <ProductDetailModal
        key={selectedProduct?.id ?? "empty"}
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
      />
    </div>
  );
}
