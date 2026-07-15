"use client";

import Image from "next/image";
import type { PackItem } from "@/domain/site-content";
import { formatCurrency, publicAsset } from "@/lib/catalog";

function getSavings(pack: PackItem) {
  const baseTotal = pack.items.reduce((sum, item) => sum + item.quantity * item.product.publicPrice, 0);
  return Math.max(0, baseTotal - pack.publicPrice);
}

export function PackCard({
  pack,
  onSelect,
}: {
  pack: PackItem;
  onSelect?: (pack: PackItem) => void;
}) {
  const savings = getSavings(pack);

  return (
    <button type="button" onClick={() => onSelect?.(pack)} className="group block h-full w-full text-left">
      <article className="flex h-full min-h-[22rem] flex-col overflow-hidden rounded-[1.4rem] border border-[rgba(74,57,38,0.14)] bg-white shadow-[0_10px_28px_rgba(74,57,38,0.08)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_38px_rgba(74,57,38,0.14)]">
        <div className="relative flex-[1.18] overflow-hidden bg-[linear-gradient(180deg,rgba(252,249,243,1),rgba(246,240,230,1))]">
          <div className="absolute left-3 top-3 z-10">
            <span className="inline-flex items-center justify-center rounded-full border border-[rgba(168,109,69,0.2)] bg-[rgba(129,84,44,0.96)] px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-white shadow-[0_10px_20px_rgba(74,57,38,0.18)]">
              Promoción
            </span>
          </div>

          <div className="absolute left-3 bottom-3 z-10 rounded-full border border-[rgba(168,109,69,0.16)] bg-[rgba(255,255,255,0.9)] px-3 py-1 text-[11px] font-semibold text-[var(--pf-primary-darker)] shadow-[0_8px_18px_rgba(74,57,38,0.08)]">
            {pack.items.length} productos
          </div>

          <div className="absolute inset-0 p-4">
            <div className="relative h-full w-full overflow-hidden rounded-[1.15rem] bg-[rgba(255,255,255,0.94)] shadow-[0_18px_36px_rgba(74,57,38,0.10)]">
              <Image
                src={publicAsset(pack.image)}
                alt={pack.title}
                fill
                className="object-cover object-center transition duration-500 group-hover:scale-[1.03]"
                sizes="(max-width: 768px) 80vw, 24rem"
              />
            </div>
          </div>
        </div>

        <div className="flex min-h-[8.2rem] flex-col justify-center gap-2 border-t border-[rgba(74,57,38,0.08)] px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <p className="truncate text-[11px] font-bold uppercase tracking-[0.28em] text-[var(--pf-muted)]">{pack.category}</p>
            {savings > 0 ? (
              <span className="rounded-full bg-[rgba(168,109,69,0.12)] px-2.5 py-1 text-[11px] font-semibold text-[var(--pf-primary-darker)]">
                Ahorrás {formatCurrency(savings)}
              </span>
            ) : null}
          </div>
          <h3 className="line-clamp-2 text-[1rem] font-medium leading-6 text-[var(--pf-text)]">{pack.title}</h3>
          <p className="text-sm font-semibold text-[var(--pf-primary-darker)]">Desde {formatCurrency(pack.publicPrice)}</p>
        </div>
      </article>
    </button>
  );
}
