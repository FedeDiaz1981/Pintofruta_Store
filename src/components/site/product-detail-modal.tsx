"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { recordProductView } from "@/app/catalog-actions";
import { CartAddButton } from "@/components/cart/cart-add-button";
import type { ProductItem } from "@/domain/site-content";
import { formatCurrency, publicAsset } from "@/lib/catalog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ProductDetailModal({
  product,
  onClose,
}: {
  product: ProductItem | null;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const detailsDialogRef = useRef<HTMLDialogElement | null>(null);
  const addTimerRef = useRef<number | null>(null);
  const trackedProductIdRef = useRef<number | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [isAdding, setIsAdding] = useState(false);
  const [showFullDetails, setShowFullDetails] = useState(false);

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

  useEffect(() => {
    if (!product) {
      return;
    }

    if (trackedProductIdRef.current === product.id) {
      return;
    }

    trackedProductIdRef.current = product.id;
    void recordProductView(product.id).catch(() => undefined);
  }, [product]);

  useEffect(() => {
    const dialog = detailsDialogRef.current;

    if (!dialog) {
      return;
    }

    if (!product || !showFullDetails) {
      if (dialog.open) {
        dialog.close();
      }
      return;
    }

    if (!dialog.open) {
      dialog.showModal();
    }
  }, [product, showFullDetails]);

  useEffect(() => {
    const dialog = detailsDialogRef.current;

    if (!dialog) {
      return;
    }

    const handleClose = () => setShowFullDetails(false);
    dialog.addEventListener("close", handleClose);

    return () => {
      dialog.removeEventListener("close", handleClose);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (addTimerRef.current !== null) {
        window.clearTimeout(addTimerRef.current);
      }
    };
  }, []);

  const maxQuantity = useMemo(() => {
    if (!product?.stock || product.stock <= 0) {
      return 99;
    }

    return product.stock;
  }, [product]);

  const fullDescription = (product?.description || product?.detail || "").trim();
  const truncatedDescriptionLimit = 180;
  const shouldTruncateDescription = fullDescription.length > truncatedDescriptionLimit;
  const shortDescription = shouldTruncateDescription
    ? `${fullDescription.slice(0, truncatedDescriptionLimit).trimEnd()}...`
    : fullDescription;

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
      <div className="modal-box max-h-[calc(100dvh-1rem)] max-w-6xl overflow-y-auto overscroll-contain rounded-[2rem] border border-[var(--pf-border-warm)] bg-[var(--pf-surface)] p-0 text-[var(--pf-text)] shadow-[0_30px_80px_rgba(74,57,38,0.26)] sm:max-h-[calc(100dvh-2rem)]">
        {product ? (
          <div className="grid gap-0 lg:grid-cols-[1fr_1.05fr]">
            <div className="relative min-h-[220px] bg-[linear-gradient(180deg,rgba(238,230,214,0.95),rgba(248,244,236,0.98))] p-4 sm:min-h-[420px] sm:p-8">
              <div className="relative h-full min-h-[180px] overflow-hidden rounded-[1.75rem] bg-[rgba(255,255,255,0.92)] sm:min-h-[260px]">
                <Image
                  src={publicAsset(product.image)}
                  alt={product.name}
                  fill
                  className="object-contain p-4 sm:p-6"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  priority
                />
              </div>
            </div>

            <div className="flex min-h-0 flex-col gap-5 p-4 sm:p-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-2xl font-extrabold tracking-tight text-[var(--pf-text)] sm:text-5xl">{product.name}</h3>
                </div>
                <form method="dialog">
                  <Button type="submit" variant="secondary" size="icon" aria-label="Cerrar">
                    X
                  </Button>
                </form>
              </div>

              {fullDescription ? (
                <div className="max-w-2xl text-sm leading-6 text-[var(--pf-muted)] sm:text-base sm:leading-7">
                  <p>{shortDescription}</p>
                  {shouldTruncateDescription ? (
                    <button
                      type="button"
                      className="mt-2 inline-flex items-center text-sm font-semibold text-[var(--pf-accent)] underline decoration-[rgba(168,109,69,0.45)] underline-offset-4 transition hover:opacity-80"
                      onClick={() => setShowFullDetails(true)}
                    >
                      Ver más
                    </button>
                  ) : null}
                </div>
              ) : null}

              <div className="rounded-[1.5rem] border border-[var(--pf-border)] bg-[rgba(255,255,255,0.8)] p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.28em] text-[var(--pf-muted)]">Cantidad</p>
                    <p className="mt-1 text-sm text-[var(--pf-muted)]">Elegí cuántas unidades querés agregar.</p>
                  </div>
                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setQuantity((current) => Math.max(1, current - 1))}
                      disabled={safeQuantity <= 1}
                    >
                      -
                    </Button>
                    <Input
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
                      className="w-20 text-center text-lg font-semibold"
                      aria-label="Cantidad"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setQuantity((current) => Math.min(maxQuantity, current + 1))}
                      disabled={safeQuantity >= maxQuantity}
                    >
                      +
                    </Button>
                  </div>
                </div>
              </div>

              <div className="rounded-[1.75rem] border border-[rgba(212,189,156,0.55)] bg-[rgba(237,220,195,0.55)] p-5">
                <p className="text-xs uppercase tracking-[0.32em] text-[var(--pf-muted)]">Total</p>
                <p className="mt-2 text-4xl font-extrabold tracking-tight text-[var(--pf-text)]">{formatCurrency(totalPrice)}</p>
                <p className="mt-1 text-sm text-[var(--pf-muted)]">
                  {safeQuantity} x {formatCurrency(product.publicPrice)}
                </p>
              </div>

              <div className="flex flex-wrap gap-2 pb-1">
                <Badge variant="outline" className="border-[rgba(168,109,69,0.22)] text-[var(--pf-text)]">
                  {product.brand}
                </Badge>
                <Badge variant="outline" className="border-[rgba(168,109,69,0.22)] text-[var(--pf-text)]">
                  {product.categoryName}
                </Badge>
                {product.vegano ? <Badge variant="outline" className="border-success/40 text-success">Vegano</Badge> : null}
                {product.kosher ? <Badge variant="outline" className="border-info/40 text-info">Kosher</Badge> : null}
                {product.testeadoEnAnimales === false ? <Badge variant="outline">Cruelty free</Badge> : null}
              </div>

              <div className="mt-auto flex flex-wrap gap-3 pb-2 sm:pb-0">
                <CartAddButton
                  product={product}
                  quantity={safeQuantity}
                  className={`rounded-full normal-case transition duration-300 ${isAdding ? "scale-[0.98] brightness-110" : ""}`}
                  onClick={() => {
                    setIsAdding(true);

                    if (addTimerRef.current !== null) {
                      window.clearTimeout(addTimerRef.current);
                    }

                    addTimerRef.current = window.setTimeout(() => {
                      onClose();
                    }, 220);
                  }}
                >
                  {isAdding ? "Agregado" : "Agregar al pedido"}
                </CartAddButton>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <form method="dialog" className="modal-backdrop">
        <button aria-label="Cerrar" />
      </form>

      <dialog
        ref={detailsDialogRef}
        className="modal modal-bottom sm:modal-middle"
        onClick={(event) => {
          if (event.target === detailsDialogRef.current) {
            detailsDialogRef.current?.close();
          }
        }}
      >
        <div className="modal-box max-h-[calc(100dvh-1rem)] max-w-3xl overflow-y-auto overscroll-contain rounded-[2rem] border border-[var(--pf-border-warm)] bg-[var(--pf-surface)] p-0 text-[var(--pf-text)] shadow-[0_30px_80px_rgba(74,57,38,0.26)] sm:max-h-[calc(100dvh-2rem)]">
          <div className="flex items-start justify-between gap-4 border-b border-[rgba(168,109,69,0.12)] p-4 sm:p-8">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-[var(--pf-muted)]">Detalle completo</p>
              <h3 className="mt-2 text-xl font-extrabold tracking-tight sm:text-4xl">{product?.name}</h3>
            </div>
            <form method="dialog">
              <Button type="submit" variant="secondary" size="icon" aria-label="Cerrar detalle completo">
                X
              </Button>
            </form>
          </div>

          <div className="p-4 text-sm leading-6 text-[var(--pf-muted)] sm:max-h-[70vh] sm:overflow-y-auto sm:p-8 sm:text-base sm:leading-7">
            <p className="whitespace-pre-line">{fullDescription}</p>
          </div>
        </div>

        <form method="dialog" className="modal-backdrop">
          <button aria-label="Cerrar detalle completo" />
        </form>
      </dialog>
    </dialog>
  );
}
