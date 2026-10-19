"use client";

import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Loader2, MapPin, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Mirrors AttendanceSettings; saved to /api/attendance/settings and enforced by the server.
const geolocationSchema = z.object({
    officeLat: z.coerce.number().min(-90, "Invalid latitude").max(90, "Invalid latitude"),
    officeLng: z.coerce.number().min(-180, "Invalid longitude").max(180, "Invalid longitude"),
    allowedRadius: z.coerce.number().int().min(10, "Radius must be at least 10 meters").max(50000),
    maxAccuracyMeters: z.coerce.number().int().min(5).max(5000),
    autoLogoutHours: z.coerce.number().int().min(1).max(24),
    geofencingEnabled: z.boolean(),
    wfhAllowed: z.boolean(),
    autoLogoutOutOfRange: z.boolean(),
});

type Values = z.infer<typeof geolocationSchema>;

const DEFAULTS: Values = {
    officeLat: 19.076, officeLng: 72.8777, allowedRadius: 500, maxAccuracyMeters: 200, autoLogoutHours: 12,
    geofencingEnabled: true, wfhAllowed: true, autoLogoutOutOfRange: true,
};

export function GeolocationManager() {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = React.useState(true);
    const [isSaving, setIsSaving] = React.useState(false);

    const form = useForm<Values>({ resolver: zodResolver(geolocationSchema), defaultValues: DEFAULTS });

    React.useEffect(() => {
        fetch("/api/attendance/settings")
            .then(r => (r.ok ? r.json() : null))
            .then(data => { if (data) form.reset({ ...DEFAULTS, ...data }); })
            .finally(() => setIsLoading(false));
    }, [form]);

    async function onSubmit(values: Values) {
        setIsSaving(true);
        try {
            const res = await fetch("/api/attendance/settings", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(values),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || "Could not save the settings.");
            form.reset({ ...DEFAULTS, ...data });
            toast({ title: "Settings saved", description: "Clock-ins are now checked against these values." });
        } catch (e) {
            toast({ variant: "destructive", title: "Settings not saved", description: e instanceof Error ? e.message : "Try again." });
        } finally {
            setIsSaving(false);
        }
    }

    function setFromCurrentLocation() {
        if (!navigator.geolocation) {
            toast({ variant: "destructive", title: "Geolocation Error", description: "Geolocation is not supported by your browser." });
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (position) => {
                form.setValue("officeLat", position.coords.latitude, { shouldDirty: true });
                form.setValue("officeLng", position.coords.longitude, { shouldDirty: true });
                toast({ title: "Location Set", description: `Office set to your position (±${Math.round(position.coords.accuracy)} m). Save to apply.` });
            },
            () => toast({ variant: "destructive", title: "Geolocation Error", description: "Unable to retrieve your location. Please check your browser permissions." }),
            { enableHighAccuracy: true },
        );
    }

    const numberField = (name: "officeLat" | "officeLng" | "allowedRadius" | "maxAccuracyMeters" | "autoLogoutHours", label: string, opts: { step?: string; description?: string } = {}) => (
        <FormField
            control={form.control}
            name={name}
            render={({ field }) => (
                <FormItem>
                    <FormLabel>{label}</FormLabel>
                    <FormControl><Input type="number" step={opts.step ?? "1"} {...field} /></FormControl>
                    {opts.description && <FormDescription>{opts.description}</FormDescription>}
                    <FormMessage />
                </FormItem>
            )}
        />
    );

    const switchField = (name: "geofencingEnabled" | "wfhAllowed" | "autoLogoutOutOfRange", label: string, description: string) => (
        <FormField
            control={form.control}
            name={name}
            render={({ field }) => (
                <FormItem className="flex items-center justify-between gap-4 rounded-lg border p-3">
                    <div className="space-y-0.5">
                        <FormLabel>{label}</FormLabel>
                        <FormDescription>{description}</FormDescription>
                    </div>
                    <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                </FormItem>
            )}
        />
    );

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
                <Card>
                    <CardHeader>
                        <CardTitle>Attendance &amp; Geofence</CardTitle>
                        <CardDescription>Office location, clock-in radius and automatic clock-out rules. The server enforces these on every clock-in.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {isLoading ? (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading settings…</div>
                        ) : (
                            <>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {numberField("officeLat", "Office latitude", { step: "any" })}
                                    {numberField("officeLng", "Office longitude", { step: "any" })}
                                    {numberField("allowedRadius", "Clock-in radius (m)")}
                                    {numberField("maxAccuracyMeters", "Worst GPS accuracy accepted (m)", { description: "Office clock-ins with a less accurate fix are refused." })}
                                    {numberField("autoLogoutHours", "Close sessions after (hours)", { description: "Open sessions are clocked out automatically after this long." })}
                                </div>
                                <div className="grid gap-3">
                                    {switchField("geofencingEnabled", "Require office location", "Office clock-ins must be inside the radius.")}
                                    {switchField("wfhAllowed", "Allow work from home", "People can clock in remotely without a location check.")}
                                    {switchField("autoLogoutOutOfRange", "Clock out when leaving the office", "Office sessions end automatically when the person leaves the radius.")}
                                </div>
                            </>
                        )}
                    </CardContent>
                    <CardFooter className="flex flex-wrap justify-between gap-2">
                        <Button type="button" variant="outline" onClick={setFromCurrentLocation}>
                            <MapPin className="mr-2 h-4 w-4" /> Use My Current Location
                        </Button>
                        <Button type="submit" disabled={isSaving || isLoading}>
                            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Save Settings
                        </Button>
                    </CardFooter>
                </Card>
            </form>
        </Form>
    );
}
