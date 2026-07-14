"use client";

import { ShoppingCart } from "lucide-react";
import { useCart } from "@/components/cart/cart-context";
import { Button } from "@/components/ui/button";

export function CartButton() {
  const { openCart, totalItems } = useCart();

  return (
    <Button type="button" variant="secondary" size="icon" aria-label="Carrito" onClick={openCart} className="relative">
      <ShoppingCart className="size-4" />
      {totalItems > 0 ? (
        <span className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-[var(--pf-primary-darker)] px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
          {totalItems}
        </span>
      ) : null}
    </Button>
  );
}
