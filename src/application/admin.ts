import { getSiteContent } from "@/infrastructure/site-content.repository";
import type { BrandItem, CategoryItem, ProductItem, UserItem } from "@/domain/site-content";
import { buildAdminCrudViewModel, type AdminCrudViewModel } from "@/application/admin-crud";

export interface AdminOverview {
  counts: {
    products: number;
    brands: number;
    categories: number;
    users: number;
    heroSlides: number;
    packs: number;
  };
  featuredProducts: ProductItem[];
  activeUsers: UserItem[];
  visibleCategories: CategoryItem[];
  featuredBrands: BrandItem[];
  currentPanel: string;
}

export async function getAdminOverview(): Promise<AdminOverview> {
  const content = await getSiteContent();

  return {
    counts: {
      products: content.products.length,
      brands: content.brands.length,
      categories: content.categories?.length ?? 0,
      users: content.users?.length ?? 0,
      heroSlides: content.heroSlides.length,
      packs: content.packs?.length ?? 0,
    },
    featuredProducts: content.products.filter((product) => product.featured).slice(0, 8),
    activeUsers: (content.users ?? []).filter((user) => user.active).slice(0, 6),
    visibleCategories: (content.categories ?? []).filter((category) => category.visible).slice(0, 10),
    featuredBrands: content.brands.filter((brand) => brand.featured),
    currentPanel: content.activeAdminPanel ?? "hero",
  };
}

export async function getAdminPanelViewModel(): Promise<AdminCrudViewModel> {
  const content = await getSiteContent();
  const overview = {
    counts: {
      products: content.products.length,
      brands: content.brands.length,
      categories: content.categories?.length ?? 0,
      users: content.users?.length ?? 0,
      heroSlides: content.heroSlides.length,
      packs: content.packs?.length ?? 0,
    },
    featuredProducts: content.products.filter((product) => product.featured).slice(0, 8),
    activeUsers: (content.users ?? []).filter((user) => user.active).slice(0, 6),
    visibleCategories: (content.categories ?? []).filter((category) => category.visible).slice(0, 10),
    featuredBrands: content.brands.filter((brand) => brand.featured),
    currentPanel: content.activeAdminPanel ?? "hero",
  };

  return buildAdminCrudViewModel(content, overview);
}
