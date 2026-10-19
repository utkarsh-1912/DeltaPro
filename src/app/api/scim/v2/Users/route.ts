import { prisma } from "@/lib/prisma";
import { HttpError } from "@/lib/api";
import { SCIM_LIST, authenticateScim, fromScimUser, scimError, scimJson, toScimUser } from "@/integrations/scim";
import { createEmployee } from "@/services/users";

export const dynamic = "force-dynamic";

const INCLUDE = { profile: true } as const;

async function guard<T>(req: Request, fn: (integrationId: string) => Promise<T>) {
    try {
        const integration = await authenticateScim(req);
        return await fn(integration.id);
    } catch (e) {
        if (e instanceof HttpError) return scimError(e.status, e.message);
        console.error(e);
        return scimError(500, "Internal error");
    }
}

/** GET /api/scim/v2/Users?filter=userName eq "a@b.com"&startIndex=1&count=100 */
export async function GET(req: Request) {
    return guard(req, async () => {
        const url = new URL(req.url);
        const startIndex = Math.max(1, Number(url.searchParams.get("startIndex")) || 1);
        const count = Math.min(200, Math.max(0, Number(url.searchParams.get("count") ?? 100)));
        const filter = url.searchParams.get("filter");
        let where = {};
        if (filter) {
            const m = /^(userName|externalId|emails\.value)\s+eq\s+"([^"]+)"$/i.exec(filter.trim());
            if (!m) return scimError(400, "Only 'userName eq', 'externalId eq' and 'emails.value eq' filters are supported.");
            where = m[1].toLowerCase() === "externalid"
                ? { profile: { employeeId: m[2] } }
                : { email: { equals: m[2], mode: "insensitive" as const } };
        }
        const [total, users] = await Promise.all([
            prisma.user.count({ where }),
            prisma.user.findMany({ where, include: INCLUDE, orderBy: { email: "asc" }, skip: startIndex - 1, take: count }),
        ]);
        return scimJson({ schemas: [SCIM_LIST], totalResults: total, startIndex, itemsPerPage: users.length, Resources: users.map(toScimUser) });
    });
}

export async function POST(req: Request) {
    return guard(req, async integrationId => {
        const attrs = fromScimUser(await req.json());
        if (!attrs.email) return scimError(400, "userName or emails is required");
        if (await prisma.user.findUnique({ where: { email: attrs.email } })) return scimError(409, "User already exists");
        const created = await createEmployee(null, {
            email: attrs.email,
            name: attrs.name,
            employeeId: attrs.employeeId,
            department: attrs.department,
            designation: attrs.designation,
            phoneNumber: attrs.phoneNumber,
            managerId: attrs.managerId,
        }, { origin: integrationId });
        if (attrs.active === false) await prisma.user.update({ where: { id: created.id }, data: { isActive: false } });
        const user = await prisma.user.findUniqueOrThrow({ where: { id: created.id }, include: INCLUDE });
        return scimJson(toScimUser(user), 201);
    });
}
