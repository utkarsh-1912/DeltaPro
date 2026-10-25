"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { Building2, Check, Loader2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { FieldLabel, PageHeader, Panel, Stat, StatGrid } from "@/components/page";
import { api, useApi } from "@/components/use-api";
import { cn } from "@/lib/utils";

const PT_STATES = [["", "None"], ["MH", "Maharashtra"], ["KA", "Karnataka"], ["TG", "Telangana"], ["AP", "Andhra Pradesh"], ["GJ", "Gujarat"], ["WB", "West Bengal"]];

export default function OrganizationPage() {
  const { data: session, update } = useSession();
  const { toast } = useToast();
  const isAdmin = session?.user?.role === "ADMIN";
  const { data, reload } = useApi<any>("/api/organization");
  const [form, setForm] = React.useState<any>(null);
  const [saving, setSaving] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (data) {
      const o = data.organization;
      setForm({ name: o.name, domain: o.domain ?? "", allowDomainJoin: o.allowDomainJoin, ptState: o.ptState ?? "", timezone: o.timezone, attendanceLop: !!o.payrollSettings?.attendanceLop });
    }
  }, [data]);

  const save = async (patch: object, label: string) => {
    setSaving(label);
    try {
      await api("/api/organization", { method: "PATCH", json: patch });
      toast({ title: "Saved" });
      await reload();
      await update?.();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Not saved", description: e.message });
    } finally {
      setSaving(null);
    }
  };

  if (!data || !form) return <p className="text-muted-foreground">Loading organization…</p>;
  const { organization: org, plan, seats, plans, featureLabels } = data;
  const allFeatures = Object.keys(featureLabels);

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Administration · Organization" title={org.name} description={`Workspace ${org.slug}. Every record in DeltaPro belongs to this organization and is invisible to others.`} />
      <StatGrid>
        <Stat label="Plan" value={plan.name} hint={plan.price} tone="signal" icon={Building2} />
        <Stat label="Seats used" value={seats.limit ? `${seats.used} / ${seats.limit}` : seats.used} progress={seats.limit ? (seats.used / seats.limit) * 100 : undefined} icon={Users} tone={seats.limit && seats.used >= seats.limit ? "danger" : "default"} />
        <Stat label="Domain" value={org.domain ?? "—"} hint={org.domain ? (org.allowDomainJoin ? "auto-join on" : "auto-join off") : "not claimed"} />
      </StatGrid>

      <Panel title="Plans" description={isAdmin ? "Changes take effect immediately. Billing is handled outside DeltaPro for now." : "Ask an admin to change the plan."}>
        <div className="grid gap-px bg-border md:grid-cols-3">
          {plans.map((p: any) => {
            const current = p.id === org.plan;
            return (
              <div key={p.id} className={cn("flex flex-col bg-card p-6", current && "bg-secondary/40")}>
                <p className="font-mono-label text-muted-foreground">{p.seats ? `Up to ${p.seats} people` : "Unlimited people"}</p>
                <h3 className="mt-3 text-2xl font-semibold tracking-tight">{p.name}</h3>
                <p className="mt-1 text-sm text-signal">{p.price}</p>
                <p className="mt-3 text-sm text-muted-foreground">{p.blurb}</p>
                <ul className="mt-5 flex-1 space-y-2 text-sm">
                  {allFeatures.map(f => (
                    <li key={f} className={cn("flex items-center gap-2", !p.features.includes(f) && "text-muted-foreground/50 line-through")}>
                      <Check className={cn("h-3.5 w-3.5", p.features.includes(f) ? "text-signal" : "opacity-0")} />{featureLabels[f]}
                    </li>
                  ))}
                </ul>
                <Button className="mt-6" variant={current ? "secondary" : "default"} disabled={current || !isAdmin || !!saving} onClick={() => save({ plan: p.id }, "plan")}>
                  {saving === "plan" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{current ? "Current plan" : `Switch to ${p.name}`}
                </Button>
              </div>
            );
          })}
        </div>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Company" description="How people find and join this workspace.">
          <form className="space-y-4 p-6" onSubmit={e => { e.preventDefault(); save({ name: form.name, domain: form.domain || null, allowDomainJoin: form.allowDomainJoin, timezone: form.timezone }, "company"); }}>
            <div className="space-y-2"><FieldLabel htmlFor="org-name">Name</FieldLabel><Input id="org-name" disabled={!isAdmin} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div className="space-y-2"><FieldLabel htmlFor="org-domain">Email domain</FieldLabel><Input id="org-domain" disabled={!isAdmin} placeholder="yourcompany.com" value={form.domain} onChange={e => setForm({ ...form, domain: e.target.value })} /></div>
            <label className="flex items-center justify-between gap-4 rounded-lg border px-4 py-3 text-sm">
              <span>Anyone with an @{form.domain || "domain"} email can join<span className="block text-xs text-muted-foreground">They join as employees when they sign up or use SSO.</span></span>
              <Switch disabled={!isAdmin || !form.domain} checked={form.allowDomainJoin} onCheckedChange={v => setForm({ ...form, allowDomainJoin: v })} />
            </label>
            <div className="space-y-2"><FieldLabel htmlFor="org-tz">Time zone</FieldLabel><Input id="org-tz" disabled={!isAdmin} value={form.timezone} onChange={e => setForm({ ...form, timezone: e.target.value })} /></div>
            {isAdmin && <Button type="submit" disabled={!!saving}>{saving === "company" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save</Button>}
          </form>
        </Panel>
        <Panel title="Payroll" description="Statutory settings used when payroll runs.">
          <form className="space-y-4 p-6" onSubmit={e => { e.preventDefault(); save({ ptState: form.ptState || null, attendanceLop: form.attendanceLop }, "payroll"); }}>
            <div className="space-y-2"><FieldLabel>Professional tax state</FieldLabel>
              <Select disabled={!isAdmin} value={form.ptState || "none"} onValueChange={v => setForm({ ...form, ptState: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PT_STATES.map(([code, label]) => <SelectItem key={code || "none"} value={code || "none"}>{label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <label className="flex items-center justify-between gap-4 rounded-lg border px-4 py-3 text-sm">
              <span>Count absences as loss of pay<span className="block text-xs text-muted-foreground">Working days with no clock-in and no approved leave reduce pay. Off: only unpaid leave does.</span></span>
              <Switch disabled={!isAdmin} checked={form.attendanceLop} onCheckedChange={v => setForm({ ...form, attendanceLop: v })} />
            </label>
            {isAdmin && <Button type="submit" disabled={!!saving}>{saving === "payroll" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save</Button>}
          </form>
        </Panel>
      </div>
    </div>
  );
}
