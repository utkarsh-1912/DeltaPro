"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
    Clock, MapPin, Calendar as CalendarIcon, CheckCircle2, History, Timer,
    ArrowUpRight, ArrowDownLeft, Loader2, Home, Building2, ShieldCheck,
    AlertTriangle, Filter, ClipboardList, CheckSquare, XCircle, Users
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, startOfDay, endOfDay } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSession } from "next-auth/react";
import { Role } from "@prisma/client";

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

            // Fetch requests
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
            }, 1000);
        } else {
            setElapsedTime("00:00:00");
        }
        return () => clearInterval(interval);
    }, [isClockedIn, startTime]);

    // Geofencing verification
    const checkGeofence = useCallback((lat: number, lng: number) => {
        if (!settings || isWfh) return setGeoStatus("valid");

        const dist = getDistance(lat, lng, settings.officeLat, settings.officeLng);
        if (dist <= settings.allowedRadius) {
            setGeoStatus("valid");
        } else {
            setGeoStatus("invalid");
            if (isClockedIn) {
                toast({
                    title: "Out of Range",
                    description: "You've moved away from the office. Please stay in range or use WFH mode.",
                    variant: "destructive"
                });
            }
        }
    }, [settings, isWfh, isClockedIn, toast]);

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
                    }
                }
            }
        } catch (error) {
            toast({ title: "Error", description: "Operation failed.", variant: "destructive" });
        } finally {
            setIsActionLoading(false);
        }
    };

    return (
        <div className="max-w-[1600px] mx-auto space-y-8 animate-in fade-in duration-700">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <h1 className="text-4xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60">Attendance Hub</h1>
                    <p className="text-muted-foreground mt-2 text-lg">Centralize your time tracking, geofencing, and shift management.</p>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                    {/* WFH Toggle */}
                    <div className="bg-muted/50 p-1.5 rounded-2xl flex items-center gap-1 border border-border/40">
                        <Button
                            variant={!isWfh ? "default" : "ghost"}
                            size="sm"
                            className="rounded-xl px-4 font-bold"
                            onClick={() => !isClockedIn && setIsWfh(false)}
                            disabled={isClockedIn}
                        >
                            <Building2 className="h-4 w-4 mr-2" /> Office
                        </Button>
                        <Button
                            variant={isWfh ? "default" : "ghost"}
                            size="sm"
                            className="rounded-xl px-4 font-bold"
                            onClick={() => !isClockedIn && setIsWfh(true)}
                            disabled={isClockedIn}
                        >
                            <Home className="h-4 w-4 mr-2" /> Remote
                        </Button>
                    </div>

                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" className="h-12 px-5 rounded-2xl border-primary/20 bg-background/50 backdrop-blur-md flex items-center gap-3 hover:bg-primary/5 transition-all shadow-sm">
                                <CalendarIcon className="h-5 w-5 text-primary" />
                                <span className="font-bold">{format(selectedDate, "EEE, MMM do")}</span>
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 rounded-2xl border-none shadow-2xl" align="end">
                            <input
                                type="date"
                                className="p-4 bg-background rounded-2xl outline-none"
                                value={format(selectedDate, "yyyy-MM-dd")}
                                onChange={(e) => setSelectedDate(new Date(e.target.value))}
                            />
                        </PopoverContent>
                    </Popover>
                </div>
            </div>

            <Tabs defaultValue="my-attendance" className="w-full">
                <TabsList className="bg-muted/30 p-1 rounded-2xl mb-8 border border-border/40 inline-flex">
                    <TabsTrigger value="my-attendance" className="rounded-xl px-8 font-bold data-[state=active]:bg-background data-[state=active]:shadow-lg transition-all">My Attendance</TabsTrigger>
                    <TabsTrigger value="regularization" className="rounded-xl px-8 font-bold data-[state=active]:bg-background data-[state=active]:shadow-lg transition-all">Requests</TabsTrigger>
                    {isPrivileged && (
                        <TabsTrigger value="manager" className="rounded-xl px-8 font-bold data-[state=active]:bg-background data-[state=active]:shadow-lg transition-all flex items-center gap-2">
                            Manager Portal
                            {approvalsPending.length > 0 && <Badge className="bg-rose-500 hover:bg-rose-500 h-5 px-1.5">{approvalsPending.length}</Badge>}
                        </TabsTrigger>
                    )}
                </TabsList>

                <TabsContent value="my-attendance" className="space-y-8 focus-visible:outline-none">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                        {/* LEFT: Clock Section */}
                        <div className="lg:col-span-4 space-y-6">
                            <Card className="overflow-hidden border-none shadow-2xl bg-gradient-to-br from-primary/10 via-background to-background relative group">
                                <div className={cn(
                                    "absolute top-0 right-0 h-32 w-32 -mr-8 -mt-8 rounded-full blur-3xl opacity-20 transition-colors duration-1000",
                                    isClockedIn ? "bg-emerald-500" : "bg-primary"
                                )} />

                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Clock className="h-5 w-5" /> Clock Terminal
                                    </CardTitle>
                                </CardHeader>

                                <CardContent className="flex flex-col items-center py-12 space-y-8">
                                    <div className="text-center">
                                        <div className="text-7xl font-mono font-black tracking-tighter text-foreground tabular-nums">
                                            {elapsedTime}
                                        </div>
                                        <p className="text-sm font-bold text-muted-foreground uppercase tracking-[0.2em] mt-2 opacity-60">Session Elapsed</p>
                                    </div>

                                    <div className="relative">
                                        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                                            <Button
                                                onClick={handleClockToggle}
                                                disabled={isActionLoading}
                                                className={cn(
                                                    "h-56 w-56 rounded-full text-3xl font-black border-[12px] shadow-2xl transition-all duration-700 relative z-10",
                                                    isClockedIn
                                                        ? "bg-gradient-to-br from-rose-500 to-rose-600 border-rose-100/50 shadow-rose-500/30"
                                                        : "bg-gradient-to-br from-emerald-500 to-emerald-600 border-emerald-100/50 shadow-emerald-500/30"
                                                )}
                                            >
                                                {isActionLoading ? <Loader2 className="h-10 w-10 animate-spin" /> : (isClockedIn ? "OUT" : "IN")}
                                            </Button>
                                        </motion.div>
                                        {isClockedIn && (
                                            <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping" />
                                        )}
                                    </div>

                                    <div className="flex flex-col items-center gap-3">
                                        {isWfh ? (
                                            <Badge variant="secondary" className="bg-primary/5 text-primary border-primary/10 px-4 py-1.5 rounded-full flex items-center gap-2">
                                                <Home className="h-3 w-3" /> WFH Mode Active
                                            </Badge>
                                        ) : (
                                            <div className={cn(
                                                "flex items-center gap-2 px-4 py-1.5 rounded-full border transition-all font-bold text-xs uppercase tracking-wider",
                                                geoStatus === "valid" ? "bg-emerald-500/10 text-emerald-600 border-emerald-200" :
                                                    geoStatus === "invalid" ? "bg-rose-500/10 text-rose-600 border-rose-200" :
                                                        "bg-amber-500/10 text-amber-600 border-amber-200"
                                            )}>
                                                {geoStatus === "valid" ? <ShieldCheck className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                                                {geoStatus === "valid" ? "Inside Geofence" : geoStatus === "invalid" ? "Outside Range" : "Validating Location..."}
                                            </div>
                                        )}
                                        <p className="text-xs text-muted-foreground flex items-center gap-1 font-medium italic">
                                            <MapPin className="h-3 w-3" /> Mumbai, Corporate HQ
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>

                            <div className="grid grid-cols-2 gap-4">
                                <Card className="p-4 bg-muted/20 border-none">
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase opacity-50 tracking-widest">Entry</p>
                                    <p className="text-xl font-bold mt-1 tabular-nums">{startTime ? format(startTime, "HH:mm") : '--:--'}</p>
                                </Card>
                                <Card className="p-4 bg-muted/20 border-none">
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase opacity-50 tracking-widest">Target Remaining</p>
                                    <p className="text-xl font-bold mt-1 tabular-nums">7h 42m</p>
                                </Card>
                            </div>
                        </div>

                        {/* RIGHT: Dashboard metrics */}
                        <div className="lg:col-span-8 space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <Card className="border-none shadow-xl bg-primary text-primary-foreground relative overflow-hidden h-40 flex items-center">
                                    <div className="absolute right-0 bottom-0 opacity-10 -mr-6 -mb-6">
                                        <Timer className="h-32 w-32" />
                                    </div>
                                    <CardContent className="pt-6">
                                        <p className="text-sm font-bold opacity-80 uppercase tracking-widest">Weekly Total</p>
                                        <h3 className="text-4xl font-black mt-2 tabular-nums">{metrics?.weeklyTotal || "0h 0m"}</h3>
                                        <div className="flex items-center gap-3 mt-4">
                                            <div className="h-1.5 flex-1 bg-white/20 rounded-full overflow-hidden">
                                                <div className="h-full bg-white transition-all duration-1000" style={{ width: `${metrics?.targetPercentage || 0}%` }} />
                                            </div>
                                            <span className="text-xs font-black">{metrics?.targetPercentage || 0}%</span>
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card className="border-none shadow-xl bg-emerald-500 text-white relative overflow-hidden h-40 flex items-center">
                                    <div className="absolute right-0 bottom-0 opacity-10 -mr-6 -mb-6">
                                        <CheckCircle2 className="h-32 w-32" />
                                    </div>
                                    <CardContent className="pt-6">
                                        <p className="text-sm font-bold opacity-80 uppercase tracking-widest">Attendance Score</p>
                                        <h3 className="text-4xl font-black mt-2">{metrics?.attendanceScore || "0%"}</h3>
                                        <p className="text-xs font-bold mt-4 opacity-80">Excellent performance!</p>
                                    </CardContent>
                                </Card>

                                <Card className="border-none shadow-xl bg-muted/50 dark:bg-muted/10 relative overflow-hidden h-40 flex items-center">
                                    <div className="absolute right-0 bottom-0 opacity-10 -mr-6 -mb-6">
                                        <History className="h-32 w-32" />
                                    </div>
                                    <CardContent className="pt-6">
                                        <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Total Days logged</p>
                                        <h3 className="text-4xl font-black mt-2">{logs.filter(l => !!l.logoutTime).length}</h3>
                                        <p className="text-xs font-bold text-muted-foreground mt-4 italic">Updated 1m ago</p>
                                    </CardContent>
                                </Card>
                            </div>

                            <Card className="border-none shadow-2xl bg-background/50 backdrop-blur-md overflow-hidden">
                                <CardHeader className="flex flex-row items-center justify-between border-b border-border/40 pb-6">
                                    <div>
                                        <CardTitle className="flex items-center gap-2"><History className="h-5 w-5 text-primary" /> Recent History</CardTitle>
                                        <CardDescription>Daily clock-in/out records</CardDescription>
                                    </div>
                                    <Button variant="outline" size="sm" className="rounded-xl font-bold"><Filter className="h-3 w-3 mr-2" /> Filter Logs</Button>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <ScrollArea className="h-[450px]">
                                        {logs.length > 0 ? (
                                            <div className="divide-y divide-border/40">
                                                {logs.map((log, i) => (
                                                    <div key={log.id} className="p-6 flex items-center justify-between hover:bg-muted/30 transition-all group">
                                                        <div className="flex items-center gap-5">
                                                            <div className={cn(
                                                                "h-12 w-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110",
                                                                log.logoutTime ? "bg-rose-500/10 text-rose-600" : "bg-emerald-500/10 text-emerald-600"
                                                            )}>
                                                                {log.logoutTime ? <ArrowUpRight className="h-6 w-6" /> : <ArrowDownLeft className="h-6 w-6" />}
                                                            </div>
                                                            <div>
                                                                <div className="flex items-center gap-3">
                                                                    <p className="text-base font-bold text-foreground">Clock {log.logoutTime ? 'Out' : 'In'}</p>
                                                                    {log.isWfh && <Badge variant="outline" className="text-[9px] font-black tracking-tighter uppercase h-4 bg-primary/5 text-primary border-primary/20">Remote</Badge>}
                                                                </div>
                                                                <p className="text-xs text-muted-foreground font-medium flex items-center gap-1.5 mt-1 opacity-70">
                                                                    <MapPin className="h-3 w-3" /> {log.loginLocation || 'Standard Entry'}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-lg font-mono font-black tabular-nums">{format(new Date(log.logoutTime || log.loginTime), "HH:mm:ss")}</p>
                                                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1 opacity-50">{format(new Date(log.loginTime), "MMM d, yyyy")}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground opacity-40 italic">
                                                <ClipboardList className="h-12 w-12 mb-2" />
                                                <p>No activity recorded yet.</p>
                                            </div>
                                        )}
                                    </ScrollArea>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="regularization" className="space-y-6 focus-visible:outline-none">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-1 space-y-6">
                            <Card className="border-none shadow-2xl bg-background/80 backdrop-blur-xl">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2"><CheckSquare className="h-5 w-5 text-primary" /> New Request</CardTitle>
                                    <CardDescription>Submit attendance corrections for missing logs.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <form className="space-y-5" onSubmit={async (e: React.FormEvent<HTMLFormElement>) => {
                                        e.preventDefault();
                                        const formData = new FormData(e.currentTarget);
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
                                                toast({ title: "Request Submitted", description: "Your regularization request is pending approval." });
                                                fetchData(selectedDate);
                                            }
                                        } catch (e) {
                                            toast({ title: "Error", description: "Failed to submit request.", variant: "destructive" });
                                        } finally {
                                            setIsActionLoading(false);
                                        }
                                    }}>
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Type</label>
                                            <select
                                                name="type"
                                                className="w-full h-11 bg-muted/40 border-none rounded-xl px-4 text-sm font-medium focus:ring-2 ring-primary"
                                            >
                                                <option value="FULL_DAY">Full Day Regularization</option>
                                                <option value="CLOCK_IN">Missing Clock In</option>
                                                <option value="CLOCK_OUT">Missing Clock Out</option>
                                            </select>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Date</label>
                                            <Input name="date" type="date" className="h-11 bg-muted/40 border-none rounded-xl font-medium" required />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Reason</label>
                                            <Textarea name="reason" placeholder="Why was the clock-in missed?" className="bg-muted/40 border-none rounded-xl font-medium resize-none min-h-[100px]" required />
                                        </div>
                                        <Button type="submit" disabled={isActionLoading} className="w-full h-12 rounded-2xl font-black text-base shadow-lg shadow-primary/20">Submit Request</Button>
                                    </form>
                                </CardContent>
                            </Card>
                        </div>

                        <div className="lg:col-span-2">
                            <Card className="border-none shadow-2xl bg-background/80 backdrop-blur-xl h-full">
                                <CardHeader>
                                    <CardTitle>My Past Requests</CardTitle>
                                    <CardDescription>Status tracking for your regularization submissions.</CardDescription>
                                </CardHeader>
                                <CardContent className="p-0 border-t">
                                    <div className="divide-y">
                                        {requests.length > 0 ? requests.map((req, i) => (
                                            <div key={i} className="p-6 flex items-center justify-between group hover:bg-muted/20">
                                                <div className="flex items-center gap-4">
                                                    <div className="h-12 w-12 rounded-2xl bg-primary/5 flex items-center justify-center text-primary">
                                                        <CalendarIcon className="h-6 w-6" />
                                                    </div>
                                                    <div>
                                                        <p className="font-black text-foreground">{req.type}</p>
                                                        <p className="text-xs text-muted-foreground font-medium">{format(new Date(req.date), "MMMM d, yyyy")}</p>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-end gap-2">
                                                    <Badge className={cn(
                                                        "rounded-full px-4 h-6 text-[10px] font-black tracking-widest uppercase",
                                                        req.status === 'APPROVED' ? 'bg-emerald-500 hover:bg-emerald-600' :
                                                            req.status === 'REJECTED' ? 'bg-rose-500 hover:bg-rose-600' : 'bg-amber-500 hover:bg-amber-600'
                                                    )}>{req.status}</Badge>
                                                    {req.approver && <p className="text-[10px] text-muted-foreground italic font-medium">By {req.approver.name}</p>}
                                                </div>
                                            </div>
                                        )) : (
                                            <div className="p-12 text-center opacity-40 italic text-sm">No requests found.</div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </TabsContent>

                {isPrivileged && (
                    <TabsContent value="manager" className="space-y-8 focus-visible:outline-none">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <Card className="border-none shadow-2xl bg-rose-500 text-white overflow-hidden relative">
                                <div className="absolute right-0 bottom-0 opacity-10 -mr-10 -mb-10">
                                    <AlertTriangle className="h-48 w-48" />
                                </div>
                                <CardHeader>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <CardTitle className="text-3xl font-black">{approvalsPending.length}</CardTitle>
                                            <CardDescription className="text-white/80 font-bold uppercase tracking-wider mt-1">Pending Approvals</CardDescription>
                                        </div>
                                        <div className="h-14 w-14 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md border border-white/20">
                                            <CheckSquare className="h-8 w-8" />
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-sm font-medium opacity-90 leading-relaxed mb-4">You have {approvalsPending.length} regularization requests waiting for your signature. Fast approval keeps team metrics accurate.</p>
                                    <Button variant="secondary" className="w-full rounded-xl font-black uppercase tracking-tight h-12 shadow-inner">View Queue</Button>
                                </CardContent>
                            </Card>

                            <Card className="border-none shadow-2xl bg-indigo-600 text-white overflow-hidden relative">
                                <div className="absolute right-0 bottom-0 opacity-10 -mr-10 -mb-10">
                                    <Users className="h-48 w-48" />
                                </div>
                                <CardHeader>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <CardTitle className="text-3xl font-black">12 / 15</CardTitle>
                                            <CardDescription className="text-white/80 font-bold uppercase tracking-wider mt-1">Team Presence</CardDescription>
                                        </div>
                                        <div className="h-14 w-14 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md border border-white/20">
                                            <Building2 className="h-8 w-8" />
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-sm font-medium opacity-90 leading-relaxed mb-4">80% of your team is currently logged in. 3 team members are working remote today.</p>
                                    <Button variant="secondary" className="w-full rounded-xl font-black uppercase tracking-tight h-12 shadow-inner">Live Presence Map</Button>
                                </CardContent>
                            </Card>
                        </div>

                        <Card className="border-none shadow-2xl">
                            <CardHeader className="flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle>Team Attendance Logs</CardTitle>
                                    <CardDescription>Live oversight of all active and past sessions.</CardDescription>
                                </div>
                                <Button size="sm" variant="outline" className="rounded-xl font-bold">Export CSV</Button>
                            </CardHeader>
                            <CardContent className="p-0 border-t">
                                <div className="divide-y overflow-auto border-b">
                                    {teamLogs.length > 0 ? teamLogs.map((log, i) => (
                                        <div key={i} className="p-6 flex items-center justify-between group hover:bg-muted/10 transition-colors">
                                            <div className="flex items-center gap-4">
                                                <div className="h-12 w-12 rounded-full overflow-hidden bg-muted border-2 border-primary/10">
                                                    <img src={log.user.image || `https://api.dicebear.com/7.x/avataaars/svg?seed=${log.user.name}`} alt="" />
                                                </div>
                                                <div>
                                                    <p className="font- black text-base">{log.user.name}</p>
                                                    <p className="text-xs font-bold text-muted-foreground opacity-60 uppercase tracking-widest">{log.user.role}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-12">
                                                <div className="text-center hidden md:block">
                                                    <p className="text-[10px] font-bold text-muted-foreground uppercase opacity-50 tracking-widest">Login</p>
                                                    <p className="text-sm font-mono font-bold">{format(new Date(log.loginTime), "HH:mm")}</p>
                                                </div>
                                                <div className="text-center hidden md:block">
                                                    <p className="text-[10px] font-bold text-muted-foreground uppercase opacity-50 tracking-widest">Logout</p>
                                                    <p className="text-sm font-mono font-bold">{log.logoutTime ? format(new Date(log.logoutTime), "HH:mm") : 'ACTIVE'}</p>
                                                </div>
                                                <div className="text-right min-w-[100px]">
                                                    <Badge className={cn(
                                                        "rounded-full px-4 h-7 text-[10px] font-black uppercase tracking-widest",
                                                        !log.logoutTime ? 'bg-emerald-500 animate-pulse' : 'bg-muted text-muted-foreground border-none'
                                                    )}>{!log.logoutTime ? 'ONLINE' : 'OFFLINE'}</Badge>
                                                </div>
                                            </div>
                                        </div>
                                    )) : (
                                        <div className="p-24 text-center text-muted-foreground opacity-30 italic">No team activity results.</div>
                                    )}
                                </div>
                                <div className="p-4 bg-muted/20 text-center">
                                    <Button variant="ghost" className="text-xs font-black text-primary hover:bg-transparent">Show More Records</Button>
                                </div>
                            </CardContent>
                        </Card>
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

