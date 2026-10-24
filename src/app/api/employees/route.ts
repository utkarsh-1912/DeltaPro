import { z } from "zod";
import { Role } from "@prisma/client";
import { PEOPLE_ADMIN_ROLES, parseBody, route } from "@/lib/api";
import { PASSWORD_MIN_LENGTH } from "@/lib/password";
import { createEmployee, listEmployees, publicUser } from "@/services/users";

export const dynamic = "force-dynamic";

/** Directory. HR/ADMIN also get inactive people; everyone else sees active employees. */
export const GET = route(async ({ user }) => listEmployees(user));

const schema = z.object({
    email: z.string().email(),
    name: z.string().trim().min(1).max(100),
    role: z.nativeEnum(Role).default(Role.USER),
    password: z.string().min(PASSWORD_MIN_LENGTH).max(200).optional().or(z.literal("")),
    managerId: z.string().nullable().optional(),
    employeeId: z.string().trim().max(40).optional().or(z.literal("")),
    department: z.string().trim().max(100).nullable().optional(),
    designation: z.string().trim().max(100).nullable().optional(),
    phoneNumber: z.string().trim().max(40).nullable().optional(),
});

/**
 * Create an employee. Without a password they sign in with SSO or use "Forgot password"
 * (the welcome email from the email connector links there).
 */
export const POST = route(async ({ req, user }) => {
    const body = await parseBody(req, schema);
    const created = await createEmployee(user, { ...body, password: body.password || null, employeeId: body.employeeId || null });
    return Response.json(publicUser(created), { status: 201 });
}, { roles: PEOPLE_ADMIN_ROLES });
