import { Role } from "@prisma/client";
import { route } from "@/lib/api";
import { syncIntegrationById } from "@/integrations/manage";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export const POST = route<{ id: string }>(async ({ params }) => syncIntegrationById(params.id), { roles: [Role.ADMIN] });
