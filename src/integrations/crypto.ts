import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

function key(): Buffer {
    const secret = process.env.INTEGRATIONS_ENCRYPTION_KEY || process.env.AUTH_SECRET;
    if (!secret) throw new Error("Set INTEGRATIONS_ENCRYPTION_KEY (or AUTH_SECRET) to store connector credentials.");
    return createHash("sha256").update(secret).digest();
}

/** AES-256-GCM, serialised as v1.<iv>.<tag>.<ciphertext> (base64url). */
export function encryptJson(value: unknown): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key(), iv);
    const enc = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
    return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), enc.toString("base64url")].join(".");
}

export function decryptJson<T = Record<string, any>>(payload: string | null | undefined): T {
    if (!payload) return {} as T;
    const [v, iv, tag, data] = payload.split(".");
    if (v !== "v1") throw new Error("Unknown credential format");
    const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    const dec = Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]);
    return JSON.parse(dec.toString("utf8"));
}

export function hmacHex(secret: string, data: string, algo: "sha256" | "sha1" = "sha256"): string {
    return createHmac(algo, secret).update(data).digest("hex");
}

export function safeEqual(a: string | null | undefined, b: string | null | undefined): boolean {
    if (!a || !b) return false;
    const ab = Buffer.from(a);
    const bb = Buffer.from(b);
    return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Short-lived signed token (used for OAuth state and password reset links). */
export function signToken(payload: Record<string, unknown>, ttlSeconds: number): string {
    const body = Buffer.from(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds })).toString("base64url");
    return `${body}.${hmacHex(process.env.AUTH_SECRET || "", body)}`;
}

export function verifyToken<T = Record<string, unknown>>(token: string | null | undefined): T | null {
    if (!token) return null;
    const [body, sig] = token.split(".");
    if (!body || !safeEqual(sig, hmacHex(process.env.AUTH_SECRET || "", body))) return null;
    const data = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (typeof data.exp !== "number" || data.exp < Date.now() / 1000) return null;
    return data as T;
}

export function maskSecret(value: unknown): string {
    if (typeof value !== "string" || value.length === 0) return "";
    return value.length <= 6 ? "••••" : `••••${value.slice(-4)}`;
}
