"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Check, ChevronLeft, ChevronRight, EyeOff, LoaderCircle, PackageSearch, Search, X } from "lucide-react";
import { setProductActive, setProductSoldOut } from "@/app/admin/actions";
import type { ProductItem } from "@/domain/site-content";
import { publicAsset } from "@/lib/catalog";
import { filterProductAvailability, isProductActive, type AvailabilityFilter, type ProductAvailabilityUpdate, type VisibilityFilter } from "@/lib/product-availability";
import styles from "./product-availability-manager.module.css";

const PAGE_SIZE = 24;

type ProductStatus = { pending?: boolean; error?: string; saved?: boolean };

export function ProductAvailabilityManager({ products, onClose, onProductChange }: {
  products: ProductItem[];
  onClose: () => void;
  onProductChange: (product: ProductAvailabilityUpdate) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const pendingIds = useRef(new Set<number>());
  const [, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [availability, setAvailability] = useState<AvailabilityFilter>("all");
  const [visibility, setVisibility] = useState<VisibilityFilter>("active");
  const [page, setPage] = useState(1);
  const [updates, setUpdates] = useState<Record<number, ProductAvailabilityUpdate>>({});
  const [statuses, setStatuses] = useState<Record<number, ProductStatus>>({});
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const currentProducts = useMemo(() => products.map((product) => ({ ...product, ...updates[product.id] })), [products, updates]);
  const scopedProducts = useMemo(() => filterProductAvailability(currentProducts, query, "all", visibility), [currentProducts, query, visibility]);
  const filtered = useMemo(() => filterProductAvailability(scopedProducts, "", availability, "all"), [scopedProducts, availability]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const soldOutCount = scopedProducts.filter((product) => product.soldOut).length;
  const saving = Object.values(statuses).some((status) => status.pending);

  function changeFlag(product: ProductItem, flag: "soldOut" | "active", value: boolean) {
    if (pendingIds.current.has(product.id)) return;
    pendingIds.current.add(product.id);
    setStatuses((current) => ({ ...current, [product.id]: { pending: true } }));
    setNotice("");
    startTransition(async () => {
      try {
        const updated = flag === "soldOut" ? await setProductSoldOut(product.id, value) : await setProductActive(product.id, value);
        setUpdates((current) => ({ ...current, [product.id]: updated }));
        onProductChange(updated);
        setStatuses((current) => ({ ...current, [product.id]: { saved: true } }));
        const state = flag === "soldOut" ? updated.soldOut ? "agotado" : "con stock" : isProductActive(updated) ? "activo" : "inactivo";
        setNotice(`${product.name}: ${state}.`);
      } catch (cause) {
        const error = cause instanceof Error ? cause.message : "No se pudo guardar el cambio.";
        setStatuses((current) => ({ ...current, [product.id]: { error } }));
        setNotice(`No se pudo actualizar ${product.name}.`);
      } finally { pendingIds.current.delete(product.id); }
    });
  }

  return <dialog ref={dialogRef} className={styles.dialog} aria-labelledby="availability-title" onClose={onClose}
    onCancel={(event) => { if (pendingIds.current.size) event.preventDefault(); }}>
    <header className={styles.header}>
      <div><p className={styles.eyebrow}>Administraci&oacute;n</p><h2 id="availability-title">Productos agotados</h2></div>
      <button type="button" className={styles.iconButton} title="Cerrar" aria-label="Cerrar productos agotados" disabled={saving} onClick={() => dialogRef.current?.close()}><X size={20} /></button>
    </header>
    <div className={styles.filters}>
      <div className={styles.searchRow}>
        <label className={styles.search}><Search size={18} aria-hidden="true" /><span className="sr-only">Buscar productos por ID, nombre, descripción o marca</span>
          <input type="search" placeholder="ID, nombre, descripción o marca" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} />
        </label>
        <label className={styles.visibility}><span>Visibilidad</span><select aria-label="Visibilidad" value={visibility} onChange={(event) => { setVisibility(event.target.value as VisibilityFilter); setPage(1); }}>
          <option value="all">Todos los estados</option><option value="active">Activos</option><option value="inactive">Inactivos</option>
        </select></label>
      </div>
      <div className={styles.segmented} role="group" aria-label="Disponibilidad">
        {([
          ["all", "Todos", scopedProducts.length],
          ["sold-out", "Agotados", soldOutCount],
          ["available", "Con stock", scopedProducts.length - soldOutCount],
        ] as const).map(([value, label, count]) => <button type="button" key={value} aria-pressed={availability === value} onClick={() => { setAvailability(value); setPage(1); }}>
          <span>{label}</span><span className={styles.count}>{count}</span>
        </button>)}
      </div>
    </div>
    <div className={styles.body}>
      {visible.length ? <div className={styles.grid}>
        {visible.map((product) => {
          const status = statuses[product.id] ?? {};
          const active = isProductActive(product);
          return <article key={product.id} className={styles.card} data-product-id={product.id} aria-label={`${product.name} (ID ${product.id})`}>
            <div className={styles.image}>
              <Image src={publicAsset(product.image)} alt={product.name} fill unoptimized sizes="(max-width: 600px) 90vw, (max-width: 1000px) 45vw, 25vw" className={styles.productImage}
                onError={(event) => { if (!event.currentTarget.src.endsWith("/assets/images/no-image.svg")) event.currentTarget.src = "/assets/images/no-image.svg"; }} />
              <span className={styles.badge} data-sold-out={!!product.soldOut}>{product.soldOut ? "Agotado" : "Con stock"}</span>
              {!active && <span className={styles.hiddenBadge}><EyeOff size={13} aria-hidden="true" />Oculto</span>}
            </div>
            <div className={styles.productInfo}>
              <p className={styles.meta}><span title={product.brand}>{product.brand}</span><span>ID {product.id}</span></p>
              <h3 title={product.name}>{product.name}</h3>
              <div className={styles.controls}>
                <label className={styles.control}><span>Agotado</span><span className={`${styles.switch} ${styles.soldOutSwitch}`}>
                  <input type="checkbox" role="switch" aria-label={`Agotado: ${product.name} (ID ${product.id})`} checked={!!product.soldOut} disabled={status.pending} onChange={(event) => changeFlag(product, "soldOut", event.target.checked)} /><span aria-hidden="true" />
                </span></label>
                <label className={styles.control}><span>Activo</span><span className={styles.switch}>
                  <input type="checkbox" role="switch" aria-label={`Activo: ${product.name} (ID ${product.id})`} checked={active} disabled={status.pending} onChange={(event) => changeFlag(product, "active", event.target.checked)} /><span aria-hidden="true" />
                </span></label>
              </div>
              <div className={styles.feedback}>
                {status.pending ? <span><LoaderCircle size={14} className={styles.spinner} aria-hidden="true" />Guardando...</span>
                  : status.error ? <span className={styles.error} role="alert">{status.error}</span>
                  : status.saved ? <span className={styles.saved}><Check size={14} aria-hidden="true" />Guardado</span> : null}
              </div>
            </div>
          </article>;
        })}
      </div> : <div className={styles.empty}><PackageSearch size={36} aria-hidden="true" /><h3>Sin resultados</h3><p>No hay productos con estos filtros.</p></div>}
    </div>
    <footer className={styles.footer}>
      <div className={styles.result}><span>{filtered.length} de {scopedProducts.length} productos</span><span className={styles.notice} role="status" aria-live="polite">{notice}</span></div>
      <nav className={styles.pagination} aria-label="Paginas de productos">
        <button type="button" className={styles.iconButton} aria-label="Pagina anterior" title="Anterior" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}><ChevronLeft size={20} /></button>
        <span>P&aacute;gina {currentPage} de {totalPages}</span>
        <button type="button" className={styles.iconButton} aria-label="Pagina siguiente" title="Siguiente" disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)}><ChevronRight size={20} /></button>
      </nav>
    </footer>
  </dialog>;
}
