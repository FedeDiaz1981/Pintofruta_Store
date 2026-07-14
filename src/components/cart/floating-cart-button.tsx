"use client";

import { ShoppingCart } from "lucide-react";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useCart } from "@/components/cart/cart-context";
import { Button } from "@/components/ui/button";

export function FloatingCartButton() {
  const pathname = usePathname();
  const { toggleCart, totalItems } = useCart();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const updateVisibility = () => {
      setIsVisible(window.scrollY > 220);
    };

    updateVisibility();
    window.addEventListener("scroll", updateVisibility, { passive: true });
    window.addEventListener("resize", updateVisibility);

    return () => {
      window.removeEventListener("scroll", updateVisibility);
      window.removeEventListener("resize", updateVisibility);
    };
  }, []);

  if (pathname === "/carrito") {
    return null;
  }

  return (
    <div
      className={`fixed bottom-0 right-0 z-[11030] hidden lg:block p-4 transition-all duration-300 ${
        isVisible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0"
      }`}
      aria-hidden={!isVisible}
    >
      <Button
        type="button"
        variant="primary"
        size="lg"
        onClick={toggleCart}
        className="relative h-18 w-18 rounded-full px-0 shadow-[0_16px_36px_rgba(74,57,38,0.24)] transition-transform duration-200 hover:-translate-y-1 hover:scale-105 active:scale-95"
        aria-label="Abrir carrito"
      >
        <ShoppingCart className="size-8 text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.18)]" />
        <span className="absolute -right-1 -top-1 inline-flex min-w-6 items-center justify-center rounded-full border border-white bg-[var(--pf-primary-darker)] px-1.5 py-0.5 text-[11px] font-black leading-none text-white shadow-[0_8px_18px_rgba(74,57,38,0.18)] animate-pulse">
          {totalItems}
        </span>
      </Button>
    </div>
  );
}
