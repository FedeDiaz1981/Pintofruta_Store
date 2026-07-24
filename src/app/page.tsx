import Image from "next/image";
import Link from "next/link";
import { getHomePageViewModel } from "@/application/catalog";
import { CategoryMenuStrip } from "@/components/site/category-menu-strip";
import { BrandLogoWall } from "@/components/site/brand-logo-wall";
import { FeaturedProductsCarousel } from "@/components/site/featured-products-carousel";
import { HeroCarousel } from "@/components/site/hero-carousel";
import { PromotionCarousel } from "@/components/site/promotion-carousel";
import { SectionHeading } from "@/components/site/section-heading";
import { SpotlightBanner } from "@/components/site/spotlight-banner";
import { buttonVariants } from "@/components/ui/button";

export default async function HomePage() {
  const content = await getHomePageViewModel();

  return (
    <main className="flex w-full flex-1 flex-col gap-0 px-0 py-0">
      <HeroCarousel slides={content.heroSlides} />

      <CategoryMenuStrip categories={content.homeMenuCategories} />

      <div className="pf-shell flex flex-col gap-10 px-4 pb-6 pt-8 sm:px-6 sm:pt-10 lg:px-12 lg:pb-10 lg:pt-12">
        <section id="featured-products" className="space-y-5">
          <SectionHeading
            eyebrow="Colección / destacados"
            title="Productos destacados"
            action={
              <Link href="/galeria?featured=1" className={buttonVariants({ variant: "outline", size: "md" })}>
                Ver todos
              </Link>
            }
          />
          <FeaturedProductsCarousel products={content.featuredProducts} />
        </section>
      </div>

      <div className="mt-6 sm:mt-8 lg:mt-10">
        <SpotlightBanner slide={content.spotlightSlide} />
      </div>

      <section className="w-full bg-[linear-gradient(180deg,var(--pf-surface-warm)_0%,var(--pf-sand-soft)_48%,var(--pf-surface-strong)_100%)] py-10 sm:py-12 lg:py-14">
        <div className="pf-shell px-4 sm:px-6 lg:px-12">
          <div className="space-y-5">
            <SectionHeading eyebrow="Identidad" title="Marcas destacadas" />
            <BrandLogoWall brands={content.brands} />
          </div>
        </div>
      </section>

      <div className="pf-shell flex flex-col gap-10 px-4 py-6 sm:px-6 lg:px-12 lg:py-10">
        <section id="promociones" className="space-y-5">
          <SectionHeading
            eyebrow="Colección / promociones"
            title="Promociones"
            action={
              <Link href="/galeria?type=packs" className={buttonVariants({ variant: "outline", size: "md" })}>
                Ver todos
              </Link>
            }
          />
          <PromotionCarousel promotions={content.activePromotions} />
        </section>
      </div>

      <section
        id="Nosotros"
        className="w-full bg-[linear-gradient(180deg,var(--pf-surface-warm)_0%,var(--pf-sand-soft)_48%,var(--pf-surface-strong)_100%)] py-10 sm:py-12 lg:py-14"
      >
        <div className="pf-shell px-4 sm:px-6 lg:px-12">
          <div className="grid gap-8 lg:grid-cols-[1.15fr_.95fr] lg:gap-10">
            <div className="flex flex-col justify-between">
              <div>
                <span className="inline-flex rounded-full bg-[rgba(168,109,69,0.14)] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--pf-primary-darker)]">
                  Quienes somos
                </span>
                <h2 className="mt-3 max-w-xl text-[2.15rem] font-light leading-[0.96] tracking-[-0.05em] text-[var(--pf-text)] sm:text-[2.75rem] lg:text-[3.15rem]">
                  Conectamos marcas, productos y personas.
                </h2>
                <div className="mt-4 space-y-3 text-[0.92rem] leading-6 text-[var(--pf-muted)] sm:text-[0.98rem]">
                  <p>
                    Somos un equipo de profesionales con foco en alimentos saludables, abastecimiento ordenado y una experiencia de compra
                    simple. Nacimos trabajando con propuestas plant based y, con el tiempo, ampliamos la oferta para acompanar el crecimiento
                    del canal natural, las dieteticas y los consumidores que buscan variedad y confianza.
                  </p>
                  <p>
                    Con la experiencia acumulada fuimos construyendo una operacion capaz de reunir marcas lideres, pequenos productores y
                    soluciones de logistica que permiten llegar con franjas horarias claras, stock controlado y atencion personalizada.
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-[1.25rem] border border-[rgba(212,189,156,0.55)] bg-[rgba(237,220,195,0.55)] px-4 py-3 text-[0.88rem] leading-6 text-[var(--pf-text)] sm:text-[0.95rem]">
                <strong className="font-semibold text-[var(--pf-primary-darker)]">Creemos en relaciones de largo plazo:</strong>{" "}
                cada pedido, cada consulta y cada entrega forman parte de una misma idea, hacer que comprar saludable sea mas facil, mas
                ordenado y mas confiable.
              </div>

              <div className="mt-4 border-t border-[rgba(212,189,156,0.4)] pt-3 text-[0.85rem] leading-6 text-[var(--pf-muted)]">
                Gracias por confiar y contar con nosotros. Estamos seguros de que, trabajando juntos, podemos seguir armando un gran equipo.
              </div>
            </div>

            <div className="rounded-[1.5rem] bg-[rgba(248,242,232,0.74)] p-0">
              <div className="overflow-hidden rounded-[1.3rem] bg-[rgba(249,247,240,0.96)] px-4 py-5 sm:px-5 sm:py-6">
                <div className="relative mx-auto h-[170px] w-full max-w-[560px] sm:h-[210px]">
                  <Image
                    src="/assets/images/logo/logo-Pintofruta.png"
                    alt="Pintofruta"
                    fill
                    className="object-contain"
                    sizes="(max-width: 1024px) 100vw, 40vw"
                  />
                </div>
              </div>

              <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
                {content.stats.map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-[1.1rem] border border-[rgba(212,189,156,0.5)] bg-[rgba(251,248,241,0.92)] px-3 py-3.5 text-center"
                  >
                    <p className="text-[1.7rem] font-black tracking-tight text-[var(--pf-primary-darker)]">{stat.value}</p>
                    <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.24em] text-[var(--pf-muted)]">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
