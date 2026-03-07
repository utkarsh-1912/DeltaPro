import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET() {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const employees = await prisma.user.findMany({
            include: {
                profile: true
            },
            orderBy: {
                name: 'asc'
            }
        });
        return NextResponse.json(employees);
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch employees" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    const session = await auth();
    if (!session || session.user.role !== "ADMIN") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { email, name, role, department, designation, employeeId } = body;

        const user = await prisma.user.create({
            data: {
                email,
                name,
                role,
                profile: {
                    create: {
                        employeeId,
                        department,
                        designation,
                    }
                }
            },
            include: {
                profile: true
            }
        });

        return NextResponse.json(user);
    } catch (error) {
        return NextResponse.json({ error: "Failed to create employee" }, { status: 500 });
    }
}
