
"use client";

import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useRotaStore, useRotaStoreActions } from "@/lib/store";
import type { Team } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { useAccessControl } from "@/hooks/use-access-control";

const teamSchema = z.object({
  name: z.string().min(2, "Team name must be at least 2 characters long."),
  pmId: z.string().optional(),
});

function TeamForm({ team, setOpen }: { team?: Team; setOpen: (open: boolean) => void }) {
  const { addTeam, updateTeam } = useRotaStoreActions();
  const { teamMembers } = useRotaStore();
  const { toast } = useToast();
  const isEditMode = !!team;
  
  const projectManagers = React.useMemo(() => 
    teamMembers.filter(m => m.email.endsWith('@pm.com') || m.email.endsWith('@admin.com'))
  , [teamMembers]);

  const form = useForm<z.infer<typeof teamSchema>>({
    resolver: zodResolver(teamSchema),
    defaultValues: {
      name: team?.name || "",
      pmId: team?.pmId || "",
    },
  });

  function onSubmit(values: z.infer<typeof teamSchema>) {
    if (isEditMode && team) {
      updateTeam(team.id, values.name, values.pmId);
      toast({
        title: "Team Updated",
        description: `The team has been updated.`,
      });
    } else {
      addTeam(values.name);
      toast({
        title: "Team Added",
        description: `The ${values.name} team has been created.`,
      });
    }
    setOpen(false);
    form.reset();
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <DialogHeader>
          <DialogTitle>{isEditMode ? "Edit Team" : "Add New Team"}</DialogTitle>
          <DialogDescription>
            {isEditMode ? "Update the details for this team." : "Enter a name for the new team."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Team Name</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Frontend Developers" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="pmId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Project Manager</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value || ""}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Assign a Project Manager" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="none">No PM</SelectItem>
                     {projectManagers.map(pm => (
                      <SelectItem key={pm.id} value={pm.id}>{pm.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="submit">{isEditMode ? "Save Changes" : "Add Team"}</Button>
        </DialogFooter>
      </form>
    </Form>
  );
}

export function TeamsManager() {
  const { teamMembers } = useRotaStore(state => ({ teamMembers: state.teamMembers }));
  const { deleteTeam } = useRotaStoreActions();
  const { toast } = useToast();
  const [dialogs, setDialogs] = React.useState<{ [key: string]: boolean }>({});
  const { accessibleTeams } = useAccessControl();

  const setDialogOpen = (id: string, open: boolean) => {
    setDialogs(prev => ({ ...prev, [id]: open }));
  };

  const handleDelete = (team: Team) => {
    deleteTeam(team.id);
    toast({
      variant: "destructive",
      title: "Team Deleted",
      description: `The ${team.name} team has been removed.`,
    });
  };
  
  const memberCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    accessibleTeams.forEach(t => counts[t.id] = 0);
    teamMembers.forEach(m => {
        if(m.teamId && counts[m.teamId] !== undefined) {
            counts[m.teamId]++;
        }
    });
    return counts;
  }, [accessibleTeams, teamMembers]);
  
  const pmMap = React.useMemo(() => new Map(teamMembers.map(m => [m.id, m.name])), [teamMembers]);


  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Teams Management</CardTitle>
          <CardDescription>
            Create and manage teams to organize your members.
          </CardDescription>
        </div>
        <Dialog open={dialogs['new']} onOpenChange={(open) => setDialogOpen('new', open)}>
          <DialogTrigger asChild>
            <Button><Plus /> Add Team</Button>
          </DialogTrigger>
          <DialogContent>
            <TeamForm setOpen={(open) => setDialogOpen('new', open)} />
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Members</TableHead>
              <TableHead>Project Manager</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {accessibleTeams.map((team) => (
              <TableRow key={team.id}>
                <TableCell className="font-medium">{team.name}</TableCell>
                <TableCell>{memberCounts[team.id] || 0}</TableCell>
                <TableCell>{team.pmId ? pmMap.get(team.pmId) : "N/A"}</TableCell>
                <TableCell className="text-right">
                  <Dialog open={dialogs[team.id]} onOpenChange={(open) => setDialogOpen(team.id, open)}>
                    <DialogTrigger asChild>
                       <Button variant="ghost" size="icon">
                        <Pencil className="h-4 w-4" />
                        <span className="sr-only">Edit Team</span>
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <TeamForm team={team} setOpen={(open) => setDialogOpen(team.id, open)} />
                    </DialogContent>
                  </Dialog>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Delete Team</span>
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. This will permanently delete the {team.name} team and unassign all its members.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(team)}>
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TableCell>
              </TableRow>
            ))}
            {accessibleTeams.length === 0 && (
                <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                        No teams found.
                    </TableCell>
                </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
