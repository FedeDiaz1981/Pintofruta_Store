import type { HeaderNavigation, SiteContentDocument } from "@/domain/site-content";
import type {
  SeedBanner,
  SeedBrand,
  SeedCategory,
  SeedHeaderGroup,
  SeedHeaderGroupItem,
  SeedHeaderSection,
  SeedHeaderSearchScope,
  SeedHeroSlide,
  SeedMeta,
  SeedProduct,
  SeedUser,
} from "@/infrastructure/site-content/seed";

export type SiteMetaRow = SeedMeta;
export type SearchScopeRow = SeedHeaderSearchScope;
export type NavSectionRow = SeedHeaderSection;
export type NavGroupRow = SeedHeaderGroup;
export type NavItemRow = SeedHeaderGroupItem;
export type HeroSlideRow = SeedHeroSlide;
export type BannerRow = SeedBanner;
export type ProductRow = SeedProduct;
export type BrandRow = SeedBrand;
export type CategoryRow = SeedCategory;
export type UserRow = SeedUser;

export function mapHeaderNavigation(
  scopesRows: SearchScopeRow[],
  sectionsRows: NavSectionRow[],
  groupsRows: NavGroupRow[],
  itemsRows: NavItemRow[],
): HeaderNavigation | undefined {
  const sections = sectionsRows.map((section) => ({
    id: section.id,
    label: section.label,
    icon: section.icon,
    href: section.href,
    groups: groupsRows
      .filter((group) => group.section_id === section.id)
      .map((group) => ({
        id: group.id,
        label: group.label,
        href: group.href,
        items: itemsRows
          .filter((item) => item.group_id === group.id)
          .map((item) => ({
            id: item.id,
            label: item.label,
            href: item.href,
          })),
      })),
  }));

  if (scopesRows.length === 0 && sections.length === 0) {
    return undefined;
  }

  return {
    searchScopes: scopesRows.map((scope) => ({
      id: scope.id,
      label: scope.label,
      href: scope.href,
    })),
    sections,
  };
}

export function mapSiteContentDocument(params: {
  metaRow?: SiteMetaRow;
  headerNavigation?: HeaderNavigation;
  heroSlides: HeroSlideRow[];
  banners: BannerRow[];
  products: ProductRow[];
  brands: BrandRow[];
  categories: CategoryRow[];
  users: UserRow[];
}): SiteContentDocument {
  const { metaRow, headerNavigation, heroSlides, banners, products, brands, categories, users } = params;

  return {
    sessionRole: metaRow?.session_role ?? undefined,
    viewMode: metaRow?.view_mode ?? undefined,
    activeAdminPanel: metaRow?.active_admin_panel ?? undefined,
    panelSearchQuery: metaRow?.panel_search_query ?? undefined,
    activeModalAction: metaRow?.active_modal_action ?? undefined,
    headerNavigation,
    heroSlides: heroSlides.map((slide) => ({
      id: slide.id,
      order: slide.order_index,
      title: slide.title,
      subtitle: slide.subtitle,
      badge: slide.badge,
      image: slide.image,
      imageMobile: slide.image_mobile ?? undefined,
      link: slide.link,
      active: slide.active,
      homeSpotlight: slide.home_spotlight ?? undefined,
    })),
    banners: banners.map((banner) => ({
      id: banner.id,
      text: banner.text,
      order: banner.order_index,
      active: banner.active,
    })),
    products: products.map((product) => ({
      id: product.id,
      sku: product.sku,
      name: product.name,
      detail: product.detail,
      presentation: product.presentation,
      categoryId: product.category_id,
      categoryName: product.category_name,
      brand: product.brand,
      vegano: product.vegano,
      kosher: product.kosher,
      testeadoEnAnimales: product.testeado_en_animales ?? undefined,
      publicPrice: product.public_price,
      memberPrice: product.member_price,
      image: product.image ?? undefined,
      status: product.status,
      featured: product.featured,
      trending: product.trending ?? undefined,
      stock: product.stock ?? undefined,
      description: product.description ?? undefined,
      sourceSection: product.source_section ?? undefined,
      createdAt: product.created_at ?? undefined,
      updatedAt: product.updated_at ?? undefined,
    })),
    brands: brands.map((brand) => ({
      id: brand.id,
      code: brand.code,
      name: brand.name,
      image: brand.image ?? undefined,
      featured: brand.featured,
    })),
    categories: categories.map((category) => ({
      id: category.id,
      name: category.name,
      slug: category.slug,
      visible: category.visible,
    })),
    users: users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      canSeePrices: user.can_see_prices,
      active: user.active,
    })),
    ping: metaRow?.ping ?? undefined,
    nextIds: (metaRow?.next_ids as SiteContentDocument["nextIds"]) ?? undefined,
  };
}
