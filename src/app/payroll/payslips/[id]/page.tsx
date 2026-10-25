"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { format, parse } from "date-fns";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UpgradeNotice, inr, useApi } from "@/components/use-api";

type Line = { code: string; label: string; amount: number };

function Lines({ title, lines, total, totalLabel }: { title: string; lines: Line[]; total: number; totalLabel: string }) {
  return (
    <div>
      <p className="font-mono-label border-b pb-2 text-muted-foreground">{title}</p>
      <table className="w-full text-sm">
        <tbody>
          {lines.map(l => (
            <tr key={l.code} className="border-b border-dashed last:border-0"><td className="py-2">{l.label}</td><td className="py-2 text-right tabular-nums">{inr(l.amount)}</td></tr>
          ))}
          <tr className="font-semibold"><td className="pt-3">{totalLabel}</td><td className="pt-3 text-right tabular-nums">{inr(total)}</td></tr>
        </tbody>
      </table>
    </div>
  );
}

/** Printable payslip. Use the browser's Print → Save as PDF. */
export default function PayslipPage() {
  const { id } = useParams<{ id: string }>();
  const { data: p, error, loading } = useApi<any>(`/api/payroll/payslips/${id}`);
  if (error?.status === 402) return <UpgradeNotice error={error} />;
  if (error) return <p className="text-destructive">{error.message}</p>;
  if (loading || !p) return <p className="text-muted-foreground">Loading payslip…</p>;

  const u = p.user;
  const month = format(parse(p.month, "yyyy-MM", new Date()), "MMMM yyyy");
  const facts: [string, React.ReactNode][] = [
    ["Employee ID", u.profile?.employeeId ?? "—"], ["Department", u.profile?.department ?? "—"], ["Designation", u.profile?.designation ?? "—"],
    ["Date of joining", u.profile?.dateOfJoining ? format(new Date(u.profile.dateOfJoining), "d MMM yyyy") : "—"],
    ["PAN", u.salaryStructure?.pan ?? "—"], ["UAN", u.salaryStructure?.uan ?? "—"], ["Bank account", u.salaryStructure?.bankAccount ?? "—"],
    ["Paid days", `${p.paidDays}${p.lopDays ? ` (LOP ${p.lopDays})` : ""}`], ["Tax regime", u.salaryStructure?.taxRegime ?? "NEW"],
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between print:hidden">
        <Button asChild variant="ghost" size="sm"><Link href="/payroll"><ArrowLeft className="mr-2 h-4 w-4" />Payroll</Link></Button>
        <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />Print or save PDF</Button>
      </div>
      <article className="rounded-2xl border bg-card p-8 shadow-sm print:border-0 print:p-0 print:shadow-none sm:p-10">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b pb-6">
          <div>
            <p className="font-mono-label text-muted-foreground">{p.organization.name}</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Payslip · {month}</h1>
          </div>
          {!p.published && <span className="rounded-md bg-amber-500/10 px-2 py-1 font-mono text-[11px] uppercase text-amber-700 dark:text-amber-400">Draft</span>}
        </header>
        <section className="grid gap-x-8 gap-y-3 border-b py-6 sm:grid-cols-3">
          <div className="sm:col-span-3"><p className="text-lg font-medium">{u.name}</p><p className="text-sm text-muted-foreground">{u.email}</p></div>
          {facts.map(([k, v]) => (<div key={k}><p className="font-mono-label text-muted-foreground">{k}</p><p className="mt-1 text-sm">{v}</p></div>))}
        </section>
        <section className="grid gap-8 py-6 sm:grid-cols-2">
          <Lines title="Earnings" lines={p.earnings} total={p.gross} totalLabel="Gross earnings" />
          <Lines title="Deductions" lines={p.deductions} total={p.totalDeductions} totalLabel="Total deductions" />
        </section>
        {p.reimbursements > 0 && <p className="border-t py-4 text-sm">Expense reimbursements (not taxed): <span className="font-semibold tabular-nums">{inr(p.reimbursements)}</span></p>}
        <section className="grain relative overflow-hidden rounded-xl bg-[hsl(228_45%_6%)] p-6 text-[hsl(225_38%_95%)] print:bg-transparent print:text-black">
          <p className="font-mono-label text-white/50 print:text-black/60">Net pay</p>
          <p className="mt-2 text-5xl font-semibold tabular-nums tracking-tight">{inr(p.net)}</p>
        </section>
        {p.employerContributions?.length > 0 && (
          <p className="mt-6 text-xs text-muted-foreground">
            Employer contributions (part of CTC, not paid out): {p.employerContributions.map((c: Line) => `${c.label} ${inr(c.amount)}`).join(" · ")}
          </p>
        )}
        <p className="mt-2 text-xs text-muted-foreground">Computer-generated payslip. TDS is an estimate before investment declarations.</p>
      </article>
    </div>
  );
}
