import Image from "next/image";
import Link from "next/link";
import type { BrandItem } from "@/domain/site-content";
import { publicAsset } from "@/lib/catalog";

export function BrandLogoWall({ brands }: { brands: BrandItem[] }) {
  if (brands.length === 0) {
    return null;
  }

  const sortedBrands = [...brands].sort((left, right) => left.name.localeCompare(right.name, "es", { sensitivity: "base" }));

  return (
    <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
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
                <span className="text-[0.95rem] font-semibold tracking-[0.04em] text-[var(--pf-text)]">
                  {brand.name}
                </span>
              </div>
            )}
          </Link>
        );
      })}
    </div>
  );
}
