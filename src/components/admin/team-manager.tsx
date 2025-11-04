
"use client";

import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useRotaStore, useRotaStoreActions } from "@/lib/store";
import type { TeamMember } from "@/lib/types";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const memberSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters long."),
  teamId: z.string().optional(),
  fixedShiftId: z.string().optional(),
});

function MemberForm({ member, setOpen }: { member?: TeamMember; setOpen: (open: boolean) => void }) {
  const { addTeamMember, updateTeamMember } = useRotaStoreActions();
  const { shifts, teams } = useRotaStore(state => ({ shifts: state.shifts, teams: state.teams }));
  const { toast } = useToast();
  const isEditMode = !!member;

  const form = useForm<z.infer<typeof memberSchema>>({
    resolver: zodResolver(memberSchema),
    defaultValues: {
      name: member?.name || "",
      teamId: member?.teamId || "",
      fixedShiftId: member?.fixedShiftId || "",
    },
  });

  function onSubmit(values: z.infer<typeof memberSchema>) {
    const teamId = values.teamId === "none" ? undefined : values.teamId;
    const fixedShiftId = values.fixedShiftId === "none" ? undefined : values.fixedShiftId;

    if (isEditMode && member) {
      updateTeamMember(member.id, { name: values.name, teamId, fixedShiftId });
      toast({
        title: "Member Updated",
        description: `${values.name}'s details have been updated.`,
      });
    } else {
      addTeamMember(values.name, teamId, fixedShiftId);
      toast({
        title: "Member Added",
        description: `${values.name} has been added to the team.`,
      });
    }
    setOpen(false);
    form.reset();
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <DialogHeader>
          <DialogTitle>{isEditMode ? "Edit Member" : "Add New Member"}</DialogTitle>
          <DialogDescription>
            {isEditMode ? "Update the details for this member." : "Enter the details for the new member."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Full Name</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. John Doe" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="teamId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Team</FormLabel>
                 <Select onValueChange={field.onChange} defaultValue={field.value || ""}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Assign to a team" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="none">No team</SelectItem>
                    {teams.map(team => (
                      <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
           <FormField
            control={form.control}
            name="fixedShiftId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Fixed Shift (Optional)</FormLabel>
                 <Select onValueChange={field.onChange} defaultValue={field.value || ""}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="No fixed shift" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="none">No fixed shift</SelectItem>
                    {shifts.map(shift => (
                      <SelectItem key={shift.id} value={shift.id}>{shift.name}</SelectItem>
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
          <Button type="submit">{isEditMode ? "Save Changes" : "Add Member"}</Button>
        </DialogFooter>
      </form>
    </Form>
  );
}

export function TeamManager() {
  const { teamMembers, shifts, teams } = useRotaStore(state => state);
  const { deleteTeamMember } = useRotaStoreActions();
  const { toast } = useToast();
  const [dialogs, setDialogs] = React.useState<{[key: string]: boolean}>({});

  const setDialogOpen = (id: string, open: boolean) => {
    setDialogs(prev => ({...prev, [id]: open}));
  };

  const handleDelete = (member: TeamMember) => {
    deleteTeamMember(member.id);
    toast({
      variant: "destructive",
      title: "Member Deleted",
      description: `${member.name} has been removed.`,
    });
  };

  const shiftMap = new Map(shifts.map(s => [s.id, s.name]));
  const teamMap = new Map(teams.map(t => [t.id, t.name]));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Member Management</CardTitle>
          <CardDescription>
            Add, edit, or remove members and assign them to teams.
          </CardDescription>
        </div>
        <Dialog open={dialogs['new']} onOpenChange={(open) => setDialogOpen('new', open)}>
          <DialogTrigger asChild>
            <Button><Plus /> Add Member</Button>
          </DialogTrigger>
          <DialogContent>
            <MemberForm setOpen={(open) => setDialogOpen('new', open)} />
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Team</TableHead>
              <TableHead>Fixed Shift</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {teamMembers.map((member) => (
              <TableRow key={member.id}>
                <TableCell className="font-medium">{member.name}</TableCell>
                <TableCell>{member.teamId ? teamMap.get(member.teamId) : "None"}</TableCell>
                <TableCell>{member.fixedShiftId ? shiftMap.get(member.fixedShiftId) : "None"}</TableCell>
                <TableCell className="text-right">
                  <Dialog open={dialogs[member.id]} onOpenChange={(open) => setDialogOpen(member.id, open)}>
                    <DialogTrigger asChild>
                       <Button variant="ghost" size="icon">
                        <Pencil className="h-4 w-4" />
                        <span className="sr-only">Edit Member</span>
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <MemberForm member={member} setOpen={(open) => setDialogOpen(member.id, open)} />
                    </DialogContent>
                  </Dialog>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Delete Member</span>
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. This will permanently delete {member.name} and remove them from all rotas.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(member)}>
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TableCell>
              </TableRow>
            ))}
            {teamMembers.length === 0 && (
                <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                        No members found.
                    </TableCell>
                </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
