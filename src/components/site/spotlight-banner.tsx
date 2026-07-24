import Link from "next/link";

import type { HeroSlide } from "@/domain/site-content";

import { buttonVariants } from "@/components/ui/button";
import { publicAsset } from "@/lib/catalog";

export function SpotlightBanner({ slide }: { slide: HeroSlide | null }) {
  if (!slide) {
    return null;
  }

  return (
    <section className="relative w-full overflow-hidden bg-[var(--pf-surface)]">
      <div className="relative h-[clamp(330px,56vw,620px)] w-full overflow-hidden">
        <picture className="absolute inset-0 block h-full w-full">
          {slide.imageMobile ? <source media="(max-width: 767px)" srcSet={publicAsset(slide.imageMobile)} /> : null}
          <img
            src={publicAsset(slide.image)}
            alt={slide.title}
            className="h-full w-full object-cover object-center"
            loading="lazy"
          />
        </picture>

        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(248,242,232,0.96)_0%,rgba(248,242,232,0.88)_24%,rgba(248,242,232,0.50)_46%,rgba(248,242,232,0.16)_64%,rgba(248,242,232,0.02)_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_right_center,rgba(74,57,38,0.16),transparent_38%)]" />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-[linear-gradient(180deg,transparent,rgba(248,242,232,0.82)_80%,rgba(248,242,232,0.96))]" />

        <div className="absolute inset-0 z-10 flex items-end sm:items-center sm:justify-start">
          <div className="w-full px-4 pb-8 pt-12 sm:px-6 md:max-w-2xl md:py-14 lg:px-12 lg:py-16">
            <span className="inline-flex rounded-full bg-secondary/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-secondary shadow-none">
              {slide.badge}
            </span>

            <h2 className="mt-5 max-w-xl text-4xl font-extrabold tracking-tight text-[var(--pf-text)] sm:text-6xl">
              {slide.title}
            </h2>

            <p className="mt-4 max-w-xl text-lg leading-8 text-[var(--pf-text-soft)]/78">
              {slide.subtitle}
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={slide.link} className={buttonVariants({ variant: "primary", size: "lg" })}>
                Ir a la galería
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
