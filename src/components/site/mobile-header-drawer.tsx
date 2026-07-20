"use client";

import Link from "next/link";
import { Menu, Search, X } from "lucide-react";
import { useState } from "react";
import { Drawer } from "vaul";
import type { DynamicHeaderMenu } from "@/application/catalog";
import { buttonVariants } from "@/components/ui/button";

type MobileHeaderDrawerProps = {
  menus: DynamicHeaderMenu[];
};

export function MobileHeaderDrawer({ menus }: MobileHeaderDrawerProps) {
  const [open, setOpen] = useState(false);

  return (
    <Drawer.Root open={open} onOpenChange={setOpen} shouldScaleBackground={false}>
      <Drawer.Trigger asChild>
        <button
          type="button"
          className={`${buttonVariants({ variant: "secondary", size: "icon" })} h-11 w-11 rounded-full`}
          aria-label="Abrir menú"
        >
          <Menu className="size-5" />
        </button>
      </Drawer.Trigger>

      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-[11040] bg-[rgba(35,28,20,0.42)] backdrop-blur-[2px]" />
        <Drawer.Content className="fixed inset-x-0 bottom-0 z-[11050] max-h-[86dvh] overflow-hidden rounded-t-[2rem] border border-[var(--pf-border-warm)] bg-[var(--pf-surface)] shadow-[0_-24px_70px_rgba(74,57,38,0.28)]">
          <div className="flex items-center justify-between border-b border-[rgba(168,109,69,0.12)] px-4 py-4">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.26em] text-[var(--pf-muted)]">Navegación</p>
              <p className="mt-1 text-lg font-extrabold text-[var(--pf-text)]">Pintofruta</p>
            </div>
            <Drawer.Close asChild>
              <button
                type="button"
                className={`${buttonVariants({ variant: "secondary", size: "icon" })} h-10 w-10 rounded-full`}
                aria-label="Cerrar menú"
              >
                <X className="size-5" />
              </button>
            </Drawer.Close>
          </div>

          <div className="max-h-[calc(86dvh-73px)] overflow-y-auto px-4 py-4">
            <div className="rounded-[1.4rem] border border-[var(--pf-border)] bg-[rgba(248,242,232,0.75)] p-4">
              <Link
                href="/busqueda"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-[1rem] border border-[var(--pf-border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--pf-text)]"
              >
                <Search className="size-4 text-[var(--pf-primary-darker)]" />
                Buscar productos
              </Link>
            </div>

            <div className="mt-4 space-y-4">
              {menus.map((menu) => (
                <section key={menu.key} className="rounded-[1.4rem] border border-[var(--pf-border)] bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.28em] text-[var(--pf-muted)]">{menu.label}</p>
                      <p className="mt-1 text-sm text-[var(--pf-muted)]">Agrupado por letras</p>
                    </div>
                    <Link
                      href="/galeria"
                      onClick={() => setOpen(false)}
                      className="text-sm font-semibold text-[var(--pf-primary-darker)]"
                    >
                      Ver todo
                    </Link>
                  </div>

                  <div className="mt-4 space-y-3">
                    {menu.groups.map((group) => (
                      <div key={group.label} className="rounded-[1.1rem] bg-[rgba(248,242,232,0.7)] p-3">
                        <p className="mb-2 text-[11px] font-black uppercase tracking-[0.24em] text-[var(--pf-primary-darker)]">
                          {group.label}
                        </p>
                        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                          {group.itemsByInitial.flatMap((bucket) =>
                            bucket.items.map((item) => (
                              <Link
                                key={item.href}
                                href={item.href}
                                onClick={() => setOpen(false)}
                                className="inline-flex shrink-0 rounded-full border border-[rgba(168,109,69,0.16)] bg-white px-3 py-2 text-sm font-medium text-[var(--pf-text)] shadow-[0_6px_14px_rgba(74,57,38,0.06)]"
                              >
                                {item.label}
                              </Link>
                            )),
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
