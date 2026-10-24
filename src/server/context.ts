import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Request-scoped tenant context. The API layer opens one per request (see route() in
 * src/lib/api.ts); background work opens one per organization or runs as system.
 */
export type TenantContext = { orgId: string | null; userId?: string; system?: boolean };

const storage = new AsyncLocalStorage<TenantContext>();

export function currentTenant(): TenantContext | undefined {
    return storage.getStore();
}

/** Organization the current code runs for, or null for system / unauthenticated work. */
export function currentOrgId(): string | null {
    const ctx = storage.getStore();
    return ctx && !ctx.system ? ctx.orgId : null;
}

export function requireOrgId(): string {
    const id = currentOrgId();
    if (!id) throw new Error("No organization in context");
    return id;
}

export function runWithTenant<T>(orgId: string | null, fn: () => T, userId?: string): T {
    return storage.run({ orgId, userId }, fn);
}

/** Cross-tenant work (dispatcher, cron fan-out, SCIM token lookup). Queries are not scoped. */
export function runAsSystem<T>(fn: () => T): T {
    return storage.run({ orgId: null, system: true }, fn);
}
