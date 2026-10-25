"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { format, isPast } from "date-fns";
import { ClipboardCheck, Loader2, LogIn, LogOut, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { EmptyState, FieldLabel, PageHeader, Panel, PersonAvatar, Segmented, Stat, StatGrid, StatusPill } from "@/components/page";
import { UpgradeNotice, api, useApi } from "@/components/use-api";

type Kind = "ONBOARDING" | "OFFBOARDING";

function StartDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast();
  const people = useApi<any[]>("/api/employees");
  const templates = useApi<any>("/api/onboarding/templates");
  const [form, setForm] = React.useState({ userId: "", kind: "ONBOARDING" as Kind, templateId: "default", startDate: format(new Date(), "yyyy-MM-dd") });
  const [saving, setSaving] = React.useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api("/api/onboarding/checklists", { method: "POST", json: { ...form, templateId: form.templateId === "default" ? null : form.templateId } });
      toast({ title: "Checklist started", description: "Owners have been notified of their tasks." });
      onSaved();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Not started", description: err.message });
    } finally {
      setSaving(false);
    }
  };
  const forKind = (templates.data?.templates ?? []).filter((t: any) => t.kind === form.kind);
  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader><DialogTitle>Start a checklist</DialogTitle><DialogDescription>Tasks are assigned to HR, IT, the manager and the employee. Offboarding adds a return task for each asset they hold.</DialogDescription></DialogHeader>
          <Segmented value={form.kind} onChange={v => setForm({ ...form, kind: v, templateId: "default" })} options={[{ value: "ONBOARDING", label: "Onboarding", icon: LogIn }, { value: "OFFBOARDING", label: "Offboarding", icon: LogOut }]} />
          <div className="space-y-2"><FieldLabel>Employee</FieldLabel>
            <Select value={form.userId} onValueChange={v => setForm({ ...form, userId: v })}><SelectTrigger><SelectValue placeholder="Choose" /></SelectTrigger>
              <SelectContent>{(people.data ?? []).map(p => <SelectItem key={p.id} value={p.id}>{p.name ?? p.email}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><FieldLabel>Template</FieldLabel>
              <Select value={form.templateId} onValueChange={v => setForm({ ...form, templateId: v })}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="default">Standard ({templates.data?.defaults?.[form.kind]?.length ?? 0} tasks)</SelectItem>{forKind.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="space-y-2"><FieldLabel htmlFor="ob-date">{form.kind === "ONBOARDING" ? "Joining date" : "Last working day"}</FieldLabel><Input id="ob-date" type="date" required value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} /></div>
          </div>
          <DialogFooter><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" disabled={!form.userId || saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Start</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ChecklistCard({ c, me, isHr, onChanged }: { c: any; me?: string; isHr: boolean; onChanged: () => void }) {
  const { toast } = useToast();
  const [busy, setBusy] = React.useState<string | null>(null);
  const done = c.tasks.filter((t: any) => t.done).length;
  const pct = c.tasks.length ? Math.round((done / c.tasks.length) * 100) : 0;
  const toggle = async (t: any) => {
    setBusy(t.id);
    try { await api(`/api/onboarding/tasks/${t.id}`, { method: "PATCH", json: { done: !t.done } }); onChanged(); }
    catch (e: any) { toast({ variant: "destructive", title: "Not updated", description: e.message }); }
    finally { setBusy(null); }
  };
  return (
    <Panel
      title={<span className="flex items-center gap-3"><PersonAvatar name={c.user.name} image={c.user.image} size="sm" />{c.user.name}</span>}
      description={`${c.kind === "ONBOARDING" ? "Joins" : "Leaves"} ${format(new Date(c.startDate), "d MMM yyyy")} · ${done} of ${c.tasks.length} done`}
      actions={<StatusPill status={c.status === "DONE" ? "DONE" : "IN_PROGRESS"} label={c.kind === "ONBOARDING" ? "Onboarding" : "Offboarding"} />}
      bodyClassName="p-0"
    >
      <div className="h-1 bg-secondary"><div className="h-full bg-signal transition-[width] duration-700" style={{ width: `${pct}%` }} /></div>
      <ul>
        {c.tasks.map((t: any) => {
          const canTick = t.assigneeId === me || isHr;
          const overdue = !t.done && t.dueDate && isPast(new Date(t.dueDate));
          return (
            <li key={t.id} className="flex items-center gap-3 border-b px-6 py-3 last:border-0">
              {busy === t.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Checkbox checked={t.done} disabled={!canTick} onCheckedChange={() => toggle(t)} aria-label={t.title} />}
              <span className={`min-w-0 flex-1 text-sm ${t.done ? "text-muted-foreground line-through" : ""}`}>{t.title}</span>
              <span className="hidden font-mono-label text-muted-foreground sm:inline">{t.owner}{t.assignee ? ` · ${t.assignee.name}` : ""}</span>
              {t.dueDate && <span className={`font-mono text-[11px] ${overdue ? "text-destructive" : "text-muted-foreground"}`}>{format(new Date(t.dueDate), "d MMM")}</span>}
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

export default function OnboardingPage() {
  const { data: session } = useSession();
  const role = session?.user?.role ?? "USER";
  const isHr = ["ADMIN", "HR"].includes(role);
  const [status, setStatus] = React.useState<"OPEN" | "DONE">("OPEN");
  const [starting, setStarting] = React.useState(false);
  const list = useApi<any[]>(`/api/onboarding/checklists?status=${status}`);
  const mine = useApi<any[]>("/api/onboarding/tasks");

  if (list.error?.status === 402) return <div className="space-y-8"><PageHeader eyebrow="People · Onboarding" title="Onboarding" /><UpgradeNotice error={list.error} isAdmin={role === "ADMIN"} /></div>;
  const rows = list.data ?? [];
  const myOpen = mine.data ?? [];
  const overdue = myOpen.filter(t => t.dueDate && isPast(new Date(t.dueDate))).length;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="People · Onboarding"
        title="Onboarding & offboarding"
        description="Checklists that hand every joiner and leaver the right tasks, owners and due dates."
        actions={<>
          <Segmented value={status} onChange={setStatus} options={[{ value: "OPEN", label: "In progress" }, { value: "DONE", label: "Completed" }]} />
          {isHr && <Button onClick={() => setStarting(true)}><Plus className="mr-2 h-4 w-4" />Start checklist</Button>}
        </>}
      />
      <StatGrid>
        <Stat label="Joining" value={rows.filter(r => r.kind === "ONBOARDING").length} icon={LogIn} tone="signal" />
        <Stat label="Leaving" value={rows.filter(r => r.kind === "OFFBOARDING").length} icon={LogOut} />
        <Stat label="My open tasks" value={myOpen.length} hint={overdue ? `${overdue} overdue` : "on track"} tone={overdue ? "danger" : "ok"} icon={ClipboardCheck} />
      </StatGrid>
      {list.loading && !rows.length ? <p className="text-sm text-muted-foreground">Loading…</p> : rows.length === 0 ? (
        <Panel><EmptyState icon={ClipboardCheck} title={status === "OPEN" ? "No checklists in progress" : "No completed checklists"} description={isHr ? "Start one when someone accepts an offer or resigns." : "Checklists you are part of appear here."} /></Panel>
      ) : (
        <div className="grid gap-6 xl:grid-cols-2">{rows.map(c => <ChecklistCard key={c.id} c={c} me={session?.user?.id} isHr={isHr} onChanged={() => { list.reload(); mine.reload(); }} />)}</div>
      )}
      {starting && <StartDialog onClose={() => setStarting(false)} onSaved={() => { setStarting(false); list.reload(); }} />}
    </div>
  );
}
