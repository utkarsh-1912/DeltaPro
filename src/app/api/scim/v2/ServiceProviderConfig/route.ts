import { scimJson } from "@/integrations/scim";

export const dynamic = "force-dynamic";

export async function GET() {
    return scimJson({
        schemas: ["urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig"],
        patch: { supported: true },
        bulk: { supported: false, maxOperations: 0, maxPayloadSize: 0 },
        filter: { supported: true, maxResults: 200 },
        changePassword: { supported: false },
        sort: { supported: false },
        etag: { supported: false },
        authenticationSchemes: [{ type: "oauthbearertoken", name: "Bearer token", description: "Token from the SCIM integration in DeltaPro", primary: true }],
    });
}
