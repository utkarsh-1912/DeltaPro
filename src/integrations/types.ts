import type { DomainEvent, EventType } from "./events";

export type FieldDef = {
    key: string;
    label: string;
    type: "text" | "secret" | "url" | "select" | "boolean" | "textarea" | "number";
    /** config is stored as plain JSON; credentials are encrypted at rest and never returned to the browser. */
    scope: "config" | "credentials";
    required?: boolean;
    help?: string;
    placeholder?: string;
    options?: { value: string; label: string }[];
    default?: string | boolean | number;
};

export type DeliveryResult =
    | { ok: true; externalId?: string; skipped?: boolean; note?: string }
    | { ok: false; retryable: boolean; error: string; retryAfterMs?: number };

export interface ConnectorContext<Config = Record<string, any>> {
    integration: { id: string; name: string; provider: string; config: Config; lastSyncAt: Date | null };
    credentials: Record<string, any>;
    saveCredentials(patch: Record<string, any>): Promise<void>;
    links: {
        get(localType: string, localId: string): Promise<string | null>;
        set(localType: string, localId: string, externalId: string): Promise<void>;
        remove(localType: string, localId: string): Promise<void>;
        findLocal(localType: string, externalId: string): Promise<string | null>;
        listByPrefix(localType: string, localIdPrefix: string): Promise<{ localId: string; externalId: string }[]>;
    };
    baseUrl: string;
}

/** Changes an inbound connector asks DeltaPro to make. Executed by commands.ts. */
export type DomainCommand =
    | { kind: "leave.decide"; requestId: string; status: "APPROVED" | "REJECTED"; actorEmail: string }
    | { kind: "regularization.decide"; requestId: string; status: "APPROVED" | "REJECTED"; actorEmail: string }
    | { kind: "task.set_status"; taskId?: string; taskKey?: string; status: "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE"; note?: string }
    | { kind: "task.comment"; taskId?: string; taskKey?: string; body: string; authorEmail?: string }
    | {
        kind: "user.upsert";
        email: string;
        name?: string;
        employeeId?: string;
        department?: string;
        designation?: string;
        phoneNumber?: string;
        managerEmail?: string;
        active?: boolean;
    }
    | { kind: "user.deactivate"; email: string }
    | { kind: "attendance.punch"; email?: string; employeeId?: string; timestamp: string; direction: "IN" | "OUT" | "AUTO"; deviceId?: string };

export type CommandResult = { kind: string; ok: boolean; message: string };

export type InboundRequest = { headers: Headers; rawBody: string; url: URL };

export type InboundResult = {
    /** Vendor delivery id for de-duplication. */
    deliveryId?: string;
    commands: DomainCommand[];
    /** Immediate HTTP response (e.g. a URL verification challenge). Commands are skipped when set. */
    response?: Response;
    /** Called after commands run, e.g. to update a Slack message. */
    onResult?(results: CommandResult[]): Promise<Response | void>;
};

export type OAuthSpec = {
    /** Whether the server has client id/secret configured for this provider. */
    available(): boolean;
    authorizeUrl(args: { redirectUri: string; state: string; config: Record<string, any> }): string;
    exchange(args: { code: string; redirectUri: string; config: Record<string, any> }): Promise<Record<string, any>>;
};

export type ConnectorCategory = "Messaging" | "Calendar" | "HR & payroll" | "Developer tools" | "Devices" | "Identity" | "Platform";

export interface Connector {
    provider: string;
    name: string;
    category: ConnectorCategory;
    description: string;
    fields: FieldDef[];
    /** Event types this connector can act on; "*" for any. Empty for inbound-only connectors. */
    supportedEvents: EventType[] | "*";
    defaultEvents: EventType[];
    /** Accepts calls on /api/hooks/{integrationId}. */
    inbound?: boolean;
    oauth?: OAuthSpec;
    handle?(event: DomainEvent, ctx: ConnectorContext): Promise<DeliveryResult>;
    verify?(req: InboundRequest, ctx: ConnectorContext): Promise<boolean>;
    receive?(req: InboundRequest, ctx: ConnectorContext): Promise<InboundResult>;
    /** Scheduled pull (HRIS directory sync). */
    pullSync?(ctx: ConnectorContext): Promise<{ commands: DomainCommand[]; note?: string }>;
    /** Lightweight credential check for the "Test" button. Defaults to sending an integration.test event. */
    healthCheck?(ctx: ConnectorContext): Promise<DeliveryResult>;
}
