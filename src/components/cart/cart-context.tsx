"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useViewer } from "@/components/auth/viewer-provider";
import type { PackItem, ProductItem } from "@/domain/site-content";

export type CartLine = {
  kind: "product" | "pack";
  id: number;
  sku: string;
  name: string;
  brand: string;
  presentation: string;
  image?: string;
  publicPrice: number;
  memberPrice: number;
  quantity: number;
};

type PricingViewer = {
  authenticated: boolean;
  canSeePrices: boolean;
} | null | undefined;

type CartContextValue = {
  items: CartLine[];
  hydrated: boolean;
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
  addItem: (product: ProductItem, quantity?: number) => void;
  addPack: (pack: PackItem, quantity?: number) => void;
  updateQuantity: (sku: string, quantity: number) => void;
  removeItem: (sku: string) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
};

type AddNotice = {
  name: string;
  quantity: number;
};

const CART_STORAGE_KEY = "pintofruta_cart_v1";

const CartContext = createContext<CartContextValue | null>(null);

function safeParseCart(value: string | null): CartLine[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as CartLine[];
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((item): CartLine => ({
        kind: item.kind === "pack" ? "pack" : "product",
        id: Number(item.id),
        sku: String(item.sku),
        name: String(item.name),
        brand: String(item.brand),
        presentation: String(item.presentation),
        image: item.image ? String(item.image) : undefined,
        publicPrice: Number(item.publicPrice),
        memberPrice: Number(item.memberPrice ?? item.publicPrice),
        quantity: Math.max(1, Number(item.quantity) || 1),
      }))
      .filter((item) => item.sku && Number.isFinite(item.publicPrice) && Number.isFinite(item.memberPrice));
  } catch {
    return [];
  }
}

export function resolveCartLineUnitPrice(item: CartLine, viewer: PricingViewer) {
  if (item.kind === "product" && viewer?.authenticated && viewer.canSeePrices && Number.isFinite(item.memberPrice) && item.memberPrice > 0) {
    return item.memberPrice;
  }

  return item.publicPrice;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartLine[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [addNotice, setAddNotice] = useState<AddNotice | null>(null);
  const viewer = useViewer();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setItems(safeParseCart(window.localStorage.getItem(CART_STORAGE_KEY)));
      setHydrated(true);
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  }, [hydrated, items]);

  useEffect(() => {
    if (!addNotice) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setAddNotice(null);
    }, 2600);

    return () => window.clearTimeout(timer);
  }, [addNotice]);

  const value = useMemo<CartContextValue>(() => {
    const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
    const totalPrice = items.reduce((sum, item) => sum + item.quantity * resolveCartLineUnitPrice(item, viewer), 0);

    return {
      items,
      hydrated,
      isOpen,
      openCart: () => setIsOpen(true),
      closeCart: () => setIsOpen(false),
      toggleCart: () => setIsOpen((current) => !current),
      addItem: (product, quantity = 1) => {
        if (product.soldOut) {
          return;
        }

        const nextQuantity = Math.max(1, quantity);
        setAddNotice({ name: product.name, quantity: nextQuantity });
        setItems((current) => {
          const existing = current.find((item) => item.sku === product.sku);

          if (existing) {
            return current.map((item) =>
              item.sku === product.sku ? { ...item, quantity: item.quantity + nextQuantity } : item,
            );
          }

          return [
            ...current,
            {
              kind: "product",
              id: product.id,
              sku: product.sku,
              name: product.name,
              brand: product.brand,
              presentation: product.presentation,
              image: product.image,
              publicPrice: product.publicPrice,
              memberPrice: product.memberPrice,
              quantity: nextQuantity,
            },
          ];
        });
      },
      addPack: (pack, quantity = 1) => {
        const nextQuantity = Math.max(1, quantity);
        setAddNotice({ name: pack.title, quantity: nextQuantity });
        setItems((current) => {
          const sku = `PACK-${pack.id}`;
          const existing = current.find((item) => item.sku === sku);

          if (existing) {
            return current.map((item) => (item.sku === sku ? { ...item, quantity: item.quantity + nextQuantity } : item));
          }

          return [
            ...current,
            {
              kind: "pack",
              id: pack.id,
              sku,
              name: pack.title,
              brand: pack.category || "Promoción",
              presentation: `${pack.items.length} productos incluidos`,
              image: pack.image,
              publicPrice: pack.publicPrice,
              memberPrice: pack.publicPrice,
              quantity: nextQuantity,
            },
          ];
        });
      },
      updateQuantity: (sku, quantity) => {
        setItems((current) =>
          current
            .map((item) => (item.sku === sku ? { ...item, quantity: Math.max(1, quantity) } : item))
            .filter((item) => item.quantity > 0),
        );
      },
      removeItem: (sku) => {
        setItems((current) => current.filter((item) => item.sku !== sku));
      },
      clearCart: () => setItems([]),
      totalItems,
      totalPrice,
    };
  }, [hydrated, isOpen, items, viewer]);

  return (
    <CartContext.Provider value={value}>
      {children}
      {addNotice ? (
        <div className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] left-1/2 z-[13000] w-[min(calc(100vw-2rem),26rem)] -translate-x-1/2 rounded-[1.35rem] border border-[rgba(168,109,69,0.22)] bg-[rgba(255,251,245,0.98)] px-5 py-4 text-[var(--pf-text)] shadow-[0_22px_55px_rgba(74,57,38,0.22)] backdrop-blur lg:bottom-6 lg:left-auto lg:right-6 lg:translate-x-0">
          <p className="text-[11px] font-black uppercase tracking-[0.28em] text-[var(--pf-secondary)]">
            Producto agregado
          </p>
          <p className="mt-1 text-sm font-semibold leading-5">
            {addNotice.quantity === 1 ? "Se agregó 1 unidad" : `Se agregaron ${addNotice.quantity} unidades`} al carrito.
          </p>
          <p className="mt-1 line-clamp-1 text-xs text-[var(--pf-muted)]">{addNotice.name}</p>
        </div>
      ) : null}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within CartProvider");
  }

  return context;
}
