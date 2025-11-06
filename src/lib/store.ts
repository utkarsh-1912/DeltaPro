
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { AppState, RotaGeneration, Shift, ShiftStreak, TeamMember, AdhocAssignments, WeekendRota, Leave, Team, User, GeolocationConfig } from "./types";
import { startOfWeek, formatISO, parseISO, addDays, eachWeekendOfInterval, isWithinInterval, format, isSaturday } from "date-fns";
import { generateNewRotaAssignments, balanceAssignments } from "./rotaGenerator";
import { toast } from "@/hooks/use-toast";

const SHIFT_COLORS = [
    "var(--chart-1)",
    "var(--chart-2)",
    "var(--chart-3)",
    "var(--chart-4)",
    "var(--chart-5)",
];

const getInitialState = (): Omit<AppState, keyof ReturnType<typeof useRotaStoreActions>> => {
    return {
        users: [],
        teamMembers: [],
        teams: [],
        shifts: [],
        leave: [],
        generationHistory: [],
        activeGenerationId: null,
        weekendRotas: [],
        lastWeekendAssigneeIndex: -1,
        showExportFooter: true,
        attendance: [],
        geolocation: {
            officeLatitude: 51.5074, // Default to London
            officeLongitude: -0.1278,
            radius: 50, // 50 meters
        },
    }
}


const calculateShiftStreaks = (teamMembers: TeamMember[], generationHistory: RotaGeneration[]): ShiftStreak => {
    const streaks: ShiftStreak = {};
    teamMembers.forEach(member => {
        streaks[member.id] = { shiftId: null, count: 0 };
    });

    if (generationHistory.length === 0) {
        return streaks;
    }

    const sortedHistory = [...generationHistory].sort((a, b) => parseISO(a.startDate).getTime() - parseISO(b.startDate).getTime());
    
    for (const member of teamMembers) {
        let currentStreakCount = 0;
        let lastShiftId: string | null = null;

        // Iterate from most recent to oldest to find the current streak
        for (let i = sortedHistory.length - 1; i >= 0; i--) {
            const gen = sortedHistory[i];
            const memberShiftInGen = gen.assignments[member.id];

            if (i === sortedHistory.length - 1) { // Most recent generation
                lastShiftId = memberShiftInGen || null;
                if(lastShiftId) {
                    currentStreakCount = 1;
                } else {
                    break; // No shift, no streak
                }
            } else {
                if (memberShiftInGen === lastShiftId) {
                    currentStreakCount++;
                } else {
                    break; // Streak is broken
                }
            }
        }
        streaks[member.id] = { shiftId: lastShiftId, count: currentStreakCount };
    }

    return streaks;
};

const generateWeekendRotaForGeneration = (
    generation: RotaGeneration,
    allTeamMembers: TeamMember[],
    lastIndex: number
): { newRotas: WeekendRota[], nextIndex: number } => {
    const membersForGen = generation.teamMembersAtGeneration || allTeamMembers;
    const flexibleMembers = membersForGen.filter(m => !m.fixedShiftId);
    
    if (flexibleMembers.length === 0) {
        return { newRotas: [], nextIndex: lastIndex };
    }

    const interval = {
        start: parseISO(generation.startDate),
        end: parseISO(generation.endDate),
    };

    const saturdays = eachWeekendOfInterval(interval).filter(day => isSaturday(day));
    
    let assigneeIndex = lastIndex;

    const newRotas: WeekendRota[] = saturdays.map(saturday => {
        assigneeIndex = (assigneeIndex + 1) % flexibleMembers.length;
        return {
            date: formatISO(saturday),
            memberId: flexibleMembers[assigneeIndex].id,
            generationId: generation.id,
        };
    });

    return { newRotas, nextIndex: assigneeIndex };
};


export const useRotaStore = create<AppState>()(
  persist(
    (set, get) => ({
      ...getInitialState(),
      
      addUser: (user) => set((state) => {
        if (state.users.some(u => u.id === user.id)) {
            return state;
        }
        return { users: [...state.users, user] };
      }),

      addTeamMember: (name, email, teamId, fixedShiftId) =>
        set((state) => ({
          teamMembers: [
            ...state.teamMembers,
            { id: new Date().getTime().toString(), name, email, teamId, fixedShiftId },
          ],
        })),

      updateTeamMember: (id, updates) =>
        set((state) => ({
          teamMembers: state.teamMembers.map((member) =>
            member.id === id ? { ...member, ...updates } : member
          ),
        })),

      deleteTeamMember: (id) =>
        set((state) => ({
          teamMembers: state.teamMembers.filter((member) => member.id !== id),
        })),
      
      addTeam: (name, pmId) => set(state => ({
          teams: [...state.teams, { id: new Date().getTime().toString(), name, pmId: pmId === "none" ? undefined : pmId }]
      })),

      updateTeam: (id, name, pmId) => set(state => ({
          teams: state.teams.map(team => team.id === id ? { ...team, name, pmId: pmId === "none" ? undefined : pmId } : team)
      })),
      
      deleteTeam: (id) => set(state => ({
          teams: state.teams.filter(team => team.id !== id),
          // Also unassign members from the deleted team
          teamMembers: state.teamMembers.map(member => 
              member.teamId === id ? { ...member, teamId: undefined } : member
          ),
          // Also delete shifts associated with the team
          shifts: state.shifts.filter(shift => shift.teamId !== id),
      })),

      addShift: (newShiftData) =>
        set((state) => {
          const newShift: Shift = {
            id: new Date().getTime().toString(),
            ...newShiftData,
            color: SHIFT_COLORS[state.shifts.filter(s => s.teamId === newShiftData.teamId).length % SHIFT_COLORS.length],
          };
          return {
            shifts: [...state.shifts, newShift],
          };
        }),

      updateShift: (id, newShift) =>
        set((state) => ({
          shifts: state.shifts.map((shift) =>
            shift.id === id ? { ...shift, ...newShift } : shift
          ),
        })),
      
      deleteShift: (id: string) => {
        set(state => {
          const { teamMembers, shifts } = state;
          const shiftIsFixed = teamMembers.some(m => m.fixedShiftId === id);

          if (shiftIsFixed) {
              toast({
                  variant: "destructive",
                  title: "Deletion Failed",
                  description: "Cannot delete a shift that is set as a fixed shift for a team member.",
              });
              return state;
          }

          toast({
              title: "Shift Deleted",
              description: `The shift has been successfully deleted.`,
          });

          return {
              shifts: shifts.filter(s => s.id !== id),
          };
        });
      },

      addLeave: (leaveData) => set(state => {
        const newLeave: Leave = {
            id: new Date().getTime().toString(),
            ...leaveData,
        };
        toast({
            title: "Leave Added",
            description: `Leave has been successfully scheduled.`
        });
        return {
            leave: [...state.leave, newLeave]
        }
      }),

      deleteLeave: (leaveId) => set(state => {
        toast({
            variant: 'destructive',
            title: "Leave Deleted",
            description: `The leave entry has been removed.`
        });
        return {
            leave: state.leave.filter(l => l.id !== leaveId)
        }
      }),

      updateAssignmentsForGeneration: (generationId, newAssignments, newComments) => set(state => {
        const { generationHistory } = state;
        if (!generationId) return state;

        const newHistory = generationHistory.map(gen => {
          if (gen.id === generationId) {
            const originalAssignments = gen.assignments;
            const updatedOverrides = new Set(gen.manualOverrides || []);
            
            Object.keys(newAssignments).forEach(memberId => {
              if (newAssignments[memberId] !== originalAssignments[memberId]) {
                updatedOverrides.add(memberId);
              }
            });

            return { 
                ...gen, 
                assignments: newAssignments, 
                comments: newComments,
                manualOverrides: Array.from(updatedOverrides) 
            };
          }
          return gen;
        });

        return { generationHistory: newHistory };
      }),
      
      updateAssignment: (memberId, newShiftId) => {
        set(state => {
            const { activeGenerationId, generationHistory } = state;
            if (!activeGenerationId) return state;

            const newHistory = generationHistory.map(gen => {
                if (gen.id === activeGenerationId) {
                    const newAssignments = { ...gen.assignments, [memberId]: newShiftId };
                    const newOverrides = new Set(gen.manualOverrides || []);
                    newOverrides.add(memberId);
                    return { ...gen, assignments: newAssignments, manualOverrides: Array.from(newOverrides) };
                }
                return gen;
            });
            return { generationHistory: newHistory };
        });
      },

      updateAdhocAssignments: (generationId, adhocAssignments, notes) => set(state => {
        const newHistory = state.generationHistory.map(gen => {
            if (gen.id === generationId) {
                return { ...gen, adhoc: adhocAssignments, comments: notes };
            }
            return gen;
        });
        return { generationHistory: newHistory };
      }),

      generateNewRota: (startDate: Date, rotaPeriodInWeeks: number = 2, teamId: string) => {
        set(state => {
            const { teamMembers, shifts, generationHistory, leave, lastWeekendAssigneeIndex } = state;
            
            const membersInTeam = teamMembers.filter(m => m.teamId === teamId);
            if (membersInTeam.length === 0) {
              toast({
                  variant: "destructive",
                  title: "Generation Failed",
                  description: "The selected team has no members.",
              });
              return state;
            }

            const shiftsForTeam = shifts.filter(s => s.teamId === teamId);
            if (shiftsForTeam.length === 0) {
                 toast({
                  variant: "destructive",
                  title: "Generation Failed",
                  description: "The selected team has no shifts defined.",
              });
              return state;
            }

            const sortedShifts = [...shiftsForTeam].sort((a,b) => a.sequence - b.sequence);
            const newStartDate = startOfWeek(startDate, { weekStartsOn: 1 });
            const periodInDays = rotaPeriodInWeeks * 7;
            const newEndDate = addDays(newStartDate, periodInDays - 1);
            
            const membersOnLeave = membersInTeam.filter(member => 
                leave.some(l => 
                    l.memberId === member.id &&
                    isWithinInterval(newStartDate, { start: parseISO(l.startDate), end: parseISO(l.endDate) })
                )
            );
            
            const availableMembers = membersInTeam.filter(m => !membersOnLeave.some(leaveMember => leaveMember.id === m.id));

            const totalMinRequired = sortedShifts.reduce((acc, s) => acc + s.minTeam, 0);
            const flexibleMemberCount = availableMembers.filter(m => !m.fixedShiftId).length;

            if (flexibleMemberCount < totalMinRequired) {
                toast({
                    variant: "destructive",
                    title: "Staffing Warning",
                    description: `Not enough available flexible members (${flexibleMemberCount}) to meet total minimum of ${totalMinRequired}. Rota may be unbalanced.`,
                    duration: 6000,
                });
            }

            const currentMemberIds = new Set(teamMembers.map(m => m.id));
            const filteredHistory = generationHistory.map(gen => ({
              ...gen,
              assignments: Object.entries(gen.assignments)
                .filter(([memberId]) => currentMemberIds.has(memberId))
                .reduce((obj, [key, value]) => ({ ...obj, [key]: value }), {})
            }));

            const shiftStreaks = calculateShiftStreaks(availableMembers, filteredHistory);

            const initialAssignments = generateNewRotaAssignments(availableMembers, sortedShifts, shiftStreaks);
            
            const finalAssignments = balanceAssignments(initialAssignments, sortedShifts, availableMembers, shiftStreaks);
            
            membersOnLeave.forEach(member => {
                finalAssignments[member.id] = undefined; // Mark as 'Off'
            });

            const newGeneration: RotaGeneration = {
                id: new Date().getTime().toString(),
                startDate: formatISO(newStartDate),
                endDate: formatISO(newEndDate),
                teamId: teamId,
                assignments: finalAssignments,
                teamMembersAtGeneration: [...membersInTeam],
                manualOverrides: [],
                manualSwaps: [],
                manualWeekendSwaps: [],
                comments: {},
            };
            
            // Auto-generate weekend rota for the new generation
            const { newRotas: newWeekendRotas, nextIndex: newLastWeekendIndex } = generateWeekendRotaForGeneration(
                newGeneration,
                membersInTeam,
                lastWeekendAssigneeIndex
            );

            const newHistory = [...generationHistory, newGeneration];

            return { 
                generationHistory: newHistory,
                activeGenerationId: newGeneration.id,
                weekendRotas: [...state.weekendRotas, ...newWeekendRotas],
                lastWeekendAssigneeIndex: newLastWeekendIndex
            };
        });
      },

      swapShifts: (memberId1, memberId2, generationId) => {
        set(state => {
          const targetGenerationId = generationId || state.activeGenerationId;
          if (!targetGenerationId) return state;

          const newHistory = state.generationHistory.map(gen => {
              if (gen.id === targetGenerationId) {
                  const newAssignments = { ...gen.assignments };
                  const shift1 = newAssignments[memberId1];
                  const shift2 = newAssignments[memberId2];

                  if (shift2 !== undefined) newAssignments[memberId1] = shift2;
                  else delete newAssignments[memberId1];

                  if (shift1 !== undefined) newAssignments[memberId2] = shift1;
                  else delete newAssignments[memberId2];

                  const newOverrides = new Set(gen.manualOverrides || []);
                  newOverrides.add(memberId1);
                  newOverrides.add(memberId2);

                  const newSwaps = [...(gen.manualSwaps || [])];
                  newSwaps.push({ memberId1, memberId2, neutralized: false });
                  
                  return {...gen, assignments: newAssignments, manualOverrides: Array.from(newOverrides), manualSwaps: newSwaps};
              }
              return gen;
          });

          return { generationHistory: newHistory };
        });
      },
      
      toggleSwapNeutralization: (generationId, memberId1, memberId2) => set(state => ({
        generationHistory: state.generationHistory.map(gen => {
          if (gen.id === generationId) {
            return {
              ...gen,
              manualSwaps: (gen.manualSwaps || []).map(swap => 
                (swap.memberId1 === memberId1 && swap.memberId2 === memberId2) || (swap.memberId1 === memberId2 && swap.memberId2 === memberId1)
                  ? { ...swap, neutralized: !swap.neutralized }
                  : swap
              )
            }
          }
          return gen;
        })
      })),

      deleteGeneration: (generationId: string) => {
        set(state => {
            const newHistory = state.generationHistory.filter(g => g.id !== generationId);
            const newWeekendRotas = state.weekendRotas.filter(r => r.generationId !== generationId);
            
            let newActiveId = state.activeGenerationId;
            if (state.activeGenerationId === generationId) {
                newActiveId = newHistory.length > 0 ? [...newHistory].sort((a, b) => parseISO(b.startDate).getTime() - parseISO(a.startDate).getTime())[0].id : null;
            }
            
            toast({
                title: "Rota Deleted",
                description: `The rota period and its associated weekend rota have been deleted.`,
            });
            
            return {
                generationHistory: newHistory,
                activeGenerationId: newActiveId,
                weekendRotas: newWeekendRotas,
            }
        });
      },

      setActiveGenerationId: (generationId: string | null) => {
          set({ activeGenerationId: generationId });
      },

      generateWeekendRota: () => {
        // This function is now intentionally blank.
        // The logic is co-located with `generateNewRota`.
      },

      deleteWeekendRotaForPeriod: (generationId: string) => set(state => {
        const remainingRotas = state.weekendRotas.filter(rota => rota.generationId !== generationId);

        toast({
            title: "Weekend Rota Deleted",
            description: `Deleted for the selected period.`
        })

        return { weekendRotas: remainingRotas };
      }),
      
      swapWeekendAssignments: (generationId, memberId1, memberId2) => set((state) => {
        const assignmentsForGen = state.weekendRotas.filter(r => r.generationId === generationId);
        const otherAssignments = state.weekendRotas.filter(r => r.generationId !== generationId);

        const member1Dates = assignmentsForGen.filter(r => r.memberId === memberId1).map(r => r.date);
        const member2Dates = assignmentsForGen.filter(r => r.memberId === memberId2).map(r => r.date);
        
        const updatedAssignments = assignmentsForGen.map(assignment => {
            if (member1Dates.includes(assignment.date)) {
                return { ...assignment, memberId: memberId2 };
            }
            if (member2Dates.includes(assignment.date)) {
                return { ...assignment, memberId: memberId1 };
            }
            return assignment;
        });

        // Record the swap in the generation history
        const newHistory = state.generationHistory.map(gen => {
            if (gen.id === generationId) {
                 const newWeekendSwaps = [...(gen.manualWeekendSwaps || [])];
                 newWeekendSwaps.push({ memberId1, memberId2, neutralized: false });
                 return { ...gen, manualWeekendSwaps: newWeekendSwaps };
            }
            return gen;
        });

        return {
            weekendRotas: [...otherAssignments, ...updatedAssignments],
            generationHistory: newHistory
        };
      }),
      
      toggleWeekendSwapNeutralization: (generationId, memberId1, memberId2) => set(state => ({
        generationHistory: state.generationHistory.map(gen => {
          if (gen.id === generationId) {
            return {
              ...gen,
              manualWeekendSwaps: (gen.manualWeekendSwaps || []).map(swap => 
                (swap.memberId1 === memberId1 && swap.memberId2 === memberId2) || (swap.memberId1 === memberId2 && swap.memberId2 === memberId1)
                  ? { ...swap, neutralized: !swap.neutralized }
                  : swap
              )
            }
          }
          return gen;
        })
      })),

      toggleShowExportFooter: () => set(state => ({
        showExportFooter: !state.showExportFooter
      })),

      logAttendance: (userId, location) => set(state => {
        const now = new Date().toISOString();
        const activeLog = state.attendance.find(log => log.userId === userId && !log.logoutTime);
        if (activeLog) {
            // Clock out
            const updatedLog = { ...activeLog, logoutTime: now, logoutLocation: location };
            toast({ title: 'Clocked Out', description: 'Your attendance has been logged.' });
            return { attendance: state.attendance.map(log => log.id === activeLog.id ? updatedLog : log) };
        } else {
            // Clock in
            const newLog = { 
                id: new Date().getTime().toString(),
                userId, 
                loginTime: now, 
                loginLocation: location 
            };
            toast({ title: 'Clocked In', description: 'Your attendance has been logged.' });
            return { attendance: [...state.attendance, newLog] };
        }
      }),

      setGeolocationConfig: (config: GeolocationConfig) => set(state => {
        toast({ title: 'Settings Updated', description: 'Geolocation settings have been saved.' });
        return { geolocation: config };
      }),
    }),
    {
      name: "rotapro-storage",
      storage: createJSONStorage(() => localStorage),
       onRehydrateStorage: () => (state) => {
        if (state) {
            // On hydration, ensure endDates exist for old data
            let needsUpdate = false;
            state.generationHistory.forEach(gen => {
                if (!gen.endDate) {
                    needsUpdate = true;
                    const startDate = parseISO(gen.startDate);
                    // Assume old rotas were 2 weeks
                    gen.endDate = formatISO(addDays(startDate, 13));
                }
            });

            if (!state.activeGenerationId && state.generationHistory.length > 0) {
              const sortedHistory = [...state.generationHistory].sort((a, b) => parseISO(b.startDate).getTime() - parseISO(a.startDate).getTime());
              state.activeGenerationId = sortedHistory[0].id;
            }

            // Ensure lastWeekendAssigneeIndex is a number
            if(typeof state.lastWeekendAssigneeIndex !== 'number') {
                state.lastWeekendAssigneeIndex = -1;
            }
        }
      }
    }
  )
);

export const useRotaStoreActions = () => useRotaStore(state => ({
    addUser: state.addUser,
    addTeamMember: state.addTeamMember,
    updateTeamMember: state.updateTeamMember,
    deleteTeamMember: state.deleteTeamMember,
    addTeam: state.addTeam,
    updateTeam: state.updateTeam,
    deleteTeam: state.deleteTeam,
    addShift: state.addShift,
    updateShift: state.updateShift,
    deleteShift: state.deleteShift,
    addLeave: state.addLeave,
    deleteLeave: state.deleteLeave,
    generateNewRota: state.generateNewRota,
    swapShifts: state.swapShifts,
    toggleSwapNeutralization: state.toggleSwapNeutralization,
    deleteGeneration: state.deleteGeneration,
    setActiveGenerationId: state.setActiveGenerationId,
    updateAssignmentsForGeneration: state.updateAssignmentsForGeneration,
    updateAssignment: state.updateAssignment,
    updateAdhocAssignments: state.updateAdhocAssignments,
    generateWeekendRota: state.generateWeekendRota,
    deleteWeekendRotaForPeriod: state.deleteWeekendRotaForPeriod,
    swapWeekendAssignments: state.swapWeekendAssignments,
    toggleWeekendSwapNeutralization: state.toggleWeekendSwapNeutralization,
    toggleShowExportFooter: state.toggleShowExportFooter,
    logAttendance: state.logAttendance,
    setGeolocationConfig: state.setGeolocationConfig,
}));
