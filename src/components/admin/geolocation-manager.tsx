
"use client";

import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useRotaStore, useRotaStoreActions } from "@/lib/store";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MapPin, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const geolocationSchema = z.object({
    officeLatitude: z.coerce.number().min(-90, "Invalid latitude").max(90, "Invalid latitude"),
    officeLongitude: z.coerce.number().min(-180, "Invalid longitude").max(180, "Invalid longitude"),
    radius: z.coerce.number().min(1, "Radius must be at least 1 meter"),
});

export function GeolocationManager() {
    const { geolocation } = useRotaStore();
    const { setGeolocationConfig } = useRotaStoreActions();
    const { toast } = useToast();

    const form = useForm<z.infer<typeof geolocationSchema>>({
        resolver: zodResolver(geolocationSchema),
        defaultValues: geolocation,
    });
    
    React.useEffect(() => {
        form.reset(geolocation);
    }, [geolocation, form]);

    function onSubmit(values: z.infer<typeof geolocationSchema>) {
        setGeolocationConfig(values);
    }
    
    function setFromCurrentLocation() {
        if (!navigator.geolocation) {
            toast({
                variant: "destructive",
                title: "Geolocation Error",
                description: "Geolocation is not supported by your browser."
            });
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                form.setValue("officeLatitude", position.coords.latitude);
                form.setValue("officeLongitude", position.coords.longitude);
                toast({
                    title: "Location Set",
                    description: "Office location has been set to your current position."
                });
            },
            () => {
                toast({
                    variant: "destructive",
                    title: "Geolocation Error",
                    description: "Unable to retrieve your location. Please check your browser permissions."
                });
            }
        );
    }

  return (
    <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
            <Card>
                <CardHeader>
                    <CardTitle>Geolocation Settings</CardTitle>
                    <CardDescription>
                        Set the office coordinates and the allowed radius for attendance clock-ins.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                         <FormField
                            control={form.control}
                            name="officeLatitude"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Office Latitude</FormLabel>
                                    <FormControl>
                                        <Input type="number" step="any" placeholder="e.g. 51.5074" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                         <FormField
                            control={form.control}
                            name="officeLongitude"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Office Longitude</FormLabel>
                                    <FormControl>
                                        <Input type="number" step="any" placeholder="e.g. -0.1278" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                     </div>
                     <FormField
                        control={form.control}
                        name="radius"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Clock-in Radius (meters)</FormLabel>
                                <FormControl>
                                    <Input type="number" placeholder="e.g. 50" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </CardContent>
                <CardFooter className="flex justify-between">
                     <Button type="button" variant="outline" onClick={setFromCurrentLocation}>
                        <MapPin className="mr-2" />
                        Use My Current Location
                    </Button>
                    <Button type="submit">
                        <Save className="mr-2" />
                        Save Settings
                    </Button>
                </CardFooter>
            </Card>
        </form>
    </Form>
  );
}
