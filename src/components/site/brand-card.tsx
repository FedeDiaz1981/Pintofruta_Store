import Image from "next/image";
import type { BrandItem } from "@/domain/site-content";
import { publicAsset } from "@/lib/catalog";

export function BrandCard({ brand }: { brand: BrandItem }) {
  return (
    <article className="rounded-[1.75rem] border border-base-300 bg-base-100 p-4 shadow-sm">
      <div className="flex items-center gap-4">
        <div className="relative grid size-16 place-items-center overflow-hidden rounded-2xl bg-base-200">
          <Image
            src={publicAsset(brand.image)}
            alt={brand.name}
            fill
            className="object-contain p-2"
            sizes="64px"
          />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-base-content/50">Marca</p>
          <h3 className="truncate text-lg font-extrabold text-base-content">{brand.name}</h3>
        </div>
      </div>
    </article>
  );
}

