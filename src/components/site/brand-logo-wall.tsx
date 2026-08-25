"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo } from "react";
import useEmblaCarousel from "embla-carousel-react";
import type { BrandItem } from "@/domain/site-content";
import { publicAsset } from "@/lib/catalog";

function chunkBrands(brands: BrandItem[], chunkSize: number) {
  const chunks: BrandItem[][] = [];

  for (let index = 0; index < brands.length; index += chunkSize) {
    chunks.push(brands.slice(index, index + chunkSize));
  }

  return chunks;
}

function MobileBrandRail({ brands }: { brands: BrandItem[] }) {
  const pages = useMemo(() => chunkBrands(brands, 4), [brands]);
  const [emblaRef] = useEmblaCarousel({ loop: pages.length > 1, align: "start" });

  return (
    <div className="relative lg:hidden">
      <div ref={emblaRef} className="overflow-hidden">
        <div className="flex touch-pan-y">
          {pages.map((page, pageIndex) => (
            <div key={page.map((brand) => brand.id).join("-")} className="min-w-0 flex-[0_0_100%] px-2 pb-3">
              <div className="grid grid-cols-2 gap-3">
                {page.map((brand) => {
                  const hasImage = Boolean(brand.image);

                  return (
                    <Link
                      key={brand.id}
                      href={`/galeria?brand=${encodeURIComponent(brand.name)}`}
                      className="relative flex aspect-square overflow-hidden rounded-[1.6rem] border border-[rgba(168,109,69,0.12)] bg-[rgba(255,255,255,0.78)] shadow-[0_10px_24px_rgba(74,57,38,0.06)]"
                    >
                      {hasImage ? (
                        <Image
                          src={publicAsset(brand.image)}
                          alt={brand.name}
                          fill
                          className="object-contain p-4"
                          sizes="50vw"
                          priority={pageIndex === 0}
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center px-3 text-center">
                          <span className="text-[0.98rem] font-semibold tracking-[0.04em] text-[var(--pf-text)]">{brand.name}</span>
                        </div>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function BrandLogoWall({ brands }: { brands: BrandItem[] }) {
  const visibleBrands = brands.filter((brand) => brand.active !== false && brand.featured && Boolean(brand.image));

  const sortedBrands = useMemo(
    () => [...visibleBrands].sort((left, right) => left.name.localeCompare(right.name, "es", { sensitivity: "base" })),
    [visibleBrands],
  );

  if (sortedBrands.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <MobileBrandRail brands={sortedBrands} />

      <div className="hidden gap-3 lg:grid lg:grid-cols-4 xl:grid-cols-6">
        {sortedBrands.map((brand) => {
          const hasImage = Boolean(brand.image);

          return (
            <Link
              key={brand.id}
              href={`/galeria?brand=${encodeURIComponent(brand.name)}`}
              className="group relative flex min-h-[160px] overflow-hidden rounded-[1.5rem] border border-transparent bg-[rgba(255,255,255,0.18)] p-0 transition duration-300 hover:-translate-y-1 hover:bg-[rgba(255,255,255,0.26)]"
            >
              {hasImage ? (
                <Image
                  src={publicAsset(brand.image)}
                  alt={brand.name}
                  fill
                  className="object-contain p-4 transition duration-300 group-hover:scale-[1.01]"
                  sizes="(max-width: 768px) 50vw, 16vw"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center px-2 text-center">
                  <span className="text-[0.95rem] font-semibold tracking-[0.04em] text-[var(--pf-text)]">{brand.name}</span>
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
