import { prisma, rootPrisma } from "@/lib/prisma";
import { HttpError } from "@/lib/errors";
import { runAsSystem, runWithTenant } from "@/server/context";
import { hasFeature } from "@/server/plans";
import { getOrganization } from "@/services/organizations";
import { createEmployee, updateEmployee } from "@/services/users";
import { decryptJson, safeEqual } from "./crypto";
import { SCIM_LIST, applyPatchOps, fromScimUser, scimError, scimJson, toScimUser } from "./scim";

const INCLUDE = { profile: true } as const;

/**
 * Authenticates the bearer token against every organization's SCIM integration (system scope),
 * then runs the handler inside that organization. Errors come back as SCIM error documents.
 */
export async function scimRequest(req: Request, fn: (origin: string) => Promise<Response>): Promise<Response> {
    try {
        const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
        if (!token) throw new HttpError(401, "Missing bearer token");
        const integration = await runAsSystem(async () => {
            const all = await rootPrisma.integration.findMany({ where: { provider: "scim", enabled: true } });
            return all.find(i => safeEqual(decryptJson(i.credentials).token, token));
        });
        if (!integration?.organizationId) throw new HttpError(401, "Invalid bearer token");
        const org = await getOrganization(integration.organizationId);
        if (!org || !hasFeature(org.plan, "integrations.advanced")) throw new HttpError(403, "SCIM provisioning needs the Enterprise plan.");
        return await runWithTenant(org.id, () => fn(integration.id));
    } catch (e) {
        if (e instanceof HttpError) return scimError(e.status, e.message);
        console.error(e);
        return scimError(500, "Internal error");
    }
}

/** GET /Users?filter=userName eq "a@b.com"&startIndex=1&count=100 */
export async function listScimUsers(url: URL) {
    const startIndex = Math.max(1, Number(url.searchParams.get("startIndex")) || 1);
    const count = Math.min(200, Math.max(0, Number(url.searchParams.get("count") ?? 100)));
    const filter = url.searchParams.get("filter");
    let where = {};
    if (filter) {
        const m = /^(userName|externalId|emails\.value)\s+eq\s+"([^"]+)"$/i.exec(filter.trim());
        if (!m) return scimError(400, "Only 'userName eq', 'externalId eq' and 'emails.value eq' filters are supported.");
        where = m[1].toLowerCase() === "externalid" ? { profile: { employeeId: m[2] } } : { email: { equals: m[2], mode: "insensitive" as const } };
    }
    const [total, users] = await Promise.all([
        prisma.user.count({ where }),
        prisma.user.findMany({ where, include: INCLUDE, orderBy: { email: "asc" }, skip: startIndex - 1, take: count }),
    ]);
    return scimJson({ schemas: [SCIM_LIST], totalResults: total, startIndex, itemsPerPage: users.length, Resources: users.map(toScimUser) });
}

export async function createScimUser(body: unknown, origin: string) {
    const attrs = fromScimUser(body);
    if (!attrs.email) return scimError(400, "userName or emails is required");
    if (await rootPrisma.user.findUnique({ where: { email: attrs.email } })) return scimError(409, "User already exists");
    const created = await createEmployee(null, {
        email: attrs.email, name: attrs.name, employeeId: attrs.employeeId, department: attrs.department,
        designation: attrs.designation, phoneNumber: attrs.phoneNumber, managerId: attrs.managerId,
    }, { origin });
    if (attrs.active === false) await prisma.user.update({ where: { id: created.id }, data: { isActive: false } });
    return scimJson(toScimUser(await prisma.user.findUniqueOrThrow({ where: { id: created.id }, include: INCLUDE })), 201);
}

async function requireUser(id: string) {
    const user = await prisma.user.findUnique({ where: { id }, include: INCLUDE });
    if (!user) throw new HttpError(404, "User not found");
    return user;
}

export async function getScimUser(id: string) {
    return scimJson(toScimUser(await requireUser(id)));
}

async function apply(id: string, attrs: ReturnType<typeof fromScimUser>, origin: string) {
    await requireUser(id);
    if (attrs.email) {
        const clash = await rootPrisma.user.findUnique({ where: { email: attrs.email } });
        if (clash && clash.id !== id) throw new HttpError(409, "Another user has this email");
        await prisma.user.update({ where: { id }, data: { email: attrs.email } });
    }
    const managerId = attrs.managerId === undefined ? undefined
        : attrs.managerId && (await prisma.user.findUnique({ where: { id: attrs.managerId } })) ? attrs.managerId : null;
    await updateEmployee(null, id, {
        name: attrs.name, employeeId: attrs.employeeId, department: attrs.department, designation: attrs.designation,
        phoneNumber: attrs.phoneNumber, managerId,
        isActive: attrs.active === undefined || attrs.active === null ? undefined : !!attrs.active,
    }, { origin });
    return getScimUser(id);
}

export const replaceScimUser = (id: string, body: unknown, origin: string) => apply(id, fromScimUser(body), origin);

export const patchScimUser = (id: string, body: any, origin: string) =>
    apply(id, applyPatchOps(body?.Operations ?? body?.operations ?? []) as ReturnType<typeof fromScimUser>, origin);

/** SCIM DELETE deactivates; DeltaPro keeps attendance and leave history. */
export async function deactivateScimUser(id: string, origin: string) {
    await requireUser(id);
    await updateEmployee(null, id, { isActive: false }, { origin });
    return new Response(null, { status: 204 });
}
