import Link from "next/link";
import { formatCurrency } from "@/lib/catalog";
import type { AdminOverview } from "@/application/admin";

function AdminMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-[132px] overflow-hidden rounded-3xl border border-[var(--pf-border)] bg-[rgba(255,255,255,0.9)] p-4 shadow-[0_10px_22px_rgba(58,44,25,0.06)]">
      <p className="truncate text-[9px] font-black uppercase leading-none tracking-[0.22em] text-[var(--pf-muted)]">{label}</p>
      <p className="mt-1 text-3xl font-black text-[var(--pf-text)]">{value}</p>
    </div>
  );
}

export function AdminDashboard({ admin }: { admin: AdminOverview }) {
  return (
    <main className="pf-admin pf-shell flex w-full flex-1 flex-col gap-8 px-4 py-6 text-[var(--pf-text)] sm:px-6 lg:px-12 lg:py-10">
      <section className="rounded-[2rem] border border-[var(--pf-border)] bg-[rgba(255,250,242,0.94)] p-6 shadow-[0_18px_40px_rgba(58,44,25,0.08)]">
        <p className="text-xs font-bold uppercase tracking-[0.32em] text-[var(--pf-secondary)]">Admin</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight text-[var(--pf-text)]">
          Panel local conectado a Postgres
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--pf-muted)]">
          Este tablero ya está leyendo la base local. Sirve como primer puente entre la maqueta y el futuro panel de
          mantenimiento.
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:w-[860px] xl:grid-cols-6 2xl:w-[960px]">
          <AdminMetric label="Productos" value={admin.counts.products} />
          <AdminMetric label="Promociones" value={admin.counts.packs} />
          <AdminMetric label="Marcas" value={admin.counts.brands} />
          <AdminMetric label="Categorías" value={admin.counts.categories} />
          <AdminMetric label="Usuarios" value={admin.counts.users} />
          <AdminMetric label="Carrusel" value={admin.counts.heroSlides} />
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.2fr_.8fr]">
        <div className="rounded-[2rem] border border-[var(--pf-border)] bg-[rgba(255,250,242,0.94)] p-6 shadow-[0_18px_40px_rgba(58,44,25,0.08)]">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.32em] text-[var(--pf-secondary)]">Catálogo</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight text-[var(--pf-text)]">Productos destacados</h2>
            </div>
            <Link
              href="/galeria"
              className="inline-flex h-11 items-center justify-center rounded-full border border-[var(--pf-border)] px-5 text-sm font-semibold text-[var(--pf-primary-darker)] transition hover:bg-[rgba(255,255,255,0.7)]"
            >
              Ver catálogo
            </Link>
          </div>

          <div className="mt-6 overflow-hidden rounded-[1.5rem] border border-[var(--pf-border)] bg-white">
            <div className="grid grid-cols-[1.5fr_.8fr_.8fr] bg-[rgba(248,242,232,0.88)] px-4 py-3 text-xs font-bold uppercase tracking-[0.24em] text-[var(--pf-muted)]">
              <span>Producto</span>
              <span>Precio</span>
              <span>Stock</span>
            </div>
            <div className="divide-y divide-[var(--pf-border)] bg-white">
              {admin.featuredProducts.map((product) => (
                <div key={product.id} className="grid grid-cols-[1.5fr_.8fr_.8fr] gap-3 px-4 py-4 text-sm">
                  <div>
                    <p className="font-bold text-[var(--pf-text)]">{product.name}</p>
                    <p className="mt-1 text-[var(--pf-muted)]">{product.brand}</p>
                  </div>
                  <p className="font-semibold text-[var(--pf-text)]">{formatCurrency(product.publicPrice)}</p>
                  <p className="font-semibold text-[var(--pf-text)]">{product.stock ?? "Sin dato"}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <section className="rounded-[2rem] border border-[var(--pf-border)] bg-[rgba(255,250,242,0.94)] p-6 shadow-[0_18px_40px_rgba(58,44,25,0.08)]">
            <p className="text-xs font-bold uppercase tracking-[0.32em] text-[var(--pf-secondary)]">Panel activo</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-[var(--pf-text)]">{admin.currentPanel}</h2>
            <p className="mt-3 text-sm leading-7 text-[var(--pf-muted)]">
              Este valor viene del registro de configuración que hoy vive en la base y mañana puede pasar al panel
              completo sin tocar la UI principal.
            </p>
          </section>

          <section className="rounded-[2rem] border border-[var(--pf-border)] bg-[rgba(255,250,242,0.94)] p-6 shadow-[0_18px_40px_rgba(58,44,25,0.08)]">
            <p className="text-xs font-bold uppercase tracking-[0.32em] text-[var(--pf-secondary)]">Usuarios</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-[var(--pf-text)]">Activos</h2>
            <div className="mt-4 space-y-3">
              {admin.activeUsers.map((user) => (
                <div key={user.id} className="rounded-2xl border border-[var(--pf-border)] bg-white px-4 py-3">
                  <p className="font-bold text-[var(--pf-text)]">{user.name}</p>
                  <p className="text-sm text-[var(--pf-muted)]">{user.email}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[2rem] border border-[var(--pf-border)] bg-[rgba(255,250,242,0.94)] p-6 shadow-[0_18px_40px_rgba(58,44,25,0.08)]">
            <p className="text-xs font-bold uppercase tracking-[0.32em] text-[var(--pf-secondary)]">Base</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-[var(--pf-text)]">Listo para crecer</h2>
            <p className="mt-3 text-sm leading-7 text-[var(--pf-muted)]">
              El contenido ya está dividido en tablas y esta vista lee desde Postgres local, así que la próxima capa
              puede ser edición real sin rehacer la estructura.
            </p>
          </section>
        </div>
      </section>
    </main>
  );
}


