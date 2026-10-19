import { after } from "next/server";
import type { Prisma } from "@prisma/client";
import type { Db } from "@/lib/activity";

export const EVENT_TYPES = [
    "leave.requested",
    "leave.approved",
    "leave.rejected",
    "leave.cancelled",
    "attendance.clocked_in",
    "attendance.clocked_out",
    "attendance.auto_logged_out",
    "attendance.regularization_requested",
    "attendance.regularization_decided",
    "rota.published",
    "rota.updated",
    "rota.deleted",
    "task.created",
    "task.updated",
    "task.status_changed",
    "task.commented",
    "user.created",
    "user.updated",
    "user.deactivated",
    "integration.test",
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export type PersonRef = { id: string; name: string | null; email: string | null };

/** The envelope every connector and outbound webhook receives. `id` is the idempotency key. */
export interface DomainEvent<T = any> {
    id: string;
    type: EventType;
    version: number;
    occurredAt: string;
    actor: { userId: string; role?: string } | null;
    subject: { type: string; id: string };
    /** Integration id that caused this event (inbound sync); it is not echoed back there. */
    origin?: string | null;
    data: T;
}

export type EmitInput<T> = {
    type: EventType;
    subject: { type: string; id: string };
    data: T;
    actor?: { id: string; role?: string } | null;
    origin?: string | null;
};

/**
 * Write a domain event to the outbox. Call it with the same transaction client
 * as the state change so the event exists if and only if the change committed.
 */
export async function emitEvent<T>(db: Db, input: EmitInput<T>): Promise<string> {
    const payload = {
        type: input.type,
        version: 1,
        occurredAt: new Date().toISOString(),
        actor: input.actor ? { userId: input.actor.id, role: input.actor.role } : null,
        subject: input.subject,
        origin: input.origin ?? null,
        data: input.data,
    };
    const row = await db.outboxEvent.create({
        data: { type: input.type, payload: payload as unknown as Prisma.InputJsonValue },
    });
    return row.id;
}

/**
 * Run the dispatcher after the response is sent, so connectors fire within seconds
 * without a cron. Retries still need /api/cron/dispatch on a schedule.
 */
export function scheduleDispatch() {
    try {
        after(async () => {
            const { dispatchPending } = await import("./dispatcher");
            await dispatchPending().catch(err => console.error("[integrations] dispatch failed", err));
        });
    } catch {
        // Called outside a request scope (scripts, tests): the cron picks events up.
    }
}

export function toDomainEvent(row: { id: string; payload: unknown }): DomainEvent {
    const p = row.payload as Omit<DomainEvent, "id">;
    return { ...p, id: row.id };
}
