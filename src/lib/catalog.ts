export function publicAsset(path: string | undefined | null, fallback = "/assets/images/no-image.svg") {
  if (!path) {
    return fallback;
  }

  return path.startsWith("/") ? path : `/${path}`;
}

export function formatCurrency(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) {
    return "Sin calcular";
  }

  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);
}

export function normalizeText(value: string | null | undefined) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

