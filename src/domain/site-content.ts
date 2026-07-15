export interface HeroSlide {
  id: number;
  order: number;
  title: string;
  subtitle: string;
  badge: string;
  image: string;
  imageMobile?: string;
  link: string;
  active: boolean;
  homeSpotlight?: boolean;
}

export interface BannerItem {
  id: number;
  text: string;
  order: number;
  active: boolean;
}

export interface NavGroupItem {
  id: string | number;
  label: string;
  href: string;
}

export interface NavGroup {
  id: string;
  label: string;
  href: string;
  items: NavGroupItem[];
}

export interface NavSection {
  id: string;
  label: string;
  icon: string;
  href: string;
  groups: NavGroup[];
}

export interface HeaderNavigation {
  searchScopes: {
    id: string;
    label: string;
    href: string;
  }[];
  sections: NavSection[];
}

export interface ProductItem {
  id: number;
  sku: string;
  name: string;
  detail: string;
  presentation: string;
  categoryId: number;
  categoryName: string;
  brand: string;
  vegano: boolean;
  kosher: boolean;
  testeadoEnAnimales?: boolean;
  publicPrice: number;
  memberPrice: number;
  image?: string;
  status: string;
  featured: boolean;
  trending?: boolean;
  stock?: number;
  description?: string;
  sourceSection?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PackIncludedProduct {
  productId: number;
  quantity: number;
  product: ProductItem;
}

export interface PackItem {
  id: number;
  apodo: string;
  title: string;
  description: string;
  category: string;
  publicPrice: number;
  image?: string;
  active: boolean;
  featured?: boolean;
  order?: number;
  items: PackIncludedProduct[];
  createdAt?: string;
  updatedAt?: string;
}

export interface CategoryItem {
  id: number;
  name: string;
  slug: string;
  visible: boolean;
}

export interface BrandItem {
  id: string;
  code: string;
  name: string;
  image?: string;
  featured: boolean;
}

export interface UserItem {
  id: number;
  name: string;
  email: string;
  role: string;
  canSeePrices: boolean;
  active: boolean;
}

export interface SiteContentDocument {
  sessionRole?: string;
  viewMode?: string;
  activeAdminPanel?: string;
  panelSearchQuery?: string;
  activeModalAction?: string;
  headerNavigation?: HeaderNavigation;
  heroSlides: HeroSlide[];
  banners: BannerItem[];
  products: ProductItem[];
  packs?: PackItem[];
  brands: BrandItem[];
  categories?: CategoryItem[];
  users?: UserItem[];
  ping?: boolean;
  nextIds?: {
    product?: number;
    category?: number;
    user?: number;
    heroSlide?: number;
    banner?: number;
    pack?: number;
  };
}

export interface HomePageViewModel {
  banners: BannerItem[];
  heroSlides: HeroSlide[];
  spotlightSlide: HeroSlide | null;
  featuredBanner: BannerItem | null;
  secondaryBanner: BannerItem | null;
  brands: BrandItem[];
  featuredProducts: ProductItem[];
  trendingProducts: ProductItem[];
  featuredBrands: BrandItem[];
  stats: {
    label: string;
    value: string;
  }[];
}

export interface CatalogFilters {
  query?: string;
  brand?: string;
  category?: string;
  featuredOnly?: boolean;
  trendingOnly?: boolean;
}
