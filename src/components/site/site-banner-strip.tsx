"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import type { BannerItem } from "@/domain/site-content";

type SiteBannerStripProps = {
  banners: BannerItem[];
};

const ACCENTS = [
  "var(--pf-primary)",
  "var(--pf-secondary-dark)",
  "var(--pf-olive)",
  "var(--pf-clay)",
];

export function SiteBannerStrip({ banners }: SiteBannerStripProps) {
  const pathname = usePathname();
  const visibleBanners = useMemo(() => banners.filter((item) => item.active), [banners]);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<"enter" | "idle" | "exit">("enter");

  useEffect(() => {
    if (pathname.startsWith("/admin") || visibleBanners.length <= 1) {
      return undefined;
    }

    const exitDelay = 4600;
    const exitDuration = 240;
    const timers: number[] = [];

    const interval = window.setInterval(() => {
      setPhase("exit");
      timers.push(
        window.setTimeout(() => {
          setIndex((current) => (current + 1) % visibleBanners.length);
          setPhase("enter");
          timers.push(window.setTimeout(() => setPhase("idle"), 20));
        }, exitDuration),
      );
    }, exitDelay);

    timers.push(window.setTimeout(() => setPhase("idle"), 320));

    return () => {
      window.clearInterval(interval);
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [pathname, visibleBanners.length]);

  if (pathname.startsWith("/admin") || visibleBanners.length === 0) {
    return null;
  }

  const current = visibleBanners[index % visibleBanners.length];
  const accent = ACCENTS[index % ACCENTS.length];

  return (
    <div className="relative z-[10011] border-b border-[rgba(168,109,69,0.18)] bg-[linear-gradient(180deg,rgba(248,242,232,0.98),rgba(239,228,208,0.98))]">
      <div
        className="pf-shell px-3 py-2 sm:px-4"
        aria-live="polite"
        aria-atomic="true"
      >
        <div
          className="flex min-h-[38px] items-center justify-center rounded-full border border-[rgba(168,109,69,0.22)] bg-[rgba(255,250,243,0.88)] px-4 py-2 text-center shadow-[0_10px_24px_rgba(74,57,38,0.08),inset_0_0_0_1px_rgba(255,255,255,0.35)]"
          style={{
            boxShadow: `0 10px 24px rgba(74, 57, 38, 0.08), 0 0 18px color-mix(in srgb, ${accent} 16%, transparent), inset 0 0 0 1px rgba(255, 255, 255, 0.35)`,
          }}
        >
          <span
            className={[
              "inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.34em] sm:text-[12px]",
              "transition-all duration-300 ease-out",
              phase === "enter" ? "opacity-100 translate-y-0" : phase === "exit" ? "opacity-0 translate-y-[-4px] blur-[1px]" : "opacity-95",
            ].join(" ")}
            style={{
              color: accent,
              textShadow: `0 0 6px color-mix(in srgb, ${accent} 40%, transparent), 0 0 16px color-mix(in srgb, ${accent} 18%, transparent)`,
            }}
          >
            <span
              className="inline-flex h-2 w-2 rounded-full"
              style={{
                backgroundColor: accent,
                boxShadow: `0 0 10px color-mix(in srgb, ${accent} 45%, transparent)`,
              }}
            />
            {current.text}
          </span>
        </div>
      </div>
    </div>
  );
}
