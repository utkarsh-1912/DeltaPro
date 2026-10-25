"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { format } from "date-fns";
import { Laptop, Loader2, Plus, Search, Undo2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { EmptyState, FieldLabel, PageHeader, Panel, PersonAvatar, Stat, StatGrid, StatusPill } from "@/components/page";
import { UpgradeNotice, api, inr, useApi } from "@/components/use-api";

const CATEGORIES = ["LAPTOP", "MONITOR", "PHONE", "ACCESS_CARD", "HEADSET", "FURNITURE", "OTHER"];
const TH = "h-10 px-6 text-left font-mono text-[11px] font-medium uppercase tracking-wider text-muted-foreground";
const ROW = "border-b last:border-0 hover:bg-secondary/40";
const label = (s: string) => s.charAt(0) + s.slice(1).toLowerCase().replace("_", " ");
const pill = (s: string) => (s === "AVAILABLE" ? "ACTIVE" : s === "ASSIGNED" ? "IN_PROGRESS" : s === "IN_REPAIR" ? "PENDING" : "CANCELLED");

function NewAsset({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = React.useState({ name: "", category: "LAPTOP", tag: "", serialNumber: "", purchaseDate: "", cost: "" });
  const [saving, setSaving] = React.useState(false);
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api("/api/assets", { method: "POST", json: { ...form, tag: form.tag || undefined, serialNumber: form.serialNumber || null, purchaseDate: form.purchaseDate || null, cost: form.cost ? Number(form.cost) : null } });
      toast({ title: "Asset added" });
      onSaved();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Not added", description: err.message });
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader><DialogTitle>Add asset</DialogTitle><DialogDescription>Leave the tag empty to number it automatically (LAP-0001).</DialogDescription></DialogHeader>
          <div className="space-y-2"><FieldLabel htmlFor="as-name">Name</FieldLabel><Input id="as-name" required value={form.name} onChange={e => set("name", e.target.value)} placeholder="MacBook Pro 14 M3" /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><FieldLabel>Category</FieldLabel>
              <Select value={form.category} onValueChange={v => set("category", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{label(c)}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="space-y-2"><FieldLabel htmlFor="as-tag">Tag</FieldLabel><Input id="as-tag" value={form.tag} onChange={e => set("tag", e.target.value)} placeholder="Auto" /></div>
            <div className="space-y-2"><FieldLabel htmlFor="as-serial">Serial number</FieldLabel><Input id="as-serial" value={form.serialNumber} onChange={e => set("serialNumber", e.target.value)} /></div>
            <div className="space-y-2"><FieldLabel htmlFor="as-date">Purchased</FieldLabel><Input id="as-date" type="date" value={form.purchaseDate} onChange={e => set("purchaseDate", e.target.value)} /></div>
            <div className="space-y-2"><FieldLabel htmlFor="as-cost">Cost (₹)</FieldLabel><Input id="as-cost" type="number" min={0} value={form.cost} onChange={e => set("cost", e.target.value)} /></div>
          </div>
          <DialogFooter><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Add asset</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AssignDialog({ asset, onClose, onSaved }: { asset: any; onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast();
  const people = useApi<any[]>("/api/employees");
  const [userId, setUserId] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const submit = async () => {
    setSaving(true);
    try {
      await api(`/api/assets/${asset.id}/assign`, { method: "POST", json: { userId } });
      toast({ title: "Assigned", description: asset.name });
      onSaved();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Not assigned", description: err.message });
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Assign {asset.tag}</DialogTitle><DialogDescription>{asset.name}</DialogDescription></DialogHeader>
        <Select value={userId} onValueChange={setUserId}>
          <SelectTrigger><SelectValue placeholder="Choose an employee" /></SelectTrigger>
          <SelectContent>{(people.data ?? []).filter(p => p.isActive !== false).map(p => <SelectItem key={p.id} value={p.id}>{p.name ?? p.email}</SelectItem>)}</SelectContent>
        </Select>
        <DialogFooter><Button variant="ghost" onClick={onClose}>Cancel</Button><Button disabled={!userId || saving} onClick={submit}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Assign</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function AssetsPage() {
  const { data: session } = useSession();
  const { toast } = useToast();
  const isHr = ["ADMIN", "HR"].includes(session?.user?.role ?? "");
  const [q, setQ] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [creating, setCreating] = React.useState(false);
  const [assigning, setAssigning] = React.useState<any | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  React.useEffect(() => { const t = setTimeout(() => setQuery(q), 300); return () => clearTimeout(t); }, [q]);
  const list = useApi<any[]>(`/api/assets${query ? `?q=${encodeURIComponent(query)}` : ""}`);

  const update = async (asset: any, path: string, body: object, done: string) => {
    setBusy(asset.id);
    try { await api(path, { method: path.endsWith("/assign") ? "POST" : "PATCH", json: body }); toast({ title: done }); list.reload(); }
    catch (e: any) { toast({ variant: "destructive", title: "Not done", description: e.message }); }
    finally { setBusy(null); }
  };

  if (list.error?.status === 402) return <div className="space-y-8"><PageHeader eyebrow="Workforce · Assets" title="Assets" /><UpgradeNotice error={list.error} isAdmin={session?.user?.role === "ADMIN"} /></div>;
  const rows = list.data ?? [];
  const count = (s: string) => rows.filter(r => r.status === s).length;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Workforce · Assets"
        title={isHr ? "Asset register" : "My equipment"}
        description={isHr ? "Laptops, phones, access cards and furniture: who has what, and its history. Offboarding adds return tasks automatically." : "Company equipment assigned to you."}
        actions={isHr && <Button onClick={() => setCreating(true)}><Plus className="mr-2 h-4 w-4" />Add asset</Button>}
      />
      {isHr && (
        <StatGrid>
          <Stat label="Assigned" value={count("ASSIGNED")} tone="signal" />
          <Stat label="Available" value={count("AVAILABLE")} tone="ok" />
          <Stat label="In repair" value={count("IN_REPAIR")} tone="warn" />
          <Stat label="Book value" value={inr(rows.filter(r => r.status !== "RETIRED").reduce((a, r) => a + (r.cost ?? 0), 0))} />
        </StatGrid>
      )}
      <Panel
        title={isHr ? "All assets" : "Assigned to me"}
        actions={isHr && <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Search assets" className="h-9 w-56 pl-9" placeholder="Tag, name, serial" value={q} onChange={e => setQ(e.target.value)} /></div>}
        bodyClassName="p-0"
      >
        {list.loading && !rows.length ? <p className="p-6 text-sm text-muted-foreground">Loading…</p> : rows.length === 0 ? (
          <EmptyState icon={Laptop} title={isHr ? "No assets yet" : "Nothing assigned to you"} description={isHr ? "Add laptops, monitors, phones and access cards to track who holds them." : undefined} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/40"><tr>{["Tag", "Asset", "Status", "Holder", "Since", ""].map(h => <th key={h} className={TH}>{h}</th>)}</tr></thead>
              <tbody>
                {rows.map(a => (
                  <tr key={a.id} className={ROW}>
                    <td className="px-6 py-3 font-mono text-xs">{a.tag}</td>
                    <td className="px-6 py-3"><p className="font-medium">{a.name}</p><p className="font-mono-label text-muted-foreground">{label(a.category)}{a.serialNumber ? ` · ${a.serialNumber}` : ""}</p></td>
                    <td className="px-6 py-3"><StatusPill status={pill(a.status)} label={label(a.status)} /></td>
                    <td className="px-6 py-3">{a.assignedTo ? <div className="flex items-center gap-2"><PersonAvatar name={a.assignedTo.name} image={a.assignedTo.image} size="sm" />{a.assignedTo.name}</div> : <span className="text-muted-foreground">—</span>}</td>
                    <td className="px-6 py-3 text-muted-foreground">{a.assignedAt ? format(new Date(a.assignedAt), "d MMM yyyy") : "—"}</td>
                    <td className="px-6 py-3 text-right">
                      {isHr && (
                        <div className="flex justify-end gap-1">
                          {a.status === "AVAILABLE" && <Button size="sm" variant="outline" onClick={() => setAssigning(a)}><UserPlus className="mr-2 h-4 w-4" />Assign</Button>}
                          {a.status === "ASSIGNED" && <Button size="sm" variant="outline" disabled={busy === a.id} onClick={() => update(a, `/api/assets/${a.id}/assign`, { userId: null }, "Returned")}><Undo2 className="mr-2 h-4 w-4" />Return</Button>}
                          {a.status === "AVAILABLE" && <Button size="sm" variant="ghost" disabled={busy === a.id} onClick={() => update(a, `/api/assets/${a.id}`, { status: "IN_REPAIR" }, "Sent for repair")}>Repair</Button>}
                          {a.status === "IN_REPAIR" && <Button size="sm" variant="ghost" disabled={busy === a.id} onClick={() => update(a, `/api/assets/${a.id}`, { status: "AVAILABLE" }, "Back in stock")}>Back in stock</Button>}
                          {a.status !== "ASSIGNED" && a.status !== "RETIRED" && <Button size="sm" variant="ghost" className="text-muted-foreground" disabled={busy === a.id} onClick={() => update(a, `/api/assets/${a.id}`, { status: "RETIRED" }, "Retired")}>Retire</Button>}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      {creating && <NewAsset onClose={() => setCreating(false)} onSaved={() => { setCreating(false); list.reload(); }} />}
      {assigning && <AssignDialog asset={assigning} onClose={() => setAssigning(null)} onSaved={() => { setAssigning(null); list.reload(); }} />}
    </div>
  );
}
