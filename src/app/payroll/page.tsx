"use client";

import * as React from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { format, parse } from "date-fns";
import { Banknote, CheckCircle2, Download, FileText, Loader2, Pencil, Play, Trash2, Users, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { EmptyState, FieldLabel, PageHeader, Panel, PersonAvatar, Segmented, Stat, StatGrid, StatusPill } from "@/components/page";
import { UpgradeNotice, api, inr, useApi } from "@/components/use-api";

type Tab = "runs" | "salaries" | "mine";
const TH = "h-10 px-6 text-left font-mono text-[11px] font-medium uppercase tracking-wider text-muted-foreground";
const ROW = "border-b last:border-0 hover:bg-secondary/40";
const monthLabel = (m: string) => format(parse(m, "yyyy-MM", new Date()), "MMMM yyyy");
const lastMonth = () => { const d = new Date(); d.setMonth(d.getMonth() - 1); return format(d, "yyyy-MM"); };

function SalaryDialog({ person, onClose, onSaved }: { person: any; onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast();
  const s = person.salaryStructure ?? {};
  const [form, setForm] = React.useState({
    annualCtc: s.annualCtc ?? "", basicPercent: s.basicPercent ?? 50, hraPercent: s.hraPercent ?? 40,
    pfEnabled: s.pfEnabled ?? true, pfCapped: s.pfCapped ?? true, esiEnabled: s.esiEnabled ?? true, ptEnabled: s.ptEnabled ?? true,
    taxRegime: s.taxRegime ?? "NEW", pan: s.pan ?? "", uan: s.uan ?? "", bankAccount: s.bankAccount ?? "", ifsc: s.ifsc ?? "",
  });
  const [saving, setSaving] = React.useState(false);
  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api(`/api/payroll/salaries/${person.id}`, {
        method: "PUT",
        json: {
          ...form, annualCtc: Number(form.annualCtc), basicPercent: Number(form.basicPercent), hraPercent: Number(form.hraPercent),
          pan: form.pan || null, uan: form.uan || null, bankAccount: form.bankAccount || null, ifsc: form.ifsc || null,
        },
      });
      toast({ title: "Salary saved", description: person.name });
      onSaved();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Not saved", description: err.message });
    } finally {
      setSaving(false);
    }
  };
  const toggles: [string, string][] = [["pfEnabled", "Provident fund"], ["pfCapped", "PF on wages capped at ₹15,000"], ["esiEnabled", "ESI (applies up to ₹21,000 gross)"], ["ptEnabled", "Professional tax"]];
  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={save} className="space-y-5">
          <DialogHeader>
            <DialogTitle>Salary: {person.name}</DialogTitle>
            <DialogDescription>Annual CTC includes employer PF and ESI. Basic is a share of monthly gross; HRA a share of basic.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2 sm:col-span-3"><FieldLabel htmlFor="ctc">Annual CTC (₹)</FieldLabel><Input id="ctc" type="number" min={1} required value={form.annualCtc} onChange={e => set("annualCtc", e.target.value)} /></div>
            <div className="space-y-2"><FieldLabel htmlFor="basic">Basic %</FieldLabel><Input id="basic" type="number" min={10} max={100} value={form.basicPercent} onChange={e => set("basicPercent", e.target.value)} /></div>
            <div className="space-y-2"><FieldLabel htmlFor="hra">HRA % of basic</FieldLabel><Input id="hra" type="number" min={0} max={100} value={form.hraPercent} onChange={e => set("hraPercent", e.target.value)} /></div>
            <div className="space-y-2">
              <FieldLabel>Tax regime</FieldLabel>
              <Select value={form.taxRegime} onValueChange={v => set("taxRegime", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="NEW">New</SelectItem><SelectItem value="OLD">Old</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-2">
            {toggles.map(([k, label]) => (
              <label key={k} className="flex items-center justify-between rounded-lg border px-4 py-2.5 text-sm">
                {label}<Switch checked={(form as any)[k]} onCheckedChange={v => set(k, v)} />
              </label>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {[["pan", "PAN", "ABCDE1234F"], ["uan", "UAN", "12 digits"], ["bankAccount", "Bank account", ""], ["ifsc", "IFSC", "HDFC0001234"]].map(([k, l, ph]) => (
              <div key={k} className="space-y-2"><FieldLabel htmlFor={k}>{l}</FieldLabel><Input id={k} placeholder={ph} value={(form as any)[k]} onChange={e => set(k, e.target.value)} /></div>
            ))}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save salary</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RunView({ runId, onChanged }: { runId: string; onChanged: () => void }) {
  const { toast } = useToast();
  const { data: run, reload, loading } = useApi<any>(`/api/payroll/runs/${runId}`);
  const [busy, setBusy] = React.useState<string | null>(null);
  const act = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(label);
    try { await fn(); await reload(); onChanged(); }
    catch (e: any) { toast({ variant: "destructive", title: "Not done", description: e.message }); }
    finally { setBusy(null); }
  };
  if (loading && !run) return <Panel><div className="flex items-center gap-2 p-8 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading run…</div></Panel>;
  if (!run) return null;
  const t = run.totals ?? {};
  return (
    <div className="space-y-6">
      <StatGrid>
        <Stat label="Employees" value={t.employees ?? 0} icon={Users} />
        <Stat label="Gross" value={inr(t.gross)} icon={Wallet} />
        <Stat label="Deductions" value={inr(t.deductions)} hint="PF · ESI · PT · TDS" />
        <Stat label="Net pay" value={inr(t.net)} hint={`Employer cost ${inr(t.employerCost)}`} tone="signal" icon={Banknote} />
      </StatGrid>
      <Panel
        title={`${monthLabel(run.month)} payroll`}
        description={run.status === "DRAFT" ? "Draft: rerun to pick up salary, leave or expense changes. Finalizing publishes payslips to employees." : run.status === "FINALIZED" ? "Payslips are published. Record the bank transfer when salaries go out." : `Paid ${run.paidAt ? format(new Date(run.paidAt), "d MMM yyyy") : ""}.`}
        actions={
          <>
            <StatusPill status={run.status === "DRAFT" ? "PENDING" : run.status === "PAID" ? "DONE" : "IN_PROGRESS"} label={run.status} />
            <Button asChild variant="outline" size="sm"><a href={`/api/payroll/runs/${run.id}/register`}><Download className="mr-2 h-4 w-4" />Register</a></Button>
            {run.status === "DRAFT" && (
              <>
                <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => act("delete", () => api(`/api/payroll/runs/${run.id}`, { method: "DELETE" }))} aria-label="Delete draft"><Trash2 className="h-4 w-4" /></Button>
                <Button size="sm" disabled={!!busy} onClick={() => act("finalize", () => api(`/api/payroll/runs/${run.id}`, { method: "PATCH", json: { action: "finalize" } }))}>
                  {busy === "finalize" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}Finalize and publish
                </Button>
              </>
            )}
            {run.status === "FINALIZED" && (
              <Button size="sm" disabled={!!busy} onClick={() => act("pay", () => api(`/api/payroll/runs/${run.id}`, { method: "PATCH", json: { action: "pay" } }))}>
                {busy === "pay" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Mark paid
              </Button>
            )}
          </>
        }
        bodyClassName="p-0"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40"><tr>{["Employee", "Paid days", "LOP", "Gross", "Deductions", "Reimbursed", "Net", ""].map(h => <th key={h} className={TH}>{h}</th>)}</tr></thead>
            <tbody>
              {run.payslips.map((p: any) => (
                <tr key={p.id} className={ROW}>
                  <td className="px-6 py-3"><div className="flex items-center gap-3"><PersonAvatar name={p.user.name} image={p.user.image} size="sm" /><div><p className="font-medium">{p.user.name}</p><p className="font-mono text-[11px] text-muted-foreground">{p.user.profile?.employeeId}</p></div></div></td>
                  <td className="px-6 py-3 tabular-nums">{p.paidDays}</td>
                  <td className="px-6 py-3 tabular-nums">{p.lopDays || "—"}</td>
                  <td className="px-6 py-3 tabular-nums">{inr(p.gross)}</td>
                  <td className="px-6 py-3 tabular-nums">{inr(p.totalDeductions)}</td>
                  <td className="px-6 py-3 tabular-nums">{p.reimbursements ? inr(p.reimbursements) : "—"}</td>
                  <td className="px-6 py-3 font-semibold tabular-nums">{inr(p.net)}</td>
                  <td className="px-6 py-3 text-right"><Link href={`/payroll/payslips/${p.id}`} className="text-signal hover:underline">Payslip</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function RunsTab() {
  const { toast } = useToast();
  const runs = useApi<any[]>("/api/payroll/runs");
  const [month, setMonth] = React.useState(lastMonth);
  const [selected, setSelected] = React.useState<string | null>(null);
  const [processing, setProcessing] = React.useState(false);
  React.useEffect(() => { if (!selected && runs.data?.length) setSelected(runs.data[0].id); }, [runs.data, selected]);

  const process = async () => {
    setProcessing(true);
    try {
      const run = await api("/api/payroll/runs", { method: "POST", json: { month } });
      toast({ title: "Payroll calculated", description: `${monthLabel(month)}: ${run.payslips.length} payslips in draft.` });
      await runs.reload();
      setSelected(run.id);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Payroll not run", description: e.message });
    } finally {
      setProcessing(false);
    }
  };

  if (runs.error?.status === 402) return <UpgradeNotice error={runs.error} isAdmin />;
  return (
    <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
      <div className="space-y-4">
        <Panel title="Run payroll" description="Calculates every employee with a salary, prorated for unpaid leave.">
          <div className="space-y-3 p-6">
            <FieldLabel htmlFor="run-month">Month</FieldLabel>
            <Input id="run-month" type="month" value={month} onChange={e => setMonth(e.target.value)} />
            <Button className="w-full" onClick={process} disabled={processing}>{processing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}Calculate</Button>
            <Button asChild variant="ghost" className="w-full"><a href={`/api/payroll/export?month=${month}`}><Download className="mr-2 h-4 w-4" />Attendance summary CSV</a></Button>
          </div>
        </Panel>
        <Panel title="History" bodyClassName="p-0">
          {(runs.data ?? []).length === 0 ? <p className="p-6 text-sm text-muted-foreground">No payroll runs yet.</p> : (
            <ul>
              {runs.data!.map(r => (
                <li key={r.id}>
                  <button onClick={() => setSelected(r.id)} className={`flex w-full items-center justify-between border-b px-6 py-3 text-left text-sm last:border-0 hover:bg-secondary/40 ${selected === r.id ? "bg-secondary/60" : ""}`}>
                    <span className="font-medium">{monthLabel(r.month)}</span>
                    <StatusPill status={r.status === "DRAFT" ? "PENDING" : r.status === "PAID" ? "DONE" : "IN_PROGRESS"} label={r.status} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
      <div className="min-w-0">
        {selected ? <RunView key={selected} runId={selected} onChanged={runs.reload} /> : (
          <Panel><EmptyState icon={Banknote} title="No run selected" description="Pick a month and calculate. Nothing reaches employees until you finalize." /></Panel>
        )}
      </div>
    </div>
  );
}

function SalariesTab() {
  const list = useApi<any[]>("/api/payroll/salaries");
  const [editing, setEditing] = React.useState<any | null>(null);
  if (list.error?.status === 402) return <UpgradeNotice error={list.error} isAdmin />;
  const missing = (list.data ?? []).filter(p => !p.salaryStructure).length;
  return (
    <Panel title="Salary structures" description={missing ? `${missing} active employee${missing === 1 ? " has" : "s have"} no salary yet and will be left out of payroll.` : "Everyone active has a salary structure."} bodyClassName="p-0">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-secondary/40"><tr>{["Employee", "Department", "Annual CTC", "Monthly gross", "Regime", ""].map(h => <th key={h} className={TH}>{h}</th>)}</tr></thead>
          <tbody>
            {(list.data ?? []).map(p => (
              <tr key={p.id} className={ROW}>
                <td className="px-6 py-3"><div className="flex items-center gap-3"><PersonAvatar name={p.name} image={p.image} size="sm" /><div><p className="font-medium">{p.name}</p><p className="text-xs text-muted-foreground">{p.email}</p></div></div></td>
                <td className="px-6 py-3 text-muted-foreground">{p.profile?.department ?? "—"}</td>
                <td className="px-6 py-3 tabular-nums">{p.salaryStructure ? inr(p.salaryStructure.annualCtc) : <StatusPill status="PENDING" label="Not set" />}</td>
                <td className="px-6 py-3 tabular-nums">{inr(p.monthlyGross)}</td>
                <td className="px-6 py-3 font-mono text-xs">{p.salaryStructure?.taxRegime ?? "—"}</td>
                <td className="px-6 py-3 text-right"><Button size="sm" variant="ghost" onClick={() => setEditing(p)}><Pencil className="mr-2 h-3.5 w-3.5" />{p.salaryStructure ? "Edit" : "Set salary"}</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editing && <SalaryDialog person={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); list.reload(); }} />}
    </Panel>
  );
}

function MyPayslips() {
  const { data, error, loading } = useApi<any[]>("/api/payroll/payslips");
  if (error?.status === 402) return <UpgradeNotice error={error} />;
  return (
    <Panel title="My payslips" bodyClassName="p-0">
      {loading ? <p className="p-6 text-sm text-muted-foreground">Loading…</p> : !data?.length ? (
        <EmptyState icon={FileText} title="No payslips yet" description="Payslips appear here once HR finalizes a payroll run." />
      ) : (
        <ul>
          {data.map(p => (
            <li key={p.id} className="flex items-center justify-between border-b px-6 py-4 last:border-0 hover:bg-secondary/40">
              <div><p className="font-medium">{monthLabel(p.month)}</p><p className="font-mono-label text-muted-foreground">Gross {inr(p.gross)}</p></div>
              <div className="flex items-center gap-6"><span className="text-lg font-semibold tabular-nums">{inr(p.net)}</span><Link href={`/payroll/payslips/${p.id}`} className="text-sm text-signal hover:underline">View</Link></div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

export default function PayrollPage() {
  const { data: session } = useSession();
  const isHr = ["ADMIN", "HR"].includes(session?.user?.role ?? "");
  const [tab, setTab] = React.useState<Tab>("runs");
  const current: Tab = isHr ? tab : "mine";
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Workforce · Payroll"
        title="Payroll"
        description={isHr ? "Monthly runs with PF, ESI, professional tax and TDS, prorated for unpaid leave, with approved expenses reimbursed." : "Your monthly payslips."}
        actions={isHr && <Segmented value={tab} onChange={setTab} options={[{ value: "runs", label: "Runs" }, { value: "salaries", label: "Salaries" }, { value: "mine", label: "My payslips" }]} />}
      />
      {current === "runs" && <RunsTab />}
      {current === "salaries" && <SalariesTab />}
      {current === "mine" && <MyPayslips />}
      <p className="font-mono-label text-muted-foreground">Tax is estimated under FY 2025-26 rules without investment declarations. Check figures with your payroll accountant before paying.</p>
    </div>
  );
}
