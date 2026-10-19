"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";

type ProviderInfo = { id: string; name: string; type: string };

const LABELS: Record<string, string> = {
  google: "Continue with Google",
  "microsoft-entra-id": "Continue with Microsoft",
};

/** Renders a button per SSO provider the server has configured; nothing when none are. */
export function SsoButtons({ disabled }: { disabled?: boolean }) {
  const [providers, setProviders] = useState<ProviderInfo[]>([]);

  useEffect(() => {
    fetch("/api/auth/providers")
      .then(r => (r.ok ? r.json() : {}))
      .then((data: Record<string, ProviderInfo>) => setProviders(Object.values(data).filter(p => p.type !== "credentials")))
      .catch(() => setProviders([]));
  }, []);

  if (providers.length === 0) return null;

  const callbackUrl = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("from") || "/dashboard" : "/dashboard";

  return (
    <div className="mt-6 space-y-3">
      <div className="flex items-center gap-3 text-xs uppercase tracking-[0.12em] text-muted-foreground">
        <span className="h-px flex-1 bg-border" />or<span className="h-px flex-1 bg-border" />
      </div>
      {providers.map(p => (
        <Button key={p.id} type="button" variant="outline" size="lg" className="w-full h-11" disabled={disabled} onClick={() => signIn(p.id, { callbackUrl })}>
          {LABELS[p.id] ?? `Continue with ${p.name}`}
        </Button>
      ))}
    </div>
  );
}
