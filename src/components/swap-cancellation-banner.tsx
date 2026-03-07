
"use client";

import React from "react";
import { useRotaStore, useRotaStoreActions } from "@/lib/store";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { format, parseISO } from "date-fns";
import { Recycle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import type { RotaGeneration, Shift, TeamMember } from "@/lib/types";

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
    const member1OriginalShift = shiftMap.get(gen.assignments[swap.memberId2]!);
    const member2OriginalShift = shiftMap.get(gen.assignments[swap.memberId1]!);

    if (!member1OriginalShift || !member2OriginalShift) return null;

    return {
        members: `${member1.name} & ${member2.name}`,
        memberId1: member1.id,
        memberId2: member2.id,
        originalGenId: gen.id,
        originalGenDate: gen.startDate,
        // The shifts they would need to be swapped back into
        m1TargetShift: member1OriginalShift,
        m2TargetShift: member2OriginalShift,
    };
}


export function SwapCancellationBanner() {
    const { generationHistory, shifts, activeGenerationId } = useRotaStore();
    const { swapShifts } = useRotaStoreActions();
    const { toast } = useToast();

    const opportunity = React.useMemo(() => {
        if (!activeGenerationId) return null;

        const activeGeneration = generationHistory.find(g => g.id === activeGenerationId);
        if (!activeGeneration) return null;

        const shiftMap = new Map(shifts.map(s => [s.id, s]));
        const memberMap = new Map((activeGeneration.teamMembersAtGeneration || []).map(m => [m.id, m]));

        // Find all historical swaps that haven't been cancelled out
        const historicalSwaps = generationHistory
            .filter(gen => gen.id !== activeGeneration.id && gen.manualSwaps && gen.manualSwaps.length > 0)
            .map(gen => getSwapDetails(gen, shiftMap, memberMap))
            .filter(details => details !== null);

        // Check if the current active rota presents a cancellation opportunity
        for (const swap of historicalSwaps) {
            if (!swap) continue;
            const currentShiftM1 = activeGeneration.assignments[swap.memberId1];
            const currentShiftM2 = activeGeneration.assignments[swap.memberId2];

            // A swap-back is possible if M1 currently has M2's original shift, and vice-versa
            if (currentShiftM1 === swap.m2TargetShift.id && currentShiftM2 === swap.m1TargetShift.id) {
                return swap; // Found an opportunity
            }
        }

        return null;

    }, [activeGenerationId, generationHistory, shifts]);


    if (!opportunity) {
        return null;
    }

    const handleSwapBack = () => {
        swapShifts(opportunity.memberId1, opportunity.memberId2, activeGenerationId!);
        toast({
            title: "Swap Back Executed",
            description: `Shifts for ${opportunity.members} have been swapped back, cancelling out the manual change from ${format(parseISO(opportunity.originalGenDate), 'd MMM yyyy')}.`,
        });
    };

    return (
        <Card className="bg-accent border-primary/50">
            <CardHeader className="flex flex-row items-center justify-between p-4">
                <div className="flex items-center gap-3">
                    <Recycle className="h-5 w-5 text-primary" />
                    <div>
                        <CardTitle className="text-base">Cancel Out a Past Swap</CardTitle>
                        <CardDescription>
                            A chance has come up to cancel the manual swap between <span className="font-semibold">{opportunity.members}</span> from {format(parseISO(opportunity.originalGenDate), 'd MMM yyyy')}.
                        </CardDescription>
                    </div>
                </div>
                <Button onClick={handleSwapBack}>
                    Swap Back
                </Button>
            </CardHeader>
        </Card>
    )
}
