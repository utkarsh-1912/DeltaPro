
"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useRotaStore, useRotaStoreActions } from "@/lib/store";
import { useAuthStore } from "@/lib/auth-store";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, CheckCircle, LogIn, LogOut, MapPin, Home } from "lucide-react";
import { getDistance } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

type GeolocationState = {
    loading: boolean;
    error: GeolocationPositionError | null;
    position: GeolocationPosition | null;
};

export default function AttendancePage() {
    const { user } = useAuthStore();
    const { geolocation: geoConfig, attendance } = useRotaStore();
    const { logAttendance } = useRotaStoreActions();
    const { toast } = useToast();

    const [isWfh, setIsWfh] = useState(false);
    const [locationState, setLocationState] = useState<GeolocationState>({
        loading: true,
        error: null,
        position: null,
    });
    
    // Ref to track if user has manually interacted with the toggle
    const hasManuallyToggled = useRef(false);

    const activeLog = attendance.find(log => log.userId === user?.uid && !log.logoutTime);
    const userAttendanceHistory = attendance
        .filter(log => log.userId === user?.uid)
        .sort((a,b) => parseISO(b.loginTime).getTime() - parseISO(a.loginTime).getTime());

    const distance = locationState.position
        ? getDistance(
            locationState.position.coords.latitude,
            locationState.position.coords.longitude,
            geoConfig.officeLatitude,
            geoConfig.officeLongitude
        )
        : null;

    const isInRange = distance !== null && distance <= geoConfig.radius;
    const canClockIn = isInRange || isWfh;
    const canClockOut = activeLog ? (activeLog.isWfh ? true : isInRange) : false;


    useEffect(() => {
        if (isWfh) {
            setLocationState(prev => ({ ...prev, loading: false, error: null }));
            return;
        }

        if (!navigator.geolocation) {
            setLocationState({ loading: false, error: { code: 0, message: "Geolocation is not supported by this browser.", PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 }, position: null });
            return;
        }
        
        setLocationState(prev => ({...prev, loading: true }));
        const watchId = navigator.geolocation.watchPosition(
            (pos) => setLocationState({ loading: false, error: null, position: pos }),
            (err) => setLocationState({ loading: false, error: err, position: null }),
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
        );

        return () => navigator.geolocation.clearWatch(watchId);
    }, [isWfh]);

    // Automatically toggle WFH if out of range
    useEffect(() => {
        // Only run if location is determined, user is not clocked in, and hasn't manually toggled
        if (distance !== null && !isInRange && !activeLog && !hasManuallyToggled.current) {
            setIsWfh(true);
        }
    }, [distance, isInRange, activeLog]);

    const handleWfhToggle = (checked: boolean) => {
        setIsWfh(checked);
        // Record that the user has manually changed the toggle
        hasManuallyToggled.current = true;
    }

    const handleClockAction = () => {
        if (!isWfh && !locationState.position) {
            toast({
                variant: "destructive",
                title: "Location Error",
                description: "Could not determine your location.",
            });
            return;
        }
        
        const locationData = isWfh ? undefined : {
            latitude: locationState.position!.coords.latitude,
            longitude: locationState.position!.coords.longitude,
        };
        
        logAttendance(user!.uid, locationData, isWfh);
        
        // Reset manual toggle state after action
        hasManuallyToggled.current = false;
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="p-4 sm:p-6 space-y-6"
        >
            <Card>
                <CardHeader>
                    <CardTitle>Attendance</CardTitle>
                    <CardDescription>Clock in or out for your shift. Your location must be within {geoConfig.radius} meters of the office, or select "Work from Home".</CardDescription>
                </CardHeader>
                <CardContent className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                        <h3 className="font-semibold">Your Status</h3>
                         <Card className="bg-muted/50">
                            <CardContent className="p-6 space-y-4">
                                {!activeLog && (
                                     <div className="flex items-center space-x-2">
                                        <Switch id="wfh-toggle" checked={isWfh} onCheckedChange={handleWfhToggle} />
                                        <Label htmlFor="wfh-toggle" className="flex items-center gap-2"><Home />Work from Home</Label>
                                    </div>
                                )}
                                {locationState.loading && !isWfh && <Skeleton className="h-10 w-full" />}
                                {locationState.error && !isWfh && (
                                    <Alert variant="destructive">
                                        <AlertTriangle className="h-4 w-4" />
                                        <AlertTitle>Location Error</AlertTitle>
                                        <AlertDescription>{locationState.error.message}</AlertDescription>
                                    </Alert>
                                )}
                                {locationState.position && distance !== null && !isWfh && (
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <MapPin className="h-5 w-5 text-muted-foreground" />
                                            <span>Distance from office:</span>
                                        </div>
                                        <span className={`font-bold ${isInRange ? "text-green-600" : "text-destructive"}`}>
                                            {distance.toFixed(0)} meters
                                        </span>
                                    </div>
                                )}
                                 <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        {(isInRange || isWfh) ? <CheckCircle className="h-5 w-5 text-green-600" /> : <AlertTriangle className="h-5 w-5 text-destructive" />}
                                        <span>Clock-in Status:</span>
                                    </div>
                                    <Badge variant={(isInRange || isWfh) ? "default" : "destructive"}>
                                        {isWfh ? "WFH Active" : (isInRange ? "In Range" : "Out of Range")}
                                    </Badge>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                     <div className="space-y-4">
                        <h3 className="font-semibold">Your Action</h3>
                        <Card className="h-full flex flex-col justify-center">
                            <CardContent className="p-6 text-center">
                                {activeLog ? (
                                    <div className="space-y-2">
                                        <p>You clocked in at:</p>
                                        <p className="font-semibold text-lg">{format(parseISO(activeLog.loginTime), 'PPpp')}</p>
                                        {activeLog.isWfh && <Badge variant="secondary" className="mt-1"><Home className="mr-1.5"/>Work from Home</Badge>}
                                        <Button size="lg" className="w-full mt-4" onClick={handleClockAction} disabled={!canClockOut}>
                                            <LogOut className="mr-2" /> Clock Out
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <p>You are currently clocked out.</p>
                                        <Button size="lg" className="w-full mt-4" onClick={handleClockAction} disabled={!canClockIn}>
                                            <LogIn className="mr-2" /> Clock In
                                        </Button>
                                    </div>
                                )}
                                 {!(activeLog ? canClockOut : canClockIn) && <p className="text-xs text-muted-foreground mt-2">You must be within the specified radius to clock in or out.</p>}
                            </CardContent>
                        </Card>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Your Attendance History</CardTitle>
                    <CardDescription>A log of your recent clock-in and clock-out times.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="rounded-lg border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Clock In Time</TableHead>
                                    <TableHead>Clock Out Time</TableHead>
                                    <TableHead>Type</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {userAttendanceHistory.length > 0 ? (
                                    userAttendanceHistory.map(log => (
                                        <TableRow key={log.id}>
                                            <TableCell>{format(parseISO(log.loginTime), 'PPpp')}</TableCell>
                                            <TableCell>{log.logoutTime ? format(parseISO(log.logoutTime), 'PPpp') : <Badge variant="secondary">Still Clocked In</Badge>}</TableCell>
                                            <TableCell>{log.isWfh ? <Badge>WFH</Badge> : <Badge variant="outline">Office</Badge>}</TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">No attendance history found.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

        </motion.div>
    );
}
