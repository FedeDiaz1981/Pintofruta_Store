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
    <div className="flex flex-col gap-4 rounded-[2rem] border border-base-300/80 bg-base-100/80 p-6 shadow-sm sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        <p className="text-xs font-bold uppercase tracking-[0.32em] text-secondary">{eyebrow}</p>
        <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-base-content sm:text-5xl">{title}</h2>
        {description ? <p className="mt-3 max-w-2xl text-sm leading-7 text-base-content/70">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
