"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
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
  quantity: number;
};

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
        quantity: Math.max(1, Number(item.quantity) || 1),
      }))
      .filter((item) => item.sku && Number.isFinite(item.publicPrice));
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartLine[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

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

  const value = useMemo<CartContextValue>(() => {
    const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
    const totalPrice = items.reduce((sum, item) => sum + item.quantity * item.publicPrice, 0);

    return {
      items,
      hydrated,
      isOpen,
      openCart: () => setIsOpen(true),
      closeCart: () => setIsOpen(false),
      toggleCart: () => setIsOpen((current) => !current),
      addItem: (product, quantity = 1) => {
        setItems((current) => {
          const nextQuantity = Math.max(1, quantity);
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
              quantity: nextQuantity,
            },
          ];
        });
      },
      addPack: (pack, quantity = 1) => {
        setItems((current) => {
          const nextQuantity = Math.max(1, quantity);
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
  }, [hydrated, isOpen, items]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within CartProvider");
  }

  return context;
}
