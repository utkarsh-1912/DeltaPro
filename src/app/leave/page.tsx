
"use client";

import React from "react";
import { useRotaStore, useRotaStoreActions } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { CalendarIcon, Plus, Trash2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import type { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { motion } from "framer-motion";

export default function LeavePage() {
    const { teamMembers, leave } = useRotaStore();
    const { addLeave, deleteLeave } = useRotaStoreActions();
    const { toast } = useToast();

    const [memberId, setMemberId] = React.useState<string | undefined>();
    const [dateRange, setDateRange] = React.useState<DateRange | undefined>();
    const [leaveType, setLeaveType] = React.useState<'Holiday' | 'Sick Leave' | 'Other'>('Holiday');

    const memberMap = React.useMemo(() => new Map(teamMembers.map(m => [m.id, m.name])), [teamMembers]);
    const sortedLeave = React.useMemo(() => [...leave].sort((a,b) => parseISO(b.startDate).getTime() - parseISO(a.startDate).getTime()), [leave]);

    const handleAddLeave = () => {
        if (!memberId || !dateRange?.from || !dateRange?.to) {
            toast({
                variant: "destructive",
                title: "Incomplete Information",
                description: "Please select a team member and a full date range.",
            });
            return;
        }

        addLeave({
            memberId,
            startDate: dateRange.from.toISOString(),
            endDate: dateRange.to.toISOString(),
            type: leaveType,
        });

        // Reset form
        setMemberId(undefined);
        setDateRange(undefined);
        setLeaveType('Holiday');
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="p-4 sm:p-6 grid gap-6 md:grid-cols-2"
        >
            <Card className="md:col-span-2">
                <CardHeader>
                    <CardTitle>Leave & Holiday Management</CardTitle>
                    <CardDescription>Schedule and track time off for your team members. Scheduled leave will automatically be considered during rota generation.</CardDescription>
                </CardHeader>
            </Card>

            <div className="space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Schedule Leave</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                             <label className="text-sm font-medium">Team Member</label>
                             <Select value={memberId} onValueChange={setMemberId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a team member" />
                                </SelectTrigger>
                                <SelectContent>
                                    {teamMembers.map(member => (
                                        <SelectItem key={member.id} value={member.id}>{member.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Leave Dates</label>
                            <Popover>
                                <PopoverTrigger asChild>
                                <Button
                                    id="date"
                                    variant={"outline"}
                                    className={cn(
                                    "w-full justify-start text-left font-normal",
                                    !dateRange && "text-muted-foreground"
                                    )}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {dateRange?.from ? (
                                    dateRange.to ? (
                                        <>
                                        {format(dateRange.from, "LLL dd, y")} -{" "}
                                        {format(dateRange.to, "LLL dd, y")}
                                        </>
                                    ) : (
                                        format(dateRange.from, "LLL dd, y")
                                    )
                                    ) : (
                                    <span>Pick a date range</span>
                                    )}
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
                                />
                                </PopoverContent>
                            </Popover>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Leave Type</label>
                            <Select value={leaveType} onValueChange={(v: 'Holiday' | 'Sick Leave' | 'Other') => setLeaveType(v)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Holiday">Holiday</SelectItem>
                                    <SelectItem value="Sick Leave">Sick Leave</SelectItem>
                                    <SelectItem value="Other">Other</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                         <Button onClick={handleAddLeave} className="w-full">
                            <Plus className="mr-2" /> Add Leave
                        </Button>
                    </CardContent>
                </Card>
            </div>
            
            <Card>
                <CardHeader>
                    <CardTitle>Scheduled Leave</CardTitle>
                    <CardDescription>A log of all upcoming and past leave.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="overflow-auto rounded-lg border max-h-96">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Member</TableHead>
                                    <TableHead>Dates</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead className="text-right">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sortedLeave.length > 0 ? sortedLeave.map(l => (
                                    <TableRow key={l.id}>
                                        <TableCell className="font-medium">{memberMap.get(l.memberId) || 'Unknown Member'}</TableCell>
                                        <TableCell className="whitespace-nowrap">{format(parseISO(l.startDate), 'd MMM yyyy')} - {format(parseISO(l.endDate), 'd MMM yyyy')}</TableCell>
                                        <TableCell>{l.type}</TableCell>
                                        <TableCell className="text-right">
                                              <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                        <AlertDialogDescription>This will permanently delete this leave entry. This action cannot be undone.</AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => deleteLeave(l.id)}>Delete</AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </TableCell>
                                    </TableRow>
                                )) : (
                                    <TableRow>
                                        <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">No leave scheduled.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </motion.div>
    )
}
