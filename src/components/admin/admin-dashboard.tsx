import Link from "next/link";
import { formatCurrency } from "@/lib/catalog";
import type { AdminOverview } from "@/application/admin";

function AdminMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-3xl border border-[var(--pf-border)] bg-base-100 p-4">
      <p className="text-xs uppercase tracking-[0.28em] text-base-content/50">{label}</p>
      <p className="mt-1 text-3xl font-black">{value}</p>
    </div>
  );
}

export function AdminDashboard({ admin }: { admin: AdminOverview }) {
  return (
    <main className="pf-shell flex w-full flex-1 flex-col gap-8 px-4 py-6 sm:px-6 lg:px-12 lg:py-10">
      <section className="rounded-[2rem] border border-[var(--pf-border)] bg-[var(--pf-surface)] p-6 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.32em] text-secondary">Admin</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight text-base-content">Panel local conectado a Postgres</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-base-content/70">
          Este tablero ya está leyendo la base local. Sirve como primer puente entre la maqueta y el futuro panel de
          mantenimiento.
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <AdminMetric label="products" value={admin.counts.products} />
          <AdminMetric label="brands" value={admin.counts.brands} />
          <AdminMetric label="categories" value={admin.counts.categories} />
          <AdminMetric label="users" value={admin.counts.users} />
          <AdminMetric label="heroSlides" value={admin.counts.heroSlides} />
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.2fr_.8fr]">
        <div className="rounded-[2rem] border border-[var(--pf-border)] bg-[var(--pf-surface)] p-6 shadow-sm">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.32em] text-secondary">Catálogo</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight text-base-content">Productos destacados</h2>
            </div>
            <Link href="/galeria" className="btn btn-outline rounded-full normal-case">
              Ver catálogo
            </Link>
          </div>
          <div className="mt-6 overflow-hidden rounded-[1.5rem] border border-[var(--pf-border)]">
            <div className="grid grid-cols-[1.5fr_.8fr_.8fr] bg-base-200 px-4 py-3 text-xs font-bold uppercase tracking-[0.24em] text-base-content/50">
              <span>Producto</span>
              <span>Precio</span>
              <span>Stock</span>
            </div>
            <div className="divide-y divide-[var(--pf-border)]">
              {admin.featuredProducts.map((product) => (
                <div key={product.id} className="grid grid-cols-[1.5fr_.8fr_.8fr] gap-3 px-4 py-4 text-sm">
                  <div>
                    <p className="font-bold text-base-content">{product.name}</p>
                    <p className="mt-1 text-base-content/60">{product.brand}</p>
                  </div>
                  <p className="font-semibold text-base-content">{formatCurrency(product.publicPrice)}</p>
                  <p className="font-semibold text-base-content">{product.stock ?? "Sin dato"}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <section className="rounded-[2rem] border border-[var(--pf-border)] bg-[var(--pf-surface)] p-6 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.32em] text-secondary">Panel activo</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-base-content">{admin.currentPanel}</h2>
            <p className="mt-3 text-sm leading-7 text-base-content/70">
              Este valor viene del registro de configuración que hoy vive en la base y mañana puede pasar al panel
              completo sin tocar la UI principal.
            </p>
          </section>

          <section className="rounded-[2rem] border border-[var(--pf-border)] bg-[var(--pf-surface)] p-6 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.32em] text-secondary">Usuarios</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-base-content">Activos</h2>
            <div className="mt-4 space-y-3">
              {admin.activeUsers.map((user) => (
                <div key={user.id} className="rounded-2xl border border-[var(--pf-border)] bg-base-100 px-4 py-3">
                  <p className="font-bold text-base-content">{user.name}</p>
                  <p className="text-sm text-base-content/60">{user.email}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[2rem] border border-[var(--pf-border)] bg-[var(--pf-surface)] p-6 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.32em] text-secondary">Base</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-base-content">Listo para crecer</h2>
            <p className="mt-3 text-sm leading-7 text-base-content/70">
              El contenido ya está dividido en tablas y esta vista lee desde Postgres local, así que la próxima capa
              puede ser edición real sin rehacer la estructura.
            </p>
          </section>
        </div>
      </section>
    </main>
  );
}

