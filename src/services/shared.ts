import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { Db } from "@/lib/activity";
import type { PersonRef } from "@/integrations/events";

export const person = (u: { id: string; name: string | null; email: string | null } | null | undefined): PersonRef | null =>
    u ? { id: u.id, name: u.name, email: u.email } : null;

const PERSON = { id: true, name: true, email: true } as const;

/** Who can approve for this user: their manager, otherwise HR and admins. */
export async function approversFor(userId: string, db: Db = prisma): Promise<PersonRef[]> {
    const user = await db.user.findUnique({ where: { id: userId }, select: { manager: { select: PERSON } } });
    if (user?.manager) return [user.manager];
    return db.user.findMany({
        where: { role: { in: [Role.HR, Role.ADMIN] }, isActive: true, id: { not: userId } },
        select: PERSON,
        take: 10,
    });
}

export async function managerOf(userId: string, db: Db = prisma): Promise<PersonRef | null> {
    const user = await db.user.findUnique({ where: { id: userId }, select: { manager: { select: PERSON } } });
    return user?.manager ?? null;
}

/**
 * Normalise a date sent by a browser in any time zone to UTC midnight of the day the user picked.
 * Local midnight in UTC-12..UTC+12 lands within 12h of the right UTC midnight.
 */
export function toUtcDay(value: string | Date): Date {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) throw new Error("Invalid date");
    const shifted = new Date(d.getTime() + 12 * 3600 * 1000);
    return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()));
}

export const ymd = (d: Date) => d.toISOString().slice(0, 10);

/** Weekdays (Mon–Fri) between two UTC days, inclusive. */
export function weekdaysBetween(start: Date, end: Date): number {
    let count = 0;
    for (let t = start.getTime(); t <= end.getTime(); t += 86400000) {
        const dow = new Date(t).getUTCDay();
        if (dow !== 0 && dow !== 6) count++;
    }
    return count;
}

export function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000;
    const toRad = (x: number) => (x * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
}
