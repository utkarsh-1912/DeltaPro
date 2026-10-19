import type { EmployeeProfile, User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { HttpError } from "@/lib/api";
import { decryptJson, safeEqual } from "./crypto";
import { appBaseUrl } from "./http";

export const SCIM_USER = "urn:ietf:params:scim:schemas:core:2.0:User";
export const SCIM_ENTERPRISE = "urn:ietf:params:scim:schemas:extension:enterprise:2.0:User";
export const SCIM_LIST = "urn:ietf:params:scim:api:messages:2.0:ListResponse";
export const SCIM_ERROR = "urn:ietf:params:scim:api:messages:2.0:Error";

export function scimJson(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/scim+json" } });
}

export function scimError(status: number, detail: string) {
    return scimJson({ schemas: [SCIM_ERROR], status: String(status), detail }, status);
}

/** Returns the SCIM integration whose bearer token matches, or throws 401. */
export async function authenticateScim(req: Request) {
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) throw new HttpError(401, "Missing bearer token");
    const integrations = await prisma.integration.findMany({ where: { provider: "scim", enabled: true } });
    const match = integrations.find(i => safeEqual(decryptJson(i.credentials).token, token));
    if (!match) throw new HttpError(401, "Invalid bearer token");
    return match;
}

type UserWithProfile = User & { profile: EmployeeProfile | null; manager?: { id: string } | null };

export function toScimUser(u: UserWithProfile) {
    const [givenName, ...rest] = (u.name ?? "").split(" ");
    return {
        schemas: [SCIM_USER, SCIM_ENTERPRISE],
        id: u.id,
        externalId: u.profile?.employeeId ?? undefined,
        userName: u.email,
        name: { formatted: u.name, givenName, familyName: rest.join(" ") || undefined },
        displayName: u.name,
        emails: u.email ? [{ value: u.email, primary: true, type: "work" }] : [],
        phoneNumbers: u.profile?.phoneNumber ? [{ value: u.profile.phoneNumber, type: "work" }] : [],
        title: u.profile?.designation ?? undefined,
        active: u.isActive,
        [SCIM_ENTERPRISE]: {
            employeeNumber: u.profile?.employeeId,
            department: u.profile?.department ?? undefined,
            manager: u.managerId ? { value: u.managerId } : undefined,
        },
        meta: { resourceType: "User", created: u.emailVerified ?? undefined, location: `${appBaseUrl()}/api/scim/v2/Users/${u.id}` },
    };
}

/** Pull the fields DeltaPro stores out of a SCIM User resource. */
export function fromScimUser(body: any) {
    const ent = body?.[SCIM_ENTERPRISE] ?? {};
    const email = body?.emails?.find((e: any) => e.primary)?.value ?? body?.emails?.[0]?.value ?? body?.userName;
    const name = body?.displayName ?? body?.name?.formatted ?? ([body?.name?.givenName, body?.name?.familyName].filter(Boolean).join(" ") || undefined);
    return {
        email: email ? String(email).toLowerCase() : undefined,
        name,
        employeeId: ent.employeeNumber ?? body?.externalId,
        department: ent.department,
        designation: body?.title,
        phoneNumber: body?.phoneNumbers?.[0]?.value,
        managerId: ent.manager?.value,
        active: body?.active,
    };
}

/** Apply PatchOp operations to a flat attribute set (Entra ID and Okta style). */
export function applyPatchOps(ops: any[]): Record<string, any> {
    const out: Record<string, any> = {};
    const set = (path: string, value: any) => {
        const p = path.toLowerCase();
        if (p === "active") out.active = value === true || value === "True" || value === "true";
        else if (p === "displayname" || p === "name.formatted") out.name = value;
        else if (p === "title") out.designation = value;
        else if (p.startsWith("emails")) out.email = typeof value === "string" ? value : value?.[0]?.value;
        else if (p.startsWith("phonenumbers")) out.phoneNumber = typeof value === "string" ? value : value?.[0]?.value;
        else if (p.endsWith(":department") || p === "department") out.department = value;
        else if (p.endsWith(":employeenumber") || p === "externalid") out.employeeId = value;
        else if (p.endsWith(":manager") || p.endsWith("manager.value")) out.managerId = typeof value === "string" ? value : value?.value ?? null;
    };
    for (const op of ops ?? []) {
        const kind = String(op.op).toLowerCase();
        if (kind === "remove") {
            if (op.path) set(op.path, null);
            continue;
        }
        if (op.path) set(op.path, op.value);
        else if (op.value && typeof op.value === "object") {
            for (const [k, v] of Object.entries(op.value)) {
                if (k === SCIM_ENTERPRISE && v && typeof v === "object") for (const [k2, v2] of Object.entries(v)) set(`${SCIM_ENTERPRISE}:${k2}`, v2);
                else set(k, v);
            }
        }
    }
    return out;
}
