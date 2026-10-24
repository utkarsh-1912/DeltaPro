"use client";

import * as React from "react";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { EASE } from "@/components/motion";

/** Editorial page header: mono eyebrow, large title, description and right-aligned actions. */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-col gap-6 border-b pb-8 md:flex-row md:items-end md:justify-between", className)}>
      <div className="min-w-0">
        {eyebrow && <p className="font-mono-label text-muted-foreground">{eyebrow}</p>}
        <h1 className="mt-3 text-4xl font-semibold leading-[1] tracking-tight sm:text-5xl">{title}</h1>
        {description && <p className="mt-3 max-w-2xl text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/** Hairline-divided strip of KPIs. */
export function StatGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  const count = React.Children.count(children);
  return (
    <div
      className={cn(
        "grid gap-px overflow-hidden rounded-2xl border bg-border",
        count >= 4 ? "sm:grid-cols-2 lg:grid-cols-4" : count === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2",
        className
      )}
    >
      {children}
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
  icon: Icon,
  progress,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: LucideIcon;
  progress?: number;
  tone?: "default" | "signal" | "warn" | "danger" | "ok";
}) {
  const toneClass = {
    default: "text-muted-foreground",
    signal: "text-signal",
    warn: "text-amber-600 dark:text-amber-400",
    danger: "text-destructive",
    ok: "text-emerald-600 dark:text-emerald-400",
  }[tone];
  return (
    <div className="relative bg-card p-6">
      <div className="flex items-center justify-between">
        <p className="font-mono-label text-muted-foreground">{label}</p>
        {Icon && <Icon className={cn("h-4 w-4", toneClass)} />}
      </div>
      <p className="mt-4 text-4xl font-semibold tabular-nums tracking-tight">{value}</p>
      {hint && <p className={cn("font-mono-label mt-2", toneClass)}>{hint}</p>}
      {progress !== undefined && (
        <div className="mt-4 h-1 overflow-hidden rounded-full bg-secondary">
          <motion.div
            className="h-full origin-left bg-signal"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: Math.max(0, Math.min(1, progress / 100)) }}
            transition={{ duration: 1.1, ease: EASE }}
          />
        </div>
      )}
    </div>
  );
}

/** Bordered section with a title row. */
export function Panel({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("overflow-hidden rounded-2xl border bg-card", className)}>
      {(title || actions) && (
        <div className="flex flex-wrap items-start justify-between gap-4 border-b px-6 py-5">
          <div>
            {title && <h2 className="text-lg font-semibold tracking-tight">{title}</h2>}
            {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-16 text-center", className)}>
      {Icon && (
        <div className="dotgrid mb-5 flex h-14 w-14 items-center justify-center rounded-xl border bg-card">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
      )}
      <p className="font-medium">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

const STATUS_TONES: Record<string, string> = {
  APPROVED: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 ring-emerald-500/20",
  DONE: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 ring-emerald-500/20",
  ONLINE: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 ring-emerald-500/20",
  ACTIVE: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 ring-emerald-500/20",
  PENDING: "bg-amber-500/10 text-amber-700 dark:text-amber-400 ring-amber-500/20",
  IN_PROGRESS: "bg-signal/10 text-signal ring-signal/25",
  REJECTED: "bg-destructive/10 text-destructive ring-destructive/20",
  CANCELLED: "bg-secondary text-muted-foreground ring-border",
  OFFLINE: "bg-secondary text-muted-foreground ring-border",
};

/** Small mono status chip with a leading dot. */
export function StatusPill({ status, label, className }: { status: string; label?: string; className?: string }) {
  const key = status?.toUpperCase?.() ?? "";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 font-mono text-[11px] font-medium uppercase tracking-wider ring-1 ring-inset",
        STATUS_TONES[key] ?? "bg-secondary text-muted-foreground ring-border",
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full bg-current", key === "ONLINE" && "animate-pulse")} />
      {label ?? key.replace(/_/g, " ")}
    </span>
  );
}

/** Mono uppercase form label. */
export function FieldLabel({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="font-mono-label block text-muted-foreground">
      {children}
    </label>
  );
}

/** Segmented control, used in place of pill tab lists for small option sets. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  disabled,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; icon?: LucideIcon }[];
  disabled?: boolean;
}) {
  const id = React.useId();
  return (
    <div className={cn("inline-flex rounded-lg border bg-secondary p-1", disabled && "opacity-60")}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(o.value)}
          className={cn(
            "relative flex h-8 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors disabled:cursor-not-allowed",
            value === o.value ? "text-foreground" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {value === o.value && (
            <motion.span layoutId={`seg-${id}`} className="absolute inset-0 rounded-md bg-card shadow-sm" transition={{ type: "spring", stiffness: 500, damping: 38 }} />
          )}
          {o.icon && <o.icon className="relative h-4 w-4" />}
          <span className="relative">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

/** Round avatar with initials fallback. */
export function PersonAvatar({ name, image, size = "md", className }: { name?: string | null; image?: string | null; size?: "sm" | "md" | "lg" | "xl"; className?: string }) {
  const initials = (name || "?").trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  const dim = { sm: "h-8 w-8 text-[11px]", md: "h-10 w-10 text-xs", lg: "h-14 w-14 text-sm", xl: "h-20 w-20 text-lg" }[size];
  return image ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={image} alt="" className={cn("shrink-0 rounded-full border object-cover", dim, className)} />
  ) : (
    <div className={cn("flex shrink-0 items-center justify-center rounded-full border bg-secondary font-medium", dim, className)}>{initials}</div>
  );
}

/** Download rows as CSV in the browser. */
export function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
