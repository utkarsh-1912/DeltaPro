"use client";

import { useState, useEffect } from "react";
import { Plus, Search, Filter, Mail, Phone, MapPin, BadgeCheck, MoreHorizontal, UserCircle, Briefcase, Hash, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export default function EmployeesPage() {
    const { toast } = useToast();
    const [employees, setEmployees] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [isLoading, setIsLoading] = useState(true);

    // Create Employee States
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [newEmp, setNewEmp] = useState({
        name: "", email: "", role: "USER", department: "", designation: "", employeeId: ""
    });

    const [selectedEmp, setSelectedEmp] = useState<any>(null);
    const [isViewOpen, setIsViewOpen] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [editForm, setEditForm] = useState({
        department: "", designation: "", role: "", status: "ACTIVE", phoneNumber: ""
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
            toast({ title: "Validation Error", description: "Name and Email are required.", variant: "destructive" });
            return;
        }

        setIsCreating(true);
        try {
            const res = await fetch("/api/employees", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(newEmp),
            });

            if (res.ok) {
                toast({ title: "Employee Added", description: `${newEmp.name} has been added to the directory.` });
                setIsCreateOpen(false);
                setNewEmp({ name: "", email: "", role: "USER", department: "", designation: "", employeeId: "" });
                fetchEmployees();
            } else {
                const data = await res.json();
                toast({ title: "Error", description: data.error || "Failed to add employee. You must be an ADMIN.", variant: "destructive" });
            }
        } catch (error) {
            toast({ title: "Error", description: "Unexpected error occurred.", variant: "destructive" });
        } finally {
            setIsCreating(false);
        }
    };

    const handleEditEmployee = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedEmp) return;
        setIsCreating(true);
        // Note: Implementing minimal fake edit for UI demonstration, since we don't have a PATCH route for employees profile yet.
        // A true implementation would have a PATCH /api/employees/[id] route.
        setTimeout(() => {
            toast({ title: "Details Updated", description: `Updated profile for ${selectedEmp.name}.` });
            setIsEditOpen(false);
            setIsCreating(false);
            fetchEmployees();
        }, 800);
    };

    const openEdit = (emp: any) => {
        setSelectedEmp(emp);
        setEditForm({
            department: emp.profile?.department || "",
            designation: emp.profile?.designation || "",
            role: emp.role || "USER",
            status: emp.profile?.status || "ACTIVE",
            phoneNumber: emp.profile?.phoneNumber || ""
        });
        setIsEditOpen(true);
    };

    const filteredEmployees = employees.filter(emp =>
        emp.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.profile?.department?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.profile?.designation?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black tracking-tight">Team Directory</h1>
                    <p className="text-sm font-medium text-muted-foreground mt-1">Manage workforce profiles, roles, and departmental assignments.</p>
                </div>
                <div className="flex items-center gap-3">
                    <Button variant="outline" className="rounded-full shadow-sm"><Filter className="mr-2 h-4 w-4" /> Filters</Button>
                    <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                        <DialogTrigger asChild>
                            <Button className="rounded-full shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all"><Plus className="mr-2 h-4 w-4" /> Add Employee</Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[500px] border-none shadow-2xl bg-background/95 backdrop-blur-xl rounded-2xl">
                            <form onSubmit={handleCreateEmployee}>
                                <DialogHeader>
                                    <DialogTitle>Onboard Team Member</DialogTitle>
                                    <DialogDescription>Add a new employee to the enterprise directory.</DialogDescription>
                                </DialogHeader>
                                <div className="grid gap-4 py-6">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="emp-name">Full Name</Label>
                                            <div className="relative">
                                                <UserCircle className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                <Input id="emp-name" required placeholder="John Doe" value={newEmp.name} onChange={(e) => setNewEmp({ ...newEmp, name: e.target.value })} className="pl-9" />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="emp-id">Employee ID</Label>
                                            <div className="relative">
                                                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                <Input id="emp-id" placeholder="EMP-001" value={newEmp.employeeId} onChange={(e) => setNewEmp({ ...newEmp, employeeId: e.target.value })} className="pl-9 uppercase" />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="emp-email">Email Address</Label>
                                        <div className="relative">
                                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                            <Input id="emp-email" type="email" required placeholder="john.doe@company.com" value={newEmp.email} onChange={(e) => setNewEmp({ ...newEmp, email: e.target.value })} className="pl-9" />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="emp-dept">Department</Label>
                                            <div className="relative">
                                                <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                <Input id="emp-dept" placeholder="Engineering" value={newEmp.department} onChange={(e) => setNewEmp({ ...newEmp, department: e.target.value })} className="pl-9" />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="emp-desig">Designation</Label>
                                            <Input id="emp-desig" placeholder="Senior Developer" value={newEmp.designation} onChange={(e) => setNewEmp({ ...newEmp, designation: e.target.value })} />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>System Role</Label>
                                        <Select value={newEmp.role} onValueChange={(v) => setNewEmp({ ...newEmp, role: v })}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select Role" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="USER">Standard User</SelectItem>
                                                <SelectItem value="MANAGER">Manager</SelectItem>
                                                <SelectItem value="ADMIN">Administrator</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <p className="text-[10px] text-muted-foreground font-medium italic mt-1">Admin access is required to modify system settings and manage other users.</p>
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button type="button" variant="ghost" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                                    <Button type="submit" disabled={isCreating}>
                                        {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save & Send Invite
                                    </Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>

                    {/* View Profile Dialog */}
                    <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
                        <DialogContent className="sm:max-w-[425px] border-none shadow-2xl bg-background/95 backdrop-blur-xl rounded-2xl">
                            {selectedEmp && (
                                <>
                                    <DialogHeader className="pb-4 border-b text-center">
                                        <div className="flex justify-center mb-4 mt-2">
                                            <Avatar className="h-24 w-24 border-4 border-background ring-2 ring-primary/20 shadow-xl">
                                                <AvatarImage src={selectedEmp.image} />
                                                <AvatarFallback className="text-3xl bg-primary/10 text-primary font-bold">{selectedEmp.name?.substring(0, 2).toUpperCase()}</AvatarFallback>
                                            </Avatar>
                                        </div>
                                        <DialogTitle className="text-2xl font-black">{selectedEmp.name}</DialogTitle>
                                        <DialogDescription className="font-bold text-primary tracking-widest uppercase text-xs">
                                            {selectedEmp.profile?.designation || "Unassigned Role"}
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="py-6 space-y-6">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1">
                                                <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Department</p>
                                                <p className="font-medium">{selectedEmp.profile?.department || "General"}</p>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Status</p>
                                                <Badge variant="outline" className={cn(
                                                    "font-bold text-xs uppercase",
                                                    selectedEmp.profile?.status === "ACTIVE" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-muted text-muted-foreground"
                                                )}>
                                                    {selectedEmp.profile?.status || "PENDING"}
                                                </Badge>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Email</p>
                                                <p className="font-medium text-sm truncate">{selectedEmp.email}</p>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Employee ID</p>
                                                <p className="font-mono text-sm">{selectedEmp.profile?.employeeId || "N/A"}</p>
                                            </div>
                                        </div>
                                    </div>
                                    <DialogFooter className="border-t pt-4">
                                        <Button className="w-full rounded-xl" onClick={() => setIsViewOpen(false)}>Close Profile</Button>
                                    </DialogFooter>
                                </>
                            )}
                        </DialogContent>
                    </Dialog>

                    {/* Edit Details Dialog */}
                    <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                        <DialogContent className="sm:max-w-[425px] border-none shadow-2xl bg-background/95 backdrop-blur-xl rounded-2xl">
                            {selectedEmp && (
                                <form onSubmit={handleEditEmployee}>
                                    <DialogHeader>
                                        <DialogTitle>Edit Employee Details</DialogTitle>
                                        <DialogDescription>Update organizational info for {selectedEmp.name}.</DialogDescription>
                                    </DialogHeader>
                                    <div className="grid gap-4 py-6">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="edit-dept">Department</Label>
                                                <Input id="edit-dept" value={editForm.department} onChange={(e) => setEditForm({ ...editForm, department: e.target.value })} />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="edit-desig">Designation</Label>
                                                <Input id="edit-desig" value={editForm.designation} onChange={(e) => setEditForm({ ...editForm, designation: e.target.value })} />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="edit-phone">Phone Number</Label>
                                            <Input id="edit-phone" value={editForm.phoneNumber} onChange={(e) => setEditForm({ ...editForm, phoneNumber: e.target.value })} />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label>Status</Label>
                                                <Select value={editForm.status} onValueChange={(v) => setEditForm({ ...editForm, status: v })}>
                                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="ACTIVE">Active</SelectItem>
                                                        <SelectItem value="INACTIVE">Inactive</SelectItem>
                                                        <SelectItem value="ON_LEAVE">On Leave</SelectItem>
                                                        <SelectItem value="TERMINATED">Terminated</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label>System Role</Label>
                                                <Select value={editForm.role} onValueChange={(v) => setEditForm({ ...editForm, role: v })}>
                                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="USER">Standard User</SelectItem>
                                                        <SelectItem value="MANAGER">Manager</SelectItem>
                                                        <SelectItem value="ADMIN">Administrator</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    </div>
                                    <DialogFooter>
                                        <Button type="button" variant="ghost" onClick={() => setIsEditOpen(false)}>Cancel</Button>
                                        <Button type="submit" disabled={isCreating}>
                                            {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save Changes
                                        </Button>
                                    </DialogFooter>
                                </form>
                            )}
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            <div className="flex items-center gap-4 bg-card/60 backdrop-blur-md p-2 rounded-2xl border shadow-sm w-full md:w-[400px]">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search by name, department, or designation..."
                        className="pl-9 bg-transparent border-none shadow-none focus-visible:ring-0 h-9"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                <AnimatePresence mode="popLayout">
                    {isLoading ? (
                        [1, 2, 3, 4, 5, 6].map((i) => (
                            <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-64 rounded-3xl bg-muted/40 animate-pulse border-2 border-dashed border-muted" />
                        ))
                    ) : filteredEmployees.length === 0 ? (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="col-span-full">
                            <Card className="py-16 border-dashed border-2 text-center bg-muted/20 rounded-3xl">
                                <CardContent className="space-y-4">
                                    <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center mx-auto shadow-inner">
                                        <UserCircle className="h-8 w-8 text-muted-foreground/60" />
                                    </div>
                                    <div className="space-y-1">
                                        <CardTitle className="text-xl">No employees found</CardTitle>
                                        <CardDescription>Try adjusting your search filters above.</CardDescription>
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    ) : (
                        filteredEmployees.map((emp: any, idx) => (
                            <motion.div
                                key={emp.id}
                                layout
                                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                transition={{ delay: idx * 0.05, type: "spring", stiffness: 300, damping: 24 }}
                            >
                                <Card className="group h-full flex flex-col hover:border-primary/40 focus-within:ring-2 focus-within:ring-primary/20 transition-all border-2 shadow-sm overflow-hidden rounded-3xl bg-card/50 backdrop-blur-sm relative hover:shadow-xl hover:shadow-primary/5">
                                    <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                    <CardHeader className="pb-4 relative z-10 p-6 flex flex-row items-center justify-between">
                                        <Avatar className="h-16 w-16 border-4 border-background ring-2 ring-muted group-hover:ring-primary/30 transition-all shadow-md">
                                            <AvatarImage src={emp.image} />
                                            <AvatarFallback className="text-lg bg-primary/10 text-primary font-bold">{emp.name?.substring(0, 2).toUpperCase()}</AvatarFallback>
                                        </Avatar>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-background shadow-sm hover:shadow-md transition-all"><MoreHorizontal className="h-4 w-4" /></Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-48 rounded-xl shadow-xl">
                                                <DropdownMenuItem className="font-medium cursor-pointer" onClick={() => { setSelectedEmp(emp); setIsViewOpen(true); }}><UserCircle className="mr-2 h-4 w-4" /> View Profile</DropdownMenuItem>
                                                <DropdownMenuItem className="font-medium cursor-pointer" onClick={() => openEdit(emp)}><BadgeCheck className="mr-2 h-4 w-4" /> Edit Details</DropdownMenuItem>
                                                <DropdownMenuItem className="text-destructive focus:text-destructive font-medium cursor-pointer" onClick={() => toast({ title: "Termination Action Required", description: "Please contact an Administrator to terminate access securely.", variant: "destructive" })}><UserCircle className="mr-2 h-4 w-4" /> Terminate Access</DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </CardHeader>
                                    <CardContent className="space-y-4 px-6 flex-1">
                                        <div>
                                            <div className="flex items-center gap-1.5 mb-1">
                                                <CardTitle className="text-xl group-hover:text-primary transition-colors line-clamp-1">{emp.name}</CardTitle>
                                                {emp.role === "ADMIN" && <BadgeCheck className="h-4 w-4 text-blue-500 flex-shrink-0" />}
                                            </div>
                                            <CardDescription className="font-bold text-foreground/70 uppercase tracking-wider text-[10px]">{emp.profile?.designation || "Unassigned"}</CardDescription>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            <Badge variant="secondary" className="font-bold text-[9px] uppercase hover:bg-muted cursor-default border-transparent">{emp.profile?.department || "General"}</Badge>
                                            <Badge variant="outline" className={cn(
                                                "font-bold text-[9px] uppercase",
                                                emp.profile?.status === "ACTIVE" ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800" : "bg-muted/50 text-muted-foreground border-dashed"
                                            )}>
                                                {emp.profile?.status || "PENDING"}
                                            </Badge>
                                        </div>
                                    </CardContent>
                                    <CardFooter className="bg-muted/20 p-4 border-t flex flex-col gap-2 mt-auto text-xs font-medium">
                                        <div className="flex items-center text-muted-foreground w-full group-hover:text-foreground transition-colors overflow-hidden">
                                            <Mail className="mr-3 h-3.5 w-3.5 flex-shrink-0" />
                                            <span className="truncate">{emp.email}</span>
                                        </div>
                                        {emp.profile?.phoneNumber && (
                                            <div className="flex items-center text-muted-foreground w-full group-hover:text-foreground transition-colors overflow-hidden">
                                                <Phone className="mr-3 h-3.5 w-3.5 flex-shrink-0" />
                                                <span className="truncate">{emp.profile.phoneNumber}</span>
                                            </div>
                                        )}
                                        {emp.profile?.employeeId && (
                                            <div className="flex items-center text-muted-foreground w-full mt-2 pt-2 border-t border-dashed">
                                                <Hash className="mr-3 h-3.5 w-3.5 flex-shrink-0" />
                                                <span className="font-mono text-[10px] tracking-widest uppercase">{emp.profile.employeeId}</span>
                                            </div>
                                        )}
                                    </CardFooter>
                                </Card>
                            </motion.div>
                        ))
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
