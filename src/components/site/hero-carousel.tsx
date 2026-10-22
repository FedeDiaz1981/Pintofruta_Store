"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import type { HeroSlide } from "@/domain/site-content";
import { publicAsset } from "@/lib/catalog";
import { Button, buttonVariants } from "@/components/ui/button";
import styles from "./hero-carousel.module.css";

function resolveHref(href: string) {
  return href.replace("galeria.html", "/galeria").replace("busqueda.html", "/busqueda");
}

function MobileHeroCarousel({ slides }: { slides: HeroSlide[] }) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: slides.length > 1, align: "start" });
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    if (!emblaApi) return;
    const updateSelection = () => setSelectedIndex(emblaApi.selectedScrollSnap());
    emblaApi.on("select", updateSelection).on("reInit", updateSelection);
    return () => { emblaApi.off("select", updateSelection).off("reInit", updateSelection); };
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi || slides.length <= 1) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      emblaApi.scrollNext();
    }, 5200);

    return () => window.clearInterval(timer);
  }, [emblaApi, slides.length]);

  return (
    <section className={`${styles.mobile} md:hidden`} aria-label="Carrusel principal">
      <div className={styles.viewport}>
        <div ref={emblaRef} className="h-full overflow-hidden">
          <div className="flex h-full touch-pan-y">
            {slides.map((slide, index) => {
              const active = index === selectedIndex;

              return (
                <div key={slide.id} className="h-full min-w-0 flex-[0_0_100%]" aria-hidden={!active} inert={!active}>
                  <article className={styles.slide}>
                    <div className={styles.copy}>
                      <span className={styles.badge}>{slide.badge}</span>
                      <h1 className={styles.title}>{slide.title}</h1>
                      <p className={styles.subtitle}>{slide.subtitle}</p>
                      <Link href={resolveHref(slide.link)} className={`${buttonVariants({ variant: "primary", size: "sm" })} ${styles.link}`}>
                        Ir a la galer&iacute;a
                      </Link>
                    </div>
                    <picture className={styles.picture}>
                      {slide.imageMobile ? <source media="(max-width: 767px)" srcSet={publicAsset(slide.imageMobile)} /> : null}
                      <img
                        src={publicAsset(slide.image)}
                        alt={slide.title}
                        className={styles.image}
                        loading={index === 0 ? "eager" : "lazy"}
                        fetchPriority={index === 0 ? "high" : "auto"}
                      />
                    </picture>

                  </article>
                </div>
              );
            })}
          </div>
        </div>

        {slides.length > 1 ? (
          <div className={styles.pagination}>
            {slides.map((slide, index) => (
              <button
                key={slide.id}
                type="button"
                onClick={() => emblaApi?.scrollTo(index)}
                aria-label={`Ir al banner ${index + 1}`}
                aria-current={index === selectedIndex ? "true" : undefined}
                className={styles.dot}
              />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
  const orderedSlides = useMemo(() => [...slides].sort((left, right) => left.order - right.order), [slides]);
  const [activeIndex, setActiveIndex] = useState(0);
  const desktopHeroRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (orderedSlides.length <= 1) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % orderedSlides.length);
    }, 5000);

    return () => window.clearInterval(timer);
  }, [orderedSlides.length]);

  useEffect(() => {
    if (orderedSlides.length <= 1) {
      return undefined;
    }

    const root = desktopHeroRef.current;

    if (!root) {
      return undefined;
    }

    const previousButton = root.querySelector<HTMLButtonElement>('button[aria-label="Banner anterior"]');
    const nextButton = root.querySelector<HTMLButtonElement>('button[aria-label="Banner siguiente"]');
    const dotButtons = Array.from(root.querySelectorAll<HTMLButtonElement>('button[data-hero-slide-index]'));

    const handlePrevious = () => {
      setActiveIndex((current) => (current - 1 + orderedSlides.length) % orderedSlides.length);
    };

    const handleNext = () => {
      setActiveIndex((current) => (current + 1) % orderedSlides.length);
    };

    const handleDot = (event: Event) => {
      const target = event.currentTarget as HTMLButtonElement | null;
      const nextIndex = Number(target?.dataset.heroSlideIndex);

      if (Number.isNaN(nextIndex)) {
        return;
      }

      setActiveIndex(nextIndex);
    };

    previousButton?.addEventListener("click", handlePrevious);
    nextButton?.addEventListener("click", handleNext);
    dotButtons.forEach((button) => button.addEventListener("click", handleDot));

    return () => {
      previousButton?.removeEventListener("click", handlePrevious);
      nextButton?.removeEventListener("click", handleNext);
      dotButtons.forEach((button) => button.removeEventListener("click", handleDot));
    };
  }, [orderedSlides.length]);

  if (orderedSlides.length === 0) {
    return null;
  }

  const visibleIndex = activeIndex % orderedSlides.length;

  return (
    <>
      <MobileHeroCarousel slides={orderedSlides} />

      <section ref={desktopHeroRef} className="relative hidden w-full bg-transparent md:block">
        <div className="pf-shell px-4 sm:px-6 lg:px-12">
          <div className="relative overflow-visible bg-[var(--pf-surface)]">
            <div className="relative grid h-[clamp(306px,49vw,544px)] w-full grid-cols-[3fr_2fr] overflow-hidden">
            {orderedSlides.map((slide, index) => {
              const active = index === visibleIndex;

              return (
                <div
                  key={slide.id}
                  className={`absolute inset-0 grid grid-cols-[3fr_2fr] transition-opacity duration-700 ease-out ${active ? "opacity-100" : "pointer-events-none opacity-0"}`}
                  aria-hidden={!active}
                >
                  <div className="relative flex h-full items-center overflow-hidden bg-[linear-gradient(90deg,rgba(248,242,232,0.98)_0%,rgba(248,242,232,0.92)_100%)]">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_left_center,rgba(74,57,38,0.08),transparent_54%)]" />
                    <div className="relative z-10 px-4 sm:px-6 lg:pl-[20%] lg:pr-12">
                      <div className="max-w-2xl py-10 sm:py-14 lg:py-16">
                        <span className="inline-flex rounded-full bg-secondary/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-secondary">
                          {slide.badge}
                        </span>
                        <h1 className="mt-5 text-4xl font-extrabold tracking-tight text-base-content sm:text-6xl">{slide.title}</h1>
                        <p className="mt-4 max-w-xl text-lg leading-8 text-base-content/78">{slide.subtitle}</p>
                        <div className="mt-8 flex flex-wrap gap-3">
                          <Link href={resolveHref(slide.link)} className={`${buttonVariants({ variant: "primary", size: "lg" })} !text-white`}>
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
                        loading={index === 0 ? "eager" : "lazy"}
                        fetchPriority={index === 0 ? "high" : "auto"}
                      />
                    </picture>
                  </div>
                </div>
              );
            })}

            {orderedSlides.length > 1 ? (
              <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 gap-2">
                {orderedSlides.map((slide, index) => (
                  <button
                    key={slide.id}
                    type="button"
                    data-hero-slide-index={index}
                    aria-label={`Ir al banner ${index + 1}`}
                    className={`h-2.5 rounded-full transition-all ${index === visibleIndex ? "w-8 bg-[var(--pf-primary-darker)]" : "w-2.5 bg-[rgba(74,57,38,0.28)]"}`}
                  />
                ))}
              </div>
            ) : null}
            </div>

            {orderedSlides.length > 1 ? (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="absolute left-[-1.5rem] top-1/2 z-30 grid h-16 w-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white/70 bg-white/88 shadow-[0_16px_40px_rgba(74,57,38,0.18)] backdrop-blur-xl transition duration-200 hover:-translate-y-1/2 hover:scale-[1.05] hover:bg-white/95"
                  aria-label="Banner anterior"
                >
                  <ChevronLeft className="size-8" />
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="absolute right-[-1.5rem] top-1/2 z-30 grid h-16 w-16 translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white/70 bg-white/88 shadow-[0_16px_40px_rgba(74,57,38,0.18)] backdrop-blur-xl transition duration-200 hover:-translate-y-1/2 hover:scale-[1.05] hover:bg-white/95"
                  aria-label="Banner siguiente"
                >
                  <ChevronRight className="size-8" />
                </Button>
              </>
            ) : null}
          </div>
        </div>
      </section>
    </>
  );
}
