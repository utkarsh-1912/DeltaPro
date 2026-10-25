import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/activity";
import { HttpError, isPeopleAdmin, type SessionUser } from "@/lib/api";
import { toUtcDay, ymd } from "./shared";

/** Non-optional holidays between two UTC days (inclusive), as yyyy-MM-dd strings. */
export async function holidaySet(start: Date, end: Date): Promise<Set<string>> {
    const rows = await prisma.holiday.findMany({ where: { optional: false, date: { gte: start, lte: end } }, select: { date: true } });
    return new Set(rows.map(r => ymd(r.date)));
}

/** Working days: Monday–Friday, excluding the organization's non-optional holidays. */
export async function workingDaysBetween(start: Date, end: Date): Promise<number> {
    const holidays = await holidaySet(start, end);
    let count = 0;
    for (let t = start.getTime(); t <= end.getTime(); t += 86400000) {
        const d = new Date(t);
        const dow = d.getUTCDay();
        if (dow !== 0 && dow !== 6 && !holidays.has(ymd(d))) count++;
    }
    return count;
}

export const listHolidays = (year: number) =>
    prisma.holiday.findMany({
        where: { date: { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) } },
        orderBy: { date: "asc" },
    });

export async function addHolidays(actor: SessionUser, items: { date: string; name: string; optional?: boolean }[]) {
    if (!isPeopleAdmin(actor)) throw new HttpError(403, "Only HR or an admin can manage holidays.");
    const created = [];
    for (const item of items) {
        const date = toUtcDay(item.date);
        created.push(await prisma.holiday.upsert({
            where: { organizationId_date: { organizationId: actor.organizationId, date } },
            create: { date, name: item.name.trim(), optional: !!item.optional },
            update: { name: item.name.trim(), optional: !!item.optional },
        }));
    }
    await audit(prisma, actor.id, "holidays.updated", "Holiday", "bulk", { count: created.length });
    return created;
}

export async function deleteHoliday(actor: SessionUser, id: string) {
    if (!isPeopleAdmin(actor)) throw new HttpError(403, "Only HR or an admin can manage holidays.");
    await prisma.holiday.delete({ where: { id } });
}
