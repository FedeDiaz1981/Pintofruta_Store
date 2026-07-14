import Image from "next/image";
import type { BrandItem } from "@/domain/site-content";
import { publicAsset } from "@/lib/catalog";

export function BrandCard({ brand }: { brand: BrandItem }) {
  return (
    <article className="rounded-[1.6rem] border border-[var(--pf-border)] bg-[rgba(255,255,255,0.82)] p-4 shadow-[0_12px_28px_rgba(74,57,38,0.06)]">
      <div className="flex items-center gap-4">
        <div className="relative grid size-16 place-items-center overflow-hidden rounded-2xl bg-[rgba(248,242,232,0.96)]">
          <Image
            src={publicAsset(brand.image)}
            alt={brand.name}
            fill
            className="object-contain p-2"
            sizes="64px"
          />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-[var(--pf-muted)]">Marca</p>
          <h3 className="truncate text-lg font-extrabold text-base-content">{brand.name}</h3>
        </div>
      </div>
    </article>
  );
}
