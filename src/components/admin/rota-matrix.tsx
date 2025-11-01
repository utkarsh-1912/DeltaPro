

"use client";

import React from "react";
import { useRotaStore, useRotaStoreActions } from "@/lib/store";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, parseISO, startOfWeek, endOfWeek, addDays, isWithinInterval, isSaturday, subMonths, isAfter } from "date-fns";
import { Badge } from "../ui/badge";
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious, PaginationFirst, PaginationLast } from "../ui/pagination";
import { Recycle, Download, ArrowRightLeft, LifeBuoy, CalendarDays, Undo2, PieChart, BarChart } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import { Button } from "../ui/button";
import { downloadCsv } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import type { RotaGeneration, Shift, TeamMember } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Bar, Pie, Cell, ResponsiveContainer, BarChart as RechartsBarChart, PieChart as RechartsPieChart, XAxis, YAxis, Tooltip as RechartsTooltip, Legend } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

const CHART_COLORS = [
    "hsl(var(--chart-1))",
    "hsl(var(--chart-2))",
    "hsl(var(--chart-3))",
    "hsl(var(--chart-4))",
    "hsl(var(--chart-5))",
];

function AnalyticsDashboard() {
    const { teamMembers, shifts, generationHistory, activeGenerationId, weekendRotas } = useRotaStore();
    
    const memberMap = React.useMemo(() => new Map(teamMembers.map(m => [m.id, m])), [teamMembers]);
    const shiftMap = React.useMemo(() => new Map(shifts.map(s => [s.id, s])), [shifts]);
    
    const activeGeneration = React.useMemo(() => 
        generationHistory.find(g => g.id === activeGenerationId)
    , [generationHistory, activeGenerationId]);

    // Data for Active Rota Shift Distribution (Pie Chart)
    const activeRotaDistribution = React.useMemo(() => {
        if (!activeGeneration) return [];
        const counts: { [shiftName: string]: number } = {};
        shifts.forEach(s => counts[s.name] = 0);

        Object.values(activeGeneration.assignments).forEach(shiftId => {
            if (shiftId) {
                const shiftName = shiftMap.get(shiftId)?.name;
                if (shiftName) {
                    counts[shiftName] = (counts[shiftName] || 0) + 1;
                }
            }
        });
        
        return Object.entries(counts).map(([name, value], index) => ({
            name,
            value,
            fill: CHART_COLORS[index % CHART_COLORS.length]
        })).filter(item => item.value > 0);
    }, [activeGeneration, shifts, shiftMap]);

    // Data for Quarterly Duties (Bar Charts)
    const quarterlyDuties = React.useMemo(() => {
        const threeMonthsAgo = subMonths(new Date(), 3);
        const weekendCounts: Record<string, number> = {};
        const adhocCounts: Record<string, number> = {};

        teamMembers.forEach(m => {
            weekendCounts[m.id] = 0;
            adhocCounts[m.id] = 0;
        });

        weekendRotas.forEach(rota => {
            if (isAfter(parseISO(rota.date), threeMonthsAgo)) {
                weekendCounts[rota.memberId]++;
            }
        });

        generationHistory.forEach(gen => {
            if (isAfter(parseISO(gen.startDate), threeMonthsAgo) && gen.adhoc) {
                Object.entries(gen.adhoc).forEach(([memberId, weekData]) => {
                    const dutyCount = Object.values(weekData).filter(v => v).length;
                    adhocCounts[memberId] = (adhocCounts[memberId] || 0) + dutyCount;
                });
            }
        });

        const weekendData = Object.entries(weekendCounts).map(([memberId, count]) => ({
            name: memberMap.get(memberId)?.name || 'Unknown',
            duties: count
        })).filter(d => d.duties > 0);

        const adhocData = Object.entries(adhocCounts).map(([memberId, count]) => ({
            name: memberMap.get(memberId)?.name || 'Unknown',
            duties: count
        })).filter(d => d.duties > 0);
        
        return { weekendData, adhocData };

    }, [generationHistory, weekendRotas, teamMembers, memberMap]);

    const chartConfig = {
        duties: { label: "Duties" },
    };

    return (
        <div className="mb-6">
            <Card>
                <CardHeader>
                    <CardTitle>Analytics Dashboard</CardTitle>
                    <CardDescription>
                        Visual insights into your team's scheduling metrics.
                    </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-6 sm:grid-cols-1 lg:grid-cols-3">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-lg"><PieChart/> Active Rota Shift Distribution</CardTitle>
                        </CardHeader>
                        <CardContent>
                             {activeRotaDistribution.length > 0 ? (
                                <ChartContainer config={{}} className="h-[250px] w-full">
                                    <RechartsPieChart>
                                        <RechartsTooltip content={<ChartTooltipContent hideLabel />} />
                                        <Pie data={activeRotaDistribution} dataKey="value" nameKey="name" innerRadius={50}>
                                            {activeRotaDistribution.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.fill} />
                                            ))}
                                        </Pie>
                                    </RechartsPieChart>
                                </ChartContainer>
                             ) : (
                                <div className="h-[250px] flex items-center justify-center text-muted-foreground">No active rota to display.</div>
                             )}
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-lg"><BarChart/> Quarterly Weekend Duties</CardTitle>
                        </CardHeader>
                        <CardContent>
                             <ChartContainer config={chartConfig} className="h-[250px] w-full">
                                <RechartsBarChart data={quarterlyDuties.weekendData} accessibilityLayer>
                                    <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} angle={-45} textAnchor="end" height={60} />
                                    <YAxis tickLine={false} axisLine={false} tickMargin={8} allowDecimals={false} />
                                    <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                                    <Bar dataKey="duties" fill="var(--chart-1)" radius={4} />
                                </RechartsBarChart>
                            </ChartContainer>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-lg"><BarChart/> Quarterly Ad-hoc Duties</CardTitle>
                        </CardHeader>
                         <CardContent>
                             <ChartContainer config={chartConfig} className="h-[250px] w-full">
                                <RechartsBarChart data={quarterlyDuties.adhocData} accessibilityLayer>
                                    <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} angle={-45} textAnchor="end" height={60} />
                                    <YAxis tickLine={false} axisLine={false} tickMargin={8} allowDecimals={false} />
                                    <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                                    <Bar dataKey="duties" fill="var(--chart-2)" radius={4} />
                                </RechartsBarChart>
                            </ChartContainer>
                        </CardContent>
                    </Card>
                </CardContent>
            </Card>
        </div>
    );
}


function getSwapDetails(gen: RotaGeneration, shiftMap: Map<string, Shift>, memberMap: Map<string, TeamMember>) {
    if (!gen.manualSwaps || gen.manualSwaps.length === 0) {
        return null;
    }
    const swap = gen.manualSwaps[0]; // Assuming one swap per generation for now
    if (!swap) return null;

    const member1 = memberMap.get(swap.memberId1);
    const member2 = memberMap.get(swap.memberId2);
    if (!member1 || !member2) return null;

    // The shift recorded in assignments is their NEW shift, so the original shifts are swapped
    const member1OriginalShift = shiftMap.get(gen.assignments[swap.memberId2]);
    const member2OriginalShift = shiftMap.get(gen.assignments[swap.memberId1]);

    if (!member1OriginalShift || !member2OriginalShift) return null;

    const sequenceDiff = member2OriginalShift.sequence - member1OriginalShift.sequence;
    let netEffect: "neutral" | number = "neutral";
    if (sequenceDiff !== 0) {
        netEffect = sequenceDiff > 0 ? 1 : -1;
    }


    return {
        members: `${member1.name} & ${member2.name}`,
        memberId1: member1.id,
        memberId2: member2.id,
        netEffect,
        m1TargetShift: member1OriginalShift,
        m2TargetShift: member2OriginalShift,
    };
}

function getWeeklyBreakdown(gen: RotaGeneration) {
    const startDate = parseISO(gen.startDate);
    const endDate = parseISO(gen.endDate);
    
    const weeks = [];
    let currentWeekStart = startOfWeek(startDate, { weekStartsOn: 1 });

    while(currentWeekStart <= endDate) {
        const currentWeekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 1 });
        weeks.push({
            start: currentWeekStart,
            end: currentWeekEnd > endDate ? endDate : currentWeekEnd,
            weekIndex: weeks.length
        });
        currentWeekStart = addDays(currentWeekStart, 7);
    }
    return weeks;
}


export function RotaMatrix() {
    const { generationHistory, shifts, weekendRotas, activeGenerationId } = useRotaStore();
    const { swapShifts, toggleSwapNeutralization, swapWeekendAssignments, toggleWeekendSwapNeutralization } = useRotaStoreActions();
    const [currentPage, setCurrentPage] = React.useState(0);
    const { toast } = useToast();
    const itemsPerPage = 5;

    const allHistoricalMembers = React.useMemo(() => {
        const memberMap = new Map<string, TeamMember>();
        generationHistory.forEach(gen => {
            if (gen.teamMembersAtGeneration) {
                gen.teamMembersAtGeneration.forEach(member => {
                    if (!memberMap.has(member.id)) {
                        memberMap.set(member.id, member);
                    }
                });
            }
        });
        return Array.from(memberMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    }, [generationHistory]);
    
    const sortedHistory = React.useMemo(() =>
        [...generationHistory].sort((a, b) => parseISO(b.startDate).getTime() - parseISO(a.startDate).getTime()),
        [generationHistory]
    );

    const pageCount = Math.ceil(sortedHistory.length / itemsPerPage);
    const paginatedHistory = sortedHistory.slice(
        currentPage * itemsPerPage,
        (currentPage + 1) * itemsPerPage
    );

    const shiftMap = React.useMemo(() => new Map(shifts.map(s => [s.id, s])), [shifts]);
    const memberMap = React.useMemo(() => new Map(allHistoricalMembers.map(m => [m.id, m])), [allHistoricalMembers]);
    
    const activeGeneration = React.useMemo(() => 
        generationHistory.find(g => g.id === activeGenerationId)
    , [generationHistory, activeGenerationId]);
    
    const swapHistory = React.useMemo(() => 
        sortedHistory
            .map(gen => {
                 if (!gen.manualSwaps || gen.manualSwaps.length === 0) return null;
                 const swap = gen.manualSwaps[0];
                 const details = getSwapDetails(gen, shiftMap, memberMap);
                 if (!details) return null;
                 return { gen, details, swap };
            })
            .filter((item): item is NonNullable<typeof item> => item !== null),
        [sortedHistory, shiftMap, memberMap]
    );
    
    const weekendSwapHistory = React.useMemo(() =>
        sortedHistory
            .map(gen => {
                if (!gen.manualWeekendSwaps || gen.manualWeekendSwaps.length === 0) return null;
                const swap = gen.manualWeekendSwaps[0];
                const member1 = memberMap.get(swap.memberId1);
                const member2 = memberMap.get(swap.memberId2);
                if (!member1 || !member2) return null;
                return {
                    gen,
                    swap,
                    members: `${member1.name} & ${member2.name}`,
                    memberId1: member1.id,
                    memberId2: member2.id,
                };
            })
            .filter((item): item is NonNullable<typeof item> => item !== null),
    [sortedHistory, memberMap]);


    const supportMatrixHeaders = React.useMemo(() => {
        const headers: {label: string, genId: string, weekIndex: number, isLastInGroup: boolean}[] = [];
        paginatedHistory.forEach((gen, genIndex) => {
            const weeks = getWeeklyBreakdown(gen);
            weeks.forEach((week, weekIndex) => {
                headers.push({
                    label: `${format(week.start, 'd')}-${format(week.end, 'd MMM')}`,
                    genId: gen.id,
                    weekIndex: week.weekIndex,
                    isLastInGroup: weekIndex === weeks.length - 1 && genIndex < paginatedHistory.length - 1
                });
            });
        });
        return headers;
    }, [paginatedHistory]);

    const handleMainExport = () => {
        if (generationHistory.length === 0) {
            toast({
                variant: "destructive",
                title: "Export Failed",
                description: "There is no rota history to export.",
            });
            return;
        }

        const header = ["Member", ...sortedHistory.map(gen => {
            const startDate = parseISO(gen.startDate);
            const endDate = parseISO(gen.endDate);
            return `${format(startDate, 'd MMM')} - ${format(endDate, 'd MMM yyyy')}`;
        })];

        const rows = allHistoricalMembers.map(member => {
            const memberRow = [member.name];
            sortedHistory.forEach(gen => {
                const shiftId = gen.assignments[member.id];
                const shift = shiftId ? shiftMap.get(shiftId) : null;
                const wasMemberInTeam = gen.teamMembersAtGeneration?.some(m => m.id === member.id) ?? false;

                if (!wasMemberInTeam) {
                    memberRow.push("Not in team");
                } else if (shift) {
                    memberRow.push(shift.name);
                } else {
                    memberRow.push("Off");
                }
            });
            return memberRow;
        });

        downloadCsv([header, ...rows], "rota-matrix-history.csv");
        toast({
            title: "Export Successful",
            description: "The complete rota matrix history has been downloaded as a CSV file.",
        });
    };

    const handleSupportExport = () => {
        if (generationHistory.length === 0) {
            toast({
                variant: "destructive",
                title: "Export Failed",
                description: "There is no ad-hoc support history to export.",
            });
            return;
        }

        const allWeeksHeaders: {label: string, genId: string, weekIndex: number}[] = [];
         sortedHistory.forEach((gen) => {
            const weeks = getWeeklyBreakdown(gen);
            weeks.forEach((week) => {
                allWeeksHeaders.push({
                    label: `${format(week.start, 'd MMM')} - ${format(week.end, 'd MMM yyyy')}`,
                    genId: gen.id,
                    weekIndex: week.weekIndex
                });
            });
        });


        const header = ["Member", ...allWeeksHeaders.map(h => h.label)];
        const noteHeader = ["Member", ...allWeeksHeaders.map(h => `${h.label} (Note)`)];
        
        const dutyRows: (string | boolean)[][] = [];
        const noteRows: string[][] = [];

        allHistoricalMembers.forEach(member => {
            const dutyRow = [member.name];
            const noteRow = [member.name];
            
            allWeeksHeaders.forEach(headerInfo => {
                const gen = sortedHistory.find(g => g.id === headerInfo.genId);
                const isOnAdhoc = gen?.adhoc?.[member.id]?.[headerInfo.weekIndex] ?? false;
                const note = gen?.comments?.[member.id] ?? "";
                
                dutyRow.push(isOnAdhoc ? "On Duty" : "");
                noteRow.push(isOnAdhoc ? note : "");
            });
            
            dutyRows.push(dutyRow);
            noteRows.push(noteRow);
        });

        const combinedHeader = ["Member", ...allWeeksHeaders.map(h => [h.label, `${h.label} (Note)`]).flat()];
        const combinedRows = allHistoricalMembers.map(member => {
            const rowData = [member.name];
             allWeeksHeaders.forEach(headerInfo => {
                 const gen = sortedHistory.find(g => g.id === headerInfo.genId);
                 const isOnAdhoc = gen?.adhoc?.[member.id]?.[headerInfo.weekIndex] ?? false;
                 const note = gen?.comments?.[member.id] ?? "";
                 rowData.push(isOnAdhoc ? "On Duty" : "");
                 rowData.push(note);
             });
            return rowData;
        });

        downloadCsv([combinedHeader, ...combinedRows], "adhoc-support-history.csv");
        toast({
            title: "Export Successful",
            description: "The ad-hoc support history has been downloaded as a CSV file.",
        });
    };

    const handleWeekendExport = () => {
        if (weekendRotas.length === 0) {
            toast({
                variant: "destructive",
                title: "Export Failed",
                description: "There is no weekend rota history to export.",
            });
            return;
        }
        
        const sortedWeekendRotas = [...weekendRotas].sort((a,b) => parseISO(a.date).getTime() - parseISO(b.date).getTime());

        const header = ["Weekend Start", "Assigned Member"];
        const rows = sortedWeekendRotas.map(rota => {
            const memberName = memberMap.get(rota.memberId)?.name || "Unknown";
            return [format(parseISO(rota.date), 'yyyy-MM-dd'), memberName];
        });

        downloadCsv([header, ...rows], "weekend-rota-history.csv");
        toast({
            title: "Export Successful",
            description: "The complete weekend rota history has been downloaded as a CSV file.",
        });
    };
    
    return (
        <TooltipProvider>
            <AnalyticsDashboard />

            <Card>
                <CardHeader className="flex-row items-center justify-between">
                    <div>
                        <CardTitle>Rota Matrix</CardTitle>
                        <CardDescription>
                            Historical view of shift assignments for all team members across all rota periods.
                        </CardDescription>
                    </div>
                    <Button variant="outline" onClick={handleMainExport} disabled={generationHistory.length === 0}>
                        <Download /> Export as CSV
                    </Button>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto rounded-lg border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="font-semibold sticky left-0 bg-card z-10">Member</TableHead>
                                    {paginatedHistory.map(gen => {
                                        const startDate = parseISO(gen.startDate);
                                        const endDate = parseISO(gen.endDate);
                                        return (
                                            <TableHead key={gen.id} className="text-center font-semibold whitespace-nowrap">
                                                {format(startDate, 'd')} - {format(endDate, 'd MMM yyyy')}
                                            </TableHead>
                                        )
                                    })}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {allHistoricalMembers.map(member => (
                                    <TableRow key={member.id}>
                                        <TableCell className="font-medium sticky left-0 bg-card z-10">{member.name}</TableCell>
                                        {paginatedHistory.map(gen => {
                                            const assignmentId = gen.assignments[member.id];
                                            const shift = assignmentId ? shiftMap.get(assignmentId) : null;
                                            const isManuallyChanged = gen.manualOverrides?.includes(member.id);
                                            const isSwapped = gen.manualSwaps?.some(s => s.memberId1 === member.id || s.memberId2 === member.id);
                                            
                                            const wasMemberInTeam = gen.teamMembersAtGeneration?.some(m => m.id === member.id) ?? false;

                                            if (!wasMemberInTeam) {
                                              return (
                                                <TableCell key={gen.id} className="text-center text-muted-foreground/50 text-xs">
                                                  Not in team
                                                </TableCell>
                                              );
                                            }

                                            return (
                                                <TableCell key={gen.id} className="text-center">
                                                    {shift ? (
                                                        <Badge
                                                            variant="secondary"
                                                            style={{ 
                                                                backgroundColor: shift.color,
                                                                color: 'hsl(var(--card-foreground))' 
                                                            }}
                                                        >
                                                            {shift.name}
                                                            {isManuallyChanged && (
                                                                <Tooltip>
                                                                    <TooltipTrigger asChild>
                                                                        <span className="ml-1.5 inline-block">
                                                                            {isSwapped 
                                                                                ? <ArrowRightLeft className="h-3 w-3" />
                                                                                : <Recycle className="h-3 w-3" />
                                                                            }
                                                                        </span>
                                                                    </TooltipTrigger>
                                                                    <TooltipContent>
                                                                        <p>
                                                                            {isSwapped ? "Shift was manually swapped" : "Shift was manually edited"}
                                                                        </p>
                                                                    </TooltipContent>
                                                                </Tooltip>
                                                            )}
                                                        </Badge>
                                                    ) : (
                                                        <span className="text-muted-foreground">Off</span>
                                                    )}
                                                </TableCell>
                                            )
                                        })}
                                    </TableRow>
                                ))}
                                {allHistoricalMembers.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={paginatedHistory.length + 1} className="text-center text-muted-foreground h-24">
                                            No team members found.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                    {sortedHistory.length === 0 && allHistoricalMembers.length > 0 && (
                        <div className="text-center text-muted-foreground py-10">
                            No rota history found. Generate your first rota to see the matrix.
                        </div>
                    )}
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

            <Card className="mt-6">
                 <CardHeader className="flex-row items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2"><LifeBuoy /> Ad-hoc Support Matrix</CardTitle>
                        <CardDescription>
                            Historical view of weekly ad-hoc support assignments and notes.
                        </CardDescription>
                    </div>
                     <Button variant="outline" onClick={handleSupportExport} disabled={generationHistory.length === 0}>
                        <Download /> Export as CSV
                    </Button>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto rounded-lg border">
                        <Table>
                             <TableHeader>
                                <TableRow>
                                    <TableHead className="font-semibold sticky left-0 bg-card z-10 min-w-[120px]">Member</TableHead>
                                     {supportMatrixHeaders.map(header => (
                                        <TableHead 
                                            key={`${header.genId}-${header.weekIndex}`} 
                                            className={cn(
                                                "text-center font-semibold whitespace-nowrap p-2",
                                                header.isLastInGroup && "border-r-2 border-border"
                                            )}
                                        >
                                            {header.label}
                                        </TableHead>
                                    ))}
                                </TableRow>
                            </TableHeader>
                             <TableBody>
                                 {allHistoricalMembers.map(member => (
                                    <TableRow key={member.id}>
                                        <TableCell className="font-medium sticky left-0 bg-card z-10">{member.name}</TableCell>
                                        {supportMatrixHeaders.map(header => {
                                            const gen = paginatedHistory.find(g => g.id === header.genId);
                                            const adhocAssignments = gen?.adhoc || {};
                                            const memberAdhoc = adhocAssignments[member.id];
                                            const isOnAdhoc = memberAdhoc && memberAdhoc[header.weekIndex];
                                            const adhocNotes = gen?.comments || {};
                                            const note = adhocNotes[member.id];

                                            return (
                                                <TableCell 
                                                    key={`${header.genId}-${header.weekIndex}`} 
                                                    className={cn(
                                                        "text-center text-xs p-2",
                                                        header.isLastInGroup && "border-r-2 border-border"
                                                    )}
                                                >
                                                   {isOnAdhoc ? (
                                                       <Tooltip>
                                                          <TooltipTrigger asChild>
                                                            <Badge>{note ? "Note" : "On Duty"}</Badge>
                                                          </TooltipTrigger>
                                                          {note && <TooltipContent><p>{note}</p></TooltipContent>}
                                                        </Tooltip>
                                                   ) : <span className="text-muted-foreground">-</span>}
                                                </TableCell>
                                            )
                                        })}
                                    </TableRow>
                                ))}
                                {allHistoricalMembers.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={supportMatrixHeaders.length + 1} className="text-center text-muted-foreground h-24">
                                            No team members found.
                                        </TableCell>
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

            <Card className="mt-6">
                <CardHeader  className="flex-row items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2"><CalendarDays /> Weekend Rota Matrix</CardTitle>
                        <CardDescription>
                            Historical view of weekend duty assignments.
                        </CardDescription>
                    </div>
                    <Button variant="outline" onClick={handleWeekendExport} disabled={weekendRotas.length === 0}>
                        <Download /> Export as CSV
                    </Button>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto rounded-lg border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="font-semibold sticky left-0 bg-card z-10">Member</TableHead>
                                    {paginatedHistory.map(gen => {
                                        const startDate = parseISO(gen.startDate);
                                        const endDate = parseISO(gen.endDate);
                                        return (
                                            <TableHead key={gen.id} className="text-center font-semibold whitespace-nowrap">
                                                {format(startDate, 'd')} - {format(endDate, 'd MMM yyyy')}
                                            </TableHead>
                                        )
                                    })}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {allHistoricalMembers.map(member => (
                                    <TableRow key={member.id}>
                                        <TableCell className="font-medium sticky left-0 bg-card z-10">{member.name}</TableCell>
                                        {paginatedHistory.map(gen => {
                                            const weekendAssignments = weekendRotas.filter(wr => wr.generationId === gen.id && wr.memberId === member.id);
                                            const weekendDates = weekendAssignments.map(wa => format(parseISO(wa.date), 'd MMM')).join(', ');
                                            return (
                                                <TableCell key={gen.id} className="text-center text-xs">
                                                    {weekendDates || <span className="text-muted-foreground">-</span>}
                                                </TableCell>
                                            )
                                        })}
                                    </TableRow>
                                ))}
                                {allHistoricalMembers.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={paginatedHistory.length + 1} className="text-center text-muted-foreground h-24">
                                            No team members found.
                                        </TableCell>
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

             {swapHistory.length > 0 && (
                <Card className="mt-6">
                    <CardHeader>
                        <CardTitle>Manual Swap History</CardTitle>
                        <CardDescription>
                            A log of all manual shift swaps that have occurred.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                         <div className="overflow-x-auto rounded-lg border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Rota Period</TableHead>
                                        <TableHead>Members Involved</TableHead>
                                        <TableHead>Shifts Swapped</TableHead>
                                        <TableHead>Net Effect</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {swapHistory.map(({ gen, details, swap }) => {
                                        const startDate = parseISO(gen.startDate);
                                        const endDate = parseISO(gen.endDate);
                                        const member1Id = gen.manualSwaps![0].memberId1;
                                        const member2Id = gen.manualSwaps![0].memberId2;
                                        const shift1 = shiftMap.get(gen.assignments[member2Id])?.name || 'N/A';
                                        const shift2 = shiftMap.get(gen.assignments[member1Id])?.name || 'N/A';

                                        const canCancel = React.useMemo(() => {
                                            if (!activeGeneration || !details) return false;
                                            const currentShiftM1 = activeGeneration.assignments[details.memberId1];
                                            const currentShiftM2 = activeGeneration.assignments[details.memberId2];
                                            return currentShiftM1 === details.m2TargetShift.id && currentShiftM2 === details.m1TargetShift.id;
                                        }, [activeGeneration, details]);

                                        const handleSwapAction = () => {
                                            if (!activeGeneration || !details) return;
                                            swapShifts(details.memberId1, details.memberId2, activeGeneration.id);
                                            toggleSwapNeutralization(gen.id, details.memberId1, details.memberId2);
                                            
                                            const actionText = swap.neutralized ? "reset" : "canceled out";
                                            toast({
                                                title: `Swap ${actionText}`,
                                                description: `The manual change between ${details.members} has been ${actionText}.`,
                                            });
                                        };

                                        return (
                                            <TableRow key={gen.id} className={cn(swap.neutralized && "text-muted-foreground line-through")}>
                                                <TableCell className="font-medium whitespace-nowrap">
                                                    {format(startDate, 'd MMM')} - {format(endDate, 'd MMM yyyy')}
                                                </TableCell>
                                                <TableCell>{details?.members}</TableCell>
                                                <TableCell>{`${shift1} ↔ ${shift2}`}</TableCell>
                                                <TableCell>
                                                    {details?.netEffect !== 'neutral' && (
                                                        <Badge variant={details?.netEffect === 1 ? "default" : "destructive"}>
                                                            {details?.netEffect === 1 ? '+1' : '-1'}
                                                        </Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <div>
                                                                <Button 
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    disabled={!canCancel}
                                                                    onClick={handleSwapAction}
                                                                    className={cn(swap.neutralized && "text-destructive hover:text-destructive")}
                                                                >
                                                                    {swap.neutralized ? <Undo2 /> : <Recycle />}
                                                                    <span className="sr-only">{swap.neutralized ? "Reset Swap" : "Cancel Out"}</span>
                                                                </Button>
                                                            </div>
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                            {canCancel ? (
                                                                <p>{swap.neutralized ? "Reset this canceled swap" : "Cancel out this swap"}</p>
                                                            ) : (
                                                                <p>To cancel out, the active rota must have <br/> an opposing swap opportunity.</p>
                                                            )}
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            )}

            {weekendSwapHistory.length > 0 && (
                <Card className="mt-6">
                    <CardHeader>
                        <CardTitle>Manual Weekend Swap History</CardTitle>
                        <CardDescription>
                            A log of all manual weekend duty swaps that have occurred.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                         <div className="overflow-x-auto rounded-lg border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Rota Period</TableHead>
                                        <TableHead>Members Involved</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {weekendSwapHistory.map(({ gen, swap, members, memberId1, memberId2 }) => {
                                        const startDate = parseISO(gen.startDate);
                                        const endDate = parseISO(gen.endDate);

                                        const handleWeekendSwapAction = () => {
                                            if (!activeGeneration) return;
                                            swapWeekendAssignments(activeGeneration.id, memberId1, memberId2);
                                            toggleWeekendSwapNeutralization(gen.id, memberId1, memberId2);
                                            
                                            const actionText = swap.neutralized ? "reset" : "canceled out";
                                            toast({
                                                title: `Weekend Swap ${actionText}`,
                                                description: `The manual weekend swap between ${members} has been ${actionText}.`,
                                            });
                                        };

                                        return (
                                            <TableRow key={gen.id} className={cn(swap.neutralized && "text-muted-foreground line-through")}>
                                                <TableCell className="font-medium whitespace-nowrap">
                                                    {format(startDate, 'd MMM')} - {format(endDate, 'd MMM yyyy')}
                                                </TableCell>
                                                <TableCell>{members}</TableCell>
                                                <TableCell className="text-right">
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <div>
                                                                <Button 
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    onClick={handleWeekendSwapAction}
                                                                    className={cn(swap.neutralized && "text-destructive hover:text-destructive")}
                                                                >
                                                                    {swap.neutralized ? <Undo2 /> : <Recycle />}
                                                                    <span className="sr-only">{swap.neutralized ? "Reset Weekend Swap" : "Cancel Out Weekend Swap"}</span>
                                                                </Button>
                                                            </div>
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                            <p>{swap.neutralized ? "Reset this canceled weekend swap" : "Cancel out this weekend swap"}</p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            )}
        </TooltipProvider>
    )
}

    

    