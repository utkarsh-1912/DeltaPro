"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HalftoneField } from "@/components/motion";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="relative flex min-h-[80vh] items-center overflow-hidden">
      <HalftoneField className="[--hx:15%] [--hy:50%]" />
      <div className="container relative mx-auto max-w-3xl px-5 sm:px-8">
        <p className="font-mono-label text-destructive">Something went wrong</p>
        <h1 className="mt-4 text-5xl font-semibold leading-[0.95] sm:text-7xl">An unexpected error occurred.</h1>
        <p className="mt-6 max-w-lg text-muted-foreground">
          Try again, or return home. If the problem persists, please contact support.
        </p>
        <pre className="mt-6 overflow-x-auto rounded-xl border bg-card p-4 font-mono text-xs text-muted-foreground">
          {error.message || "No error message provided."}
        </pre>
        <div className="mt-8 flex gap-3">
          <Button size="lg" className="rounded-full" onClick={() => reset()}>
            <RotateCcw className="h-4 w-4" /> Try again
          </Button>
          <Button size="lg" variant="outline" className="rounded-full" asChild>
            <Link href="/">Go home</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
