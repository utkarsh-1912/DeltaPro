import { Prisma, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { audit, type Db } from "@/lib/activity";
import { HttpError, type SessionUser } from "@/lib/api";
import { hashPassword, isBootstrapAdmin } from "@/lib/password";
import { linkTeamMembersToUser } from "@/lib/people";
import { emitEvent, scheduleDispatch, type EventType } from "@/integrations/events";
import { person } from "./shared";
import { currentOrgId } from "@/server/context";
import { assertSeatAvailable } from "./organizations";

const USER_INCLUDE = { profile: true, manager: { select: { id: true, name: true, email: true } } } satisfies Prisma.UserInclude;
type FullUser = Prisma.UserGetPayload<{ include: typeof USER_INCLUDE }>;

export function publicUser(u: FullUser | (Prisma.UserGetPayload<{ include: { profile: true } }>)) {
    const { passwordHash, ...rest } = u as any;
    return rest;
}

async function emitUser(db: Db, type: EventType, u: FullUser, actor: SessionUser | null, origin?: string | null) {
    await emitEvent(db, {
        type,
        subject: { type: "User", id: u.id },
        actor,
        origin,
        data: {
            user: { ...person(u), role: u.role, isActive: u.isActive, employeeId: u.profile?.employeeId, department: u.profile?.department, designation: u.profile?.designation },
            manager: person(u.manager),
        },
    });
}

/** Generates EMP-0001 style ids when none is given. */
async function nextEmployeeId(db: Db): Promise<string> {
    const count = await db.employeeProfile.count();
    for (let n = count + 1; n < count + 1000; n++) {
        const id = `EMP-${String(n).padStart(4, "0")}`;
        if (!(await db.employeeProfile.findFirst({ where: { employeeId: id } }))) return id;
    }
    return `EMP-${Date.now()}`;
}

export type EmployeeInput = {
    email: string;
    name?: string | null;
    role?: Role;
    password?: string | null;
    managerId?: string | null;
    employeeId?: string | null;
    department?: string | null;
    designation?: string | null;
    phoneNumber?: string | null;
    emergencyContact?: string | null;
};

export async function createEmployee(actor: SessionUser | null, input: EmployeeInput, opts: { origin?: string | null } = {}) {
    const orgId = currentOrgId();
    if (orgId) await assertSeatAvailable(orgId);
    const email = input.email.toLowerCase().trim();
    if (input.role === Role.ADMIN && actor && actor.role !== Role.ADMIN) throw new HttpError(403, "Only an admin can create another admin.");
    const user = await prisma.$transaction(async tx => {
        const created = await tx.user.create({
            data: {
                email,
                name: input.name ?? email.split("@")[0],
                role: input.role ?? (isBootstrapAdmin(email) ? Role.ADMIN : Role.USER),
                passwordHash: input.password ? await hashPassword(input.password) : null,
                managerId: input.managerId || null,
                profile: {
                    create: {
                        organizationId: currentOrgId(),
                        employeeId: input.employeeId || (await nextEmployeeId(tx)),
                        department: input.department ?? null,
                        designation: input.designation ?? null,
                        phoneNumber: input.phoneNumber ?? null,
                        emergencyContact: input.emergencyContact ?? null,
                    },
                },
            },
            include: USER_INCLUDE,
        });
        await linkTeamMembersToUser(created.id, created.email, tx);
        await emitUser(tx, "user.created", created, actor, opts.origin);
        await audit(tx, actor?.id, "user.created", "User", created.id, { role: created.role, origin: opts.origin ?? null });
        return created;
    });
    scheduleDispatch();
    return user;
}

export type EmployeePatch = Partial<Omit<EmployeeInput, "email" | "password">> & { isActive?: boolean; status?: string };

export async function updateEmployee(actor: SessionUser | null, userId: string, patch: EmployeePatch, opts: { origin?: string | null } = {}) {
    const before = await prisma.user.findUnique({ where: { id: userId }, include: { profile: true } });
    if (!before) throw new HttpError(404, "Employee not found.");
    if (actor) {
        if (patch.role !== undefined && patch.role !== before.role && actor.role !== Role.ADMIN) throw new HttpError(403, "Only an admin can change roles.");
        if (patch.role !== undefined && actor.id === userId && patch.role !== Role.ADMIN && before.role === Role.ADMIN) {
            const admins = await prisma.user.count({ where: { role: Role.ADMIN, isActive: true } });
            if (admins <= 1) throw new HttpError(409, "You are the last admin. Promote someone else first.");
        }
        if (patch.isActive === false && actor.id === userId) throw new HttpError(409, "You cannot deactivate yourself.");
    }
    if (patch.managerId && patch.managerId === userId) throw new HttpError(400, "An employee cannot manage themselves.");

    const isActive = patch.isActive ?? (patch.status ? !["INACTIVE", "TERMINATED"].includes(patch.status) : undefined);
    const profileStatus = patch.status ?? (isActive === undefined ? undefined : isActive ? "ACTIVE" : "INACTIVE");
    if (isActive === true && !before.isActive) {
        const orgId = currentOrgId();
        if (orgId) await assertSeatAvailable(orgId);
    }
    const user = await prisma.$transaction(async tx => {
        const updated = await tx.user.update({
            where: { id: userId },
            data: {
                name: patch.name ?? undefined,
                role: patch.role ?? undefined,
                managerId: patch.managerId === undefined ? undefined : patch.managerId || null,
                isActive,
                profile: {
                    upsert: {
                        create: {
                            organizationId: currentOrgId(),
                            employeeId: patch.employeeId || (await nextEmployeeId(tx)),
                            department: patch.department ?? null,
                            designation: patch.designation ?? null,
                            phoneNumber: patch.phoneNumber ?? null,
                            emergencyContact: patch.emergencyContact ?? null,
                            status: profileStatus ?? "ACTIVE",
                        },
                        update: {
                            employeeId: patch.employeeId ?? undefined,
                            department: patch.department ?? undefined,
                            designation: patch.designation ?? undefined,
                            phoneNumber: patch.phoneNumber ?? undefined,
                            emergencyContact: patch.emergencyContact ?? undefined,
                            status: profileStatus,
                        },
                    },
                },
            },
            include: USER_INCLUDE,
        });
        if (isActive === false && before.isActive) {
            await tx.session.deleteMany({ where: { userId } });
            await emitUser(tx, "user.deactivated", updated, actor, opts.origin);
        } else {
            await emitUser(tx, "user.updated", updated, actor, opts.origin);
        }
        if (patch.role && patch.role !== before.role) {
            await audit(tx, actor?.id, "user.role_changed", "User", userId, { from: before.role, to: patch.role });
        }
        return updated;
    });
    scheduleDispatch();
    return user;
}

/** Directory sync (HRIS, SCIM): create or update by email, resolving the manager by email. */
export async function upsertFromDirectory(cmd: {
    email: string; name?: string; employeeId?: string; department?: string; designation?: string; phoneNumber?: string; managerEmail?: string; active?: boolean;
}, origin: string) {
    const email = cmd.email.toLowerCase().trim();
    const manager = cmd.managerEmail ? await prisma.user.findFirst({ where: { email: { equals: cmd.managerEmail, mode: "insensitive" } }, select: { id: true } }) : null;
    const existing = await prisma.user.findUnique({ where: { email } });
    if (cmd.employeeId) {
        const clash = await prisma.employeeProfile.findFirst({ where: { employeeId: cmd.employeeId } });
        if (clash && clash.userId !== existing?.id) cmd = { ...cmd, employeeId: undefined };
    }
    if (!existing) {
        const created = await createEmployee(null, { email, name: cmd.name, employeeId: cmd.employeeId, department: cmd.department, designation: cmd.designation, phoneNumber: cmd.phoneNumber, managerId: manager?.id }, { origin });
        return { created: true, user: created };
    }
    const updated = await updateEmployee(null, existing.id, {
        name: cmd.name, employeeId: cmd.employeeId, department: cmd.department, designation: cmd.designation, phoneNumber: cmd.phoneNumber,
        managerId: manager ? manager.id : undefined, isActive: cmd.active ?? undefined,
    }, { origin });
    return { created: false, user: updated };
}

// ---------- Directory reads ----------

/** Directory. HR/ADMIN also see inactive people; everyone else sees active employees. */
export async function listEmployees(actor: SessionUser) {
    const people = await prisma.user.findMany({
        where: actor.role === Role.ADMIN || actor.role === Role.HR ? {} : { isActive: true },
        include: { profile: true, manager: { select: { id: true, name: true, email: true } } },
        orderBy: { name: "asc" },
    });
    return people.map(publicUser);
}

export async function getEmployee(id: string) {
    const user = await prisma.user.findUnique({
        where: { id },
        include: { profile: true, manager: { select: { id: true, name: true, email: true } }, subordinates: { select: { id: true, name: true, email: true } } },
    });
    if (!user) throw new HttpError(404, "Employee not found.");
    return publicUser(user);
}

/** Admin-only password reset for people without email access. */
export async function setPassword(actor: SessionUser, userId: string, password: string) {
    if (actor.role !== Role.ADMIN) throw new HttpError(403, "Only an admin can set passwords.");
    await prisma.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(password) } });
    await audit(prisma, actor.id, "user.password_set", "User", userId);
}
