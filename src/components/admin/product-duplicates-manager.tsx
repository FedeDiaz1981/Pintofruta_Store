"use client";

import Image from "next/image";
import { Check, ChevronLeft, ChevronRight, CopyCheck, LoaderCircle, Pencil, Search, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { ProductItem } from "@/domain/site-content";
import { formatCurrency, publicAsset } from "@/lib/catalog";
import { countDuplicateProducts, filterDuplicateProducts, type DuplicateProductGroup } from "@/lib/product-duplicates";
import styles from "./product-duplicates-manager.module.css";

const PAGE_SIZE = 6;

export function ProductDuplicatesManager({ groups, onClose, onEdit, onDelete }: {
  groups: DuplicateProductGroup[];
  onClose: () => void;
  onEdit: (product: ProductItem) => void;
  onDelete: (product: ProductItem) => Promise<boolean>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const deleting = useRef(false);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [, startTransition] = useTransition();
  const saving = pendingId !== null;
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const filtered = useMemo(() => filterDuplicateProducts(groups, query), [groups, query]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  function removeProduct(product: ProductItem) {
    if (deleting.current) return;
    deleting.current = true;
    setPendingId(product.id);
    setError("");
    setNotice("");
    startTransition(async () => {
      try {
        if (await onDelete(product)) setNotice(`Producto ID ${product.id} eliminado.`);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "No se pudo borrar el producto.");
      } finally {
        deleting.current = false;
        setPendingId(null);
      }
    });
  }

  return <dialog ref={dialogRef} className={styles.dialog} aria-labelledby="duplicates-title" onClose={onClose}
    onCancel={(event) => { if (deleting.current) event.preventDefault(); }}>
    <header className={styles.header}>
      <div><p>Administraci&oacute;n</p><h2 id="duplicates-title">Productos duplicados</h2>
        <span>{countDuplicateProducts(groups)} productos en {groups.length} grupos</span></div>
      <button type="button" className={styles.iconButton} aria-label="Cerrar productos duplicados" title="Cerrar" disabled={saving} onClick={() => dialogRef.current?.close()}><X size={20} /></button>
    </header>
    <div className={styles.filters}>
      <label className={styles.search}><Search size={18} aria-hidden="true" /><span className="sr-only">Buscar duplicados por ID, nombre o marca</span>
        <input type="search" value={query} placeholder="ID, nombre o marca" onChange={(event) => { setQuery(event.target.value); setPage(1); }} />
      </label>
      {error && <p className={styles.error} role="alert">{error}</p>}
    </div>
    <div className={styles.body}>
      {visible.length ? visible.map((group) => <section key={group.key} className={styles.group} aria-label={`${group.name} - ${group.brand}`}>
        <div className={styles.groupHeading}><div><h3>{group.name}</h3><p>{group.brand}</p></div><span data-match={group.match}>{group.match === "similar" ? "Similares" : "Coinciden"} &middot; {group.products.length} registros</span></div>
        <div className={styles.grid}>{group.products.map((product) => <article key={product.id} className={styles.card} data-product-id={product.id} aria-label={`${product.name} (ID ${product.id})`}>
          <div className={styles.image}><Image src={publicAsset(product.image)} alt={product.name} fill unoptimized sizes="(max-width: 600px) 88px, 120px" className={styles.productImage}
            onError={(event) => { if (!event.currentTarget.src.endsWith("/assets/images/no-image.svg")) event.currentTarget.src = "/assets/images/no-image.svg"; }} /></div>
          <div className={styles.info}>
            <div className={styles.meta}><strong>ID {product.id}</strong><span data-active={product.status === "published"}>{product.status === "published" ? "Activo" : "Inactivo"}</span></div>
            <h4>{product.name}</h4><p className={styles.brand}>{product.brand}</p>
            <dl className={styles.prices}><div><dt>P&uacute;blico</dt><dd>{formatCurrency(product.publicPrice)}</dd></div><div><dt>Logueado</dt><dd>{formatCurrency(product.memberPrice)}</dd></div></dl>
            <div className={styles.actions}>
              <button type="button" disabled={saving} onClick={() => onEdit(product)}><Pencil size={14} aria-hidden="true" />Editar</button>
              <button type="button" disabled={saving} className={styles.delete} onClick={() => removeProduct(product)}>
                {pendingId === product.id ? <LoaderCircle size={14} className={styles.spinner} aria-hidden="true" /> : <Trash2 size={14} aria-hidden="true" />}Borrar
              </button>
            </div>
          </div>
        </article>)}</div>
      </section>) : <div className={styles.empty}><CopyCheck size={36} aria-hidden="true" /><h3>{groups.length ? "Sin resultados" : "Sin productos duplicados"}</h3></div>}
    </div>
    <footer className={styles.footer}>
      <div className={styles.result}><span>{countDuplicateProducts(filtered)} productos en {filtered.length} grupos</span><span className={styles.notice} role="status" aria-live="polite">{notice && <><Check size={14} aria-hidden="true" />{notice}</>}</span></div>
      <nav className={styles.pagination} aria-label="Paginas de duplicados">
        <button type="button" className={styles.iconButton} aria-label="Pagina anterior" title="Anterior" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}><ChevronLeft size={20} /></button>
        <span>P&aacute;gina {currentPage} de {totalPages}</span>
        <button type="button" className={styles.iconButton} aria-label="Pagina siguiente" title="Siguiente" disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)}><ChevronRight size={20} /></button>
      </nav>
    </footer>
  </dialog>;
}
