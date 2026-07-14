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

export function isNewArrival({
  createdAt,
  updatedAt,
  days = 7,
}: {
  createdAt?: string | null;
  updatedAt?: string | null;
  days?: number;
}) {
  if (!createdAt) {
    return false;
  }

  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) {
    return false;
  }

  if (updatedAt) {
    const updated = new Date(updatedAt);
    if (!Number.isNaN(updated.getTime()) && updated.getTime() - created.getTime() > 60_000) {
      return false;
    }
  }

  const ageMs = Date.now() - created.getTime();
  return ageMs <= days * 24 * 60 * 60 * 1000;
}
