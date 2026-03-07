
"use client";

import React from "react";
import { useRotaStore } from "@/lib/store";
import { Table, TableBody, TableCell, TableRow, TableHead, TableHeader } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { TeamMember } from "@/lib/types";
import { Recycle, ArrowRightLeft } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export const RotaTable = React.forwardRef<HTMLDivElement>((props, ref) => {
  const { generationHistory, activeGenerationId, teamMembers: allTeamMembers, shifts } = useRotaStore();
  const [isMounted, setIsMounted] = React.useState(false);

  React.useEffect(() => setIsMounted(true), []);

  const activeGeneration = React.useMemo(() =>
    generationHistory.find(g => g.id === activeGenerationId)
    , [generationHistory, activeGenerationId]);

  const teamMembersInRota = React.useMemo(() => {
    if (!activeGeneration) return allTeamMembers;
    const members = activeGeneration.teamMembersAtGeneration || allTeamMembers;
    // Filter to only include members who have an assignment in this generation
    return members.filter(member => activeGeneration.assignments[member.id]);
  }, [activeGeneration, allTeamMembers]);

  if (!isMounted || !activeGeneration) {
    return (
      <div ref={ref}>
        <Skeleton className="h-8 w-full rounded-t-lg" />
        <div className="border-x border-b rounded-b-lg">
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    );
  }

  const shiftMap = new Map(shifts.map((s) => [s.id, s]));
  const { assignments, manualOverrides, manualSwaps } = activeGeneration;

  return (
    <TooltipProvider>
      <div className="overflow-x-auto rounded-lg border bg-card" ref={ref}>
        <Table>
          <TableHeader>
            <TableRow>
              {teamMembersInRota.map((member) => (
                <TableHead key={member!.id} className="text-center font-semibold">{member!.name}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              {teamMembersInRota.map((member) => {
                if (!member) return null;
                const shiftId = assignments[member.id];
                const shift = shiftId ? shiftMap.get(shiftId) : null;
                const isManuallyChanged = manualOverrides?.includes(member.id);
                const isSwapped = manualSwaps?.some(s => s.memberId1 === member.id || s.memberId2 === member.id);

                return (
                  <TableCell key={member.id} className="text-center p-2 align-top h-24 group">
                    {shift ? (
                      <div className="flex flex-col items-center gap-1 relative">
                        <Badge
                          variant="secondary"
                          className="font-semibold text-base whitespace-nowrap"
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
                        <div className="text-xs text-muted-foreground font-mono">
                          {shift.startTime} - {shift.endTime}
                        </div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">Not Assigned</span>
                    )}
                  </TableCell>
                );
              })}
            </TableRow>
            {teamMembersInRota.length === 0 && (
              <TableRow>
                <TableCell colSpan={99} className="h-24 text-center text-muted-foreground">
                  No team members. Please add members in the Admin Panel.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </TooltipProvider>
  );
});

RotaTable.displayName = "RotaTable";

