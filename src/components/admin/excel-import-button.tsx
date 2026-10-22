"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, CheckCircle2, FileSpreadsheet, LoaderCircle, X } from "lucide-react";
import type { ExcelImportPlan, ImportDecision, PriceListPreviewRow } from "@/lib/price-list";
import { formatCurrency } from "@/lib/catalog";
import styles from "./price-list-import.module.css";

const actionLabels = { create: "Nuevo", update: "Actualizar", unchanged: "Sin cambios", resolve: "Por resolver", error: "Error" };

async function postImport(file: File, action: "preview" | "apply", decisions: ImportDecision[], revision?: string) {
  const data = new FormData();
  data.set("file", file);
  data.set("action", action);
  data.set("decisions", JSON.stringify(decisions));
  if (revision) data.set("revision", revision);
  const response = await fetch("/api/admin/excel-import", { method: "POST", body: data });
  const payload = await response.json().catch(() => null) as { ok: boolean; plan?: ExcelImportPlan; error?: string } | null;
  if (!response.ok || !payload?.ok || !payload.plan) throw new Error(payload?.error ?? "No se pudo procesar la lista de precios.");
  return payload.plan;
}

export function ExcelImportButton({ disabled = false, className }: { disabled?: boolean; className?: string }) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const resolutionRef = useRef<HTMLDialogElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [plan, setPlan] = useState<ExcelImportPlan | null>(null);
  const [decisions, setDecisions] = useState<ImportDecision[]>([]);
  const [draftDecisions, setDraftDecisions] = useState<ImportDecision[]>([]);
  const [resolutionRow, setResolutionRow] = useState<number | null>(null);
  const [choice, setChoice] = useState<number | "new" | "">("");
  const [busy, setBusy] = useState<"preview" | "apply" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (open && !dialogRef.current?.open) dialogRef.current?.showModal();
    else if (!open && dialogRef.current?.open) dialogRef.current.close();
  }, [open]);
  useEffect(() => {
    if (resolutionRow !== null && !resolutionRef.current?.open) resolutionRef.current?.showModal();
    else if (resolutionRow === null && resolutionRef.current?.open) resolutionRef.current.close();
  }, [resolutionRow]);

  const matches = plan?.rows.filter((row) => row.id === null && row.candidates.length) ?? [];
  const activeRow = matches.find((row) => row.rowNumber === resolutionRow);
  const activeIndex = matches.findIndex((row) => row.rowNumber === resolutionRow);
  const canApply = plan && !plan.errors.length && !plan.unresolvedRows && !busy && !success
    && plan.createdProducts + plan.updatedProducts > 0;

  function openResolution(row: PriceListPreviewRow, choices: ImportDecision[]) {
    setDraftDecisions(choices);
    setChoice(choices.find((item) => item.rowNumber === row.rowNumber)?.productId ?? "");
    setResolutionRow(row.rowNumber);
  }

  function openDialog() {
    setFile(null);
    setPlan(null);
    setDecisions([]);
    setDraftDecisions([]);
    setResolutionRow(null);
    setError(null);
    setSuccess(false);
    if (fileRef.current) fileRef.current.value = "";
    setOpen(true);
  }

  async function analyze(choices = decisions) {
    if (!file || busy) return;
    setBusy("preview");
    setError(null);
    try {
      const next = await postImport(file, "preview", choices);
      setPlan(next);
      setDecisions(choices);
      const pending = next.rows.find((row) => row.action === "resolve");
      if (pending) openResolution(pending, choices);
      else setResolutionRow(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo analizar el archivo.");
      setResolutionRow(null);
      setPlan(null);
    } finally {
      setBusy(null);
    }
  }

  async function confirmChoice() {
    if (!activeRow || choice === "" || busy) return;
    const next = [...draftDecisions.filter((item) => item.rowNumber !== activeRow.rowNumber), { rowNumber: activeRow.rowNumber, productId: choice }];
    const pending = matches.find((row) => !next.some((item) => item.rowNumber === row.rowNumber)) ?? matches[activeIndex + 1];
    if (pending) openResolution(pending, next);
    else await analyze(next);
  }

  async function apply() {
    if (!file || !plan || !canApply) return;
    setBusy("apply");
    setError(null);
    try {
      await postImport(file, "apply", decisions, plan.revision);
      setSuccess(true);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo importar la lista.");
      setPlan(null);
    } finally {
      setBusy(null);
    }
  }

  return <>
    <button type="button" disabled={disabled} onClick={openDialog} className={className ?? styles.button}>
      <FileSpreadsheet size={18} aria-hidden="true" />Importar Excel
    </button>
    <dialog ref={dialogRef} className={styles.dialog} aria-labelledby="price-import-title"
      onClose={() => setOpen(false)} onCancel={(event) => { if (busy) event.preventDefault(); }}>
      <header className={styles.header}>
        <div><p className={styles.eyebrow}>Productos</p><h2 id="price-import-title">Importar lista de precios</h2></div>
        <button type="button" className={styles.iconButton} aria-label="Cerrar importacion" title="Cerrar" disabled={!!busy} onClick={() => setOpen(false)}><X size={20} /></button>
      </header>
      <div className={styles.body}>
        {success ? <div className={styles.success} role="status"><CheckCircle2 size={30} /><h3>Lista actualizada</h3><p>{plan?.updatedProducts ?? 0} actualizados · {plan?.createdProducts ?? 0} nuevos</p></div> : <>
          <label className={styles.fileLabel}>Archivo Excel
            <input ref={fileRef} type="file" accept=".xlsx,.xls" disabled={!!busy} onChange={(event) => {
              setFile(event.target.files?.[0] ?? null); setPlan(null); setDecisions([]); setError(null);
            }} />
          </label>
          {error && <p className={styles.error} role="alert">{error}</p>}
          {plan && <>
            <dl className={styles.summary}>
              <div><dt>Nuevos</dt><dd>{plan.createdProducts}</dd></div>
              <div><dt>A actualizar</dt><dd>{plan.updatedProducts}</dd></div>
              <div><dt>Sin cambios</dt><dd>{plan.unchangedProducts}</dd></div>
              <div><dt>Por resolver</dt><dd>{plan.unresolvedRows}</dd></div>
            </dl>
            {!!plan.errors.length && <div className={styles.error} role="alert"><strong>Hay conflictos en la lista</strong><ul>{plan.errors.slice(0, 30).map((message, index) => <li key={index}>{message}</li>)}</ul>{plan.errors.length > 30 && <p>Y {plan.errors.length - 30} errores mas.</p>}</div>}
            {!!matches.length && <button className={styles.button} type="button" disabled={!!busy} onClick={() => openResolution(matches.find((row) => row.action === "resolve" || row.action === "error") ?? matches[0], decisions)}>Revisar coincidencias ({matches.length})</button>}
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead><tr><th>Fila / ID</th><th>Nombre / Marca</th><th>Precio publico</th><th>Precio logueado</th><th>Estado</th></tr></thead>
                <tbody>{plan.rows.map((row) => <tr key={row.rowNumber}>
                  <td><span className={styles.muted}>Fila {row.rowNumber}</span><br />{row.productId ? `ID ${row.productId}` : "Sin ID"}</td>
                  <td><strong>{row.name}</strong><span className={styles.secondary}>{row.brand}</span>
                    {row.current && row.current.name !== row.name && <span className={styles.secondary}>Antes: {row.current.name}</span>}</td>
                  <td>{row.current && row.current.public_price !== row.publicPrice && <del className={styles.secondary}>{formatCurrency(row.current.public_price)}</del>}{formatCurrency(row.publicPrice)}</td>
                  <td>{row.current && row.current.member_price !== row.memberPrice && <del className={styles.secondary}>{formatCurrency(row.current.member_price)}</del>}{formatCurrency(row.memberPrice)}</td>
                  <td><span className={styles.state} data-state={row.action}>{actionLabels[row.action]}</span></td>
                </tr>)}</tbody>
              </table>
            </div>
          </>}
        </>}
      </div>
      <footer className={styles.footer}>
        <span className={styles.muted} role="status">{busy ? <><LoaderCircle className={styles.spinner} size={16} />{busy === "apply" ? "Guardando cambios..." : "Analizando lista..."}</> : plan && !success ? `${plan.rows.length} productos en el archivo` : ""}</span>
        <div className={styles.footerActions}>
          <button type="button" className={styles.button} disabled={!!busy} onClick={() => setOpen(false)}>{success ? "Cerrar" : "Cancelar"}</button>
          {!success && <button type="button" className={styles.button} disabled={!file || !!busy} onClick={() => void analyze()}>Previsualizar</button>}
          {!success && <button type="button" className={`${styles.button} ${styles.primary}`} disabled={!canApply} onClick={() => void apply()}><Check size={17} />Confirmar importacion</button>}
        </div>
      </footer>
    </dialog>
    <dialog ref={resolutionRef} className={`${styles.dialog} ${styles.resolution}`} aria-labelledby="price-match-title"
      onClose={() => setResolutionRow(null)} onCancel={(event) => { if (busy) event.preventDefault(); }}>
      <header className={styles.header}>
        <div><p className={styles.eyebrow}>Coincidencia {activeIndex + 1} de {matches.length}</p><h2 id="price-match-title">Identificar producto</h2></div>
        <button type="button" className={styles.iconButton} aria-label="Cerrar coincidencias" title="Cerrar" disabled={!!busy} onClick={() => setResolutionRow(null)}><X size={20} /></button>
      </header>
      {activeRow && <div className={styles.body}>
        <section className={styles.uploaded} aria-label="Producto del Excel">
          <span className={styles.eyebrow}>Excel · Fila {activeRow.rowNumber} · Sin ID</span>
          <h3>{activeRow.name}</h3><p>{activeRow.brand}</p>
          <div className={styles.prices}><span>Publico <strong>{formatCurrency(activeRow.publicPrice)}</strong></span><span>Logueado <strong>{formatCurrency(activeRow.memberPrice)}</strong></span></div>
        </section>
        <fieldset className={styles.choices}><legend>Posibles productos existentes</legend>
          {activeRow.candidates.map((candidate) => <label className={styles.candidate} key={candidate.id} data-selected={choice === candidate.id}>
            <input type="radio" name="product-match" value={candidate.id} checked={choice === candidate.id} disabled={!!busy} onChange={() => setChoice(candidate.id)} />
            <span className={styles.candidateInfo}><strong>{candidate.name}</strong><span className={styles.secondary}>ID {candidate.id} · {candidate.brand}</span></span>
            <span className={styles.prices}><span>Publico <strong>{formatCurrency(candidate.public_price)}</strong></span><span>Logueado <strong>{formatCurrency(candidate.member_price)}</strong></span></span>
          </label>)}
          <label className={`${styles.candidate} ${styles.newProduct}`} data-selected={choice === "new"}>
            <input type="radio" name="product-match" value="new" checked={choice === "new"} disabled={!!busy} onChange={() => setChoice("new")} />
            <strong>Es un producto nuevo</strong>
          </label>
        </fieldset>
      </div>}
      <footer className={styles.footer}>
        <span className={styles.muted}>{draftDecisions.length} decisiones seleccionadas</span>
        <div className={styles.footerActions}>
          <button type="button" className={styles.button} disabled={activeIndex <= 0 || !!busy} onClick={() => openResolution(matches[activeIndex - 1], draftDecisions)}><ArrowLeft size={16} />Anterior</button>
          <button type="button" className={`${styles.button} ${styles.primary}`} disabled={choice === "" || !!busy} onClick={() => void confirmChoice()}>{busy ? <LoaderCircle className={styles.spinner} size={16} /> : <Check size={16} />}Confirmar eleccion</button>
        </div>
      </footer>
    </dialog>
  </>;
}
