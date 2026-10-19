import type { Connector } from "./types";
import { webhookConnector } from "./connectors/webhook";
import { slackConnector } from "./connectors/slack";
import { teamsConnector } from "./connectors/teams";
import { emailConnector } from "./connectors/email";
import { googleCalendarConnector } from "./connectors/google-calendar";
import { outlookConnector } from "./connectors/outlook";
import { jiraConnector } from "./connectors/jira";
import { githubConnector } from "./connectors/github";
import { bambooHrConnector, hrisWebhookConnector } from "./connectors/hris";
import { deviceConnector, scimConnector } from "./connectors/inbound-only";
import { zohoPeopleConnector } from "./connectors/zoho";

export const CONNECTORS: Connector[] = [
    slackConnector,
    teamsConnector,
    emailConnector,
    googleCalendarConnector,
    outlookConnector,
    zohoPeopleConnector,
    hrisWebhookConnector,
    bambooHrConnector,
    jiraConnector,
    githubConnector,
    deviceConnector,
    scimConnector,
    webhookConnector,
];

const byProvider = new Map(CONNECTORS.map(c => [c.provider, c]));

export function getConnector(provider: string): Connector | undefined {
    return byProvider.get(provider);
}

/** What the admin UI needs to render the add/edit form. */
export function catalog() {
    return CONNECTORS.map(c => ({
        provider: c.provider,
        name: c.name,
        category: c.category,
        description: c.description,
        fields: c.fields,
        supportedEvents: c.supportedEvents,
        defaultEvents: c.defaultEvents,
        inbound: !!c.inbound,
        outbound: !!c.handle,
        pull: !!c.pullSync,
        oauth: c.oauth ? c.oauth.available() : false,
    }));
}

export function subscribes(connector: Connector, events: string[], type: string): boolean {
    if (!connector.handle) return false;
    const supported = connector.supportedEvents === "*" || (connector.supportedEvents as string[]).includes(type);
    return supported && (events.includes("*") || events.includes(type));
}
