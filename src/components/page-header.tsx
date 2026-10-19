"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { EASE } from "@/components/motion";
import { cn } from "@/lib/utils";

/** Standard header for app screens: mono eyebrow, condensed display title, description, actions. */
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
    <div className={cn("flex flex-col gap-5 border-b pb-6 md:flex-row md:items-end md:justify-between", className)}>
      <div className="min-w-0">
        {eyebrow && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }} className="eyebrow mb-3">
            {eyebrow}
          </motion.p>
        )}
        <h1 className="page-title overflow-hidden pb-1">
          <motion.span className="inline-block" initial={{ y: "105%" }} animate={{ y: 0 }} transition={{ duration: 0.8, ease: EASE }}>
            {title}
          </motion.span>
        </h1>
        {description && (
          <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.15, ease: EASE }} className="mt-3 max-w-2xl text-muted-foreground">
            {description}
          </motion.p>
        )}
      </div>
      {actions && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2, ease: EASE }} className="flex flex-wrap items-center gap-2">
          {actions}
        </motion.div>
      )}
    </div>
  );
}

/** KPI tile: mono label, condensed figure, optional hint coloured by tone. */
export function StatTile({
  label,
  value,
  hint,
  tone = "default",
  icon: Icon,
  href,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: "default" | "good" | "warn" | "bad";
  icon?: React.ComponentType<{ className?: string }>;
  href?: string;
}) {
  const toneClass = { default: "text-muted-foreground", good: "text-success", warn: "text-warning", bad: "text-destructive" }[tone];
  const body = (
    <div className="group surface relative h-full overflow-hidden p-5 transition-colors hover:border-foreground/25">
      <div className="flex items-start justify-between gap-3">
        <p className="eyebrow">{label}</p>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground transition-transform duration-300 group-hover:-translate-y-0.5" />}
      </div>
      <p className="kpi mt-6">{value}</p>
      {hint && <p className={cn("mt-2 font-mono text-[11px] uppercase tracking-[0.1em]", toneClass)}>{hint}</p>}
    </div>
  );
  return href ? (
    <Link href={href} className="block h-full rounded-[var(--radius)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      {body}
    </Link>
  ) : body;
}

/** Card with a mono-labelled header row used across dashboard widgets. */
export function Panel({ title, action, children, className }: { title: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("surface flex flex-col overflow-hidden", className)}>
      <div className="flex items-center justify-between gap-3 border-b px-5 py-3.5">
        <h2 className="eyebrow text-foreground">{title}</h2>
        {action}
      </div>
      <div className="flex-1">{children}</div>
    </section>
  );
}
