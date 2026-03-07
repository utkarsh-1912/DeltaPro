
"use client";

import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TeamManager } from "@/components/admin/team-manager";
import { ShiftManager } from "@/components/admin/shift-manager";
import { Users, Clock, Building, UserCog, MapPin } from "lucide-react";
import { TeamsManager } from "@/components/admin/teams-manager";
import { RoleManager } from "@/components/admin/role-manager";
import { GeolocationManager } from "@/components/admin/geolocation-manager";

export default function AdminPage() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Config Panel</CardTitle>
          <CardDescription>Manage your members, teams, shifts, and roles from one place.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="members">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="members"><Users className="mr-2 h-4 w-4" />Members</TabsTrigger>
              <TabsTrigger value="teams"><Building className="mr-2 h-4 w-4" />Teams</TabsTrigger>
              <TabsTrigger value="shifts"><Clock className="mr-2 h-4 w-4" />Shifts</TabsTrigger>
              <TabsTrigger value="roles"><UserCog className="mr-2 h-4 w-4" />Role Management</TabsTrigger>
              <TabsTrigger value="geolocation"><MapPin className="mr-2 h-4 w-4" />Geolocation</TabsTrigger>
            </TabsList>
            <TabsContent value="members" className="mt-6">
              <TeamManager />
            </TabsContent>
            <TabsContent value="teams" className="mt-6">
              <TeamsManager />
            </TabsContent>
            <TabsContent value="shifts" className="mt-6">
              <ShiftManager />
            </TabsContent>
            <TabsContent value="roles" className="mt-6">
              <RoleManager />
            </TabsContent>
            <TabsContent value="geolocation" className="mt-6">
              <GeolocationManager />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
