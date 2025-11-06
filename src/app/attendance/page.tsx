
"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useRotaStore, useRotaStoreActions } from "@/lib/store";
import { useAuthStore } from "@/lib/auth-store";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, CheckCircle, LogIn, LogOut, MapPin, Home, Briefcase, AlarmWarning } from "lucide-react";
import { getDistance } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO, isToday, endOfDay } from "date-fns";

type GeolocationState = {
    loading: boolean;
    error: GeolocationPositionError | null;
    position: GeolocationPosition | null;
};

type AttendanceType = 'wfo' | 'wfh';

export default function AttendancePage() {
    const { user } = useAuthStore();
    const { geolocation: geoConfig, attendance } = useRotaStore();
    const { logAttendance } = useRotaStoreActions();
    const { toast } = useToast();

    const [attendanceType, setAttendanceType] = useState<AttendanceType>('wfh');
    const [locationState, setLocationState] = useState<GeolocationState>({
        loading: true,
        error: null,
        position: null,
    });

    const activeLog = attendance.find(log => log.userId === user?.uid && !log.logoutTime);
    const userAttendanceHistory = attendance
        .filter(log => log.userId === user?.uid)
        .sort((a,b) => parseISO(b.loginTime).getTime() - parseISO(a.loginTime).getTime());
    
    const isStaleSession = activeLog ? !isToday(parseISO(activeLog.loginTime)) : false;

    const distance = locationState.position
        ? getDistance(
            locationState.position.coords.latitude,
            locationState.position.coords.longitude,
            geoConfig.officeLatitude,
            geoConfig.officeLongitude
        )
        : null;

    const isInRange = distance !== null && distance <= geoConfig.radius;
    const isWfh = attendanceType === 'wfh';

    const canClockIn = !activeLog && !isStaleSession;
    const canClockOut = !!activeLog && !isStaleSession;

    useEffect(() => {
        if (!navigator.geolocation) {
            setLocationState({ loading: false, error: { code: 0, message: "Geolocation is not supported by this browser.", PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 }, position: null });
            setAttendanceType('wfh');
            return;
        }
        
        setLocationState(prev => ({...prev, loading: true }));
        const watchId = navigator.geolocation.watchPosition(
            (pos) => setLocationState({ loading: false, error: null, position: pos }),
            (err) => {
                setLocationState({ loading: false, error: err, position: null });
                setAttendanceType('wfh');
            },
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
        );

        return () => navigator.geolocation.clearWatch(watchId);
    }, []);

    useEffect(() => {
        if (locationState.loading) return;
        if (isInRange) {
            setAttendanceType('wfo');
        } else {
            setAttendanceType('wfh');
        }
    }, [isInRange, locationState.loading]);


    const handleClockAction = () => {
        if (attendanceType === 'wfo' && !locationState.position) {
            toast({
                variant: "destructive",
                title: "Location Error",
                description: "Could not determine your location for office clock-in.",
            });
            return;
        }
        
        const locationData = isWfh ? undefined : {
            latitude: locationState.position!.coords.latitude,
            longitude: locationState.position!.coords.longitude,
        };
        
        logAttendance(user!.uid, locationData, isWfh);
    };

    const handleForceClockOut = () => {
        if (!activeLog) return;
        const autoLogoutTime = endOfDay(parseISO(activeLog.loginTime)).toISOString();
        logAttendance(user!.uid, undefined, activeLog.isWfh || false, autoLogoutTime);
    }

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
                    <CardDescription>Clock in or out for your shift. Your status is automatically determined by your location relative to the office.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {isStaleSession && (
                        <Alert variant="destructive">
                            <AlarmWarning className="h-4 w-4" />
                            <AlertTitle>Action Required: Stale Session Detected</AlertTitle>
                            <AlertDescription className="flex items-center justify-between">
                                <div>
                                You forgot to clock out on {format(parseISO(activeLog!.loginTime), 'PPP')}. Please force a clock-out to continue.
                                </div>
                                <Button variant="destructive" onClick={handleForceClockOut}>Force Clock Out</Button>
                            </AlertDescription>
                        </Alert>
                    )}
                    <div className="grid md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <h3 className="font-semibold">Your Status</h3>
                            <Card className="bg-muted/50">
                                <CardContent className="p-6 space-y-4">
                                    {locationState.loading && <Skeleton className="h-10 w-full" />}
                                    {locationState.error && (
                                        <Alert variant="destructive">
                                            <AlertTriangle className="h-4 w-4" />
                                            <AlertTitle>Location Error</AlertTitle>
                                            <AlertDescription>{locationState.error.message}. Defaulting to Work From Home.</AlertDescription>
                                        </Alert>
                                    )}
                                    {distance !== null && !locationState.loading && (
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
                                            {isWfh ? <Home className="h-5 w-5 text-primary"/> : <Briefcase className="h-5 w-5 text-primary"/>}
                                            <span>Work Status:</span>
                                        </div>
                                        <Badge variant={isWfh ? "secondary" : "default"}>
                                            {isWfh ? "Work From Home" : "Work From Office"}
                                        </Badge>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                        <div className="space-y-4">
                            <h3 className="font-semibold">Your Action</h3>
                            <Card className="h-full flex flex-col justify-center">
                                <CardContent className="p-6 text-center">
                                    {activeLog && !isStaleSession ? (
                                        <div className="space-y-2">
                                            <p>You clocked in at:</p>
                                            <p className="font-semibold text-lg">{format(parseISO(activeLog.loginTime), 'PPpp')}</p>
                                            {activeLog.isWfh ? <Badge variant="secondary" className="mt-1"><Home className="mr-1.5"/>Work from Home</Badge> : <Badge className="mt-1"><Briefcase className="mr-1.5"/>Office</Badge>}
                                            <Button size="lg" className="w-full mt-4" onClick={handleClockAction} disabled={!canClockOut}>
                                                <LogOut className="mr-2" /> Clock Out
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            <p>You are currently clocked out.</p>
                                            <Button size="lg" className="w-full mt-4" onClick={handleClockAction} disabled={!canClockIn || locationState.loading}>
                                                <LogIn className="mr-2" /> Clock In as {isWfh ? "WFH" : "WFO"}
                                            </Button>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
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

    