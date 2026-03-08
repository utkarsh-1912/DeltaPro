import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { Role } from "@prisma/client";

export async function PATCH(
    req: Request,
    { params }: { params: { id: string } }
) {
    try {
        const session = await auth();
        if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        // Only ADMIN, HR, or PM can approve/reject
        if (![Role.ADMIN, Role.HR, Role.PM].includes(session.user.role as Role)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const body = await req.json();
        const { status } = body; // APPROVED, REJECTED, CANCELLED

        if (!status) return NextResponse.json({ error: "Status is required" }, { status: 400 });

        const request = await prisma.leaveRequest.findUnique({
            where: { id: params.id },
            include: { user: true }
        });

        if (!request) return NextResponse.json({ error: "Request not found" }, { status: 404 });

        // If status is APPROVED, we need to deduct from LeaveBalance
        if (status === "APPROVED" && request.status !== "APPROVED") {
            const balance = await prisma.leaveBalance.findUnique({
                where: {
                    userId_type_year: {
                        userId: request.userId,
                        type: request.type,
                        year: new Date().getFullYear()
                    }
                }
            });

            if (!balance || balance.available < request.duration) {
                return NextResponse.json({ error: "Insufficient balance for approval." }, { status: 400 });
            }

            // Transaction: Update request status and deduct balance
            await prisma.$transaction([
                prisma.leaveRequest.update({
                    where: { id: params.id },
                    data: {
                        status: "APPROVED",
                        approverId: session.user.id
                    }
                }),
                prisma.leaveBalance.update({
                    where: { id: balance.id },
                    data: {
                        used: { increment: request.duration },
                        available: { decrement: request.duration }
                    }
                })
            ]);
        } else {
            // REJECTED or CANCELLED or already APPROVED (no double deduction)
            await prisma.leaveRequest.update({
                where: { id: params.id },
                data: {
                    status,
                    approverId: session.user.id
                }
            });
        }

        return NextResponse.json({ message: `Leave request ${status.toLowerCase()} successfully.` });
    } catch (error) {
        console.error("Leave Request PATCH error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
