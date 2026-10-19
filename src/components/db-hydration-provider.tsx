"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRotaStore } from "@/lib/store";
import { hydrateFromDB } from "@/lib/store";

/** Loads rota data into the store once a user is signed in; public pages render immediately. */
export function DBHydrationProvider({ children }: { children: React.ReactNode }) {
    const { status } = useSession();
    const [hydrated, setHydrated] = useState(false);

    useEffect(() => {
        if (status !== "authenticated" || hydrated) return;
        hydrateFromDB().then((data) => {
            if (data && Object.keys(data).length > 0) {
                useRotaStore.setState(data);
            }
            setHydrated(true);
        });
    }, [status, hydrated]);

    if (status === "authenticated" && !hydrated) {
        return (
            <div className="flex h-screen items-center justify-center bg-background">
                <div className="flex flex-col items-center gap-4">
                    <div className="h-10 w-10 animate-spin rounded-full border-2 border-border border-t-foreground" />
                    <p className="eyebrow">Loading your workspace</p>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}
