"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ProductItem } from "@/domain/site-content";
import { formatCurrency, publicAsset } from "@/lib/catalog";

export function ProductDetailModal({
  product,
  onClose,
}: {
  product: ProductItem | null;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) {
      return;
    }

    if (product) {
      if (!dialog.open) {
        dialog.showModal();
      }
      return;
    }

    if (dialog.open) {
      dialog.close();
    }
  }, [product]);

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) {
      return;
    }

    const handleClose = () => onClose();
    dialog.addEventListener("close", handleClose);

    return () => {
      dialog.removeEventListener("close", handleClose);
    };
  }, [onClose]);

  const maxQuantity = useMemo(() => {
    if (!product?.stock || product.stock <= 0) {
      return 99;
    }

    return product.stock;
  }, [product]);

  const safeQuantity = Math.min(Math.max(quantity, 1), maxQuantity);
  const totalPrice = product ? product.publicPrice * safeQuantity : 0;

  return (
    <dialog
      ref={dialogRef}
      className="modal modal-bottom sm:modal-middle"
      onClick={(event) => {
        if (event.target === dialogRef.current) {
          dialogRef.current?.close();
        }
      }}
    >
      <div className="modal-box max-w-6xl overflow-hidden rounded-[2rem] border border-[var(--pf-border-warm)] bg-[var(--pf-surface)] p-0 text-[var(--pf-text)] shadow-[0_30px_80px_rgba(74,57,38,0.26)]">
        {product ? (
          <div className="grid gap-0 lg:grid-cols-[1fr_1.05fr]">
            <div className="relative min-h-[320px] bg-[linear-gradient(180deg,rgba(238,230,214,0.95),rgba(248,244,236,0.98))] p-6 sm:min-h-[420px] sm:p-8">
              <div className="relative h-full min-h-[260px] overflow-hidden rounded-[1.75rem] bg-[rgba(255,255,255,0.92)]">
                <Image
                  src={publicAsset(product.image)}
                  alt={product.name}
                  fill
                  className="object-contain p-6"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  priority
                />
              </div>
            </div>

            <div className="flex flex-col gap-5 p-6 sm:p-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-3xl font-black tracking-tight text-[var(--pf-text)] sm:text-5xl">{product.name}</h3>
                </div>
                <form method="dialog">
                  <button
                    className="btn btn-circle btn-sm border border-[var(--pf-border)] bg-[rgba(255,255,255,0.9)] text-[var(--pf-text)]"
                    aria-label="Cerrar"
                  >
                    ×
                  </button>
                </form>
              </div>

              <p className="max-w-2xl text-base leading-7 text-[var(--pf-muted)]">{product.description || product.detail}</p>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-[1.35rem] border border-[var(--pf-border)] bg-[rgba(255,255,255,0.8)] p-4">
                  <p className="text-xs uppercase tracking-[0.28em] text-[var(--pf-muted)]">Marca</p>
                  <p className="mt-1 text-lg font-bold">{product.brand}</p>
                </div>
                <div className="rounded-[1.35rem] border border-[var(--pf-border)] bg-[rgba(255,255,255,0.8)] p-4">
                  <p className="text-xs uppercase tracking-[0.28em] text-[var(--pf-muted)]">Categoría</p>
                  <p className="mt-1 text-lg font-bold">{product.categoryName}</p>
                </div>
              </div>

              <div className="rounded-[1.5rem] border border-[var(--pf-border)] bg-[rgba(255,255,255,0.8)] p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.28em] text-[var(--pf-muted)]">Cantidad</p>
                    <p className="mt-1 text-sm text-[var(--pf-muted)]">Elegí cuántas unidades querés agregar.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="btn btn-sm rounded-full border border-[var(--pf-border)] bg-[rgba(255,255,255,0.9)]"
                      onClick={() => setQuantity((current) => Math.max(1, current - 1))}
                      disabled={safeQuantity <= 1}
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min={1}
                      max={maxQuantity}
                      value={safeQuantity}
                      onChange={(event) => {
                        const nextValue = Number(event.target.value);

                        if (Number.isNaN(nextValue)) {
                          return;
                        }

                        setQuantity(Math.min(Math.max(nextValue, 1), maxQuantity));
                      }}
                      className="input input-bordered w-20 rounded-full text-center text-lg font-bold"
                      aria-label="Cantidad"
                    />
                    <button
                      type="button"
                      className="btn btn-sm rounded-full border border-[var(--pf-border)] bg-[rgba(255,255,255,0.9)]"
                      onClick={() => setQuantity((current) => Math.min(maxQuantity, current + 1))}
                      disabled={safeQuantity >= maxQuantity}
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              <div className="rounded-[1.75rem] border border-[rgba(212,189,156,0.55)] bg-[rgba(237,220,195,0.55)] p-5">
                <p className="text-xs uppercase tracking-[0.32em] text-[var(--pf-muted)]">Total</p>
                <p className="mt-2 text-4xl font-black tracking-tight text-[var(--pf-text)]">{formatCurrency(totalPrice)}</p>
                <p className="mt-1 text-sm text-[var(--pf-muted)]">
                  {safeQuantity} x {formatCurrency(product.publicPrice)}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {product.vegano ? <span className="badge badge-outline badge-success">Vegano</span> : null}
                {product.kosher ? <span className="badge badge-outline badge-info">Kosher</span> : null}
                {product.testeadoEnAnimales === false ? <span className="badge badge-outline">Cruelty free</span> : null}
              </div>

              <div className="mt-auto flex flex-wrap gap-3">
                <button className="btn pf-btn-rounded rounded-full normal-case">Agregar al carrito</button>
                <Link href="/galeria" className="btn btn-outline rounded-full normal-case">
                  Seguir buscando
                </Link>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <form method="dialog" className="modal-backdrop">
        <button aria-label="Cerrar" />
      </form>
    </dialog>
  );
}
