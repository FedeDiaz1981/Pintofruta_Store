"use client";

import Image from "next/image";
import Link from "next/link";
import { Search, UserRound } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import type { DynamicHeaderMenu } from "@/application/catalog";
import { AuthModal } from "@/components/auth/auth-modal";
import { useViewer } from "@/components/auth/viewer-provider";
import { CartButton } from "@/components/cart/cart-button";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { publicAsset } from "@/lib/catalog";

type SiteHeaderProps = {
  menus: DynamicHeaderMenu[];
};

export function SiteHeader({ menus }: SiteHeaderProps) {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [openMenuKey, setOpenMenuKey] = useState<string | null>(null);
  const viewer = useViewer();
  const router = useRouter();

  const openAuthModal = useCallback(() => {
    window.dispatchEvent(new Event("pf-auth-modal:open"));
  }, []);

  const closeAllMenus = useCallback(() => {
    setOpenMenuKey(null);
  }, []);

  useEffect(() => {
    const pathsToPrefetch = ["/", "/galeria", "/busqueda"];

    if (viewer?.isAdmin) {
      pathsToPrefetch.push("/admin");
    }

    for (const menu of menus) {
      pathsToPrefetch.push(menu.href);
      for (const group of menu.groups) {
        for (const bucket of group.itemsByInitial) {
          for (const item of bucket.items) {
            pathsToPrefetch.push(item.href);
          }
        }
      }
    }

    for (const href of pathsToPrefetch) {
      router.prefetch(href);
    }
  }, [menus, router, viewer?.isAdmin]);

  const submitSearch = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const normalized = searchInputRef.current?.value.trim() ?? "";
      router.push(normalized ? `/busqueda?q=${encodeURIComponent(normalized)}` : "/galeria");
    },
    [router],
  );

  const submitSearchDirect = useCallback(() => {
    const normalized = searchInputRef.current?.value.trim() ?? "";
    router.push(normalized ? `/busqueda?q=${encodeURIComponent(normalized)}` : "/galeria");
  }, [router]);

  return (
    <>
      <header className="sticky top-0 z-[10010] hidden lg:block">
        <div className="border-b border-[var(--pf-border)] bg-[rgba(248,242,232,0.96)] shadow-[0_14px_32px_rgba(74,57,38,0.08)] backdrop-blur">
          <div className="pf-shell grid gap-4 px-4 py-4 lg:grid-cols-[auto_1fr_auto] lg:items-center lg:gap-6 lg:px-12">
            <Link
              href="/"
              className="mx-auto flex items-center justify-center rounded-full border-2 border-[rgba(168,109,69,0.32)] bg-[linear-gradient(90deg,rgba(168,109,69,0.20),rgba(200,176,137,0.28),rgba(246,240,230,0.6))] px-4 py-2 shadow-[0_8px_18px_rgba(74,57,38,0.10),inset_0_0_0_1px_rgba(255,255,255,0.10)] lg:mx-0"
            >
              <Image
                src={publicAsset("/assets/images/logo/logo-Pintofruta.png")}
                alt="Pintofruta"
                width={255}
                height={64}
                className="h-auto w-[180px] max-w-full drop-shadow-[0_1px_1px_rgba(0,0,0,0.08)] sm:w-[220px] lg:w-[255px]"
                priority
              />
            </Link>

            <form className="w-full" onSubmit={submitSearch}>
              <div className="overflow-hidden rounded-full border border-[var(--pf-border)] bg-[var(--pf-surface)] shadow-[var(--pf-shadow-soft)]">
                <div className="flex flex-col sm:flex-row">
                  <Button
                    type="button"
                    variant="primary"
                    size="icon"
                    className="min-h-[52px] w-full rounded-none sm:w-[52px]"
                    aria-label="Buscar"
                    onClick={submitSearchDirect}
                  >
                    <Search className="size-5" />
                  </Button>
                  <Input
                    ref={searchInputRef}
                    type="text"
                    name="q"
                    placeholder="Buscar"
                    className="min-h-[52px] flex-1 rounded-none border-0 bg-transparent px-4 shadow-none focus:ring-0"
                  />
                </div>
              </div>
            </form>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={openAuthModal}
                className={`${buttonVariants({ variant: "secondary", size: "icon" })} cursor-pointer`}
                aria-label="Cuenta"
              >
                <UserRound className="size-4" />
              </button>
              <CartButton />
              {viewer?.isAdmin ? (
                <Link href="/admin" className={`${buttonVariants({ variant: "primary", size: "md" })} !text-white`}>
                  Administración
                </Link>
              ) : null}
            </div>
          </div>
        </div>

        <div className="border-b border-[var(--pf-border-soft)] bg-white/90 shadow-[0_1px_1px_hsla(0,0%,0%,0.06),0_2px_2px_hsla(0,0%,0%,0.06)]">
          <div className="pf-shell px-4 lg:px-12">
            <nav className="grid grid-cols-2 border-x border-[var(--pf-border-soft)] bg-white">
              {menus.map((menu) => (
                <details
                  key={menu.key}
                  className="dropdown dropdown-bottom dropdown-center relative"
                  open={openMenuKey === menu.key}
                  onToggle={(event) => {
                    if (!(event.currentTarget as HTMLDetailsElement).open && openMenuKey === menu.key) {
                      setOpenMenuKey(null);
                    }
                  }}
                >
                  <summary
                    className={`${buttonVariants({ variant: "secondary", size: "md" })} flex min-h-[64px] cursor-pointer list-none justify-center rounded-none border-y border-[var(--pf-border-soft)] bg-white px-4 text-sm font-medium uppercase tracking-[0.18em] hover:bg-[rgba(248,242,232,0.7)] [&::-webkit-details-marker]:hidden`}
                    onClick={(event) => {
                      event.preventDefault();
                      setOpenMenuKey((current) => (current === menu.key ? null : menu.key));
                    }}
                  >
                    {menu.label}
                  </summary>
                  <div className="dropdown-content z-[10060] mt-3 w-[min(92vw,1100px)] rounded-[1.75rem] border border-[var(--pf-border)] bg-[var(--pf-surface)] p-4 shadow-[0_24px_60px_rgba(74,57,38,0.16)]">
                    <div className="flex items-center justify-between gap-3 border-b border-[var(--pf-border-soft)] pb-4">
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[var(--pf-muted)]">{menu.label}</p>
                        <p className="text-sm text-[var(--pf-muted)]">Agrupado por letras</p>
                      </div>
                      <Link href="/galeria" className="btn btn-ghost btn-sm rounded-full border border-[var(--pf-border)] normal-case">
                        Ver todo
                      </Link>
                    </div>

                    <div className="mt-4 grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(280px,1fr))]">
                      {menu.groups.map((group) => (
                        <div key={group.label} className="rounded-[1.25rem] border border-[var(--pf-border-soft)] bg-[rgba(255,255,255,0.55)] p-4">
                          <p className="mb-3 text-sm font-bold uppercase tracking-[0.22em] text-[var(--pf-primary-darker)]">{group.label}</p>
                          <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
                            {group.itemsByInitial.map((bucket) => (
                              <div key={bucket.initial} className="h-full rounded-2xl border border-[var(--pf-border-soft)] bg-white/70 p-4">
                                <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.24em] text-[var(--pf-muted)]">{bucket.initial}</p>
                                <ul className="space-y-2">
                                  {bucket.items.map((item) => (
                                    <li key={item.href}>
                                      <Link
                                        href={item.href}
                                        onClick={closeAllMenus}
                                        className="block rounded-xl px-3 py-2 text-sm text-[var(--pf-text)] transition hover:bg-[rgba(168,109,69,0.08)] hover:text-[var(--pf-primary-darker)]"
                                      >
                                        {item.label}
                                      </Link>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </details>
              ))}
            </nav>
          </div>
        </div>
      </header>

      <AuthModal toggleId="desktop-login-toggle" />
    </>
  );
}
