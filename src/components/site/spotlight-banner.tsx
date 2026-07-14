import type { HeroSlide } from "@/domain/site-content";
import { publicAsset } from "@/lib/catalog";

export function SpotlightBanner({ slide }: { slide: HeroSlide | null }) {
  if (!slide) {
    return null;
  }

  return (
    <section className="w-full overflow-hidden bg-transparent">
      <div className="relative w-full overflow-hidden aspect-[625/1000] md:aspect-[3/1]">
        <picture className="absolute inset-0 block h-full w-full">
          {slide.imageMobile ? <source media="(max-width: 767px)" srcSet={publicAsset(slide.imageMobile)} /> : null}
          <img
            src={publicAsset(slide.image)}
            alt={slide.title}
            className="block h-full w-full object-contain object-center"
            loading="lazy"
          />
        </picture>
      </div>
    </section>
  );
}
