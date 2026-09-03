"use client";

import React from "react";
import Link from "next/link";
import type { ConfidenceBand, FieldSource } from "@/lib/types";

/* -------------------------------------------------------------------------- */
/* Primitives                                                                  */
/* -------------------------------------------------------------------------- */

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "amber";
type ButtonSize = "sm" | "md" | "lg";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-accent-600 text-white border-accent-600 hover:bg-accent-700 hover:border-accent-700 disabled:bg-navy-200 disabled:border-navy-200",
  secondary:
    "bg-white text-navy-700 border-line-strong hover:border-navy-300 hover:bg-ivory-50 disabled:text-navy-300",
  ghost:
    "bg-transparent text-navy-500 border-transparent hover:bg-ivory-200 hover:text-navy-700 disabled:text-navy-300",
  danger:
    "bg-white text-danger-700 border-danger-200 hover:bg-danger-50 disabled:text-navy-300",
  amber: "bg-amber-400 text-white border-amber-400 hover:bg-amber-500 hover:border-amber-500",
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-[13px] gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-12 px-6 text-[15px] gap-2",
};

export function Button({
  variant = "secondary",
  size = "md",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return (
    <button
      {...props}
      className={cx(
        "inline-flex items-center justify-center rounded-lg border font-medium transition-colors disabled:cursor-not-allowed",
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        className,
      )}
    />
  );
}

export function LinkButton({
  href,
  variant = "secondary",
  size = "md",
  className,
  children,
  ...props
}: React.ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return (
    <Link
      href={href}
      {...props}
      className={cx(
        "inline-flex items-center justify-center rounded-lg border font-medium transition-colors",
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        className,
      )}
    >
      {children}
    </Link>
  );
}

export function Card({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...props} className={cx("card", className)}>
      {children}
    </div>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-prose">
        {eyebrow ? <p className="eyebrow mb-2">{eyebrow}</p> : null}
        <h2 className="font-serif text-[26px] leading-tight text-navy-800">{title}</h2>
        {description ? (
          <p className="mt-2 text-sm leading-relaxed text-navy-400">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Badges                                                                      */
/* -------------------------------------------------------------------------- */

type BadgeTone = "neutral" | "accent" | "amber" | "success" | "danger" | "outline";

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: "bg-navy-50 text-navy-500 border-navy-100",
  accent: "bg-accent-50 text-accent-700 border-accent-100",
  amber: "bg-amber-50 text-amber-600 border-amber-100",
  success: "bg-success-50 text-success-700 border-success-200",
  danger: "bg-danger-50 text-danger-700 border-danger-200",
  outline: "bg-transparent text-navy-400 border-line-strong",
};

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-pill border px-2.5 py-0.5 text-2xs font-semibold uppercase tracking-[0.08em]",
        BADGE_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

const BAND_TONE: Record<ConfidenceBand, BadgeTone> = {
  high: "success",
  moderate: "amber",
  low: "danger",
};

export function ConfidencePill({
  confidence,
  band,
  label = "confidence",
}: {
  confidence: number;
  band: ConfidenceBand;
  label?: string;
}) {
  return (
    <Badge tone={BAND_TONE[band]}>
      <span className="tnum">{Math.round(confidence * 100)}%</span>
      <span className="opacity-70">{band}</span>
      <span className="sr-only">{label}</span>
    </Badge>
  );
}

/** Keeps user-supplied data and machine guesses visually separate, everywhere. */
export function SourceTag({ source }: { source: FieldSource }) {
  if (source === "inferred") {
    return (
      <Badge tone="amber" className="normal-case tracking-normal">
        Inferred
      </Badge>
    );
  }
  if (source === "demo") {
    return (
      <Badge tone="outline" className="normal-case tracking-normal">
        Demo data
      </Badge>
    );
  }
  return (
    <Badge tone="accent" className="normal-case tracking-normal">
      You provided
    </Badge>
  );
}

/* -------------------------------------------------------------------------- */
/* Callouts                                                                    */
/* -------------------------------------------------------------------------- */

type CalloutTone = "info" | "warning" | "danger" | "success" | "quiet";

const CALLOUT_TONES: Record<CalloutTone, string> = {
  info: "border-accent-100 bg-accent-50/60 text-navy-700",
  warning: "border-amber-200 bg-amber-50 text-navy-700",
  danger: "border-danger-200 bg-danger-50 text-navy-700",
  success: "border-success-200 bg-success-50 text-navy-700",
  quiet: "border-line bg-ivory-50 text-navy-500",
};

export function Callout({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: CalloutTone;
  title?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("rounded-card border px-4 py-3 text-sm leading-relaxed", CALLOUT_TONES[tone], className)}>
      {title ? <p className="mb-1 font-semibold text-navy-800">{title}</p> : null}
      {children}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Metrics                                                                     */
/* -------------------------------------------------------------------------- */

export function Stat({
  label,
  value,
  sub,
  delta,
  tone = "neutral",
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  delta?: { text: string; direction: "up" | "down" | "flat" };
  tone?: "neutral" | "accent" | "warning";
}) {
  return (
    <div
      className={cx(
        "rounded-card border px-4 py-3",
        tone === "accent"
          ? "border-accent-100 bg-accent-50/50"
          : tone === "warning"
            ? "border-amber-200 bg-amber-50"
            : "border-line bg-white",
      )}
    >
      <p className="eyebrow">{label}</p>
      <p className="tnum mt-1.5 font-serif text-2xl leading-none text-navy-800">{value}</p>
      {delta ? (
        <p
          className={cx(
            "tnum mt-1.5 text-xs font-medium",
            delta.direction === "up"
              ? "text-success-700"
              : delta.direction === "down"
                ? "text-danger-700"
                : "text-navy-400",
          )}
        >
          {delta.text}
        </p>
      ) : null}
      {sub ? <p className="mt-1.5 text-xs leading-relaxed text-navy-400">{sub}</p> : null}
    </div>
  );
}

export function Meter({
  value,
  tone = "accent",
  className,
}: {
  value: number;
  tone?: "accent" | "amber" | "success" | "danger" | "navy";
  className?: string;
}) {
  const colours = {
    accent: "bg-accent-500",
    amber: "bg-amber-400",
    success: "bg-success-500",
    danger: "bg-danger-500",
    navy: "bg-navy-400",
  };
  return (
    <div className={cx("h-1.5 w-full overflow-hidden rounded-pill bg-navy-100", className)}>
      <div
        className={cx("h-full rounded-pill transition-[width] duration-500", colours[tone])}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Form controls                                                               */
/* -------------------------------------------------------------------------- */

export function Field({
  label,
  hint,
  suffix,
  children,
  htmlFor,
}: {
  label: string;
  hint?: React.ReactNode;
  suffix?: React.ReactNode;
  children: React.ReactNode;
  htmlFor?: string;
}) {
  return (
    <label className="block" htmlFor={htmlFor}>
      <span className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-[13px] font-medium text-navy-600">{label}</span>
        {suffix}
      </span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-navy-400">{hint}</span> : null}
    </label>
  );
}

const INPUT_CLASS =
  "w-full rounded-lg border border-line-strong bg-white px-3 py-2 text-sm text-navy-800 placeholder:text-navy-300 transition-colors hover:border-navy-300 focus:border-accent-400";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(INPUT_CLASS, "tnum", className)} />;
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cx(INPUT_CLASS, "leading-relaxed", className)} />;
}

export function Select({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={cx(INPUT_CLASS, "appearance-none pr-8", className)}>
      {children}
    </select>
  );
}

/* -------------------------------------------------------------------------- */
/* Disclosure                                                                  */
/* -------------------------------------------------------------------------- */

export function Disclosure({
  summary,
  children,
  defaultOpen = false,
  onToggle,
  className,
}: {
  summary: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  onToggle?: (open: boolean) => void;
  className?: string;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => {
          setOpen((o) => {
            onToggle?.(!o);
            return !o;
          });
        }}
        className="flex w-full items-center gap-2 text-left text-[13px] font-medium text-navy-500 transition-colors hover:text-navy-700"
        aria-expanded={open}
      >
        <Chevron open={open} />
        {summary}
      </button>
      {open ? <div className="mt-3 animate-fade-up">{children}</div> : null}
    </div>
  );
}

export function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      aria-hidden
      className={cx("shrink-0 transition-transform duration-200", open && "rotate-90")}
    >
      <path d="M4 2.5 8 6l-4 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/* Modal                                                                       */
/* -------------------------------------------------------------------------- */

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 no-print">
      <div
        className="absolute inset-0 bg-navy-900/25 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative w-full max-w-lg animate-fade-up rounded-card border border-line bg-white p-6 shadow-lift"
      >
        <h3 className="font-serif text-xl text-navy-800">{title}</h3>
        {description ? (
          <p className="mt-1.5 text-sm leading-relaxed text-navy-400">{description}</p>
        ) : null}
        {children ? <div className="mt-4">{children}</div> : null}
        {footer ? <div className="mt-6 flex justify-end gap-2">{footer}</div> : null}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Loading & empty states                                                      */
/* -------------------------------------------------------------------------- */

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cx(
        "relative overflow-hidden rounded-lg bg-ivory-200",
        "after:absolute after:inset-0 after:animate-shimmer after:bg-gradient-to-r after:from-transparent after:via-white/70 after:to-transparent",
        className,
      )}
    />
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <Card className="px-6 py-12 text-center">
      <h3 className="font-serif text-xl text-navy-800">{title}</h3>
      <p className="mx-auto mt-2 max-w-prose text-sm leading-relaxed text-navy-400">{description}</p>
      {action ? <div className="mt-6 flex justify-center gap-2">{action}</div> : null}
    </Card>
  );
}

/** The question every screen has to answer, printed on every screen. */
export function DecisionBanner({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-card border border-line bg-white px-4 py-3">
      <span className="mt-0.5 shrink-0 rounded-pill bg-navy-800 px-2 py-0.5 text-2xs font-semibold uppercase tracking-[0.1em] text-ivory-100">
        Decision
      </span>
      <p className="text-sm leading-relaxed text-navy-600">{children}</p>
    </div>
  );
}
