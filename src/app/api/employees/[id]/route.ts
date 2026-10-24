import { z } from "zod";
import { Role } from "@prisma/client";
import { HttpError, PEOPLE_ADMIN_ROLES, parseBody, route } from "@/lib/api";
import { PASSWORD_MIN_LENGTH } from "@/lib/password";
import { getEmployee, publicUser, setPassword, updateEmployee } from "@/services/users";

export const dynamic = "force-dynamic";

export const GET = route<{ id: string }>(async ({ params }) => getEmployee(params.id));

const schema = z.object({
    name: z.string().trim().min(1).max(100).optional(),
    role: z.nativeEnum(Role).optional(),
    managerId: z.string().nullable().optional(),
    employeeId: z.string().trim().max(40).optional(),
    department: z.string().trim().max(100).nullable().optional(),
    designation: z.string().trim().max(100).nullable().optional(),
    phoneNumber: z.string().trim().max(40).nullable().optional(),
    emergencyContact: z.string().trim().max(100).nullable().optional(),
    status: z.enum(["ACTIVE", "INACTIVE", "ON_LEAVE", "TERMINATED"]).optional(),
    isActive: z.boolean().optional(),
    /** Admin-only password reset for people without email access. */
    password: z.string().min(PASSWORD_MIN_LENGTH).max(200).optional(),
});

export const PATCH = route<{ id: string }>(async ({ req, user, params }) => {
    const { password, ...patch } = await parseBody(req, schema);
    if (password) await setPassword(user, params.id, password);
    const updated = await updateEmployee(user, params.id, patch);
    return publicUser(updated);
}, { roles: PEOPLE_ADMIN_ROLES });

/** Deactivate (people keep their history). */
export const DELETE = route<{ id: string }>(async ({ user, params }) => {
    await updateEmployee(user, params.id, { isActive: false });
    return { ok: true };
}, { roles: PEOPLE_ADMIN_ROLES });
