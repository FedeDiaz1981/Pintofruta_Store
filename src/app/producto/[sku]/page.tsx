import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { recordProductView } from "@/app/catalog-actions";
import { getProductBySku } from "@/application/catalog";
import { CartAddButton } from "@/components/cart/cart-add-button";
import { formatCurrency, publicAsset } from "@/lib/catalog";
import { buttonVariants } from "@/components/ui/button";

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

  await recordProductView(product.id).catch(() => undefined);

  return (
    <main className="pf-shell flex w-full flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-12 lg:py-10">
      <Link href="/galeria" className="text-sm font-semibold text-[var(--pf-primary-dark)] hover:underline">
        ← Volver a la galería
      </Link>
      <section className="grid gap-6 rounded-[2rem] border border-[var(--pf-border)] bg-[var(--pf-surface)] p-5 shadow-sm lg:grid-cols-[1.1fr_.9fr]">
        <div className="relative min-h-[420px] overflow-hidden rounded-[2rem] bg-[rgba(248,242,232,0.82)]">
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
            <p className="text-xs font-bold uppercase tracking-[0.32em] text-[var(--pf-secondary-dark)]">Ficha de producto</p>
            <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-[var(--pf-text)] sm:text-5xl">{product.name}</h1>
            <p className="mt-3 text-base leading-7 text-[var(--pf-muted)]">{product.description || product.detail}</p>
          </div>

          <div className="rounded-[1.75rem] border border-[var(--pf-border)] bg-[rgba(237,220,195,0.55)] p-5">
            <p className="text-xs uppercase tracking-[0.28em] text-[var(--pf-muted)]">Precio</p>
            <p className="mt-2 text-4xl font-extrabold text-[var(--pf-text)]">{formatCurrency(product.publicPrice)}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-3xl border border-[var(--pf-border)] bg-[rgba(255,255,255,0.8)] p-4">
              <p className="text-xs uppercase tracking-[0.28em] text-[var(--pf-muted)]">Marca</p>
              <p className="mt-1 text-lg font-semibold">{product.brand}</p>
            </div>
            <div className="rounded-3xl border border-[var(--pf-border)] bg-[rgba(255,255,255,0.8)] p-4">
              <p className="text-xs uppercase tracking-[0.28em] text-[var(--pf-muted)]">Categoría</p>
              <p className="mt-1 text-lg font-semibold">{product.categoryName}</p>
            </div>
          </div>

          <div className="mt-auto flex flex-wrap gap-3">
            <CartAddButton product={product} className={buttonVariants({ variant: "primary", size: "md" })}>
              Agregar al pedido
            </CartAddButton>
            <Link href="/busqueda" className={buttonVariants({ variant: "ghost", size: "md" })}>
              Seguir buscando
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
