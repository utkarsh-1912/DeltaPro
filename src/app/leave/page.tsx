
"use client";

import React from "react";
import { useRotaStore, useRotaStoreActions } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { CalendarIcon, Plus, Trash2, Download } from "lucide-react";
import { format, parseISO } from "date-fns";
import type { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { downloadCsv } from "@/lib/utils";
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious, PaginationFirst, PaginationLast } from "@/components/ui/pagination";


export default function LeavePage() {
    const { teamMembers, leave } = useRotaStore();
    const { addLeave, deleteLeave } = useRotaStoreActions();
    const { toast } = useToast();

    const [memberId, setMemberId] = React.useState<string | undefined>();
    const [dateRange, setDateRange] = React.useState<DateRange | undefined>();
    const [leaveType, setLeaveType] = React.useState<'Holiday' | 'Sick Leave' | 'Other'>('Holiday');
    const [searchTerm, setSearchTerm] = React.useState("");
    const [currentPage, setCurrentPage] = React.useState(0);
    const itemsPerPage = 10;

    const memberMap = React.useMemo(() => new Map(teamMembers.map(m => [m.id, m.name])), [teamMembers]);
    
    const sortedAndFilteredLeave = React.useMemo(() => {
        const sorted = [...leave].sort((a,b) => parseISO(b.startDate).getTime() - parseISO(a.startDate).getTime());
        if (!searchTerm) {
            return sorted;
        }
        return sorted.filter(l => {
            const memberName = memberMap.get(l.memberId)?.toLowerCase() || "";
            return memberName.includes(searchTerm.toLowerCase());
        });
    }, [leave, searchTerm, memberMap]);

    const pageCount = Math.ceil(sortedAndFilteredLeave.length / itemsPerPage);
    const paginatedLeave = sortedAndFilteredLeave.slice(
        currentPage * itemsPerPage,
        (currentPage + 1) * itemsPerPage
    );

    const handleAddLeave = () => {
        if (!memberId || !dateRange?.from) {
            toast({
                variant: "destructive",
                title: "Incomplete Information",
                description: "Please select a team member and a date or date range.",
            });
            return;
        }

        const finalDateRange = {
            from: dateRange.from,
            to: dateRange.to || dateRange.from
        };

        addLeave({
            memberId,
            startDate: finalDateRange.from.toISOString(),
            endDate: finalDateRange.to.toISOString(),
            type: leaveType,
        });

        // Reset form
        setMemberId(undefined);
        setDateRange(undefined);
        setLeaveType('Holiday');
    };
    
     const handleDateSelect = (range: DateRange | undefined) => {
        if (range?.from && !range.to) {
             if(dateRange?.from && dateRange?.to) {
                setDateRange({ from: range.from, to: undefined });
                return;
             }
            if (dateRange?.from && range.from.getTime() === dateRange.from.getTime()) {
                 setDateRange({ from: range.from, to: range.from });
                 return;
            }
        }
        setDateRange(range);
    }
    
    const handleExport = () => {
        if (leave.length === 0) {
            toast({
                variant: "destructive",
                title: "Export Failed",
                description: "There is no leave data to export.",
            });
            return;
        }

        const dataToExport = leave.map(l => ({
            "Member Name": memberMap.get(l.memberId) || 'Unknown Member',
            "Start Date": format(parseISO(l.startDate), 'yyyy-MM-dd'),
            "End Date": format(parseISO(l.endDate), 'yyyy-MM-dd'),
            "Type": l.type,
            "Days": (parseISO(l.endDate).getTime() - parseISO(l.startDate).getTime()) / (1000 * 3600 * 24) + 1
        }));
        
        const headers = ["Member Name", "Start Date", "End Date", "Type", "Days"];
        const rows = dataToExport.map(row => headers.map(header => row[header as keyof typeof row]));
        
        downloadCsv([headers, ...rows], "leave-matrix.csv");
        toast({
            title: "Export Successful",
            description: "Leave data has been exported to CSV.",
        });
    }


    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="p-4 sm:p-6 space-y-6"
        >
            <Card>
                <CardHeader>
                    <CardTitle>Leave Matrix</CardTitle>
                    <CardDescription>Schedule and track time off for your team members. Scheduled leave will automatically be considered during rota generation.</CardDescription>
                </CardHeader>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Schedule Leave</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                                onSelect={handleDateSelect}
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
                    <div className="flex items-end">
                        <Button onClick={handleAddLeave} className="w-full">
                        <Plus className="mr-2" /> Add Leave
                    </Button>
                    </div>
                </CardContent>
            </Card>
            
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Scheduled Leave</CardTitle>
                        <CardDescription>A log of all upcoming and past leave.</CardDescription>
                    </div>
                     <div className="flex items-center gap-2">
                        <Input 
                            placeholder="Search by name..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full sm:w-64"
                        />
                        <Button variant="outline" onClick={handleExport}>
                            <Download className="mr-2"/>
                            Export
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="rounded-lg border">
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
                                {paginatedLeave.length > 0 ? paginatedLeave.map(l => (
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
                                        <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">No leave scheduled matching your search.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
                {pageCount > 1 && (
                    <CardFooter>
                        <Pagination>
                            <PaginationContent>
                                <PaginationItem>
                                    <PaginationFirst 
                                        onClick={() => setCurrentPage(0)}
                                        className={cn("cursor-pointer", currentPage === 0 && "pointer-events-none opacity-50")}
                                    />
                                </PaginationItem>
                                <PaginationItem>
                                    <PaginationPrevious 
                                        onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))} 
                                        className={cn("cursor-pointer", currentPage === 0 && "pointer-events-none opacity-50")}
                                    />
                                </PaginationItem>
                                <PaginationItem>
                                    <span className="text-sm font-medium">
                                        Page {currentPage + 1} of {pageCount}
                                    </span>
                                </PaginationItem>
                                <PaginationItem>
                                    <PaginationNext 
                                        onClick={() => setCurrentPage(prev => Math.min(pageCount - 1, prev + 1))}
                                        className={cn("cursor-pointer", currentPage === pageCount - 1 && "pointer-events-none opacity-50")}
                                    />
                                </PaginationItem>
                                <PaginationItem>
                                    <PaginationLast 
                                        onClick={() => setCurrentPage(pageCount - 1)}
                                        className={cn("cursor-pointer", currentPage === pageCount - 1 && "pointer-events-none opacity-50")}
                                    />
                                </PaginationItem>
                            </PaginationContent>
                        </Pagination>
                    </CardFooter>
                )}
            </Card>
        </motion.div>
    )
}

    

    