import { z } from "zod";
import { parseBody, publicRoute } from "@/lib/api";
import { PASSWORD_MIN_LENGTH } from "@/lib/password";
import { completePasswordReset, requestPasswordReset } from "@/services/accounts";

export const dynamic = "force-dynamic";

const requestSchema = z.object({ email: z.string().email().transform(e => e.toLowerCase().trim()) });
const confirmSchema = z.object({ token: z.string().min(20), password: z.string().min(PASSWORD_MIN_LENGTH).max(200) });

/** Step 1: email a one-hour reset link. Always answers 200 so emails can't be enumerated. */
export const POST = publicRoute(async ({ req }) => {
    const { email } = await parseBody(req, requestSchema);
    await requestPasswordReset(email);
    return { ok: true };
});

/** Step 2: set the new password with the emailed token. */
export const PUT = publicRoute(async ({ req }) => {
    const { token, password } = await parseBody(req, confirmSchema);
    await completePasswordReset(token, password);
    return { ok: true };
});
