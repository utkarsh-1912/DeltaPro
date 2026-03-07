import NextAuth from "next-auth"
import { authConfig } from "./auth.config"

export default NextAuth(authConfig).auth((req) => {
    const isLoggedIn = !!req.auth;
    const { nextUrl } = req;
    const isAuthPage = nextUrl.pathname.startsWith('/login') || nextUrl.pathname.startsWith('/signup');
    const isApiRoute = nextUrl.pathname.startsWith('/api') && !nextUrl.pathname.startsWith('/api/auth');

    // Let API handlers manage their own role-based checks for finer control,
    // but ensure they are logged in if accessing protected API routes.
    if (isApiRoute) {
        if (!isLoggedIn) {
            return Response.json({ error: "Unauthorized" }, { status: 401 });
        }
        return null; // let the API route handle the rest
    }

    // Handle frontend routes
    const isPublicPage = nextUrl.pathname === '/' || nextUrl.pathname.startsWith('/api/auth');

    if (isAuthPage) {
        if (isLoggedIn) {
            return Response.redirect(new URL('/dashboard', nextUrl));
        }
        return null;
    }

    if (!isLoggedIn && !isPublicPage) {
        let from = nextUrl.pathname;
        if (nextUrl.search) {
            from += nextUrl.search;
        }
        return Response.redirect(new URL(`/login?from=${encodeURIComponent(from)}`, nextUrl));
    }

    return null;
})

export const config = {
    matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico).*)'],
}
