"use client";

import { useRouter } from "next/navigation";
import { Minus, Plus, X } from "lucide-react";
import { useCallback, useState } from "react";

import { useCart, resolveCartLineUnitPrice } from "@/components/cart/cart-context";
import { useViewer } from "@/components/auth/viewer-provider";
import { formatCurrency, publicAsset } from "@/lib/catalog";
import { Button, buttonVariants } from "@/components/ui/button";

const CART_TOGGLE_ID = "pf-cart-toggle";

type CustomerDetailsDraft = {
  name: string;
  cuit: string;
  address: string;
  postalCode: string;
  schedule: string;
  phone: string;
};

type DeliveryErrorState = {
  fileName?: string;
  blob?: Blob;
  message: string;
  canDownload: boolean;
} | null;

const EMPTY_CUSTOMER_DETAILS: CustomerDetailsDraft = {
  name: "",
  cuit: "",
  address: "",
  postalCode: "",
  schedule: "",
  phone: "",
};

function toCustomerDetailsPayload(values: CustomerDetailsDraft) {
  return {
    name: values.name.trim(),
    cuit: values.cuit.trim(),
    address: values.address.trim(),
    postalCode: values.postalCode.trim(),
    schedule: values.schedule.trim(),
    phone: values.phone.trim(),
  };
}

export function CartPanel({
  mode = "drawer",
}: {
  mode?: "drawer" | "page";
}) {
  const { items, hydrated, isOpen, openCart, closeCart, updateQuantity, removeItem, clearCart, totalItems, totalPrice } =
    useCart();
  const viewer = useViewer();
  const router = useRouter();
  const [isSubmittingPedido, setIsSubmittingPedido] = useState(false);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [deliveryError, setDeliveryError] = useState<DeliveryErrorState>(null);
  const [isDeliverySuccessOpen, setIsDeliverySuccessOpen] = useState(false);
  const [customerDetails, setCustomerDetails] = useState<CustomerDetailsDraft>(EMPTY_CUSTOMER_DETAILS);

  const resetCustomerModal = useCallback(() => {
    setIsCustomerModalOpen(false);
    setCustomerDetails(EMPTY_CUSTOMER_DETAILS);
  }, []);

  const closeDeliveryError = useCallback(() => {
    setDeliveryError(null);
  }, []);

  const closeDeliverySuccess = useCallback(() => {
    setIsDeliverySuccessOpen(false);
    closeCart();
  }, [closeCart]);

  const downloadFallbackExcel = useCallback(() => {
    if (!deliveryError?.canDownload || !deliveryError.blob) {
      return;
    }

    const url = window.URL.createObjectURL(deliveryError.blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = deliveryError.fileName || "pedido-pintofruta.xlsx";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(url);
  }, [deliveryError]);

  const submitPedido = useCallback(
    async (details: CustomerDetailsDraft) => {
      if (!hydrated || items.length === 0 || isSubmittingPedido) {
        return;
      }

      try {
        setIsSubmittingPedido(true);

        const orderPayload = JSON.stringify({
          items: items.map((item) => ({ ...item })),
        });

        const response = await fetch("/api/pedido/excel", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            payload: orderPayload,
            customerDetails: toCustomerDetailsPayload(details),
          }),
        });

        const emailSent = response.headers.get("x-email-sent") === "true";

        if (emailSent) {
          if (!response.ok) {
            const payload = (await response.json().catch(() => ({}))) as { error?: string };
            throw new Error(payload.error || "No se pudo enviar el pedido.");
          }

          setDeliveryError(null);
          setIsDeliverySuccessOpen(true);
          clearCart();
          resetCustomerModal();
          return;
        }

        const blob = await response.blob();
        const downloadName = response.headers.get("x-file-name") || "pedido-pintofruta.xlsx";
        const errorMessage = response.headers.get("x-email-error");
        setDeliveryError({
          fileName: downloadName,
          blob,
          canDownload: true,
          message: errorMessage
            ? decodeURIComponent(errorMessage)
            : "No se pudo enviar por mail. Se descargará el Excel para envío manual.",
        });

        clearCart();
        resetCustomerModal();
      } catch (error) {
        console.error(error);
        setDeliveryError({
          canDownload: false,
          message: error instanceof Error ? error.message : "No pudimos enviar el pedido. Probá de nuevo.",
        });
        clearCart();
        resetCustomerModal();
      } finally {
        setIsSubmittingPedido(false);
      }
    },
    [clearCart, hydrated, isSubmittingPedido, items, resetCustomerModal],
  );

  const handleOpenConfirmation = useCallback(() => {
    if (!hydrated || items.length === 0 || isSubmittingPedido) {
      return;
    }

    setIsCustomerModalOpen(true);
  }, [hydrated, isSubmittingPedido, items.length]);

  const panel = (
    <>
      <aside className="flex h-full w-full max-w-[460px] flex-col border-l border-[var(--pf-border-warm)] bg-[linear-gradient(180deg,var(--pf-surface-warm)_0%,var(--pf-sand-soft)_44%,var(--pf-cream-soft)_100%)] shadow-[0_24px_80px_rgba(74,57,38,0.26)]">
        <div className="flex items-center justify-between border-b border-[rgba(168,109,69,0.16)] px-5 py-4">
          <div>
            <h2 className="mt-1 text-2xl font-black tracking-tight text-[var(--pf-text)]">Mi pedido</h2>
          </div>
          {mode === "drawer" ? (
            <label
              htmlFor={CART_TOGGLE_ID}
              className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-[var(--pf-border)] bg-[rgba(255,255,255,0.82)] text-[var(--pf-text)] transition hover:bg-[rgba(248,242,232,0.92)]"
              aria-label="Cerrar carrito"
            >
              <X className="size-5" />
            </label>
          ) : (
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--pf-border)] bg-[rgba(255,255,255,0.82)] text-[var(--pf-text)] transition hover:bg-[rgba(248,242,232,0.92)] lg:hidden"
              aria-label="Cerrar carrito"
              onClick={() => router.back()}
            >
              <X className="size-5" />
            </button>
          )}
        </div>

        <div className="grid gap-3 px-5 pt-5 sm:grid-cols-2">
          <div className="rounded-[1.35rem] border border-[var(--pf-border)] bg-[rgba(255,255,255,0.82)] p-4 shadow-[0_10px_22px_rgba(74,57,38,0.06)]">
            <p className="text-xs uppercase tracking-[0.28em] text-[var(--pf-muted)]">Articulos</p>
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
              <p className="text-lg font-bold text-[var(--pf-text)]">Tu pedido esta vacio</p>
              <div className="mt-4">
                {mode === "drawer" ? (
                  <label
                    htmlFor={CART_TOGGLE_ID}
                    className={`${buttonVariants({ variant: "primary", size: "md" })} !text-white`}
                  >
                    Cerrar carrito
                  </label>
                ) : (
                  <button
                    type="button"
                    className={`${buttonVariants({ variant: "primary", size: "md" })} !text-white`}
                    onClick={() => router.back()}
                  >
                    Cerrar carrito
                  </button>
                )}
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
                          <p className="text-base font-black text-[var(--pf-text)]">
                            {formatCurrency(resolveCartLineUnitPrice(item, viewer) * item.quantity)}
                          </p>
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
              onClick={handleOpenConfirmation}
              disabled={items.length === 0 || isSubmittingPedido}
            >
              {isSubmittingPedido ? "Procesando..." : "Confirmar pedido"}
            </Button>
          </div>
        </div>
      </aside>

      {isSubmittingPedido ? (
        <div className="fixed inset-0 z-[12080] flex items-center justify-center bg-[#1f1a17cc] px-4 backdrop-blur-md">
          <div className="w-full max-w-md rounded-[28px] border border-[rgba(255,255,255,0.12)] bg-[linear-gradient(180deg,#fffaf3_0%,#f7efe2_100%)] px-6 py-8 text-center shadow-[0_30px_90px_rgba(0,0,0,0.28)]">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-[rgba(168,109,69,0.22)] bg-white shadow-[0_12px_30px_rgba(74,57,38,0.1)]">
              <div className="relative h-11 w-11">
                <span className="absolute inset-0 rounded-full border-4 border-[rgba(168,109,69,0.18)] border-t-[var(--pf-secondary)] animate-spin" />
                <img
                  src={publicAsset("/assets/images/logo/logo-Pintofruta_bl.png")}
                  alt="Pintofruta"
                  className="absolute inset-0 m-auto h-5 w-5 object-contain opacity-90"
                />
              </div>
            </div>
            <h3 className="mt-5 text-2xl font-black tracking-tight text-[var(--pf-text)]">Enviando pedido</h3>
            <div className="mt-5 flex items-center justify-center gap-2 text-[var(--pf-secondary)]">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-current [animation-delay:-0.2s]" />
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-current [animation-delay:0s]" />
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-current [animation-delay:0.2s]" />
            </div>
          </div>
        </div>
      ) : null}

      {deliveryError ? (
        <div
          className="fixed inset-0 z-[12090] flex items-center justify-center bg-[#20160fcc] px-4 backdrop-blur-md"
          onClick={closeDeliveryError}
        >
          <div
            className="w-full max-w-lg overflow-hidden rounded-[30px] border border-[rgba(255,255,255,0.14)] bg-[linear-gradient(180deg,#fffaf3_0%,#f7efe2_100%)] shadow-[0_40px_120px_rgba(0,0,0,0.32)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="border-b border-[rgba(168,109,69,0.14)] bg-[rgba(255,255,255,0.55)] px-6 py-5">
              <p className="text-[11px] font-black uppercase tracking-[0.34em] text-[var(--pf-secondary)]">Error de envío</p>
              <h3 className="mt-2 text-3xl font-black tracking-tight text-[var(--pf-text)]">No pudimos enviar el mail</h3>
            </div>

            <div className="px-6 py-6">
              <p className="text-sm leading-7 text-[var(--pf-primary-darker)]">{deliveryError.message}</p>

              <div className="mt-5 rounded-[22px] border border-[rgba(168,109,69,0.14)] bg-white px-4 py-4 shadow-[0_12px_30px_rgba(74,57,38,0.05)]">
                <p className="text-sm font-semibold text-[var(--pf-text)]">
                  {deliveryError.canDownload
                    ? "Podés descargar el Excel y enviarlo manualmente."
                    : "No hay archivo disponible para descargar en este intento."}
                </p>
              </div>

              <div className="mt-6 flex flex-wrap justify-end gap-3">
                <button
                  type="button"
                  onClick={closeDeliveryError}
                  className="rounded-full border border-[var(--pf-border-soft)] bg-white px-5 py-2.5 text-sm font-semibold text-[var(--pf-primary-darker)] transition hover:bg-[rgba(248,242,232,0.6)]"
                >
                  Cerrar
                </button>
                {deliveryError.canDownload && deliveryError.blob ? (
                  <Button type="button" variant="secondary" size="md" onClick={downloadFallbackExcel}>
                    Descargar Excel
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {isDeliverySuccessOpen ? (
        <div
          className="fixed inset-0 z-[12100] flex items-center justify-center bg-[#20160fcc] px-4 backdrop-blur-md"
          onClick={closeDeliverySuccess}
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-[30px] border border-[rgba(255,255,255,0.14)] bg-[linear-gradient(180deg,#fffaf3_0%,#f7efe2_100%)] shadow-[0_40px_120px_rgba(0,0,0,0.32)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="border-b border-[rgba(168,109,69,0.14)] bg-[rgba(255,255,255,0.55)] px-6 py-5">
              <p className="text-[11px] font-black uppercase tracking-[0.34em] text-[var(--pf-secondary)]">Pedido enviado</p>
              <h3 className="mt-2 text-3xl font-black tracking-tight text-[var(--pf-text)]">El pedido se envió correctamente</h3>
            </div>

            <div className="px-6 py-6">
              <p className="text-sm leading-7 text-[var(--pf-primary-darker)]">
                Ya se generó el Excel y se envió el mail al destinatario configurado.
              </p>

              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  onClick={closeDeliverySuccess}
                  className="rounded-full border border-[var(--pf-border-soft)] bg-white px-5 py-2.5 text-sm font-semibold text-[var(--pf-primary-darker)] transition hover:bg-[rgba(248,242,232,0.6)]"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {isCustomerModalOpen ? (
        <div
          className="fixed inset-0 z-[12060] flex items-start justify-center overflow-y-auto overscroll-contain bg-[#2d1f1480] px-4 pt-[96px] pb-[calc(1.5rem+env(safe-area-inset-bottom))] backdrop-blur-sm lg:pt-[136px] lg:pb-10"
          onClick={resetCustomerModal}
        >
          <div
            className="w-full max-w-3xl max-h-[calc(100dvh-7rem)] overflow-y-auto overscroll-contain rounded-[30px] border border-[var(--pf-border-soft)] bg-[#fbf8f1] shadow-[0_40px_120px_rgba(74,57,38,0.28)] lg:max-h-[calc(100dvh-9rem)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-[var(--pf-border-soft)] px-6 py-5">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.34em] text-[var(--pf-secondary)]">Datos del cliente</p>
                <h3 className="mt-2 text-3xl font-black tracking-tight text-[var(--pf-text)]">Confirmar pedido</h3>
                <p className="mt-2 text-sm text-[var(--pf-primary-darker)]">
                  Completa los datos antes de generar el Excel y enviar el mail.
                </p>
              </div>

              <button
                type="button"
                onClick={resetCustomerModal}
                className="rounded-full border border-[var(--pf-border-soft)] bg-white px-4 py-2 text-sm font-semibold text-[var(--pf-primary-darker)] transition hover:bg-[rgba(248,242,232,0.6)]"
              >
                Cerrar
              </button>
            </div>

            <form
              className="grid gap-4 px-6 py-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] md:grid-cols-2"
              onSubmit={(event) => {
                event.preventDefault();
                void submitPedido(customerDetails);
              }}
            >
              <label className="grid gap-2">
                <span className="text-sm font-semibold text-[var(--pf-text)]">Nombre</span>
                <input
                  type="text"
                  value={customerDetails.name}
                  onChange={(event) => setCustomerDetails((current) => ({ ...current, name: event.target.value }))}
                  className="h-12 rounded-xl border border-[var(--pf-border-soft)] bg-white px-4 text-sm outline-none"
                  placeholder="Nombre y apellido"
                  required
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-semibold text-[var(--pf-text)]">CUIT</span>
                <input
                  type="text"
                  value={customerDetails.cuit}
                  onChange={(event) => setCustomerDetails((current) => ({ ...current, cuit: event.target.value }))}
                  className="h-12 rounded-xl border border-[var(--pf-border-soft)] bg-white px-4 text-sm outline-none"
                  placeholder="XX-XXXXXXXX-X"
                  required
                />
              </label>

              <label className="grid gap-2 md:col-span-2">
                <span className="text-sm font-semibold text-[var(--pf-text)]">Direccion</span>
                <input
                  type="text"
                  value={customerDetails.address}
                  onChange={(event) => setCustomerDetails((current) => ({ ...current, address: event.target.value }))}
                  className="h-12 rounded-xl border border-[var(--pf-border-soft)] bg-white px-4 text-sm outline-none"
                  placeholder="Direccion completa"
                  required
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-semibold text-[var(--pf-text)]">CP</span>
                <input
                  type="text"
                  value={customerDetails.postalCode}
                  onChange={(event) => setCustomerDetails((current) => ({ ...current, postalCode: event.target.value }))}
                  className="h-12 rounded-xl border border-[var(--pf-border-soft)] bg-white px-4 text-sm outline-none"
                  placeholder="Codigo postal"
                  required
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-semibold text-[var(--pf-text)]">Horario</span>
                <input
                  type="text"
                  value={customerDetails.schedule}
                  onChange={(event) => setCustomerDetails((current) => ({ ...current, schedule: event.target.value }))}
                  className="h-12 rounded-xl border border-[var(--pf-border-soft)] bg-white px-4 text-sm outline-none"
                  placeholder="Horario de entrega"
                  required
                />
              </label>

              <label className="grid gap-2 md:col-span-2">
                <span className="text-sm font-semibold text-[var(--pf-text)]">Celular</span>
                <input
                  type="tel"
                  value={customerDetails.phone}
                  onChange={(event) => setCustomerDetails((current) => ({ ...current, phone: event.target.value }))}
                  className="h-12 rounded-xl border border-[var(--pf-border-soft)] bg-white px-4 text-sm outline-none"
                  placeholder="Numero de celular"
                  required
                />
              </label>

              <div className="md:col-span-2 mt-2 flex flex-wrap justify-end gap-3 border-t border-[var(--pf-border-soft)] pt-4 pb-2">
                <button
                  type="button"
                  onClick={resetCustomerModal}
                  className="rounded-full border border-[var(--pf-border-soft)] bg-white px-5 py-2.5 text-sm font-semibold text-[var(--pf-primary-darker)] transition hover:bg-[rgba(248,242,232,0.6)]"
                >
                  Cancelar
                </button>
                <Button type="submit" variant="secondary" size="md" disabled={isSubmittingPedido}>
                  {isSubmittingPedido ? "Enviando..." : "Confirmar datos y enviar"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );

  if (mode === "page") {
    return (
      <main className="pf-shell flex w-full flex-1 flex-col px-4 py-6 sm:px-6 lg:px-12 lg:py-10">
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
    <div className="fixed inset-0 z-[11020] pointer-events-none">
      <input
        id={CART_TOGGLE_ID}
        type="checkbox"
        checked={isOpen}
        onChange={(event) => {
          if (event.target.checked) {
            openCart();
          } else {
            closeCart();
          }
        }}
        className="peer/cart-toggle sr-only"
      />

      <label
        htmlFor={CART_TOGGLE_ID}
        aria-label="Cerrar carrito"
        className={[
          "absolute inset-0 bg-[rgba(35,28,20,0.38)] backdrop-blur-[2px] transition-opacity duration-300",
          isOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
        ].join(" ")}
      />

      <div
        aria-hidden={!isOpen}
        className={[
          "pointer-events-auto absolute inset-y-0 right-0 w-full max-w-[460px] transition-transform duration-300 ease-out",
          isOpen ? "translate-x-0" : "translate-x-full",
        ].join(" ")}
      >
        {panel}
      </div>
    </div>
  );
}
