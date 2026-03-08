"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { CalendarIcon, Plus, CheckCircle2, XCircle, Clock, Download, Filter, User, HelpCircle, Briefcase, HeartPulse, Sparkles } from "lucide-react";
import { format, differenceInDays, isSameDay } from "date-fns";
import type { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

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

export default function LeavePage() {
    const { data: session } = useSession();
    const { toast } = useToast();

    const [balances, setBalances] = useState<LeaveBalance[]>([]);
    const [myRequests, setMyRequests] = useState<LeaveRequest[]>([]);
    const [pendingRequests, setPendingRequests] = useState<LeaveRequest[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Form states
    const [dateRange, setDateRange] = useState<DateRange | undefined>();
    const [leaveType, setLeaveType] = useState<LeaveType>("CASUAL");
    const [reason, setReason] = useState("");
    const [isHalfDay, setIsHalfDay] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const isManagerOrAdmin = session?.user?.role === "ADMIN" || session?.user?.role === "HR" || session?.user?.role === "PM";

    useEffect(() => {
        if (session) {
            fetchData();
        }
    }, [session]);

    const fetchData = async () => {
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
    };

    const calculateDuration = (range: DateRange | undefined, halfDay: boolean) => {
        if (halfDay) return 0.5;
        if (!range?.from || !range?.to) return 1.0;
        return differenceInDays(range.to, range.from) + 1;
    };

    const handleRequestLeave = async () => {
        if (!dateRange?.from) {
            toast({ variant: "destructive", title: "Missing Dates", description: "Please select leave dates." });
            return;
        }

        const duration = calculateDuration(dateRange, isHalfDay);
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
                    duration
                })
            });

            if (res.ok) {
                toast({ title: "Request Submitted", description: "Your leave request is pending approval." });
                setDateRange(undefined);
                setReason("");
                setIsHalfDay(false);
                fetchData();
            } else {
                const err = await res.json();
                toast({ variant: "destructive", title: "Request Failed", description: err.error || "Could not submit request." });
            }
        } catch (error) {
            toast({ variant: "destructive", title: "Error", description: "Something went wrong." });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleAction = async (requestId: string, status: LeaveStatus) => {
        try {
            const res = await fetch(`/api/leave/requests/${requestId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status })
            });

            if (res.ok) {
                toast({ title: `Request ${status.toLowerCase()}`, description: `Action successful.` });
                fetchData();
            } else {
                const err = await res.json();
                toast({ variant: "destructive", title: "Action Failed", description: err.error });
            }
        } catch (error) {
            toast({ variant: "destructive", title: "Error", description: "Something went wrong." });
        }
    };

    const getStatusBadge = (status: LeaveStatus) => {
        switch (status) {
            case "PENDING": return <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-200">Pending</Badge>;
            case "APPROVED": return <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-200">Approved</Badge>;
            case "REJECTED": return <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">Rejected</Badge>;
            default: return <Badge variant="secondary">{status}</Badge>;
        }
    };

    const getBalanceIcon = (type: string) => {
        switch (type) {
            case "SICK": return <HeartPulse className="h-5 w-5 text-rose-500" />;
            case "CASUAL": return <Sparkles className="h-5 w-5 text-amber-500" />;
            case "EARNED": return <Briefcase className="h-5 w-5 text-primary" />;
            default: return <HelpCircle className="h-5 w-5" />;
        }
    };

    return (
        <div className="p-4 sm:p-8 space-y-8 bg-background/50 min-h-screen">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-4xl font-black tracking-tight">Leave Management</h1>
                    <p className="text-muted-foreground font-medium">Track your balances and manage time-off requests.</p>
                </div>
                <div className="flex items-center gap-3">
                    <Button variant="outline" size="sm" className="hidden sm:flex font-bold">
                        <Download className="mr-2 h-4 w-4" /> Export Report
                    </Button>
                </div>
            </header>

            {/* Balance Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {balances.map((balance) => (
                    <motion.div
                        key={balance.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                    >
                        <Card className="border-none shadow-xl bg-background/60 backdrop-blur-xl overflow-hidden group hover:-translate-y-1 transition-all">
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-sm font-black uppercase tracking-widest text-muted-foreground">
                                    {balance.type} LEAVE
                                </CardTitle>
                                <div className="p-2 rounded-xl bg-muted/50 group-hover:bg-primary/10 transition-colors">
                                    {getBalanceIcon(balance.type)}
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="text-4xl font-black mb-1">{balance.available}</div>
                                <div className="flex items-center justify-between text-xs font-bold uppercase tracking-widest text-muted-foreground">
                                    <span>Available</span>
                                    <span>Total: {balance.total}</span>
                                </div>
                                <div className="mt-4 h-2 w-full bg-muted rounded-full overflow-hidden">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${(balance.used / balance.total) * 100}%` }}
                                        className="h-full bg-primary"
                                    />
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                ))}
            </div>

            <Tabs defaultValue="my-leaves" className="w-full">
                <TabsList className="bg-muted/50 p-1 rounded-2xl mb-6">
                    <TabsTrigger value="my-leaves" className="rounded-xl px-8 font-black uppercase tracking-widest text-[10px]">My Leaves</TabsTrigger>
                    <TabsTrigger value="request" className="rounded-xl px-8 font-black uppercase tracking-widest text-[10px]">Request Leave</TabsTrigger>
                    {isManagerOrAdmin && (
                        <TabsTrigger value="approvals" className="rounded-xl px-8 font-black uppercase tracking-widest text-[10px] relative">
                            Approvals
                            {pendingRequests.length > 0 && <span className="absolute -top-1 -right-1 h-4 w-4 bg-primary text-[8px] flex items-center justify-center rounded-full text-white animate-pulse">{pendingRequests.length}</span>}
                        </TabsTrigger>
                    )}
                </TabsList>

                <TabsContent value="my-leaves">
                    <Card className="border-none shadow-2xl bg-background/60 backdrop-blur-3xl rounded-[2rem]">
                        <CardHeader>
                            <CardTitle>History</CardTitle>
                            <CardDescription>Your personal leave request log.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="rounded-3xl border border-border/40 overflow-hidden">
                                <Table>
                                    <TableHeader className="bg-muted/30">
                                        <TableRow className="border-border/40 hover:bg-transparent">
                                            <TableHead className="font-black text-[10px] uppercase tracking-widest">Type</TableHead>
                                            <TableHead className="font-black text-[10px] uppercase tracking-widest">Duration</TableHead>
                                            <TableHead className="font-black text-[10px] uppercase tracking-widest">Dates</TableHead>
                                            <TableHead className="font-black text-[10px] uppercase tracking-widest">Status</TableHead>
                                            <TableHead className="font-black text-[10px] uppercase tracking-widest text-right">Reason</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {myRequests.length > 0 ? myRequests.map((req) => (
                                            <TableRow key={req.id} className="border-border/40 hover:bg-muted/20 transition-colors">
                                                <TableCell className="font-bold">{req.type}</TableCell>
                                                <TableCell className="font-bold">{req.duration} Days</TableCell>
                                                <TableCell className="text-muted-foreground font-medium">
                                                    {format(new Date(req.startDate), "MMM dd")} - {format(new Date(req.endDate), "MMM dd, yyyy")}
                                                </TableCell>
                                                <TableCell>{getStatusBadge(req.status)}</TableCell>
                                                <TableCell className="text-right text-muted-foreground text-sm max-w-[200px] truncate">{req.reason || "—"}</TableCell>
                                            </TableRow>
                                        )) : (
                                            <TableRow>
                                                <TableCell colSpan={5} className="h-32 text-center text-muted-foreground font-medium italic">No leave history found.</TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="request">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
                            <Card className="border-none shadow-2xl bg-background/60 backdrop-blur-2xl rounded-[2.5rem] overflow-hidden">
                                <CardHeader className="pb-4">
                                    <CardTitle>Submit Request</CardTitle>
                                    <CardDescription>Select your leave details below.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <div className="space-y-3">
                                        <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Type of Leave</Label>
                                        <Select value={leaveType} onValueChange={(v: LeaveType) => setLeaveType(v)}>
                                            <SelectTrigger className="h-14 bg-muted/40 border-none rounded-2xl px-6 font-bold focus:ring-2 ring-primary">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-2xl border-none shadow-2xl">
                                                <SelectItem value="CASUAL">Casual Leave</SelectItem>
                                                <SelectItem value="SICK">Sick Leave</SelectItem>
                                                <SelectItem value="EARNED">Earned Leave</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-3">
                                        <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Date Selection</Label>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant="outline"
                                                    className={cn(
                                                        "w-full h-14 justify-start text-left font-bold bg-muted/40 border-none rounded-2xl px-6 hover:bg-muted/60 transition-all",
                                                        !dateRange && "text-muted-foreground"
                                                    )}
                                                >
                                                    <CalendarIcon className="mr-3 h-5 w-5 text-primary" />
                                                    {dateRange?.from ? (
                                                        dateRange.to ? (
                                                            <>{format(dateRange.from, "LLL dd")} - {format(dateRange.to, "LLL dd, y")}</>
                                                        ) : (
                                                            format(dateRange.from, "LLL dd, y")
                                                        )
                                                    ) : (
                                                        <span>Select date range</span>
                                                    )}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0 border-none shadow-3xl rounded-[2rem] overflow-hidden" align="start">
                                                <Calendar
                                                    initialFocus
                                                    mode="range"
                                                    defaultMonth={dateRange?.from}
                                                    selected={dateRange}
                                                    onSelect={setDateRange}
                                                    numberOfMonths={2}
                                                    className="p-4"
                                                />
                                            </PopoverContent>
                                        </Popover>
                                    </div>

                                    <div className="flex items-center justify-between p-6 bg-muted/30 rounded-3xl border border-border/40">
                                        <div className="space-y-1">
                                            <Label className="font-black text-sm">Half Day Request</Label>
                                            <p className="text-xs text-muted-foreground font-medium">Check if requesting only half a day.</p>
                                        </div>
                                        <Switch
                                            checked={isHalfDay}
                                            onCheckedChange={setIsHalfDay}
                                            className="data-[state=checked]:bg-primary"
                                        />
                                    </div>

                                    <div className="space-y-3">
                                        <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Reason (Optional)</Label>
                                        <Input
                                            placeholder="Brief explanation..."
                                            value={reason}
                                            onChange={(e) => setReason(e.target.value)}
                                            className="h-14 bg-muted/40 border-none rounded-2xl px-6 font-medium focus:ring-2 ring-primary"
                                        />
                                    </div>

                                    <Button
                                        onClick={handleRequestLeave}
                                        disabled={isSubmitting}
                                        className="w-full h-16 rounded-[1.5rem] font-black text-lg shadow-xl shadow-primary/20 hover:scale-[1.01] transition-all active:scale-[0.98]"
                                    >
                                        {isSubmitting ? "Processing..." : "Submit Request"}
                                    </Button>
                                </CardContent>
                            </Card>
                        </motion.div>

                        <div className="space-y-6">
                            <Card className="border-none shadow-xl bg-primary/10 rounded-[2rem]">
                                <CardHeader>
                                    <div className="h-12 w-12 rounded-2xl bg-primary/20 flex items-center justify-center mb-4">
                                        <Clock className="h-6 w-6 text-primary" />
                                    </div>
                                    <CardTitle>Calculation Breakdown</CardTitle>
                                    <CardDescription className="text-primary/60 font-medium">Estimated impact on your balance.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex items-end justify-between">
                                        <div className="text-5xl font-black">{calculateDuration(dateRange, isHalfDay)}</div>
                                        <div className="text-right">
                                            <div className="text-xs font-black uppercase tracking-widest text-primary/60 mb-1">Total Days</div>
                                            <div className="text-sm font-bold">{leaveType.replace("_", " ")}</div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            <div className="p-8 rounded-[2rem] bg-muted/30 border border-border/40 space-y-4">
                                <h4 className="font-black text-xs uppercase tracking-widest text-muted-foreground">Pro Tips</h4>
                                <ul className="space-y-3 text-sm font-medium leading-relaxed">
                                    <li className="flex gap-3">
                                        <div className="h-1.5 w-1.5 rounded-full bg-primary mt-2 shrink-0" />
                                        Requests should be made 48 hours in advance for plan better.
                                    </li>
                                    <li className="flex gap-3">
                                        <div className="h-1.5 w-1.5 rounded-full bg-primary mt-2 shrink-0" />
                                        Sick leave requires documentation for more than 2 consecutive days.
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </TabsContent>

                {isManagerOrAdmin && (
                    <TabsContent value="approvals">
                        <Card className="border-none shadow-2xl bg-background/60 backdrop-blur-3xl rounded-[2rem]">
                            <CardHeader>
                                <CardTitle>Pending Approvals</CardTitle>
                                <CardDescription>Approve or suggest changes to team leave requests.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    <AnimatePresence>
                                        {pendingRequests.length > 0 ? pendingRequests.map((req) => (
                                            <motion.div
                                                key={req.id}
                                                initial={{ opacity: 0, scale: 0.95 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                exit={{ opacity: 0, scale: 0.95 }}
                                                className="p-6 rounded-[2rem] bg-muted/30 border border-border/40 flex flex-col md:flex-row items-center justify-between gap-6"
                                            >
                                                <div className="flex items-center gap-6 w-full md:w-auto">
                                                    <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-black text-xl">
                                                        {req.user.name.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <h4 className="font-black text-lg">{req.user.name}</h4>
                                                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">{req.type} • {req.duration} Days</p>
                                                        <p className="text-xs text-muted-foreground font-medium">
                                                            {format(new Date(req.startDate), "MMM dd")} - {format(new Date(req.endDate), "MMM dd, yyyy")}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-3 w-full md:w-auto">
                                                    <Button
                                                        variant="outline"
                                                        size="lg"
                                                        onClick={() => handleAction(req.id, "REJECTED")}
                                                        className="flex-1 md:flex-none h-14 rounded-2xl border-none bg-destructive/10 text-destructive font-black hover:bg-destructive/20"
                                                    >
                                                        <XCircle className="mr-2 h-5 w-5" /> Reject
                                                    </Button>
                                                    <Button
                                                        size="lg"
                                                        onClick={() => handleAction(req.id, "APPROVED")}
                                                        className="flex-1 md:flex-none h-14 rounded-2xl font-black shadow-lg shadow-primary/20"
                                                    >
                                                        <CheckCircle2 className="mr-2 h-5 w-5" /> Approve
                                                    </Button>
                                                </div>
                                            </motion.div>
                                        )) : (
                                            <div className="h-48 flex flex-col items-center justify-center text-center space-y-2 opacity-50">
                                                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-2">
                                                    <CheckCircle2 className="h-6 w-6 text-muted-foreground" />
                                                </div>
                                                <p className="font-black uppercase tracking-widest text-xs">All caught up!</p>
                                                <p className="text-sm font-medium">No pending requests to action.</p>
                                            </div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                )}
            </Tabs>
        </div>
    );
}