"use client";

import { useState } from "react";
import { Download, LoaderCircle } from "lucide-react";

export function PriceListDownloadButton({ className }: { className?: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function download() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/price-list", { cache: "no-store" });
      if (!response.ok) throw new Error("No se pudo descargar la lista de precios.");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = response.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ?? "Lista_de_precios.xlsx";
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo descargar el Excel.");
    } finally { setLoading(false); }
  }
  return <>
    <button type="button" className={className} disabled={loading} onClick={() => void download()}>
      {loading ? <LoaderCircle size={18} className="animate-spin" aria-hidden="true" /> : <Download size={18} aria-hidden="true" />}
      {loading ? "Descargando lista..." : "Descargar lista de precios actualizada"}
    </button>
    {error && <span role="alert" className="text-sm text-red-700">{error}</span>}
  </>;
}
