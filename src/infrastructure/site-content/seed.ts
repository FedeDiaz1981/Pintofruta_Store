import siteContent from "@/data/site-content.json";
import type { HeaderNavigation, SiteContentDocument } from "@/domain/site-content";

export const fallbackSiteContent = siteContent as SiteContentDocument;
export const seedLockKey = 9_142_501;

export type SeedHeaderSearchScope = {
  id: string;
  label: string;
  href: string;
  sort_order: number;
};

export type SeedHeaderSection = {
  id: string;
  label: string;
  icon: string;
  href: string;
  sort_order: number;
};

export type SeedHeaderGroup = {
  id: string;
  section_id: string;
  label: string;
  href: string;
  sort_order: number;
};

export type SeedHeaderGroupItem = {
  id: string;
  group_id: string;
  label: string;
  href: string;
  sort_order: number;
};

export type SeedMeta = {
  session_role: string | null;
  view_mode: string | null;
  active_admin_panel: string | null;
  panel_search_query: string | null;
  active_modal_action: string | null;
  ping: boolean | null;
  next_ids: unknown | null;
};

export type SeedHeroSlide = {
  id: number;
  order_index: number;
  title: string;
  subtitle: string;
  badge: string;
  image: string;
  image_mobile: string | null;
  link: string;
  active: boolean;
  home_spotlight: boolean | null;
};

export type SeedBanner = {
  id: number;
  text: string;
  order_index: number;
  active: boolean;
};

export type SeedCategory = {
  id: number;
  name: string;
  slug: string;
  visible: boolean;
};

export type SeedBrand = {
  id: string;
  code: string;
  name: string;
  image: string | null;
  featured: boolean;
  active: boolean | null;
};

export type SeedUser = {
  id: number;
  name: string;
  email: string;
  role: string;
  can_see_prices: boolean;
  active: boolean;
};

export type SeedProduct = {
  id: number;
  sku: string;
  name: string;
  detail: string;
  presentation: string;
  category_id: number;
  category_name: string;
  category_ids: number[] | null;
  category_names: string[] | null;
  brand: string;
  vegano: boolean;
  kosher: boolean;
  testeado_en_animales: boolean | null;
  public_price: number;
  member_price: number;
  image: string | null;
  status: string;
  featured: boolean;
  featured_priority: number | null;
  trending: boolean | null;
  stock: number | null;
  views_count: number | null;
  sales_count: number | null;
  description: string | null;
  source_section: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type SeedPack = {
  id: number;
  apodo: string;
  title: string;
  description: string;
  category: string;
  public_price: number;
  image: string | null;
  active: boolean;
  featured: boolean;
  order_index: number;
  created_at: string | null;
  updated_at: string | null;
};

export type SeedPackItem = {
  pack_id: number;
  product_id: number;
  quantity: number;
  order_index: number;
};

export function toSeedNavigationRows() {
  const navigation = fallbackSiteContent.headerNavigation as HeaderNavigation | undefined;

  const searchScopes = (navigation?.searchScopes ?? []).map((scope, index) => ({
    id: scope.id,
    label: scope.label,
    href: scope.href,
    sort_order: index + 1,
  }));

  const sections = (navigation?.sections ?? []).map((section, sectionIndex) => ({
    id: section.id,
    label: section.label,
    icon: section.icon,
    href: section.href,
    sort_order: sectionIndex + 1,
  }));

  const groups: SeedHeaderGroup[] = [];
  const items: SeedHeaderGroupItem[] = [];

  for (const section of navigation?.sections ?? []) {
    const sectionId = section.id;

    for (const [groupIndex, group] of section.groups.entries()) {
      const groupId = `${sectionId}:${group.id}`;
      groups.push({
        id: groupId,
        section_id: sectionId,
        label: group.label,
        href: group.href,
        sort_order: groupIndex + 1,
      });

      for (const [itemIndex, item] of group.items.entries()) {
        items.push({
          id: `${groupId}:${item.id}`,
          group_id: groupId,
          label: item.label,
          href: item.href,
          sort_order: itemIndex + 1,
        });
      }
    }
  }

  return {
    searchScopes,
    sections,
    groups,
    items,
  };
}

export function toSeedPackRows() {
  const packs = (fallbackSiteContent.packs ?? []).map((pack, index) => ({
    id: pack.id,
    apodo: pack.apodo,
    title: pack.title,
    description: pack.description,
    category: pack.category,
    public_price: pack.publicPrice,
    image: pack.image ?? null,
    active: pack.active,
    featured: pack.featured ?? false,
    order_index: pack.order ?? index + 1,
    created_at: pack.createdAt ?? null,
    updated_at: pack.updatedAt ?? null,
  })) satisfies SeedPack[];

  const items = (fallbackSiteContent.packs ?? []).flatMap((pack) =>
    pack.items.map((item, index) => ({
      pack_id: pack.id,
      product_id: item.productId,
      quantity: item.quantity,
      order_index: index + 1,
    })),
  ) satisfies SeedPackItem[];

  return {
    packs,
    items,
  };
}

export function toSeedBrandRows() {
  return (fallbackSiteContent.brands ?? []).map((brand) => ({
    ...brand,
    image: brand.image ?? null,
    active: brand.active ?? true,
  })) satisfies SeedBrand[];
}
