import Image from "next/image";
import Link from "next/link";
import { BrandLogoWall } from "@/components/site/brand-logo-wall";
import { FeaturedProductsCarousel } from "@/components/site/featured-products-carousel";
import { HeroCarousel } from "@/components/site/hero-carousel";
import { SectionHeading } from "@/components/site/section-heading";
import { getHomePageViewModel } from "@/application/catalog";
import { publicAsset } from "@/lib/catalog";

export default async function HomePage() {
  const content = await getHomePageViewModel();
  const aboutImage = content.heroSlides.find((slide) => slide.homeSpotlight)?.image ?? content.heroSlides[0]?.image;

  return (
    <main className="pf-shell flex w-full flex-1 flex-col gap-10 px-4 py-6 sm:px-6 lg:px-12 lg:py-10">
      <HeroCarousel slides={content.heroSlides} />

      <section id="featured-products" className="space-y-5">
        <SectionHeading
          eyebrow="Colección / destacados"
          title="Productos destacados"
          action={
            <Link href="/galeria" className="btn btn-outline rounded-full normal-case">
              Ver catálogo
            </Link>
          }
        />
        <FeaturedProductsCarousel products={content.featuredProducts} />
      </section>

      <section>
        <div className="space-y-5 rounded-[2rem] border border-[var(--pf-border-warm)] bg-[linear-gradient(180deg,var(--pf-surface-warm)_0%,var(--pf-sand-soft)_58%,var(--pf-surface-strong)_100%)] p-6 shadow-sm lg:p-8">
          <SectionHeading eyebrow="Identidad" title="Marcas destacadas" />
          <BrandLogoWall brands={content.brands} />
        </div>
      </section>

      <section id="trending-products" className="space-y-5">
        <SectionHeading
          eyebrow="Colección / tendencias"
          title="Tendencias"
          action={
            <Link href="/galeria" className="btn btn-outline rounded-full normal-case">
              Ver catálogo
            </Link>
          }
        />
        <FeaturedProductsCarousel products={content.trendingProducts} />
      </section>

      <section
        id="Nosotros"
        className="grid gap-5 rounded-[2rem] border border-[var(--pf-border-warm)] bg-[linear-gradient(180deg,var(--pf-surface-warm)_0%,var(--pf-sand-soft)_58%,var(--pf-surface-strong)_100%)] p-6 shadow-sm lg:grid-cols-[1.1fr_.9fr] lg:p-8"
      >
        <div className="relative overflow-hidden rounded-[1.75rem] border border-[var(--pf-border-warm)] bg-[linear-gradient(180deg,rgba(250,252,247,0.98),rgba(242,239,231,0.95))] p-6 shadow-[0_22px_50px_rgba(74,57,38,0.12)]">
          <span className="inline-flex rounded-full bg-[rgba(168,109,69,0.12)] px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-[var(--pf-primary-darker)]">
            Nosotros
          </span>
          <h2 className="pf-section-title mt-4 text-3xl font-black tracking-tight sm:text-5xl">Somos Pintofruta</h2>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/busqueda" className="btn pf-btn-rounded rounded-full normal-case">
              Ir a búsqueda
            </Link>
            <Link href="/galeria" className="btn btn-outline rounded-full normal-case">
              Ver galería
            </Link>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {content.stats.map((stat) => (
              <div
                key={stat.label}
                className="rounded-[1.25rem] border border-[var(--pf-border-soft)] bg-[rgba(248,242,232,0.96)] p-4 text-center"
              >
                <p className="text-3xl font-black text-[var(--pf-primary-darker)]">{stat.value}</p>
                <p className="mt-1 text-xs font-bold uppercase tracking-[0.28em] text-[var(--pf-muted)]">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="overflow-hidden rounded-[1.75rem] border border-[var(--pf-border-warm)] bg-[linear-gradient(180deg,rgba(250,252,247,0.98),rgba(240,233,220,0.94))] p-5 shadow-[0_20px_46px_rgba(74,57,38,0.10)]">
          <div className="relative min-h-[320px] overflow-hidden rounded-[1.35rem]">
            {aboutImage ? (
              <Image
                src={publicAsset(aboutImage)}
                alt="Pintofruta"
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 40vw"
              />
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}
