"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { CalendarIcon, Check, X, Download, Briefcase, HeartPulse, Sparkles, Plane, Loader2, CalendarOff, Ban } from "lucide-react";
import { format, isAfter, startOfDay } from "date-fns";
import type { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { PageHeader, StatGrid, Stat, Panel, EmptyState, StatusPill, FieldLabel, downloadCsv } from "@/components/page";
import { EASE } from "@/components/motion";

type LeaveType = "CASUAL" | "SICK" | "EARNED";
type LeaveStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

interface LeaveBalance {
    id: string;
    type: string;
    total: number;
    used: number;
    available: number;
}

interface LeaveRequest {
    id: string;
    userId: string;
    type: string;
    startDate: string;
    endDate: string;
    status: LeaveStatus;
    reason: string | null;
    isHalfDay: boolean;
    duration: number;
    createdAt: string;
    user: { name: string; image: string | null; role: string };
    approver?: { name: string };
}

const TYPE_META: Record<string, { label: string; icon: typeof Plane }> = {
    CASUAL: { label: "Casual", icon: Sparkles },
    SICK: { label: "Sick", icon: HeartPulse },
    EARNED: { label: "Earned", icon: Briefcase },
};
const typeLabel = (t: string) => TYPE_META[t]?.label ?? t.charAt(0) + t.slice(1).toLowerCase();

/** Mirrors the server: leave is charged for weekdays only (holidays are also excluded server-side). */
function weekdaysInRange(from: Date, to: Date) {
    let n = 0;
    const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
    const end = new Date(to.getFullYear(), to.getMonth(), to.getDate());
    while (d <= end) {
        const dow = d.getDay();
        if (dow !== 0 && dow !== 6) n++;
        d.setDate(d.getDate() + 1);
    }
    return n;
}

const dateSpan = (s: string, e: string) => {
    const a = new Date(s), b = new Date(e);
    return format(a, "yyyy-MM-dd") === format(b, "yyyy-MM-dd") ? format(a, "MMM d, yyyy") : `${format(a, "MMM d")} – ${format(b, "MMM d, yyyy")}`;
};

export default function LeavePage() {
    const { data: session } = useSession();
    const { toast } = useToast();

    const [balances, setBalances] = useState<LeaveBalance[]>([]);
    const [myRequests, setMyRequests] = useState<LeaveRequest[]>([]);
    const [pendingRequests, setPendingRequests] = useState<LeaveRequest[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [tab, setTab] = useState("my-leaves");

    const [dateRange, setDateRange] = useState<DateRange | undefined>();
    const [leaveType, setLeaveType] = useState<LeaveType>("CASUAL");
    const [reason, setReason] = useState("");
    const [isHalfDay, setIsHalfDay] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const isManagerOrAdmin = session?.user?.role === "ADMIN" || session?.user?.role === "HR" || session?.user?.role === "PM";

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [balanceRes, myReqsRes] = await Promise.all([
                fetch("/api/leave/balance"),
                fetch("/api/leave/requests")
            ]);

            if (balanceRes.ok) setBalances(await balanceRes.json());
            if (myReqsRes.ok) {
                const reqs = await myReqsRes.json();
                setMyRequests(reqs.filter((r: LeaveRequest) => r.userId === session?.user?.id));
                if (isManagerOrAdmin) {
                    setPendingRequests(reqs.filter((r: LeaveRequest) => r.status === "PENDING" && r.userId !== session?.user?.id));
                }
            }
        } catch (error) {
            console.error("Fetch error:", error);
        } finally {
            setIsLoading(false);
        }
    }, [session?.user?.id, isManagerOrAdmin]);

    useEffect(() => {
        if (session) fetchData();
    }, [session, fetchData]);

    const requestedDays = (() => {
        if (isHalfDay) return 0.5;
        if (!dateRange?.from) return 0;
        return weekdaysInRange(dateRange.from, dateRange.to ?? dateRange.from);
    })();
    const selectedBalance = balances.find(b => b.type === leaveType);
    const afterRequest = selectedBalance ? selectedBalance.available - requestedDays : null;

    const handleRequestLeave = async () => {
        if (!dateRange?.from) {
            toast({ variant: "destructive", title: "Pick your dates", description: "Select the day or range you'll be away." });
            return;
        }
        if (requestedDays === 0) {
            toast({ variant: "destructive", title: "No working days selected", description: "The range only covers a weekend." });
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await fetch("/api/leave/requests", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    type: leaveType,
                    startDate: dateRange.from.toISOString(),
                    endDate: (dateRange.to || dateRange.from).toISOString(),
                    reason,
                    isHalfDay,
                    duration: requestedDays
                })
            });

            if (res.ok) {
                toast({ title: "Request submitted", description: "Your manager has been notified." });
                setDateRange(undefined);
                setReason("");
                setIsHalfDay(false);
                setTab("my-leaves");
                fetchData();
            } else {
                const err = await res.json().catch(() => ({}));
                toast({ variant: "destructive", title: "Request failed", description: err.error || "Could not submit request." });
            }
        } catch (error) {
            toast({ variant: "destructive", title: "Error", description: "Something went wrong." });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleAction = async (requestId: string, status: LeaveStatus) => {
        setBusyId(requestId);
        try {
            const res = await fetch(`/api/leave/requests/${requestId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status })
            });

            if (res.ok) {
                toast({ title: `Request ${status.toLowerCase()}` });
                fetchData();
            } else {
                const err = await res.json().catch(() => ({}));
                toast({ variant: "destructive", title: "Action failed", description: err.error });
            }
        } catch (error) {
            toast({ variant: "destructive", title: "Error", description: "Something went wrong." });
        } finally {
            setBusyId(null);
        }
    };

    const canCancel = (r: LeaveRequest) =>
        (r.status === "PENDING" || r.status === "APPROVED") && isAfter(new Date(r.startDate), startOfDay(new Date()));

    const exportHistory = () => downloadCsv(`leave-history-${format(new Date(), "yyyy-MM-dd")}.csv`, myRequests.map(r => ({
        type: r.type, start: format(new Date(r.startDate), "yyyy-MM-dd"), end: format(new Date(r.endDate), "yyyy-MM-dd"),
        days: r.duration, halfDay: r.isHalfDay, status: r.status, approver: r.approver?.name ?? "", reason: r.reason ?? "",
    })));

    const upcoming = myRequests
        .filter(r => r.status === "APPROVED" && isAfter(new Date(r.endDate), new Date()))
        .sort((a, b) => +new Date(a.startDate) - +new Date(b.startDate))[0];

    return (
        <div className="space-y-8">
            <PageHeader
                eyebrow="Workforce · Leave"
                title="Time off"
                description="Balances, requests and approvals in one place."
                actions={
                    <>
                        <Button variant="outline" onClick={exportHistory} disabled={myRequests.length === 0}>
                            <Download className="h-4 w-4" /> Export history
                        </Button>
                        <Button onClick={() => setTab("request")}><Plane className="h-4 w-4" /> Request leave</Button>
                    </>
                }
            />

            {/* Balances */}
            {isLoading && balances.length === 0 ? (
                <div className="grid gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-3">
                    {[0, 1, 2].map(i => <div key={i} className="h-[150px] animate-pulse bg-card" />)}
                </div>
            ) : balances.length > 0 ? (
                <StatGrid>
                    {balances.map((b) => {
                        const meta = TYPE_META[b.type];
                        return (
                            <Stat
                                key={b.id}
                                label={`${typeLabel(b.type)} leave`}
                                icon={meta?.icon}
                                value={<>{b.available}<span className="text-xl text-muted-foreground"> / {b.total}</span></>}
                                hint={`${b.used} used this year`}
                                progress={b.total ? (b.used / b.total) * 100 : 0}
                                tone="signal"
                            />
                        );
                    })}
                    {upcoming && (
                        <Stat label="Next time off" icon={Plane} value={format(new Date(upcoming.startDate), "MMM d")} hint={`${typeLabel(upcoming.type)} · ${upcoming.duration} day${upcoming.duration === 1 ? "" : "s"}`} />
                    )}
                </StatGrid>
            ) : (
                <Panel><EmptyState icon={CalendarOff} title="No leave balances yet" description="HR hasn't set up your allowances for this year." /></Panel>
            )}

            <Tabs value={tab} onValueChange={setTab} className="w-full">
                <TabsList className="mb-6">
                    <TabsTrigger value="my-leaves">History</TabsTrigger>
                    <TabsTrigger value="request">New request</TabsTrigger>
                    {isManagerOrAdmin && (
                        <TabsTrigger value="approvals" className="gap-2">
                            Approvals
                            {pendingRequests.length > 0 && <span className="rounded bg-destructive px-1.5 font-mono text-[10px] text-destructive-foreground">{pendingRequests.length}</span>}
                        </TabsTrigger>
                    )}
                </TabsList>

                <TabsContent value="my-leaves">
                    <Panel title="Your requests" description="Everything you've asked for this year and before." bodyClassName="p-0">
                        {myRequests.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-secondary/40">
                                        <tr className="border-b">
                                            {["Type", "Dates", "Days", "Status", "Reason", ""].map(h => (
                                                <th key={h} className="h-10 px-6 text-left font-mono text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {myRequests.map((req) => (
                                            <tr key={req.id} className="border-b last:border-0 hover:bg-secondary/40">
                                                <td className="px-6 py-4 font-medium">{typeLabel(req.type)}{req.isHalfDay && <span className="ml-2 text-xs text-muted-foreground">half day</span>}</td>
                                                <td className="px-6 py-4 text-muted-foreground">{dateSpan(req.startDate, req.endDate)}</td>
                                                <td className="px-6 py-4 font-mono tabular-nums">{req.duration}</td>
                                                <td className="px-6 py-4">
                                                    <StatusPill status={req.status} />
                                                    {req.approver && req.status !== "PENDING" && <p className="mt-1 text-xs text-muted-foreground">by {req.approver.name}</p>}
                                                </td>
                                                <td className="max-w-[240px] truncate px-6 py-4 text-muted-foreground">{req.reason || "—"}</td>
                                                <td className="px-6 py-4 text-right">
                                                    {canCancel(req) && (
                                                        <Button size="sm" variant="ghost" disabled={busyId === req.id} onClick={() => handleAction(req.id, "CANCELLED")}>
                                                            {busyId === req.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />} Cancel
                                                        </Button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <EmptyState icon={Plane} title="No leave taken yet" description="Requests you make will be listed here." action={<Button variant="outline" onClick={() => setTab("request")}>Request leave</Button>} />
                        )}
                    </Panel>
                </TabsContent>

                <TabsContent value="request">
                    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.3fr_1fr]">
                        <Panel title="New request" description="Your manager is notified as soon as you submit.">
                            <div className="space-y-6 p-6">
                                <div className="space-y-2">
                                    <FieldLabel>Leave type</FieldLabel>
                                    <div className="grid grid-cols-3 gap-2">
                                        {(Object.keys(TYPE_META) as LeaveType[]).map(t => {
                                            const meta = TYPE_META[t];
                                            const bal = balances.find(b => b.type === t);
                                            return (
                                                <button
                                                    key={t}
                                                    type="button"
                                                    onClick={() => setLeaveType(t)}
                                                    aria-pressed={leaveType === t}
                                                    className={cn(
                                                        "rounded-xl border p-4 text-left transition-colors",
                                                        leaveType === t ? "border-signal bg-signal/5" : "hover:bg-secondary"
                                                    )}
                                                >
                                                    <meta.icon className={cn("h-4 w-4", leaveType === t ? "text-signal" : "text-muted-foreground")} />
                                                    <p className="mt-3 font-medium">{meta.label}</p>
                                                    <p className="font-mono text-[11px] text-muted-foreground">{bal ? `${bal.available} left` : "—"}</p>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <FieldLabel>Dates</FieldLabel>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button variant="outline" className={cn("h-11 w-full justify-start gap-3 font-normal", !dateRange && "text-muted-foreground")}>
                                                <CalendarIcon className="h-4 w-4 text-signal" />
                                                {dateRange?.from ? (
                                                    dateRange.to && +dateRange.to !== +dateRange.from
                                                        ? <>{format(dateRange.from, "EEE, MMM d")} – {format(dateRange.to, "EEE, MMM d, y")}</>
                                                        : format(dateRange.from, "EEEE, MMM d, y")
                                                ) : "Select a day or range"}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <Calendar
                                                initialFocus
                                                mode="range"
                                                defaultMonth={dateRange?.from}
                                                selected={dateRange}
                                                onSelect={setDateRange}
                                                numberOfMonths={2}
                                                disabled={{ before: startOfDay(new Date()) }}
                                                className="p-3"
                                            />
                                        </PopoverContent>
                                    </Popover>
                                </div>

                                <label className="flex cursor-pointer items-center justify-between rounded-xl border p-4">
                                    <div>
                                        <p className="font-medium">Half day</p>
                                        <p className="text-sm text-muted-foreground">Away for the morning or afternoon only.</p>
                                    </div>
                                    <Switch checked={isHalfDay} onCheckedChange={setIsHalfDay} />
                                </label>

                                <div className="space-y-2">
                                    <FieldLabel htmlFor="leave-reason">Reason (optional)</FieldLabel>
                                    <Input id="leave-reason" placeholder="Family event, appointment, travel…" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
                                </div>

                                <Button onClick={handleRequestLeave} disabled={isSubmitting} className="h-11 w-full">
                                    {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />} Submit request
                                </Button>
                            </div>
                        </Panel>

                        <div className="space-y-6">
                            <section className="relative overflow-hidden rounded-2xl border bg-[hsl(228_45%_6%)] p-8 text-[hsl(225_38%_95%)] grain">
                                <p className="font-mono-label text-white/50">This request</p>
                                <AnimatePresence mode="wait">
                                    <motion.p
                                        key={requestedDays}
                                        initial={{ opacity: 0, y: 12 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -12 }}
                                        transition={{ duration: 0.35, ease: EASE }}
                                        className="mt-4 text-7xl font-semibold tabular-nums tracking-tight"
                                    >
                                        {requestedDays}
                                    </motion.p>
                                </AnimatePresence>
                                <p className="font-mono-label mt-1 text-white/50">working day{requestedDays === 1 ? "" : "s"} · {typeLabel(leaveType)}</p>
                                <div className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-white/10">
                                    <div className="bg-[hsl(228_45%_6%)] p-4">
                                        <p className="font-mono-label text-white/50">Available</p>
                                        <p className="mt-1 text-2xl font-semibold tabular-nums">{selectedBalance?.available ?? "—"}</p>
                                    </div>
                                    <div className="bg-[hsl(228_45%_6%)] p-4">
                                        <p className="font-mono-label text-white/50">After</p>
                                        <p className={cn("mt-1 text-2xl font-semibold tabular-nums", afterRequest !== null && afterRequest < 0 && "text-red-400")}>
                                            {afterRequest ?? "—"}
                                        </p>
                                    </div>
                                </div>
                                {afterRequest !== null && afterRequest < 0 && (
                                    <p className="mt-4 text-sm text-red-300">This is more than your remaining balance; it may be rejected or treated as unpaid.</p>
                                )}
                            </section>

                            <Panel title="Before you submit">
                                <ul className="space-y-3 p-6 text-sm text-muted-foreground">
                                    <li className="flex gap-3"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-signal" />Weekends and company holidays aren't charged against your balance.</li>
                                    <li className="flex gap-3"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-signal" />Approved leave is blocked out on the rota automatically.</li>
                                    <li className="flex gap-3"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-signal" />You can cancel a request any time before it starts; approved days are refunded.</li>
                                </ul>
                            </Panel>
                        </div>
                    </div>
                </TabsContent>

                {isManagerOrAdmin && (
                    <TabsContent value="approvals">
                        <Panel title="Waiting for you" description="Leave requests from people you manage." bodyClassName="p-0">
                            {pendingRequests.length > 0 ? (
                                <ul>
                                    <AnimatePresence initial={false}>
                                        {pendingRequests.map((req) => (
                                            <motion.li
                                                key={req.id}
                                                layout
                                                initial={{ opacity: 0, y: 8 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, x: 24 }}
                                                transition={{ ease: EASE }}
                                                className="flex flex-col gap-4 border-b px-6 py-5 last:border-0 md:flex-row md:items-center md:justify-between"
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className="flex h-10 w-10 items-center justify-center rounded-full border bg-secondary text-sm font-medium">
                                                        {req.user.name?.split(" ").map(p => p[0]).slice(0, 2).join("")}
                                                    </div>
                                                    <div>
                                                        <p className="font-medium">{req.user.name}</p>
                                                        <p className="text-sm text-muted-foreground">
                                                            {typeLabel(req.type)} · {req.duration} day{req.duration === 1 ? "" : "s"} · {dateSpan(req.startDate, req.endDate)}
                                                        </p>
                                                        {req.reason && <p className="mt-1 text-sm text-muted-foreground">“{req.reason}”</p>}
                                                    </div>
                                                </div>
                                                <div className="flex gap-2">
                                                    <Button variant="outline" size="sm" disabled={busyId === req.id} onClick={() => handleAction(req.id, "REJECTED")}>
                                                        <X className="h-4 w-4" /> Reject
                                                    </Button>
                                                    <Button size="sm" disabled={busyId === req.id} onClick={() => handleAction(req.id, "APPROVED")}>
                                                        {busyId === req.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Approve
                                                    </Button>
                                                </div>
                                            </motion.li>
                                        ))}
                                    </AnimatePresence>
                                </ul>
                            ) : (
                                <EmptyState icon={Check} title="All caught up" description="No leave requests are waiting for you." />
                            )}
                        </Panel>
                    </TabsContent>
                )}
            </Tabs>
        </div>
    );
}
