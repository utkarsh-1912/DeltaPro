"use client";

import { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import { Plus, Search, Mail, Phone, MoreHorizontal, UserCircle, Pencil, Hash, Loader2, LayoutGrid, List, Users, Building2, UserCheck, UserX, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { PageHeader, StatGrid, Stat, Panel, EmptyState, StatusPill, FieldLabel, Segmented, PersonAvatar, downloadCsv } from "@/components/page";
import { EASE } from "@/components/motion";

const ROLES = [
    { value: "USER", label: "Standard user" },
    { value: "DEV", label: "Developer" },
    { value: "PM", label: "Project manager" },
    { value: "HR", label: "HR" },
    { value: "ADMIN", label: "Administrator" },
];
const roleLabel = (r?: string) => ROLES.find(x => x.value === r)?.label ?? r ?? "—";

const EMPTY_NEW = { name: "", email: "", role: "USER", department: "", designation: "", employeeId: "" };

export default function EmployeesPage() {
    const { toast } = useToast();
    const { data: session } = useSession();
    const canManage = session?.user?.role === "ADMIN" || session?.user?.role === "HR";

    const [employees, setEmployees] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [department, setDepartment] = useState<string>("all");
    const [view, setView] = useState<"grid" | "list">("grid");
    const [isLoading, setIsLoading] = useState(true);

    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [newEmp, setNewEmp] = useState(EMPTY_NEW);

    const [selectedEmp, setSelectedEmp] = useState<any>(null);
    const [isViewOpen, setIsViewOpen] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [terminateTarget, setTerminateTarget] = useState<any>(null);
    const [editForm, setEditForm] = useState({
        department: "", designation: "", role: "", status: "ACTIVE", phoneNumber: "", managerId: "none"
    });

    const fetchEmployees = async () => {
        setIsLoading(true);
        try {
            const response = await fetch("/api/employees");
            const data = await response.json();
            setEmployees(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Failed to fetch employees", error);
            toast({ title: "Error", description: "Failed to load directory.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchEmployees();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleCreateEmployee = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newEmp.name || !newEmp.email) {
            toast({ title: "Name and email are required", variant: "destructive" });
            return;
        }
        setIsSaving(true);
        try {
            const res = await fetch("/api/employees", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(newEmp),
            });
            if (res.ok) {
                toast({ title: "Employee added", description: `${newEmp.name} is now in the directory.` });
                setIsCreateOpen(false);
                setNewEmp(EMPTY_NEW);
                fetchEmployees();
            } else {
                const data = await res.json().catch(() => ({}));
                toast({ title: "Could not add employee", description: data.error || "Only HR and admins can add people.", variant: "destructive" });
            }
        } catch (error) {
            toast({ title: "Error", description: "Unexpected error occurred.", variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    const patchEmployee = async (id: string, body: Record<string, unknown>) => {
        const res = await fetch(`/api/employees/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || "Could not save the changes.");
        }
    };

    const handleEditEmployee = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedEmp) return;
        setIsSaving(true);
        try {
            await patchEmployee(selectedEmp.id, {
                department: editForm.department || null,
                designation: editForm.designation || null,
                phoneNumber: editForm.phoneNumber || null,
                status: editForm.status,
                role: editForm.role || undefined,
                managerId: editForm.managerId === "none" ? null : editForm.managerId,
            });
            toast({ title: "Profile updated", description: selectedEmp.name });
            setIsEditOpen(false);
            fetchEmployees();
        } catch (error: any) {
            toast({ title: "Update failed", description: error.message, variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    const confirmTerminate = async () => {
        if (!terminateTarget) return;
        setIsSaving(true);
        try {
            await patchEmployee(terminateTarget.id, { status: "TERMINATED" });
            toast({ title: "Access ended", description: `${terminateTarget.name} has been marked as terminated.` });
            setTerminateTarget(null);
            fetchEmployees();
        } catch (error: any) {
            toast({ title: "Could not terminate", description: error.message, variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    const openEdit = (emp: any) => {
        setSelectedEmp(emp);
        setEditForm({
            department: emp.profile?.department || "",
            designation: emp.profile?.designation || "",
            role: emp.role || "USER",
            status: emp.profile?.status || "ACTIVE",
            phoneNumber: emp.profile?.phoneNumber || "",
            managerId: emp.managerId || "none"
        });
        setIsEditOpen(true);
    };
    const openView = (emp: any) => { setSelectedEmp(emp); setIsViewOpen(true); };

    const departments = useMemo(() => {
        const counts = new Map<string, number>();
        for (const e of employees) {
            const d = e.profile?.department || "Unassigned";
            counts.set(d, (counts.get(d) ?? 0) + 1);
        }
        return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
    }, [employees]);

    const stats = useMemo(() => ({
        total: employees.length,
        active: employees.filter(e => (e.profile?.status ?? "ACTIVE") === "ACTIVE").length,
        onLeave: employees.filter(e => e.profile?.status === "ON_LEAVE").length,
        managers: employees.filter(e => ["ADMIN", "HR", "PM"].includes(e.role)).length,
    }), [employees]);

    const byId = useMemo(() => new Map(employees.map(e => [e.id, e])), [employees]);

    const filteredEmployees = employees.filter(emp => {
        const q = searchTerm.trim().toLowerCase();
        const dep = emp.profile?.department || "Unassigned";
        if (department !== "all" && dep !== department) return false;
        if (!q) return true;
        return [emp.name, emp.email, emp.profile?.department, emp.profile?.designation, emp.profile?.employeeId]
            .some(v => v?.toLowerCase().includes(q));
    });

    const exportCsv = () => downloadCsv(`directory-${new Date().toISOString().slice(0, 10)}.csv`, filteredEmployees.map(e => ({
        name: e.name, email: e.email, employeeId: e.profile?.employeeId ?? "", department: e.profile?.department ?? "",
        designation: e.profile?.designation ?? "", role: e.role, status: e.profile?.status ?? "", manager: byId.get(e.managerId)?.name ?? "",
    })));

    const RowMenu = ({ emp }: { emp: any }) => (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Actions for ${emp.name}`}><MoreHorizontal className="h-4 w-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => openView(emp)}><UserCircle className="mr-2 h-4 w-4" /> View profile</DropdownMenuItem>
                {canManage && <DropdownMenuItem onClick={() => openEdit(emp)}><Pencil className="mr-2 h-4 w-4" /> Edit details</DropdownMenuItem>}
                {canManage && emp.id !== session?.user?.id && emp.profile?.status !== "TERMINATED" && (
                    <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setTerminateTarget(emp)}><UserX className="mr-2 h-4 w-4" /> End access</DropdownMenuItem>
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );

    return (
        <div className="space-y-8">
            <PageHeader
                eyebrow="Workforce · People"
                title="Directory"
                description="Everyone in the organisation, their role, team and reporting line."
                actions={
                    <>
                        <Button variant="outline" onClick={exportCsv} disabled={filteredEmployees.length === 0}><Download className="h-4 w-4" /> Export</Button>
                        {canManage && <Button onClick={() => setIsCreateOpen(true)}><Plus className="h-4 w-4" /> Add person</Button>}
                    </>
                }
            />

            <StatGrid>
                <Stat label="Headcount" value={stats.total} icon={Users} tone="signal" />
                <Stat label="Active" value={stats.active} icon={UserCheck} hint={stats.total ? `${Math.round((stats.active / stats.total) * 100)}% of headcount` : undefined} tone="ok" />
                <Stat label="Departments" value={departments.length} icon={Building2} hint={departments[0] ? `Largest: ${departments[0][0]}` : undefined} />
                <Stat label="On leave" value={stats.onLeave} icon={UserX} hint={`${stats.managers} people managers`} />
            </StatGrid>

            {/* Toolbar */}
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="relative w-full sm:max-w-sm">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input placeholder="Search name, email, ID, role…" className="pl-9" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                    </div>
                    <div className="flex gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                        {[["all", employees.length] as [string, number], ...departments].map(([d, n]) => (
                            <button
                                key={d}
                                onClick={() => setDepartment(d)}
                                className={cn(
                                    "shrink-0 rounded-full border px-3 py-1.5 text-sm transition-colors",
                                    department === d ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                {d === "all" ? "All" : d} <span className="ml-1 font-mono text-[11px] opacity-60">{n}</span>
                            </button>
                        ))}
                    </div>
                </div>
                <Segmented value={view} onChange={setView} options={[{ value: "grid", label: "Cards", icon: LayoutGrid }, { value: "list", label: "Table", icon: List }]} />
            </div>

            {isLoading ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {[0, 1, 2, 3, 4, 5, 6, 7].map(i => <div key={i} className="h-56 animate-pulse rounded-2xl border bg-card" />)}
                </div>
            ) : filteredEmployees.length === 0 ? (
                <Panel>
                    <EmptyState icon={UserCircle} title="No one matches" description="Try a different search or department." action={(searchTerm || department !== "all") ? <Button variant="outline" onClick={() => { setSearchTerm(""); setDepartment("all"); }}>Clear filters</Button> : undefined} />
                </Panel>
            ) : view === "grid" ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    <AnimatePresence mode="popLayout">
                        {filteredEmployees.map((emp: any, idx) => (
                            <motion.article
                                key={emp.id}
                                layout
                                initial={{ opacity: 0, y: 16 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.96 }}
                                transition={{ delay: Math.min(idx, 12) * 0.03, duration: 0.5, ease: EASE }}
                                className="group relative flex flex-col overflow-hidden rounded-2xl border bg-card transition-colors hover:border-signal/50"
                            >
                                <div className="flex items-start justify-between p-5 pb-0">
                                    <button onClick={() => openView(emp)} className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
                                        <PersonAvatar name={emp.name} image={emp.image} size="lg" />
                                    </button>
                                    <RowMenu emp={emp} />
                                </div>
                                <div className="flex-1 p-5">
                                    <button onClick={() => openView(emp)} className="text-left">
                                        <h3 className="line-clamp-1 font-semibold tracking-tight group-hover:text-signal">{emp.name}</h3>
                                    </button>
                                    <p className="line-clamp-1 text-sm text-muted-foreground">{emp.profile?.designation || "No designation"}</p>
                                    <div className="mt-4 flex flex-wrap items-center gap-1.5">
                                        <StatusPill status={emp.profile?.status || "ACTIVE"} />
                                        <span className="rounded-md bg-secondary px-2 py-0.5 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{emp.profile?.department || "Unassigned"}</span>
                                    </div>
                                </div>
                                <div className="space-y-1.5 border-t px-5 py-4 text-sm text-muted-foreground">
                                    <p className="flex items-center gap-2 truncate"><Mail className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{emp.email}</span></p>
                                    {emp.managerId && byId.get(emp.managerId) && (
                                        <p className="flex items-center gap-2 truncate"><Users className="h-3.5 w-3.5 shrink-0" /> Reports to {byId.get(emp.managerId).name}</p>
                                    )}
                                </div>
                            </motion.article>
                        ))}
                    </AnimatePresence>
                </div>
            ) : (
                <Panel bodyClassName="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-secondary/40">
                                <tr className="border-b">
                                    {["Person", "ID", "Department", "Role", "Reports to", "Status", ""].map(h => (
                                        <th key={h} className="h-10 px-5 text-left font-mono text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {filteredEmployees.map((emp) => (
                                    <tr key={emp.id} className="border-b last:border-0 hover:bg-secondary/40">
                                        <td className="px-5 py-3">
                                            <button onClick={() => openView(emp)} className="flex items-center gap-3 text-left">
                                                <PersonAvatar name={emp.name} image={emp.image} size="sm" />
                                                <div className="min-w-0">
                                                    <p className="truncate font-medium">{emp.name}</p>
                                                    <p className="truncate text-xs text-muted-foreground">{emp.email}</p>
                                                </div>
                                            </button>
                                        </td>
                                        <td className="px-5 py-3 font-mono text-xs text-muted-foreground">{emp.profile?.employeeId || "—"}</td>
                                        <td className="px-5 py-3">{emp.profile?.department || "—"}<p className="text-xs text-muted-foreground">{emp.profile?.designation}</p></td>
                                        <td className="px-5 py-3 text-muted-foreground">{roleLabel(emp.role)}</td>
                                        <td className="px-5 py-3 text-muted-foreground">{byId.get(emp.managerId)?.name || "—"}</td>
                                        <td className="px-5 py-3"><StatusPill status={emp.profile?.status || "ACTIVE"} /></td>
                                        <td className="px-5 py-3 text-right"><RowMenu emp={emp} /></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Panel>
            )}

            {/* Create */}
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogContent className="sm:max-w-[520px]">
                    <form onSubmit={handleCreateEmployee}>
                        <DialogHeader>
                            <p className="font-mono-label text-muted-foreground">New person</p>
                            <DialogTitle className="text-2xl">Add to directory</DialogTitle>
                            <DialogDescription>They'll get an invite email to set their password.</DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <FieldLabel htmlFor="emp-name">Full name</FieldLabel>
                                    <Input id="emp-name" required placeholder="Jane Doe" value={newEmp.name} onChange={(e) => setNewEmp({ ...newEmp, name: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <FieldLabel htmlFor="emp-id">Employee ID</FieldLabel>
                                    <Input id="emp-id" placeholder="EMP-001" value={newEmp.employeeId} onChange={(e) => setNewEmp({ ...newEmp, employeeId: e.target.value })} className="font-mono uppercase" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <FieldLabel htmlFor="emp-email">Work email</FieldLabel>
                                <Input id="emp-email" type="email" required placeholder="jane@company.com" value={newEmp.email} onChange={(e) => setNewEmp({ ...newEmp, email: e.target.value })} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <FieldLabel htmlFor="emp-dept">Department</FieldLabel>
                                    <Input id="emp-dept" list="dept-options" placeholder="Engineering" value={newEmp.department} onChange={(e) => setNewEmp({ ...newEmp, department: e.target.value })} />
                                    <datalist id="dept-options">{departments.filter(([d]) => d !== "Unassigned").map(([d]) => <option key={d} value={d} />)}</datalist>
                                </div>
                                <div className="space-y-2">
                                    <FieldLabel htmlFor="emp-desig">Designation</FieldLabel>
                                    <Input id="emp-desig" placeholder="Senior engineer" value={newEmp.designation} onChange={(e) => setNewEmp({ ...newEmp, designation: e.target.value })} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <FieldLabel>Access role</FieldLabel>
                                <Select value={newEmp.role} onValueChange={(v) => setNewEmp({ ...newEmp, role: v })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>{ROLES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
                                </Select>
                                <p className="text-xs text-muted-foreground">HR and admins can manage people and settings; PMs manage their teams.</p>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={isSaving}>{isSaving && <Loader2 className="h-4 w-4 animate-spin" />} Add and invite</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Profile */}
            <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
                <DialogContent className="overflow-hidden p-0 sm:max-w-[460px]">
                    {selectedEmp && (
                        <>
                            <div className="relative border-b bg-[hsl(228_45%_6%)] px-6 pb-6 pt-10 text-[hsl(225_38%_95%)] grain">
                                <div className="halftone absolute inset-0 opacity-25 invert [--hx:90%] [--hy:10%]" />
                                <div className="relative flex items-end gap-4">
                                    <PersonAvatar name={selectedEmp.name} image={selectedEmp.image} size="xl" className="border-white/20 bg-white/10" />
                                    <div className="min-w-0">
                                        <DialogTitle className="truncate text-2xl font-semibold">{selectedEmp.name}</DialogTitle>
                                        <DialogDescription className="truncate text-white/60">{selectedEmp.profile?.designation || "No designation"}</DialogDescription>
                                    </div>
                                </div>
                            </div>
                            <dl className="grid grid-cols-2 gap-px bg-border">
                                {[
                                    ["Department", selectedEmp.profile?.department || "—"],
                                    ["Status", <StatusPill key="s" status={selectedEmp.profile?.status || "ACTIVE"} />],
                                    ["Role", roleLabel(selectedEmp.role)],
                                    ["Employee ID", <span key="i" className="font-mono">{selectedEmp.profile?.employeeId || "—"}</span>],
                                    ["Reports to", byId.get(selectedEmp.managerId)?.name || "—"],
                                    ["Direct reports", employees.filter(e => e.managerId === selectedEmp.id).length],
                                ].map(([k, v]) => (
                                    <div key={k as string} className="bg-card p-4">
                                        <dt className="font-mono-label text-muted-foreground">{k}</dt>
                                        <dd className="mt-1 text-sm font-medium">{v}</dd>
                                    </div>
                                ))}
                            </dl>
                            <div className="space-y-2 border-t p-6 text-sm">
                                <a href={`mailto:${selectedEmp.email}`} className="flex items-center gap-2 text-muted-foreground hover:text-foreground"><Mail className="h-4 w-4" /> {selectedEmp.email}</a>
                                {selectedEmp.profile?.phoneNumber && (
                                    <a href={`tel:${selectedEmp.profile.phoneNumber}`} className="flex items-center gap-2 text-muted-foreground hover:text-foreground"><Phone className="h-4 w-4" /> {selectedEmp.profile.phoneNumber}</a>
                                )}
                            </div>
                            <DialogFooter className="border-t p-4">
                                {canManage && <Button variant="outline" onClick={() => { setIsViewOpen(false); openEdit(selectedEmp); }}><Pencil className="h-4 w-4" /> Edit</Button>}
                                <Button onClick={() => setIsViewOpen(false)}>Close</Button>
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            {/* Edit */}
            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogContent className="sm:max-w-[480px]">
                    {selectedEmp && (
                        <form onSubmit={handleEditEmployee}>
                            <DialogHeader>
                                <p className="font-mono-label text-muted-foreground">Edit profile</p>
                                <DialogTitle className="text-2xl">{selectedEmp.name}</DialogTitle>
                            </DialogHeader>
                            <div className="grid gap-4 py-6">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <FieldLabel htmlFor="edit-dept">Department</FieldLabel>
                                        <Input id="edit-dept" list="dept-options" value={editForm.department} onChange={(e) => setEditForm({ ...editForm, department: e.target.value })} />
                                    </div>
                                    <div className="space-y-2">
                                        <FieldLabel htmlFor="edit-desig">Designation</FieldLabel>
                                        <Input id="edit-desig" value={editForm.designation} onChange={(e) => setEditForm({ ...editForm, designation: e.target.value })} />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <FieldLabel>Reports to</FieldLabel>
                                    <Select value={editForm.managerId} onValueChange={(v) => setEditForm({ ...editForm, managerId: v })}>
                                        <SelectTrigger><SelectValue placeholder="No manager" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">No manager</SelectItem>
                                            {employees.filter(e => e.id !== selectedEmp.id && e.isActive !== false).map(e => (
                                                <SelectItem key={e.id} value={e.id}>{e.name || e.email}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <p className="text-xs text-muted-foreground">Their manager approves leave and attendance corrections.</p>
                                </div>
                                <div className="space-y-2">
                                    <FieldLabel htmlFor="edit-phone">Phone</FieldLabel>
                                    <Input id="edit-phone" type="tel" value={editForm.phoneNumber} onChange={(e) => setEditForm({ ...editForm, phoneNumber: e.target.value })} />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <FieldLabel>Status</FieldLabel>
                                        <Select value={editForm.status} onValueChange={(v) => setEditForm({ ...editForm, status: v })}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="ACTIVE">Active</SelectItem>
                                                <SelectItem value="INACTIVE">Inactive</SelectItem>
                                                <SelectItem value="ON_LEAVE">On leave</SelectItem>
                                                <SelectItem value="TERMINATED">Terminated</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <FieldLabel>Access role</FieldLabel>
                                        <Select value={editForm.role} onValueChange={(v) => setEditForm({ ...editForm, role: v })}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>{ROLES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button type="button" variant="ghost" onClick={() => setIsEditOpen(false)}>Cancel</Button>
                                <Button type="submit" disabled={isSaving}>{isSaving && <Loader2 className="h-4 w-4 animate-spin" />} Save changes</Button>
                            </DialogFooter>
                        </form>
                    )}
                </DialogContent>
            </Dialog>

            {/* Terminate confirm */}
            <AlertDialog open={!!terminateTarget} onOpenChange={(o) => !o && setTerminateTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>End access for {terminateTarget?.name}?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Their status becomes Terminated. You can change it back later from Edit details.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isSaving}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={(e) => { e.preventDefault(); confirmTerminate(); }} disabled={isSaving} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            {isSaving && <Loader2 className="h-4 w-4 animate-spin" />} End access
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
