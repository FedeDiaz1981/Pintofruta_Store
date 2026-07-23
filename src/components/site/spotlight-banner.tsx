import Link from "next/link";
import type { HeroSlide } from "@/domain/site-content";
import { publicAsset } from "@/lib/catalog";
import { buttonVariants } from "@/components/ui/button";

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

        <div className="absolute inset-0 z-10 flex items-start sm:relative sm:flex sm:h-full sm:items-center sm:justify-end">
          <div className="w-full px-4 pb-4 pt-12 sm:ml-auto sm:w-full sm:px-6 sm:py-14 lg:max-w-[46%] lg:px-12 lg:py-16 xl:max-w-[40%]">
            <span className="inline-flex rounded-full bg-[rgba(168,109,69,0.14)] px-4 py-2 text-[11px] font-black uppercase tracking-[0.34em] text-[var(--pf-primary-darker)] shadow-[0_8px_18px_rgba(74,57,38,0.08)]">
              {slide.badge}
            </span>

            <h2 className="mt-4 max-w-[10ch] text-[3rem] font-extrabold leading-[0.9] tracking-[-0.065em] text-[var(--pf-text)]">
              {slide.title}
            </h2>

            <p className="mt-4 max-w-[22ch] text-[1.05rem] leading-7 text-[var(--pf-text-soft)]">
              {slide.subtitle}
            </p>

            <div className="mt-6">
              <Link href={slide.link} className={buttonVariants({ variant: "primary", size: "lg" })}>
                Ir a la galerÃ­a
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
