import { Role } from "@prisma/client";
import { route } from "@/lib/api";
import { retryDelivery } from "@/integrations/dispatcher";

export const dynamic = "force-dynamic";

export const POST = route<{ id: string }>(async ({ params }) => retryDelivery(params.id), { roles: [Role.ADMIN] });
