import type { ReactNode } from "react";

export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 border-b border-[rgba(168,109,69,0.16)] pb-4 sm:flex-row sm:items-end sm:justify-between sm:gap-6 sm:pb-5">
      <div className="max-w-2xl">
        <div className="flex items-center gap-3">
          <span className="h-[1px] w-8 bg-[rgba(168,109,69,0.48)]" />
          <p className="text-[11px] font-black uppercase tracking-[0.38em] text-[var(--pf-secondary)]">{eyebrow}</p>
        </div>
        <h2 className="mt-3 text-3xl font-extrabold tracking-[-0.05em] text-[var(--pf-text)] sm:text-5xl">{title}</h2>
        {description ? <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--pf-muted)]">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
