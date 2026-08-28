import type { Metadata } from "next";
import { connection } from "next/server";
import { Inter, Manrope } from "next/font/google";
import { getActiveSiteBanners, getDynamicHeaderMenus } from "@/application/catalog";
import { ViewerProvider } from "@/components/auth/viewer-provider";
import { CartProvider } from "@/components/cart/cart-context";
import { FloatingCartButton } from "@/components/cart/floating-cart-button";
import { CartPanel } from "@/components/cart/cart-panel";
import { MobileSiteChrome } from "@/components/site/mobile-site-chrome";
import { SiteBannerStrip } from "@/components/site/site-banner-strip";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { getCurrentViewer } from "@/infrastructure/auth/pintofruta-auth";
import "./globals.css";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await connection();
  const banners = await getActiveSiteBanners();
  const menus = await getDynamicHeaderMenus();
  const viewer = await getCurrentViewer();

  return (
    <html lang="es" data-theme="caramellatte" className={`${inter.variable} ${manrope.variable} h-full antialiased`}>
      <body className="min-h-screen overflow-x-hidden text-base-content">
        <ViewerProvider initialViewer={viewer}>
          <CartProvider>
            <div className="relative flex h-dvh flex-col overflow-hidden lg:h-auto lg:min-h-screen lg:overflow-visible">
              <div className="hidden lg:block">
                <SiteBannerStrip banners={banners} />
              </div>
              <SiteHeader menus={menus} />
              <MobileSiteChrome menus={menus} />
              <div id="pf-header-sentinel" aria-hidden="true" className="h-px w-full" />
              <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain pt-[88px] pb-[72px] lg:overflow-visible lg:pt-0 lg:pb-0">
                {children}
              </main>
              <SiteFooter />
              <FloatingCartButton />
              <CartPanel />
            </div>
          </CartProvider>
        </ViewerProvider>
      </body>
    </html>
  );
}
