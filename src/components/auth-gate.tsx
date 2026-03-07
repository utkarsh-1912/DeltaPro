"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useSession } from "next-auth/react";

const PUBLIC_PATHS = ["/", "/login", "/signup", "/about", "/contact", "/terms"];

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === "unauthenticated") {
      // Allow access to public pages
      if (!PUBLIC_PATHS.includes(pathname)) {
        router.replace(`/login?redirect=${pathname}`);
      }
    }
  }, [status, router, pathname]);

  if (status === "loading" && !PUBLIC_PATHS.includes(pathname)) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-primary"></div>
          <p className="text-muted-foreground">Authenticating...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
