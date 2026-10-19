
import { create } from "zustand";
import type { AppState, RotaGeneration, Shift, ShiftStreak, TeamMember, AdhocAssignments, WeekendRota, Leave, Team, User, GeolocationConfig } from "./types";
import { startOfWeek, formatISO, parseISO, addDays, eachWeekendOfInterval, isWithinInterval, format, isSaturday, endOfDay } from "date-fns";
import { generateNewRotaAssignments, balanceAssignments } from "./rotaGenerator";
import { toast } from "@/hooks/use-toast";

const SHIFT_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

// -------- DB sync helpers --------
// The store updates the UI first; these persist the change and tell the user when the
// server refused it (validation, permissions), so a reload never silently loses edits.
async function sync(method: "POST" | "PUT" | "DELETE", path: string, body?: any): Promise<boolean> {
  try {
    const res = await fetch(path, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (res.ok) return true;
    const data = await res.json().catch(() => ({}));
    toast({
      variant: "destructive",
      title: "Change not saved",
      description: `${data.error || `The server returned ${res.status}.`} Reload the page to see the saved data.`,
    });
  } catch (e) {
    console.error(`DB sync ${method} failed:`, path, e);
    toast({ variant: "destructive", title: "Change not saved", description: "Could not reach the server. Check your connection and reload." });
  }
  return false;
}
const dbPost = (path: string, body: any) => sync("POST", path, body);
const dbPut = (path: string, body: any) => sync("PUT", path, body);
const dbDelete = (path: string) => sync("DELETE", path);

// -------- Hydration from DB --------
export async function hydrateFromDB(): Promise<Partial<AppState>> {
  try {
    const get = async (path: string) => {
      const res = await fetch(path);
      return res.ok ? res.json() : undefined;
    };
    const [teams, teamMembers, shifts, leave, generationHistory, weekendRotas, attendance, employees] = await Promise.all([
      get("/api/teams"),
      get("/api/members"),
      get("/api/shifts"),
      get("/api/leaves"),
      get("/api/rotas"),
      get("/api/weekend-rotas"),
      get("/api/attendance"),
      get("/api/employees"),
    ]);
    const state: Partial<AppState> = {};
    if (Array.isArray(teams)) state.teams = teams;
    if (Array.isArray(teamMembers)) state.teamMembers = teamMembers;
    if (Array.isArray(shifts)) state.shifts = shifts;
    if (Array.isArray(leave)) state.leave = leave;
    if (Array.isArray(generationHistory)) state.generationHistory = generationHistory;
    if (Array.isArray(weekendRotas)) state.weekendRotas = weekendRotas;
    if (attendance?.logs) state.attendance = attendance.logs;
    // Users feed the PM pickers in team management.
    if (Array.isArray(employees)) state.users = employees.map((e: any) => ({ id: e.id, name: e.name ?? e.email, email: e.email, role: e.role }));
    return state;
  } catch (e) {
    console.error("Failed to hydrate from DB:", e);
    return {};
  }
}

const getInitialState = () => {
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
      officeLatitude: 51.5074,
      officeLongitude: -0.1278,
      radius: 50,
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

    for (let i = sortedHistory.length - 1; i >= 0; i--) {
      const gen = sortedHistory[i];
      const memberShiftInGen = gen.assignments[member.id];

      if (i === sortedHistory.length - 1) {
        lastShiftId = memberShiftInGen || null;
        if (lastShiftId) {
          currentStreakCount = 1;
        } else {
          break;
        }
      } else {
        if (memberShiftInGen === lastShiftId) {
          currentStreakCount++;
        } else {
          break;
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
  (set, get) => ({
    ...getInitialState(),

    addUser: (user) => set((state) => {
      if (state.users.some(u => u.id === user.id)) {
        return state;
      }
      return { users: [...state.users, user] };
    }),

    addTeamMember: (name, email, teamId, fixedShiftId) => {
      const id = new Date().getTime().toString();
      set((state) => ({
        teamMembers: [
          ...state.teamMembers,
          { id, name, email, teamId, fixedShiftId },
        ],
      }));
      dbPost("/api/members", { id, name, email, teamId, fixedShiftId });
    },

    updateTeamMember: (id, updates) => {
      set((state) => ({
        teamMembers: state.teamMembers.map((member) =>
          member.id === id ? { ...member, ...updates } : member
        ),
      }));
      dbPut(`/api/members/${id}`, updates);
    },

    deleteTeamMember: (id) => {
      set((state) => ({
        teamMembers: state.teamMembers.filter((member) => member.id !== id),
      }));
      dbDelete(`/api/members/${id}`);
    },

    addTeam: (name, pmId) => {
      const id = new Date().getTime().toString();
      set(state => ({
        teams: [...state.teams, { id, name, pmId: pmId === "none" ? undefined : pmId }]
      }));
      dbPost("/api/teams", { id, name, pmId });
    },

    updateTeam: (id, name, pmId) => {
      set(state => ({
        teams: state.teams.map(team => team.id === id ? { ...team, name, pmId: pmId === "none" ? undefined : pmId } : team)
      }));
      dbPut(`/api/teams/${id}`, { name, pmId });
    },

    deleteTeam: (id) => {
      set(state => ({
        teams: state.teams.filter(team => team.id !== id),
        teamMembers: state.teamMembers.map(member =>
          member.teamId === id ? { ...member, teamId: undefined } : member
        ),
        shifts: state.shifts.filter(shift => shift.teamId !== id),
      }));
      dbDelete(`/api/teams/${id}`);
    },

    addShift: (newShiftData) => {
      const state = get();
      const id = new Date().getTime().toString();
      const color = SHIFT_COLORS[state.shifts.filter(s => s.teamId === newShiftData.teamId).length % SHIFT_COLORS.length];
      const newShift: Shift = { id, ...newShiftData, color };
      set({ shifts: [...state.shifts, newShift] });
      dbPost("/api/shifts", newShift);
    },

    updateShift: (id, newShift) => {
      set((state) => ({
        shifts: state.shifts.map((shift) =>
          shift.id === id ? { ...shift, ...newShift } : shift
        ),
      }));
      dbPut(`/api/shifts/${id}`, newShift);
    },

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

        dbDelete(`/api/shifts/${id}`);
        return {
          shifts: shifts.filter(s => s.id !== id),
        };
      });
    },

    addLeave: (leaveData) => {
      const id = new Date().getTime().toString();
      set(state => {
        const newLeave: Leave = { id, ...leaveData };
        toast({
          title: "Leave Added",
          description: `Leave has been successfully scheduled.`
        });
        dbPost("/api/leaves", { id, ...leaveData });
        return {
          leave: [...state.leave, newLeave]
        }
      });
    },

    deleteLeave: (leaveId) => {
      set(state => {
        toast({
          variant: 'destructive',
          title: "Leave Deleted",
          description: `The leave entry has been removed.`
        });
        dbDelete(`/api/leaves/${leaveId}`);
        return {
          leave: state.leave.filter(l => l.id !== leaveId)
        }
      });
    },

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

          const updated = {
            ...gen,
            assignments: newAssignments,
            comments: newComments,
            manualOverrides: Array.from(updatedOverrides)
          };
          dbPut(`/api/rotas/${generationId}`, { assignments: newAssignments, comments: newComments, manualOverrides: Array.from(updatedOverrides) });
          return updated;
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
            dbPut(`/api/rotas/${activeGenerationId}`, { assignments: newAssignments, manualOverrides: Array.from(newOverrides) });
            return { ...gen, assignments: newAssignments, manualOverrides: Array.from(newOverrides) };
          }
          return gen;
        });
        return { generationHistory: newHistory };
      });
    },

    updateAdhocAssignments: (generationId, adhocAssignments, notes) => {
      set(state => {
        const newHistory = state.generationHistory.map(gen => {
          if (gen.id === generationId) {
            dbPut(`/api/rotas/${generationId}`, { adhoc: adhocAssignments, comments: notes });
            return { ...gen, adhoc: adhocAssignments, comments: notes };
          }
          return gen;
        });
        return { generationHistory: newHistory };
      });
    },

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

        const sortedShifts = [...shiftsForTeam].sort((a, b) => a.sequence - b.sequence);
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
          finalAssignments[member.id] = undefined;
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

        const { newRotas: newWeekendRotas, nextIndex: newLastWeekendIndex } = generateWeekendRotaForGeneration(
          newGeneration,
          membersInTeam,
          lastWeekendAssigneeIndex
        );

        const newHistory = [...generationHistory, newGeneration];

        // Sync to DB
        dbPost("/api/rotas", newGeneration);
        if (newWeekendRotas.length > 0) {
          dbPost("/api/weekend-rotas", { rotas: newWeekendRotas });
        }

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

            const updated = { ...gen, assignments: newAssignments, manualOverrides: Array.from(newOverrides), manualSwaps: newSwaps };
            dbPut(`/api/rotas/${targetGenerationId}`, { assignments: newAssignments, manualOverrides: Array.from(newOverrides), manualSwaps: newSwaps });
            return updated;
          }
          return gen;
        });

        return { generationHistory: newHistory };
      });
    },

    toggleSwapNeutralization: (generationId, memberId1, memberId2) => set(state => {
      const newHistory = state.generationHistory.map(gen => {
        if (gen.id === generationId) {
          const newSwaps = (gen.manualSwaps || []).map(swap =>
            (swap.memberId1 === memberId1 && swap.memberId2 === memberId2) || (swap.memberId1 === memberId2 && swap.memberId2 === memberId1)
              ? { ...swap, neutralized: !swap.neutralized }
              : swap
          );
          dbPut(`/api/rotas/${generationId}`, { manualSwaps: newSwaps });
          return { ...gen, manualSwaps: newSwaps };
        }
        return gen;
      });
      return { generationHistory: newHistory };
    }),

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

        dbDelete(`/api/rotas/${generationId}`);

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

      dbDelete(`/api/weekend-rotas?generationId=${generationId}`);
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

      const newHistory = state.generationHistory.map(gen => {
        if (gen.id === generationId) {
          const newWeekendSwaps = [...(gen.manualWeekendSwaps || [])];
          newWeekendSwaps.push({ memberId1, memberId2, neutralized: false });
          dbPut(`/api/rotas/${generationId}`, { manualWeekendSwaps: newWeekendSwaps });
          return { ...gen, manualWeekendSwaps: newWeekendSwaps };
        }
        return gen;
      });

      // Re-sync weekend rotas by deleting and recreating for this generation
      const allUpdated = [...otherAssignments, ...updatedAssignments];
      dbDelete(`/api/weekend-rotas?generationId=${generationId}`).then(() => {
        dbPost("/api/weekend-rotas", { rotas: updatedAssignments });
      });

      return {
        weekendRotas: allUpdated,
        generationHistory: newHistory
      };
    }),

    toggleWeekendSwapNeutralization: (generationId, memberId1, memberId2) => set(state => {
      const newHistory = state.generationHistory.map(gen => {
        if (gen.id === generationId) {
          const newSwaps = (gen.manualWeekendSwaps || []).map(swap =>
            (swap.memberId1 === memberId1 && swap.memberId2 === memberId2) || (swap.memberId1 === memberId2 && swap.memberId2 === memberId1)
              ? { ...swap, neutralized: !swap.neutralized }
              : swap
          );
          dbPut(`/api/rotas/${generationId}`, { manualWeekendSwaps: newSwaps });
          return { ...gen, manualWeekendSwaps: newSwaps };
        }
        return gen;
      });
      return { generationHistory: newHistory };
    }),

    toggleShowExportFooter: () => set(state => ({
      showExportFooter: !state.showExportFooter
    })),

    logAttendance: (userId, location, isWfh, forceLogoutTime) => set(state => {
      const now = new Date().toISOString();
      const activeLog = state.attendance.find(log => log.userId === userId && !log.logoutTime);

      if (activeLog) {
        const updatedLog = {
          ...activeLog,
          logoutTime: forceLogoutTime || now,
          logoutLocation: activeLog.isWfh ? undefined : location
        };
        toast({ title: forceLogoutTime ? 'Forced Clock Out' : 'Clocked Out', description: 'Your attendance has been updated.' });
        dbPut(`/api/attendance/${activeLog.id}`, { logoutTime: updatedLog.logoutTime, logoutLocation: updatedLog.logoutLocation });
        return { attendance: state.attendance.map(log => log.id === activeLog.id ? updatedLog : log) };
      } else {
        const id = new Date().getTime().toString();
        const newLog = {
          id,
          userId,
          loginTime: now,
          loginLocation: isWfh ? undefined : location,
          isWfh: isWfh,
        };
        toast({ title: 'Clocked In', description: 'Your attendance has been logged.' });
        dbPost("/api/attendance", newLog);
        return { attendance: [...state.attendance, newLog] };
      }
    }),

    setGeolocationConfig: (config: GeolocationConfig) => set(state => {
      toast({ title: 'Settings Updated', description: 'Geolocation settings have been saved.' });
      return { geolocation: config };
    }),
  })
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
