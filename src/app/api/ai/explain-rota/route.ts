import { z } from "zod";
import { format, parseISO } from "date-fns";
import { HttpError, parseBody, route } from "@/lib/api";
import { explainRotaInput } from "@/services/rota";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const RULES = [
    "Members with a fixed shift always get that shift.",
    "Other members move forward through shifts in sequence order.",
    "Nobody works two extreme shifts in a row.",
    "A member stays on an extreme shift at most 1 period and a normal shift at most 2 periods in a row.",
    "Each shift is filled up to its maximum team size; shifts below their minimum are topped up afterwards.",
    "Members on leave at the start of the period are not assigned.",
];

const schema = z.object({ generationId: z.string() });

/** Plain-language explanation of a generated rota using Gemini (Genkit). Needs GEMINI_API_KEY or GOOGLE_API_KEY. */
export const POST = route(async ({ req }) => {
    if (!process.env.GEMINI_API_KEY && !process.env.GOOGLE_API_KEY && !process.env.GOOGLE_GENAI_API_KEY) {
        throw new HttpError(503, "AI explanations are off. Set GEMINI_API_KEY on the server to turn them on.");
    }
    const { generationId } = await parseBody(req, schema);
    const input = await explainRotaInput(generationId);
    if (!input) throw new HttpError(404, "Rota not found.");
    const { gen, previous, data, shifts } = input;
    const shiftName = new Map<string, string>(shifts.map((s: { id: string; name: string }) => [s.id, s.name]));
    const prevAssignments = (previous?.assignments ?? {}) as Record<string, string | null>;

    const { explainRotaFlow } = await import("@/ai/flows/explain-rota");
    return explainRotaFlow({
        team: data.team?.name ?? "Team",
        period: `${format(parseISO(gen.startDate), "d MMM yyyy")} – ${format(parseISO(gen.endDate), "d MMM yyyy")}`,
        rules: RULES,
        shifts: shifts.map(s => ({ name: s.name, time: `${s.startTime}–${s.endTime}`, extreme: s.isExtreme, min: s.minTeam, max: s.maxTeam })),
        assignments: data.assignments.map(a => ({
            member: a.name,
            shift: a.shift?.name ?? null,
            previousShift: prevAssignments[a.memberId] ? shiftName.get(prevAssignments[a.memberId]!) ?? null : null,
            onLeave: !a.shift,
        })),
    });
});
