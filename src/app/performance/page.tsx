"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { format, formatDistanceToNow } from "date-fns";
import { Heart, Loader2, MessageSquarePlus, Plus, Rocket, Star, Target, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { EmptyState, FieldLabel, PageHeader, Panel, PersonAvatar, Segmented, Stat, StatGrid, StatusPill } from "@/components/page";
import { UpgradeNotice, api, useApi } from "@/components/use-api";

type Tab = "goals" | "reviews" | "feedback" | "cycles";
const GOAL_TONE: Record<string, string> = { ON_TRACK: "ACTIVE", AT_RISK: "PENDING", OFF_TRACK: "REJECTED", COMPLETED: "DONE" };
const nice = (s: string) => s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, " ");

function GoalDialog({ onClose, onSaved, people, isManager }: { onClose: () => void; onSaved: () => void; people: any[]; isManager: boolean }) {
  const { toast } = useToast();
  const { data: session } = useSession();
  const [form, setForm] = React.useState({ title: "", description: "", scope: "INDIVIDUAL", ownerId: session?.user?.id ?? "", dueDate: "" });
  const [krs, setKrs] = React.useState([{ title: "", targetValue: "100", unit: "%" }]);
  const [saving, setSaving] = React.useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api("/api/performance/goals", {
        method: "POST",
        json: { ...form, description: form.description || null, dueDate: form.dueDate || null, keyResults: krs.filter(k => k.title.trim()).map(k => ({ title: k.title, unit: k.unit, targetValue: Number(k.targetValue) })) },
      });
      toast({ title: "Goal created" });
      onSaved();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Not created", description: err.message });
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader><DialogTitle>New goal</DialogTitle><DialogDescription>Progress comes from key results: check them in as you go.</DialogDescription></DialogHeader>
          <div className="space-y-2"><FieldLabel htmlFor="g-title">Objective</FieldLabel><Input id="g-title" required minLength={2} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Cut new-hire onboarding time in half" /></div>
          <div className="space-y-2"><FieldLabel htmlFor="g-desc">Why it matters</FieldLabel><Textarea id="g-desc" rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2"><FieldLabel>Level</FieldLabel>
              <Select value={form.scope} onValueChange={v => setForm({ ...form, scope: v })}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="INDIVIDUAL">Individual</SelectItem><SelectItem value="TEAM">Team</SelectItem>{isManager && <SelectItem value="COMPANY">Company</SelectItem>}</SelectContent></Select>
            </div>
            <div className="space-y-2"><FieldLabel>Owner</FieldLabel>
              <Select value={form.ownerId} onValueChange={v => setForm({ ...form, ownerId: v })}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{people.map(p => <SelectItem key={p.id} value={p.id}>{p.id === session?.user?.id ? "Me" : p.name}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="space-y-2"><FieldLabel htmlFor="g-due">Due</FieldLabel><Input id="g-due" type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} /></div>
          </div>
          <div className="space-y-2">
            <FieldLabel>Key results</FieldLabel>
            {krs.map((k, i) => (
              <div key={i} className="grid grid-cols-[1fr_90px_70px] gap-2">
                <Input aria-label="Key result" placeholder="Average onboarding days" value={k.title} onChange={e => setKrs(krs.map((x, j) => j === i ? { ...x, title: e.target.value } : x))} />
                <Input aria-label="Target" type="number" value={k.targetValue} onChange={e => setKrs(krs.map((x, j) => j === i ? { ...x, targetValue: e.target.value } : x))} />
                <Input aria-label="Unit" value={k.unit} onChange={e => setKrs(krs.map((x, j) => j === i ? { ...x, unit: e.target.value } : x))} />
              </div>
            ))}
            {krs.length < 5 && <Button type="button" size="sm" variant="ghost" onClick={() => setKrs([...krs, { title: "", targetValue: "100", unit: "%" }])}><Plus className="mr-1 h-3.5 w-3.5" />Key result</Button>}
          </div>
          <DialogFooter><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create goal</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function GoalCard({ goal, onChanged, canEdit }: { goal: any; onChanged: () => void; canEdit: boolean }) {
  const { toast } = useToast();
  const checkIn = async (krId: string, value: string) => {
    try { await api(`/api/performance/key-results/${krId}`, { method: "PATCH", json: { currentValue: Number(value) } }); onChanged(); }
    catch (e: any) { toast({ variant: "destructive", title: "Not saved", description: e.message }); }
  };
  const setStatus = async (status: string) => {
    try { await api(`/api/performance/goals/${goal.id}`, { method: "PATCH", json: { status } }); onChanged(); }
    catch (e: any) { toast({ variant: "destructive", title: "Not saved", description: e.message }); }
  };
  return (
    <div className="rounded-2xl border bg-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono-label text-muted-foreground">{nice(goal.scope)}{goal.dueDate ? ` · due ${format(new Date(goal.dueDate), "d MMM")}` : ""}</p>
          <h3 className="mt-1 text-lg font-semibold tracking-tight">{goal.title}</h3>
          {goal.description && <p className="mt-1 text-sm text-muted-foreground">{goal.description}</p>}
        </div>
        <div className="flex items-center gap-2">
          <PersonAvatar name={goal.owner.name} image={goal.owner.image} size="sm" />
          {canEdit ? (
            <Select value={goal.status} onValueChange={setStatus}><SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>{Object.keys(GOAL_TONE).map(s => <SelectItem key={s} value={s}>{nice(s)}</SelectItem>)}</SelectContent></Select>
          ) : <StatusPill status={GOAL_TONE[goal.status]} label={nice(goal.status)} />}
        </div>
      </div>
      <div className="mt-5 flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-signal transition-[width] duration-700" style={{ width: `${goal.progress}%` }} /></div>
        <span className="w-12 text-right font-mono text-sm tabular-nums">{Math.round(goal.progress)}%</span>
      </div>
      {goal.keyResults.length > 0 && (
        <ul className="mt-5 space-y-2 border-t pt-4">
          {goal.keyResults.map((k: any) => (
            <li key={k.id} className="flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0 flex-1 truncate">{k.title}</span>
              {canEdit ? (
                <Input aria-label={`Current value for ${k.title}`} type="number" defaultValue={k.currentValue} className="h-8 w-24 text-right" onBlur={e => Number(e.target.value) !== k.currentValue && checkIn(k.id, e.target.value)} />
              ) : <span className="tabular-nums">{k.currentValue}</span>}
              <span className="w-24 font-mono text-xs text-muted-foreground">/ {k.targetValue} {k.unit}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ReviewDialog({ review, onClose, onSaved }: { review: any; onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast();
  const [rating, setRating] = React.useState(0);
  const [answers, setAnswers] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);
  const questions: { id: string; text: string }[] = review.cycle.questions ?? [];
  const submit = async () => {
    setSaving(true);
    try { await api(`/api/performance/reviews/${review.id}`, { method: "POST", json: { rating, answers } }); toast({ title: "Review submitted" }); onSaved(); }
    catch (e: any) { toast({ variant: "destructive", title: "Not submitted", description: e.message }); }
    finally { setSaving(false); }
  };
  const who = review.kind === "SELF" ? "Self review" : `${nice(review.kind)} review of ${review.reviewee.name}`;
  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{who}</DialogTitle><DialogDescription>{review.cycle.name}</DialogDescription></DialogHeader>
        <div className="space-y-5">
          {questions.map(q => (
            <div key={q.id} className="space-y-2"><FieldLabel htmlFor={`q-${q.id}`}>{q.text}</FieldLabel><Textarea id={`q-${q.id}`} rows={3} value={answers[q.id] ?? ""} onChange={e => setAnswers({ ...answers, [q.id]: e.target.value })} /></div>
          ))}
          <div className="space-y-2">
            <FieldLabel>Overall rating</FieldLabel>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} type="button" aria-label={`${n} stars`} onClick={() => setRating(n)} className="rounded p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Star className={`h-6 w-6 ${n <= rating ? "fill-signal text-signal" : "text-muted-foreground"}`} />
                </button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter><Button variant="ghost" onClick={onClose}>Later</Button><Button disabled={!rating || saving} onClick={submit}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Submit review</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CyclesTab() {
  const { toast } = useToast();
  const cycles = useApi<any[]>("/api/performance/cycles");
  const [form, setForm] = React.useState({ name: "", startDate: "", endDate: "", includePeer: false });
  const [saving, setSaving] = React.useState(false);
  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try { await api("/api/performance/cycles", { method: "POST", json: form }); setForm({ name: "", startDate: "", endDate: "", includePeer: false }); cycles.reload(); }
    catch (err: any) { toast({ variant: "destructive", title: "Not created", description: err.message }); }
    finally { setSaving(false); }
  };
  const act = async (id: string, action: "launch" | "close") => {
    try { const r = await api(`/api/performance/cycles/${id}`, { method: "PATCH", json: { action } }); toast({ title: action === "launch" ? `Launched: ${r.reviews} reviews assigned` : "Cycle closed" }); cycles.reload(); }
    catch (err: any) { toast({ variant: "destructive", title: "Not done", description: err.message }); }
  };
  return (
    <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
      <Panel title="New review cycle" description="Launching assigns a self review and a manager review to every active employee.">
        <form onSubmit={create} className="space-y-3 p-6">
          <div className="space-y-2"><FieldLabel htmlFor="c-name">Name</FieldLabel><Input id="c-name" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="H2 2026 review" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><FieldLabel htmlFor="c-start">Starts</FieldLabel><Input id="c-start" type="date" required value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} /></div>
            <div className="space-y-2"><FieldLabel htmlFor="c-end">Ends</FieldLabel><Input id="c-end" type="date" required value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} /></div>
          </div>
          <label className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">Allow peer reviews<Switch checked={form.includePeer} onCheckedChange={v => setForm({ ...form, includePeer: v })} /></label>
          <Button type="submit" className="w-full" disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create cycle</Button>
        </form>
      </Panel>
      <Panel title="Cycles" bodyClassName="p-0">
        {!(cycles.data ?? []).length ? <EmptyState icon={Rocket} title="No cycles yet" /> : (
          <ul>
            {cycles.data!.map(c => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 border-b px-6 py-4 last:border-0">
                <div><p className="font-medium">{c.name}</p><p className="font-mono-label text-muted-foreground">{format(new Date(c.startDate), "d MMM")} – {format(new Date(c.endDate), "d MMM yyyy")} · {c._count.reviews} reviews</p></div>
                <div className="flex items-center gap-2">
                  <StatusPill status={c.status === "DRAFT" ? "PENDING" : c.status === "ACTIVE" ? "IN_PROGRESS" : "DONE"} label={c.status} />
                  {c.status === "DRAFT" && <Button size="sm" onClick={() => act(c.id, "launch")}>Launch</Button>}
                  {c.status === "ACTIVE" && <Button size="sm" variant="outline" onClick={() => act(c.id, "close")}>Close</Button>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

export default function PerformancePage() {
  const { data: session } = useSession();
  const { toast } = useToast();
  const role = session?.user?.role ?? "USER";
  const isHr = ["ADMIN", "HR"].includes(role);
  const isManager = isHr || role === "PM";
  const [tab, setTab] = React.useState<Tab>("goals");
  const [scope, setScope] = React.useState<"mine" | "team" | "company">("mine");
  const [newGoal, setNewGoal] = React.useState(false);
  const [writing, setWriting] = React.useState<any | null>(null);
  const [fb, setFb] = React.useState({ toId: "", body: "", kind: "PRAISE", visibility: "PUBLIC" });

  const goals = useApi<any[]>(tab === "goals" ? `/api/performance/goals?scope=${scope}` : null);
  const reviews = useApi<any>(tab === "reviews" ? "/api/performance/reviews" : null);
  const feedback = useApi<any[]>(tab === "feedback" ? "/api/performance/feedback" : null);
  const people = useApi<any[]>("/api/employees");

  const gate = goals.error ?? reviews.error ?? feedback.error;
  if (gate?.status === 402) return <div className="space-y-8"><PageHeader eyebrow="People · Performance" title="Performance" /><UpgradeNotice error={gate} isAdmin={role === "ADMIN"} /></div>;

  const me = session?.user?.id;
  const reportIds = new Set((people.data ?? []).filter(p => p.managerId === me).map(p => p.id));
  const goalList = goals.data ?? [];
  const avg = goalList.length ? Math.round(goalList.reduce((a, g) => a + g.progress, 0) / goalList.length) : 0;
  const pending = (reviews.data?.toWrite ?? []).filter((r: any) => r.status === "PENDING");

  const sendFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await api("/api/performance/feedback", { method: "POST", json: fb }); setFb({ ...fb, body: "" }); toast({ title: "Feedback sent" }); feedback.reload(); }
    catch (err: any) { toast({ variant: "destructive", title: "Not sent", description: err.message }); }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="People · Performance"
        title="Performance"
        description="Goals with measurable key results, review cycles and continuous feedback."
        actions={<>
          <Segmented value={tab} onChange={setTab} options={[{ value: "goals", label: "Goals" }, { value: "reviews", label: "Reviews" }, { value: "feedback", label: "Feedback" }, ...(isHr ? [{ value: "cycles" as Tab, label: "Cycles" }] : [])]} />
          {tab === "goals" && <Button onClick={() => setNewGoal(true)}><Plus className="mr-2 h-4 w-4" />New goal</Button>}
        </>}
      />

      {tab === "goals" && (
        <>
          <StatGrid>
            <Stat label="Goals" value={goalList.length} icon={Target} />
            <Stat label="Average progress" value={`${avg}%`} progress={avg} tone="signal" />
            <Stat label="At risk" value={goalList.filter(g => g.status === "AT_RISK" || g.status === "OFF_TRACK").length} tone="warn" />
            <Stat label="Completed" value={goalList.filter(g => g.status === "COMPLETED").length} tone="ok" />
          </StatGrid>
          <Segmented value={scope} onChange={setScope} options={[{ value: "mine", label: "Mine" }, { value: "team", label: "Team" }, { value: "company", label: "Company" }]} />
          {goals.loading && !goalList.length ? <p className="text-sm text-muted-foreground">Loading goals…</p> : goalList.length === 0 ? (
            <Panel><EmptyState icon={Target} title="No goals here yet" description="Set an objective with two or three key results you can measure." action={<Button variant="outline" onClick={() => setNewGoal(true)}>New goal</Button>} /></Panel>
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {goalList.map(g => <GoalCard key={g.id} goal={g} onChanged={goals.reload} canEdit={g.ownerId === me || isHr || reportIds.has(g.ownerId)} />)}
            </div>
          )}
        </>
      )}

      {tab === "reviews" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Panel title="To write" description={pending.length ? `${pending.length} waiting on you` : "Nothing waiting on you."} bodyClassName="p-0">
            {(reviews.data?.toWrite ?? []).length === 0 ? <EmptyState icon={Star} title="No reviews assigned" description="Reviews appear here when HR launches a review cycle." /> : (
              <ul>
                {reviews.data.toWrite.map((r: any) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 border-b px-6 py-4 last:border-0">
                    <div className="flex items-center gap-3"><PersonAvatar name={r.reviewee.name} image={r.reviewee.image} size="sm" /><div><p className="font-medium">{r.kind === "SELF" ? "Self review" : r.reviewee.name}</p><p className="font-mono-label text-muted-foreground">{r.cycle.name} · {nice(r.kind)}</p></div></div>
                    {r.status === "PENDING" ? <Button size="sm" disabled={r.cycle.status !== "ACTIVE"} onClick={() => setWriting(r)}>Write</Button> : <StatusPill status="DONE" label="Submitted" />}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel title="About me" description="Submitted self and manager reviews." bodyClassName="p-0">
            {(reviews.data?.aboutMe ?? []).length === 0 ? <EmptyState title="Nothing shared yet" /> : (
              <ul>
                {reviews.data.aboutMe.map((r: any) => (
                  <li key={r.id} className="border-b px-6 py-4 last:border-0">
                    <div className="flex items-center justify-between"><p className="font-medium">{r.cycle.name} · {nice(r.kind)}</p><span className="flex">{Array.from({ length: 5 }).map((_, i) => <Star key={i} className={`h-4 w-4 ${i < (r.rating ?? 0) ? "fill-signal text-signal" : "text-muted-foreground"}`} />)}</span></div>
                    {Object.entries(r.answers ?? {}).map(([q, a]) => (<p key={q} className="mt-2 text-sm text-muted-foreground">{String(a)}</p>))}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      )}

      {tab === "feedback" && (
        <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
          <Panel title="Give feedback">
            <form onSubmit={sendFeedback} className="space-y-3 p-6">
              <Select value={fb.toId} onValueChange={v => setFb({ ...fb, toId: v })}><SelectTrigger aria-label="Colleague"><SelectValue placeholder="Choose a colleague" /></SelectTrigger>
                <SelectContent>{(people.data ?? []).filter(p => p.id !== me && p.isActive !== false).map(p => <SelectItem key={p.id} value={p.id}>{p.name ?? p.email}</SelectItem>)}</SelectContent></Select>
              <Segmented value={fb.kind as "PRAISE" | "CONSTRUCTIVE"} onChange={v => setFb({ ...fb, kind: v, visibility: v === "CONSTRUCTIVE" ? "PRIVATE" : fb.visibility })} options={[{ value: "PRAISE", label: "Praise", icon: Heart }, { value: "CONSTRUCTIVE", label: "Suggestion", icon: MessageSquarePlus }]} />
              <Textarea aria-label="Feedback" rows={4} required minLength={3} value={fb.body} onChange={e => setFb({ ...fb, body: e.target.value })} placeholder="Be specific: what happened and why it mattered." />
              {fb.kind === "PRAISE" && <label className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">Show on the praise wall<Switch checked={fb.visibility === "PUBLIC"} onCheckedChange={v => setFb({ ...fb, visibility: v ? "PUBLIC" : "PRIVATE" })} /></label>}
              <p className="text-xs text-muted-foreground">Suggestions are private to the recipient and their manager.</p>
              <Button type="submit" className="w-full" disabled={!fb.toId}>Send</Button>
            </form>
          </Panel>
          <Panel title="Feedback" bodyClassName="p-0">
            {(feedback.data ?? []).length === 0 ? <EmptyState icon={Heart} title="No feedback yet" description="Recognise a colleague for something specific." /> : (
              <ul>
                {feedback.data!.map(f => (
                  <li key={f.id} className="flex gap-3 border-b px-6 py-4 last:border-0">
                    <PersonAvatar name={f.from.name} image={f.from.image} size="sm" />
                    <div className="min-w-0">
                      <p className="text-sm"><span className="font-medium">{f.from.name}</span> <span className="text-muted-foreground">to</span> <span className="font-medium">{f.to.name}</span>{f.kind === "CONSTRUCTIVE" && <span className="ml-2 font-mono-label text-muted-foreground">private</span>}</p>
                      <p className="mt-1 text-sm">{f.body}</p>
                      <p className="mt-1 font-mono-label text-muted-foreground">{formatDistanceToNow(new Date(f.createdAt), { addSuffix: true })}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      )}

      {tab === "cycles" && isHr && <CyclesTab />}

      {newGoal && <GoalDialog isManager={isManager} people={(people.data ?? []).filter(p => p.id === me || reportIds.has(p.id) || isHr)} onClose={() => setNewGoal(false)} onSaved={() => { setNewGoal(false); goals.reload(); }} />}
      {writing && <ReviewDialog review={writing} onClose={() => setWriting(null)} onSaved={() => { setWriting(null); reviews.reload(); }} />}
    </div>
  );
}
