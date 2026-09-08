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

function formatProgressPercent(complete: number, total: number | null) {
  if (!total || total <= 0) {
    return "0%";
  }

  const safePercent = Math.max(0, Math.min(100, Math.round((complete / total) * 100)));
  return `${safePercent}%`;
}

function estimateProcessingSeconds(mode: "preview" | "apply", file: File | null, preview: ExcelImportPlan | null) {
  const fileSizeMb = file ? file.size / (1024 * 1024) : 0;
  const rowFactor = preview ? Math.ceil(preview.parsedRows / 180) : 0;
  const baseSeconds = mode === "apply" ? 9 : 5;
  const sizeFactor = Math.ceil(fileSizeMb * (mode === "apply" ? 7 : 5));
  const total = baseSeconds + sizeFactor + rowFactor;

  return Math.min(90, Math.max(mode === "apply" ? 8 : 4, total));
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
  const [processingMode, setProcessingMode] = useState<"preview" | "apply" | null>(null);
  const [processingSecondsTotal, setProcessingSecondsTotal] = useState<number | null>(null);
  const [processingSecondsLeft, setProcessingSecondsLeft] = useState<number | null>(null);
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

  useEffect(() => {
    if (!processingMode) {
      return;
    }

    const estimatedSeconds = estimateProcessingSeconds(processingMode, file, preview);
    const deadline = Date.now() + estimatedSeconds * 1000;
    setProcessingSecondsTotal(estimatedSeconds);

    const updateCountdown = () => {
      const remainingSeconds = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setProcessingSecondsLeft(remainingSeconds);
    };

    updateCountdown();

    const intervalId = window.setInterval(updateCountdown, 1000);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [file, preview, processingMode]);

  function closeDialog() {
    setOpen(false);
  }

  function resetDialog() {
    setMode("guest");
    setFile(null);
    setPreview(null);
    setLoading(false);
    setApplying(false);
    setProcessingMode(null);
    setProcessingSecondsTotal(null);
    setProcessingSecondsLeft(null);
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

    setProcessingSecondsLeft(estimateProcessingSeconds("preview", file, preview));
    setProcessingMode("preview");
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
      setProcessingMode(null);
    }
  }

  async function applyImport() {
    if (!file) {
      setError("Elegí un archivo Excel primero.");
      return;
    }

    setProcessingSecondsLeft(estimateProcessingSeconds("apply", file, preview));
    setProcessingMode("apply");
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
      setProcessingMode(null);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        disabled={disabled}
        className="inline-flex h-14 items-center justify-center rounded-full border border-[rgba(111,69,40,0.18)] bg-[linear-gradient(180deg,var(--pf-primary-soft),var(--pf-primary))] px-6 text-sm font-black text-white shadow-[0_14px_30px_rgba(168,109,69,0.22)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Importar Excel
      </button>

      <dialog
        ref={dialogRef}
        className="modal !z-[12050] items-center justify-center p-4 sm:p-6 lg:p-8"
        onClick={(event) => {
          if (event.target === dialogRef.current) {
            closeDialog();
          }
        }}
      >
        <div className="modal-box relative flex w-[min(100%,76rem)] max-w-6xl max-h-[calc(100dvh-2rem)] flex-col overflow-hidden rounded-[2.25rem] border border-[rgba(168,109,69,0.18)] bg-[linear-gradient(180deg,rgba(255,251,245,0.99),rgba(248,242,233,0.98))] p-0 text-[var(--pf-text)] shadow-[0_34px_90px_rgba(74,57,38,0.24)] ring-1 ring-[rgba(255,255,255,0.42)] sm:max-h-[calc(100dvh-3rem)]">
          <div className="flex items-start justify-between gap-4 border-b border-[rgba(168,109,69,0.12)] px-4 py-4 sm:px-6 sm:py-5">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(168,109,69,0.16)] bg-[rgba(255,255,255,0.72)] px-3 py-1 text-[11px] font-black uppercase tracking-[0.3em] text-[var(--pf-secondary-dark)] shadow-[inset_0_1px_0_rgba(255,255,255,0.82)]">
                Importación masiva
              </div>
              <h3 className="mt-3 text-[1.9rem] font-black tracking-tight text-balance text-[var(--pf-text)] sm:text-[2.35rem]">
                Cargar precios desde Excel
              </h3>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--pf-muted)] sm:text-[0.98rem] sm:leading-7">
                Subí tu archivo, revisá la vista previa y confirmá la importación cuando estés seguro de los cambios.
              </p>
            </div>

            <button
              type="button"
              onClick={closeDialog}
              className="shrink-0 rounded-full border border-[rgba(168,109,69,0.14)] bg-white/90 px-4 py-2 text-sm font-semibold text-[var(--pf-primary-darker)] shadow-[0_8px_18px_rgba(74,57,38,0.08)] transition hover:-translate-y-0.5 hover:bg-white"
            >
              Cerrar
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-6">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(280px,0.88fr)]">
              <div className="grid gap-4">
                <label className="rounded-[1.55rem] border border-[rgba(168,109,69,0.14)] bg-[rgba(255,255,255,0.88)] p-4 shadow-[0_10px_24px_rgba(74,57,38,0.05)] sm:p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <span className="text-[11px] font-black uppercase tracking-[0.28em] text-[var(--pf-muted)]">Archivo</span>
                      <p className="mt-2 text-sm leading-6 text-[var(--pf-muted)]">
                        Elegí el Excel que querés importar. Antes de confirmar, verificá que sea el archivo correcto.
                      </p>
                    </div>
                  </div>

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
                    className="mt-4 block w-full rounded-[1rem] border border-[rgba(168,109,69,0.18)] bg-[rgba(255,255,255,0.92)] px-4 py-3 text-sm text-[var(--pf-text)] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] file:mr-4 file:rounded-full file:border-0 file:bg-[linear-gradient(180deg,var(--pf-primary-soft)_0%,var(--pf-primary)_100%)] file:px-4 file:py-2.5 file:text-sm file:font-bold file:text-white file:shadow-[0_10px_18px_rgba(168,109,69,0.18)]"
                  />
                  <p className="mt-3 text-xs text-[var(--pf-muted)]">
                    {file ? `Archivo cargado: ${file.name}` : "Podés usar un archivo .xlsx o .xls."}
                  </p>
                </label>

                <div className="rounded-[1.55rem] border border-[rgba(168,109,69,0.14)] bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(248,243,234,0.98))] p-4 shadow-[0_10px_24px_rgba(74,57,38,0.05)] sm:p-5">
                  <span className="text-[11px] font-black uppercase tracking-[0.28em] text-[var(--pf-muted)]">Tipo de precio</span>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => {
                        setMode("guest");
                        setPreview(null);
                      }}
                      className={`rounded-full px-4 py-3 text-sm font-bold transition ${
                        mode === "guest"
                          ? "bg-[linear-gradient(180deg,var(--pf-primary-soft)_0%,var(--pf-primary)_100%)] text-white shadow-[0_12px_24px_rgba(168,109,69,0.22)]"
                          : "border border-[rgba(168,109,69,0.14)] bg-white/90 text-[var(--pf-primary-darker)] hover:bg-white"
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
                      className={`rounded-full px-4 py-3 text-sm font-bold transition ${
                        mode === "member"
                          ? "bg-[linear-gradient(180deg,var(--pf-primary-soft)_0%,var(--pf-primary)_100%)] text-white shadow-[0_12px_24px_rgba(168,109,69,0.22)]"
                          : "border border-[rgba(168,109,69,0.14)] bg-white/90 text-[var(--pf-primary-darker)] hover:bg-white"
                      }`}
                    >
                      D - Logueados / miembros
                    </button>
                </div>
                <p className="mt-3 text-sm leading-6 text-[var(--pf-muted)]">
                  Elegí qué lista de precios querés actualizar. Si tenés dudas, usá Público / invitados.
                </p>
              </div>
            </div>

              <div className="rounded-[1.55rem] border border-[rgba(168,109,69,0.14)] bg-[rgba(255,255,255,0.88)] p-4 shadow-[0_10px_24px_rgba(74,57,38,0.05)] sm:p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span className="text-[11px] font-black uppercase tracking-[0.28em] text-[var(--pf-muted)]">Antes de confirmar</span>
                    <p className="mt-2 text-sm leading-6 text-[var(--pf-muted)]">
                      1. Cargá el archivo. 2. Revisá la vista previa. 3. Aplicá la importación sólo cuando todo esté correcto.
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid gap-3">
                  <div className="rounded-[1.25rem] border border-[rgba(168,109,69,0.12)] bg-[rgba(255,251,245,0.96)] px-4 py-3">
                    <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[var(--pf-muted)]">Estado</p>
                    <p className="mt-1 text-sm font-semibold text-[var(--pf-text)]">
                      {preview ? "Vista previa lista" : file ? "Archivo listo para revisar" : "Esperando tu archivo"}
                    </p>
                  </div>
                  <div className="rounded-[1.25rem] border border-[rgba(168,109,69,0.12)] bg-[rgba(255,251,245,0.96)] px-4 py-3">
                    <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[var(--pf-muted)]">Archivo</p>
                    <p className="mt-1 break-words text-sm font-semibold text-[var(--pf-text)]">
                      {file ? file.name : "Todavía no elegiste un archivo"}
                    </p>
                  </div>
                </div>

                <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={analyzeFile}
                    disabled={loading || applying}
                    className="inline-flex h-12 items-center justify-center rounded-full bg-[linear-gradient(180deg,var(--pf-primary-soft)_0%,var(--pf-primary)_100%)] px-5 text-sm font-black text-white shadow-[0_14px_30px_rgba(168,109,69,0.22)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loading ? "Analizando..." : "Previsualizar"}
                  </button>

                  <button
                    type="button"
                    onClick={applyImport}
                    disabled={!preview || loading || applying}
                    className="inline-flex h-12 items-center justify-center rounded-full border border-[rgba(168,109,69,0.18)] bg-[linear-gradient(180deg,rgba(255,251,245,0.98),rgba(242,228,211,0.98))] px-5 text-sm font-black text-[var(--pf-primary-darker)] shadow-[0_14px_30px_rgba(168,109,69,0.14)] transition hover:-translate-y-0.5 hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {applying ? "Aplicando..." : "Aplicar importación"}
                  </button>
                </div>

                {error ? (
                  <div className="mt-4 rounded-[1.25rem] border border-[rgba(185,79,54,0.22)] bg-[rgba(185,79,54,0.08)] px-4 py-3 text-sm text-[var(--pf-wood-muted)]">
                    {error}
                  </div>
                ) : null}

                {success ? (
                  <div className="mt-4 rounded-[1.25rem] border border-[rgba(74,57,38,0.14)] bg-[rgba(255,255,255,0.88)] px-4 py-3 text-sm text-[var(--pf-text)] shadow-[0_8px_18px_rgba(74,57,38,0.05)]">
                    {success}
                  </div>
                ) : null}
              </div>
            </div>

            {preview ? (
              <div className="mt-5 grid gap-4">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
                  <div className="rounded-[1.25rem] border border-[rgba(168,109,69,0.12)] bg-[rgba(255,255,255,0.92)] p-4 shadow-[0_8px_18px_rgba(74,57,38,0.05)]">
                    <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[var(--pf-muted)]">Filas</p>
                    <p className="mt-2 text-2xl font-black text-[var(--pf-text)]">{formatNumber(preview.parsedRows)}</p>
                  </div>
                  <div className="rounded-[1.25rem] border border-[rgba(168,109,69,0.12)] bg-[rgba(255,255,255,0.92)] p-4 shadow-[0_8px_18px_rgba(74,57,38,0.05)]">
                    <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[var(--pf-muted)]">Nuevos</p>
                    <p className="mt-2 text-2xl font-black text-[var(--pf-text)]">{formatNumber(preview.createdProducts)}</p>
                  </div>
                  <div className="rounded-[1.25rem] border border-[rgba(168,109,69,0.12)] bg-[rgba(255,255,255,0.92)] p-4 shadow-[0_8px_18px_rgba(74,57,38,0.05)]">
                    <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[var(--pf-muted)]">Actualizados</p>
                    <p className="mt-2 text-2xl font-black text-[var(--pf-text)]">{formatNumber(preview.updatedProducts)}</p>
                  </div>
                  <div className="rounded-[1.25rem] border border-[rgba(168,109,69,0.12)] bg-[rgba(255,255,255,0.92)] p-4 shadow-[0_8px_18px_rgba(74,57,38,0.05)]">
                    <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[var(--pf-muted)]">Marcas</p>
                    <p className="mt-2 text-2xl font-black text-[var(--pf-text)]">{formatNumber(preview.createdBrands)}</p>
                  </div>
                  <div className="rounded-[1.25rem] border border-[rgba(168,109,69,0.12)] bg-[rgba(255,255,255,0.92)] p-4 shadow-[0_8px_18px_rgba(74,57,38,0.05)]">
                    <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[var(--pf-muted)]">Categorías</p>
                    <p className="mt-2 text-2xl font-black text-[var(--pf-text)]">{formatNumber(preview.createdCategories)}</p>
                  </div>
                  <div className="rounded-[1.25rem] border border-[rgba(168,109,69,0.12)] bg-[rgba(255,255,255,0.92)] p-4 shadow-[0_8px_18px_rgba(74,57,38,0.05)]">
                    <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[var(--pf-muted)]">Omitidas</p>
                    <p className="mt-2 text-2xl font-black text-[var(--pf-text)]">{formatNumber(preview.ignoredRows)}</p>
                  </div>
                </div>

                <div className="overflow-hidden rounded-[1.5rem] border border-[rgba(168,109,69,0.14)] bg-[rgba(255,255,255,0.9)] shadow-[0_10px_24px_rgba(74,57,38,0.05)]">
                  <div className="flex items-center justify-between gap-4 border-b border-[rgba(168,109,69,0.1)] px-4 py-3 sm:px-5">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.28em] text-[var(--pf-muted)]">Vista previa</p>
                      <p className="mt-1 text-sm text-[var(--pf-muted)]">Revisá producto, marca, categoría y precio antes de confirmar la importación.</p>
                    </div>
                  </div>

                  <div className="max-h-[24rem] overflow-auto">
                    <table className="min-w-[900px] w-full border-collapse">
                      <thead className="bg-[linear-gradient(180deg,rgba(248,242,232,0.95),rgba(242,234,221,0.95))]">
                        <tr>
                          <th className="border-b border-[rgba(168,109,69,0.1)] px-4 py-3 text-left text-[11px] font-black uppercase tracking-[0.24em] text-[var(--pf-muted)]">
                            Fila
                          </th>
                          <th className="border-b border-[rgba(168,109,69,0.1)] px-4 py-3 text-left text-[11px] font-black uppercase tracking-[0.24em] text-[var(--pf-muted)]">
                            Acción
                          </th>
                          <th className="border-b border-[rgba(168,109,69,0.1)] px-4 py-3 text-left text-[11px] font-black uppercase tracking-[0.24em] text-[var(--pf-muted)]">
                            Marca
                          </th>
                          <th className="border-b border-[rgba(168,109,69,0.1)] px-4 py-3 text-left text-[11px] font-black uppercase tracking-[0.24em] text-[var(--pf-muted)]">
                            Producto
                          </th>
                          <th className="border-b border-[rgba(168,109,69,0.1)] px-4 py-3 text-left text-[11px] font-black uppercase tracking-[0.24em] text-[var(--pf-muted)]">
                            Categoría
                          </th>
                          <th className="border-b border-[rgba(168,109,69,0.1)] px-4 py-3 text-left text-[11px] font-black uppercase tracking-[0.24em] text-[var(--pf-muted)]">
                            Precio
                          </th>
                          <th className="border-b border-[rgba(168,109,69,0.1)] px-4 py-3 text-left text-[11px] font-black uppercase tracking-[0.24em] text-[var(--pf-muted)]">
                            Nota
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[rgba(168,109,69,0.08)]">
                        {preview.rows.slice(0, 60).map((row) => (
                          <tr key={`${row.rowNumber}-${row.productKey}`} className="transition hover:bg-[rgba(255,251,245,0.92)]">
                            <td className="px-4 py-3 text-sm text-[var(--pf-text)]">{row.rowNumber}</td>
                            <td className="px-4 py-3 text-sm font-semibold text-[var(--pf-primary-darker)]">
                              {row.action === "create" ? "Nuevo" : "Actualiza"}
                            </td>
                            <td className="px-4 py-3 text-sm text-[var(--pf-text)]">{row.brand}</td>
                            <td className="px-4 py-3 text-sm text-[var(--pf-text)]">{row.detail}</td>
                            <td className="px-4 py-3 text-sm text-[var(--pf-text)]">{row.categoryLabel}</td>
                            <td className="px-4 py-3 text-sm font-semibold text-[var(--pf-text)]">{formatCurrency(row.price)}</td>
                            <td className="px-4 py-3 text-sm text-[var(--pf-muted)]">
                              {row.notes.length > 0 ? row.notes.join(" · ") : row.currentPriceField ? "—" : "—"}
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

          {processingMode ? (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-[rgba(45,31,20,0.78)] px-4 py-6 backdrop-blur-md">
              <div className="w-full max-w-md rounded-[2rem] border border-[rgba(255,255,255,0.16)] bg-[linear-gradient(180deg,rgba(255,252,247,0.98),rgba(247,239,227,0.98))] p-6 text-center text-[var(--pf-text)] shadow-[0_28px_80px_rgba(34,23,16,0.26)]">
                <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border border-[rgba(168,109,69,0.14)] bg-white/75 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
                  <span className="relative flex h-16 w-16 items-center justify-center">
                    <span className="absolute inset-0 rounded-full border-4 border-[rgba(168,109,69,0.16)] border-t-[var(--pf-primary)] motion-safe:animate-spin" />
                    <span className="absolute inset-[0.45rem] rounded-full border border-[rgba(168,109,69,0.12)] bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(247,239,227,0.92))]" />
                    <span className="relative flex items-end gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-[var(--pf-primary)] motion-safe:animate-bounce [animation-delay:-0.2s]" />
                      <span className="h-3.5 w-3.5 rounded-full bg-[var(--pf-secondary-dark)] motion-safe:animate-bounce [animation-delay:0s]" />
                      <span className="h-2.5 w-2.5 rounded-full bg-[var(--pf-primary-soft)] motion-safe:animate-bounce [animation-delay:0.2s]" />
                    </span>
                  </span>
                </div>

                <p className="mt-5 text-[0.72rem] font-black uppercase tracking-[0.34em] text-[var(--pf-secondary-dark)]">
                  {processingMode === "apply" ? "Aplicando cambios" : "Procesando archivo"}
                </p>
                <h4 className="mt-2 text-2xl font-black tracking-tight text-[var(--pf-text)]">
                  {processingMode === "apply" ? "Estamos actualizando los datos" : "Estamos leyendo tu Excel"}
                </h4>
                <p className="mt-3 text-sm leading-6 text-[var(--pf-muted)]">
                  {processingMode === "apply"
                    ? "No cierres esta ventana mientras se guardan los cambios en productos, marcas y categorías."
                    : "Estamos revisando las filas del archivo para preparar la vista previa con precisión."}
                </p>

                <div className="mt-5 rounded-[1.25rem] border border-[rgba(168,109,69,0.14)] bg-white/80 px-4 py-3">
                  <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[var(--pf-muted)]">Avance estimado</p>
                  <div className="mt-3 h-3 overflow-hidden rounded-full bg-[rgba(168,109,69,0.12)]">
                    <div
                      className="h-full rounded-full bg-[linear-gradient(90deg,var(--pf-primary-soft),var(--pf-primary))] transition-[width] duration-500 ease-out"
                      style={{
                        width: `${Math.max(
                          0,
                          Math.min(
                            100,
                            processingSecondsTotal && processingSecondsLeft != null
                              ? ((processingSecondsTotal - processingSecondsLeft) / processingSecondsTotal) * 100
                              : 0,
                          ),
                        )}%`,
                      }}
                    />
                  </div>
                  <p className="mt-3 text-2xl font-black text-[var(--pf-text)]">
                    {formatProgressPercent(
                      processingSecondsTotal && processingSecondsLeft != null
                        ? processingSecondsTotal - processingSecondsLeft
                        : 0,
                      processingSecondsTotal,
                    )}
                  </p>
                </div>

                <p className="mt-4 text-xs leading-5 text-[var(--pf-muted)]">
                  El tiempo puede variar según el tamaño del archivo y la cantidad de productos a actualizar.
                  {processingSecondsLeft != null && processingSecondsLeft <= 0 ? " Seguimos procesando." : ""}
                </p>
              </div>
            </div>
          ) : null}
        </div>

        <form method="dialog" className="modal-backdrop">
          <button aria-label="Cerrar" />
        </form>
      </dialog>
    </>
  );
}



