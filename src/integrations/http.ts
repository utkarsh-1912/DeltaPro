import type { DeliveryResult } from "./types";

export async function http(url: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<Response> {
    const { timeoutMs = 15000, ...rest } = init;
    return fetch(url, { ...rest, signal: AbortSignal.timeout(timeoutMs) });
}

export async function readBody(res: Response): Promise<any> {
    const text = await res.text();
    try {
        return text ? JSON.parse(text) : null;
    } catch {
        return text;
    }
}

/** Map a failed vendor response to a retry decision. 408, 429 and 5xx retry; other 4xx do not. */
export async function failure(res: Response, label: string): Promise<DeliveryResult> {
    const body = await readBody(res).catch(() => null);
    const detail = typeof body === "string" ? body : JSON.stringify(body);
    const retryAfter = Number(res.headers.get("retry-after"));
    return {
        ok: false,
        retryable: res.status === 408 || res.status === 429 || res.status >= 500,
        error: `${label}: HTTP ${res.status} ${detail?.slice(0, 500) ?? ""}`.trim(),
        retryAfterMs: Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : undefined,
    };
}

export function networkFailure(error: unknown, label: string): DeliveryResult {
    return { ok: false, retryable: true, error: `${label}: ${error instanceof Error ? error.message : String(error)}` };
}

export const skipped = (note: string): DeliveryResult => ({ ok: true, skipped: true, note });

export function basicAuth(user: string, pass: string) {
    return "Basic " + Buffer.from(`${user}:${pass}`).toString("base64");
}

export function appBaseUrl(): string {
    return (process.env.APP_URL || process.env.AUTH_URL || "http://localhost:9002").replace(/\/$/, "").replace(/\/api\/auth$/, "");
}
