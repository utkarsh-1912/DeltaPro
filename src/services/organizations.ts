import { Plan, Role, type Organization } from "@prisma/client";
import { rootPrisma, prisma } from "@/lib/prisma";
import { HttpError } from "@/lib/errors";
import { FEATURE_LABELS, PLANS, seatLimitOf } from "@/server/plans";
import { audit } from "@/lib/activity";

const CACHE_MS = 30_000;
const cache = new Map<string, { at: number; org: Organization }>();

/** Organization by id, cached briefly per server instance (plan checks run on every request). */
export async function getOrganization(id: string): Promise<Organization | null> {
    const hit = cache.get(id);
    if (hit && Date.now() - hit.at < CACHE_MS) return hit.org;
    const org = await rootPrisma.organization.findUnique({ where: { id } });
    if (org) cache.set(id, { at: Date.now(), org });
    return org;
}

export function invalidateOrganization(id: string) {
    cache.delete(id);
}

const slugify = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "org";

const PUBLIC_EMAIL_DOMAINS = new Set(["gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "live.com", "yahoo.com", "icloud.com", "proton.me", "protonmail.com", "rediffmail.com"]);

export const emailDomain = (email: string) => email.split("@")[1]?.toLowerCase() ?? "";
export const isPublicDomain = (domain: string) => PUBLIC_EMAIL_DOMAINS.has(domain);

async function uniqueSlug(base: string): Promise<string> {
    let slug = slugify(base);
    for (let i = 2; await rootPrisma.organization.findUnique({ where: { slug } }); i++) slug = `${slugify(base)}-${i}`;
    return slug;
}

export async function createOrganization(name: string, opts: { domain?: string | null; plan?: Plan } = {}) {
    const domain = opts.domain && !isPublicDomain(opts.domain) ? opts.domain : null;
    const domainTaken = domain ? await rootPrisma.organization.findUnique({ where: { domain } }) : null;
    return rootPrisma.organization.create({
        data: {
            name: name.trim(),
            slug: await uniqueSlug(name),
            domain: domainTaken ? null : domain,
            plan: opts.plan ?? Plan.STARTER,
        },
    });
}

/**
 * Where a brand-new account lands: an existing organization that allows its email domain to
 * join (as USER), otherwise a new organization where the person is the first ADMIN.
 */
export async function resolveOrganizationForSignup(email: string, companyName?: string | null) {
    const domain = emailDomain(email);
    if (domain && !isPublicDomain(domain)) {
        const existing = await rootPrisma.organization.findFirst({ where: { domain, allowDomainJoin: true, status: "ACTIVE" } });
        if (existing) {
            await assertSeatAvailable(existing.id);
            return { organization: existing, role: Role.USER, created: false };
        }
    }
    const name = companyName?.trim() || (domain && !isPublicDomain(domain) ? domain.split(".")[0].replace(/^./, c => c.toUpperCase()) : `${email.split("@")[0]}'s workspace`);
    const organization = await createOrganization(name, { domain });
    return { organization, role: Role.ADMIN, created: true };
}

export async function seatsUsed(orgId: string): Promise<number> {
    return rootPrisma.user.count({ where: { organizationId: orgId, isActive: true } });
}

export async function assertSeatAvailable(orgId: string) {
    const org = await getOrganization(orgId);
    if (!org) throw new HttpError(404, "Organization not found.");
    const limit = seatLimitOf(org);
    if (limit !== null && (await seatsUsed(orgId)) >= limit) {
        throw new HttpError(402, `${org.name} has used all ${limit} seats on the ${PLANS[org.plan].name} plan. Upgrade or deactivate someone first.`);
    }
}

export type OrganizationPatch = Partial<Pick<Organization, "name" | "domain" | "allowDomainJoin" | "ptState" | "timezone" | "currency" | "country">> & { plan?: Plan };

export async function updateOrganization(actor: { id: string; role: Role }, orgId: string, patch: OrganizationPatch) {
    if (actor.role !== Role.ADMIN) throw new HttpError(403, "Only an admin can change organization settings.");
    const before = await getOrganization(orgId);
    if (!before) throw new HttpError(404, "Organization not found.");
    if (patch.domain) {
        patch.domain = patch.domain.toLowerCase().replace(/^@/, "");
        if (isPublicDomain(patch.domain)) throw new HttpError(400, "Use your company's own domain, not a public email provider.");
        const taken = await rootPrisma.organization.findFirst({ where: { domain: patch.domain, id: { not: orgId } } });
        if (taken) throw new HttpError(409, "Another organization already uses this domain.");
    }
    if (patch.plan && patch.plan !== before.plan) {
        const limit = PLANS[patch.plan].seats;
        const used = await seatsUsed(orgId);
        if (limit !== null && used > limit) throw new HttpError(409, `The ${PLANS[patch.plan].name} plan allows ${limit} seats and you have ${used} active people.`);
    }
    const updated = await rootPrisma.organization.update({ where: { id: orgId }, data: patch });
    invalidateOrganization(orgId);
    await audit(prisma, actor.id, patch.plan && patch.plan !== before.plan ? "organization.plan_changed" : "organization.updated", "Organization", orgId, { from: before.plan, ...patch });
    return updated;
}

/** What the Organization settings screen shows: the org, its plan, seats and the plan catalogue. */
export async function organizationOverview(org: Organization) {
    const used = await seatsUsed(org.id);
    return {
        organization: org,
        plan: PLANS[org.plan],
        seats: { used, limit: seatLimitOf(org) },
        plans: Object.values(PLANS),
        featureLabels: FEATURE_LABELS,
    };
}
