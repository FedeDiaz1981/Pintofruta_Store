"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Minus, Plus, X } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useCart } from "@/components/cart/cart-context";
import { formatCurrency, publicAsset } from "@/lib/catalog";
import { Button, buttonVariants } from "@/components/ui/button";

export function CartPanel({
  mode = "drawer",
}: {
  mode?: "drawer" | "page";
}) {
  const { items, hydrated, isOpen, closeCart, updateQuantity, removeItem, clearCart, totalItems, totalPrice } = useCart();
  const router = useRouter();
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const handleConfirmPedido = useCallback(async () => {
    if (!hydrated || items.length === 0 || isGeneratingPdf) {
      return;
    }

    try {
      setIsGeneratingPdf(true);

      const response = await fetch("/api/pedido/pdf", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          items,
        }),
      });

      if (!response.ok) {
        throw new Error("No se pudo generar el PDF del pedido.");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "pedido-pintofruta.pdf";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      window.alert("No pudimos generar el PDF del pedido. Probá de nuevo.");
    } finally {
      setIsGeneratingPdf(false);
    }
  }, [hydrated, items, isGeneratingPdf]);

  const visible = mode === "page" ? true : isOpen;
  const containerClass =
    mode === "page"
      ? "pf-shell flex w-full flex-1 flex-col px-4 py-6 sm:px-6 lg:px-12 lg:py-10"
      : "fixed inset-0 z-[11020] flex justify-end";

  const panel = useMemo(
    () => (
      <aside className="flex h-full w-full max-w-[460px] flex-col border-l border-[var(--pf-border-warm)] bg-[linear-gradient(180deg,var(--pf-surface-warm)_0%,var(--pf-sand-soft)_44%,var(--pf-cream-soft)_100%)] shadow-[0_24px_80px_rgba(74,57,38,0.26)]">
        <div className="flex items-center justify-between border-b border-[rgba(168,109,69,0.16)] px-5 py-4">
          <div>
            <h2 className="mt-1 text-2xl font-black tracking-tight text-[var(--pf-text)]">Mi pedido</h2>
          </div>
          {mode === "drawer" ? (
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--pf-border)] bg-[rgba(255,255,255,0.82)] text-[var(--pf-text)] transition hover:bg-[rgba(248,242,232,0.92)]"
              onClick={closeCart}
              aria-label="Cerrar carrito"
            >
              <X className="size-5" />
            </button>
          ) : null}
        </div>

        <div className="grid gap-3 px-5 pt-5 sm:grid-cols-2">
          <div className="rounded-[1.35rem] border border-[var(--pf-border)] bg-[rgba(255,255,255,0.82)] p-4 shadow-[0_10px_22px_rgba(74,57,38,0.06)]">
            <p className="text-xs uppercase tracking-[0.28em] text-[var(--pf-muted)]">Artículos</p>
            <p className="mt-1 text-3xl font-black text-[var(--pf-text)]">{totalItems}</p>
          </div>
          <div className="rounded-[1.35rem] border border-[var(--pf-border)] bg-[rgba(255,255,255,0.82)] p-4 shadow-[0_10px_22px_rgba(74,57,38,0.06)]">
            <p className="text-xs uppercase tracking-[0.28em] text-[var(--pf-muted)]">Total</p>
            <p className="mt-1 text-3xl font-black text-[var(--pf-text)]">{formatCurrency(totalPrice)}</p>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-5">
          {!hydrated ? (
            <div className="rounded-[1.35rem] border border-[var(--pf-border)] bg-[rgba(255,255,255,0.8)] p-5 text-sm text-[var(--pf-muted)]">
              Cargando pedido...
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-[1.35rem] border border-[var(--pf-border)] bg-[rgba(255,255,255,0.8)] p-5">
              <p className="text-lg font-bold text-[var(--pf-text)]">Tu pedido está vacío</p>
              <div className="mt-4">
                <Link href="/galeria" className={buttonVariants({ variant: "primary", size: "md" })}>
                  Ir a la galería
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <article
                  key={item.sku}
                  className="rounded-[1.4rem] border border-[rgba(168,109,69,0.12)] bg-[rgba(255,255,255,0.92)] p-4 shadow-[0_10px_22px_rgba(74,57,38,0.06)]"
                >
                  <div className="flex gap-4">
                    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-[1rem] border border-[rgba(168,109,69,0.12)] bg-[rgba(251,248,241,0.92)]">
                      {item.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={publicAsset(item.image)} alt={item.name} className="h-full w-full object-contain p-2" />
                      ) : null}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-[11px] font-bold uppercase tracking-[0.24em] text-[var(--pf-muted)]">{item.brand}</p>
                          <h3 className="line-clamp-2 text-base font-black leading-5 text-[var(--pf-text)]">{item.name}</h3>
                          <p className="mt-1 text-sm text-[var(--pf-muted)]">{item.presentation}</p>
                        </div>
                        <button
                          type="button"
                          className="rounded-full border border-[var(--pf-border)] px-3 py-1 text-xs font-semibold text-[var(--pf-text)] transition hover:bg-[rgba(248,242,232,0.8)]"
                          onClick={() => removeItem(item.sku)}
                        >
                          Quitar
                        </button>
                      </div>

                      <div className="mt-4 flex items-center justify-between gap-3 rounded-[1.1rem] bg-[rgba(248,242,232,0.82)] px-3 py-2">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--pf-border)] bg-white text-[var(--pf-text)]"
                            onClick={() => updateQuantity(item.sku, item.quantity - 1)}
                            aria-label={`Disminuir cantidad de ${item.name}`}
                          >
                            <Minus className="size-4" />
                          </button>
                          <span className="min-w-12 text-center text-sm font-bold text-[var(--pf-text)]">{item.quantity}</span>
                          <button
                            type="button"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--pf-border)] bg-white text-[var(--pf-text)]"
                            onClick={() => updateQuantity(item.sku, item.quantity + 1)}
                            aria-label={`Aumentar cantidad de ${item.name}`}
                          >
                            <Plus className="size-4" />
                          </button>
                        </div>

                        <div className="text-right">
                          <p className="text-[11px] uppercase tracking-[0.24em] text-[var(--pf-muted)]">Subtotal</p>
                          <p className="text-base font-black text-[var(--pf-text)]">{formatCurrency(item.publicPrice * item.quantity)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-[rgba(168,109,69,0.16)] px-5 py-4">
          <div className="rounded-[1.35rem] border border-[var(--pf-border)] bg-[rgba(255,255,255,0.85)] p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-2xl font-black text-[var(--pf-text)]">{formatCurrency(totalPrice)}</p>
            </div>
          </div>

          <div className="mt-4 grid gap-3">
            <button
              type="button"
              className={buttonVariants({ variant: "primary", size: "md" })}
              onClick={() => clearCart()}
              disabled={items.length === 0}
            >
              Vaciar pedido
            </button>
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={handleConfirmPedido}
              disabled={items.length === 0 || isGeneratingPdf}
            >
              {isGeneratingPdf ? "Generando PDF..." : "Confirmar pedido"}
            </Button>
          </div>
        </div>
      </aside>
    ),
    [clearCart, closeCart, hydrated, handleConfirmPedido, isGeneratingPdf, items, mode, removeItem, totalItems, totalPrice, updateQuantity],
  );

  if (!visible) {
    return null;
  }

  if (mode === "page") {
    return (
      <main className={containerClass}>
        <div className="grid flex-1 gap-6 lg:grid-cols-[minmax(0,1fr)_460px]">
          <section className="rounded-[2rem] border border-[var(--pf-border-warm)] bg-[linear-gradient(180deg,var(--pf-surface-warm)_0%,var(--pf-sand-soft)_58%,var(--pf-surface-strong)_100%)] p-4 shadow-sm sm:p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <h1 className="text-3xl font-black tracking-tight text-[var(--pf-text)] sm:text-4xl">Mi pedido</h1>
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--pf-border)] bg-[rgba(255,255,255,0.82)] text-[var(--pf-text)] transition hover:bg-[rgba(248,242,232,0.92)] lg:hidden"
                aria-label="Cerrar carrito"
                onClick={() => router.back()}
              >
                <X className="size-5" />
              </button>
            </div>
          </section>
          {panel}
        </div>
      </main>
    );
  }

  return (
    <div className={containerClass} onClick={closeCart} aria-hidden={!isOpen}>
      <div className="h-full w-full bg-[rgba(35,28,20,0.38)] backdrop-blur-[2px]" />
      <div className="absolute inset-y-0 right-0 w-full max-w-[460px]" onClick={(event) => event.stopPropagation()}>
        {panel}
      </div>
    </div>
  );
}
