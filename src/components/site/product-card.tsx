import Image from "next/image";
import Link from "next/link";
import type { ProductItem } from "@/domain/site-content";
import { formatCurrency, publicAsset } from "@/lib/catalog";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";

export function ProductCard({ product }: { product: ProductItem }) {
  return (
    <article className="overflow-hidden rounded-[1.6rem] border border-[var(--pf-border)] bg-[rgba(255,255,255,0.9)] shadow-[0_12px_28px_rgba(74,57,38,0.08)]">
      <figure className="bg-gradient-to-br from-base-200 via-base-100 to-base-300/50 p-4">
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-3xl bg-base-200/70">
          <Image
            src={publicAsset(product.image)}
            alt={product.name}
            fill
            className="object-contain p-4"
            sizes="(max-width: 768px) 100vw, 33vw"
          />
        </div>
      </figure>
      <div className="space-y-3 p-5">
        <div className="flex items-center justify-between gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-base-content/50">
          <span>{product.brand}</span>
          <span>{product.presentation}</span>
        </div>
        <h3 className="line-clamp-2 text-lg font-extrabold leading-6 text-base-content">
          {product.name}
        </h3>
        <p className="line-clamp-2 text-sm leading-6 text-base-content/70">{product.description || product.detail}</p>
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-base-content/50">Precio</p>
            <p className="text-2xl font-extrabold text-base-content">{formatCurrency(product.publicPrice)}</p>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            {product.vegano ? <Badge variant="outline" className="border-success/40 text-success">Vegano</Badge> : null}
            {product.kosher ? <Badge variant="outline" className="border-info/40 text-info">Kosher</Badge> : null}
          </div>
        </div>
        <div className="mt-1 flex flex-wrap gap-3">
          <Link href={`/producto/${encodeURIComponent(product.sku)}`} className={buttonVariants({ variant: "primary", size: "md" })}>
            Ver detalle
          </Link>
          <button className={buttonVariants({ variant: "ghost", size: "md" })}>Agregar</button>
        </div>
      </div>
    </article>
  );
}
