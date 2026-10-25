"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { HeroBannerSlide } from "@/domain/site-content";
import { resolveHeroImageHref } from "@/lib/hero-links";
import { ProductDetailModal } from "./product-detail-modal";

export function BannerImageLink({ slide, children }: {
  slide: Pick<HeroBannerSlide, "title" | "imageLink" | "imageAction" | "imageProductId" | "imageProduct">;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const className = "block h-full min-h-0 w-full focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-[var(--pf-primary)]";
  if (slide.imageAction === "product") {
    const product = slide.imageProduct;
    const available = product?.id === slide.imageProductId && product?.status === "published" && !product.soldOut;
    return <>
      <button type="button" className={`${className} border-0 bg-transparent p-0 text-left`} disabled={!available}
        aria-label={available ? `Ver producto: ${product.name}` : "Producto no disponible"}
        aria-haspopup="dialog" onClick={() => setOpen(true)}>
        {children}
      </button>
      {open && available ? createPortal(
        <ProductDetailModal key={product.id} product={product} onClose={() => setOpen(false)} />,
        document.body,
      ) : null}
    </>;
  }
  const href = resolveHeroImageHref(slide.imageLink);
  if (!href) return children;
  return <Link href={href} prefetch={false} aria-label={`Ver ${slide.title}`}
    className={className}>
    {children}
  </Link>;
}
