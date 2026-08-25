import Link from "next/link";

import type { HeroSlide } from "@/domain/site-content";

import { buttonVariants } from "@/components/ui/button";
import { publicAsset } from "@/lib/catalog";

export function SpotlightBanner({ slide }: { slide: HeroSlide | null }) {
  if (!slide) {
    return null;
  }

  return (
    <section className="relative w-full bg-transparent">
      <div className="pf-shell px-4 sm:px-6 lg:px-12">
        <div className="relative overflow-visible bg-[var(--pf-surface)]">
          <div className="relative grid h-[clamp(306px,49vw,544px)] w-full grid-cols-[3fr_2fr] overflow-hidden">
            <div className="relative flex h-full items-center overflow-hidden bg-[linear-gradient(90deg,rgba(248,242,232,0.98)_0%,rgba(248,242,232,0.92)_100%)]">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_left_center,rgba(74,57,38,0.08),transparent_54%)]" />
              <div className="relative z-10 px-4 sm:px-6 lg:pl-[20%] lg:pr-12">
                <div className="max-w-2xl py-10 sm:py-14 lg:py-16">
                  <span className="inline-flex rounded-full bg-secondary/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-secondary">
                    {slide.badge}
                  </span>
                  <h2 className="mt-5 text-4xl font-extrabold tracking-tight text-base-content sm:text-6xl">{slide.title}</h2>
                  <p className="mt-4 max-w-xl text-lg leading-8 text-base-content/78">{slide.subtitle}</p>
                  <div className="mt-8 flex flex-wrap gap-3">
                    <Link href={slide.link} className={`${buttonVariants({ variant: "primary", size: "lg" })} !text-white`}>
                      Ir a la galería
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            <div className="relative flex items-center justify-end overflow-hidden bg-[linear-gradient(180deg,rgba(248,242,232,0.98)_0%,rgba(248,242,232,0.94)_100%)]">
              <picture className="block h-full w-full">
                {slide.imageMobile ? <source media="(max-width: 767px)" srcSet={publicAsset(slide.imageMobile)} /> : null}
                <img
                  src={publicAsset(slide.image)}
                  alt={slide.title}
                  className="h-full w-full object-contain object-right"
                  loading="lazy"
                />
              </picture>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
