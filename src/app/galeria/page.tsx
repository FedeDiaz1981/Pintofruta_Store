import Link from "next/link";
import { getGalleryPageViewModel, getPacksGalleryPageViewModel } from "@/application/catalog";
import { CatalogGrid } from "@/components/site/catalog-grid";
import { PackGrid } from "@/components/site/pack-grid";
import { buttonVariants } from "@/components/ui/button";

type GallerySearchParams = {
  q?: string;
  brand?: string;
  category?: string;
  sort?: "name" | "price";
  view?: "2" | "3" | "4";
  featured?: "1" | "";
  trending?: "1" | "";
  type?: "products" | "packs";
};

function normalizeSort(value?: string) {
  return value === "price" ? "price" : "name";
}

function normalizeView(value?: string) {
  return value === "2" || value === "4" ? value : "3";
}

function normalizeFeatured(value?: string) {
  return value === "1";
}

function normalizeTrending(value?: string) {
  return value === "1";
}

function normalizeType(value?: string) {
  return value === "packs" ? "packs" : "products";
}

export default function GalleryPage({ searchParams }: { searchParams: Promise<GallerySearchParams> }) {
  return <GalleryPageContent searchParams={searchParams} />;
}

async function GalleryPageContent({ searchParams }: { searchParams: Promise<GallerySearchParams> }) {
  const params = await searchParams;
  const query = (params.q ?? "").trim();
  const brand = (params.brand ?? "").trim();
  const category = (params.category ?? "").trim();
  const sort = normalizeSort(params.sort);
  const view = normalizeView(params.view);
  const featuredOnly = normalizeFeatured(params.featured);
  const trendingOnly = normalizeTrending(params.trending);
  const type = normalizeType(params.type);

  const buildHref = (next: Partial<GallerySearchParams>) => {
    const url = new URLSearchParams();
    const nextQuery = next.q ?? query;
    const nextBrand = next.brand ?? brand;
    const nextCategory = next.category ?? category;
    const nextSort = normalizeSort(next.sort ?? sort);
    const nextView = normalizeView(next.view ?? view);
    const nextFeatured = next.featured ?? (featuredOnly ? "1" : undefined);
    const nextTrending = next.trending ?? (trendingOnly ? "1" : undefined);
    const nextType = normalizeType(next.type ?? type);

    if (nextQuery) {
      url.set("q", nextQuery);
    }
    if (nextBrand) {
      url.set("brand", nextBrand);
    }
    if (nextCategory) {
      url.set("category", nextCategory);
    }
    if (nextSort) {
      url.set("sort", nextSort);
    }
    if (nextView) {
      url.set("view", nextView);
    }
    if (nextFeatured === "1") {
      url.set("featured", nextFeatured);
    }
    if (nextTrending === "1") {
      url.set("trending", nextTrending);
    }
    if (nextType === "packs") {
      url.set("type", nextType);
    }

    const serialized = url.toString();
    return serialized ? `/galeria?${serialized}` : "/galeria";
  };

  if (type === "packs") {
    const gallery = await getPacksGalleryPageViewModel(query);
    const sortedPacks = [...gallery.packs].sort((left, right) => {
      if (sort === "price") {
        return left.publicPrice - right.publicPrice || left.title.localeCompare(right.title, "es", { sensitivity: "base" });
      }

      return left.title.localeCompare(right.title, "es", { sensitivity: "base" });
    });

    return (
      <main className="pf-shell flex w-full flex-1 flex-col gap-8 px-4 py-6 sm:px-6 lg:px-12 lg:py-10">
        <div className="rounded-[2rem] border border-[var(--pf-border-warm)] bg-[linear-gradient(180deg,var(--pf-surface-warm)_0%,var(--pf-sand-soft)_58%,var(--pf-surface-strong)_100%)] p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[var(--pf-primary-darker)]">Promociones</p>
              <h3 className="mt-1 text-2xl font-extrabold tracking-tight text-[var(--pf-text)]">
                {sortedPacks.length} promociones encontradas
              </h3>
            </div>

            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-5">
              <div className="flex items-center gap-3">
                <span className="text-sm text-[var(--pf-muted)]">Ordenar por:</span>
                <div className="flex overflow-hidden rounded-full border border-[var(--pf-border)] bg-[rgba(255,255,255,0.82)] p-1">
                  <Link
                    href={buildHref({ sort: "name", type: "packs" })}
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                      sort === "name"
                        ? "bg-[rgba(168,109,69,0.16)] text-[var(--pf-primary-darker)]"
                        : "text-[var(--pf-text)] hover:bg-[rgba(248,242,232,0.75)]"
                    }`}
                  >
                    Nombre
                  </Link>
                  <Link
                    href={buildHref({ sort: "price", type: "packs" })}
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                      sort === "price"
                        ? "bg-[rgba(168,109,69,0.16)] text-[var(--pf-primary-darker)]"
                        : "text-[var(--pf-text)] hover:bg-[rgba(248,242,232,0.75)]"
                    }`}
                  >
                    Precio
                  </Link>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-sm text-[var(--pf-muted)]">Tipo de vista:</span>
                <div className="flex items-center gap-2">
                  {(["2", "3", "4"] as const).map((option) => {
                    const selected = view === option;
                    const bars = Number(option);

                    return (
                      <Link
                        key={option}
                        href={buildHref({ view: option, type: "packs" })}
                        className={`inline-flex h-8 items-center justify-center rounded-md border px-2 transition ${
                          selected
                            ? "border-[rgba(168,109,69,0.22)] bg-[rgba(168,109,69,0.10)]"
                            : "border-[var(--pf-border)] bg-[rgba(255,255,255,0.84)] hover:bg-[rgba(248,242,232,0.75)]"
                        }`}
                        aria-label={`Ver en ${option} columnas`}
                      >
                        <span className="flex items-end gap-1.5">
                          {Array.from({ length: bars }).map((_, index) => (
                            <span
                              key={index}
                              className="block w-1 rounded-full bg-[var(--pf-primary-darker)]"
                              style={{ height: index % 2 === 0 ? "14px" : "10px" }}
                            />
                          ))}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href={buildHref({ type: "products" })}
              className="inline-flex items-center rounded-full border border-[rgba(168,109,69,0.18)] bg-[rgba(255,255,255,0.78)] px-4 py-2 text-sm font-semibold text-[var(--pf-text)] hover:bg-[rgba(248,242,232,0.92)]"
            >
              Ver productos
            </Link>
            {query ? (
              <Link
                href={buildHref({ q: "" })}
                className="inline-flex items-center rounded-full border border-[rgba(168,109,69,0.18)] bg-[rgba(255,255,255,0.78)] px-4 py-2 text-sm font-semibold text-[var(--pf-text)] hover:bg-[rgba(248,242,232,0.92)]"
              >
                Búsqueda: {query}
              </Link>
            ) : (
              <span className="text-sm text-[var(--pf-muted)]">Sin filtros aplicados</span>
            )}
          </div>
        </div>

        <PackGrid packs={sortedPacks} columns={Number(view)} />
      </main>
    );
  }

  const gallery = await getGalleryPageViewModel({
    query,
    brand,
    category,
    featuredOnly,
    trendingOnly,
  });

  const sortedProducts = [...gallery.products].sort((left, right) => {
    if (sort === "price") {
      return left.publicPrice - right.publicPrice || left.name.localeCompare(right.name, "es", { sensitivity: "base" });
    }

    return left.name.localeCompare(right.name, "es", { sensitivity: "base" });
  });

  const activeFilters = [
    brand ? { label: `Marca: ${brand}`, href: buildHref({ brand: "" }) } : null,
    category ? { label: `Categoría: ${category}`, href: buildHref({ category: "" }) } : null,
    query ? { label: `Búsqueda: ${query}`, href: buildHref({ q: "" }) } : null,
    featuredOnly ? { label: "Destacados", href: buildHref({ featured: "" }) } : null,
    trendingOnly ? { label: "Tendencias", href: buildHref({ trending: "" }) } : null,
  ].filter(Boolean) as { label: string; href: string }[];

  return (
    <main className="pf-shell flex w-full flex-1 flex-col gap-8 px-4 py-6 sm:px-6 lg:px-12 lg:py-10">
      <div className="grid gap-6 lg:grid-cols-[290px_minmax(0,1fr)]">
        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <section className="rounded-[1.8rem] border border-[var(--pf-border-warm)] bg-[linear-gradient(180deg,var(--pf-surface-warm)_0%,var(--pf-sand-soft)_58%,var(--pf-surface-strong)_100%)] p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[var(--pf-primary-darker)]">Marca</p>
                <p className="mt-1 text-sm text-[var(--pf-muted)]">Elegí una sola marca</p>
              </div>
              {brand ? (
                <Link href={buildHref({ brand: "" })} className={buttonVariants({ variant: "ghost", size: "sm" })}>
                  Quitar
                </Link>
              ) : null}
            </div>
            <div className="mt-4 max-h-[360px] space-y-2 overflow-auto pr-1">
              <Link
                href={buildHref({ brand: "" })}
                className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-sm transition ${
                  !brand
                    ? "border-[rgba(168,109,69,0.22)] bg-[rgba(168,109,69,0.10)] font-semibold text-[var(--pf-primary-darker)]"
                    : "border-[var(--pf-border-soft)] bg-[rgba(255,255,255,0.72)] text-[var(--pf-text)] hover:bg-[rgba(248,242,232,0.75)]"
                }`}
              >
                <span>Todas las marcas</span>
                <span className="text-xs text-[var(--pf-muted)]">{gallery.totalProducts}</span>
              </Link>
              {gallery.brands.map((item) => {
                const active = item.value === brand;

                return (
                  <Link
                    key={item.value}
                    href={buildHref({ brand: active ? "" : item.value })}
                    className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-sm transition ${
                      active
                        ? "border-[rgba(168,109,69,0.22)] bg-[rgba(168,109,69,0.10)] font-semibold text-[var(--pf-primary-darker)]"
                        : "border-[var(--pf-border-soft)] bg-[rgba(255,255,255,0.72)] text-[var(--pf-text)] hover:bg-[rgba(248,242,232,0.75)]"
                    }`}
                  >
                    <span className="line-clamp-1">{item.label}</span>
                    <span className="rounded-full bg-[rgba(168,109,69,0.10)] px-2.5 py-1 text-xs font-semibold text-[var(--pf-primary-darker)]">
                      {item.count}
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>

          <section className="rounded-[1.8rem] border border-[var(--pf-border-warm)] bg-[linear-gradient(180deg,var(--pf-surface-warm)_0%,var(--pf-sand-soft)_58%,var(--pf-surface-strong)_100%)] p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[var(--pf-primary-darker)]">Categoría</p>
                <p className="mt-1 text-sm text-[var(--pf-muted)]">Elegí una sola categoría</p>
              </div>
              {category ? (
                <Link href={buildHref({ category: "" })} className={buttonVariants({ variant: "ghost", size: "sm" })}>
                  Quitar
                </Link>
              ) : null}
            </div>
            <div className="mt-4 max-h-[360px] space-y-2 overflow-auto pr-1">
              <Link
                href={buildHref({ category: "" })}
                className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-sm transition ${
                  !category
                    ? "border-[rgba(168,109,69,0.22)] bg-[rgba(168,109,69,0.10)] font-semibold text-[var(--pf-primary-darker)]"
                    : "border-[var(--pf-border-soft)] bg-[rgba(255,255,255,0.72)] text-[var(--pf-text)] hover:bg-[rgba(248,242,232,0.75)]"
                }`}
              >
                <span>Todas las categorías</span>
                <span className="text-xs text-[var(--pf-muted)]">{gallery.totalProducts}</span>
              </Link>
              {gallery.categories.map((item) => {
                const active = item.value === category;

                return (
                  <Link
                    key={item.value}
                    href={buildHref({ category: active ? "" : item.value })}
                    className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-sm transition ${
                      active
                        ? "border-[rgba(168,109,69,0.22)] bg-[rgba(168,109,69,0.10)] font-semibold text-[var(--pf-primary-darker)]"
                        : "border-[var(--pf-border-soft)] bg-[rgba(255,255,255,0.72)] text-[var(--pf-text)] hover:bg-[rgba(248,242,232,0.75)]"
                    }`}
                  >
                    <span className="line-clamp-1">{item.label}</span>
                    <span className="rounded-full bg-[rgba(168,109,69,0.10)] px-2.5 py-1 text-xs font-semibold text-[var(--pf-primary-darker)]">
                      {item.count}
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        </aside>

        <section className="space-y-4">
          <div className="rounded-[2rem] border border-[var(--pf-border-warm)] bg-[linear-gradient(180deg,var(--pf-surface-warm)_0%,var(--pf-sand-soft)_58%,var(--pf-surface-strong)_100%)] p-4 shadow-sm sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[var(--pf-primary-darker)]">Resultados</p>
                <h3 className="mt-1 text-2xl font-extrabold tracking-tight text-[var(--pf-text)]">
                  {sortedProducts.length} productos encontrados
                </h3>
              </div>

              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-5">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-[var(--pf-muted)]">Ordenar por:</span>
                  <div className="flex overflow-hidden rounded-full border border-[var(--pf-border)] bg-[rgba(255,255,255,0.82)] p-1">
                    <Link
                      href={buildHref({ sort: "name", type: "products" })}
                      className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                        sort === "name"
                          ? "bg-[rgba(168,109,69,0.16)] text-[var(--pf-primary-darker)]"
                          : "text-[var(--pf-text)] hover:bg-[rgba(248,242,232,0.75)]"
                      }`}
                    >
                      Nombre
                    </Link>
                    <Link
                      href={buildHref({ sort: "price", type: "products" })}
                      className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                        sort === "price"
                          ? "bg-[rgba(168,109,69,0.16)] text-[var(--pf-primary-darker)]"
                          : "text-[var(--pf-text)] hover:bg-[rgba(248,242,232,0.75)]"
                      }`}
                    >
                      Precio
                    </Link>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-sm text-[var(--pf-muted)]">Tipo de vista:</span>
                  <div className="flex items-center gap-2">
                    {(["2", "3", "4"] as const).map((option) => {
                      const selected = view === option;
                      const bars = Number(option);

                      return (
                        <Link
                          key={option}
                          href={buildHref({ view: option, type: "products" })}
                          className={`inline-flex h-8 items-center justify-center rounded-md border px-2 transition ${
                            selected
                              ? "border-[rgba(168,109,69,0.22)] bg-[rgba(168,109,69,0.10)]"
                              : "border-[var(--pf-border)] bg-[rgba(255,255,255,0.84)] hover:bg-[rgba(248,242,232,0.75)]"
                          }`}
                          aria-label={`Ver en ${option} columnas`}
                        >
                          <span className="flex items-end gap-1.5">
                            {Array.from({ length: bars }).map((_, index) => (
                              <span
                                key={index}
                                className="block w-1 rounded-full bg-[var(--pf-primary-darker)]"
                                style={{ height: index % 2 === 0 ? "14px" : "10px" }}
                              />
                            ))}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {activeFilters.length > 0 ? (
                activeFilters.map((filter) => (
                  <Link
                    key={filter.label}
                    href={filter.href}
                    className="inline-flex items-center rounded-full border border-[rgba(168,109,69,0.18)] bg-[rgba(255,255,255,0.78)] px-4 py-2 text-sm font-semibold text-[var(--pf-text)] hover:bg-[rgba(248,242,232,0.92)]"
                  >
                    {filter.label}
                  </Link>
                ))
              ) : (
                <span className="text-sm text-[var(--pf-muted)]">Sin filtros aplicados</span>
              )}
            </div>
          </div>

          <CatalogGrid products={sortedProducts} columns={Number(view)} />
        </section>
      </div>
    </main>
  );
}
