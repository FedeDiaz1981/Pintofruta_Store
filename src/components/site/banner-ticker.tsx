"use client";

import { useEffect, useMemo, useState } from "react";

export function BannerTicker({ texts }: { texts: string[] }) {
  const items = useMemo(() => texts.map((text) => text.trim()).filter(Boolean), [texts]);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<"enter" | "exit">("enter");

  useEffect(() => {
    if (items.length <= 1) {
      return;
    }

    let timeout: number | undefined;
    const interval = window.setInterval(() => {
      setPhase("exit");
      timeout = window.setTimeout(() => {
        setIndex((current) => (current + 1) % items.length);
        setPhase("enter");
      }, 320);
    }, 5000);

    return () => {
      window.clearInterval(interval);
      if (timeout) {
        window.clearTimeout(timeout);
      }
    };
  }, [items.length]);

  if (items.length === 0) {
    return null;
  }

  const current = items[index % items.length];

  return (
    <div className="overflow-hidden rounded-full border border-[rgba(255,220,184,0.26)] bg-[linear-gradient(90deg,#5e2f1f_0%,#8f5a35_42%,#b87f54_72%,#6f4528_100%)] px-4 py-2 text-center shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_0_22px_rgba(168,109,69,0.28),inset_0_0_24px_rgba(255,214,163,0.06)]">
      <div
        className={`inline-flex min-h-[1.5rem] items-center justify-center gap-3 text-[11px] font-black uppercase tracking-[0.24em] text-[#fff5e8] transition-all duration-500 ease-out sm:text-xs ${
          phase === "enter" ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-1 scale-95"
        }`}
        aria-live="polite"
        aria-atomic="true"
      >
        <span className="h-2 w-2 rounded-full bg-[#ffd59b] shadow-[0_0_12px_rgba(255,213,155,0.8)]" />
        <span className="drop-shadow-[0_0_12px_rgba(255,235,205,0.55)]">{current}</span>
        <span className="h-2 w-2 rounded-full bg-[#ffd59b] shadow-[0_0_12px_rgba(255,213,155,0.8)]" />
      </div>
    </div>
  );
}
