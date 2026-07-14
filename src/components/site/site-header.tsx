import Image from "next/image";
import Link from "next/link";
import { Search, ShoppingCart, UserRound } from "lucide-react";
import { getDynamicHeaderMenus } from "@/application/catalog";
import { publicAsset } from "@/lib/catalog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export async function SiteHeader() {
  return <SiteHeaderContent />;
}

async function SiteHeaderContent() {
  const menus = await getDynamicHeaderMenus();

  return (
    <header className="sticky top-0 z-[10010]">
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

          <form action="/busqueda" method="get" className="w-full">
            <div className="overflow-hidden rounded-full border border-[var(--pf-border)] bg-[var(--pf-surface)] shadow-[var(--pf-shadow-soft)]">
              <div className="flex flex-col sm:flex-row">
                <Button
                  type="submit"
                  variant="primary"
                  size="icon"
                  className="min-h-[52px] w-full rounded-none sm:w-[52px]"
                  aria-label="Buscar"
                >
                  <Search className="size-5" />
                </Button>
                <Input
                  type="text"
                  name="q"
                  placeholder="Buscar"
                  className="min-h-[52px] flex-1 rounded-none border-0 bg-transparent px-4 shadow-none focus:ring-0"
                />
              </div>
            </div>
          </form>

          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="secondary" size="icon" aria-label="Cuenta">
              <UserRound className="size-4" />
            </Button>
            <Link
              href="/carrito"
              className={buttonVariants({ variant: "secondary", size: "icon" })}
              aria-label="Carrito"
            >
              <ShoppingCart className="size-4" />
            </Link>
            <Link href="/admin" className={`${buttonVariants({ variant: "primary", size: "md" })} hidden lg:inline-flex`}>
              Admin demo
            </Link>
          </div>
        </div>
      </div>

      <div className="border-b border-[var(--pf-border-soft)] bg-white/90 shadow-[0_1px_1px_hsla(0,0%,0%,0.06),0_2px_2px_hsla(0,0%,0%,0.06)]">
        <div className="pf-shell px-4 lg:px-12">
          <nav className="grid grid-cols-2 border-x border-[var(--pf-border-soft)] bg-white">
              {menus.map((menu) => (
                <details key={menu.key} className="dropdown dropdown-bottom dropdown-center relative">
                <summary
                  className={`${buttonVariants({ variant: "secondary", size: "md" })} flex min-h-[64px] cursor-pointer list-none justify-center rounded-none border-y border-[var(--pf-border-soft)] bg-white px-4 text-sm font-medium uppercase tracking-[0.18em] hover:bg-[rgba(248,242,232,0.7)] [&::-webkit-details-marker]:hidden`}
                >
                  {menu.label}
                </summary>
                <div className="dropdown-content z-[10060] mt-3 w-[min(92vw,1100px)] rounded-[1.75rem] border border-[var(--pf-border)] bg-[var(--pf-surface)] p-4 shadow-[0_24px_60px_rgba(74,57,38,0.16)]">
                    <div className="flex items-center justify-between gap-3 border-b border-[var(--pf-border-soft)] pb-4">
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[var(--pf-muted)]">
                          {menu.label}
                        </p>
                        <p className="text-sm text-[var(--pf-muted)]">Agrupado por letras</p>
                      </div>
                      <Link
                        href={menu.key === "brands" ? "/galeria" : "/galeria"}
                        className="btn btn-ghost btn-sm rounded-full border border-[var(--pf-border)] normal-case"
                      >
                        Ver todo
                      </Link>
                    </div>

                    <div className="mt-4 space-y-4">
                      {menu.groups.map((group) => (
                        <div
                          key={group.label}
                          className="rounded-[1.25rem] border border-[var(--pf-border-soft)] bg-[rgba(255,255,255,0.55)] p-4"
                        >
                          <p className="mb-3 text-sm font-bold uppercase tracking-[0.22em] text-[var(--pf-primary-darker)]">
                            {group.label}
                          </p>
                          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                            {group.itemsByInitial.map((bucket) => (
                              <div key={bucket.initial} className="rounded-2xl border border-[var(--pf-border-soft)] bg-white/70 p-4">
                                <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.24em] text-[var(--pf-muted)]">
                                  {bucket.initial}
                                </p>
                                <ul className="space-y-2">
                                  {bucket.items.map((item) => (
                                    <li key={item.href}>
                                      <Link
                                        href={item.href}
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
  );
}
