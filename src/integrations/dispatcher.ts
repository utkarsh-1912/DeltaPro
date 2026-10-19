import { prisma } from "@/lib/prisma";
import { buildContext } from "./context";
import { toDomainEvent, type DomainEvent } from "./events";
import { getConnector, subscribes } from "./registry";
import type { DeliveryResult } from "./types";

export const MAX_ATTEMPTS = 6;
/** Delay before attempt n+1 (n = attempts so far). */
const BACKOFF_MS = [30_000, 2 * 60_000, 10 * 60_000, 60 * 60_000, 6 * 60 * 60_000];
const HANDLER_TIMEOUT_MS = 25_000;
const STUCK_AFTER_MS = 10 * 60_000;

/** Claim new outbox events and create one Delivery per subscribed, enabled integration. */
export async function fanOutEvents(limit = 100): Promise<number> {
    const claimed = await prisma.$queryRaw<{ id: string; type: string; payload: any }[]>`
        UPDATE "OutboxEvent" SET status = 'DISPATCHING'
        WHERE id IN (
            SELECT id FROM "OutboxEvent" WHERE status = 'PENDING'
            ORDER BY "createdAt" LIMIT ${limit} FOR UPDATE SKIP LOCKED
        )
        RETURNING id, type, payload`;
    if (claimed.length === 0) return 0;

    const integrations = await prisma.integration.findMany({ where: { enabled: true } });
    const rows: { eventId: string; integrationId: string }[] = [];
    for (const ev of claimed) {
        const origin = ev.payload?.origin ?? null;
        for (const integration of integrations) {
            const connector = getConnector(integration.provider);
            if (!connector || integration.id === origin) continue;
            if (subscribes(connector, integration.events, ev.type)) rows.push({ eventId: ev.id, integrationId: integration.id });
        }
    }
    if (rows.length) await prisma.delivery.createMany({ data: rows, skipDuplicates: true });
    await prisma.outboxEvent.updateMany({ where: { id: { in: claimed.map(e => e.id) } }, data: { status: "DISPATCHED" } });
    return claimed.length;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
    return Promise.race([p, new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`Timed out after ${ms / 1000}s`)), ms))]);
}

export async function runDelivery(deliveryId: string): Promise<DeliveryResult> {
    const delivery = await prisma.delivery.findUnique({ where: { id: deliveryId }, include: { event: true, integration: true } });
    if (!delivery) return { ok: false, retryable: false, error: "Delivery not found" };
    const connector = getConnector(delivery.integration.provider);

    let result: DeliveryResult;
    if (!connector?.handle) {
        result = { ok: false, retryable: false, error: `No outbound handler for ${delivery.integration.provider}` };
    } else if (!delivery.integration.enabled) {
        result = { ok: false, retryable: false, error: "Integration is disabled" };
    } else {
        try {
            const event: DomainEvent = toDomainEvent(delivery.event);
            result = await withTimeout(connector.handle(event, buildContext(delivery.integration)), HANDLER_TIMEOUT_MS);
        } catch (e) {
            result = { ok: false, retryable: true, error: e instanceof Error ? e.message : String(e) };
        }
    }

    if (result.ok) {
        await prisma.delivery.update({
            where: { id: delivery.id },
            data: { status: "DONE", lastError: result.skipped ? `Skipped: ${result.note ?? ""}` : result.note ?? null },
        });
    } else {
        const exhausted = !result.retryable || delivery.attempts >= MAX_ATTEMPTS;
        const delay = result.retryAfterMs ?? BACKOFF_MS[Math.min(delivery.attempts - 1, BACKOFF_MS.length - 1)] ?? BACKOFF_MS[0];
        await prisma.delivery.update({
            where: { id: delivery.id },
            data: {
                status: exhausted ? "DEAD" : "FAILED",
                lastError: result.error.slice(0, 4000),
                nextRunAt: new Date(Date.now() + delay),
            },
        });
    }
    return result;
}

/** Claim deliveries that are due and run them. Attempts are counted at claim time. */
export async function runDueDeliveries(limit = 25): Promise<{ ran: number; failed: number }> {
    await prisma.delivery.updateMany({
        where: { status: "RUNNING", updatedAt: { lt: new Date(Date.now() - STUCK_AFTER_MS) } },
        data: { status: "FAILED" },
    });
    const due = await prisma.$queryRaw<{ id: string }[]>`
        UPDATE "Delivery" SET status = 'RUNNING', attempts = attempts + 1, "updatedAt" = now()
        WHERE id IN (
            SELECT id FROM "Delivery"
            WHERE status IN ('PENDING', 'FAILED') AND "nextRunAt" <= now()
            ORDER BY "nextRunAt" LIMIT ${limit} FOR UPDATE SKIP LOCKED
        )
        RETURNING id`;
    let failed = 0;
    // Small fixed concurrency keeps vendor rate limits happy.
    const queue = [...due];
    await Promise.all(Array.from({ length: Math.min(4, queue.length) }, async () => {
        for (let next = queue.shift(); next; next = queue.shift()) {
            const r = await runDelivery(next.id);
            if (!r.ok) failed++;
        }
    }));
    return { ran: due.length, failed };
}

export async function dispatchPending() {
    const events = await fanOutEvents();
    const deliveries = await runDueDeliveries();
    return { events, ...deliveries };
}

/** Put a dead or failed delivery back in the queue. */
export async function retryDelivery(id: string) {
    await prisma.delivery.update({ where: { id }, data: { status: "PENDING", nextRunAt: new Date(), attempts: 0 } });
    const [claimed] = await prisma.$queryRaw<{ id: string }[]>`
        UPDATE "Delivery" SET status = 'RUNNING', attempts = attempts + 1, "updatedAt" = now()
        WHERE id = ${id} AND status = 'PENDING' RETURNING id`;
    return claimed ? runDelivery(id) : { ok: false as const, retryable: true, error: "Already running" };
}
