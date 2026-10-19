import NextAuth from "next-auth"
import { authConfig } from "./auth.config"

// Routes that authenticate callers themselves (signatures, bearer tokens) or are public.
const SELF_AUTHENTICATED_API = ["/api/auth", "/api/hooks", "/api/cron", "/api/scim"];
const PUBLIC_PAGES = ["/", "/about", "/contact", "/privacy", "/terms", "/forgot-password", "/reset-password"];
const AUTH_PAGES = ["/login", "/signup"];

export default NextAuth(authConfig).auth((req) => {
    const isLoggedIn = !!req.auth;
    const { nextUrl } = req;
    const path = nextUrl.pathname;

    if (path.startsWith("/api")) {
        if (SELF_AUTHENTICATED_API.some(p => path === p || path.startsWith(p + "/"))) return null;
        if (!isLoggedIn) return Response.json({ error: "Unauthorized" }, { status: 401 });
        return null; // handlers enforce roles
    }

    if (AUTH_PAGES.some(p => path.startsWith(p))) {
        return isLoggedIn ? Response.redirect(new URL('/dashboard', nextUrl)) : null;
    }

    if (!isLoggedIn && !PUBLIC_PAGES.includes(path)) {
        const from = path + (nextUrl.search || "");
        return Response.redirect(new URL(`/login?from=${encodeURIComponent(from)}`, nextUrl));
    }

    return null;
})

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg).*)'],
}
