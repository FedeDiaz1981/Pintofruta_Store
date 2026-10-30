"use client";

import { useEffect, useRef, useState } from "react";
import type { ProductItem } from "@/domain/site-content";
import { createProductSearch } from "@/lib/search";
import { HERO_IMAGE_LINK_ERROR, resolveHeroImageHref } from "@/lib/hero-links";

export function HeroImageActionField({ mode, url, productId, products, onChange }: {
  mode: "url" | "product";
  url: string;
  productId: string;
  products: ProductItem[];
  onChange: (changes: { imageAction?: "url" | "product"; imageLink?: string; imageProductId?: string }) => void;
}) {
  const [search, setSearch] = useState("");
  const urlRef = useRef<HTMLInputElement>(null);
  const productRef = useRef<HTMLSelectElement>(null);
  const selected = products.find((product) => String(product.id) === productId);
  const available = selected?.status === "published" && !selected.soldOut;
  const matchesSearch = createProductSearch(search);
  const options = products.filter((product) => String(product.id) === productId || (
    product.status === "published" && !product.soldOut && matchesSearch(product)
  ));
  const inputClass = "min-w-0 w-full max-w-full rounded-lg border border-[var(--pf-border-soft)] bg-white px-4 py-3 text-sm text-[var(--pf-text)] outline-none focus:border-[var(--pf-primary)]";

  useEffect(() => {
    urlRef.current?.setCustomValidity(url.trim() && !resolveHeroImageHref(url) ? HERO_IMAGE_LINK_ERROR : "");
    productRef.current?.setCustomValidity(productId && !available ? "El producto seleccionado no est\u00e1 disponible." : "");
  }, [mode, url, productId, available]);

  return <fieldset className="min-w-0 w-full max-w-full md:col-span-2">
    <legend className="mb-3 text-xs font-bold uppercase tracking-normal text-[var(--pf-muted)]">Acci&oacute;n de la imagen</legend>
    <div className="mb-4 inline-flex max-w-full gap-1 rounded-lg border border-[var(--pf-border-soft)] bg-white p-1">
      {([{ value: "url", label: "URL" }, { value: "product", label: "Producto" }] as const).map((option) => (
        <label key={option.value} className={`relative cursor-pointer rounded px-4 py-2 text-sm font-semibold transition focus-within:outline-2 focus-within:outline-[var(--pf-primary)] ${mode === option.value ? "bg-[var(--pf-primary)] text-white" : "text-[var(--pf-muted)] hover:bg-[var(--pf-surface)]"}`}>
          <input type="radio" name="hero-image-action" value={option.value} checked={mode === option.value}
            onChange={() => onChange({ imageAction: option.value })} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
          {option.label}
        </label>
      ))}
    </div>
    {mode === "url" ? <label className="block text-sm font-semibold text-[var(--pf-text)]">
      Enlace de la imagen
      <input ref={urlRef} value={url} onChange={(event) => onChange({ imageLink: event.target.value })}
        className={`${inputClass} mt-2`} />
    </label> : <div className="grid min-w-0 grid-cols-1 gap-3">
      <label className="block text-sm font-semibold text-[var(--pf-text)]">
        Buscar producto
        <input type="search" value={search} onChange={(event) => setSearch(event.target.value)}
          placeholder="ID, nombre, descripción o marca" className={`${inputClass} mt-2`} />
      </label>
      <label className="block min-w-0 text-sm font-semibold text-[var(--pf-text)]">
        Producto de la imagen
        <select ref={productRef} required value={productId} onChange={(event) => onChange({ imageProductId: event.target.value })}
          className={`${inputClass} mt-2`}>
          <option value="">Seleccionar producto...</option>
          {options.map((product) => <option key={product.id} value={product.id} disabled={product.status !== "published" || Boolean(product.soldOut)}>
            #{product.id} - {product.name} - {product.brand}{product.status !== "published" ? " (Inactivo)" : product.soldOut ? " (Agotado)" : ""}
          </option>)}
          {productId && !selected ? <option value={productId} disabled>#{productId} (Eliminado)</option> : null}
        </select>
      </label>
      {selected ? <p className="break-words text-sm text-[var(--pf-muted)]">#{selected.id} &middot; {selected.name} &middot; {selected.brand}</p> : null}
      {options.length === 0 ? <p className="text-sm text-[var(--pf-muted)]">No hay productos disponibles.</p> : null}
    </div>}
  </fieldset>;
}
