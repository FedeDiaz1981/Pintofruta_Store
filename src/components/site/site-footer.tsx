import Image from "next/image";
import Link from "next/link";

import { publicAsset } from "@/lib/catalog";

export function SiteFooter() {
  const links = [
    { label: "Productos", href: "/galeria" },
    { label: "Productos destacados", href: "/galeria?featured=1" },
    { label: "Tendencias", href: "/galeria?trending=1" },
  ];

  return (
    <footer className="hidden border-t border-[rgba(214,184,152,0.55)] bg-[linear-gradient(180deg,#f7f0e6_0%,#5d3721_18%,#7a4a2c_100%)] text-[#f3e8da] lg:block">
      <div className="border-y border-[rgba(236,210,182,0.14)] bg-[linear-gradient(180deg,rgba(123,76,45,0.96)_0%,rgba(103,62,38,0.98)_100%)]">
        <div className="pf-shell px-4 py-8 sm:px-6 lg:px-12 lg:py-12">
          <div className="flex flex-col items-center gap-8 text-center lg:flex-row lg:items-center lg:justify-between lg:text-left">
            <div className="inline-flex items-center justify-center rounded-[2rem] bg-[#f8f2e8] px-5 py-4 shadow-[0_14px_30px_rgba(0,0,0,0.15)]">
              <Image
                src={publicAsset("/assets/images/logo/logo-Pintofruta.png")}
                alt="Pintofruta"
                width={220}
                height={56}
                className="h-auto w-[150px] sm:w-[180px]"
              />
            </div>

            <nav aria-label="Footer navigation" className="w-full max-w-4xl">
              <ul className="flex flex-col items-center gap-0 sm:gap-0 lg:flex-row lg:justify-center">
                {links.map((link, index) => (
                  <li
                    key={link.label}
                    className="flex w-full items-center justify-center border-t border-[rgba(255,255,255,0.14)] first:border-t-0 lg:w-auto lg:border-t-0"
                  >
                    <Link
                      href={link.href}
                      className="w-full rounded-full px-4 py-3 text-sm font-bold tracking-[0.01em] !text-[lab(98.5176%_0.8322_3.98616_/_0.92)] shadow-[0_1px_0_rgba(0,0,0,0.18)] transition hover:bg-[rgba(255,255,255,0.06)] hover:!text-[lab(98.5176%_0.8322_3.98616_/_0.92)] sm:text-base lg:w-auto lg:bg-transparent lg:px-0 lg:py-0 lg:shadow-none"
                    >
                      {link.label}
                    </Link>
                    {index < links.length - 1 ? (
                      <span className="hidden h-5 border-r border-[rgba(255,255,255,0.35)] lg:mx-8 lg:block" />
                    ) : null}
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          <div className="mt-8 border-t border-[rgba(255,255,255,0.18)] pt-6 text-center text-sm font-medium text-[#fffaf3]/92">
            (c) 2026 Pintofruta. Todos los derechos reservados.
          </div>
        </div>
      </div>
    </footer>
  );
}
