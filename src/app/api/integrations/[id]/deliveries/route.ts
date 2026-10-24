import { Role } from "@prisma/client";
import { route } from "@/lib/api";
import { listDeliveries } from "@/integrations/manage";

export const dynamic = "force-dynamic";

/** Latest deliveries for one integration, newest first. ?status=FAILED,DEAD to filter. */
export const GET = route<{ id: string }>(async ({ req, params }) => listDeliveries(params.id, new URL(req.url).searchParams.get("status")), { roles: [Role.ADMIN] });
