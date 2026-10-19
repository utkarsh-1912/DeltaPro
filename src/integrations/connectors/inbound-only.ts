import { safeEqual } from "../crypto";
import type { Connector, DomainCommand } from "../types";

const bearer = (h: Headers) => (h.get("authorization") || "").replace(/^Bearer\s+/i, "");

/** Biometric / access-control terminals or their middleware push punches here. */
export const deviceConnector: Connector = {
    provider: "device",
    name: "Attendance devices",
    category: "Devices",
    description: "Accept punches from biometric or badge terminals (ZKTeco, eSSL, Matrix via middleware) as attendance logs.",
    fields: [
        { key: "token", label: "Device token", type: "secret", scope: "credentials", required: true, help: "Devices send Authorization: Bearer <token>." },
        { key: "timeZoneNote", label: "Notes", type: "text", scope: "config", help: "Timestamps must be ISO 8601 with offset, e.g. 2026-10-19T09:02:00+05:30." },
    ],
    supportedEvents: [],
    defaultEvents: [],
    inbound: true,
    async verify(req, ctx) {
        return safeEqual(bearer(req.headers), ctx.credentials.token);
    },
    async receive(req) {
        // { punches: [{ email | employeeId, timestamp, direction?: IN|OUT|AUTO, deviceId? }] } or a single punch.
        const body = JSON.parse(req.rawBody || "{}");
        const punches: any[] = Array.isArray(body.punches) ? body.punches : [body];
        const commands: DomainCommand[] = punches
            .filter(p => (p.email || p.employeeId) && p.timestamp)
            .map(p => ({
                kind: "attendance.punch",
                email: p.email,
                employeeId: p.employeeId != null ? String(p.employeeId) : undefined,
                timestamp: p.timestamp,
                direction: ["IN", "OUT"].includes(String(p.direction).toUpperCase()) ? String(p.direction).toUpperCase() as "IN" | "OUT" : "AUTO",
                deviceId: p.deviceId,
            }));
        return { deliveryId: body.batchId, commands };
    },
};

/** Holds the bearer token for /api/scim/v2. Identity providers (Okta, Entra ID) provision users there. */
export const scimConnector: Connector = {
    provider: "scim",
    name: "SCIM provisioning",
    category: "Identity",
    description: "Let Okta, Microsoft Entra ID or Google create, update and deactivate DeltaPro users automatically.",
    fields: [
        { key: "token", label: "SCIM bearer token", type: "secret", scope: "credentials", required: true, help: "Paste the same token into your identity provider. Base URL: /api/scim/v2" },
    ],
    supportedEvents: [],
    defaultEvents: [],
};
