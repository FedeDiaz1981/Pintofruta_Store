import Link from "next/link";
import { searchCatalog } from "@/application/catalog";
import { CatalogGrid } from "@/components/site/catalog-grid";
import { SectionHeading } from "@/components/site/section-heading";

export default function GalleryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; brand?: string; category?: string }>;
}) {
  return <GalleryPageContent searchParams={searchParams} />;
}

async function GalleryPageContent({
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
        eyebrow="Catálogo"
        title="Galería de productos"
        description="Esta vista ya responde a filtros por marca o categoría desde la navegación."
        action={
          <Link href="/busqueda" className="btn btn-outline rounded-full normal-case">
            Ir a búsqueda
          </Link>
        }
      />
      <CatalogGrid products={products} />
    </main>
  );
}
