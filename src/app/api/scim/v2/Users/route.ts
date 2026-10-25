import { createScimUser, listScimUsers, scimRequest } from "@/integrations/scim-service";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
    return scimRequest(req, () => listScimUsers(new URL(req.url)));
}

export async function POST(req: Request) {
    return scimRequest(req, async origin => createScimUser(await req.json(), origin));
}
