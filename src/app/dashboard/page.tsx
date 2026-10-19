"use client";

import * as React from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { format, formatDistanceToNow, isAfter, startOfDay } from "date-fns";
import {
  ArrowUpRight, Briefcase, CalendarOff, Check, CheckSquare, Clock, FileText, GanttChartSquare, Loader2, Plug, Timer, Users, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { LiveClock, Stagger } from "@/components/motion";
import { PageHeader, Panel, StatTile } from "@/components/page-header";
import { cn } from "@/lib/utils";

type Approval = { id: string; kind: "leave" | "correction"; who: string; what: string; when: string };

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url);
    return r.ok ? r.json() : null;
  } catch {
    return null;
  }
}

const SHORTCUTS = [
  { href: "/attendance", icon: Clock, label: "Attendance" },
  { href: "/leave", icon: CalendarOff, label: "Leave" },
  { href: "/employees", icon: Users, label: "Directory" },
  { href: "/rota", icon: GanttChartSquare, label: "Shift rota" },
  { href: "/projects", icon: Briefcase, label: "Projects" },
  { href: "/tasks", icon: CheckSquare, label: "Tasks" },
  { href: "/docs", icon: FileText, label: "Knowledge" },
  { href: "/integrations", icon: Plug, label: "Integrations", roles: ["ADMIN", "HR"] },
];

export default function DashboardPage() {
  const { data: session } = useSession();
  const { toast } = useToast();
  const userId = session?.user?.id;
  const role = session?.user?.role ?? "USER";
  const isManager = ["ADMIN", "HR", "PM"].includes(role);
  const firstName = (session?.user?.name || "there").split(" ")[0];

  const [loading, setLoading] = React.useState(true);
  const [attendance, setAttendance] = React.useState<{ logs: any[]; metrics: any } | null>(null);
  const [balances, setBalances] = React.useState<any[]>([]);
  const [tasks, setTasks] = React.useState<any[]>([]);
  const [myLeave, setMyLeave] = React.useState<any[]>([]);
  const [approvals, setApprovals] = React.useState<Approval[]>([]);
  const [notifications, setNotifications] = React.useState<any[]>([]);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [today, setToday] = React.useState("");

  const load = React.useCallback(async () => {
    if (!userId) return;
    const [att, bal, tsk, leave, corrections, notes] = await Promise.all([
      getJson<any>(`/api/attendance?startDate=${startOfDay(new Date()).toISOString()}`),
      getJson<any[]>("/api/leave/balance"),
      getJson<any[]>(`/api/tasks?assigneeId=${userId}`),
      getJson<any[]>("/api/leave/requests"),
      isManager ? getJson<any[]>("/api/attendance/requests") : Promise.resolve([]),
      getJson<any[]>("/api/notifications"),
    ]);
    setAttendance(att);
    setBalances(bal ?? []);
    setTasks((tsk ?? []).filter((t) => t.status !== "DONE"));
    const leaveList = leave ?? [];
    setMyLeave(leaveList.filter((r) => r.userId === userId && r.status !== "REJECTED" && r.status !== "CANCELLED" && isAfter(new Date(r.endDate), startOfDay(new Date()))).slice(0, 4));
    if (isManager) {
      setApprovals([
        ...leaveList.filter((r) => r.status === "PENDING" && r.userId !== userId).map((r) => ({
          id: r.id, kind: "leave" as const, who: r.user?.name ?? "Employee",
          what: `${r.type.toLowerCase()} leave · ${r.duration} day${r.duration === 1 ? "" : "s"}`,
          when: `${format(new Date(r.startDate), "d MMM")}${r.startDate !== r.endDate ? ` – ${format(new Date(r.endDate), "d MMM")}` : ""}`,
        })),
        ...(corrections ?? []).filter((r) => r.status === "PENDING" && r.userId !== userId).map((r) => ({
          id: r.id, kind: "correction" as const, who: r.user?.name ?? "Employee",
          what: `attendance correction · ${r.type.toLowerCase().replace("_", " ")}`,
          when: format(new Date(r.date), "d MMM, HH:mm"),
        })),
      ]);
    }
    setNotifications((notes ?? []).slice(0, 5));
    setLoading(false);
  }, [userId, isManager]);

  React.useEffect(() => {
    setToday(format(new Date(), "EEEE, d MMMM yyyy"));
    load();
  }, [load]);

  const decide = async (a: Approval, status: "APPROVED" | "REJECTED") => {
    setBusy(a.id + status);
    try {
      const res = a.kind === "leave"
        ? await fetch(`/api/leave/requests/${a.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) })
        : await fetch("/api/attendance/requests", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: a.id, status }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Not changed.");
      toast({ title: status === "APPROVED" ? "Approved" : "Rejected", description: `${a.who}: ${a.what}` });
      setApprovals((list) => list.filter((x) => x.id !== a.id));
    } catch (e) {
      toast({ variant: "destructive", title: "Not changed", description: e instanceof Error ? e.message : "" });
    } finally {
      setBusy(null);
    }
  };

  const openSession = attendance?.logs?.find((l) => !l.logoutTime);
  const metrics = attendance?.metrics;
  const available = balances.reduce((s, b) => s + (b.available ?? 0), 0);
  const casual = balances.find((b) => b.type === "CASUAL");

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={<span className="flex flex-wrap items-center gap-x-4 gap-y-1"><span>{today || " "}</span><LiveClock /></span>}
        title={`${greeting()}, ${firstName}.`}
        description={openSession ? `You've been clocked in since ${format(new Date(openSession.loginTime), "HH:mm")}${openSession.isWfh ? " (working from home)" : ""}.` : "You're not clocked in yet today."}
        actions={
          <>
            <Button asChild className="rounded-full"><Link href="/attendance"><Timer className="mr-2 h-4 w-4" />{openSession ? "Clock out" : "Clock in"}</Link></Button>
            <Button asChild variant="outline" className="rounded-full bg-card"><Link href="/leave">Request leave</Link></Button>
            <Button asChild variant="ghost" className="rounded-full"><Link href="/tasks">New task</Link></Button>
          </>
        }
      />

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-36 rounded-[var(--radius)]" />)}</div>
      ) : (
        <Stagger className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile label="Hours this week" value={metrics?.weeklyTotal ?? "0h 0m"} hint={`${metrics?.targetPercentage ?? 0}% of 40h target`} tone={(metrics?.targetPercentage ?? 0) >= 80 ? "good" : "default"} icon={Clock} href="/attendance" />
          <StatTile label="Attendance score" value={metrics?.attendanceScore ?? "0%"} hint="days present this week" icon={Timer} href="/attendance" />
          <StatTile label="Leave available" value={`${available}d`} hint={casual ? `${casual.available} casual left` : "across all types"} icon={CalendarOff} href="/leave" />
          {isManager
            ? <StatTile label="Waiting on you" value={approvals.length} hint={approvals.length ? "approvals pending" : "all clear"} tone={approvals.length ? "warn" : "good"} icon={Check} />
            : <StatTile label="Open tasks" value={tasks.length} hint={tasks.filter((t) => t.priority === "URGENT" || t.priority === "HIGH").length + " high priority"} icon={CheckSquare} href="/tasks" />}
        </Stagger>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {isManager && (
          <Panel title="Approvals" className="lg:col-span-2" action={<span className="pill text-muted-foreground">{approvals.length} pending</span>}>
            {loading ? <div className="p-5"><Skeleton className="h-24" /></div> : approvals.length === 0 ? (
              <p className="p-8 text-center text-sm text-muted-foreground">Nothing waiting. New leave requests and attendance corrections from your reports appear here.</p>
            ) : (
              <ul className="divide-y">
                {approvals.slice(0, 6).map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                    <span className={cn("pill", a.kind === "leave" ? "border-signal/30 bg-signal/10 text-signal" : "border-warning/30 bg-warning/10 text-warning")}>{a.kind}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{a.who}</p>
                      <p className="truncate text-sm text-muted-foreground">{a.what} · {a.when}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" className="rounded-full" disabled={!!busy} onClick={() => decide(a, "APPROVED")}>
                        {busy === a.id + "APPROVED" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="mr-1 h-4 w-4" />}Approve
                      </Button>
                      <Button size="sm" variant="outline" className="rounded-full" disabled={!!busy} onClick={() => decide(a, "REJECTED")} aria-label={`Reject ${a.who}`}>
                        {busy === a.id + "REJECTED" ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        )}

        <Panel title="My upcoming leave" className={isManager ? "" : "lg:col-span-1"} action={<Link href="/leave" className="eyebrow hover:text-foreground">View all</Link>}>
          {loading ? <div className="p-5"><Skeleton className="h-20" /></div> : myLeave.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">No leave booked. <Link href="/leave" className="text-signal hover:underline">Plan some time off</Link>.</p>
          ) : (
            <ul className="divide-y">
              {myLeave.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                  <div>
                    <p className="font-medium capitalize">{r.type.toLowerCase()} leave</p>
                    <p className="mono-num text-xs text-muted-foreground">{format(new Date(r.startDate), "d MMM")} – {format(new Date(r.endDate), "d MMM")} · {r.duration}d</p>
                  </div>
                  <span className={cn("pill", r.status === "APPROVED" ? "border-success/30 bg-success/10 text-success" : "border-warning/30 bg-warning/10 text-warning")}>{r.status.toLowerCase()}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="My tasks" className={isManager ? "lg:col-span-2" : "lg:col-span-2"} action={<Link href="/tasks" className="eyebrow hover:text-foreground">Board</Link>}>
          {loading ? <div className="p-5"><Skeleton className="h-24" /></div> : tasks.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">No open tasks assigned to you.</p>
          ) : (
            <ul className="divide-y">
              {tasks.slice(0, 6).map((t) => (
                <li key={t.id} className="flex items-center gap-3 px-5 py-3">
                  <span className="mono-num w-24 shrink-0 text-xs text-muted-foreground">{t.key}</span>
                  <span className="min-w-0 flex-1 truncate">{t.title}</span>
                  <span className="pill hidden text-muted-foreground sm:inline-flex">{t.status.replace("_", " ").toLowerCase()}</span>
                  <span className={cn("h-2 w-2 shrink-0 rounded-full", t.priority === "URGENT" ? "bg-destructive" : t.priority === "HIGH" ? "bg-warning" : t.priority === "MEDIUM" ? "bg-signal" : "bg-border")} title={t.priority} />
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Recent activity">
          {loading ? <div className="p-5"><Skeleton className="h-24" /></div> : notifications.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">You're all caught up.</p>
          ) : (
            <ul className="divide-y">
              {notifications.map((n) => (
                <li key={n.id} className="px-5 py-3">
                  <p className={cn("text-sm font-medium", n.read && "text-muted-foreground")}>{n.title}</p>
                  <p className="line-clamp-1 text-xs text-muted-foreground">{n.description}</p>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">{formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}</p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <section>
        <p className="eyebrow mb-3">Jump to</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
          {SHORTCUTS.filter((s) => !s.roles || s.roles.includes(role)).map((s) => (
            <Link key={s.href} href={s.href}
              className="group surface flex items-center justify-between gap-2 px-4 py-3 text-sm font-medium transition-colors hover:border-foreground/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <span className="flex items-center gap-2"><s.icon className="h-4 w-4 text-muted-foreground" />{s.label}</span>
              <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
