
import type { User as AuthUser } from "firebase/auth";

export interface User {
  id: string;
  name: string;
  email: string;
}

export interface Team {
  id: string;
  name: string;
  pmId?: string;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  teamId?: string;
  fixedShiftId?: string;
  lastShiftId?: string;
}

export interface Shift {
  id:string;
  name: string;
  startTime: string;
  endTime: string;
  color: string;
  sequence: number;
  isExtreme: boolean;
  minTeam: number;
  maxTeam: number;
  teamId: string; // Each shift belongs to a team
}

// Assignments map a team member's ID to a shift ID
export type RotaAssignments = Record<string, string | undefined>;

export type ManualSwap = {
    memberId1: string;
    memberId2: string;
    neutralized?: boolean; // To track if a swap has been canceled out
}

export type ManualWeekendSwap = {
    memberId1: string;
    memberId2: string;
    neutralized?: boolean;
}

// Adhoc status for a rota generation
// Member ID -> Week Index -> isSelected
export type AdhocAssignments = Record<string, Record<number, boolean>>;

export interface Leave {
  id: string;
  memberId: string;
  startDate: string; // ISO string
  endDate: string; // ISO string
  type: 'Holiday' | 'Sick Leave' | 'Other';
}


// A single generated rota period
export interface RotaGeneration {
  id: string; // Unique ID for this generation, e.g., a timestamp
  startDate: string; // ISO string for the start of this period
  endDate: string; // ISO string for the end of this period
  assignments: RotaAssignments;
  teamId: string; // The team this rota was generated for
  teamMembersAtGeneration?: TeamMember[]; // Snapshot of team members
  manualOverrides?: string[]; // Array of member IDs that have been manually changed
  manualSwaps?: ManualSwap[]; // Array of swaps that occurred
  manualWeekendSwaps?: ManualWeekendSwap[]; // Array of weekend swaps that occurred
  comments?: Record<string, string>; // Comments for a member's assignment
  adhoc?: AdhocAssignments; // Ad-hoc support assignments
}

export type WeekendRota = {
  date: string; // ISO string for the weekend day
  memberId: string;
  generationId: string; // Link back to the main rota generation
}

// Tracks how many consecutive periods a member has had the same shift
export type ShiftStreak = Record<string, { shiftId: string | null; count: number }>;

export type AttendanceLog = {
    id: string;
    userId: string;
    loginTime: string; // ISO string
    logoutTime?: string; // ISO string
    loginLocation?: { latitude: number; longitude: number };
    logoutLocation?: { latitude: number; longitude: number };
    isWfh?: boolean;
};

export type GeolocationConfig = {
    officeLatitude: number;
    officeLongitude: number;
    radius: number; // in meters
};

export interface AppState {
  users: User[];
  teamMembers: TeamMember[];
  teams: Team[];
  shifts: Shift[];
  leave: Leave[];
  generationHistory: RotaGeneration[];
  activeGenerationId: string | null;
  weekendRotas: WeekendRota[];
  lastWeekendAssigneeIndex: number;
  showExportFooter: boolean;
  attendance: AttendanceLog[];
  geolocation: GeolocationConfig;
  addUser: (user: User) => void;
  addTeamMember: (name: string, email: string, teamId?: string, fixedShiftId?: string) => void;
  updateTeamMember: (id: string, updates: Partial<Pick<TeamMember, 'name' | 'email' | 'teamId' | 'fixedShiftId'>>) => void;
  deleteTeamMember: (id: string) => void;
  addTeam: (name: string, pmId?: string) => void;
  updateTeam: (id: string, name: string, pmId?: string) => void;
  deleteTeam: (id: string) => void;
  addShift: (newShift: Omit<Shift, 'id' | 'color'>) => void;
  updateShift: (id: string, newShift: Partial<Omit<Shift, 'id' | 'color'>>) => void;
  deleteShift: (id: string) => void;
  addLeave: (leave: Omit<Leave, 'id'>) => void;
  deleteLeave: (leaveId: string) => void;
  updateAssignmentsForGeneration: (generationId: string, assignments: RotaAssignments, comments: Record<string, string>) => void;
  generateNewRota: (startDate: Date, rotaPeriodInWeeks: number, teamId: string) => void;
  swapShifts: (memberId1: string, memberId2: string, generationId?: string) => void;
  toggleSwapNeutralization: (generationId: string, memberId1: string, memberId2: string) => void;
  deleteGeneration: (generationId: string) => void;
  setActiveGenerationId: (generationId: string | null) => void;
  updateAssignment: (memberId: string, newShiftId: string) => void;
  updateAdhocAssignments: (generationId: string, adhocAssignments: AdhocAssignments, notes: Record<string, string>) => void;
  generateWeekendRota: (generationId: string) => void;
  deleteWeekendRotaForPeriod: (generationId: string) => void;
  swapWeekendAssignments: (generationId: string, memberId1: string, memberId2: string) => void;
  toggleWeekendSwapNeutralization: (generationId: string, memberId1: string, memberId2: string) => void;
  toggleShowExportFooter: () => void;
  logAttendance: (userId: string, location: { latitude: number; longitude: number } | undefined, isWfh: boolean, forceLogoutTime?: string) => void;
  setGeolocationConfig: (config: GeolocationConfig) => void;
}

export type UserProfile = {
  id: string;
  email: string;
  name: string;
  isAdmin: boolean;
  role: 'admin' | 'hr' | 'pm' | 'user';
};

export interface AuthState {
  user: AuthUser | null;
  profile: UserProfile | null;
  loading: boolean;
  setUser: (user: AuthUser | null) => void;
  setProfile: (profile: UserProfile | null) => void;
  setLoading: (loading: boolean) => void;
}

    