"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { format, isPast } from "date-fns";
import { CalendarHeart, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { EmptyState, FieldLabel, PageHeader, Panel, Segmented, Stat, StatGrid, StatusPill } from "@/components/page";
import { api, useApi } from "@/components/use-api";

/** Parses "2026-10-20, Diwali" lines for bulk entry. */
function parseLines(text: string) {
  return text.split(/\r?\n/).map(l => l.trim()).filter(Boolean).map(l => {
    const [date, ...name] = l.split(/[,\t]/);
    return { date: date.trim(), name: name.join(",").trim() };
  }).filter(h => /^\d{4}-\d{2}-\d{2}$/.test(h.date) && h.name);
}

export default function HolidaysPage() {
  const { data: session } = useSession();
  const { toast } = useToast();
  const isHr = ["ADMIN", "HR"].includes(session?.user?.role ?? "");
  const thisYear = new Date().getFullYear();
  const [year, setYear] = React.useState(String(thisYear));
  const list = useApi<any[]>(`/api/holidays?year=${year}`);
  const [form, setForm] = React.useState({ date: "", name: "", optional: false });
  const [bulk, setBulk] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const save = async (items: { date: string; name: string; optional?: boolean }[]) => {
    setSaving(true);
    try {
      await api("/api/holidays", { method: "POST", json: { holidays: items } });
      toast({ title: `${items.length} holiday${items.length === 1 ? "" : "s"} saved` });
      setForm({ date: "", name: "", optional: false });
      setBulk("");
      list.reload();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Not saved", description: e.message });
    } finally {
      setSaving(false);
    }
  };
  const remove = async (id: string) => {
    try { await api(`/api/holidays/${id}`, { method: "DELETE" }); list.reload(); }
    catch (e: any) { toast({ variant: "destructive", title: "Not deleted", description: e.message }); }
  };

  const rows = list.data ?? [];
  const upcoming = rows.filter(h => !isPast(new Date(h.date)));
  const parsed = parseLines(bulk);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Workforce · Holidays"
        title="Holiday calendar"
        description="Company holidays are skipped when counting leave days and payroll working days. Restricted holidays are listed but still count as working days."
        actions={<Segmented value={year} onChange={setYear} options={[thisYear - 1, thisYear, thisYear + 1].map(y => ({ value: String(y), label: String(y) }))} />}
      />
      <StatGrid>
        <Stat label="Holidays" value={rows.filter(h => !h.optional).length} icon={CalendarHeart} />
        <Stat label="Restricted" value={rows.filter(h => h.optional).length} />
        <Stat label="Next" value={upcoming[0] ? format(new Date(upcoming[0].date), "d MMM") : "—"} hint={upcoming[0]?.name} tone="signal" />
      </StatGrid>
      <div className={isHr ? "grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]" : ""}>
        <Panel title={`${year} holidays`} bodyClassName="p-0">
          {rows.length === 0 ? <EmptyState icon={CalendarHeart} title="No holidays set" description={isHr ? "Add your company's holidays for the year." : "HR hasn't published this year's holidays yet."} /> : (
            <ul>
              {rows.map(h => (
                <li key={h.id} className={`flex items-center gap-4 border-b px-6 py-3 last:border-0 ${isPast(new Date(h.date)) ? "opacity-50" : ""}`}>
                  <span className="w-28 font-mono text-sm tabular-nums">{format(new Date(h.date), "EEE d MMM")}</span>
                  <span className="flex-1 font-medium">{h.name}</span>
                  {h.optional && <StatusPill status="PENDING" label="Restricted" />}
                  {isHr && <Button size="sm" variant="ghost" aria-label={`Delete ${h.name}`} onClick={() => remove(h.id)}><Trash2 className="h-4 w-4" /></Button>}
                </li>
              ))}
            </ul>
          )}
        </Panel>
        {isHr && (
          <div className="space-y-6">
            <Panel title="Add a holiday">
              <form onSubmit={e => { e.preventDefault(); save([form]); }} className="space-y-3 p-6">
                <div className="space-y-2"><FieldLabel htmlFor="h-date">Date</FieldLabel><Input id="h-date" type="date" required value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
                <div className="space-y-2"><FieldLabel htmlFor="h-name">Name</FieldLabel><Input id="h-name" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Diwali" /></div>
                <label className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">Restricted holiday<Switch checked={form.optional} onCheckedChange={v => setForm({ ...form, optional: v })} /></label>
                <Button type="submit" className="w-full" disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}Add</Button>
              </form>
            </Panel>
            <Panel title="Paste a list" description="One per line: 2026-10-20, Diwali">
              <div className="space-y-3 p-6">
                <Textarea aria-label="Holiday list" rows={6} className="font-mono text-xs" value={bulk} onChange={e => setBulk(e.target.value)} placeholder={"2026-01-26, Republic Day\n2026-08-15, Independence Day"} />
                <Button className="w-full" variant="outline" disabled={!parsed.length || saving} onClick={() => save(parsed)}>Add {parsed.length || ""} holidays</Button>
              </div>
            </Panel>
          </div>
        )}
      </div>
    </div>
  );
}
