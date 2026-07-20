"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ExcelImportMode, ExcelImportPlan } from "@/lib/excel-product-import";

function formatNumber(value: number) {
  return new Intl.NumberFormat("es-AR").format(value);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);
}

async function postExcelImport(formData: FormData) {
  const response = await fetch("/api/admin/excel-import", {
    method: "POST",
    body: formData,
  });

  const payload = (await response.json()) as
    | { ok: true; plan: ExcelImportPlan; message: string; action: "preview" | "apply" }
    | { ok: false; error: string };

  if (!response.ok || !payload.ok) {
    throw new Error("error" in payload ? payload.error : "No se pudo procesar el Excel.");
  }

  return payload;
}

export function ExcelImportButton({ disabled = false }: { disabled?: boolean }) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<ExcelImportMode>("guest");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ExcelImportPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    if (open && !dialog.open) {
      dialog.showModal();
      return;
    }

    if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    const handleClose = () => {
      setOpen(false);
    };

    dialog.addEventListener("close", handleClose);

    return () => {
      dialog.removeEventListener("close", handleClose);
    };
  }, []);

  function closeDialog() {
    setOpen(false);
  }

  function resetDialog() {
    setMode("guest");
    setFile(null);
    setPreview(null);
    setLoading(false);
    setApplying(false);
    setError(null);
    setSuccess(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function openDialog() {
    resetDialog();
    setOpen(true);
  }

  async function analyzeFile() {
    if (!file) {
      setError("Elegí un archivo Excel primero.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const formData = new FormData();
      formData.set("action", "preview");
      formData.set("mode", mode);
      formData.set("file", file);

      const result = await postExcelImport(formData);
      setPreview(result.plan);
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "No se pudo analizar el archivo.");
    } finally {
      setLoading(false);
    }
  }

  async function applyImport() {
    if (!file) {
      setError("Elegí un archivo Excel primero.");
      return;
    }

    setApplying(true);
    setError(null);
    setSuccess(null);

    try {
      const formData = new FormData();
      formData.set("action", "apply");
      formData.set("mode", mode);
      formData.set("file", file);

      const result = await postExcelImport(formData);
      setSuccess(result.message);
      router.refresh();

      window.setTimeout(() => {
        closeDialog();
        resetDialog();
      }, 650);
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "No se pudo aplicar la importación.");
    } finally {
      setApplying(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        disabled={disabled}
        className="inline-flex h-14 items-center justify-center rounded-full border border-[rgba(74,57,38,0.12)] bg-white px-6 text-sm font-black text-[var(--pf-primary-darker)] shadow-[0_10px_22px_rgba(58,44,25,0.06)] transition hover:bg-[var(--pf-surface-warm)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        Importar Excel
      </button>

      <dialog
        ref={dialogRef}
        className="modal modal-bottom sm:modal-middle"
        onClick={(event) => {
          if (event.target === dialogRef.current) {
            closeDialog();
          }
        }}
      >
        <div className="modal-box max-w-5xl overflow-hidden rounded-[2rem] border border-[var(--pf-border-warm)] bg-[var(--pf-surface)] p-0 text-[var(--pf-text)] shadow-[0_30px_80px_rgba(74,57,38,0.26)]">
          <div className="flex items-start justify-between gap-4 border-b border-[rgba(74,57,38,0.08)] px-6 py-5">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.32em] text-[var(--pf-secondary-dark)]">Importación masiva</p>
              <h3 className="mt-2 text-3xl font-black tracking-tight text-[var(--pf-text)]">Cargar precios desde Excel</h3>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--pf-muted)]">
                Seleccioná el archivo D o I, revisá el resultado y después aplicá la actualización sobre productos, marcas y categorías.
              </p>
            </div>

            <button
              type="button"
              onClick={closeDialog}
              className="rounded-full border border-[rgba(74,57,38,0.12)] bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-[var(--pf-surface-warm)]"
            >
              Cerrar
            </button>
          </div>

          <div className="max-h-[calc(92vh-110px)] overflow-auto px-6 py-6">
            <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
              <label className="rounded-[1.5rem] border border-[rgba(74,57,38,0.12)] bg-white p-4">
                <span className="text-xs font-black uppercase tracking-[0.28em] text-slate-400">Archivo</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(event) => {
                    const nextFile = event.target.files?.[0] ?? null;
                    setFile(nextFile);
                    setPreview(null);
                    setError(null);
                    setSuccess(null);
                  }}
                  className="mt-3 block w-full rounded-[1rem] border border-[rgba(74,57,38,0.12)] bg-[rgba(255,255,255,0.9)] px-4 py-3 text-sm text-slate-700 file:mr-4 file:rounded-full file:border-0 file:bg-[var(--pf-primary)] file:px-4 file:py-2 file:text-sm file:font-bold file:text-white"
                />
                <p className="mt-2 text-xs text-[var(--pf-muted)]">
                  {file ? `Seleccionado: ${file.name}` : "Excel con hoja PEDIDO CLIENTE."}
                </p>
              </label>

              <div className="rounded-[1.5rem] border border-[rgba(74,57,38,0.12)] bg-white p-4">
                <span className="text-xs font-black uppercase tracking-[0.28em] text-slate-400">Tipo de precio</span>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setMode("guest");
                      setPreview(null);
                    }}
                    className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                      mode === "guest"
                        ? "bg-[linear-gradient(180deg,var(--pf-secondary-light)_0%,var(--pf-secondary)_100%)] text-[var(--pf-primary-darker)]"
                        : "border border-[rgba(74,57,38,0.12)] bg-white text-slate-600 hover:bg-[var(--pf-surface-warm)]"
                    }`}
                  >
                    I - Público / invitados
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMode("member");
                      setPreview(null);
                    }}
                    className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                      mode === "member"
                        ? "bg-[linear-gradient(180deg,var(--pf-secondary-light)_0%,var(--pf-secondary)_100%)] text-[var(--pf-primary-darker)]"
                        : "border border-[rgba(74,57,38,0.12)] bg-white text-slate-600 hover:bg-[var(--pf-surface-warm)]"
                    }`}
                  >
                    D - Logueados / miembros
                  </button>
                </div>
                <p className="mt-3 text-sm text-[var(--pf-muted)]">
                  Este modo determina qué columna se actualiza en productos existentes.
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={analyzeFile}
                disabled={loading || applying}
                className="inline-flex h-12 items-center justify-center rounded-full bg-[linear-gradient(180deg,var(--pf-secondary-light)_0%,var(--pf-secondary)_100%)] px-5 text-sm font-black text-[var(--pf-primary-darker)] shadow-[0_14px_30px_rgba(168,109,69,0.22)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Analizando..." : "Previsualizar"}
              </button>

              <button
                type="button"
                onClick={applyImport}
                disabled={!preview || loading || applying}
                className="inline-flex h-12 items-center justify-center rounded-full border border-[rgba(74,57,38,0.12)] bg-white px-5 text-sm font-black text-[var(--pf-primary-darker)] shadow-[0_10px_22px_rgba(58,44,25,0.06)] transition hover:bg-[var(--pf-surface-warm)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {applying ? "Aplicando..." : "Aplicar importación"}
              </button>
            </div>

            {error ? (
              <div className="mt-4 rounded-[1.25rem] border border-[rgba(185,79,54,0.2)] bg-[rgba(185,79,54,0.08)] px-4 py-3 text-sm text-[var(--pf-wood-muted)]">
                {error}
              </div>
            ) : null}

            {success ? (
              <div className="mt-4 rounded-[1.25rem] border border-[rgba(74,57,38,0.14)] bg-[rgba(255,255,255,0.88)] px-4 py-3 text-sm text-slate-700">
                {success}
              </div>
            ) : null}

            {preview ? (
              <div className="mt-6 grid gap-4">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
                  <div className="rounded-[1.25rem] border border-[rgba(74,57,38,0.12)] bg-white p-4">
                    <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">Filas</p>
                    <p className="mt-2 text-2xl font-black text-slate-900">{formatNumber(preview.parsedRows)}</p>
                  </div>
                  <div className="rounded-[1.25rem] border border-[rgba(74,57,38,0.12)] bg-white p-4">
                    <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">Nuevos</p>
                    <p className="mt-2 text-2xl font-black text-slate-900">{formatNumber(preview.createdProducts)}</p>
                  </div>
                  <div className="rounded-[1.25rem] border border-[rgba(74,57,38,0.12)] bg-white p-4">
                    <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">Actualizados</p>
                    <p className="mt-2 text-2xl font-black text-slate-900">{formatNumber(preview.updatedProducts)}</p>
                  </div>
                  <div className="rounded-[1.25rem] border border-[rgba(74,57,38,0.12)] bg-white p-4">
                    <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">Marcas</p>
                    <p className="mt-2 text-2xl font-black text-slate-900">{formatNumber(preview.createdBrands)}</p>
                  </div>
                  <div className="rounded-[1.25rem] border border-[rgba(74,57,38,0.12)] bg-white p-4">
                    <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">Categorías</p>
                    <p className="mt-2 text-2xl font-black text-slate-900">{formatNumber(preview.createdCategories)}</p>
                  </div>
                  <div className="rounded-[1.25rem] border border-[rgba(74,57,38,0.12)] bg-white p-4">
                    <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">Omitidas</p>
                    <p className="mt-2 text-2xl font-black text-slate-900">{formatNumber(preview.ignoredRows)}</p>
                  </div>
                </div>

                <div className="overflow-hidden rounded-[1.5rem] border border-[rgba(74,57,38,0.12)] bg-white">
                  <div className="border-b border-[rgba(74,57,38,0.08)] px-4 py-3">
                    <p className="text-[11px] font-black uppercase tracking-[0.28em] text-slate-400">Vista previa</p>
                  </div>

                  <div className="max-h-[24rem] overflow-auto">
                    <table className="min-w-[900px] w-full border-collapse">
                      <thead className="bg-[rgba(248,242,232,0.8)]">
                        <tr>
                          <th className="border-b border-[rgba(74,57,38,0.08)] px-4 py-3 text-left text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">
                            Fila
                          </th>
                          <th className="border-b border-[rgba(74,57,38,0.08)] px-4 py-3 text-left text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">
                            Acción
                          </th>
                          <th className="border-b border-[rgba(74,57,38,0.08)] px-4 py-3 text-left text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">
                            Marca
                          </th>
                          <th className="border-b border-[rgba(74,57,38,0.08)] px-4 py-3 text-left text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">
                            Producto
                          </th>
                          <th className="border-b border-[rgba(74,57,38,0.08)] px-4 py-3 text-left text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">
                            Categoría
                          </th>
                          <th className="border-b border-[rgba(74,57,38,0.08)] px-4 py-3 text-left text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">
                            Precio
                          </th>
                          <th className="border-b border-[rgba(74,57,38,0.08)] px-4 py-3 text-left text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">
                            Nota
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.rows.slice(0, 60).map((row) => (
                          <tr key={`${row.rowNumber}-${row.productKey}`} className="border-b border-[rgba(74,57,38,0.06)]">
                            <td className="px-4 py-3 text-sm text-slate-700">{row.rowNumber}</td>
                            <td className="px-4 py-3 text-sm font-semibold text-[var(--pf-primary-darker)]">
                              {row.action === "create" ? "Nuevo" : "Actualiza"}
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-700">{row.brand}</td>
                            <td className="px-4 py-3 text-sm text-slate-700">{row.detail}</td>
                            <td className="px-4 py-3 text-sm text-slate-700">{row.categoryLabel}</td>
                            <td className="px-4 py-3 text-sm font-semibold text-slate-900">{formatCurrency(row.price)}</td>
                            <td className="px-4 py-3 text-sm text-slate-500">
                              {row.notes.length > 0 ? row.notes.join(" · ") : row.currentPriceField ?? "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <form method="dialog" className="modal-backdrop">
          <button aria-label="Cerrar" />
        </form>
      </dialog>
    </>
  );
}
