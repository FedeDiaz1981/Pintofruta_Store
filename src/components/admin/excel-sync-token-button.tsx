"use client";

import { useState } from "react";

export function ExcelSyncTokenButton() {
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState("");
  const [message, setMessage] = useState("");

  async function generate() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/excel-sync-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: "Planilla Excel" }),
      });
      const result = await response.json() as { ok?: boolean; token?: string; error?: string };
      if (!response.ok || !result.token) throw new Error(result.error ?? "No se pudo generar el token.");
      setToken(result.token);
      setMessage("Token generado. Copialo y pegalo en CONFIGURACION!B2.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo generar el token.");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(token);
      } else {
        const input = document.createElement("textarea");
        input.value = token;
        input.setAttribute("readonly", "true");
        input.style.position = "fixed";
        input.style.opacity = "0";
        document.body.appendChild(input);
        input.select();
        if (!document.execCommand("copy")) throw new Error("No se pudo copiar automáticamente.");
        input.remove();
      }
      setMessage("Token copiado.");
    } catch {
      setMessage("No se pudo copiar automáticamente. Seleccioná el token y copialo manualmente.");
    }
  }

  return (
    <div className="mt-3 rounded-[18px] border border-white/10 bg-white/10 p-4 text-[#f8f1e7]/90">
      <p className="text-sm font-semibold">Sincronizador Excel</p>
      <p className="mt-1 text-xs text-[#f8f1e7]/60">Generá una clave limitada para actualizar el catálogo.</p>
      <button type="button" onClick={() => void generate()} disabled={busy} className="mt-3 w-full rounded-xl bg-[var(--pf-secondary-light)] px-3 py-2 text-sm font-bold text-[var(--pf-text)] disabled:opacity-60">
        {busy ? "Generando..." : "Generar token Excel"}
      </button>
      {token && <>
        <input aria-label="Token Excel" readOnly value={token} onFocus={(event) => event.currentTarget.select()} className="mt-2 w-full rounded-xl border border-white/20 bg-black/10 px-2 py-2 text-[10px] text-[#f8f1e7]" />
        <button type="button" onClick={() => void copy()} className="mt-2 w-full rounded-xl border border-white/20 px-3 py-2 text-xs font-bold">Copiar token</button>
      </>}
      {message && <p className="mt-2 text-xs leading-5 text-[#f8f1e7]/80">{message}</p>}
    </div>
  );
}
