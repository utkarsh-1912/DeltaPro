"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { format } from "date-fns";
import { Check, Loader2, Paperclip, Plus, Receipt, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { EmptyState, FieldLabel, PageHeader, Panel, PersonAvatar, Segmented, Stat, StatGrid, StatusPill } from "@/components/page";
import { UpgradeNotice, api, inr, useApi } from "@/components/use-api";

const CATEGORIES = ["TRAVEL", "MEALS", "LODGING", "SUPPLIES", "INTERNET", "TRAINING", "OTHER"];
const TH = "h-10 px-6 text-left font-mono text-[11px] font-medium uppercase tracking-wider text-muted-foreground";
const ROW = "border-b last:border-0 hover:bg-secondary/40";
const pillStatus = (s: string) => (s === "SUBMITTED" ? "PENDING" : s === "REIMBURSED" ? "DONE" : s);

function NewClaim({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = React.useState({ title: "", category: "TRAVEL", amount: "", spentOn: format(new Date(), "yyyy-MM-dd"), description: "" });
  const [file, setFile] = React.useState<File | null>(null);
  const [saving, setSaving] = React.useState(false);
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      let receiptId: string | null = null;
      if (file) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("category", "RECEIPT");
        fd.append("title", `Receipt: ${form.title}`);
        receiptId = (await api("/api/documents", { method: "POST", body: fd })).id;
      }
      await api("/api/expenses", { method: "POST", json: { ...form, amount: Number(form.amount), description: form.description || null, receiptId } });
      toast({ title: "Claim submitted", description: "Your manager has been notified." });
      onSaved();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Not submitted", description: err.message });
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader><DialogTitle>New expense claim</DialogTitle><DialogDescription>Approved claims are paid with the next payroll.</DialogDescription></DialogHeader>
          <div className="space-y-2"><FieldLabel htmlFor="ex-title">What was it for</FieldLabel><Input id="ex-title" required minLength={2} value={form.title} onChange={e => set("title", e.target.value)} placeholder="Client visit, cab to airport" /></div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2"><FieldLabel>Category</FieldLabel>
              <Select value={form.category} onValueChange={v => set("category", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c.charAt(0) + c.slice(1).toLowerCase()}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><FieldLabel htmlFor="ex-amount">Amount (₹)</FieldLabel><Input id="ex-amount" type="number" min={1} step="0.01" required value={form.amount} onChange={e => set("amount", e.target.value)} /></div>
            <div className="space-y-2"><FieldLabel htmlFor="ex-date">Date</FieldLabel><Input id="ex-date" type="date" required max={format(new Date(), "yyyy-MM-dd")} value={form.spentOn} onChange={e => set("spentOn", e.target.value)} /></div>
          </div>
          <div className="space-y-2"><FieldLabel htmlFor="ex-desc">Notes</FieldLabel><Textarea id="ex-desc" rows={2} value={form.description} onChange={e => set("description", e.target.value)} /></div>
          <div className="space-y-2">
            <FieldLabel htmlFor="ex-file">Receipt</FieldLabel>
            <Input id="ex-file" type="file" accept="application/pdf,image/*" onChange={e => setFile(e.target.files?.[0] ?? null)} />
            <p className="text-xs text-muted-foreground">PDF or image, up to 5 MB.</p>
          </div>
          <DialogFooter><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Submit claim</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function ExpensesPage() {
  const { data: session } = useSession();
  const { toast } = useToast();
  const role = session?.user?.role ?? "USER";
  const isApprover = ["ADMIN", "HR", "PM"].includes(role);
  const isHr = ["ADMIN", "HR"].includes(role);
  const [view, setView] = React.useState<"mine" | "team">("mine");
  const [creating, setCreating] = React.useState(false);
  const [busy, setBusy] = React.useState<string | null>(null);
  const list = useApi<any[]>(view === "mine" ? "/api/expenses?mine=true" : "/api/expenses");

  const act = async (id: string, action: string) => {
    setBusy(id + action);
    try {
      await api(`/api/expenses/${id}`, { method: "PATCH", json: { action } });
      toast({ title: action === "approve" ? "Approved" : action === "reject" ? "Rejected" : action === "cancel" ? "Cancelled" : "Marked reimbursed" });
      list.reload();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Not done", description: e.message });
    } finally {
      setBusy(null);
    }
  };

  if (list.error?.status === 402) return <div className="space-y-8"><PageHeader eyebrow="Workforce · Expenses" title="Expenses" /><UpgradeNotice error={list.error} isAdmin={role === "ADMIN"} /></div>;
  const rows = list.data ?? [];
  const sum = (s: string) => rows.filter(r => r.status === s).reduce((a, r) => a + r.amount, 0);
  const uid = session?.user?.id;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Workforce · Expenses"
        title="Expenses"
        description="Claim work expenses with a receipt. Your manager approves, and payroll pays it back."
        actions={<>
          {isApprover && <Segmented value={view} onChange={setView} options={[{ value: "mine", label: "Mine" }, { value: "team", label: isHr ? "Everyone" : "My team" }]} />}
          <Button onClick={() => setCreating(true)}><Plus className="mr-2 h-4 w-4" />New claim</Button>
        </>}
      />
      <StatGrid>
        <Stat label="Waiting approval" value={inr(sum("SUBMITTED"))} hint={`${rows.filter(r => r.status === "SUBMITTED").length} claims`} tone="warn" />
        <Stat label="Approved, unpaid" value={inr(sum("APPROVED"))} hint="paid with next payroll" tone="signal" />
        <Stat label="Reimbursed" value={inr(sum("REIMBURSED"))} tone="ok" />
      </StatGrid>
      <Panel title={view === "mine" ? "My claims" : "Team claims"} bodyClassName="p-0">
        {list.loading ? <p className="p-6 text-sm text-muted-foreground">Loading…</p> : rows.length === 0 ? (
          <EmptyState icon={Receipt} title="No claims" description="Submit a claim for travel, meals, internet or other work expenses." action={<Button variant="outline" onClick={() => setCreating(true)}>New claim</Button>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/40"><tr>{[view === "team" ? "Employee" : null, "Claim", "Date", "Amount", "Status", ""].filter(Boolean).map(h => <th key={h as string} className={TH}>{h}</th>)}</tr></thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} className={ROW}>
                    {view === "team" && <td className="px-6 py-3"><div className="flex items-center gap-2"><PersonAvatar name={r.user.name} image={r.user.image} size="sm" />{r.user.name}</div></td>}
                    <td className="px-6 py-3">
                      <p className="font-medium">{r.title}</p>
                      <p className="font-mono-label text-muted-foreground">{r.category}{r.receiptId && <a href={`/api/documents/${r.receiptId}`} target="_blank" rel="noreferrer" className="ml-2 inline-flex items-center gap-1 text-signal"><Paperclip className="h-3 w-3" />receipt</a>}</p>
                      {r.decisionNote && <p className="text-xs text-muted-foreground">“{r.decisionNote}”</p>}
                    </td>
                    <td className="px-6 py-3 text-muted-foreground">{format(new Date(r.spentOn), "d MMM yyyy")}</td>
                    <td className="px-6 py-3 font-semibold tabular-nums">{inr(r.amount, r.currency)}</td>
                    <td className="px-6 py-3"><StatusPill status={pillStatus(r.status)} label={r.status} /></td>
                    <td className="px-6 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        {r.status === "SUBMITTED" && r.userId !== uid && isApprover && (
                          <>
                            <Button size="sm" disabled={!!busy} onClick={() => act(r.id, "approve")}>{busy === r.id + "approve" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}</Button>
                            <Button size="sm" variant="outline" disabled={!!busy} onClick={() => act(r.id, "reject")} aria-label="Reject"><X className="h-4 w-4" /></Button>
                          </>
                        )}
                        {r.status === "SUBMITTED" && r.userId === uid && <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => act(r.id, "cancel")}>Cancel</Button>}
                        {r.status === "APPROVED" && isHr && <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => act(r.id, "reimburse")}>Paid outside payroll</Button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      {creating && <NewClaim onClose={() => setCreating(false)} onSaved={() => { setCreating(false); setView("mine"); list.reload(); }} />}
    </div>
  );
}
