import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { audit, notify } from "@/lib/activity";
import { HttpError, canActOnUser, isPeopleAdmin, type SessionUser } from "@/lib/api";

const PERSON = { select: { id: true, name: true, email: true, image: true } } as const;
export const DEFAULT_QUESTIONS = [
    { id: "wins", text: "What were the most valuable things achieved this cycle?" },
    { id: "growth", text: "Where should the focus be to grow next cycle?" },
    { id: "support", text: "What support would help?" },
];

// ---------- Goals and key results ----------

/** Progress of a goal = average progress of its key results, clamped 0–100. */
function krProgress(kr: { startValue: number; targetValue: number; currentValue: number }) {
    const span = kr.targetValue - kr.startValue;
    if (span === 0) return kr.currentValue >= kr.targetValue ? 100 : 0;
    return Math.max(0, Math.min(100, ((kr.currentValue - kr.startValue) / span) * 100));
}

async function recomputeGoal(goalId: string) {
    const krs = await prisma.keyResult.findMany({ where: { goalId } });
    if (krs.length === 0) return;
    const progress = Math.round(krs.reduce((a, k) => a + krProgress(k), 0) / krs.length);
    await prisma.goal.update({ where: { id: goalId }, data: { progress, ...(progress >= 100 ? { status: "COMPLETED" } : {}) } });
}

const GOAL_INCLUDE = { owner: PERSON, keyResults: { orderBy: { updatedAt: "asc" as const } }, parent: { select: { id: true, title: true } }, cycle: { select: { id: true, name: true } } };

/** ?scope=mine | team | company | all (all = everything the actor may see). */
export async function listGoals(actor: SessionUser, opts: { scope?: string | null; ownerId?: string | null; cycleId?: string | null }) {
    if (opts.ownerId && opts.ownerId !== actor.id && !(await canActOnUser(actor, opts.ownerId))) throw new HttpError(403, "Forbidden");
    const base = { ...(opts.cycleId ? { cycleId: opts.cycleId } : {}) };
    let where: object;
    if (opts.ownerId) where = { ownerId: opts.ownerId };
    else if (opts.scope === "mine") where = { ownerId: actor.id };
    else if (opts.scope === "company") where = { scope: "COMPANY" };
    else if (opts.scope === "team") where = { OR: [{ owner: { managerId: actor.id } }, { scope: "TEAM" }] };
    else where = isPeopleAdmin(actor) ? {} : { OR: [{ ownerId: actor.id }, { owner: { managerId: actor.id } }, { scope: { in: ["TEAM", "COMPANY"] } }] };
    return prisma.goal.findMany({ where: { ...base, ...where }, include: GOAL_INCLUDE, orderBy: [{ scope: "asc" }, { createdAt: "desc" }] });
}

export type GoalInput = {
    title: string; description?: string | null; scope?: "INDIVIDUAL" | "TEAM" | "COMPANY"; ownerId?: string; cycleId?: string | null;
    parentId?: string | null; dueDate?: string | null; keyResults?: { title: string; unit?: string; startValue?: number; targetValue: number }[];
};

export async function createGoal(actor: SessionUser, input: GoalInput) {
    const ownerId = input.ownerId ?? actor.id;
    if (ownerId !== actor.id && !(await canActOnUser(actor, ownerId))) throw new HttpError(403, "You can set goals for yourself or your reports.");
    if (input.scope === "COMPANY" && !isPeopleAdmin(actor) && actor.role !== Role.PM) throw new HttpError(403, "Only managers can create company goals.");
    const goal = await prisma.goal.create({
        data: {
            ownerId, title: input.title, description: input.description ?? null, scope: input.scope ?? "INDIVIDUAL",
            cycleId: input.cycleId ?? null, parentId: input.parentId ?? null, dueDate: input.dueDate ? new Date(input.dueDate) : null,
            keyResults: { create: (input.keyResults ?? []).map(k => ({ organizationId: actor.organizationId, title: k.title, unit: k.unit ?? "%", startValue: k.startValue ?? 0, currentValue: k.startValue ?? 0, targetValue: k.targetValue })) },
        },
        include: GOAL_INCLUDE,
    });
    if (ownerId !== actor.id) await notify(prisma, ownerId, "New goal", `${actor.name ?? "Your manager"} set a goal for you: ${goal.title}`, "task");
    return goal;
}

async function loadEditableGoal(actor: SessionUser, id: string) {
    const goal = await prisma.goal.findUnique({ where: { id } });
    if (!goal) throw new HttpError(404, "Goal not found.");
    if (goal.ownerId !== actor.id && !(await canActOnUser(actor, goal.ownerId))) throw new HttpError(403, "Forbidden");
    return goal;
}

export async function updateGoal(actor: SessionUser, id: string, input: Partial<Pick<GoalInput, "title" | "description" | "dueDate" | "parentId">> & { status?: string; progress?: number }) {
    await loadEditableGoal(actor, id);
    if (input.parentId === id) throw new HttpError(400, "A goal cannot align to itself.");
    return prisma.goal.update({
        where: { id },
        data: {
            title: input.title, description: input.description, status: input.status, progress: input.progress,
            parentId: input.parentId, dueDate: input.dueDate === undefined ? undefined : input.dueDate ? new Date(input.dueDate) : null,
        },
        include: GOAL_INCLUDE,
    });
}

export async function deleteGoal(actor: SessionUser, id: string) {
    await loadEditableGoal(actor, id);
    await prisma.goal.delete({ where: { id } });
}

export async function addKeyResult(actor: SessionUser, goalId: string, input: { title: string; unit?: string; startValue?: number; targetValue: number }) {
    await loadEditableGoal(actor, goalId);
    const kr = await prisma.keyResult.create({ data: { goalId, title: input.title, unit: input.unit ?? "%", startValue: input.startValue ?? 0, currentValue: input.startValue ?? 0, targetValue: input.targetValue } });
    await recomputeGoal(goalId);
    return kr;
}

export async function updateKeyResult(actor: SessionUser, id: string, input: { currentValue?: number; title?: string; targetValue?: number }) {
    const kr = await prisma.keyResult.findUnique({ where: { id } });
    if (!kr) throw new HttpError(404, "Key result not found.");
    await loadEditableGoal(actor, kr.goalId);
    const updated = await prisma.keyResult.update({ where: { id }, data: input });
    await recomputeGoal(kr.goalId);
    return updated;
}

export async function deleteKeyResult(actor: SessionUser, id: string) {
    const kr = await prisma.keyResult.findUnique({ where: { id } });
    if (!kr) throw new HttpError(404, "Key result not found.");
    await loadEditableGoal(actor, kr.goalId);
    await prisma.keyResult.delete({ where: { id } });
    await recomputeGoal(kr.goalId);
}

// ---------- Review cycles ----------

export const listCycles = () =>
    prisma.reviewCycle.findMany({ orderBy: { startDate: "desc" }, include: { _count: { select: { reviews: true } } } });

export async function createCycle(actor: SessionUser, input: { name: string; startDate: string; endDate: string; includeSelf?: boolean; includeManager?: boolean; includePeer?: boolean; questions?: { id: string; text: string }[] }) {
    if (!isPeopleAdmin(actor)) throw new HttpError(403, "Only HR or an admin can run review cycles.");
    const start = new Date(input.startDate);
    const end = new Date(input.endDate);
    if (!(end > start)) throw new HttpError(400, "The cycle must end after it starts.");
    return prisma.reviewCycle.create({
        data: {
            name: input.name, startDate: start, endDate: end, includeSelf: input.includeSelf ?? true, includeManager: input.includeManager ?? true,
            includePeer: input.includePeer ?? false, questions: input.questions?.length ? input.questions : DEFAULT_QUESTIONS, createdById: actor.id,
        },
    });
}

/** Creates self and manager review assignments for every active employee and notifies reviewers. */
export async function launchCycle(actor: SessionUser, id: string) {
    if (!isPeopleAdmin(actor)) throw new HttpError(403, "Only HR or an admin can launch review cycles.");
    const cycle = await prisma.reviewCycle.findUnique({ where: { id } });
    if (!cycle) throw new HttpError(404, "Cycle not found.");
    if (cycle.status !== "DRAFT") throw new HttpError(409, "This cycle has already been launched.");
    const people = await prisma.user.findMany({ where: { isActive: true }, select: { id: true, managerId: true } });
    const rows: { cycleId: string; revieweeId: string; reviewerId: string; kind: string; organizationId: string }[] = [];
    for (const p of people) {
        if (cycle.includeSelf) rows.push({ cycleId: id, revieweeId: p.id, reviewerId: p.id, kind: "SELF", organizationId: actor.organizationId });
        if (cycle.includeManager && p.managerId) rows.push({ cycleId: id, revieweeId: p.id, reviewerId: p.managerId, kind: "MANAGER", organizationId: actor.organizationId });
    }
    await prisma.review.createMany({ data: rows, skipDuplicates: true });
    await prisma.reviewCycle.update({ where: { id }, data: { status: "ACTIVE" } });
    for (const reviewer of new Set(rows.map(r => r.reviewerId))) {
        await notify(prisma, reviewer, `Reviews open: ${cycle.name}`, "You have performance reviews to write.", "task");
    }
    await audit(prisma, actor.id, "review_cycle.launched", "ReviewCycle", id, { reviews: rows.length });
    return { reviews: rows.length };
}

export async function closeCycle(actor: SessionUser, id: string) {
    if (!isPeopleAdmin(actor)) throw new HttpError(403, "Forbidden");
    return prisma.reviewCycle.update({ where: { id }, data: { status: "CLOSED" } });
}

/** A reviewee (or HR) asks a colleague for a peer review in an active cycle that allows peers. */
export async function requestPeerReview(actor: SessionUser, cycleId: string, revieweeId: string, reviewerId: string) {
    const cycle = await prisma.reviewCycle.findUnique({ where: { id: cycleId } });
    if (!cycle || cycle.status !== "ACTIVE" || !cycle.includePeer) throw new HttpError(400, "This cycle does not take peer reviews.");
    if (revieweeId !== actor.id && !(await canActOnUser(actor, revieweeId))) throw new HttpError(403, "Forbidden");
    if (reviewerId === revieweeId) throw new HttpError(400, "Choose someone else.");
    const review = await prisma.review.upsert({
        where: { cycleId_revieweeId_reviewerId_kind: { cycleId, revieweeId, reviewerId, kind: "PEER" } },
        create: { cycleId, revieweeId, reviewerId, kind: "PEER" },
        update: {},
    });
    await notify(prisma, reviewerId, "Peer review requested", `You were asked for a peer review in ${cycle.name}.`, "task");
    return review;
}

const REVIEW_INCLUDE = { reviewee: PERSON, reviewer: PERSON, cycle: { select: { id: true, name: true, status: true, questions: true, endDate: true } } };

/** Reviews to write (as reviewer) and reviews about the actor that have been submitted. */
export async function myReviews(actor: SessionUser) {
    const [toWrite, aboutMe] = await Promise.all([
        prisma.review.findMany({ where: { reviewerId: actor.id, cycle: { status: { not: "DRAFT" } } }, include: REVIEW_INCLUDE, orderBy: { status: "asc" } }),
        prisma.review.findMany({ where: { revieweeId: actor.id, status: "SUBMITTED", kind: { in: ["SELF", "MANAGER"] } }, include: REVIEW_INCLUDE, orderBy: { submittedAt: "desc" } }),
    ]);
    return { toWrite, aboutMe };
}

/** HR / managers: every review in a cycle they may see, with completion. */
export async function cycleReviews(actor: SessionUser, cycleId: string) {
    const where = isPeopleAdmin(actor) ? { cycleId } : { cycleId, OR: [{ reviewee: { managerId: actor.id } }, { reviewerId: actor.id }] };
    return prisma.review.findMany({ where, include: REVIEW_INCLUDE, orderBy: [{ reviewee: { name: "asc" } }, { kind: "asc" }] });
}

export async function submitReview(actor: SessionUser, id: string, input: { rating: number; answers: Record<string, string>; summary?: string | null }) {
    const review = await prisma.review.findUnique({ where: { id }, include: { cycle: true } });
    if (!review) throw new HttpError(404, "Review not found.");
    if (review.reviewerId !== actor.id) throw new HttpError(403, "This review is assigned to someone else.");
    if (review.cycle.status !== "ACTIVE") throw new HttpError(409, "This cycle is not open.");
    if (review.status === "SUBMITTED") throw new HttpError(409, "Already submitted.");
    if (!(input.rating >= 1 && input.rating <= 5)) throw new HttpError(400, "Rating must be 1 to 5.");
    const saved = await prisma.review.update({ where: { id }, data: { rating: input.rating, answers: input.answers, summary: input.summary ?? null, status: "SUBMITTED", submittedAt: new Date() } });
    if (review.kind === "MANAGER") await notify(prisma, review.revieweeId, "Manager review shared", `Your ${review.cycle.name} review is available.`, "info");
    return saved;
}

// ---------- Feedback ----------

export async function giveFeedback(actor: SessionUser, input: { toId: string; body: string; kind?: "PRAISE" | "CONSTRUCTIVE"; visibility?: "PRIVATE" | "PUBLIC" }) {
    if (input.toId === actor.id) throw new HttpError(400, "Feedback is for colleagues.");
    const to = await prisma.user.findUnique({ where: { id: input.toId }, select: { id: true, isActive: true } });
    if (!to?.isActive) throw new HttpError(400, "Choose an active colleague.");
    const fb = await prisma.feedback.create({ data: { fromId: actor.id, toId: input.toId, body: input.body, kind: input.kind ?? "PRAISE", visibility: input.kind === "CONSTRUCTIVE" ? "PRIVATE" : input.visibility ?? "PRIVATE" } });
    await notify(prisma, input.toId, input.kind === "CONSTRUCTIVE" ? "New feedback" : "You got praise", input.body.slice(0, 140), "success");
    return fb;
}

/** Public praise wall plus feedback the actor sent, received, or can see as manager. */
export function listFeedback(actor: SessionUser) {
    return prisma.feedback.findMany({
        where: isPeopleAdmin(actor) ? {} : { OR: [{ visibility: "PUBLIC" }, { fromId: actor.id }, { toId: actor.id }, { to: { managerId: actor.id } }] },
        include: { from: PERSON, to: PERSON },
        orderBy: { createdAt: "desc" },
        take: 200,
    });
}
