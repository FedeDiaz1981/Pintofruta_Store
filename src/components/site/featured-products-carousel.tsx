"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { motion } from "motion/react";
import type { ProductItem } from "@/domain/site-content";
import { isNewArrival, publicAsset } from "@/lib/catalog";
import { ProductDetailModal } from "@/components/site/product-detail-modal";
import { Button } from "@/components/ui/button";

function getInventoryLabel(product: ProductItem) {
  if (product.stock == null) {
    return null;
  }

  if (product.stock <= 0) {
    return "Agotado";
  }

  return `${product.stock} unidades`;
}

function getNewLabel(product: ProductItem) {
  return isNewArrival({
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  })
    ? "Novedad"
    : null;
}

function ProductSeal({ label }: { label: string }) {
  return (
    <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-black/10 bg-black/92 text-[9px] font-black uppercase leading-none tracking-[0.12em] text-white shadow-[0_8px_16px_rgba(0,0,0,0.18)]">
      {label}
    </span>
  );
}

function MobileFeaturedRail({ products }: { products: ProductItem[] }) {
  const [emblaRef] = useEmblaCarousel({ loop: products.length > 1, align: "start" });
  const [selectedProduct, setSelectedProduct] = useState<ProductItem | null>(null);

  return (
    <div className="relative md:hidden">
      <div ref={emblaRef} className="overflow-hidden">
        <div className="flex touch-pan-y">
          {products.map((product, index) => {
            const newLabel = getNewLabel(product);
            const inventoryLabel = getInventoryLabel(product);
            const isOutOfStock = product.stock != null ? product.stock <= 0 : product.status !== "published";

            return (
              <div key={product.id} className="min-w-0 flex-[0_0_82vw] px-2 pb-3">
                <motion.button
                  type="button"
                  onClick={() => setSelectedProduct(product)}
                  initial={{ opacity: 0.6, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: index * 0.03 }}
                  className="group block h-full w-full text-left"
                >
                  <article className="flex h-full min-h-[26rem] flex-col overflow-hidden rounded-[1.6rem] border border-[rgba(74,57,38,0.14)] bg-white shadow-[0_10px_28px_rgba(74,57,38,0.08)]">
                    <div className="relative flex-[1.12] overflow-hidden bg-[linear-gradient(180deg,rgba(252,249,243,1),rgba(246,240,230,1))]">
                      <div className="absolute left-3 top-3 z-10">
                        {newLabel ? (
                          <span
                            className="inline-flex items-center justify-center rounded-full border border-[rgba(168,109,69,0.2)] px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] shadow-[0_10px_20px_rgba(74,57,38,0.18)]"
                            style={{ backgroundColor: "#6f4528", color: "#ffffff" }}
                          >
                            Novedad
                          </span>
                        ) : null}
                      </div>
                      <div className="absolute right-3 top-3 z-10">
                        {isOutOfStock ? (
                          <span className="inline-flex min-h-12 items-center justify-center rounded-full border border-[rgba(216,75,57,0.18)] bg-[#d84b39] px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-white shadow-[0_10px_20px_rgba(74,57,38,0.18)]">
                            {inventoryLabel ?? "Agotado"}
                          </span>
                        ) : null}
                      </div>

                      <div className="absolute inset-0">
                        <Image
                          src={publicAsset(product.image)}
                          alt={product.name}
                          fill
                          className="object-cover object-center transition duration-500 group-hover:scale-[1.04]"
                          sizes="82vw"
                        />
                      </div>

                      <div className="absolute bottom-3 left-3 flex flex-wrap gap-2">
                        {product.vegano ? <ProductSeal label="Vegano" /> : null}
                        {product.kosher ? <ProductSeal label="Kosher" /> : null}
                        {product.testeadoEnAnimales === false ? <ProductSeal label="Cruelty free" /> : null}
                      </div>
                    </div>

                    <div className="flex h-[7rem] flex-col justify-center border-t border-[rgba(74,57,38,0.08)] px-4 py-3 text-center">
                      <h3 className="line-clamp-2 text-[0.98rem] font-medium leading-6 text-[var(--pf-text)]">{product.name}</h3>
                    </div>
                  </article>
                </motion.button>
              </div>
            );
          })}
        </div>
      </div>

      <ProductDetailModal
        key={selectedProduct?.id ?? "empty-mobile"}
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
      />
    </div>
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
    <>
      <MobileFeaturedRail products={products} />

      <div className="relative hidden md:block">
        <Button
          type="button"
          onClick={() => scrollByCards(-1)}
          variant="secondary"
          size="icon"
          className="absolute left-0 top-1/2 z-20 -translate-x-2 -translate-y-1/2 transition hover:scale-105"
          aria-label="Ver productos anteriores"
        >
          <ChevronLeft className="size-6" />
        </Button>

        <Button
          type="button"
          onClick={() => scrollByCards(1)}
          variant="secondary"
          size="icon"
          className="absolute right-0 top-1/2 z-20 translate-x-2 -translate-y-1/2 transition hover:scale-105"
          aria-label="Ver productos siguientes"
        >
          <ChevronRight className="size-6" />
        </Button>

        <div
          ref={trackRef}
          className="no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3 pr-2 scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {products.map((product) => {
            const newLabel = getNewLabel(product);
            const inventoryLabel = getInventoryLabel(product);
            const isOutOfStock = product.stock != null ? product.stock <= 0 : product.status !== "published";
            return (
              <button
                key={product.id}
                type="button"
                onClick={() => setSelectedProduct(product)}
                className="group block w-[min(78vw,16.75rem)] shrink-0 snap-start sm:w-[17rem] lg:w-[17.5rem]"
              >
                <article
                  data-featured-card
                  className="flex h-full min-h-[24.5rem] flex-col overflow-hidden rounded-[1.5rem] border border-[rgba(74,57,38,0.16)] bg-white shadow-[0_10px_28px_rgba(74,57,38,0.08)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_38px_rgba(74,57,38,0.14)]"
                >
                  <div className="relative flex-[1.08] overflow-hidden bg-[linear-gradient(180deg,rgba(252,249,243,1),rgba(246,240,230,1))]">
                    <div className="absolute left-3 top-3 z-10">
                      {newLabel ? (
                        <span
                          className="inline-flex items-center justify-center rounded-full border border-[rgba(168,109,69,0.2)] px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] shadow-[0_10px_20px_rgba(74,57,38,0.18)]"
                          style={{ backgroundColor: "#6f4528", color: "#ffffff" }}
                        >
                          Novedad
                        </span>
                      ) : null}
                    </div>
                    <div className="absolute right-3 top-3 z-10">
                      {isOutOfStock ? (
                        <span className="inline-flex min-h-12 items-center justify-center rounded-full border border-[rgba(216,75,57,0.18)] bg-[#d84b39] px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-white shadow-[0_10px_20px_rgba(74,57,38,0.18)]">
                          {inventoryLabel ?? "Agotado"}
                        </span>
                      ) : null}
                    </div>

                    <div className="absolute inset-0">
                      <Image
                        src={publicAsset(product.image)}
                        alt={product.name}
                        fill
                        className="object-cover object-center transition duration-500 group-hover:scale-[1.04]"
                        sizes="(max-width: 768px) 82vw, 19rem"
                      />
                    </div>

                    <div className="absolute bottom-3 left-3 flex flex-wrap gap-2">
                      {product.vegano ? <ProductSeal label="Vegano" /> : null}
                      {product.kosher ? <ProductSeal label="Kosher" /> : null}
                      {product.testeadoEnAnimales === false ? <ProductSeal label="Cruelty free" /> : null}
                    </div>
                  </div>

                  <div className="flex h-[7rem] flex-col justify-center border-t border-[rgba(74,57,38,0.08)] px-4 py-3 text-center">
                    <h3 className="line-clamp-2 text-[0.98rem] font-medium leading-6 text-[var(--pf-text)]">{product.name}</h3>
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
    </>
  );
}
