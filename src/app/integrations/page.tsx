"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { formatDistanceToNow } from "date-fns";
import {
  AlertTriangle, CheckCircle2, Copy, Download, Link2, Loader2, Plus, RefreshCw, RotateCcw, Send, Settings2, Trash2, Webhook,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";

type Field = {
  key: string; label: string; type: "text" | "secret" | "url" | "select" | "boolean" | "textarea" | "number";
  scope: "config" | "credentials"; required?: boolean; help?: string; placeholder?: string;
  options?: { value: string; label: string }[]; default?: string | boolean | number;
};
type CatalogItem = {
  provider: string; name: string; category: string; description: string; fields: Field[];
  supportedEvents: string[] | "*"; defaultEvents: string[]; inbound: boolean; outbound: boolean; pull: boolean; oauth: boolean;
};
type IntegrationRow = {
  id: string; provider: string; name: string; enabled: boolean; config: Record<string, any>; events: string[];
  credentialsSet: Record<string, string>; lastSyncAt: string | null; webhookUrl: string | null; scimBaseUrl: string | null;
  stats: Record<string, number>; lastError: string | null;
};
type Delivery = { id: string; status: string; attempts: number; lastError: string | null; nextRunAt: string; updatedAt: string; event: { type: string; createdAt: string } };

const STATUS_STYLE: Record<string, string> = {
  DONE: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  PENDING: "bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/30",
  RUNNING: "bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/30",
  FAILED: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",
  DEAD: "bg-destructive/10 text-destructive border-destructive/30",
};

async function api<T = any>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

function CopyField({ label, value }: { label: string; value: string }) {
  const { toast } = useToast();
  return (
    <div className="space-y-1 min-w-0">
      <div className="text-[11px] font-mono uppercase tracking-[0.1em] text-muted-foreground">{label}</div>
      <div className="flex items-center gap-2">
        <code className="flex-1 min-w-0 truncate rounded-md bg-muted px-2 py-1.5 text-xs">{value}</code>
        <Button type="button" size="icon" variant="ghost" className="h-8 w-8 shrink-0" aria-label={`Copy ${label}`}
          onClick={() => navigator.clipboard.writeText(value).then(() => toast({ title: "Copied" }), () => toast({ title: "Copy failed", description: value }))}>
          <Copy className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function IntegrationForm({ item, existing, eventTypes, onSaved, onCancel }: {
  item: CatalogItem; existing?: IntegrationRow; eventTypes: string[]; onSaved: () => void; onCancel: () => void;
}) {
  const { toast } = useToast();
  const [name, setName] = useState(existing?.name ?? item.name);
  const [values, setValues] = useState<Record<string, any>>(() => {
    const v: Record<string, any> = {};
    for (const f of item.fields) {
      if (f.scope === "config") v[f.key] = existing?.config?.[f.key] ?? f.default ?? (f.type === "boolean" ? false : "");
      else v[f.key] = "";
    }
    return v;
  });
  const [events, setEvents] = useState<string[]>(existing?.events ?? item.defaultEvents);
  const [saving, setSaving] = useState(false);
  const selectable = item.supportedEvents === "*" ? eventTypes : item.supportedEvents;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const config: Record<string, any> = {};
    const credentials: Record<string, any> = {};
    for (const f of item.fields) (f.scope === "config" ? config : credentials)[f.key] = values[f.key];
    try {
      if (existing) {
        await api(`/api/integrations/${existing.id}`, { method: "PATCH", body: JSON.stringify({ name, config, credentials, events }) });
      } else {
        await api("/api/integrations", { method: "POST", body: JSON.stringify({ provider: item.provider, name, config, credentials, events }) });
      }
      toast({ title: existing ? "Integration updated" : "Integration added", description: item.oauth && !existing ? "Use Connect to authorise the account." : undefined });
      onSaved();
    } catch (err) {
      toast({ variant: "destructive", title: "Not saved", description: err instanceof Error ? err.message : "Try again." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="int-name">Name</Label>
        <Input id="int-name" value={name} onChange={e => setName(e.target.value)} required />
      </div>
      {item.fields.map(f => {
        const id = `field-${f.key}`;
        const stored = existing?.credentialsSet?.[f.key];
        if (f.type === "boolean") {
          return (
            <div key={f.key} className="flex items-center justify-between gap-4 rounded-lg border p-3">
              <div className="space-y-0.5 min-w-0">
                <Label htmlFor={id}>{f.label}</Label>
                {f.help && <p className="text-xs text-muted-foreground">{f.help}</p>}
              </div>
              <Switch id={id} checked={!!values[f.key]} onCheckedChange={v => setValues(s => ({ ...s, [f.key]: v }))} />
            </div>
          );
        }
        return (
          <div key={f.key} className="space-y-2">
            <Label htmlFor={id}>{f.label}{f.required && <span className="text-destructive"> *</span>}</Label>
            {f.type === "select" ? (
              <Select value={String(values[f.key] ?? "")} onValueChange={v => setValues(s => ({ ...s, [f.key]: v }))}>
                <SelectTrigger id={id}><SelectValue placeholder="Choose" /></SelectTrigger>
                <SelectContent>{f.options?.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            ) : f.type === "textarea" ? (
              <Textarea id={id} value={values[f.key] ?? ""} placeholder={f.placeholder} className="font-mono text-xs h-24"
                onChange={e => setValues(s => ({ ...s, [f.key]: e.target.value }))} />
            ) : (
              <Input id={id} type={f.type === "secret" ? "password" : f.type === "number" ? "number" : "text"} autoComplete="off"
                value={values[f.key] ?? ""} placeholder={stored ? `Saved (${stored}). Leave blank to keep.` : f.placeholder}
                required={f.required && !stored && f.scope === "config"}
                onChange={e => setValues(s => ({ ...s, [f.key]: e.target.value }))} />
            )}
            {f.help && <p className="text-xs text-muted-foreground">{f.help}</p>}
          </div>
        );
      })}
      {selectable.length > 0 && (
        <div className="space-y-2">
          <Label>Events to send</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-lg border p-3 max-h-56 overflow-auto">
            {selectable.map(ev => (
              <label key={ev} className="flex items-center gap-2 text-sm font-mono">
                <Checkbox checked={events.includes(ev)} onCheckedChange={c => setEvents(s => c ? [...s, ev] : s.filter(x => x !== ev))} />
                {ev}
              </label>
            ))}
          </div>
        </div>
      )}
      <DialogFooter className="gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{existing ? "Save changes" : "Add integration"}</Button>
      </DialogFooter>
    </form>
  );
}

export default function IntegrationsPage() {
  const { data: session, status } = useSession();
  const { toast } = useToast();
  const [data, setData] = useState<{ integrations: IntegrationRow[]; catalog: CatalogItem[]; eventTypes: string[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState<CatalogItem | "pick" | null>(null);
  const [editing, setEditing] = useState<IntegrationRow | null>(null);
  const [deleting, setDeleting] = useState<IntegrationRow | null>(null);
  const [deliveriesFor, setDeliveriesFor] = useState<IntegrationRow | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));

  const isAdmin = session?.user?.role === "ADMIN";
  const isPeopleAdmin = isAdmin || session?.user?.role === "HR";

  const load = useCallback(async () => {
    try {
      setData(await api("/api/integrations"));
    } catch (e) {
      toast({ variant: "destructive", title: "Could not load integrations", description: e instanceof Error ? e.message : "" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (status !== "authenticated") return;
    if (isAdmin) load(); else setLoading(false);
    const p = new URLSearchParams(window.location.search);
    if (p.get("connected")) toast({ title: "Account connected", description: "The integration can now send updates." });
    if (p.get("oauth_error")) toast({ variant: "destructive", title: "Connection failed", description: p.get("oauth_error")! });
    if (p.get("connected") || p.get("oauth_error")) window.history.replaceState(null, "", "/integrations");
  }, [status, isAdmin, load, toast]);

  const catalogByProvider = useMemo(() => new Map((data?.catalog ?? []).map(c => [c.provider, c])), [data]);
  const grouped = useMemo(() => {
    const g = new Map<string, CatalogItem[]>();
    (data?.catalog ?? []).forEach(c => g.set(c.category, [...(g.get(c.category) ?? []), c]));
    return Array.from(g.entries());
  }, [data]);

  const act = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try { await fn(); } finally { setBusy(null); }
  };

  const test = (i: IntegrationRow) => act(`test:${i.id}`, async () => {
    const r = await api(`/api/integrations/${i.id}/test`, { method: "POST" }).catch(e => ({ ok: false, error: e.message }));
    toast(r.ok ? { title: "Test passed", description: r.note || "Message sent." } : { variant: "destructive", title: "Test failed", description: r.error });
  });

  const sync = (i: IntegrationRow) => act(`sync:${i.id}`, async () => {
    try {
      const r = await api(`/api/integrations/${i.id}/sync`, { method: "POST" });
      toast({ title: "Sync finished", description: `${r.total} records processed, ${r.failed} failed.` });
      load();
    } catch (e) {
      toast({ variant: "destructive", title: "Sync failed", description: e instanceof Error ? e.message : "" });
    }
  });

  const toggle = (i: IntegrationRow, enabled: boolean) => act(`toggle:${i.id}`, async () => {
    try {
      await api(`/api/integrations/${i.id}`, { method: "PATCH", body: JSON.stringify({ enabled }) });
      load();
    } catch (e) {
      toast({ variant: "destructive", title: "Not changed", description: e instanceof Error ? e.message : "" });
    }
  });

  const remove = (i: IntegrationRow) => act(`delete:${i.id}`, async () => {
    try {
      await api(`/api/integrations/${i.id}`, { method: "DELETE" });
      toast({ title: "Integration removed" });
      setDeleting(null);
      load();
    } catch (e) {
      toast({ variant: "destructive", title: "Not removed", description: e instanceof Error ? e.message : "" });
    }
  });

  const openDeliveries = async (i: IntegrationRow) => {
    setDeliveriesFor(i);
    setDeliveries(null);
    setDeliveries(await api(`/api/integrations/${i.id}/deliveries`).catch(() => []));
  };

  const retry = (d: Delivery) => act(`retry:${d.id}`, async () => {
    const r = await api(`/api/deliveries/${d.id}/retry`, { method: "POST" }).catch(e => ({ ok: false, error: e.message }));
    toast(r.ok ? { title: "Delivered" } : { variant: "destructive", title: "Still failing", description: r.error });
    if (deliveriesFor) openDeliveries(deliveriesFor);
    load();
  });

  if (status === "loading" || loading) {
    return <div className="flex items-center gap-2 text-muted-foreground p-8"><Loader2 className="h-4 w-4 animate-spin" /> Loading integrations…</div>;
  }

  const payrollCard = isPeopleAdmin && (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Payroll export</CardTitle>
        <CardDescription>Monthly CSV per active employee: working days, days present, hours, paid and unpaid leave, absences and loss-of-pay days.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-end gap-3">
        <div className="space-y-2">
          <Label htmlFor="payroll-month">Month</Label>
          <Input id="payroll-month" type="month" value={month} onChange={e => setMonth(e.target.value)} className="w-44" />
        </div>
        <Button asChild variant="outline">
          <a href={`/api/payroll/export?month=${month}`}><Download className="mr-2 h-4 w-4" /> Download CSV</a>
        </Button>
      </CardContent>
    </Card>
  );

  if (!isAdmin) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <h1 className="page-title">Integrations</h1>
        <p className="text-muted-foreground">Only administrators can manage integrations.</p>
        {payrollCard}
      </div>
    );
  }

  const integrations = data?.integrations ?? [];

  return (
    <div className="max-w-[1400px] mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="page-title">Integrations</h1>
          <p className="text-muted-foreground mt-2 text-lg">Connect DeltaPro to chat, calendars, HR systems and developer tools. Updates are queued and retried automatically.</p>
        </div>
        <Button onClick={() => setAdding("pick")}><Plus className="mr-2 h-4 w-4" /> Add integration</Button>
      </div>

      {integrations.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center space-y-3">
            <Webhook className="h-10 w-10 mx-auto text-muted-foreground" />
            <p className="font-medium">No integrations yet</p>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">Start with Slack or email so approvers hear about leave requests, or a calendar so approved leave shows up for the team.</p>
            <Button variant="outline" onClick={() => setAdding("pick")}><Plus className="mr-2 h-4 w-4" /> Add your first integration</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {integrations.map(i => {
            const c = catalogByProvider.get(i.provider);
            const failing = (i.stats.FAILED ?? 0) + (i.stats.DEAD ?? 0);
            const needsOauth = c?.oauth && !i.credentialsSet.__oauth;
            return (
              <Card key={i.id} className={i.enabled ? "" : "opacity-70"}>
                <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle className="text-lg truncate">{i.name}</CardTitle>
                      <Badge variant="secondary" className="font-mono text-[10px] uppercase">{c?.name ?? i.provider}</Badge>
                    </div>
                    <CardDescription className="flex items-center gap-1.5">
                      {!i.enabled ? <>Paused</>
                        : needsOauth ? <><AlertTriangle className="h-3.5 w-3.5 text-amber-500" /> Not connected yet</>
                          : failing > 0 ? <><AlertTriangle className="h-3.5 w-3.5 text-destructive" /> {failing} failing deliver{failing === 1 ? "y" : "ies"}</>
                            : <><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Healthy</>}
                    </CardDescription>
                  </div>
                  <Switch checked={i.enabled} disabled={busy === `toggle:${i.id}`} onCheckedChange={v => toggle(i, v)} aria-label="Enabled" />
                </CardHeader>
                <CardContent className="space-y-4">
                  {c?.outbound && (
                    <div className="flex flex-wrap gap-2 text-xs">
                      {(["DONE", "PENDING", "FAILED", "DEAD"] as const).map(s => (
                        <span key={s} className={`rounded-full border px-2 py-0.5 font-mono ${STATUS_STYLE[s]}`}>{s.toLowerCase()} {i.stats[s] ?? 0}</span>
                      ))}
                      <span className="text-muted-foreground self-center">last 24h</span>
                    </div>
                  )}
                  {i.events.length > 0 && <p className="text-xs text-muted-foreground font-mono break-words">{i.events.join(" · ")}</p>}
                  {i.webhookUrl && <CopyField label="Webhook URL" value={i.webhookUrl} />}
                  {i.scimBaseUrl && <CopyField label="SCIM base URL" value={i.scimBaseUrl} />}
                  {c?.pull && <p className="text-xs text-muted-foreground">Last sync: {i.lastSyncAt ? formatDistanceToNow(new Date(i.lastSyncAt), { addSuffix: true }) : "never"}</p>}
                  {i.lastError && failing > 0 && <p className="text-xs text-destructive break-words line-clamp-3">{i.lastError}</p>}
                </CardContent>
                <CardFooter className="flex flex-wrap gap-2">
                  {c?.oauth && (
                    <Button asChild size="sm" variant={needsOauth ? "default" : "outline"}>
                      <a href={`/api/integrations/${i.id}/oauth`}><Link2 className="mr-2 h-4 w-4" />{needsOauth ? "Connect" : "Reconnect"}</a>
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => test(i)} disabled={busy === `test:${i.id}`}>
                    {busy === `test:${i.id}` ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />} Test
                  </Button>
                  {c?.pull && (
                    <Button size="sm" variant="outline" onClick={() => sync(i)} disabled={busy === `sync:${i.id}`}>
                      {busy === `sync:${i.id}` ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />} Sync now
                    </Button>
                  )}
                  {c?.outbound && <Button size="sm" variant="ghost" onClick={() => openDeliveries(i)}>Deliveries</Button>}
                  <Button size="sm" variant="ghost" onClick={() => setEditing(i)}><Settings2 className="mr-2 h-4 w-4" /> Edit</Button>
                  <Button size="sm" variant="ghost" className="text-destructive ml-auto" onClick={() => setDeleting(i)} aria-label="Remove"><Trash2 className="h-4 w-4" /></Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      {payrollCard}

      {/* Add: choose a connector, then configure it */}
      <Dialog open={adding !== null} onOpenChange={o => !o && setAdding(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          {adding === "pick" ? (
            <>
              <DialogHeader>
                <DialogTitle>Add integration</DialogTitle>
                <DialogDescription>Pick what to connect. You can add more than one of each, for example a Slack channel per team.</DialogDescription>
              </DialogHeader>
              <div className="space-y-5">
                {grouped.map(([category, items]) => (
                  <div key={category} className="space-y-2">
                    <div className="text-[11px] font-mono uppercase tracking-[0.12em] text-muted-foreground">{category}</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {items.map(item => (
                        <button key={item.provider} type="button" onClick={() => setAdding(item)}
                          className="text-left rounded-lg border p-3 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors">
                          <div className="font-medium flex items-center gap-2">{item.name}
                            {item.inbound && <Badge variant="outline" className="text-[9px] font-mono">IN</Badge>}
                            {item.outbound && <Badge variant="outline" className="text-[9px] font-mono">OUT</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : adding ? (
            <>
              <DialogHeader>
                <DialogTitle>{adding.name}</DialogTitle>
                <DialogDescription>{adding.description}</DialogDescription>
              </DialogHeader>
              <IntegrationForm item={adding} eventTypes={data?.eventTypes ?? []} onCancel={() => setAdding("pick")} onSaved={() => { setAdding(null); load(); }} />
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={!!editing} onOpenChange={o => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          {editing && catalogByProvider.get(editing.provider) && (
            <>
              <DialogHeader>
                <DialogTitle>Edit {editing.name}</DialogTitle>
                <DialogDescription>Secret fields stay as saved unless you type a new value.</DialogDescription>
              </DialogHeader>
              <IntegrationForm item={catalogByProvider.get(editing.provider)!} existing={editing} eventTypes={data?.eventTypes ?? []}
                onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleting} onOpenChange={o => !o && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove {deleting?.name}?</DialogTitle>
            <DialogDescription>Its stored credentials, delivery history and links to external records are deleted. Calendar events it already created stay in the calendar.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setDeleting(null)}>Keep it</Button>
            <Button variant="destructive" disabled={!!busy} onClick={() => deleting && remove(deleting)}>Remove integration</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deliveriesFor} onOpenChange={o => !o && setDeliveriesFor(null)}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Deliveries: {deliveriesFor?.name}</DialogTitle>
            <DialogDescription>The last 100 events sent to this integration. Failed deliveries retry with backoff (30 s, 2 m, 10 m, 1 h, 6 h) before they stop.</DialogDescription>
          </DialogHeader>
          {deliveries === null ? (
            <div className="flex items-center gap-2 text-muted-foreground py-6"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
          ) : deliveries.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6">Nothing sent yet. Events appear here when something this integration subscribes to happens.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Event</TableHead><TableHead>Status</TableHead><TableHead>Tries</TableHead><TableHead>When</TableHead><TableHead>Detail</TableHead><TableHead /></TableRow>
                </TableHeader>
                <TableBody>
                  {deliveries.map(d => (
                    <TableRow key={d.id}>
                      <TableCell className="font-mono text-xs whitespace-nowrap">{d.event.type}</TableCell>
                      <TableCell><span className={`rounded-full border px-2 py-0.5 text-[11px] font-mono ${STATUS_STYLE[d.status] ?? ""}`}>{d.status.toLowerCase()}</span></TableCell>
                      <TableCell className="tabular-nums">{d.attempts}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{formatDistanceToNow(new Date(d.updatedAt), { addSuffix: true })}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[320px] break-words">{d.lastError ?? ""}</TableCell>
                      <TableCell>
                        {(d.status === "FAILED" || d.status === "DEAD") && (
                          <Button size="sm" variant="outline" disabled={busy === `retry:${d.id}`} onClick={() => retry(d)}>
                            {busy === `retry:${d.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
