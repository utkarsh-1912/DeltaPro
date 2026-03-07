
import type { TeamMember, Shift, RotaAssignments, ShiftStreak } from "./types";

function shuffle<T>(array: T[]): T[] {
    let currentIndex = array.length, randomIndex;
    while (currentIndex !== 0) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
        [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
    }
    return array;
}

const getNextShift = (currentShiftId: string | null | undefined, sortedShifts: Shift[]): Shift => {
    if (sortedShifts.length === 0) {
        throw new Error("Cannot get next shift from an empty array.");
    }

    if (!currentShiftId) {
        return sortedShifts[0];
    }

    const currentShift = sortedShifts.find(s => s.id === currentShiftId);
    if (!currentShift) {
        return sortedShifts[0];
    }

    const currentSequence = currentShift.sequence;
    let nextShift = sortedShifts.find(s => s.sequence > currentSequence);

    if (!nextShift) {
        nextShift = sortedShifts[0];
    }

    return nextShift;
}

const isTransitionAllowed = (fromShift: Shift | undefined, toShift: Shift): boolean => {
    if (!fromShift) return true;
    if (fromShift.isExtreme && toShift.isExtreme) return false;
    return true;
};


export const generateNewRotaAssignments = (
    teamMembers: TeamMember[],
    allShifts: Shift[],
    shiftStreaks: ShiftStreak
): RotaAssignments => {

    const assignments: RotaAssignments = {};
    const shiftMap = new Map(allShifts.map(s => [s.id, s]));
    const sortedShifts = [...allShifts].sort((a, b) => a.sequence - b.sequence);
    if (sortedShifts.length === 0) return {};

    const flexibleMembers = shuffle(teamMembers.filter(m => !m.fixedShiftId));
    const assignedCounts: Record<string, number> = {};
    allShifts.forEach(s => assignedCounts[s.id] = 0);

    // 1. Assign fixed shifts first and remove them from the pool
    teamMembers.forEach(member => {
        if (member.fixedShiftId) {
            const shiftId = member.fixedShiftId;
            if (shiftMap.has(shiftId)) {
                assignments[member.id] = shiftId;
                assignedCounts[shiftId]++;
            }
        }
    });

    if (flexibleMembers.length >= sortedShifts.length) {
        const remainingMembers = [...flexibleMembers];
        const stillNeedsAssignment: TeamMember[] = [];

        // Pass 1: Try to assign members based on streaks and ideal next shifts
        remainingMembers.forEach(member => {
            const streak = shiftStreaks[member.id];
            const lastShiftId = streak?.shiftId;
            const lastShift = lastShiftId ? shiftMap.get(lastShiftId) : undefined;
            let assigned = false;

            let mustRotate = false;
            if (lastShift) {
                const maxStreak = lastShift.isExtreme ? 1 : 2;
                if (streak.count >= maxStreak) {
                    mustRotate = true;
                }
            }

            const idealNextShift = getNextShift(lastShiftId, sortedShifts);

            // Priority 1: Rotate if streak is maxed out
            if (mustRotate) {
                if (isTransitionAllowed(lastShift, idealNextShift) && assignedCounts[idealNextShift.id] < idealNextShift.maxTeam) {
                    assignments[member.id] = idealNextShift.id;
                    assignedCounts[idealNextShift.id]++;
                    assigned = true;
                }
            } else {
                // Priority 2: Try to move to the ideal next shift if not forced to rotate
                if (isTransitionAllowed(lastShift, idealNextShift) && assignedCounts[idealNextShift.id] < idealNextShift.maxTeam) {
                    assignments[member.id] = idealNextShift.id;
                    assignedCounts[idealNextShift.id]++;
                    assigned = true;
                }
                // Priority 3: If not, try to stay on the same shift if allowed
                else if (lastShift && assignedCounts[lastShift.id] < lastShift.maxTeam) {
                    assignments[member.id] = lastShift.id;
                    assignedCounts[lastShift.id]++;
                    assigned = true;
                }
            }

            if (!assigned) {
                stillNeedsAssignment.push(member);
            }
        });

        // Pass 2: Assign any remaining members to the first available forward-moving shift
        stillNeedsAssignment.forEach(member => {
            const lastShiftId = shiftStreaks[member.id]?.shiftId;
            const lastShift = lastShiftId ? shiftMap.get(lastShiftId) : undefined;
            let searchStartShift = getNextShift(lastShiftId, sortedShifts);

            for (let i = 0; i < sortedShifts.length; i++) {
                const targetShift = searchStartShift;
                if (assignedCounts[targetShift.id] < targetShift.maxTeam && isTransitionAllowed(lastShift, targetShift)) {
                    assignments[member.id] = targetShift.id;
                    assignedCounts[targetShift.id]++;
                    return; // Member assigned, exit loop for this member
                }
                searchStartShift = getNextShift(searchStartShift.id, sortedShifts); // Move to next shift in sequence
            }
        });

    } else {
        // Existing logic for when there are fewer people than shifts
        const mustRotate: TeamMember[] = [];
        const canContinue: TeamMember[] = [];
        const freshStart: TeamMember[] = [];

        flexibleMembers.forEach(member => {
            const streak = shiftStreaks[member.id];
            if (!streak || !streak.shiftId) {
                freshStart.push(member);
                return;
            }
            const lastShift = shiftMap.get(streak.shiftId);
            if (!lastShift) {
                freshStart.push(member);
                return;
            }
            if ((lastShift.isExtreme && streak.count >= 1) || (!lastShift.isExtreme && streak.count >= 2)) {
                mustRotate.push(member);
            } else {
                canContinue.push(member);
            }
        });

        mustRotate.forEach(member => {
            const lastShiftId = shiftStreaks[member.id]?.shiftId;
            const nextShift = getNextShift(lastShiftId, sortedShifts);

            if (assignedCounts[nextShift.id] < nextShift.maxTeam) {
                assignments[member.id] = nextShift.id;
                assignedCounts[nextShift.id]++;
            }
        });

        canContinue.forEach(member => {
            const lastShiftId = shiftStreaks[member.id].shiftId!;
            if (assignedCounts[lastShiftId] < shiftMap.get(lastShiftId)!.maxTeam) {
                assignments[member.id] = lastShiftId;
                assignedCounts[lastShiftId]++;
            }
        });

        const unassignedMembers = flexibleMembers.filter(m => !assignments[m.id]);

        for (const shift of sortedShifts) {
            while (assignedCounts[shift.id] < shift.minTeam) {
                const memberIndex = unassignedMembers.findIndex(member => {
                    if (assignments[member.id]) return false;
                    const lastShiftId = shiftStreaks[member.id]?.shiftId;
                    if (lastShiftId) {
                        const lastShift = shiftMap.get(lastShiftId);
                        if (lastShift && lastShift.sequence >= shift.sequence && !(lastShift.sequence === sortedShifts[sortedShifts.length - 1].sequence && shift.sequence === sortedShifts[0].sequence)) {
                            return false;
                        }
                    }
                    return isTransitionAllowed(lastShiftId ? shiftMap.get(lastShiftId) : undefined, shift);
                });

                if (memberIndex !== -1) {
                    const member = unassignedMembers[memberIndex];
                    assignments[member.id] = shift.id;
                    assignedCounts[shift.id]++;
                    unassignedMembers.splice(memberIndex, 1);
                } else {
                    break;
                }
            }
        }

        unassignedMembers.forEach(member => {
            if (assignments[member.id]) return;
            const lastShiftId = shiftStreaks[member.id]?.shiftId;
            let searchStartShift = lastShiftId ? getNextShift(lastShiftId, sortedShifts) : sortedShifts[0];
            for (let i = 0; i < sortedShifts.length; i++) {
                const targetShift = searchStartShift;
                if (assignedCounts[targetShift.id] < targetShift.maxTeam && isTransitionAllowed(lastShiftId ? shiftMap.get(lastShiftId) : undefined, targetShift)) {
                    assignments[member.id] = targetShift.id;
                    assignedCounts[targetShift.id]++;
                    return;
                }
                searchStartShift = getNextShift(searchStartShift.id, sortedShifts);
            }
        });

        const stillUnassigned = flexibleMembers.filter(m => !assignments[m.id]);
        stillUnassigned.forEach(member => {
            const anyAvailableShift = sortedShifts.find(s => assignedCounts[s.id] < s.maxTeam);
            if (anyAvailableShift) {
                assignments[member.id] = anyAvailableShift.id;
                assignedCounts[anyAvailableShift.id]++;
            }
        });
    }

    return balanceAssignments(assignments, sortedShifts, teamMembers, shiftStreaks);
};


export const balanceAssignments = (
    assignments: RotaAssignments,
    shifts: Shift[],
    teamMembers: TeamMember[],
    shiftStreaks: ShiftStreak
): RotaAssignments => {
    const shiftMap = new Map(shifts.map(s => [s.id, s]));
    const memberMap = new Map(teamMembers.map(m => [m.id, m]));
    const balancedAssignments = { ...assignments };
    const sortedShifts = [...shifts].sort((a, b) => a.sequence - b.sequence);

    const calculateCounts = () => {
        const counts: Record<string, string[]> = {};
        shifts.forEach(s => counts[s.id] = []);
        for (const memberId in balancedAssignments) {
            const member = memberMap.get(memberId);
            if (member && !member.fixedShiftId) {
                const shiftId = balancedAssignments[memberId];
                if (shiftId && counts[shiftId]) {
                    counts[shiftId].push(memberId);
                }
            }
        }
        return counts;
    };

    let shiftCounts = calculateCounts();
    let loops = 0;

    while (loops < 20) {
        const understaffedShifts = sortedShifts.filter(s => (shiftCounts[s.id]?.length ?? 0) < s.minTeam);
        const overstaffedShifts = sortedShifts.filter(s => (shiftCounts[s.id]?.length ?? 0) > s.maxTeam);

        if (understaffedShifts.length === 0 && overstaffedShifts.length === 0) {
            break;
        }

        let moved = false;

        // Priority 1: Move from overstaffed to understaffed
        if (understaffedShifts.length > 0 && overstaffedShifts.length > 0) {
            const targetShift = understaffedShifts[0];
            const sourceShift = overstaffedShifts[0];

            const memberToMove = (shiftCounts[sourceShift.id] || []).find(memberId => {
                const lastShift = shiftStreaks[memberId]?.shiftId ? shiftMap.get(shiftStreaks[memberId].shiftId!) : undefined;
                return isTransitionAllowed(lastShift, targetShift);
            });

            if (memberToMove) {
                balancedAssignments[memberToMove] = targetShift.id;
                moved = true;
            }
        }

        // If no simple move, try to balance from appropriately staffed shifts to understaffed ones
        if (!moved && understaffedShifts.length > 0) {
            const targetShift = understaffedShifts[0];
            const potentialSourceShifts = sortedShifts.filter(s => (shiftCounts[s.id]?.length ?? 0) > s.minTeam);

            for (const sourceShift of potentialSourceShifts) {
                const memberToMove = (shiftCounts[sourceShift.id] || []).find(memberId => {
                    const lastShift = shiftStreaks[memberId]?.shiftId ? shiftMap.get(shiftStreaks[memberId].shiftId!) : undefined;
                    return isTransitionAllowed(lastShift, targetShift);
                });

                if (memberToMove) {
                    balancedAssignments[memberToMove] = targetShift.id;
                    moved = true;
                    break;
                }
            }
        }

        if (moved) {
            shiftCounts = calculateCounts();
            loops++;
            continue;
        }

        // Handle unassigned members if any exist
        const unassignedMembers = teamMembers.filter(m => !m.fixedShiftId && !balancedAssignments[m.id]);
        if (unassignedMembers.length > 0 && understaffedShifts.length > 0) {
            const memberToAssign = unassignedMembers[0];
            const targetShift = understaffedShifts[0];
            const lastShift = shiftStreaks[memberToAssign.id]?.shiftId ? shiftMap.get(shiftStreaks[memberToAssign.id].shiftId!) : undefined;
            if (isTransitionAllowed(lastShift, targetShift)) {
                balancedAssignments[memberToAssign.id] = targetShift.id;
                shiftCounts = calculateCounts();
                loops++;
                continue;
            }
        }


        console.warn("Could not fully balance shifts. Check constraints vs. team size.", { understaffedShifts, overstaffedShifts });
        break;
    }

    return balancedAssignments;
};
