import { ProductCard } from "@/components/site/product-card";
import type { ProductItem } from "@/domain/site-content";

export function CatalogGrid({ products }: { products: ProductItem[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}

