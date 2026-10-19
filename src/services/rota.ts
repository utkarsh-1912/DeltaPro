import type { RotaGeneration } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { Db } from "@/lib/activity";
import type { SessionUser } from "@/lib/api";
import { emitEvent, scheduleDispatch } from "@/integrations/events";

/** Resolve a generation's member → shift map into names, emails and shift times for connectors. */
export async function rotaEventData(gen: RotaGeneration, db: Db = prisma) {
    const [team, shifts, members] = await Promise.all([
        db.team.findUnique({ where: { id: gen.teamId }, select: { id: true, name: true } }),
        db.shift.findMany({ where: { teamId: gen.teamId } }),
        db.teamMember.findMany({ where: { teamId: gen.teamId } }),
    ]);
    const snapshot = Array.isArray(gen.teamMembersAtGeneration) ? (gen.teamMembersAtGeneration as any[]) : [];
    const memberById = new Map<string, { id: string; name: string; email: string; userId?: string | null }>();
    snapshot.forEach(m => memberById.set(m.id, m));
    members.forEach(m => memberById.set(m.id, m));
    const shiftById = new Map(shifts.map(s => [s.id, s]));
    const assignments = Object.entries((gen.assignments ?? {}) as Record<string, string | null>).map(([memberId, shiftId]) => {
        const m = memberById.get(memberId);
        const s = shiftId ? shiftById.get(shiftId) : undefined;
        return {
            memberId,
            name: m?.name ?? memberId,
            email: m?.email ?? null,
            userId: m?.userId ?? null,
            shift: s ? { id: s.id, name: s.name, startTime: s.startTime, endTime: s.endTime } : null,
        };
    });
    return { generation: { id: gen.id, startDate: gen.startDate, endDate: gen.endDate }, team, assignments };
}

export async function emitRotaEvent(type: "rota.published" | "rota.updated" | "rota.deleted", gen: RotaGeneration, actor: SessionUser, db: Db = prisma) {
    await emitEvent(db, { type, subject: { type: "RotaGeneration", id: gen.id }, actor, data: await rotaEventData(gen, db) });
    scheduleDispatch();
}
