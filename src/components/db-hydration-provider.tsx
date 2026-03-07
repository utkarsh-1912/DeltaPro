"use client";

import { useEffect, useState } from "react";
import { useRotaStore } from "@/lib/store";
import { hydrateFromDB } from "@/lib/store";

export function DBHydrationProvider({ children }: { children: React.ReactNode }) {
    const [hydrated, setHydrated] = useState(false);

    useEffect(() => {
        hydrateFromDB().then((data) => {
            if (data && Object.keys(data).length > 0) {
                useRotaStore.setState(data);
            }
            setHydrated(true);
        });
    }, []);

    if (!hydrated) {
        return (
            <div className="flex items-center justify-center h-screen bg-background">
                <div className="flex flex-col items-center gap-4">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                    <p className="text-muted-foreground text-sm">Loading data...</p>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}
