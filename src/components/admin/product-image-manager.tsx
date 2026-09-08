"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { saveProductImage } from "@/app/admin/actions";
import type { ProductItem } from "@/domain/site-content";

type ProductImageManagerProps = {
  products: ProductItem[];
  onClose: () => void;
};

type ProductStatus = {
  loading?: boolean;
  error?: string;
};

type ImageFilter = "all" | "missing" | "with-image";

async function uploadImage(file: File, product: ProductItem) {
  const formData = new FormData();
  formData.set("file", file);
  formData.set("scope", "products");
  formData.set("fallbackName", `${product.sku}-${product.name}`);

  const response = await fetch("/api/admin/upload-image", {
    method: "POST",
    body: formData,
  });
  const payload = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    publicUrl?: string;
    error?: string;
  };

  if (!response.ok || !payload.ok || !payload.publicUrl) {
    throw new Error(payload.error || "No se pudo subir la imagen.");
  }

  return payload.publicUrl;
}

export function ProductImageManager({ products, onClose }: ProductImageManagerProps) {
  const [query, setQuery] = useState("");
  const [imageFilter, setImageFilter] = useState<ImageFilter>("all");
  const [localProducts, setLocalProducts] = useState(products);
  const [statuses, setStatuses] = useState<Record<number, ProductStatus>>({});

  const filteredProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return localProducts.filter((product) => {
      const hasImage = Boolean(product.image?.trim());
      const matchesImageFilter =
        imageFilter === "all" ||
        (imageFilter === "missing" && !hasImage) ||
        (imageFilter === "with-image" && hasImage);
      const matchesQuery =
        !normalizedQuery ||
        [product.sku, product.name, product.brand, product.categoryName]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedQuery));

      return matchesImageFilter && matchesQuery;
    });
  }, [imageFilter, localProducts, query]);

  const withImageCount = localProducts.filter((product) => Boolean(product.image?.trim())).length;

  function setStatus(productId: number, status: ProductStatus) {
    setStatuses((current) => ({ ...current, [productId]: status }));
  }

  async function handleFileChange(product: ProductItem, file: File | undefined) {
    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setStatus(product.id, { error: "Elegí un archivo de imagen válido." });
      return;
    }

    setStatus(product.id, { loading: true });

    try {
      const publicUrl = await uploadImage(file, product);
      await saveProductImage(product.id, publicUrl);
      setLocalProducts((current) =>
        current.map((currentProduct) =>
          currentProduct.id === product.id ? { ...currentProduct, image: publicUrl } : currentProduct,
        ),
      );
      setStatus(product.id, {});
    } catch (error) {
      setStatus(product.id, {
        error: error instanceof Error ? error.message : "No se pudo guardar la imagen.",
      });
    }
  }

  async function handleDelete(product: ProductItem) {
    if (!window.confirm(`¿Borrar la imagen de ${product.name}?`)) {
      return;
    }

    setStatus(product.id, { loading: true });

    try {
      await saveProductImage(product.id, null);
      setLocalProducts((current) =>
        current.map((currentProduct) =>
          currentProduct.id === product.id ? { ...currentProduct, image: undefined } : currentProduct,
        ),
      );
      setStatus(product.id, {});
    } catch (error) {
      setStatus(product.id, {
        error: error instanceof Error ? error.message : "No se pudo borrar la imagen.",
      });
    }
  }

  return (
    <div className="flex max-h-[calc(100svh-5rem)] w-full max-w-7xl flex-col overflow-hidden rounded-[30px] border border-[var(--pf-border-soft)] bg-[#fbf8f1] shadow-[0_40px_120px_rgba(74,57,38,0.28)]">
      <div className="flex flex-col gap-5 border-b border-[var(--pf-border-soft)] px-6 py-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.34em] text-[var(--pf-secondary)]">Catalogo visual</p>
          <h2 className="mt-2 text-3xl font-black tracking-tight text-[var(--pf-text)]">Imagenes de productos</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--pf-muted)]">
            Revisa la imagen actual de cada producto y actualizala desde una sola pantalla.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="self-start rounded-full border border-[var(--pf-border-soft)] bg-white px-5 py-2.5 text-sm font-semibold text-[var(--pf-primary-darker)] transition hover:bg-[rgba(248,242,232,0.6)]"
        >
          Cerrar
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-[22px] border border-[var(--pf-border-soft)] bg-white p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[var(--pf-muted)]">Productos</p>
            <p className="mt-2 text-2xl font-black text-[var(--pf-text)]">{localProducts.length}</p>
          </div>
          <div className="rounded-[22px] border border-[var(--pf-border-soft)] bg-white p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[var(--pf-muted)]">Con imagen</p>
            <p className="mt-2 text-2xl font-black text-[var(--pf-text)]">{withImageCount}</p>
          </div>
          <div className="rounded-[22px] border border-[var(--pf-border-soft)] bg-white p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[var(--pf-muted)]">Sin imagen</p>
            <p className="mt-2 text-2xl font-black text-[var(--pf-text)]">{localProducts.length - withImageCount}</p>
          </div>
        </div>

        <label className="mb-6 flex h-14 items-center rounded-full border border-[var(--pf-border-soft)] bg-white px-5 text-[var(--pf-muted)] shadow-[0_8px_22px_rgba(58,44,25,0.06)]">
          <span className="text-sm">Buscar</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="ml-3 flex-1 bg-transparent text-sm text-[var(--pf-text)] outline-none placeholder:text-[var(--pf-muted)]"
            placeholder="SKU, producto, marca o categoria"
          />
        </label>

        <div className="mb-6 flex flex-wrap gap-2">
          {([
            ["all", "Todos"],
            ["missing", "Sin imagen"],
            ["with-image", "Con imagen"],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setImageFilter(value)}
              className={`rounded-full px-5 py-2.5 text-xs font-black transition ${
                imageFilter === value
                  ? "bg-[var(--pf-primary)] text-white shadow-[0_10px_22px_rgba(168,109,69,0.2)]"
                  : "border border-[var(--pf-border-soft)] bg-white text-[var(--pf-primary-darker)] hover:bg-[#fff4e5]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {filteredProducts.map((product) => {
            const status = statuses[product.id] ?? {};
            const imageSource = product.image?.trim() || "/assets/images/no-image.svg";
            const hasImage = imageSource !== "/assets/images/no-image.svg";

            return (
              <article key={product.id} className="overflow-hidden rounded-[26px] border border-[var(--pf-border-soft)] bg-white shadow-[0_12px_30px_rgba(58,44,25,0.08)]">
                <div className="relative flex h-52 items-center justify-center bg-[linear-gradient(135deg,#f8f0e4,#eee1ce)] p-5">
                  <Image
                    src={imageSource}
                    alt={hasImage ? product.name : "Sin imagen"}
                    fill
                    unoptimized
                    sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 25vw"
                    className={`object-contain ${hasImage ? "" : "p-10 opacity-70"}`}
                  />
                  <span className={`absolute left-4 top-4 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${hasImage ? "bg-[#e5f3e8] text-[#34734a]" : "bg-white/90 text-[var(--pf-muted)]"}`}>
                    {hasImage ? "Con imagen" : "Sin imagen"}
                  </span>
                </div>

                <div className="p-5">
                  <p className="break-words text-lg font-black leading-6 text-[var(--pf-text)]">{product.name}</p>

                  <div className="mt-5 flex flex-wrap gap-2">
                    <label className="inline-flex cursor-pointer items-center justify-center rounded-full bg-[linear-gradient(180deg,var(--pf-primary-soft),var(--pf-primary))] px-4 py-2.5 text-xs font-black text-white transition hover:brightness-105 has-[:disabled]:cursor-wait has-[:disabled]:opacity-60">
                      {status.loading ? "Procesando..." : hasImage ? "Reemplazar" : "Cargar imagen"}
                      <input
                        type="file"
                        accept="image/*"
                        disabled={status.loading}
                        className="sr-only"
                        onChange={(event) => {
                          void handleFileChange(product, event.target.files?.[0]);
                          event.currentTarget.value = "";
                        }}
                      />
                    </label>
                    {hasImage ? (
                      <button
                        type="button"
                        disabled={status.loading}
                        onClick={() => void handleDelete(product)}
                        className="rounded-full border border-[rgba(111,69,40,0.18)] bg-white px-4 py-2.5 text-xs font-black text-[var(--pf-primary-darker)] transition hover:bg-[#fff4e5] disabled:cursor-wait disabled:opacity-60"
                      >
                        Borrar
                      </button>
                    ) : null}
                  </div>
                  {status.error ? <p className="mt-3 text-xs font-semibold leading-5 text-[#a43e32]">{status.error}</p> : null}
                </div>
              </article>
            );
          })}
        </div>

        {filteredProducts.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-[var(--pf-border-soft)] bg-white px-5 py-10 text-center text-sm text-[var(--pf-muted)]">
            No hay productos que coincidan con la busqueda.
          </div>
        ) : null}
      </div>
    </div>
  );
}
