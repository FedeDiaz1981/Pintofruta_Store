"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Download, FileSpreadsheet, LoaderCircle, X } from "lucide-react";
import styles from "./price-list-import.module.css";

export function CustomerOrderDownloadButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [audience, setAudience] = useState<"public" | "member" | "">("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const downloading = useRef(false);
  const id = useId();
  useEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal();
    else if (!open && dialog.current?.open) dialog.current.close();
  }, [open]);

  async function download() {
    if (!audience || downloading.current) return;
    downloading.current = true;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/customer-order?audience=${audience}`, { cache: "no-store" });
      if (!response.ok) throw new Error("No se pudo generar la planilla de pedidos. Volvé a intentar.");
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = response.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ?? "Pedido_cliente.xlsm";
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo descargar el Excel.");
    } finally { downloading.current = false; setLoading(false); }
  }

  return <>
    <button type="button" className={className} onClick={() => { setAudience(""); setError(null); setOpen(true); }}>
      <FileSpreadsheet size={18} aria-hidden="true" />Descargar planilla de precios actualizadas
    </button>
    <dialog ref={dialog} className={`${styles.dialog} ${styles.downloadDialog}`} aria-labelledby={`${id}-title`}
      onClose={() => setOpen(false)} onCancel={event => { if (downloading.current) event.preventDefault(); }}>
      <header className={styles.header}>
        <div><p className={styles.eyebrow}>PEDIDO CLIENTE</p><h2 id={`${id}-title`}>Descargar planilla de pedidos</h2></div>
        <button type="button" className={styles.iconButton} aria-label="Cerrar descarga" disabled={loading} onClick={() => setOpen(false)}><X size={20} aria-hidden="true" /></button>
      </header>
      <div className={styles.body}>
        <fieldset className={styles.choices} disabled={loading}><legend>Tipo de lista</legend>
          {([["public", "Lista pública", "Con los precios públicos de la tienda."], ["member", "Lista con descuento", "Con los precios para clientes logueados."]] as const).map(([value, title, description]) => <label className={styles.candidate} data-selected={audience === value} key={value}>
            <input type="radio" name={`${id}-audience`} value={value} checked={audience === value} onChange={() => setAudience(value)} />
            <span><strong>{title}</strong><span className={styles.secondary}>{description}</span></span>
          </label>)}
        </fieldset>
        {error && <p className={styles.error} role="alert">{error}</p>}
      </div>
      <footer className={styles.footer}>
        <span className={styles.muted} role="status">{loading ? "Generando Excel..." : "Formato PEDIDO CLIENTE (.xlsm)"}</span>
        <div className={styles.footerActions}>
          <button type="button" className={styles.button} disabled={loading} onClick={() => setOpen(false)}>Cancelar</button>
          <button type="button" className={`${styles.button} ${styles.primary}`} disabled={!audience || loading} onClick={() => void download()}>
            {loading ? <LoaderCircle size={18} className={styles.spinner} aria-hidden="true" /> : <Download size={18} aria-hidden="true" />}Descargar Excel
          </button>
        </div>
      </footer>
    </dialog>
  </>;
}
