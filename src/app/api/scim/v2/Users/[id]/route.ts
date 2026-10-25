import { deactivateScimUser, getScimUser, patchScimUser, replaceScimUser, scimRequest } from "@/integrations/scim-service";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: Ctx) {
    const { id } = await ctx.params;
    return scimRequest(req, () => getScimUser(id));
}

export async function PUT(req: Request, ctx: Ctx) {
    const { id } = await ctx.params;
    return scimRequest(req, async origin => replaceScimUser(id, await req.json(), origin));
}

export async function PATCH(req: Request, ctx: Ctx) {
    const { id } = await ctx.params;
    return scimRequest(req, async origin => patchScimUser(id, await req.json(), origin));
}

/** SCIM DELETE deactivates; DeltaPro keeps attendance and leave history. */
export async function DELETE(req: Request, ctx: Ctx) {
    const { id } = await ctx.params;
    return scimRequest(req, origin => deactivateScimUser(id, origin));
}
