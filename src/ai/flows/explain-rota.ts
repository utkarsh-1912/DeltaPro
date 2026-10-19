import { z } from "genkit";
import { ai } from "@/ai/genkit";

const InputSchema = z.object({
    team: z.string(),
    period: z.string(),
    rules: z.array(z.string()),
    shifts: z.array(z.object({ name: z.string(), time: z.string(), extreme: z.boolean(), min: z.number(), max: z.number() })),
    assignments: z.array(z.object({ member: z.string(), shift: z.string().nullable(), previousShift: z.string().nullable(), onLeave: z.boolean() })),
});

const OutputSchema = z.object({
    summary: z.string().describe("Two or three sentences on how the rota was balanced."),
    perMember: z.array(z.object({ member: z.string(), reason: z.string() })).describe("One short reason per member."),
    risks: z.array(z.string()).describe("Understaffed shifts, consecutive extreme shifts, or other concerns. Empty if none."),
});

export type ExplainRotaInput = z.infer<typeof InputSchema>;
export type ExplainRotaOutput = z.infer<typeof OutputSchema>;

export const explainRotaFlow = ai.defineFlow(
    { name: "explainRota", inputSchema: InputSchema, outputSchema: OutputSchema },
    async input => {
        const { output } = await ai.generate({
            prompt: `You explain shift rotas to team members in plain language.
Team: ${input.team}. Period: ${input.period}.
Rules the generator follows:
${input.rules.map(r => `- ${r}`).join("\n")}
Shifts: ${JSON.stringify(input.shifts)}
Assignments (with each member's previous shift): ${JSON.stringify(input.assignments)}
Explain why each person got their shift, using only the rules and data above. Do not invent rules.`,
            output: { schema: OutputSchema },
        });
        if (!output) throw new Error("The model returned no explanation.");
        return output;
    },
);
