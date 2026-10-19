import { format, parseISO } from "date-fns";
import type { DomainEvent, PersonRef } from "./events";

export type Message = {
    title: string;
    text: string;
    link: string;
    facts: [string, string][];
    /** People the event is about or who must act on it. */
    recipients: string[];
    /** Set when the message can carry Approve / Reject buttons. */
    approval?: { kind: "leave" | "regularization"; requestId: string };
};

const who = (p?: PersonRef | null) => p?.name || p?.email || "Someone";
const emails = (...people: (PersonRef | null | undefined)[]) =>
    Array.from(new Set(people.map(p => p?.email).filter((e): e is string => !!e)));
const day = (iso?: string | null) => (iso ? format(parseISO(iso), "EEE d MMM yyyy") : "");
const time = (iso?: string | null) => (iso ? format(parseISO(iso), "HH:mm") : "");
const cap = (s?: string) => (s ? s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, " ") : "");

export function describe(event: DomainEvent, baseUrl: string): Message {
    const d = event.data ?? {};
    switch (event.type) {
        case "leave.requested":
        case "leave.approved":
        case "leave.rejected":
        case "leave.cancelled": {
            const r = d.request;
            const verb = { "leave.requested": "requested", "leave.approved": "approved", "leave.rejected": "rejected", "leave.cancelled": "cancelled" }[event.type];
            const range = r.startDate === r.endDate ? day(r.startDate) : `${day(r.startDate)} – ${day(r.endDate)}`;
            return {
                title: event.type === "leave.requested" ? `Leave request from ${who(d.user)}` : `Leave ${verb}: ${who(d.user)}`,
                text: `${cap(r.type)} leave, ${range} (${r.duration} day${r.duration === 1 ? "" : "s"})${r.reason ? `. Reason: ${r.reason}` : ""}`,
                link: `${baseUrl}/leave`,
                facts: [
                    ["Employee", who(d.user)],
                    ["Type", cap(r.type)],
                    ["Dates", range],
                    ["Days", String(r.duration)],
                    ...(d.approver ? ([["Decided by", who(d.approver)]] as [string, string][]) : []),
                ],
                recipients: event.type === "leave.requested" ? emails(...(d.managers ?? [])) : emails(d.user),
                approval: event.type === "leave.requested" ? { kind: "leave", requestId: r.id } : undefined,
            };
        }
        case "attendance.clocked_in":
        case "attendance.clocked_out":
            return {
                title: `${who(d.user)} clocked ${event.type.endsWith("in") ? "in" : "out"}`,
                text: `${d.log.isWfh ? "Working from home" : d.log.location ?? "Office"} at ${time(event.type.endsWith("in") ? d.log.loginTime : d.log.logoutTime)}`,
                link: `${baseUrl}/attendance`,
                facts: [["Employee", who(d.user)], ["Mode", d.log.isWfh ? "WFH" : "Office"]],
                recipients: [],
            };
        case "attendance.auto_logged_out":
            return {
                title: `${who(d.user)} was clocked out automatically`,
                text: d.log.reason === "OUT_OF_RANGE"
                    ? "They left the office geofence during an office session."
                    : `The session was open longer than the ${d.maxHours ?? 12} hour limit. Submit a regularisation if the time is wrong.`,
                link: `${baseUrl}/attendance`,
                facts: [["Clocked in", `${day(d.log.loginTime)} ${time(d.log.loginTime)}`], ["Clocked out", `${time(d.log.logoutTime)}`]],
                recipients: emails(d.user, d.manager),
            };
        case "attendance.regularization_requested":
            return {
                title: `Attendance correction from ${who(d.user)}`,
                text: `${cap(d.request.type)} on ${day(d.request.date)}. Reason: ${d.request.reason}`,
                link: `${baseUrl}/attendance`,
                facts: [["Employee", who(d.user)], ["Type", cap(d.request.type)], ["Date", day(d.request.date)]],
                recipients: emails(...(d.managers ?? [])),
                approval: { kind: "regularization", requestId: d.request.id },
            };
        case "attendance.regularization_decided":
            return {
                title: `Attendance correction ${d.request.status.toLowerCase()}`,
                text: `${cap(d.request.type)} on ${day(d.request.date)} was ${d.request.status.toLowerCase()} by ${who(d.approver)}.`,
                link: `${baseUrl}/attendance`,
                facts: [["Employee", who(d.user)], ["Status", cap(d.request.status)]],
                recipients: emails(d.user),
            };
        case "rota.published":
        case "rota.updated":
        case "rota.deleted": {
            const g = d.generation;
            const verb = event.type === "rota.published" ? "published" : event.type === "rota.updated" ? "updated" : "deleted";
            const lines = (d.assignments ?? [])
                .filter((a: any) => a.shift)
                .map((a: any) => `${a.name}: ${a.shift.name} (${a.shift.startTime}–${a.shift.endTime})`);
            return {
                title: `Rota ${verb} for ${d.team?.name ?? "team"}`,
                text: `${day(g.startDate)} – ${day(g.endDate)}${lines.length ? "\n" + lines.join("\n") : ""}`,
                link: `${baseUrl}/rota`,
                facts: [["Team", d.team?.name ?? ""], ["Period", `${day(g.startDate)} – ${day(g.endDate)}`]],
                recipients: event.type === "rota.deleted" ? [] : emails(...(d.assignments ?? []).map((a: any) => ({ id: a.memberId, name: a.name, email: a.email }))),
            };
        }
        case "task.created":
        case "task.updated":
        case "task.status_changed":
        case "task.commented": {
            const t = d.task;
            const title =
                event.type === "task.created" ? `New task ${t.key}: ${t.title}`
                    : event.type === "task.status_changed" ? `${t.key} moved to ${cap(t.status)}`
                        : event.type === "task.commented" ? `${who(d.comment?.author)} commented on ${t.key}`
                            : `${t.key} updated`;
            return {
                title,
                text: event.type === "task.commented" ? d.comment?.body ?? "" : t.title,
                link: `${baseUrl}/tasks`,
                facts: [["Project", t.projectName ?? ""], ["Status", cap(t.status)], ["Priority", cap(t.priority)], ["Assignee", who(d.assignee)]],
                recipients: event.type === "task.commented" ? emails(d.assignee, d.reporter).filter(e => e !== d.comment?.author?.email) : emails(d.assignee),
            };
        }
        case "user.created":
        case "user.updated":
        case "user.deactivated":
            return {
                title: event.type === "user.created" ? `Welcome to DeltaPro, ${who(d.user)}` : `${who(d.user)} was ${event.type === "user.updated" ? "updated" : "deactivated"}`,
                text: event.type === "user.created" ? `Your account (${d.user.email}) is ready. Sign in at ${baseUrl}/login.` : `${d.user.email}`,
                link: `${baseUrl}/employees`,
                facts: [["Email", d.user.email ?? ""], ["Role", cap(d.user.role)]],
                recipients: event.type === "user.created" ? emails(d.user) : [],
            };
        case "integration.test":
        default:
            return {
                title: "DeltaPro test message",
                text: d.message ?? "This integration is connected.",
                link: baseUrl,
                facts: [],
                recipients: d.recipient ? [d.recipient] : [],
            };
    }
}
