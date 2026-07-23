"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo } from "react";
import useEmblaCarousel from "embla-carousel-react";
import type { BrandItem } from "@/domain/site-content";
import { publicAsset } from "@/lib/catalog";

function MobileBrandRail({ brands }: { brands: BrandItem[] }) {
  const [emblaRef] = useEmblaCarousel({ loop: brands.length > 2, align: "start" });

  return (
    <div className="relative lg:hidden">
      <div ref={emblaRef} className="overflow-hidden">
        <div className="flex touch-pan-y">
          {brands.map((brand) => {
            const hasImage = Boolean(brand.image);

            return (
              <div key={brand.id} className="min-w-0 flex-[0_0_68vw] px-2 sm:flex-[0_0_52vw] md:flex-[0_0_40vw]">
                <Link
                  href={`/galeria?brand=${encodeURIComponent(brand.name)}`}
                  className="flex h-[156px] items-center justify-center rounded-[1.6rem] border border-[rgba(168,109,69,0.12)] bg-[rgba(255,255,255,0.72)] px-4 py-5 shadow-[0_10px_24px_rgba(74,57,38,0.06)]"
                >
                  {hasImage ? (
                    <div className="relative h-[92px] w-full">
                      <Image
                        src={publicAsset(brand.image)}
                        alt={brand.name}
                        fill
                        className="object-contain p-1"
                        sizes="68vw"
                      />
                    </div>
                  ) : (
                    <div className="flex h-[92px] w-full items-center justify-center px-2 text-center">
                      <span className="text-[0.98rem] font-semibold tracking-[0.04em] text-[var(--pf-text)]">{brand.name}</span>
                    </div>
                  )}
                </Link>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function BrandLogoWall({ brands }: { brands: BrandItem[] }) {
  const visibleBrands = brands.filter((brand) => brand.active !== false);

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
              className="group flex min-h-[132px] items-center justify-center rounded-[1.5rem] border border-transparent bg-transparent p-4 transition duration-300 hover:-translate-y-1 hover:bg-[rgba(255,255,255,0.18)]"
            >
              {hasImage ? (
                <div className="relative h-[72px] w-full">
                  <Image
                    src={publicAsset(brand.image)}
                    alt={brand.name}
                    fill
                    className="object-contain p-1 transition duration-300 group-hover:scale-[1.03]"
                    sizes="(max-width: 768px) 50vw, 16vw"
                  />
                </div>
              ) : (
                <div className="flex h-[72px] w-full items-center justify-center px-2 text-center">
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
