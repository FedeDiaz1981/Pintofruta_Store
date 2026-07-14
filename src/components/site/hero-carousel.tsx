"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { HeroSlide } from "@/domain/site-content";
import { publicAsset } from "@/lib/catalog";
import { Button, buttonVariants } from "@/components/ui/button";

function resolveHref(href: string) {
  return href.replace("galeria.html", "/galeria").replace("busqueda.html", "/busqueda");
}

export function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
  const orderedSlides = useMemo(() => [...slides].sort((left, right) => left.order - right.order), [slides]);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (orderedSlides.length <= 1) {
      return;
    }

    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % orderedSlides.length);
    }, 5000);

    return () => window.clearInterval(timer);
  }, [orderedSlides.length]);

  if (orderedSlides.length === 0) {
    return null;
  }

  const visibleIndex = activeIndex % orderedSlides.length;

  const goToSlide = (nextIndex: number) => {
    setActiveIndex((nextIndex + orderedSlides.length) % orderedSlides.length);
  };

  return (
    <section className="relative w-full overflow-hidden bg-[var(--pf-surface)]">
      <div className="relative h-[clamp(360px,58vw,640px)] w-full overflow-hidden">
        {orderedSlides.map((slide, index) => {
          const active = index === visibleIndex;

          return (
            <div
              key={slide.id}
              className={`absolute inset-0 transition-opacity duration-700 ease-out ${active ? "opacity-100" : "pointer-events-none opacity-0"}`}
              aria-hidden={!active}
            >
              <picture className="absolute inset-0 block h-full w-full">
                {slide.imageMobile ? <source media="(max-width: 767px)" srcSet={publicAsset(slide.imageMobile)} /> : null}
                <img
                  src={publicAsset(slide.image)}
                  alt={slide.title}
                  className="h-full w-full object-cover object-center"
                  loading={index === 0 ? "eager" : "lazy"}
                  fetchPriority={index === 0 ? "high" : "auto"}
                />
              </picture>

              <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(248,242,232,0.96)_0%,rgba(248,242,232,0.84)_28%,rgba(248,242,232,0.30)_52%,rgba(248,242,232,0.08)_100%)]" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_right_center,rgba(74,57,38,0.18),transparent_40%)]" />

              <div className="relative z-10 flex h-full items-center">
                <div className="pf-shell px-4 sm:px-6 lg:px-12">
                  <div className="max-w-2xl py-10 sm:py-14 lg:py-16">
                    <span className="inline-flex rounded-full bg-secondary/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-secondary">
                      {slide.badge}
                    </span>
                    <h1 className="mt-5 text-4xl font-extrabold tracking-tight text-base-content sm:text-6xl">{slide.title}</h1>
                    <p className="mt-4 max-w-xl text-lg leading-8 text-base-content/78">{slide.subtitle}</p>
                    <div className="mt-8 flex flex-wrap gap-3">
                      <Link href={resolveHref(slide.link)} className={buttonVariants({ variant: "primary", size: "lg" })}>
                        Ir a la galería
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {orderedSlides.length > 1 ? (
          <>
            <Button
              type="button"
              onClick={() => goToSlide(activeIndex - 1)}
              variant="secondary"
              size="icon"
              className="absolute left-4 top-1/2 z-20 -translate-y-1/2 shadow-[0_12px_24px_rgba(74,57,38,0.16)]"
              aria-label="Banner anterior"
            >
              <ChevronLeft className="size-6" />
            </Button>
            <Button
              type="button"
              onClick={() => goToSlide(activeIndex + 1)}
              variant="secondary"
              size="icon"
              className="absolute right-4 top-1/2 z-20 -translate-y-1/2 shadow-[0_12px_24px_rgba(74,57,38,0.16)]"
              aria-label="Banner siguiente"
            >
              <ChevronRight className="size-6" />
            </Button>
          </>
        ) : null}

        {orderedSlides.length > 1 ? (
          <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 gap-2">
            {orderedSlides.map((slide, index) => (
              <button
                key={slide.id}
                type="button"
                onClick={() => setActiveIndex(index)}
                aria-label={`Ir al banner ${index + 1}`}
                className={`h-2.5 rounded-full transition-all ${index === visibleIndex ? "w-8 bg-[var(--pf-primary-darker)]" : "w-2.5 bg-[rgba(74,57,38,0.28)]"}`}
              />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
