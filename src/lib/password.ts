import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb) as (password: string, salt: Buffer, keylen: number, options: { N: number; r: number; p: number; maxmem: number }) => Promise<Buffer>;

const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 64;

/** Hashes a password as `scrypt$N$r$p$salt$hash` (base64 parts). */
export async function hashPassword(password: string): Promise<string> {
    const salt = randomBytes(16);
    const hash = await scrypt(password, salt, KEYLEN, { N, r: R, p: P, maxmem: 64 * 1024 * 1024 });
    return ["scrypt", N, R, P, salt.toString("base64"), hash.toString("base64")].join("$");
}

export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
    if (!stored) return false;
    const [algo, n, r, p, saltB64, hashB64] = stored.split("$");
    if (algo !== "scrypt" || !saltB64 || !hashB64) return false;
    const expected = Buffer.from(hashB64, "base64");
    const actual = await scrypt(password, Buffer.from(saltB64, "base64"), expected.length, {
        N: Number(n), r: Number(r), p: Number(p), maxmem: 64 * 1024 * 1024,
    });
    return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export const PASSWORD_MIN_LENGTH = 8;

/** Emails listed in AUTH_ADMIN_EMAILS (comma separated) become ADMIN on first sign-in. */
export function isBootstrapAdmin(email: string | null | undefined): boolean {
    if (!email) return false;
    const list = (process.env.AUTH_ADMIN_EMAILS || "").split(",").map(e => e.trim().toLowerCase()).filter(Boolean);
    return list.includes(email.toLowerCase());
}

/** Optional domain allow-list for sign-up and SSO, e.g. AUTH_ALLOWED_DOMAINS=acme.com,acme.in */
export function isAllowedDomain(email: string | null | undefined): boolean {
    const domains = (process.env.AUTH_ALLOWED_DOMAINS || "").split(",").map(d => d.trim().toLowerCase()).filter(Boolean);
    if (domains.length === 0) return true;
    const domain = email?.split("@")[1]?.toLowerCase();
    return !!domain && domains.includes(domain);
}
