"use client";

import type { ButtonHTMLAttributes } from "react";
import type { ProductItem } from "@/domain/site-content";
import { useCart } from "@/components/cart/cart-context";
import { Button } from "@/components/ui/button";

type CartAddButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  product: ProductItem;
  quantity?: number;
};

export function CartAddButton({ product, quantity = 1, children, onClick, ...props }: CartAddButtonProps) {
  const { addItem } = useCart();

  return (
    <Button
      {...props}
      onClick={(event) => {
        addItem(product, quantity);
        onClick?.(event);
      }}
    >
      {children ?? "Agregar al pedido"}
    </Button>
  );
}
