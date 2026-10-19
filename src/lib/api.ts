import { NextResponse } from "next/server";
import { Prisma, Role } from "@prisma/client";
import { z, ZodError } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export class HttpError extends Error {
    constructor(public status: number, message: string, public details?: unknown) {
        super(message);
    }
}

export type SessionUser = {
    id: string;
    role: Role;
    email?: string | null;
    name?: string | null;
};

type RouteContext<P> = { params: Promise<P> };
type Handler<P> = (ctx: { req: Request; user: SessionUser; params: P }) => Promise<unknown>;

export function toErrorResponse(error: unknown): Response {
    if (error instanceof HttpError) {
        return NextResponse.json({ error: error.message, details: error.details }, { status: error.status });
    }
    if (error instanceof ZodError) {
        return NextResponse.json({ error: "Invalid request", details: error.flatten() }, { status: 400 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2002") return NextResponse.json({ error: "A record with these values already exists." }, { status: 409 });
        if (error.code === "P2025") return NextResponse.json({ error: "Not found" }, { status: 404 });
        if (error.code === "P2003") return NextResponse.json({ error: "Referenced record does not exist." }, { status: 400 });
    }
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
}

function toResponse(result: unknown, status = 200): Response {
    if (result instanceof Response) return result;
    return NextResponse.json(result ?? { ok: true }, { status });
}

/**
 * Wraps an authenticated route handler: resolves the session, enforces roles,
 * awaits Next 15 params and maps thrown errors to JSON responses.
 */
export function route<P = Record<string, string>>(handler: Handler<P>, opts: { roles?: Role[]; status?: number } = {}) {
    return async (req: Request, context: RouteContext<P>) => {
        try {
            const session = await auth();
            if (!session?.user?.id) throw new HttpError(401, "Unauthorized");
            const user: SessionUser = {
                id: session.user.id,
                role: session.user.role as Role,
                email: session.user.email,
                name: session.user.name,
            };
            if (opts.roles && !opts.roles.includes(user.role)) throw new HttpError(403, "Forbidden");
            const params = (context?.params ? await context.params : {}) as P;
            return toResponse(await handler({ req, user, params }), opts.status);
        } catch (error) {
            return toErrorResponse(error);
        }
    };
}

/** For webhooks, cron and SCIM: no session; the handler authenticates the caller itself. */
export function publicRoute<P = Record<string, string>>(handler: (ctx: { req: Request; params: P }) => Promise<unknown>) {
    return async (req: Request, context: RouteContext<P>) => {
        try {
            const params = (context?.params ? await context.params : {}) as P;
            return toResponse(await handler({ req, params }));
        } catch (error) {
            return toErrorResponse(error);
        }
    };
}

export async function parseBody<T extends z.ZodTypeAny>(req: Request, schema: T): Promise<z.infer<T>> {
    let json: unknown;
    try {
        json = await req.json();
    } catch {
        throw new HttpError(400, "Request body must be JSON");
    }
    return schema.parse(json);
}

// ---------- Policy ----------

export const MANAGER_ROLES: Role[] = [Role.ADMIN, Role.HR, Role.PM];
export const PEOPLE_ADMIN_ROLES: Role[] = [Role.ADMIN, Role.HR];

export const isPeopleAdmin = (user: SessionUser) => PEOPLE_ADMIN_ROLES.includes(user.role);
export const isManager = (user: SessionUser) => MANAGER_ROLES.includes(user.role);

/** ADMIN/HR act on anyone; PM on their direct reports; everyone on themselves. */
export async function canActOnUser(actor: SessionUser, targetUserId: string): Promise<boolean> {
    if (isPeopleAdmin(actor)) return true;
    if (actor.id === targetUserId) return true;
    if (actor.role === Role.PM) {
        const target = await prisma.user.findUnique({ where: { id: targetUserId }, select: { managerId: true } });
        return target?.managerId === actor.id;
    }
    return false;
}

/** Approver rules: never your own request; ADMIN/HR anyone; PM only direct reports. */
export async function assertCanApproveFor(actor: SessionUser, targetUserId: string) {
    if (actor.id === targetUserId) throw new HttpError(403, "You cannot approve your own request.");
    if (isPeopleAdmin(actor)) return;
    if (actor.role === Role.PM) {
        const target = await prisma.user.findUnique({ where: { id: targetUserId }, select: { managerId: true } });
        if (target?.managerId === actor.id) return;
        throw new HttpError(403, "Only this employee's manager, HR or an admin can decide this request.");
    }
    throw new HttpError(403, "Forbidden");
}

/** ADMIN/HR manage every team; a PM only teams where they are the PM. */
export async function assertTeamAccess(actor: SessionUser, teamId: string | null | undefined) {
    if (isPeopleAdmin(actor)) return;
    if (actor.role !== Role.PM) throw new HttpError(403, "Forbidden");
    if (!teamId) throw new HttpError(403, "PMs can only manage their own teams.");
    const team = await prisma.team.findUnique({ where: { id: teamId }, select: { pmId: true } });
    if (!team) throw new HttpError(404, "Team not found");
    if (team.pmId !== actor.id) throw new HttpError(403, "PMs can only manage their own teams.");
}

/** Prisma `where` that limits user-owned rows to what the actor may see. */
export function scopeByUser(actor: SessionUser): Record<string, unknown> {
    if (isPeopleAdmin(actor)) return {};
    if (actor.role === Role.PM) {
        return { OR: [{ userId: actor.id }, { user: { managerId: actor.id } }] };
    }
    return { userId: actor.id };
}
