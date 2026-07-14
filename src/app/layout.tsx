import type { Metadata } from "next";
import { Inter, Manrope } from "next/font/google";
import { CartProvider } from "@/components/cart/cart-context";
import { FloatingCartButton } from "@/components/cart/floating-cart-button";
import { CartPanel } from "@/components/cart/cart-panel";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Pintofruta Store",
  description: "Proyecto dinámico basado en la maqueta estática de Pintofruta.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" data-theme="caramellatte" className={`${inter.variable} ${manrope.variable} h-full antialiased`}>
      <body className="min-h-screen text-base-content">
        <CartProvider>
          <div className="relative flex min-h-screen flex-col">
            <SiteHeader />
            {children}
            <SiteFooter />
            <FloatingCartButton />
            <CartPanel />
          </div>
        </CartProvider>
      </body>
    </html>
  );
}
