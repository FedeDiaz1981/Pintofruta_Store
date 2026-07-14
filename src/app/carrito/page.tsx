import Link from "next/link";
import { getHomePageViewModel } from "@/application/catalog";
import { formatCurrency } from "@/lib/catalog";
import { buttonVariants } from "@/components/ui/button";

export default async function CartPage() {
  const home = await getHomePageViewModel();
  const total = home.featuredProducts.reduce((sum, product) => sum + product.publicPrice, 0);

  return (
    <main className="pf-shell flex w-full flex-1 flex-col gap-6 px-4 py-8 sm:px-6 lg:px-12 lg:py-10">
      <section className="rounded-[2rem] border border-[var(--pf-border)] bg-[var(--pf-surface)] p-6 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.32em] text-[var(--pf-secondary-dark)]">Pedido</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight text-[var(--pf-text)]">Mi pedido demo</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--pf-muted)]">
          Esta pantalla queda como base para el pedido/checkout del proyecto dinámico. Luego se puede conectar a modal,
          persistencia y exportación PDF.
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-3xl border border-[var(--pf-border)] bg-[rgba(248,242,232,0.85)] p-4">
            <p className="text-xs uppercase tracking-[0.28em] text-[var(--pf-muted)]">Artículos</p>
            <p className="mt-1 text-3xl font-black">{home.featuredProducts.length}</p>
          </div>
          <div className="rounded-3xl border border-[var(--pf-border)] bg-[rgba(248,242,232,0.85)] p-4">
            <p className="text-xs uppercase tracking-[0.28em] text-[var(--pf-muted)]">Total</p>
            <p className="mt-1 text-3xl font-black">{formatCurrency(total)}</p>
          </div>
          <div className="rounded-3xl border border-[var(--pf-border)] bg-[rgba(248,242,232,0.85)] p-4">
            <p className="text-xs uppercase tracking-[0.28em] text-[var(--pf-muted)]">Estado</p>
            <p className="mt-1 text-3xl font-black">Demo</p>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <button className={buttonVariants({ variant: "primary", size: "md" })}>Enviar pedido</button>
          <Link href="/galeria" className={buttonVariants({ variant: "ghost", size: "md" })}>
            Seguir comprando
          </Link>
        </div>
      </section>
    </main>
  );
}
