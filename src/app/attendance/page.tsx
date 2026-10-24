"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
    MapPin, Calendar as CalendarIcon, History, Timer, ArrowUpRight, ArrowDownLeft, Loader2,
    Home, Building2, ShieldCheck, AlertTriangle, ClipboardList, Users, Download, Check, X, Gauge,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, startOfDay, endOfDay, isToday, differenceInMinutes } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSession } from "next-auth/react";
import { PageHeader, StatGrid, Stat, Panel, EmptyState, StatusPill, FieldLabel, Segmented, PersonAvatar, downloadCsv } from "@/components/page";
import { EASE } from "@/components/motion";

const DAILY_TARGET_MINUTES = 480;
const fmtMinutes = (m: number) => `${Math.floor(m / 60)}h ${String(Math.round(m % 60)).padStart(2, "0")}m`;

export default function AttendancePage() {
    const { data: session } = useSession();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(true);
    const [isActionLoading, setIsActionLoading] = useState(false);
    const [isClockedIn, setIsClockedIn] = useState(false);
    const [isWfh, setIsWfh] = useState(false);
    const [elapsedTime, setElapsedTime] = useState("00:00:00");
    const [startTime, setStartTime] = useState<Date | null>(null);
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [logs, setLogs] = useState<any[]>([]);
    const [metrics, setMetrics] = useState<any>(null);
    const [settings, setSettings] = useState<any>(null);
    const [geoStatus, setGeoStatus] = useState<"valid" | "invalid" | "checking" | "error">("checking");
    const [requests, setRequests] = useState<any[]>([]);
    const [teamLogs, setTeamLogs] = useState<any[]>([]);
    const [approvalsPending, setApprovalsPending] = useState<any[]>([]);
    const [deciding, setDeciding] = useState<string | null>(null);
    const [tab, setTab] = useState("my-attendance");
    const [, setTick] = useState(0);

    const watchId = useRef<number | null>(null);

    const isPrivileged = session?.user?.role === "ADMIN" || session?.user?.role === "HR" || session?.user?.role === "PM";

    const fetchSettings = useCallback(async () => {
        try {
            const res = await fetch("/api/attendance/settings");
            if (res.ok) setSettings(await res.json());
        } catch (e) { }
    }, []);

    const fetchData = useCallback(async (date: Date) => {
        setIsLoading(true);
        try {
            const startDate = startOfDay(date).toISOString();
            const endDate = endOfDay(date).toISOString();
            const response = await fetch(`/api/attendance?startDate=${startDate}&endDate=${endDate}`);
            const data = await response.json();

            if (data.logs) {
                setLogs(data.logs);
                setMetrics(data.metrics);

                const activeLog = data.logs.find((l: any) => !l.logoutTime);
                if (activeLog) {
                    setIsClockedIn(true);
                    setStartTime(new Date(activeLog.loginTime));
                    setIsWfh(activeLog.isWfh);
                } else {
                    setIsClockedIn(false);
                    setStartTime(null);
                }
            }

            const reqRes = await fetch("/api/attendance/requests");
            if (reqRes.ok) {
                const reqData = await reqRes.json();
                setRequests(reqData.filter((r: any) => r.userId === session?.user?.id));
                if (isPrivileged) {
                    setApprovalsPending(reqData.filter((r: any) => r.status === "PENDING" && r.userId !== session?.user?.id));
                }
            }

            if (isPrivileged) {
                const teamRes = await fetch("/api/attendance?team=true");
                if (teamRes.ok) {
                    const teamData = await teamRes.json();
                    setTeamLogs(teamData.logs);
                }
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    }, [session, isPrivileged]);

    useEffect(() => {
        fetchSettings();
        fetchData(selectedDate);
    }, [selectedDate, fetchData, fetchSettings]);

    // Timer logic
    useEffect(() => {
        let interval: any;
        if (isClockedIn && startTime) {
            interval = setInterval(() => {
                const diff = new Date().getTime() - startTime.getTime();
                const hours = Math.floor(diff / 3600000);
                const minutes = Math.floor((diff % 3600000) / 60000);
                const seconds = Math.floor((diff % 60000) / 1000);
                setElapsedTime(
                    `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
                );
                setTick(t => t + 1);
            }, 1000);
        } else {
            setElapsedTime("00:00:00");
        }
        return () => clearInterval(interval);
    }, [isClockedIn, startTime]);

    // Office sessions end automatically when the person leaves the geofence; the server re-checks the distance.
    const autoClockOutPending = useRef(false);
    const autoClockOut = useCallback(async (lat: number, lng: number) => {
        const activeLog = logs.find((l: any) => !l.logoutTime);
        if (!activeLog || activeLog.isWfh || autoClockOutPending.current) return;
        autoClockOutPending.current = true;
        try {
            const res = await fetch(`/api/attendance/${activeLog.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ latitude: lat, longitude: lng, reason: "OUT_OF_RANGE" })
            });
            if (res.ok) {
                toast({ title: "Clocked out automatically", description: "You left the office radius during an office session. Submit a correction if this is wrong.", variant: "destructive" });
                fetchData(selectedDate);
            }
        } finally {
            autoClockOutPending.current = false;
        }
    }, [logs, fetchData, selectedDate, toast]);

    // Geofencing verification
    const checkGeofence = useCallback((lat: number, lng: number) => {
        if (!settings || isWfh) return setGeoStatus("valid");

        const dist = getDistance(lat, lng, settings.officeLat, settings.officeLng);
        if (dist <= settings.allowedRadius) {
            setGeoStatus("valid");
        } else {
            setGeoStatus("invalid");
            if (isClockedIn) {
                if (settings.autoLogoutOutOfRange !== false && settings.geofencingEnabled !== false) {
                    autoClockOut(lat, lng);
                } else {
                    toast({
                        title: "Out of Range",
                        description: "You've moved away from the office. Please stay in range or use WFH mode.",
                        variant: "destructive"
                    });
                }
            }
        }
    }, [settings, isWfh, isClockedIn, toast, autoClockOut]);

    useEffect(() => {
        if ("geolocation" in navigator) {
            watchId.current = navigator.geolocation.watchPosition(
                (pos) => { checkGeofence(pos.coords.latitude, pos.coords.longitude); },
                () => { setGeoStatus("error"); },
                { enableHighAccuracy: true }
            );
        }
        return () => { if (watchId.current) navigator.geolocation.clearWatch(watchId.current); };
    }, [checkGeofence]);

    const handleClockToggle = async () => {
        if (!isClockedIn && geoStatus === "invalid" && !isWfh) {
            toast({ title: "Clock-in Denied", description: "You are not within the office geofence.", variant: "destructive" });
            return;
        }

        setIsActionLoading(true);
        try {
            if (!isClockedIn) {
                const pos = await getCurrentPosition();
                const response = await fetch("/api/attendance", {
                    method: "POST",
                    body: JSON.stringify({
                        loginTime: new Date().toISOString(),
                        loginLocation: isWfh ? "Remote / Home" : "Corporate Office",
                        isWfh,
                        latitude: pos?.coords.latitude,
                        longitude: pos?.coords.longitude,
                        accuracy: pos?.coords.accuracy
                    })
                });
                if (response.ok) {
                    toast({ title: "Clocked In", description: `Active session started as ${isWfh ? 'WFH' : 'Office'}.` });
                    fetchData(selectedDate);
                } else {
                    const err = await response.json().catch(() => ({}));
                    toast({ title: "Clock-in Denied", description: err.error || "The server refused the clock-in.", variant: "destructive" });
                }
            } else {
                const activeLog = logs.find(l => !l.logoutTime);
                if (activeLog) {
                    const pos = await getCurrentPosition();
                    const response = await fetch(`/api/attendance/${activeLog.id}`, {
                        method: "PATCH",
                        body: JSON.stringify({
                            logoutTime: new Date().toISOString(),
                            logoutLocation: isWfh ? "Remote / Home" : "Corporate Office",
                            latitude: pos?.coords.latitude,
                            longitude: pos?.coords.longitude,
                            status: "LOGGED_OUT"
                        })
                    });
                    if (response.ok) {
                        toast({ title: "Clocked Out", description: "Session ended successfully." });
                        fetchData(selectedDate);
                    } else {
                        const err = await response.json().catch(() => ({}));
                        toast({ title: "Clock-out failed", description: err.error || "Try again.", variant: "destructive" });
                        fetchData(selectedDate);
                    }
                }
            }
        } catch (error) {
            toast({ title: "Error", description: "Operation failed.", variant: "destructive" });
        } finally {
            setIsActionLoading(false);
        }
    };

    const decideRequest = async (id: string, status: "APPROVED" | "REJECTED") => {
        setDeciding(id);
        try {
            const res = await fetch("/api/attendance/requests", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, status }),
            });
            if (res.ok) {
                toast({ title: status === "APPROVED" ? "Request approved" : "Request rejected" });
                fetchData(selectedDate);
            } else {
                const err = await res.json().catch(() => ({}));
                toast({ title: "Could not update request", description: err.error || "Try again.", variant: "destructive" });
            }
        } finally {
            setDeciding(null);
        }
    };

    // Derived figures (computed from real logs, not placeholders)
    const dayMinutes = logs.reduce((sum, l) => {
        const end = l.logoutTime ? new Date(l.logoutTime) : new Date();
        return sum + Math.max(0, differenceInMinutes(end, new Date(l.loginTime)));
    }, 0);
    const remainingMinutes = Math.max(0, DAILY_TARGET_MINUTES - dayMinutes);
    const dayProgress = Math.min(1, dayMinutes / DAILY_TARGET_MINUTES);
    const firstEntry = logs.length ? new Date(Math.min(...logs.map(l => new Date(l.loginTime).getTime()))) : null;

    const presence = useMemo(() => {
        const people = new Map<string, any>();
        for (const l of teamLogs) {
            const key = l.userId ?? l.user?.name;
            const prev = people.get(key);
            if (!prev || new Date(l.loginTime) > new Date(prev.loginTime)) people.set(key, l);
        }
        const latest = Array.from(people.values());
        const online = latest.filter(l => !l.logoutTime);
        return { total: latest.length, online: online.length, remote: online.filter(l => l.isWfh).length };
    }, [teamLogs]);

    const officeLabel = settings?.officeName || settings?.officeAddress || "Office geofence";

    const exportTeamCsv = () => downloadCsv(`attendance-${format(new Date(), "yyyy-MM-dd")}.csv`, teamLogs.map(l => ({
        name: l.user?.name ?? "",
        role: l.user?.role ?? "",
        mode: l.isWfh ? "WFH" : "Office",
        login: format(new Date(l.loginTime), "yyyy-MM-dd HH:mm"),
        logout: l.logoutTime ? format(new Date(l.logoutTime), "yyyy-MM-dd HH:mm") : "",
        minutes: differenceInMinutes(l.logoutTime ? new Date(l.logoutTime) : new Date(), new Date(l.loginTime)),
    })));

    const R = 104;
    const C = 2 * Math.PI * R;

    return (
        <div className="mx-auto max-w-[1600px] space-y-8">
            <PageHeader
                eyebrow={<>Workforce · Attendance · {format(selectedDate, "EEEE, d MMMM")}</>}
                title="Attendance"
                description="Clock in and out, track your hours against target, and request corrections."
                actions={
                    <>
                        <Segmented
                            value={isWfh ? "remote" : "office"}
                            onChange={(v) => !isClockedIn && setIsWfh(v === "remote")}
                            disabled={isClockedIn}
                            options={[{ value: "office", label: "Office", icon: Building2 }, { value: "remote", label: "Remote", icon: Home }]}
                        />
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" className="gap-2">
                                    <CalendarIcon className="h-4 w-4 text-signal" />
                                    {isToday(selectedDate) ? "Today" : format(selectedDate, "EEE, MMM d")}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-2" align="end">
                                <input
                                    type="date"
                                    className="rounded-lg bg-transparent p-2 outline-none"
                                    value={format(selectedDate, "yyyy-MM-dd")}
                                    onChange={(e) => e.target.value && setSelectedDate(new Date(e.target.value))}
                                />
                            </PopoverContent>
                        </Popover>
                    </>
                }
            />

            <Tabs value={tab} onValueChange={setTab} className="w-full">
                <TabsList className="mb-8">
                    <TabsTrigger value="my-attendance">My attendance</TabsTrigger>
                    <TabsTrigger value="regularization">Corrections</TabsTrigger>
                    {isPrivileged && (
                        <TabsTrigger value="manager" className="gap-2">
                            Team
                            {approvalsPending.length > 0 && (
                                <span className="rounded bg-destructive px-1.5 font-mono text-[10px] text-destructive-foreground">{approvalsPending.length}</span>
                            )}
                        </TabsTrigger>
                    )}
                </TabsList>

                <TabsContent value="my-attendance" className="space-y-8 focus-visible:outline-none">
                    <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
                        {/* Clock terminal */}
                        <section className="relative overflow-hidden rounded-2xl border bg-card lg:col-span-5 xl:col-span-4">
                            <div className="dotgrid absolute inset-0 opacity-50 [mask-image:radial-gradient(circle_at_50%_45%,#000,transparent_70%)]" />
                            <div className="relative flex items-center justify-between border-b px-6 py-4">
                                <p className="font-mono-label text-muted-foreground">Clock terminal</p>
                                <StatusPill status={isClockedIn ? "ONLINE" : "OFFLINE"} label={isClockedIn ? (isWfh ? "On · remote" : "On · office") : "Off"} />
                            </div>
                            <div className="relative flex flex-col items-center px-6 py-10">
                                <div className="relative h-[240px] w-[240px]">
                                    <svg viewBox="0 0 240 240" className="absolute inset-0 -rotate-90">
                                        <circle cx="120" cy="120" r={R} fill="none" stroke="hsl(var(--border))" strokeWidth="6" />
                                        <motion.circle
                                            cx="120" cy="120" r={R} fill="none" stroke="hsl(var(--signal))" strokeWidth="6" strokeLinecap="round"
                                            strokeDasharray={C}
                                            initial={{ strokeDashoffset: C }}
                                            animate={{ strokeDashoffset: C * (1 - dayProgress) }}
                                            transition={{ duration: 1.2, ease: EASE }}
                                        />
                                    </svg>
                                    <motion.button
                                        whileHover={{ scale: 1.03 }}
                                        whileTap={{ scale: 0.97 }}
                                        onClick={handleClockToggle}
                                        disabled={isActionLoading || isLoading}
                                        className={cn(
                                            "absolute inset-[22px] flex flex-col items-center justify-center rounded-full text-primary-foreground transition-colors disabled:opacity-70",
                                            isClockedIn ? "bg-destructive text-destructive-foreground" : "bg-primary"
                                        )}
                                    >
                                        {isActionLoading ? <Loader2 className="h-8 w-8 animate-spin" /> : (
                                            <>
                                                <span className="font-mono-label opacity-70">{isClockedIn ? "Tap to" : "Tap to"}</span>
                                                <span className="mt-1 text-3xl font-semibold tracking-tight">{isClockedIn ? "Clock out" : "Clock in"}</span>
                                            </>
                                        )}
                                    </motion.button>
                                    {isClockedIn && <span className="pointer-events-none absolute inset-[22px] animate-ping rounded-full bg-destructive/15" />}
                                </div>

                                <p className="mt-8 font-mono text-5xl font-medium tabular-nums tracking-tight">{elapsedTime}</p>
                                <p className="font-mono-label mt-2 text-muted-foreground">Current session</p>

                                <div className="mt-6 flex flex-col items-center gap-2">
                                    {isWfh ? (
                                        <StatusPill status="IN_PROGRESS" label="Remote mode" />
                                    ) : (
                                        <span className={cn(
                                            "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 font-mono text-[11px] uppercase tracking-wider ring-1 ring-inset",
                                            geoStatus === "valid" ? "bg-emerald-500/10 text-emerald-700 ring-emerald-500/20 dark:text-emerald-400" :
                                                geoStatus === "invalid" ? "bg-destructive/10 text-destructive ring-destructive/20" :
                                                    "bg-amber-500/10 text-amber-700 ring-amber-500/20 dark:text-amber-400"
                                        )}>
                                            {geoStatus === "valid" ? <ShieldCheck className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                                            {geoStatus === "valid" ? "Inside geofence" : geoStatus === "invalid" ? "Outside range" : geoStatus === "error" ? "Location unavailable" : "Checking location"}
                                        </span>
                                    )}
                                    {!isWfh && (
                                        <p className="flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3" /> {officeLabel}</p>
                                    )}
                                </div>
                            </div>
                            <div className="relative grid grid-cols-2 divide-x border-t">
                                <div className="p-5">
                                    <p className="font-mono-label text-muted-foreground">First entry</p>
                                    <p className="mt-1 text-xl font-semibold tabular-nums">{firstEntry ? format(firstEntry, "HH:mm") : "--:--"}</p>
                                </div>
                                <div className="p-5">
                                    <p className="font-mono-label text-muted-foreground">Left to target</p>
                                    <p className="mt-1 text-xl font-semibold tabular-nums">{remainingMinutes === 0 ? "Done" : fmtMinutes(remainingMinutes)}</p>
                                </div>
                            </div>
                        </section>

                        {/* Metrics + history */}
                        <div className="space-y-8 lg:col-span-7 xl:col-span-8">
                            <StatGrid>
                                <Stat label="This week" value={metrics?.weeklyTotal || "0h 00m"} icon={Timer} tone="signal" hint={`${metrics?.targetPercentage || 0}% of 40h target`} progress={metrics?.targetPercentage || 0} />
                                <Stat label="Attendance score" value={metrics?.attendanceScore || "0%"} icon={Gauge} hint="Days present this week" />
                                <Stat label={isToday(selectedDate) ? "Today" : "That day"} value={fmtMinutes(dayMinutes)} icon={History} hint={`${logs.length} session${logs.length === 1 ? "" : "s"}`} progress={dayProgress * 100} />
                            </StatGrid>

                            <Panel
                                title="Activity"
                                description={`Sessions on ${format(selectedDate, "MMMM d, yyyy")}`}
                                bodyClassName="p-0"
                            >
                                <ScrollArea className="h-[420px]">
                                    {isLoading ? (
                                        <div className="space-y-px">{[0, 1, 2].map(i => <div key={i} className="h-[72px] animate-pulse bg-secondary/40" />)}</div>
                                    ) : logs.length > 0 ? (
                                        <ol className="relative">
                                            {logs.map((log, i) => (
                                                <motion.li
                                                    key={log.id}
                                                    initial={{ opacity: 0, y: 8 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ delay: i * 0.04, ease: EASE }}
                                                    className="grid grid-cols-[auto_1fr_auto] items-center gap-4 border-b px-6 py-4 last:border-0 hover:bg-secondary/40"
                                                >
                                                    <div className={cn(
                                                        "flex h-10 w-10 items-center justify-center rounded-lg border",
                                                        log.logoutTime ? "text-muted-foreground" : "border-signal/40 text-signal"
                                                    )}>
                                                        {log.logoutTime ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownLeft className="h-4 w-4" />}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <p className="font-medium">
                                                                {format(new Date(log.loginTime), "HH:mm")} – {log.logoutTime ? format(new Date(log.logoutTime), "HH:mm") : "now"}
                                                            </p>
                                                            {log.isWfh && <StatusPill status="IN_PROGRESS" label="Remote" />}
                                                            {!log.logoutTime && <StatusPill status="ONLINE" label="Active" />}
                                                        </div>
                                                        <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                                                            <MapPin className="h-3 w-3 shrink-0" /> {log.loginLocation || "Standard entry"}
                                                        </p>
                                                    </div>
                                                    <p className="font-mono text-sm tabular-nums text-muted-foreground">
                                                        {fmtMinutes(Math.max(0, differenceInMinutes(log.logoutTime ? new Date(log.logoutTime) : new Date(), new Date(log.loginTime))))}
                                                    </p>
                                                </motion.li>
                                            ))}
                                        </ol>
                                    ) : (
                                        <EmptyState icon={ClipboardList} title="No sessions" description="Nothing was recorded on this day." />
                                    )}
                                </ScrollArea>
                            </Panel>
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="regularization" className="focus-visible:outline-none">
                    <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
                        <Panel title="Request a correction" description="For a missed clock-in, clock-out or whole day." className="h-fit">
                            <form className="space-y-5 p-6" onSubmit={async (e: React.FormEvent<HTMLFormElement>) => {
                                e.preventDefault();
                                const form = e.currentTarget;
                                const formData = new FormData(form);
                                setIsActionLoading(true);
                                try {
                                    const res = await fetch("/api/attendance/requests", {
                                        method: "POST",
                                        body: JSON.stringify({
                                            type: formData.get("type"),
                                            date: formData.get("date"),
                                            reason: formData.get("reason"),
                                        })
                                    });
                                    if (res.ok) {
                                        toast({ title: "Request submitted", description: "Your correction is pending approval." });
                                        form.reset();
                                        fetchData(selectedDate);
                                    } else {
                                        const err = await res.json().catch(() => ({}));
                                        toast({ title: "Could not submit", description: err.error || "Check the form and try again.", variant: "destructive" });
                                    }
                                } catch (e) {
                                    toast({ title: "Error", description: "Failed to submit request.", variant: "destructive" });
                                } finally {
                                    setIsActionLoading(false);
                                }
                            }}>
                                <div className="space-y-2">
                                    <FieldLabel htmlFor="reg-type">Type</FieldLabel>
                                    <select id="reg-type" name="type" className="h-10 w-full rounded-lg border bg-card px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
                                        <option value="FULL_DAY">Full day</option>
                                        <option value="CLOCK_IN">Missing clock-in</option>
                                        <option value="CLOCK_OUT">Missing clock-out</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <FieldLabel htmlFor="reg-date">Date</FieldLabel>
                                    <Input id="reg-date" name="date" type="date" max={format(new Date(), "yyyy-MM-dd")} required />
                                </div>
                                <div className="space-y-2">
                                    <FieldLabel htmlFor="reg-reason">Reason</FieldLabel>
                                    <Textarea id="reg-reason" name="reason" placeholder="What happened?" className="min-h-[100px] resize-none" required minLength={3} />
                                </div>
                                <Button type="submit" disabled={isActionLoading} className="w-full">
                                    {isActionLoading && <Loader2 className="h-4 w-4 animate-spin" />} Submit request
                                </Button>
                            </form>
                        </Panel>

                        <Panel title="My requests" description="Status of corrections you've submitted." className="lg:col-span-2" bodyClassName="p-0">
                            {requests.length > 0 ? (
                                <ul>
                                    {requests.map((req) => (
                                        <li key={req.id} className="flex items-center justify-between gap-4 border-b px-6 py-4 last:border-0">
                                            <div className="flex items-center gap-4">
                                                <div className="flex h-10 w-10 items-center justify-center rounded-lg border text-muted-foreground"><CalendarIcon className="h-4 w-4" /></div>
                                                <div>
                                                    <p className="font-medium">{String(req.type).replace(/_/g, " ").toLowerCase().replace(/^\w/, (c: string) => c.toUpperCase())}</p>
                                                    <p className="text-xs text-muted-foreground">{format(new Date(req.date), "MMMM d, yyyy")}{req.reason ? ` · ${req.reason}` : ""}</p>
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end gap-1">
                                                <StatusPill status={req.status} />
                                                {req.approver && <p className="text-xs text-muted-foreground">by {req.approver.name}</p>}
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <EmptyState icon={ClipboardList} title="No requests yet" description="Corrections you submit will appear here." />
                            )}
                        </Panel>
                    </div>
                </TabsContent>

                {isPrivileged && (
                    <TabsContent value="manager" className="space-y-8 focus-visible:outline-none">
                        <StatGrid>
                            <Stat label="Pending approvals" value={approvalsPending.length} icon={ClipboardList} tone={approvalsPending.length ? "warn" : "default"} hint={approvalsPending.length ? "Awaiting your decision" : "Queue is clear"} />
                            <Stat label="Online now" value={<>{presence.online}<span className="text-xl text-muted-foreground"> / {presence.total}</span></>} icon={Users} tone="ok" hint="People active in the last 7 days" progress={presence.total ? (presence.online / presence.total) * 100 : 0} />
                            <Stat label="Working remote" value={presence.remote} icon={Home} hint={presence.online ? `${Math.round((presence.remote / presence.online) * 100)}% of those online` : "No one online"} />
                        </StatGrid>

                        <Panel title="Approval queue" description="Correction requests from people you manage." bodyClassName="p-0">
                            {approvalsPending.length > 0 ? (
                                <ul>
                                    {approvalsPending.map((req) => (
                                        <li key={req.id} className="flex flex-col gap-4 border-b px-6 py-4 last:border-0 sm:flex-row sm:items-center sm:justify-between">
                                            <div className="flex items-center gap-4">
                                                <PersonAvatar name={req.user?.name} image={req.user?.image} />
                                                <div>
                                                    <p className="font-medium">{req.user?.name}</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {String(req.type).replace(/_/g, " ").toLowerCase()} · {format(new Date(req.date), "MMM d, yyyy")}{req.reason ? ` · ${req.reason}` : ""}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <Button size="sm" variant="outline" disabled={deciding === req.id} onClick={() => decideRequest(req.id, "REJECTED")}>
                                                    <X className="h-4 w-4" /> Reject
                                                </Button>
                                                <Button size="sm" disabled={deciding === req.id} onClick={() => decideRequest(req.id, "APPROVED")}>
                                                    {deciding === req.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Approve
                                                </Button>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <EmptyState icon={Check} title="All caught up" description="No corrections are waiting for you." />
                            )}
                        </Panel>

                        <Panel
                            title="Team sessions"
                            description="Clock-ins from the last 7 days."
                            actions={<Button size="sm" variant="outline" onClick={exportTeamCsv} disabled={teamLogs.length === 0}><Download className="h-4 w-4" /> Export CSV</Button>}
                            bodyClassName="p-0"
                        >
                            {teamLogs.length > 0 ? (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-secondary/40">
                                            <tr className="border-b">
                                                {["Person", "Mode", "Login", "Logout", "Duration", "Status"].map(h => (
                                                    <th key={h} className="h-10 px-6 text-left font-mono text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {teamLogs.map((log) => (
                                                <tr key={log.id} className="border-b last:border-0 hover:bg-secondary/40">
                                                    <td className="px-6 py-3">
                                                        <div className="flex items-center gap-3">
                                                            <PersonAvatar name={log.user?.name} image={log.user?.image} size="sm" />
                                                            <div>
                                                                <p className="font-medium">{log.user?.name}</p>
                                                                <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{log.user?.role}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-3 text-muted-foreground">{log.isWfh ? "Remote" : "Office"}</td>
                                                    <td className="px-6 py-3 font-mono tabular-nums">{format(new Date(log.loginTime), "MMM d, HH:mm")}</td>
                                                    <td className="px-6 py-3 font-mono tabular-nums">{log.logoutTime ? format(new Date(log.logoutTime), "HH:mm") : "—"}</td>
                                                    <td className="px-6 py-3 font-mono tabular-nums text-muted-foreground">{fmtMinutes(Math.max(0, differenceInMinutes(log.logoutTime ? new Date(log.logoutTime) : new Date(), new Date(log.loginTime))))}</td>
                                                    <td className="px-6 py-3"><StatusPill status={log.logoutTime ? "OFFLINE" : "ONLINE"} /></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <EmptyState icon={Users} title="No team activity" description="Sessions from your team will show up here." />
                            )}
                        </Panel>
                    </TabsContent>
                )}
            </Tabs>
        </div>
    );
}


// Helpers
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371e3; // meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function getCurrentPosition(): Promise<GeolocationPosition> {
    return new Promise((res, rej) => {
        navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true });
    });
}
