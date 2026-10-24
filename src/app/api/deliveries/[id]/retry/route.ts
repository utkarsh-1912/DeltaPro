import { Role } from "@prisma/client";
import { route } from "@/lib/api";
import { retryDeliveryForOrg } from "@/integrations/manage";

export const dynamic = "force-dynamic";

export const POST = route<{ id: string }>(async ({ params }) => retryDeliveryForOrg(params.id), { roles: [Role.ADMIN] });
