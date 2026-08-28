"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { recordProductView } from "@/app/catalog-actions";
import { useViewer } from "@/components/auth/viewer-provider";
import { CartAddButton } from "@/components/cart/cart-add-button";
import type { ProductItem } from "@/domain/site-content";
import { resolveProductUnitPrice } from "@/lib/pricing";
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
  const viewer = useViewer();
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
  const unitPrice = product ? resolveProductUnitPrice(product, viewer) : 0;
  const totalPrice = product ? unitPrice * safeQuantity : 0;

  return (
    <dialog
      ref={dialogRef}
      className="modal !z-[12050] items-center justify-center p-4 sm:p-6 lg:p-8"
      onClick={(event) => {
        if (event.target === dialogRef.current) {
          dialogRef.current?.close();
        }
      }}
    >
      <div className="modal-box w-[min(100%,72rem)] max-w-6xl max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain rounded-[2rem] border border-[var(--pf-border-warm)] bg-[linear-gradient(180deg,rgba(255,251,245,0.98),rgba(249,243,232,0.98))] p-0 text-[var(--pf-text)] shadow-[0_32px_90px_rgba(74,57,38,0.22)] ring-1 ring-[rgba(255,255,255,0.35)] sm:max-h-[calc(100dvh-3rem)]">
        {product ? (
          <div className="grid gap-0 lg:grid-cols-[1.02fr_0.98fr] lg:min-h-[min(76vh,54rem)]">
            <div className="relative bg-[linear-gradient(180deg,rgba(238,230,214,0.98),rgba(247,241,231,0.98))] p-2 sm:p-6 lg:flex lg:h-full lg:items-center lg:p-8">
              <div className="relative aspect-[1/0.72] w-full overflow-hidden rounded-[1.5rem] border border-[rgba(255,255,255,0.72)] bg-[rgba(255,255,255,0.9)] shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_10px_30px_rgba(97,68,34,0.08)] sm:aspect-[4/5] lg:h-full lg:aspect-auto">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.9),transparent_58%)]" />
                <Image
                  src={publicAsset(product.image)}
                  alt={product.name}
                  fill
                  className="object-contain object-center p-2 sm:p-6 lg:p-8"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  priority
                />
              </div>
            </div>

            <div className="flex min-h-0 min-w-0 flex-col gap-4 px-4 pb-5 pt-3 sm:gap-6 sm:p-8 lg:px-10 lg:py-9">
              <div className="flex w-full min-w-0 items-start justify-between gap-4 border-b border-[rgba(168,109,69,0.10)] pb-4">
                <div className="min-w-0 flex-1">
                  <p className="text-[0.72rem] uppercase tracking-[0.34em] text-[var(--pf-muted)]">Detalle del producto</p>
                  <h3 className="mt-2 text-[1.55rem] font-extrabold leading-[1.04] tracking-tight text-balance text-[var(--pf-text)] sm:text-4xl lg:text-[2.55rem]">
                    {product.name}
                  </h3>
                </div>
                <form method="dialog">
                  <Button type="submit" variant="secondary" size="icon" aria-label="Cerrar">
                    X
                  </Button>
                </form>
              </div>

              {fullDescription ? (
                <div className="w-full max-w-none border-b border-[rgba(168,109,69,0.10)] pb-4 text-sm leading-6 text-[var(--pf-muted)] sm:pb-5 sm:text-base sm:leading-7">
                  <p className="max-w-[42rem] break-words text-pretty">{shortDescription}</p>
                  {shouldTruncateDescription ? (
                    <button
                      type="button"
                      className="mt-3 inline-flex items-center text-sm font-semibold text-[var(--pf-accent)] underline decoration-[rgba(168,109,69,0.45)] underline-offset-4 transition hover:opacity-80"
                      onClick={() => setShowFullDetails(true)}
                    >
                      Ver más
                    </button>
                  ) : null}
                </div>
              ) : null}

              <div className="rounded-[1.5rem] border border-[rgba(168,109,69,0.14)] bg-[rgba(255,255,255,0.72)] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] backdrop-blur-[2px] sm:p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-5">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-[var(--pf-muted)]">Cantidad</p>
                    <p className="mt-1 max-w-md text-sm leading-5 text-[var(--pf-muted)] sm:leading-6">Elegí cuántas unidades querés agregar.</p>
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

              <div className="rounded-[1.75rem] border border-[rgba(212,189,156,0.45)] bg-[rgba(237,220,195,0.5)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] sm:p-5">
                <p className="text-xs uppercase tracking-[0.34em] text-[var(--pf-muted)]">Total</p>
                <p className="mt-2 text-[2.6rem] font-extrabold tracking-tight text-[var(--pf-text)] sm:text-[2.85rem]">{formatCurrency(totalPrice)}</p>
                <p className="mt-1 text-sm text-[var(--pf-muted)]">
                  {safeQuantity} x {formatCurrency(unitPrice)}
                </p>
              </div>

              <div className="flex w-full flex-wrap gap-2">
                <Badge variant="outline" className="border-[rgba(168,109,69,0.18)] bg-[rgba(255,255,255,0.45)] text-[var(--pf-text)]">
                  {product.brand}
                </Badge>
                <Badge variant="outline" className="border-[rgba(168,109,69,0.18)] bg-[rgba(255,255,255,0.45)] text-[var(--pf-text)]">
                  {product.categoryName}
                </Badge>
                {product.vegano ? <Badge variant="outline" className="border-success/40 bg-[rgba(255,255,255,0.45)] text-success">Vegano</Badge> : null}
                {product.kosher ? <Badge variant="outline" className="border-info/40 bg-[rgba(255,255,255,0.45)] text-info">Kosher</Badge> : null}
                {product.testeadoEnAnimales === false ? <Badge variant="outline" className="bg-[rgba(255,255,255,0.45)]">Cruelty free</Badge> : null}
              </div>

              <div className="mt-auto border-t border-[rgba(168,109,69,0.10)] pt-5">
                <CartAddButton
                  product={product}
                  quantity={safeQuantity}
                  className={`w-full rounded-full py-6 text-base font-semibold normal-case shadow-[0_12px_30px_rgba(168,109,69,0.18)] transition duration-300 sm:w-auto sm:px-8 ${isAdding ? "scale-[0.98] brightness-110" : ""}`}
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
        className="modal !z-[12050] items-center justify-center p-4 sm:p-6 lg:p-8"
        onClick={(event) => {
          if (event.target === detailsDialogRef.current) {
            detailsDialogRef.current?.close();
          }
        }}
      >
        <div className="modal-box w-[min(100%,48rem)] max-w-3xl max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain rounded-[2rem] border border-[var(--pf-border-warm)] bg-[var(--pf-surface)] p-0 text-[var(--pf-text)] shadow-[0_30px_80px_rgba(74,57,38,0.22)] sm:max-h-[calc(100dvh-3rem)]">
          <div className="flex items-start justify-between gap-4 border-b border-[rgba(168,109,69,0.12)] p-4 sm:p-8">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-[var(--pf-muted)]">Detalle completo</p>
              <h3 className="mt-2 text-xl font-extrabold leading-tight tracking-tight sm:text-4xl">{product?.name}</h3>
            </div>
            <form method="dialog">
              <Button type="submit" variant="secondary" size="icon" aria-label="Cerrar detalle completo">
                X
              </Button>
            </form>
          </div>

          <div className="p-4 text-sm leading-7 text-[var(--pf-muted)] sm:max-h-[70vh] sm:overflow-y-auto sm:p-8 sm:text-base">
            <p className="whitespace-pre-line break-words text-pretty">{fullDescription}</p>
          </div>
        </div>

        <form method="dialog" className="modal-backdrop">
          <button aria-label="Cerrar detalle completo" />
        </form>
      </dialog>
    </dialog>
  );
}

