import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { auth } from "@/auth";

const DEFAULT_BALANCES = [
    { type: "CASUAL", total: 12 },
    { type: "SICK", total: 10 },
    { type: "EARNED", total: 15 }
];

export async function GET(req: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const year = new Date().getFullYear();

        // 1. Fetch current balances
        let balances = await prisma.leaveBalance.findMany({
            where: {
                userId: session.user.id,
                year: year
            }
        });

        // 2. If no balances exist, initialize with defaults
        if (balances.length === 0) {
            await Promise.all(
                DEFAULT_BALANCES.map(b =>
                    prisma.leaveBalance.create({
                        data: {
                            userId: session.user.id,
                            type: b.type,
                            total: b.total,
                            available: b.total,
                            used: 0,
                            year: year
                        }
                    })
                )
            );

            // Re-fetch after creation
            balances = await prisma.leaveBalance.findMany({
                where: {
                    userId: session.user.id,
                    year: year
                }
            });
        }

        return NextResponse.json(balances);
    } catch (error) {
        console.error("Leave Balance FETCH error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
