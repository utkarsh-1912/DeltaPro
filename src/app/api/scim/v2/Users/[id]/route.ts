import { prisma } from "@/lib/prisma";
import { HttpError } from "@/lib/api";
import { applyPatchOps, authenticateScim, fromScimUser, scimError, scimJson, toScimUser } from "@/integrations/scim";
import { updateEmployee } from "@/services/users";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };
const INCLUDE = { profile: true } as const;

async function guard(req: Request, ctx: Ctx, fn: (id: string, integrationId: string) => Promise<Response>) {
    try {
        const integration = await authenticateScim(req);
        const { id } = await ctx.params;
        if (!(await prisma.user.findUnique({ where: { id } }))) return scimError(404, "User not found");
        return await fn(id, integration.id);
    } catch (e) {
        if (e instanceof HttpError) return scimError(e.status, e.message);
        console.error(e);
        return scimError(500, "Internal error");
    }
}

async function apply(id: string, attrs: ReturnType<typeof fromScimUser>, origin: string) {
    if (attrs.email) {
        const clash = await prisma.user.findUnique({ where: { email: attrs.email } });
        if (clash && clash.id !== id) throw new HttpError(409, "Another user has this email");
        await prisma.user.update({ where: { id }, data: { email: attrs.email } });
    }
    const managerId = attrs.managerId === undefined ? undefined
        : attrs.managerId && (await prisma.user.findUnique({ where: { id: attrs.managerId } })) ? attrs.managerId : null;
    await updateEmployee(null, id, {
        name: attrs.name,
        employeeId: attrs.employeeId,
        department: attrs.department,
        designation: attrs.designation,
        phoneNumber: attrs.phoneNumber,
        managerId,
        isActive: attrs.active === undefined || attrs.active === null ? undefined : !!attrs.active,
    }, { origin });
    return scimJson(toScimUser(await prisma.user.findUniqueOrThrow({ where: { id }, include: INCLUDE })));
}

export async function GET(req: Request, ctx: Ctx) {
    return guard(req, ctx, async id => scimJson(toScimUser(await prisma.user.findUniqueOrThrow({ where: { id }, include: INCLUDE }))));
}

export async function PUT(req: Request, ctx: Ctx) {
    return guard(req, ctx, async (id, origin) => apply(id, fromScimUser(await req.json()), origin));
}

export async function PATCH(req: Request, ctx: Ctx) {
    return guard(req, ctx, async (id, origin) => {
        const body = await req.json();
        return apply(id, applyPatchOps(body.Operations ?? body.operations ?? []) as ReturnType<typeof fromScimUser>, origin);
    });
}

/** SCIM DELETE deactivates; DeltaPro keeps attendance and leave history. */
export async function DELETE(req: Request, ctx: Ctx) {
    return guard(req, ctx, async (id, origin) => {
        await updateEmployee(null, id, { isActive: false }, { origin });
        return new Response(null, { status: 204 });
    });
}
