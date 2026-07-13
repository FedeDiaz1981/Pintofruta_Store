import Image from "next/image";
import Link from "next/link";
import type { ProductItem } from "@/domain/site-content";
import { formatCurrency, publicAsset } from "@/lib/catalog";

export function ProductCard({ product }: { product: ProductItem }) {
  return (
    <article className="card overflow-hidden border border-base-300 bg-base-100 shadow-sm">
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
      <div className="card-body gap-3">
        <div className="flex items-center justify-between gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-base-content/50">
          <span>{product.brand}</span>
          <span>{product.presentation}</span>
        </div>
        <h3 className="line-clamp-2 text-lg font-black leading-6 text-base-content">
          {product.name}
        </h3>
        <p className="line-clamp-2 text-sm leading-6 text-base-content/70">{product.description || product.detail}</p>
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-base-content/50">Precio</p>
            <p className="text-2xl font-black text-base-content">{formatCurrency(product.publicPrice)}</p>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            {product.vegano ? <span className="badge badge-success badge-outline">Vegano</span> : null}
            {product.kosher ? <span className="badge badge-info badge-outline">Kosher</span> : null}
          </div>
        </div>
        <div className="card-actions mt-1">
          <Link href={`/producto/${encodeURIComponent(product.sku)}`} className="btn btn-primary rounded-full normal-case">
            Ver detalle
          </Link>
          <button className="btn btn-ghost rounded-full normal-case">Agregar</button>
        </div>
      </div>
    </article>
  );
}

