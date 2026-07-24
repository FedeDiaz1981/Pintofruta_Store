import { Coffee, Dna, Leaf, Megaphone, Package, Sparkles, Snowflake, Ban, ShieldCheck, ShoppingBag } from "lucide-react";

const CATEGORY_ICON_KEYS = [
  "package",
  "coffee",
  "snowflake",
  "sparkles",
  "megaphone",
  "leaf",
  "ban",
  "shield-check",
  "dna",
  "shopping-bag",
] as const;

export type CategoryIconKey = (typeof CATEGORY_ICON_KEYS)[number];

const keywordRules: Array<{ patterns: RegExp[]; icon: CategoryIconKey }> = [
  { patterns: [/promo/, /oferta/, /descuento/], icon: "megaphone" },
  { patterns: [/refrig/, /frio/, /helad/], icon: "snowflake" },
  { patterns: [/congel/, /freezer/], icon: "snowflake" },
  { patterns: [/bebid/, /agua/, /jugo/, /gaseos/, /te/, /cafe/, /coffee/], icon: "coffee" },
  { patterns: [/cosm/, /bellez/, /cuidado personal/], icon: "sparkles" },
  { patterns: [/veg/, /natural/, /org[aá]nic/], icon: "leaf" },
  { patterns: [/gluten/, /az[uú]car/, /sin\s+/, /sin-/], icon: "ban" },
  { patterns: [/kosher/, /apto/, /certif/, /seguro/], icon: "shield-check" },
  { patterns: [/dna/, /gen[eé]t/, /modific/], icon: "dna" },
  { patterns: [/alacen/, /despensa/, /cocina/, /snack/, /comida/], icon: "package" },
];

function normalizeForMatch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function resolveCategoryIconKey(name: string, fallback: CategoryIconKey = "package"): CategoryIconKey {
  const normalized = normalizeForMatch(name);

  for (const rule of keywordRules) {
    if (rule.patterns.some((pattern) => pattern.test(normalized))) {
      return rule.icon;
    }
  }

  return fallback;
}

export const categoryIconKeys = CATEGORY_ICON_KEYS;

export const categoryIconLabels: Record<CategoryIconKey, string> = {
  package: "Paquete",
  coffee: "Bebida",
  snowflake: "Frío",
  sparkles: "Belleza",
  megaphone: "Promo",
  leaf: "Natural",
  ban: "Restricción",
  "shield-check": "Certificado",
  dna: "Genético",
  "shopping-bag": "Bolsa",
};

export const categoryIconComponents = {
  package: Package,
  coffee: Coffee,
  snowflake: Snowflake,
  sparkles: Sparkles,
  megaphone: Megaphone,
  leaf: Leaf,
  ban: Ban,
  "shield-check": ShieldCheck,
  dna: Dna,
  "shopping-bag": ShoppingBag,
} satisfies Record<CategoryIconKey, typeof Package>;
