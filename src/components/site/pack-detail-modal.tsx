"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useCart } from "@/components/cart/cart-context";
import type { PackItem } from "@/domain/site-content";
import { formatCurrency, publicAsset } from "@/lib/catalog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function getBaseTotal(pack: PackItem) {
  return pack.items.reduce((sum, item) => sum + item.quantity * item.product.publicPrice, 0);
}

export function PackDetailModal({
  pack,
  onClose,
}: {
  pack: PackItem | null;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const addTimerRef = useRef<number | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [isAdding, setIsAdding] = useState(false);
  const { addPack } = useCart();

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) {
      return;
    }

    if (pack) {
      if (!dialog.open) {
        dialog.showModal();
      }
      return;
    }

    if (dialog.open) {
      dialog.close();
    }
  }, [pack]);

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
    return () => {
      if (addTimerRef.current !== null) {
        window.clearTimeout(addTimerRef.current);
      }
    };
  }, []);

  const safeQuantity = Math.max(1, quantity);
  const totalPrice = pack ? pack.publicPrice * safeQuantity : 0;
  const baseTotal = pack ? getBaseTotal(pack) : 0;
  const savings = Math.max(0, baseTotal - (pack?.publicPrice ?? 0));

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
        {pack ? (
          <div className="grid gap-0 lg:grid-cols-[1fr_1.05fr]">
            <div className="relative min-h-[320px] bg-[linear-gradient(180deg,rgba(238,230,214,0.95),rgba(248,244,236,0.98))] p-6 sm:min-h-[420px] sm:p-8">
              <div className="relative h-full min-h-[260px] overflow-hidden rounded-[1.75rem] bg-[rgba(255,255,255,0.92)]">
                <Image
                  src={publicAsset(pack.image)}
                  alt={pack.title}
                  fill
                  className="object-cover p-6"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  priority
                />
              </div>
            </div>

            <div className="flex flex-col gap-5 p-6 sm:p-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.32em] text-[var(--pf-secondary-dark)]">Promoción</p>
                  <h3 className="mt-2 text-3xl font-extrabold tracking-tight text-[var(--pf-text)] sm:text-5xl">{pack.title}</h3>
                </div>
                <form method="dialog">
                  <Button type="submit" variant="secondary" size="icon" aria-label="Cerrar">
                    ×
                  </Button>
                </form>
              </div>

              <p className="max-w-2xl text-base leading-7 text-[var(--pf-muted)]">{pack.description}</p>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-[1.35rem] border border-[var(--pf-border)] bg-[rgba(255,255,255,0.8)] p-4">
                  <p className="text-xs uppercase tracking-[0.28em] text-[var(--pf-muted)]">Categoría</p>
                  <p className="mt-1 text-lg font-semibold">{pack.category}</p>
                </div>
                <div className="rounded-[1.35rem] border border-[var(--pf-border)] bg-[rgba(255,255,255,0.8)] p-4">
                  <p className="text-xs uppercase tracking-[0.28em] text-[var(--pf-muted)]">Apodo</p>
                  <p className="mt-1 text-lg font-semibold">{pack.apodo}</p>
                </div>
              </div>

              <div className="rounded-[1.5rem] border border-[var(--pf-border)] bg-[rgba(255,255,255,0.8)] p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.28em] text-[var(--pf-muted)]">Cantidad</p>
                    <p className="mt-1 text-sm text-[var(--pf-muted)]">Elegí cuántos packs querés agregar.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="secondary" size="sm" onClick={() => setQuantity((current) => Math.max(1, current - 1))} disabled={safeQuantity <= 1}>
                      -
                    </Button>
                    <Input
                      type="number"
                      min={1}
                      value={safeQuantity}
                      onChange={(event) => {
                        const nextValue = Number(event.target.value);

                        if (Number.isNaN(nextValue)) {
                          return;
                        }

                        setQuantity(Math.max(nextValue, 1));
                      }}
                      className="w-20 text-center text-lg font-semibold"
                      aria-label="Cantidad"
                    />
                    <Button type="button" variant="secondary" size="sm" onClick={() => setQuantity((current) => current + 1)}>
                      +
                    </Button>
                  </div>
                </div>
              </div>

              <div className="rounded-[1.75rem] border border-[rgba(212,189,156,0.55)] bg-[rgba(237,220,195,0.55)] p-5">
                <p className="text-xs uppercase tracking-[0.32em] text-[var(--pf-muted)]">Total</p>
                <p className="mt-2 text-4xl font-extrabold tracking-tight text-[var(--pf-text)]">{formatCurrency(totalPrice)}</p>
                <p className="mt-1 text-sm text-[var(--pf-muted)]">
                  {safeQuantity} x {formatCurrency(pack.publicPrice)}
                </p>
                {savings > 0 ? (
                  <p className="mt-2 text-sm font-semibold text-[var(--pf-primary-darker)]">Ahorro por pack: {formatCurrency(savings)}</p>
                ) : null}
              </div>

              <div className="rounded-[1.5rem] border border-[var(--pf-border)] bg-[rgba(255,255,255,0.82)] p-4">
                <p className="text-xs uppercase tracking-[0.28em] text-[var(--pf-muted)]">Incluye</p>
                <div className="mt-3 space-y-2">
                  {pack.items.map((item) => (
                    <div key={item.productId} className="flex items-center justify-between gap-3 rounded-[1.1rem] bg-[rgba(248,242,232,0.74)] px-3 py-2">
                      <div>
                        <p className="font-semibold text-[var(--pf-text)]">{item.product.name}</p>
                        <p className="text-sm text-[var(--pf-muted)]">
                          {item.quantity} x {formatCurrency(item.product.publicPrice)}
                        </p>
                      </div>
                      {item.product.image ? (
                        <div className="relative h-12 w-12 overflow-hidden rounded-xl border border-[var(--pf-border)] bg-white">
                          <Image src={publicAsset(item.product.image)} alt={item.product.name} fill className="object-contain p-1.5" sizes="3rem" />
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {pack.featured ? <Badge variant="outline" className="border-success/40 text-success">Destacado</Badge> : null}
                <Badge variant="outline">{pack.items.length} productos</Badge>
              </div>

              <div className="mt-auto flex flex-wrap gap-3">
                <Button
                  className={`rounded-full normal-case transition duration-300 ${isAdding ? "scale-[0.98] brightness-110" : ""}`}
                  onClick={() => {
                    setIsAdding(true);
                    addPack(pack, safeQuantity);

                    if (addTimerRef.current !== null) {
                      window.clearTimeout(addTimerRef.current);
                    }

                    addTimerRef.current = window.setTimeout(() => {
                      onClose();
                    }, 220);
                  }}
                >
                  {isAdding ? "Agregado" : "Agregar al pedido"}
                </Button>
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
