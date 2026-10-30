export const PRODUCT_INTEGER_MAX = 2147483647;
export const PRODUCT_REQUIRED_FIELDS = ["name", "detail", "brand", "categoryIds", "publicPrice", "memberPrice"] as const;
export type ProductValidationField = typeof PRODUCT_REQUIRED_FIELDS[number] | "featuredPriority";
export type ProductFieldErrors = Partial<Record<ProductValidationField, string>>;
export type ProductSaveResult = { ok: true } | { ok: false; errors: ProductFieldErrors; message?: string };

function missing(value: unknown) {
  return value == null || (typeof value === "string" && !value.trim());
}

function validInteger(value: unknown, minimum: number) {
  if (missing(value) || (typeof value !== "string" && typeof value !== "number")) return false;
  const number = Number(value);
  return Number.isInteger(number) && number >= minimum && number <= PRODUCT_INTEGER_MAX;
}

export function parseProductCategoryIds(value: unknown): number[] | null {
  if (missing(value)) return [];
  let values = value;
  if (typeof values === "string") {
    try { values = JSON.parse(values); } catch { return null; }
  }
  if (!Array.isArray(values) || values.some((id) => !validInteger(id, 1))) return null;
  return [...new Set(values.map(Number))];
}

export function getProductFieldErrors(record: Record<string, unknown>, fields?: readonly ProductValidationField[]): ProductFieldErrors {
  const errors: ProductFieldErrors = {};
  for (const [key, label] of [["name", "nombre"], ["detail", "detalle"], ["brand", "marca"]] as const) {
    if (typeof record[key] !== "string" || !record[key].trim()) errors[key] = `Complet\u00e1 ${key === "brand" ? "la" : "el"} ${label}.`;
    else if (record[key].includes("\u0000")) errors[key] = "El texto contiene un car\u00e1cter no v\u00e1lido.";
  }
  const categories = parseProductCategoryIds(record.categoryIds);
  if (!categories || categories.length === 0) errors.categoryIds = "Seleccion\u00e1 al menos una categor\u00eda v\u00e1lida.";
  for (const [key, label] of [["publicPrice", "precio p\u00fablico"], ["memberPrice", "precio miembro"]] as const) {
    if (missing(record[key])) errors[key] = `Complet\u00e1 el ${label}.`;
    else if (!validInteger(record[key], 1)) errors[key] = "Ingres\u00e1 un precio entero mayor que cero y menor o igual a 2147483647.";
  }
  if (!missing(record.featuredPriority) && !validInteger(record.featuredPriority, -2147483648)) {
    errors.featuredPriority = "La prioridad debe ser un n\u00famero entero entre -2147483648 y 2147483647.";
  }
  if (fields) {
    for (const field of Object.keys(errors) as ProductValidationField[]) {
      if (!fields.includes(field)) delete errors[field];
    }
  }
  return errors;
}
