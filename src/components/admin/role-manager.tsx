"use client";

import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useRotaStore, useRotaStoreActions } from "@/lib/store";
import type { User, UserProfile } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader } from "lucide-react";

// This is a mocked function. In a real scenario, this would
// make an API call to a backend that reads the Google Sheet.
async function syncRolesFromSheet(): Promise<Record<string, 'admin' | 'pm' | 'hr' | 'user'>> {
  console.log("Simulating a fetch from Google Sheets...");
  // Example data that would come from your spreadsheet
  return new Promise(resolve => {
    setTimeout(() => {
      resolve({
        "admin@rotapro.com": "admin",
        "pm@rotapro.com": "pm",
        "hr@rotapro.com": "hr",
        // ... any other roles defined in your sheet
      });
    }, 1000);
  });
}


export function RoleManager() {
  const { users } = useRotaStore();
  const { toast } = useToast();
  const [userRoles, setUserRoles] = React.useState<Record<string, UserProfile['role']>>({});
  const [isLoading, setIsLoading] = React.useState(false);

  React.useEffect(() => {
    const roles: Record<string, UserProfile['role']> = {};
    users.forEach(user => {
      roles[user.id] = (user.role?.toLowerCase() as UserProfile['role']) || 'user';
    });
    setUserRoles(roles);
  }, [users]);

  const handleSync = async () => {
    setIsLoading(true);
    toast({ title: "Syncing Roles...", description: "Fetching the latest roles from the spreadsheet." });

    try {
      const sheetRoles = await syncRolesFromSheet();
      const updatedRoles: Record<string, UserProfile['role']> = { ...userRoles };
      let changes = 0;

      users.forEach(user => {
        const sheetRole = user.email ? sheetRoles[user.email.toLowerCase()] : undefined;
        if (sheetRole && updatedRoles[user.id] !== sheetRole) {
          updatedRoles[user.id] = sheetRole;
          // Here you would also call the function to update Prisma/DB
          // await updateUserRoleInDb(user.id, sheetRole);
          changes++;
        }
      });

      setUserRoles(updatedRoles);
      toast({ title: "Sync Complete", description: `${changes} role(s) were updated from the sheet.` });
    } catch (error) {
      console.error("Failed to sync with Google Sheet:", error);
      toast({ variant: "destructive", title: "Sync Failed", description: "Could not fetch data from the spreadsheet." });
    } finally {
      setIsLoading(false);
    }
  }


  const handleRoleChange = async (userId: string, newRole: UserProfile['role']) => {
    try {
      // Simulate API call to Prisma update
      await new Promise(r => setTimeout(r, 500));
      setUserRoles(prev => ({ ...prev, [userId]: newRole }));
      toast({
        title: "Role Updated",
        description: `The user's role has been changed to ${newRole}.`,
      });
    } catch (error) {
      console.error("Role update error:", error);
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: "Could not update the user's role.",
      });
    }
  };


  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Role Management</CardTitle>
          <CardDescription>
            Assign roles to users. Roles determine access permissions across the app.
          </CardDescription>
        </div>
        <Button onClick={handleSync} disabled={isLoading}>
          {isLoading && <Loader className="mr-2 animate-spin" />}
          Sync from Sheet
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="w-48">Role</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.name}</TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>
                  <Select
                    value={userRoles[user.id] || 'user'}
                    onValueChange={(newRole: UserProfile['role']) => handleRoleChange(user.id, newRole)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="pm">Project Manager</SelectItem>
                      <SelectItem value="hr">HR</SelectItem>
                      <SelectItem value="user">User</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            ))}
            {users.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground h-24">
                  No users found in the system.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
