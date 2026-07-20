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
  const activeProducts = content.products.filter((product) => product.status === "published");
  const activeBrands = content.brands.filter((brand) => brand.active !== false);
  const visibleCategories = (content.categories ?? []).filter((category) => category.visible);
  const activeUsers = (content.users ?? []).filter((user) => user.active);
  const activeHeroSlides = content.heroSlides.filter((slide) => slide.active);
  const activePacks = (content.packs ?? []).filter((pack) => pack.active);

  return {
    counts: {
      products: activeProducts.length,
      brands: activeBrands.length,
      categories: visibleCategories.length,
      users: activeUsers.length,
      heroSlides: activeHeroSlides.length,
      packs: activePacks.length,
    },
    featuredProducts: activeProducts.filter((product) => product.featured).slice(0, 8),
    activeUsers: activeUsers.slice(0, 6),
    visibleCategories: visibleCategories.slice(0, 10),
    featuredBrands: activeBrands.filter((brand) => brand.featured),
    currentPanel: content.activeAdminPanel ?? "hero",
  };
}

export async function getAdminPanelViewModel(): Promise<AdminCrudViewModel> {
  const content = await getSiteContent();
  const activeProducts = content.products.filter((product) => product.status === "published");
  const activeBrands = content.brands.filter((brand) => brand.active !== false);
  const visibleCategories = (content.categories ?? []).filter((category) => category.visible);
  const activeUsers = (content.users ?? []).filter((user) => user.active);
  const activeHeroSlides = content.heroSlides.filter((slide) => slide.active);
  const activePacks = (content.packs ?? []).filter((pack) => pack.active);
  const overview = {
    counts: {
      products: activeProducts.length,
      brands: activeBrands.length,
      categories: visibleCategories.length,
      users: activeUsers.length,
      heroSlides: activeHeroSlides.length,
      packs: activePacks.length,
    },
    featuredProducts: activeProducts.filter((product) => product.featured).slice(0, 8),
    activeUsers: activeUsers.slice(0, 6),
    visibleCategories: visibleCategories.slice(0, 10),
    featuredBrands: activeBrands.filter((brand) => brand.featured),
    currentPanel: content.activeAdminPanel ?? "hero",
  };

  return buildAdminCrudViewModel(content, overview);
}
