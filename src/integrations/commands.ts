import type { Integration } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { HttpError, type SessionUser } from "@/lib/api";
import { decideLeave } from "@/services/leave";
import { decideRegularization, recordPunch } from "@/services/attendance";
import { addTaskComment, findTask, updateTask } from "@/services/tasks";
import { updateEmployee, upsertFromDirectory } from "@/services/users";
import type { CommandResult, DomainCommand } from "./types";

async function actorByEmail(email: string): Promise<SessionUser> {
    const u = await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" }, isActive: true } });
    if (!u) throw new HttpError(403, `${email} has no active DeltaPro account.`);
    return { id: u.id, role: u.role, email: u.email, name: u.name, organizationId: u.organizationId ?? "" };
}

async function run(cmd: DomainCommand, integration: Integration): Promise<string> {
    const origin = integration.id;
    switch (cmd.kind) {
        case "leave.decide": {
            const r = await decideLeave(await actorByEmail(cmd.actorEmail), cmd.requestId, cmd.status, { origin });
            return `${r.user.name ?? r.user.email}'s leave is ${r.status.toLowerCase()}.`;
        }
        case "regularization.decide": {
            const r = await decideRegularization(await actorByEmail(cmd.actorEmail), cmd.requestId, cmd.status, { origin });
            return `Correction ${r.status.toLowerCase()}.`;
        }
        case "task.set_status": {
            const task = await findTask(cmd);
            if (!task) return `Task ${cmd.taskKey ?? cmd.taskId} not found; skipped.`;
            if (task.status === cmd.status) return `${task.key} already ${cmd.status}.`;
            await updateTask(null, task.id, { status: cmd.status }, { origin });
            return `${task.key} → ${cmd.status}${cmd.note ? ` (${cmd.note})` : ""}`;
        }
        case "task.comment": {
            const task = await findTask(cmd);
            if (!task) return `Task ${cmd.taskKey ?? cmd.taskId} not found; skipped.`;
            const author = cmd.authorEmail ? await prisma.user.findFirst({ where: { email: { equals: cmd.authorEmail, mode: "insensitive" } } }) : null;
            // Without a matching person, attribute the comment to the task reporter's thread as the integration.
            await addTaskComment({ id: author?.id ?? task.reporterId }, task.id, author ? cmd.body : `[${integration.name}] ${cmd.body}`, { origin });
            return `Commented on ${task.key}`;
        }
        case "user.upsert": {
            const r = await upsertFromDirectory(cmd, origin);
            return `${cmd.email} ${r.created ? "created" : "updated"}`;
        }
        case "user.deactivate": {
            const u = await prisma.user.findFirst({ where: { email: { equals: cmd.email, mode: "insensitive" } } });
            if (!u) return `${cmd.email} not found; skipped.`;
            if (!u.isActive) return `${cmd.email} already inactive.`;
            await updateEmployee(null, u.id, { isActive: false }, { origin });
            return `${cmd.email} deactivated`;
        }
        case "attendance.punch": {
            const user = cmd.email
                ? await prisma.user.findFirst({ where: { email: { equals: cmd.email, mode: "insensitive" } } })
                : cmd.employeeId
                    ? (await prisma.employeeProfile.findFirst({ where: { employeeId: cmd.employeeId }, include: { user: true } }))?.user ?? null
                    : null;
            if (!user) throw new HttpError(404, `No employee for ${cmd.email ?? cmd.employeeId}.`);
            const r = await recordPunch(user.id, new Date(cmd.timestamp), cmd.direction, cmd.deviceId, origin);
            if (!r.ok) throw new HttpError(409, r.message);
            return r.message;
        }
    }
}

export async function executeCommands(commands: DomainCommand[], integration: Integration): Promise<CommandResult[]> {
    const results: CommandResult[] = [];
    for (const cmd of commands) {
        try {
            results.push({ kind: cmd.kind, ok: true, message: await run(cmd, integration) });
        } catch (e) {
            results.push({ kind: cmd.kind, ok: false, message: e instanceof Error ? e.message : String(e) });
        }
    }
    return results;
}
