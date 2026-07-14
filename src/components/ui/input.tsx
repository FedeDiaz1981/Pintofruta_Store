import type { InputHTMLAttributes } from "react";
import { forwardRef } from "react";

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className = "", ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      className={[
        "h-11 w-full rounded-full border border-[var(--pf-border)] bg-[rgba(255,255,255,0.88)] px-4 text-[15px] text-[var(--pf-text)] shadow-[0_10px_24px_rgba(74,57,38,0.08)] outline-none placeholder:text-[var(--pf-muted)] focus:border-[rgba(168,109,69,0.35)] focus:ring-2 focus:ring-[rgba(168,109,69,0.14)]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    />
  );
});
