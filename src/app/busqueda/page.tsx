import Link from "next/link";
import { CatalogGrid } from "@/components/site/catalog-grid";
import { SectionHeading } from "@/components/site/section-heading";
import { searchCatalog } from "@/application/catalog";
import { buttonVariants } from "@/components/ui/button";

export default function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; brand?: string; category?: string }>;
}) {
  return <SearchPageContent searchParams={searchParams} />;
}

async function SearchPageContent({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; brand?: string; category?: string }>;
}) {
  const params = await searchParams;
  const products = await searchCatalog({
    query: params.q,
    brand: params.brand,
    category: params.category,
  });

  return (
    <main className="pf-shell flex w-full flex-1 flex-col gap-8 px-4 py-6 sm:px-6 lg:px-12 lg:py-10">
      <SectionHeading
        eyebrow="Búsqueda"
        title="Resultados dinámicos"
        description="La búsqueda ya filtra por texto, marca y categoría desde la capa de aplicación."
        action={
          <Link href="/galeria" className={buttonVariants({ variant: "outline", size: "md" })}>
            Ver todo
          </Link>
        }
      />
      <CatalogGrid products={products} />
    </main>
  );
}
