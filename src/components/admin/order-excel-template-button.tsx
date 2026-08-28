"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { OrderTemplateAudience } from "@/infrastructure/order-template";

type UploadResponse =
  | {
      ok: true;
      message: string;
    }
  | {
      ok: false;
      error: string;
    };

async function postTemplateUpload(formData: FormData) {
  const response = await fetch("/api/admin/order-excel-template", {
    method: "POST",
    body: formData,
  });

  const payload = (await response.json().catch(() => ({}))) as UploadResponse;

  if (!response.ok || !payload.ok) {
    throw new Error("error" in payload ? payload.error : "No se pudo subir la plantilla.");
  }

  return payload;
}

export function OrderExcelTemplateButton({ disabled = false }: { disabled?: boolean }) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [audience, setAudience] = useState<OrderTemplateAudience>("guest");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
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

  function resetDialog() {
    setAudience("guest");
    setFile(null);
    setLoading(false);
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

  function closeDialog() {
    setOpen(false);
  }

  async function handleUpload() {
    if (!file) {
      setError("Elegí un archivo Excel primero.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const formData = new FormData();
      formData.set("audience", audience);
      formData.set("file", file);

      const result = await postTemplateUpload(formData);
      setSuccess(result.message);
      router.refresh();

      window.setTimeout(() => {
        closeDialog();
        resetDialog();
      }, 700);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "No se pudo subir la plantilla.");
    } finally {
      setLoading(false);
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
        Subir template Excel
      </button>

      <dialog
        ref={dialogRef}
        className="modal modal-top !z-[12050] items-start pt-[96px] lg:pt-[136px]"
        onClick={(event) => {
          if (event.target === dialogRef.current) {
            closeDialog();
          }
        }}
      >
        <div className="modal-box max-w-3xl overflow-hidden rounded-[2rem] border border-[var(--pf-border-warm)] bg-[var(--pf-surface)] p-0 text-[var(--pf-text)] shadow-[0_30px_80px_rgba(74,57,38,0.26)]">
          <div className="flex items-start justify-between gap-4 border-b border-[rgba(74,57,38,0.08)] px-6 py-5">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.32em] text-[var(--pf-secondary-dark)]">Plantilla de pedido</p>
              <h3 className="mt-2 text-3xl font-black tracking-tight text-[var(--pf-text)]">Subir template Excel</h3>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--pf-muted)]">
                Esta subida no importa productos. Solo guarda una nueva versión del archivo que se usa después al exportar el pedido.
              </p>
            </div>

            <button
              type="button"
              onClick={closeDialog}
              className="rounded-full border border-[rgba(74,57,38,0.12)] bg-white px-4 py-2 text-sm font-semibold text-[var(--pf-primary-darker)] transition hover:bg-[var(--pf-surface-warm)]"
            >
              Cerrar
            </button>
          </div>

          <div className="px-6 py-6">
            <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
              <label className="rounded-[1.5rem] border border-[rgba(74,57,38,0.12)] bg-white p-4">
                <span className="text-xs font-black uppercase tracking-[0.28em] text-[var(--pf-muted)]">Archivo</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(event) => {
                    const nextFile = event.target.files?.[0] ?? null;
                    setFile(nextFile);
                    setError(null);
                    setSuccess(null);
                  }}
                  className="mt-3 block w-full rounded-[1rem] border border-[rgba(74,57,38,0.12)] bg-[rgba(255,255,255,0.9)] px-4 py-3 text-sm text-[var(--pf-text)] file:mr-4 file:rounded-full file:border-0 file:bg-[var(--pf-primary)] file:px-4 file:py-2 file:text-sm file:font-bold file:text-white"
                />
                <p className="mt-2 text-xs text-[var(--pf-muted)]">
                  {file ? `Seleccionado: ${file.name}` : "Subi el template Excel que quieras usar como base."}
                </p>
              </label>

              <div className="rounded-[1.5rem] border border-[rgba(74,57,38,0.12)] bg-white p-4">
                <span className="text-xs font-black uppercase tracking-[0.28em] text-[var(--pf-muted)]">Destino</span>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setAudience("guest")}
                    className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                      audience === "guest"
                        ? "bg-[linear-gradient(180deg,var(--pf-primary-soft)_0%,var(--pf-primary)_100%)] text-white"
                        : "border border-[rgba(74,57,38,0.12)] bg-white text-[var(--pf-primary-darker)] hover:bg-[var(--pf-surface-warm)]"
                    }`}
                  >
                    I - Público / invitados
                  </button>
                  <button
                    type="button"
                    onClick={() => setAudience("member")}
                    className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                      audience === "member"
                        ? "bg-[linear-gradient(180deg,var(--pf-primary-soft)_0%,var(--pf-primary)_100%)] text-white"
                        : "border border-[rgba(74,57,38,0.12)] bg-white text-[var(--pf-primary-darker)] hover:bg-[var(--pf-surface-warm)]"
                    }`}
                  >
                    D - Logueados / miembros
                  </button>
                </div>
                <p className="mt-3 text-sm text-[var(--pf-muted)]">
                  Se guarda como la ultima version activa para ese tipo de cliente.
                </p>
              </div>
            </div>

            {error ? (
              <div className="mt-4 rounded-[1.25rem] border border-[rgba(185,79,54,0.2)] bg-[rgba(185,79,54,0.08)] px-4 py-3 text-sm text-[var(--pf-wood-muted)]">
                {error}
              </div>
            ) : null}

            {success ? (
              <div className="mt-4 rounded-[1.25rem] border border-[rgba(74,57,38,0.14)] bg-[rgba(255,255,255,0.88)] px-4 py-3 text-sm text-[var(--pf-text)]">
                {success}
              </div>
            ) : null}

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleUpload}
                disabled={loading}
                className="inline-flex h-12 items-center justify-center rounded-full bg-[linear-gradient(180deg,var(--pf-primary-soft)_0%,var(--pf-primary)_100%)] px-5 text-sm font-black text-white shadow-[0_14px_30px_rgba(168,109,69,0.22)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Subiendo..." : "Guardar plantilla"}
              </button>
            </div>
          </div>

          <form method="dialog" className="modal-backdrop">
            <button aria-label="Cerrar" />
          </form>
        </div>
      </dialog>
    </>
  );
}




