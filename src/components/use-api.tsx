"use client";

import * as React from "react";
import Link from "next/link";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

export class ApiError extends Error {
  constructor(public status: number, message: string, public details?: any) {
    super(message);
  }
}

/** fetch() for the DeltaPro API: JSON in and out, throws ApiError with the server's message. */
export async function api<T = any>(url: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...rest } = init;
  const res = await fetch(url, {
    ...rest,
    headers: json !== undefined ? { "Content-Type": "application/json", ...(rest.headers ?? {}) } : rest.headers,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error || `Request failed (${res.status})`, data.details);
  return data as T;
}

/** Loads a URL and exposes { data, error, loading, reload }. Pass null to skip. */
export function useApi<T = any>(url: string | null) {
  const [state, setState] = React.useState<{ data: T | null; error: ApiError | null; loading: boolean }>({ data: null, error: null, loading: !!url });
  const load = React.useCallback(async () => {
    if (!url) return;
    setState(s => ({ ...s, loading: true }));
    try {
      setState({ data: await api<T>(url), error: null, loading: false });
    } catch (e) {
      setState({ data: null, error: e instanceof ApiError ? e : new ApiError(0, String(e)), loading: false });
    }
  }, [url]);
  React.useEffect(() => {
    load();
  }, [load]);
  return { ...state, reload: load };
}

/** Shown when the API answers 402: the feature is not in the organization's plan. */
export function UpgradeNotice({ error, isAdmin }: { error: ApiError; isAdmin?: boolean }) {
  return (
    <div className="grain relative overflow-hidden rounded-2xl bg-[hsl(228_45%_6%)] p-10 text-[hsl(225_38%_95%)]">
      <Lock className="h-5 w-5 text-signal" />
      <h2 className="mt-6 max-w-xl text-3xl font-semibold leading-tight tracking-tight">Not in your current plan</h2>
      <p className="mt-3 max-w-xl text-white/60">{error.message}</p>
      {isAdmin ? (
        <Button asChild className="mt-6 rounded-full bg-white text-[hsl(228_45%_8%)] hover:bg-white/90">
          <Link href="/organization">Compare plans</Link>
        </Button>
      ) : (
        <p className="mt-6 font-mono-label text-white/40">Ask an admin to upgrade.</p>
      )}
    </div>
  );
}

export const inr = (n: number | null | undefined, currency = "INR") =>
  n == null ? "—" : new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
