"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { motion } from "motion/react";
import type { PackItem } from "@/domain/site-content";
import { PackDetailModal } from "@/components/site/pack-detail-modal";
import { Button } from "@/components/ui/button";
import { formatCurrency, publicAsset } from "@/lib/catalog";

function getSavings(pack: PackItem) {
  const baseTotal = pack.items.reduce((sum, item) => sum + item.quantity * item.product.publicPrice, 0);
  return Math.max(0, baseTotal - pack.publicPrice);
}

function MobilePromotionRail({ promotions }: { promotions: PackItem[] }) {
  const [emblaRef] = useEmblaCarousel({ loop: promotions.length > 1, align: "start" });
  const [selectedPack, setSelectedPack] = useState<PackItem | null>(null);

  return (
    <div className="relative md:hidden">
      <div ref={emblaRef} className="overflow-hidden">
        <div className="flex touch-pan-y">
          {promotions.map((pack, index) => {
            const savings = getSavings(pack);

            return (
              <div key={pack.id} className="min-w-0 flex-[0_0_82vw] px-2 pb-3">
                <motion.button
                  type="button"
                  onClick={() => setSelectedPack(pack)}
                  initial={{ opacity: 0.6, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: index * 0.03 }}
                  className="group block h-full w-full text-left"
                >
                  <article className="flex h-full min-h-[26rem] flex-col overflow-hidden rounded-[1.6rem] border border-[rgba(74,57,38,0.14)] bg-white shadow-[0_10px_28px_rgba(74,57,38,0.08)]">
                    <div className="relative flex-[1.12] overflow-hidden bg-[linear-gradient(180deg,rgba(252,249,243,1),rgba(246,240,230,1))]">
                      <div className="absolute left-3 top-3 z-10">
                        <span className="inline-flex items-center justify-center rounded-full border border-[rgba(168,109,69,0.2)] bg-[rgba(129,84,44,0.96)] px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-white shadow-[0_10px_20px_rgba(74,57,38,0.18)]">
                          Promoción
                        </span>
                      </div>

                      <div className="absolute bottom-3 left-3 z-10 rounded-full border border-[rgba(168,109,69,0.16)] bg-[rgba(255,255,255,0.92)] px-3 py-1 text-[11px] font-semibold text-[var(--pf-primary-darker)] shadow-[0_8px_18px_rgba(74,57,38,0.08)]">
                        {pack.items.length} productos
                      </div>

                      <div className="absolute inset-0">
                        <Image
                          src={publicAsset(pack.image)}
                          alt={pack.title}
                          fill
                          className="object-cover object-center transition duration-500 group-hover:scale-[1.04]"
                          sizes="82vw"
                        />
                      </div>
                    </div>

                    <div className="flex h-[7rem] flex-col justify-center border-t border-[rgba(74,57,38,0.08)] px-4 py-3 text-center">
                      <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[var(--pf-muted)]">{pack.category}</p>
                      <h3 className="line-clamp-2 text-[0.98rem] font-medium leading-6 text-[var(--pf-text)]">{pack.title}</h3>
                      <p className="mt-1 text-sm font-semibold text-[var(--pf-primary-darker)]">
                        Desde {formatCurrency(pack.publicPrice)}
                        {savings > 0 ? ` · Ahorrás ${formatCurrency(savings)}` : ""}
                      </p>
                    </div>
                  </article>
                </motion.button>
              </div>
            );
          })}
        </div>
      </div>

      <PackDetailModal key={selectedPack?.id ?? "empty-mobile"} pack={selectedPack} onClose={() => setSelectedPack(null)} />
    </div>
  );
}

export function PromotionCarousel({ promotions }: { promotions: PackItem[] }) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [selectedPack, setSelectedPack] = useState<PackItem | null>(null);

  const scrollByCards = (direction: number) => {
    const track = trackRef.current;
    if (!track) {
      return;
    }

    const card = track.querySelector<HTMLElement>("[data-promotion-card]");
    const cardWidth = card?.offsetWidth ?? 300;
    const gap = 16;

    track.scrollBy({
      left: direction * (cardWidth + gap),
      behavior: "smooth",
    });
  };

  if (promotions.length === 0) {
    return null;
  }

  return (
    <>
      <MobilePromotionRail promotions={promotions} />

      <div className="relative hidden md:block">
        <Button
          type="button"
          onClick={() => scrollByCards(-1)}
          variant="secondary"
          size="icon"
          className="absolute left-0 top-1/2 z-20 -translate-x-2 -translate-y-1/2 transition hover:scale-105"
          aria-label="Ver promociones anteriores"
        >
          <ChevronLeft className="size-6" />
        </Button>

        <Button
          type="button"
          onClick={() => scrollByCards(1)}
          variant="secondary"
          size="icon"
          className="absolute right-0 top-1/2 z-20 translate-x-2 -translate-y-1/2 transition hover:scale-105"
          aria-label="Ver promociones siguientes"
        >
          <ChevronRight className="size-6" />
        </Button>

        <div
          ref={trackRef}
          className="no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3 pr-2 scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {promotions.map((pack) => {
            const savings = getSavings(pack);

            return (
              <button
                key={pack.id}
                type="button"
                onClick={() => setSelectedPack(pack)}
                className="group block w-[min(78vw,16.75rem)] shrink-0 snap-start sm:w-[17rem] lg:w-[17.5rem]"
              >
                <article
                  data-promotion-card
                  className="flex h-full min-h-[24.5rem] flex-col overflow-hidden rounded-[1.5rem] border border-[rgba(74,57,38,0.16)] bg-white shadow-[0_10px_28px_rgba(74,57,38,0.08)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_38px_rgba(74,57,38,0.14)]"
                >
                  <div className="relative flex-[1.08] overflow-hidden bg-[linear-gradient(180deg,rgba(252,249,243,1),rgba(246,240,230,1))]">
                    <div className="absolute left-3 top-3 z-10">
                      <span className="inline-flex items-center justify-center rounded-full border border-[rgba(168,109,69,0.2)] bg-[rgba(129,84,44,0.96)] px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-white shadow-[0_10px_20px_rgba(74,57,38,0.18)]">
                        Promoción
                      </span>
                    </div>

                    <div className="absolute bottom-3 left-3 z-10 rounded-full border border-[rgba(168,109,69,0.16)] bg-[rgba(255,255,255,0.92)] px-3 py-1 text-[11px] font-semibold text-[var(--pf-primary-darker)] shadow-[0_8px_18px_rgba(74,57,38,0.08)]">
                      {pack.items.length} productos
                    </div>

                    <div className="absolute inset-0">
                      <Image
                        src={publicAsset(pack.image)}
                        alt={pack.title}
                        fill
                        className="object-cover object-center transition duration-500 group-hover:scale-[1.04]"
                        sizes="(max-width: 768px) 82vw, 19rem"
                      />
                    </div>
                  </div>

                  <div className="flex h-[7rem] flex-col justify-center border-t border-[rgba(74,57,38,0.08)] px-4 py-3 text-center">
                    <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[var(--pf-muted)]">{pack.category}</p>
                    <h3 className="line-clamp-2 text-[0.98rem] font-medium leading-6 text-[var(--pf-text)]">{pack.title}</h3>
                    <p className="mt-1 text-sm font-semibold text-[var(--pf-primary-darker)]">
                      Desde {formatCurrency(pack.publicPrice)}
                      {savings > 0 ? ` · Ahorrás ${formatCurrency(savings)}` : ""}
                    </p>
                  </div>
                </article>
              </button>
            );
          })}
        </div>

        <PackDetailModal key={selectedPack?.id ?? "empty"} pack={selectedPack} onClose={() => setSelectedPack(null)} />
      </div>
    </>
  );
}
