"use client";

import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TeamManager } from "@/components/admin/team-manager";
import { ShiftManager } from "@/components/admin/shift-manager";
import { Users, Clock, Building } from "lucide-react";
import { TeamsManager } from "@/components/admin/teams-manager";

export default function AdminPage() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="p-4 sm:p-6"
    >
      <Card>
        <CardHeader>
          <CardTitle>Config Panel</CardTitle>
          <CardDescription>Manage your members, teams, and shifts from one place.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="members">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="members"><Users className="mr-2 h-4 w-4" />Members</TabsTrigger>
              <TabsTrigger value="teams"><Building className="mr-2 h-4 w-4" />Teams</TabsTrigger>
              <TabsTrigger value="shifts"><Clock className="mr-2 h-4 w-4" />Shifts</TabsTrigger>
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
          </Tabs>
        </CardContent>
      </Card>
    </motion.div>
  );
}
