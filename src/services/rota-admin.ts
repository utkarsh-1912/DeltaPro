import { LeaveStatus, Prisma, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { HttpError, assertTeamAccess, isPeopleAdmin, type SessionUser } from "@/lib/api";
import { findUserIdByEmail } from "@/lib/people";
import { emitRotaEvent } from "./rota";

const SHIFT_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

// ---------- Teams ----------

export const listTeams = () => prisma.team.findMany({ include: { members: true, shifts: true }, orderBy: { name: "asc" } });

export async function getTeam(id: string) {
    const team = await prisma.team.findUnique({ where: { id }, include: { members: true, shifts: true } });
    if (!team) throw new HttpError(404, "Team not found.");
    return team;
}

/** ADMIN/HR create any team; a PM's new team is always their own. */
export async function createTeam(actor: SessionUser, input: { id?: string; name: string; pmId?: string | null }) {
    const pmId = actor.role === Role.PM && !isPeopleAdmin(actor) ? actor.id : input.pmId && input.pmId !== "none" ? input.pmId : null;
    return prisma.team.create({ data: { ...(input.id ? { id: input.id } : {}), name: input.name, pmId } });
}

export async function updateTeam(actor: SessionUser, id: string, input: { name?: string; pmId?: string | null }) {
    await assertTeamAccess(actor, id);
    const current = await prisma.team.findUniqueOrThrow({ where: { id } });
    const nextPm = input.pmId === undefined ? undefined : input.pmId && input.pmId !== "none" ? input.pmId : null;
    if (nextPm !== undefined && nextPm !== current.pmId && !isPeopleAdmin(actor)) {
        throw new HttpError(403, "Only HR or an admin can reassign the PM of a team.");
    }
    return prisma.team.update({ where: { id }, data: { name: input.name, pmId: nextPm } });
}

/** Deletes shifts and rotas with the team; members stay and become unassigned. */
export async function deleteTeam(actor: SessionUser, id: string) {
    await assertTeamAccess(actor, id);
    await prisma.$transaction([
        prisma.teamMember.updateMany({ where: { teamId: id }, data: { teamId: null, fixedShiftId: null } }),
        prisma.team.delete({ where: { id } }),
    ]);
}

// ---------- Members ----------

export const listMembers = () => prisma.teamMember.findMany({ orderBy: { name: "asc" } });

async function loadMember(id: string) {
    const member = await prisma.teamMember.findUnique({ where: { id } });
    if (!member) throw new HttpError(404, "Team member not found.");
    return member;
}
export const getMember = loadMember;

export type MemberInput = { id?: string; name?: string; email?: string; teamId?: string | null; fixedShiftId?: string | null; lastShiftId?: string | null };

export async function createMember(actor: SessionUser, input: MemberInput & { name: string; email: string }) {
    await assertTeamAccess(actor, input.teamId);
    return prisma.teamMember.create({
        data: {
            ...(input.id ? { id: input.id } : {}),
            name: input.name,
            email: input.email,
            teamId: input.teamId || null,
            fixedShiftId: input.fixedShiftId || null,
            lastShiftId: input.lastShiftId || null,
            userId: await findUserIdByEmail(input.email),
        },
    });
}

const nullable = (v: string | null | undefined) => (v === undefined ? undefined : v || null);

export async function updateMember(actor: SessionUser, id: string, input: MemberInput) {
    const member = await loadMember(id);
    await assertTeamAccess(actor, member.teamId);
    if (input.teamId !== undefined && input.teamId !== member.teamId) await assertTeamAccess(actor, input.teamId);
    return prisma.teamMember.update({
        where: { id },
        data: {
            name: input.name,
            email: input.email,
            teamId: nullable(input.teamId),
            fixedShiftId: nullable(input.fixedShiftId),
            lastShiftId: nullable(input.lastShiftId),
            userId: input.email ? await findUserIdByEmail(input.email) : undefined,
        },
    });
}

export async function deleteMember(actor: SessionUser, id: string) {
    const member = await loadMember(id);
    await assertTeamAccess(actor, member.teamId);
    await prisma.teamMember.delete({ where: { id } });
}

// ---------- Shifts ----------

export const listShifts = () => prisma.shift.findMany({ orderBy: { sequence: "asc" } });

async function loadShift(id: string) {
    const shift = await prisma.shift.findUnique({ where: { id } });
    if (!shift) throw new HttpError(404, "Shift not found.");
    return shift;
}
export const getShift = loadShift;

export type ShiftInput = {
    id?: string; name: string; startTime: string; endTime: string; sequence: number; isExtreme: boolean;
    minTeam: number; maxTeam: number; teamId: string; color?: string;
};

export async function createShift(actor: SessionUser, input: ShiftInput) {
    await assertTeamAccess(actor, input.teamId);
    const existingCount = await prisma.shift.count({ where: { teamId: input.teamId } });
    return prisma.shift.create({ data: { ...input, color: input.color ?? SHIFT_COLORS[existingCount % SHIFT_COLORS.length] } });
}

export async function updateShift(actor: SessionUser, id: string, input: Partial<Omit<ShiftInput, "id" | "teamId">>) {
    const shift = await loadShift(id);
    await assertTeamAccess(actor, shift.teamId);
    if ((input.maxTeam ?? shift.maxTeam) < (input.minTeam ?? shift.minTeam)) throw new HttpError(400, "maxTeam must be at least minTeam.");
    return prisma.shift.update({ where: { id }, data: input });
}

export async function deleteShift(actor: SessionUser, id: string) {
    const shift = await loadShift(id);
    await assertTeamAccess(actor, shift.teamId);
    if ((await prisma.teamMember.count({ where: { fixedShiftId: id } })) > 0) {
        throw new HttpError(409, "This shift is a team member's fixed shift. Change their fixed shift first.");
    }
    await prisma.shift.delete({ where: { id } });
}

// ---------- Rota leave ----------

/**
 * Manual rota leave plus approved leave requests of linked user accounts (read-only, id prefixed
 * with "lr_"), so the rota generator skips people on leave.
 */
export async function listRotaLeave() {
    const [manual, members] = await Promise.all([
        prisma.leave.findMany({ orderBy: { startDate: "asc" } }),
        prisma.teamMember.findMany({ select: { id: true, email: true, userId: true } }),
    ]);
    const byUser = new Map<string, string[]>();
    const byEmail = new Map<string, string[]>();
    for (const m of members) {
        if (m.userId) byUser.set(m.userId, [...(byUser.get(m.userId) ?? []), m.id]);
        else byEmail.set(m.email.toLowerCase(), [...(byEmail.get(m.email.toLowerCase()) ?? []), m.id]);
    }
    const approved = await prisma.leaveRequest.findMany({
        where: { status: LeaveStatus.APPROVED, endDate: { gte: new Date(Date.now() - 90 * 86400000) } },
        include: { user: { select: { id: true, email: true } } },
    });
    const fromRequests = approved.flatMap(r => {
        const ids = byUser.get(r.userId) ?? (r.user.email ? byEmail.get(r.user.email.toLowerCase()) : undefined) ?? [];
        return ids.map(memberId => ({
            id: `lr_${r.id}_${memberId}`, memberId, startDate: r.startDate.toISOString(), endDate: r.endDate.toISOString(), type: r.type, source: "LEAVE_REQUEST",
        }));
    });
    return [...manual, ...fromRequests];
}

export async function getRotaLeave(id: string) {
    const leave = await prisma.leave.findUnique({ where: { id } });
    if (!leave) throw new HttpError(404, "Leave not found.");
    return leave;
}

export async function createRotaLeave(actor: SessionUser, input: { id?: string; memberId: string; startDate: string; endDate: string; type: string }) {
    const member = await prisma.teamMember.findUnique({ where: { id: input.memberId } });
    if (!member) throw new HttpError(400, "Team member not found.");
    await assertTeamAccess(actor, member.teamId);
    if (new Date(input.endDate) < new Date(input.startDate)) throw new HttpError(400, "End date is before start date.");
    return prisma.leave.create({ data: { ...(input.id ? { id: input.id } : {}), memberId: input.memberId, startDate: input.startDate, endDate: input.endDate, type: input.type } });
}

export async function deleteRotaLeave(actor: SessionUser, id: string) {
    if (id.startsWith("lr_")) throw new HttpError(409, "This leave comes from an approved leave request. Cancel it on the Leave page.");
    const leave = await prisma.leave.findUnique({ where: { id }, include: { member: true } });
    if (!leave) throw new HttpError(404, "Leave not found.");
    await assertTeamAccess(actor, leave.member.teamId);
    await prisma.leave.delete({ where: { id } });
}

// ---------- Rota generations ----------

export const listRotas = () => prisma.rotaGeneration.findMany({ include: { weekendRotas: true }, orderBy: { startDate: "desc" } });

async function loadRota(id: string) {
    const rota = await prisma.rotaGeneration.findUnique({ where: { id }, include: { weekendRotas: true } });
    if (!rota) throw new HttpError(404, "Rota not found.");
    return rota;
}
export const getRota = loadRota;

const asJson = (v: unknown, fallback: Prisma.InputJsonValue | typeof Prisma.JsonNull) =>
    v === undefined || v === null ? fallback : (v as Prisma.InputJsonValue);
const optJson = (v: unknown) => (v === undefined ? undefined : v === null ? Prisma.JsonNull : (v as Prisma.InputJsonValue));

export type RotaInput = {
    id?: string; startDate: string; endDate: string; teamId: string; assignments: Record<string, string | null | undefined>;
    teamMembersAtGeneration?: unknown; manualOverrides?: unknown; manualSwaps?: unknown; manualWeekendSwaps?: unknown; comments?: unknown; adhoc?: unknown;
};

/** Saves a generated rota and publishes rota.published to calendar and chat connectors. */
export async function createRota(actor: SessionUser, input: RotaInput) {
    await assertTeamAccess(actor, input.teamId);
    const rota = await prisma.rotaGeneration.create({
        data: {
            ...(input.id ? { id: input.id } : {}),
            startDate: input.startDate,
            endDate: input.endDate,
            teamId: input.teamId,
            assignments: input.assignments as Prisma.InputJsonValue,
            teamMembersAtGeneration: asJson(input.teamMembersAtGeneration, Prisma.JsonNull),
            manualOverrides: asJson(input.manualOverrides, []),
            manualSwaps: asJson(input.manualSwaps, []),
            manualWeekendSwaps: asJson(input.manualWeekendSwaps, []),
            comments: asJson(input.comments, {}),
            adhoc: asJson(input.adhoc, Prisma.JsonNull),
        },
    });
    await emitRotaEvent("rota.published", rota, actor);
    return rota;
}

export async function updateRota(actor: SessionUser, id: string, input: Partial<Omit<RotaInput, "id" | "startDate" | "endDate" | "teamId">>) {
    const rota = await loadRota(id);
    await assertTeamAccess(actor, rota.teamId);
    const updated = await prisma.rotaGeneration.update({
        where: { id },
        data: {
            assignments: input.assignments === undefined ? undefined : (input.assignments as Prisma.InputJsonValue),
            manualOverrides: optJson(input.manualOverrides),
            manualSwaps: optJson(input.manualSwaps),
            manualWeekendSwaps: optJson(input.manualWeekendSwaps),
            comments: optJson(input.comments),
            adhoc: optJson(input.adhoc),
        },
    });
    if (input.assignments && JSON.stringify(input.assignments) !== JSON.stringify(rota.assignments)) {
        await emitRotaEvent("rota.updated", updated, actor);
    }
    return updated;
}

export async function deleteRota(actor: SessionUser, id: string) {
    const rota = await loadRota(id);
    await assertTeamAccess(actor, rota.teamId);
    await prisma.$transaction(async tx => {
        await emitRotaEvent("rota.deleted", rota, actor, tx);
        await tx.rotaGeneration.delete({ where: { id } });
    });
}

// ---------- Weekend cover ----------

export const listWeekendRotas = () => prisma.weekendRota.findMany({ orderBy: { date: "asc" } });

async function assertGenerations(actor: SessionUser, ids: string[]) {
    const gens = await prisma.rotaGeneration.findMany({ where: { id: { in: ids } }, select: { id: true, teamId: true } });
    if (gens.length !== new Set(ids).size) throw new HttpError(400, "Unknown rota generation.");
    for (const g of gens) await assertTeamAccess(actor, g.teamId);
}

export async function createWeekendRotas(actor: SessionUser, rows: { date: string; memberId: string; generationId: string }[]) {
    if (rows.length === 0) return { count: 0 };
    await assertGenerations(actor, rows.map(r => r.generationId));
    return prisma.weekendRota.createMany({ data: rows });
}

export async function deleteWeekendRotas(actor: SessionUser, generationId: string) {
    await assertGenerations(actor, [generationId]);
    await prisma.weekendRota.deleteMany({ where: { generationId } });
}
