import Link from "next/link";
import type { HeroSlide } from "@/domain/site-content";
import { publicAsset } from "@/lib/catalog";
import { buttonVariants } from "@/components/ui/button";

export function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
  return (
    <div className="carousel w-full rounded-[2.25rem] border border-base-300 bg-base-100 shadow-xl">
      {slides.map((slide) => (
        <div key={slide.id} className="carousel-item relative w-full">
          <div className="relative min-h-[420px] w-full overflow-hidden rounded-[2.25rem]">
            <picture className="absolute inset-0 block">
              {slide.imageMobile ? (
                <source media="(max-width: 767px)" srcSet={publicAsset(slide.imageMobile)} />
              ) : null}
              <img
                src={publicAsset(slide.image)}
                alt={slide.title}
                className="h-full w-full object-cover"
                loading={slide.order === 1 ? "eager" : "lazy"}
                fetchPriority={slide.order === 1 ? "high" : "auto"}
              />
            </picture>
            <div className="absolute inset-0 bg-gradient-to-r from-base-100/90 via-base-100/70 to-transparent" />
            <div className="relative z-10 flex min-h-[420px] items-center px-6 py-10 sm:px-12 lg:px-16">
              <div className="max-w-2xl">
                <span className="inline-flex rounded-full bg-secondary/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-secondary">
                  {slide.badge}
                </span>
                <h1 className="mt-5 text-4xl font-extrabold tracking-tight text-base-content sm:text-6xl">{slide.title}</h1>
                <p className="mt-4 max-w-xl text-lg leading-8 text-base-content/78">{slide.subtitle}</p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Link
                    href={slide.link.replace("galeria.html", "/galeria").replace("busqueda.html", "/busqueda")}
                    className={buttonVariants({ variant: "primary", size: "lg" })}
                  >
                    Ir a la galería
                  </Link>
                  <Link href="/busqueda" className={buttonVariants({ variant: "ghost", size: "lg" })}>
                    Buscar productos
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
