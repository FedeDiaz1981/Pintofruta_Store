import { getSiteContent } from "@/infrastructure/site-content.repository";
import type { BrandItem, CatalogFilters, CategoryItem, HomePageViewModel, ProductItem } from "@/domain/site-content";
import { normalizeText } from "@/lib/catalog";

export interface DynamicMenuItem {
  label: string;
  href: string;
  initial: string;
}

export interface DynamicMenuGroup {
  label: string;
  initials: string[];
  itemsByInitial: {
    initial: string;
    items: DynamicMenuItem[];
  }[];
}

export interface DynamicHeaderMenu {
  key: "brands" | "categories";
  label: string;
  href: string;
  groups: DynamicMenuGroup[];
}

function getAlphabetPair(initial: string) {
  const normalized = initial.toUpperCase();
  if (normalized < "A" || normalized > "Z") {
    return "#";
  }

  const code = normalized.charCodeAt(0) - 65;
  const start = String.fromCharCode(65 + Math.floor(code / 2) * 2);
  const end = String.fromCharCode(Math.min(90, start.charCodeAt(0) + 1));
  return `${start}-${end}`;
}

function buildDynamicMenu<T extends { name: string }>(
  items: T[],
  options: {
    key: "brands" | "categories";
    label: string;
    href: string;
    linkFor: (item: T) => string;
  },
): DynamicHeaderMenu {
  const normalizedItems = [...items]
    .sort((a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" }))
    .map((item) => {
      const initial = normalizeText(item.name).charAt(0).toUpperCase();
      return {
        label: item.name,
        href: options.linkFor(item),
        initial: initial.match(/[A-Z]/) ? initial : "#",
      };
    });

  const groupsMap = new Map<string, Map<string, DynamicMenuItem[]>>();

  for (const item of normalizedItems) {
    const pair = getAlphabetPair(item.initial);
    const pairGroups = groupsMap.get(pair) ?? new Map<string, DynamicMenuItem[]>();
    const itemsForInitial = pairGroups.get(item.initial) ?? [];
    itemsForInitial.push(item);
    pairGroups.set(item.initial, itemsForInitial);
    groupsMap.set(pair, pairGroups);
  }

  const groups = [...groupsMap.entries()]
    .sort(([left], [right]) => left.localeCompare(right, "es"))
    .map(([label, initialsMap]) => ({
      label,
      initials: [...initialsMap.keys()].sort((a, b) => a.localeCompare(b, "es")),
      itemsByInitial: [...initialsMap.entries()]
        .sort(([left], [right]) => left.localeCompare(right, "es"))
        .map(([initial, groupedItems]) => ({
          initial,
          items: groupedItems,
        })),
    }));

  return {
    key: options.key,
    label: options.label,
    href: options.href,
    groups,
  };
}

export async function getDynamicHeaderMenus(): Promise<DynamicHeaderMenu[]> {
  const content = await getSiteContent();

  return [
    buildDynamicMenu<BrandItem>(content.brands, {
      key: "brands",
      label: "Marcas",
      href: "/galeria?brand=",
      linkFor: (brand) => `/galeria?brand=${encodeURIComponent(brand.name)}`,
    }),
    buildDynamicMenu<CategoryItem>(content.categories ?? [], {
      key: "categories",
      label: "Categorías",
      href: "/galeria?category=",
      linkFor: (category) => `/galeria?category=${encodeURIComponent(category.name)}`,
    }),
  ];
}

export async function getHomePageViewModel(): Promise<HomePageViewModel> {
  const content = await getSiteContent();
  const banners = [...content.banners].filter((item) => item.active).sort((a, b) => a.order - b.order);
  const heroSlides = [...content.heroSlides]
    .filter((item) => item.active)
    .sort((a, b) => a.order - b.order);
  const featuredProducts = content.products
    .filter((item) => item.status === "published" && item.featured)
    .slice(0, 8);
  const trendingProducts = content.products
    .filter((item) => item.status === "published" && item.trending)
    .slice(0, 8);
  const brands = [...content.brands];
  const featuredBrands = content.brands.filter((item) => item.featured).slice(0, 6);

  return {
    banners,
    heroSlides,
    featuredBanner: banners[0] ?? null,
    secondaryBanner: banners[1] ?? null,
    brands,
    featuredProducts,
    trendingProducts,
    featuredBrands,
    stats: [
      { label: "marcas", value: String(content.brands.length) },
      { label: "productos", value: String(content.products.length) },
      { label: "destacados", value: String(featuredProducts.length) },
    ],
  };
}

export async function getProductBySku(sku: string): Promise<ProductItem | null> {
  const normalizedSku = normalizeText(sku);
  const content = await getSiteContent();
  const product = content.products.find((item) => normalizeText(item.sku) === normalizedSku);

  return product ?? null;
}

export async function searchCatalog(filters: CatalogFilters = {}) {
  const content = await getSiteContent();
  const query = normalizeText(filters.query);
  const brand = normalizeText(filters.brand);
  const category = normalizeText(filters.category);

  return content.products.filter((item) => {
    if (item.status !== "published") {
      return false;
    }

    const matchesQuery =
      !query ||
      normalizeText(item.name).includes(query) ||
      normalizeText(item.detail).includes(query) ||
      normalizeText(item.brand).includes(query) ||
      normalizeText(item.categoryName).includes(query) ||
      normalizeText(item.sku).includes(query);
    const matchesBrand = !brand || normalizeText(item.brand).includes(brand);
    const matchesCategory = !category || normalizeText(item.categoryName).includes(category);

    return matchesQuery && matchesBrand && matchesCategory;
  });
}
