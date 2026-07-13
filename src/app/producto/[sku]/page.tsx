import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProductBySku } from "@/application/catalog";
import { formatCurrency, publicAsset } from "@/lib/catalog";

export default async function ProductPage({
  params,
}: {
  params: Promise<{ sku: string }>;
}) {
  const { sku } = await params;
  const product = await getProductBySku(sku);

  if (!product) {
    notFound();
  }

  return (
    <main className="pf-shell flex w-full flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-12 lg:py-10">
      <Link href="/galeria" className="text-sm font-semibold text-primary hover:underline">
        ← Volver a la galería
      </Link>
      <section className="grid gap-6 rounded-[2rem] border border-[var(--pf-border)] bg-[var(--pf-surface)] p-5 shadow-sm lg:grid-cols-[1.1fr_.9fr]">
        <div className="relative min-h-[420px] overflow-hidden rounded-[2rem] bg-base-200">
          <Image
            src={publicAsset(product.image)}
            alt={product.name}
            fill
            className="object-contain p-6"
            sizes="(max-width: 1024px) 100vw, 55vw"
            priority
          />
        </div>
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.32em] text-secondary">Ficha de producto</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-base-content sm:text-5xl">
              {product.name}
            </h1>
            <p className="mt-3 text-base leading-7 text-base-content/70">{product.description || product.detail}</p>
          </div>

          <div className="rounded-[1.75rem] border border-[var(--pf-border)] bg-base-200/60 p-5">
            <p className="text-xs uppercase tracking-[0.28em] text-base-content/50">Precio</p>
            <p className="mt-2 text-4xl font-black text-base-content">{formatCurrency(product.publicPrice)}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-3xl border border-[var(--pf-border)] bg-base-100 p-4">
              <p className="text-xs uppercase tracking-[0.28em] text-base-content/50">Marca</p>
              <p className="mt-1 text-lg font-bold">{product.brand}</p>
            </div>
            <div className="rounded-3xl border border-[var(--pf-border)] bg-base-100 p-4">
              <p className="text-xs uppercase tracking-[0.28em] text-base-content/50">Categoría</p>
              <p className="mt-1 text-lg font-bold">{product.categoryName}</p>
            </div>
          </div>

          <div className="mt-auto flex flex-wrap gap-3">
            <button className="btn pf-btn-rounded rounded-full normal-case">Agregar al carrito</button>
            <Link href="/busqueda" className="btn btn-ghost rounded-full normal-case">
              Seguir buscando
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
