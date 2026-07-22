import Link from "next/link";
import type { HeroSlide } from "@/domain/site-content";
import { publicAsset } from "@/lib/catalog";

export function SpotlightBanner({ slide }: { slide: HeroSlide | null }) {
  if (!slide) {
    return null;
  }

  return (
    <section className="w-full overflow-hidden bg-transparent">
      <div className="relative w-full overflow-hidden rounded-none bg-[linear-gradient(180deg,rgba(250,244,234,0.9),rgba(243,233,214,0.92))] aspect-[625/1000] md:aspect-[3/1]">
        <picture className="absolute inset-0 block h-full w-full">
          {slide.imageMobile ? <source media="(max-width: 767px)" srcSet={publicAsset(slide.imageMobile)} /> : null}
          <img
            src={publicAsset(slide.image)}
            alt={slide.title}
            className="block h-full w-full object-cover object-center"
            loading="lazy"
          />
        </picture>

        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(248,240,228,0.94)_0%,rgba(248,240,228,0.78)_24%,rgba(248,240,228,0.18)_56%,rgba(248,240,228,0)_100%)]" />

        <div className="relative z-10 flex h-full items-center px-4 py-8 sm:px-6 md:px-10 lg:px-14">
          <div className="max-w-xl rounded-[1.8rem] border border-[rgba(168,109,69,0.14)] bg-[rgba(250,246,239,0.72)] p-5 shadow-[0_20px_50px_rgba(74,57,38,0.12)] backdrop-blur-sm sm:p-6 lg:p-8">
            <span className="inline-flex rounded-full bg-[rgba(168,109,69,0.14)] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--pf-primary-darker)]">
              {slide.badge}
            </span>

            <h2 className="mt-4 max-w-lg text-3xl font-black leading-[0.95] tracking-[-0.05em] text-[var(--pf-text)] sm:text-4xl lg:text-5xl">
              {slide.title}
            </h2>

            <p className="mt-4 max-w-lg text-sm leading-6 text-[var(--pf-muted)] sm:text-base">
              {slide.subtitle}
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href={slide.link}
                className="inline-flex items-center justify-center rounded-full bg-[linear-gradient(180deg,var(--pf-secondary-light)_0%,var(--pf-secondary)_100%)] px-5 py-3 text-sm font-black text-slate-900 shadow-[0_14px_30px_rgba(168,109,69,0.24)] transition hover:brightness-105"
              >
                Ir a la galería
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
