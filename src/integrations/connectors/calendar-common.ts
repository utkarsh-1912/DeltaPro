import { addDays, format, parseISO } from "date-fns";
import type { DomainEvent } from "../events";
import type { ConnectorContext, DeliveryResult } from "../types";
import { skipped } from "../http";

/** Provider-neutral calendar entry. Dates are local to the configured time zone. */
export type CalendarItem = {
    localType: "LeaveRequest" | "RotaAssignment";
    localId: string;
    summary: string;
    description: string;
    attendees: string[];
    allDay: boolean;
    /** yyyy-MM-dd */
    startDate: string;
    /** yyyy-MM-dd, exclusive for all-day items */
    endDate: string;
    /** HH:mm for timed items */
    startTime?: string;
    endTime?: string;
    /** yyyy-MM-dd: repeat daily until this date (inclusive) */
    repeatUntil?: string;
};

export type CalendarPlan = { create: CalendarItem[]; remove: { localType: CalendarItem["localType"]; localIdPrefix: string }[] };

const ymd = (iso: string) => format(parseISO(iso), "yyyy-MM-dd");

/** Work out which calendar entries an event creates or removes. */
export function planCalendar(event: DomainEvent, config: Record<string, any>): CalendarPlan {
    const d = event.data;
    const syncLeave = config.syncLeave !== false;
    const syncShifts = config.syncShifts !== false;
    const invite = config.inviteAttendees === true;

    switch (event.type) {
        case "leave.approved": {
            if (!syncLeave) break;
            const r = d.request;
            const type = String(r.type).charAt(0) + String(r.type).slice(1).toLowerCase();
            return {
                create: [{
                    localType: "LeaveRequest",
                    localId: r.id,
                    summary: `${d.user?.name ?? d.user?.email}: ${type} leave${r.isHalfDay ? " (half day)" : ""}`,
                    description: r.reason ? `Reason: ${r.reason}` : "Approved in DeltaPro",
                    attendees: invite && d.user?.email ? [d.user.email] : [],
                    allDay: true,
                    startDate: ymd(r.startDate),
                    endDate: format(addDays(parseISO(r.endDate), 1), "yyyy-MM-dd"),
                }],
                remove: [{ localType: "LeaveRequest", localIdPrefix: r.id }],
            };
        }
        case "leave.cancelled":
            return { create: [], remove: [{ localType: "LeaveRequest", localIdPrefix: d.request.id }] };
        case "rota.published":
        case "rota.updated": {
            if (!syncShifts) break;
            const g = d.generation;
            const items: CalendarItem[] = (d.assignments ?? [])
                .filter((a: any) => a.shift)
                .map((a: any) => ({
                    localType: "RotaAssignment" as const,
                    localId: `${g.id}:${a.memberId}`,
                    summary: `${a.name}: ${a.shift.name} shift`,
                    description: `${d.team?.name ?? "Team"} rota, ${a.shift.startTime}–${a.shift.endTime}`,
                    attendees: invite && a.email ? [a.email] : [],
                    allDay: false,
                    startDate: ymd(g.startDate),
                    endDate: ymd(g.startDate),
                    startTime: a.shift.startTime,
                    endTime: a.shift.endTime,
                    repeatUntil: ymd(g.endDate),
                }));
            return { create: items, remove: [{ localType: "RotaAssignment", localIdPrefix: `${g.id}:` }] };
        }
        case "rota.deleted":
            return { create: [], remove: [{ localType: "RotaAssignment", localIdPrefix: `${d.generation.id}:` }] };
    }
    return { create: [], remove: [] };
}

/** End of a timed item; shifts that end before they start finish the next day. */
export function timedEnd(item: CalendarItem): { date: string; time: string } {
    const overnight = item.endTime! <= item.startTime!;
    return { date: overnight ? format(addDays(parseISO(item.startDate), 1), "yyyy-MM-dd") : item.startDate, time: item.endTime! };
}

/** Apply a plan with provider-specific create/delete calls, keeping ExternalLinks in step. */
export async function applyPlan(
    plan: CalendarPlan,
    ctx: ConnectorContext,
    api: {
        create(item: CalendarItem): Promise<{ ok: true; id: string } | { ok: false; result: DeliveryResult }>;
        remove(externalId: string): Promise<DeliveryResult>;
    },
): Promise<DeliveryResult> {
    if (plan.create.length === 0 && plan.remove.length === 0) return skipped("Nothing to sync for this event.");

    for (const r of plan.remove) {
        for (const link of await ctx.links.listByPrefix(r.localType, r.localIdPrefix)) {
            const res = await api.remove(link.externalId);
            if (!res.ok) return res;
            await ctx.links.remove(r.localType, link.localId);
        }
    }
    for (const item of plan.create) {
        const res = await api.create(item);
        if (!res.ok) return res.result;
        await ctx.links.set(item.localType, item.localId, res.id);
    }
    return { ok: true, note: `${plan.create.length} created` };
}
