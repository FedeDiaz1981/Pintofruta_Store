"use client";

import { ShoppingCart } from "lucide-react";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useCart } from "@/components/cart/cart-context";
const HEADER_SENTINEL_ID = "pf-header-sentinel";

export function FloatingCartButton() {
  const pathname = usePathname();
  const { isOpen, toggleCart, totalItems } = useCart();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const sentinel = document.getElementById(HEADER_SENTINEL_ID);

    if (!sentinel || typeof IntersectionObserver === "undefined") {
      const updateVisibility = () => {
        setIsVisible(window.scrollY > 160);
      };

      updateVisibility();
      window.addEventListener("scroll", updateVisibility, { passive: true });
      window.addEventListener("resize", updateVisibility);

      return () => {
        window.removeEventListener("scroll", updateVisibility);
        window.removeEventListener("resize", updateVisibility);
      };
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(!entry.isIntersecting);
      },
      {
        threshold: 0,
      },
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, []);

  if (pathname === "/carrito") {
    return null;
  }

  if (isOpen || !isVisible) {
    return null;
  }

  const displayCount = totalItems > 99 ? "99+" : String(totalItems);

  return (
    <div
      className="fixed bottom-6 right-6 z-[11030] hidden p-0 transition-all duration-300 lg:block"
      aria-hidden={!isVisible || isOpen}
    >
      <button
        type="button"
        aria-label={`Abrir carrito${totalItems > 0 ? ` con ${totalItems} productos` : ""}`}
        className="group flex h-16 items-center gap-3 rounded-full border border-[rgba(168,109,69,0.18)] bg-[rgba(255,251,245,0.96)] px-4 pr-5 text-[var(--pf-text)] shadow-[0_18px_40px_rgba(74,57,38,0.20)] transition-all duration-300 hover:-translate-y-1 hover:scale-[1.02] hover:shadow-[0_24px_52px_rgba(74,57,38,0.24)] active:scale-[0.98]"
        onClick={toggleCart}
      >
        <span className="relative flex h-11 w-11 items-center justify-center rounded-full bg-[var(--pf-primary-darker)] text-white shadow-[0_12px_24px_rgba(74,57,38,0.22)] transition-transform duration-300 group-hover:scale-105">
          <ShoppingCart className="size-5" />
          {totalItems > 0 ? <span className="absolute -right-0.5 -top-0.5 h-3.5 w-3.5 rounded-full border border-white bg-success motion-safe:animate-pulse" /> : null}
        </span>

        <span className="flex flex-col items-start leading-none">
          <span className="text-[10px] font-black uppercase tracking-[0.26em] text-[var(--pf-muted)]">Carrito</span>
          <span className="mt-1 text-sm font-extrabold tracking-tight text-[var(--pf-text)]">Ver pedido</span>
        </span>

        {totalItems > 0 ? (
          <span className="ml-1 inline-flex min-w-8 items-center justify-center rounded-full bg-[var(--pf-primary-darker)] px-2 py-1 text-[11px] font-black leading-none text-white shadow-[0_8px_18px_rgba(74,57,38,0.18)] motion-safe:animate-pulse">
            {displayCount}
          </span>
        ) : null}
      </button>
    </div>
  );
}
