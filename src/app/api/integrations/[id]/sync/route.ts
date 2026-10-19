import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { HttpError, route } from "@/lib/api";
import { runPullSync } from "@/integrations/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export const POST = route<{ id: string }>(async ({ params }) => {
    const i = await prisma.integration.findUnique({ where: { id: params.id } });
    if (!i) throw new HttpError(404, "Integration not found.");
    return runPullSync(i);
}, { roles: [Role.ADMIN] });
