"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, Filter, Search, AlertCircle, CheckCircle2, Circle, Clock, Loader2, ChevronRight, ChevronsUp, ChevronUp, ChevronDown, MessageSquare, Paperclip, Share2, MoreHorizontal, UserPlus, X, Command, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const STATUS_COLUMNS = [
    { id: "TODO", label: "To Do", icon: Circle, color: "text-slate-400" },
    { id: "IN_PROGRESS", label: "In Progress", icon: Clock, color: "text-blue-500" },
    { id: "REVIEW", label: "In Review", icon: AlertCircle, color: "text-amber-500" },
    { id: "DONE", label: "Done", icon: CheckCircle2, color: "text-emerald-500" },
];

const PRIORITIES = ["URGENT", "HIGH", "MEDIUM", "LOW"] as const;

const PRIORITY_ICONS = {
    URGENT: { icon: ChevronsUp, color: "text-rose-600", label: "Urgent" },
    HIGH: { icon: ChevronUp, color: "text-amber-600", label: "High" },
    MEDIUM: { icon: ChevronUp, color: "text-blue-600", label: "Medium" },
    LOW: { icon: ChevronDown, color: "text-slate-500", label: "Low" },
};

export default function TasksPage() {
    const { toast } = useToast();
    const [tasks, setTasks] = useState<any[]>([]);
    const [projects, setProjects] = useState<any[]>([]);
    const [employees, setEmployees] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Filters State
    const [filterAssignees, setFilterAssignees] = useState<string[]>([]);
    const [filterPriorities, setFilterPriorities] = useState<string[]>([]);
    const [filterProjects, setFilterProjects] = useState<string[]>([]);

    // Create Modal State
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [newTask, setNewTask] = useState({
        title: "", description: "", projectId: "", assigneeId: "", priority: "MEDIUM", type: "TASK", status: "TODO"
    });

    // Detailed Task Modal State
    const [selectedTask, setSelectedTask] = useState<any>(null);
    const [editingTask, setEditingTask] = useState<any>(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [isModalEditing, setIsModalEditing] = useState(false);
    const [commentText, setCommentText] = useState("");
    const [isCommenting, setIsCommenting] = useState(false);

    const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [tasksRes, projectsRes, empRes] = await Promise.all([
                fetch("/api/tasks"),
                fetch("/api/projects"),
                fetch("/api/employees")
            ]);
            const [tasksData, projectsData, empData] = await Promise.all([
                tasksRes.json(), projectsRes.json(), empRes.json()
            ]);
            setTasks(Array.isArray(tasksData) ? tasksData : []);
            setProjects(Array.isArray(projectsData) ? projectsData : []);
            setEmployees(Array.isArray(empData) ? empData : []);
        } catch (err) {
            console.error(err);
            toast({ title: "Error", description: "Failed to load data.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleCreateTask = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTask.title || !newTask.projectId) {
            toast({ title: "Validation Error", description: "Title and Project are required.", variant: "destructive" });
            return;
        }

        setIsCreating(true);
        try {
            const res = await fetch("/api/tasks", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(newTask),
            });

            if (res.ok) {
                toast({ title: "Task Created", description: "The task was added successfully." });
                setIsCreateOpen(false);
                setNewTask({ title: "", description: "", projectId: "", assigneeId: "", priority: "MEDIUM", type: "TASK", status: "TODO" });
                fetchData();
            } else {
                toast({ title: "Error", description: "Failed to create task", variant: "destructive" });
            }
        } catch (error) {
            toast({ title: "Error", description: "An unexpected error occurred.", variant: "destructive" });
        } finally {
            setIsCreating(false);
        }
    };

    const handleUpdateTask = async (id: string, data: any) => {
        setIsUpdating(true);

        // Optimistic update for assignee
        if (data.assigneeId) {
            const emp = employees.find(e => e.id === data.assigneeId);
            setTasks(prev => prev.map(t => t.id === id ? { ...t, assigneeId: data.assigneeId, assignee: emp } : t));
            if (selectedTask?.id === id) {
                setSelectedTask((prev: any) => ({ ...prev, assigneeId: data.assigneeId, assignee: emp }));
                setEditingTask((prev: any) => ({ ...prev, assigneeId: data.assigneeId, assignee: emp }));
            }
        }

        try {
            const res = await fetch(`/api/tasks/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data)
            });

            if (res.ok) {
                const updated = await res.json();
                toast({ title: "Updated", description: "Changes saved." });
                setTasks(prev => prev.map(t => t.id === id ? updated : t));
                if (selectedTask?.id === id) {
                    setSelectedTask(updated);
                    setEditingTask(updated);
                }
            } else {
                throw new Error("Update failed");
            }
        } catch (error) {
            toast({ title: "Update Failed", description: "Could not save changes.", variant: "destructive" });
            fetchData();
        } finally {
            setIsUpdating(false);
        }
    };

    const handleModalSave = async () => {
        if (!editingTask) return;

        // Prepare data to send (only things that can be updated in modal)
        const updateData = {
            title: editingTask.title,
            description: editingTask.description,
            status: editingTask.status,
            priority: editingTask.priority,
            assigneeId: editingTask.assigneeId,
            type: editingTask.type,
        };

        await handleUpdateTask(editingTask.id, updateData);
        setIsModalEditing(false);
    };

    const handleAddComment = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!commentText.trim() || !selectedTask) return;

        setIsCommenting(true);
        try {
            const res = await fetch(`/api/tasks/${selectedTask.id}/comments`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content: commentText })
            });

            if (res.ok) {
                const newComment = await res.json();
                setCommentText("");
                // Update selectedTask locally to show new comment
                setSelectedTask((prev: any) => ({
                    ...prev,
                    taskComments: [newComment, ...(prev.taskComments || [])]
                }));
                // Also update the main tasks list so it persists if modal reopens
                setTasks(prev => prev.map(t => t.id === selectedTask.id ? {
                    ...t,
                    taskComments: [newComment, ...(t.taskComments || [])]
                } : t));
                toast({ title: "Comment added", description: "Your comment was posted." });
            } else {
                toast({ title: "Error", description: "Failed to post comment", variant: "destructive" });
            }
        } catch (err) {
            toast({ title: "Error", description: "An unexpected error occurred.", variant: "destructive" });
        } finally {
            setIsCommenting(false);
        }
    };

    const handleDragStart = (e: React.DragEvent, id: string) => {
        setDraggedTaskId(id);
        e.dataTransfer.effectAllowed = "move";
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
    };

    const handleDrop = async (e: React.DragEvent, status: string, priority: string) => {
        e.preventDefault();
        if (!draggedTaskId) return;

        const updatedTasks = tasks.map(t => t.id === draggedTaskId ? { ...t, status, priority } : t);
        setTasks(updatedTasks);
        setDraggedTaskId(null);

        try {
            const res = await fetch(`/api/tasks/${draggedTaskId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status, priority })
            });
            if (!res.ok) throw new Error("Update failed");
            toast({ title: "Moved", description: "Task updated successfully." });
        } catch (error) {
            toast({ title: "Error", description: "Failed to update task.", variant: "destructive" });
            fetchData();
        }
    };

    const filteredTasks = useMemo(() => {
        return tasks.filter((t: any) => {
            const matchAssignee = filterAssignees.length === 0 || filterAssignees.includes(t.assigneeId);
            const matchPriority = filterPriorities.length === 0 || filterPriorities.includes(t.priority);
            const matchProject = filterProjects.length === 0 || filterProjects.includes(t.projectId);
            return matchAssignee && matchPriority && matchProject;
        });
    }, [tasks, filterAssignees, filterPriorities, filterProjects]);

    const openTaskDetail = (task: any) => {
        setSelectedTask(task);
        setEditingTask(task); // Initialize local edit state
        setIsDetailOpen(true);
        setIsModalEditing(false); // Reset to view mode
    };

    return (
        <div className="flex flex-col h-[calc(100vh-6rem)] gap-4">
            {/* Toolbar Area */}
            <div className="flex flex-col gap-4 shrink-0 px-1">
                <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                        <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
                            Task Insights
                        </h1>
                        <nav className="flex items-center gap-2 text-xs font-bold text-muted-foreground mt-1">
                            <span>Matrix</span>
                            <ChevronRight className="h-3 w-3" />
                            <span className="text-primary italic">Global View</span>
                        </nav>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button
                            className="rounded-xl bg-primary shadow-lg shadow-primary/20 hover:scale-[1.02] transition-all font-black h-10"
                            onClick={() => setIsCreateOpen(true)}
                        >
                            <Plus className="mr-1.5 h-4 w-4" /> Create
                        </Button>
                    </div>
                </div>

                {/* Filter Bar */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    <div className="flex items-center gap-2 bg-muted/20 px-3 py-1.5 rounded-xl border">
                        <Filter className="h-3.5 w-3.5 opacity-50" />
                        <span className="text-[10px] font-black uppercase tracking-widest opacity-40 mr-2">Filter</span>

                        {/* Assignee Filter */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className={cn("h-7 text-[10px] font-bold px-3 rounded-lg", filterAssignees.length > 0 && "bg-primary/10 text-primary")}>
                                    Assignee {filterAssignees.length > 0 && `(${filterAssignees.length})`}
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-48 rounded-xl shadow-2xl border-none">
                                {employees.map(e => (
                                    <DropdownMenuItem
                                        key={e.id}
                                        onClick={(ev) => {
                                            ev.preventDefault();
                                            setFilterAssignees(prev => prev.includes(e.id) ? prev.filter(x => x !== e.id) : [...prev, e.id]);
                                        }}
                                        className="flex items-center gap-2 cursor-pointer"
                                    >
                                        <div className={cn("w-3 h-3 rounded-sm border flex items-center justify-center", filterAssignees.includes(e.id) ? "bg-primary border-primary" : "border-muted-foreground/30")}>
                                            {filterAssignees.includes(e.id) && <X className="h-2 w-2 text-primary-foreground" />}
                                        </div>
                                        <span className="text-xs font-medium">{e.name}</span>
                                    </DropdownMenuItem>
                                ))}
                                {filterAssignees.length > 0 && (
                                    <>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={() => setFilterAssignees([])} className="justify-center text-[10px] font-black uppercase tracking-widest text-primary py-2 cursor-pointer">Clear</DropdownMenuItem>
                                    </>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>

                        {/* Priority Filter */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className={cn("h-7 text-[10px] font-bold px-3 rounded-lg", filterPriorities.length > 0 && "bg-primary/10 text-primary")}>
                                    Priority {filterPriorities.length > 0 && `(${filterPriorities.length})`}
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-48 rounded-xl shadow-2xl border-none">
                                {PRIORITIES.map(p => (
                                    <DropdownMenuItem
                                        key={p}
                                        onClick={(ev) => {
                                            ev.preventDefault();
                                            setFilterPriorities(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
                                        }}
                                        className="flex items-center gap-2 cursor-pointer"
                                    >
                                        <div className={cn("w-3 h-3 rounded-sm border flex items-center justify-center", filterPriorities.includes(p) ? "bg-primary border-primary" : "border-muted-foreground/30")}>
                                            {filterPriorities.includes(p) && <X className="h-2 w-2 text-primary-foreground" />}
                                        </div>
                                        <span className="text-xs font-medium">{p}</span>
                                    </DropdownMenuItem>
                                ))}
                                {filterPriorities.length > 0 && (
                                    <>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={() => setFilterPriorities([])} className="justify-center text-[10px] font-black uppercase tracking-widest text-primary py-2 cursor-pointer">Clear</DropdownMenuItem>
                                    </>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>

                        {/* Project Filter */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className={cn("h-7 text-[10px] font-bold px-3 rounded-lg", filterProjects.length > 0 && "bg-primary/10 text-primary")}>
                                    Project {filterProjects.length > 0 && `(${filterProjects.length})`}
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-48 rounded-xl shadow-2xl border-none">
                                {projects.map(p => (
                                    <DropdownMenuItem
                                        key={p.id}
                                        onClick={(ev) => {
                                            ev.preventDefault();
                                            setFilterProjects(prev => prev.includes(p.id) ? prev.filter(x => x !== p.id) : [...prev, p.id]);
                                        }}
                                        className="flex items-center gap-2 cursor-pointer"
                                    >
                                        <div className={cn("w-3 h-3 rounded-sm border flex items-center justify-center", filterProjects.includes(p.id) ? "bg-primary border-primary" : "border-muted-foreground/30")}>
                                            {filterProjects.includes(p.id) && <X className="h-2 w-2 text-primary-foreground" />}
                                        </div>
                                        <span className="text-xs font-medium">{p.name}</span>
                                    </DropdownMenuItem>
                                ))}
                                {filterProjects.length > 0 && (
                                    <>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={() => setFilterProjects([])} className="justify-center text-[10px] font-black uppercase tracking-widest text-primary py-2 cursor-pointer">Clear</DropdownMenuItem>
                                    </>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>

                        {(filterAssignees.length > 0 || filterPriorities.length > 0 || filterProjects.length > 0) && (
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 rounded-full hover:bg-rose-500/10 hover:text-rose-500" onClick={() => {
                                setFilterAssignees([]);
                                setFilterPriorities([]);
                                setFilterProjects([]);
                            }}>
                                <X className="h-3.5 w-3.5" />
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            {/* Matrix Board */}
            <div className="flex-1 overflow-x-auto overflow-y-auto pb-10">
                <div className="min-w-[1000px] h-full flex flex-col">
                    {/* Status Header */}
                    <div className="grid grid-cols-[120px_1fr_1fr_1fr_1fr] gap-4 mb-2 sticky top-0 z-20 bg-background/95 backdrop-blur-sm py-2 px-2 border-b">
                        <div className="flex items-center justify-center font-black text-[10px] uppercase tracking-widest text-muted-foreground opacity-50">
                            Priority
                        </div>
                        {STATUS_COLUMNS.map(column => (
                            <div key={column.id} className="flex items-center gap-2 px-3 py-1 bg-muted/20 rounded-lg">
                                <column.icon className={cn("h-4 w-4", column.color)} />
                                <span className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground">{column.label}</span>
                                <Badge variant="secondary" className="ml-auto h-5 px-1.5 text-[10px] font-bold bg-muted/50">{filteredTasks.filter(t => t.status === column.id).length}</Badge>
                            </div>
                        ))}
                    </div>

                    {/* Matrix Rows */}
                    <div className="space-y-4 px-2">
                        {PRIORITIES.map((priority) => {
                            const pInfo = PRIORITY_ICONS[priority];
                            return (
                                <div key={priority} className="grid grid-cols-[120px_1fr_1fr_1fr_1fr] gap-4 min-h-[140px]">
                                    <div className="flex flex-col items-center justify-center gap-2 bg-muted/10 rounded-2xl border-2 border-transparent hover:border-muted/30 transition-all group">
                                        <pInfo.icon className={cn("h-6 w-6", pInfo.color)} />
                                        <span className="text-[10px] font-black uppercase tracking-[0.2em]">{priority}</span>
                                        <span className="text-[9px] font-bold text-muted-foreground opacity-40">
                                            {filteredTasks.filter(t => t.priority === priority).length} Tasks
                                        </span>
                                    </div>

                                    {STATUS_COLUMNS.map((column) => (
                                        <div
                                            key={`${priority}-${column.id}`}
                                            className="flex flex-col gap-3 p-2 rounded-2xl bg-muted/5 border-2 border-dashed border-border/10 hover:bg-muted/10 transition-colors group relative"
                                            onDragOver={handleDragOver}
                                            onDrop={(e) => handleDrop(e, column.id, priority)}
                                        >
                                            <AnimatePresence>
                                                {filteredTasks
                                                    .filter(t => t.priority === priority && t.status === column.id)
                                                    .map((task: any) => (
                                                        <motion.div
                                                            key={task.id}
                                                            layout
                                                            draggable
                                                            onDragStart={(e) => handleDragStart(e, task.id)}
                                                            onClick={(e) => { e.stopPropagation(); openTaskDetail(task); }}
                                                        >
                                                            <Card className="shadow-sm hover:shadow-lg hover:ring-2 ring-primary/20 transition-all border border-border/40 cursor-grab active:cursor-grabbing rounded-xl bg-card overflow-hidden group/card relative">
                                                                <div className="p-3 space-y-3">
                                                                    <div className="flex items-center justify-between">
                                                                        <span className="text-[9px] font-black text-muted-foreground uppercase opacity-40 tracking-tighter">
                                                                            {task.project?.key}-{task.key}
                                                                        </span>
                                                                        <DropdownMenu>
                                                                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                                                                <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full opacity-0 group-hover/card:opacity-100 transition-opacity">
                                                                                    <UserPlus className="h-3 w-3" />
                                                                                </Button>
                                                                            </DropdownMenuTrigger>
                                                                            <DropdownMenuContent className="w-56 rounded-xl shadow-2xl border-none p-2">
                                                                                <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest px-3 py-2 opacity-50">Assign To</DropdownMenuLabel>
                                                                                <DropdownMenuSeparator />
                                                                                {employees.map(emp => (
                                                                                    <DropdownMenuItem key={emp.id} onClick={(e) => { e.stopPropagation(); handleUpdateTask(task.id, { assigneeId: emp.id }); }} className="rounded-lg gap-3 px-3 py-2 cursor-pointer">
                                                                                        <Avatar className="h-6 w-6">
                                                                                            <AvatarImage src={emp.image} />
                                                                                            <AvatarFallback className="text-[8px] font-bold">{emp.name?.substring(0, 2).toUpperCase()}</AvatarFallback>
                                                                                        </Avatar>
                                                                                        <div className="flex flex-col">
                                                                                            <span className="text-xs font-bold">{emp.name}</span>
                                                                                            <span className="text-[9px] text-muted-foreground font-medium">{emp.role}</span>
                                                                                        </div>
                                                                                    </DropdownMenuItem>
                                                                                ))}
                                                                            </DropdownMenuContent>
                                                                        </DropdownMenu>
                                                                    </div>
                                                                    <CardTitle className="text-[12px] font-bold leading-tight group-hover/card:text-primary transition-colors line-clamp-2">
                                                                        {task.title}
                                                                    </CardTitle>
                                                                    <div className="flex items-center justify-between pt-1">
                                                                        <div className="flex items-center gap-1.5">
                                                                            <pInfo.icon className={cn("h-3 w-3", pInfo.color)} />
                                                                            <Badge variant="outline" className="text-[8px] font-black uppercase tracking-tight py-0 px-1 border-muted-foreground/10">{task.type}</Badge>
                                                                        </div>
                                                                        <Avatar className="h-5 w-5 bg-muted">
                                                                            <AvatarImage src={task.assignee?.image} />
                                                                            <AvatarFallback className="text-[7px] font-bold">
                                                                                {(task.assignee?.name || "?").substring(0, 2).toUpperCase()}
                                                                            </AvatarFallback>
                                                                        </Avatar>
                                                                    </div>
                                                                </div>
                                                            </Card>
                                                        </motion.div>
                                                    ))}
                                            </AnimatePresence>

                                            <Button
                                                variant="ghost"
                                                className="w-full mt-auto border border-dashed border-muted-foreground/10 text-muted-foreground/20 hover:text-primary hover:border-primary/40 hover:bg-primary/5 rounded-xl h-8 transition-all group/add"
                                                onClick={() => {
                                                    setNewTask(prev => ({ ...prev, status: column.id, priority }));
                                                    setIsCreateOpen(true);
                                                }}
                                            >
                                                <Plus className="h-4 w-4 opacity-40 group-hover/add:opacity-100 transition-opacity" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* CREATE MODAL */}
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogContent className="sm:max-w-[500px] border-none shadow-2xl bg-background/95 backdrop-blur-xl rounded-[2rem] p-8">
                    <form onSubmit={handleCreateTask}>
                        <DialogHeader className="mb-6">
                            <DialogTitle className="text-2xl font-black">New Work Item</DialogTitle>
                            <DialogDescription className="font-medium">Directly adding to <span className="text-primary font-black uppercase">{newTask.priority}</span> / <span className="text-primary font-black uppercase">{newTask.status}</span></DialogDescription>
                        </DialogHeader>
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Summary</Label>
                                <Input required placeholder="Issue title..." value={newTask.title} onChange={(e) => setNewTask({ ...newTask, title: e.target.value })} className="h-12 bg-muted/40 border-none rounded-xl px-4 font-bold focus:ring-2 ring-primary" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Project</Label>
                                    <Select value={newTask.projectId} onValueChange={(v) => setNewTask({ ...newTask, projectId: v })}>
                                        <SelectTrigger className="h-12 bg-muted/40 border-none rounded-xl">
                                            <SelectValue placeholder="Project" />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-xl border-none shadow-2xl">
                                            {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Priority</Label>
                                    <Select value={newTask.priority} onValueChange={(v) => setNewTask({ ...newTask, priority: v })}>
                                        <SelectTrigger className="h-12 bg-muted/40 border-none rounded-xl">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-xl border-none shadow-2xl">
                                            {PRIORITIES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Assign To</Label>
                                <Select value={newTask.assigneeId} onValueChange={(v) => setNewTask({ ...newTask, assigneeId: v })}>
                                    <SelectTrigger className="h-12 bg-muted/40 border-none rounded-xl">
                                        <SelectValue placeholder="Unassigned" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl border-none shadow-2xl">
                                        {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <DialogFooter className="mt-8 gap-3 sm:justify-end">
                            <Button type="button" variant="ghost" className="rounded-xl font-bold" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={isCreating} className="rounded-xl font-black h-12 px-8">
                                {isCreating ? <Loader2 className="animate-spin" /> : "Create Task"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* DETAIL MODAL */}
            <Dialog open={isDetailOpen} onOpenChange={(open) => {
                setIsDetailOpen(open);
                if (!open) setIsModalEditing(false);
            }}>
                {selectedTask && (
                    <DialogContent className="sm:max-w-[950px] h-[90vh] p-0 overflow-hidden border-none shadow-3xl bg-background rounded-[2rem]">
                        <DialogTitle className="sr-only">Task Details - {selectedTask.title}</DialogTitle>
                        <DialogDescription className="sr-only">View and manage task details, comments, and status.</DialogDescription>

                        <div className="flex h-full flex-col md:flex-row">
                            {/* Main Content Area */}
                            <div className="flex-1 overflow-y-auto p-10 border-r border-border/30 scrollbar-thin">
                                <div className="flex items-center justify-between mb-8">
                                    <div className="flex items-center gap-3">
                                        <Badge className="text-[10px] font-black bg-primary/5 text-primary border-primary/10 tracking-[0.2em] uppercase px-3 py-1">
                                            {selectedTask.project?.key}-{selectedTask.key}
                                        </Badge>
                                        <div className="h-1 w-1 rounded-full bg-border" />
                                        <Badge variant="secondary" className="text-[10px] font-black uppercase tracking-widest bg-muted/50 px-3 py-1">
                                            {selectedTask.type}
                                        </Badge>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {isModalEditing ? (
                                            <>
                                                <Button variant="ghost" size="sm" className="rounded-xl font-bold" onClick={() => {
                                                    setEditingTask(selectedTask);
                                                    setIsModalEditing(false);
                                                }}>
                                                    Cancel
                                                </Button>
                                                <Button size="sm" className="rounded-xl font-black px-6 shadow-lg shadow-primary/20" onClick={handleModalSave} disabled={isUpdating}>
                                                    {isUpdating ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save Changes"}
                                                </Button>
                                            </>
                                        ) : (
                                            <Button variant="outline" size="sm" className="rounded-xl font-black px-6 hover:bg-primary/5 hover:text-primary transition-all" onClick={() => setIsModalEditing(true)}>
                                                Edit Details
                                            </Button>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-12">
                                    {/* Title Section */}
                                    <div className="space-y-2">
                                        {isModalEditing ? (
                                            <Input
                                                value={editingTask.title}
                                                onChange={(e) => setEditingTask({ ...editingTask, title: e.target.value })}
                                                className="text-2xl font-black tracking-tight bg-muted/20 border-none rounded-xl h-14 px-4 focus:ring-2 ring-primary/20"
                                            />
                                        ) : (
                                            <h2 className="text-3xl font-black tracking-tight leading-tight px-1">
                                                {selectedTask.title}
                                            </h2>
                                        )}
                                    </div>

                                    {/* Description Section */}
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Description</Label>
                                        </div>
                                        {isModalEditing ? (
                                            <Textarea
                                                value={editingTask.description || ""}
                                                onChange={(e) => setEditingTask({ ...editingTask, description: e.target.value })}
                                                className="min-h-[250px] p-6 bg-muted/20 border-none rounded-[1.5rem] text-sm font-medium leading-[1.8] focus:ring-2 ring-primary/20"
                                                placeholder="Add a detailed description..."
                                            />
                                        ) : (
                                            <div className="min-h-[150px] p-6 bg-muted/5 rounded-[1.5rem] text-sm font-medium leading-[1.8] text-foreground/80 whitespace-pre-wrap">
                                                {selectedTask.description || <span className="text-muted-foreground italic opacity-50">No description provided for this task.</span>}
                                            </div>
                                        )}
                                    </div>

                                    {/* Activity Section */}
                                    <div className="space-y-8 pt-10 border-t border-border/40">
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-[11px] font-black uppercase tracking-[0.2em] flex items-center gap-3">
                                                <MessageSquare className="h-4 w-4 text-primary" /> Activity Feed
                                            </h4>
                                            <Badge variant="outline" className="text-[9px] font-black opacity-40">{selectedTask.taskComments?.length || 0} Comments</Badge>
                                        </div>

                                        {/* New Comment Input */}
                                        <div className="flex items-start gap-4">
                                            <Avatar className="h-10 w-10 border-2 border-background shadow-sm">
                                                <AvatarFallback className="text-[10px] font-black bg-primary/10 text-primary">ME</AvatarFallback>
                                            </Avatar>
                                            <div className="flex-1 relative group">
                                                <form onSubmit={handleAddComment}>
                                                    <Input
                                                        value={commentText}
                                                        onChange={(e) => setCommentText(e.target.value)}
                                                        placeholder="Write a comment..."
                                                        className="h-12 bg-muted/20 border-none rounded-2xl text-sm pl-5 pr-12 focus:ring-2 ring-primary/20 transition-all font-medium"
                                                    />
                                                    <Button
                                                        type="submit"
                                                        size="icon"
                                                        disabled={!commentText.trim() || isCommenting}
                                                        className="absolute right-1.5 top-1.5 h-9 w-9 bg-primary shadow-lg shadow-primary/20 rounded-xl hover:scale-105 transition-all text-primary-foreground disabled:opacity-0"
                                                    >
                                                        {isCommenting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                                    </Button>
                                                </form>
                                            </div>
                                        </div>

                                        {/* Comments List */}
                                        <div className="space-y-6 pl-1">
                                            {(selectedTask.taskComments || []).map((comment: any) => (
                                                <div key={comment.id} className="flex items-start gap-4 group">
                                                    <Avatar className="h-10 w-10 border-2 border-background shadow-sm shrink-0">
                                                        <AvatarImage src={comment.user?.image} />
                                                        <AvatarFallback className="text-[10px] font-black bg-muted">
                                                            {comment.user?.name?.substring(0, 2).toUpperCase()}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div className="flex-1 space-y-1.5">
                                                        <div className="flex items-center gap-3">
                                                            <span className="text-[11px] font-black tracking-tight">{comment.user?.name}</span>
                                                            <span className="text-[9px] font-bold text-muted-foreground opacity-40">{new Date(comment.createdAt).toLocaleString()}</span>
                                                        </div>
                                                        <div className="p-4 bg-muted/10 rounded-2xl rounded-tl-none text-sm font-medium leading-relaxed border border-border/10 group-hover:border-primary/10 transition-colors">
                                                            {comment.content}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Sidebar Info Area */}
                            <div className="w-full md:w-80 bg-muted/5 p-10 space-y-10 flex flex-col shrink-0">
                                <div className="space-y-10">
                                    {/* Status Info */}
                                    <div className="space-y-4">
                                        <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 ml-1">Current Status</Label>
                                        <Select
                                            value={isModalEditing ? editingTask.status : selectedTask.status}
                                            onValueChange={(v) => isModalEditing ? setEditingTask({ ...editingTask, status: v }) : handleUpdateTask(selectedTask.id, { status: v })}
                                        >
                                            <SelectTrigger className="h-12 bg-background border-none shadow-sm rounded-xl font-black uppercase text-[10px] tracking-widest ring-1 ring-border/40 hover:ring-primary/20 transition-all">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-xl border-none shadow-2xl">
                                                {STATUS_COLUMNS.map(c => (
                                                    <SelectItem key={c.id} value={c.id} className="text-[10px] font-black uppercase tracking-widest">{c.label}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {/* Priority Info */}
                                    <div className="space-y-4">
                                        <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 ml-1">Priority Level</Label>
                                        <Select
                                            value={isModalEditing ? editingTask.priority : selectedTask.priority}
                                            onValueChange={(v) => isModalEditing ? setEditingTask({ ...editingTask, priority: v }) : handleUpdateTask(selectedTask.id, { priority: v })}
                                        >
                                            <SelectTrigger className="h-12 bg-background border-none shadow-sm rounded-xl font-black uppercase text-[10px] tracking-widest ring-1 ring-border/40 hover:ring-primary/20 transition-all">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-xl border-none shadow-2xl">
                                                {PRIORITIES.map(p => (
                                                    <SelectItem key={p} value={p} className="text-[10px] font-black uppercase tracking-widest">{p}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {/* Member Assignments */}
                                    <div className="space-y-4">
                                        <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 ml-1">Team Assignment</Label>
                                        <Select
                                            value={isModalEditing ? editingTask.assigneeId : selectedTask.assigneeId}
                                            onValueChange={(v) => isModalEditing ? setEditingTask({ ...editingTask, assigneeId: v }) : handleUpdateTask(selectedTask.id, { assigneeId: v })}
                                        >
                                            <SelectTrigger className="h-16 bg-background border-none shadow-sm rounded-2xl ring-1 ring-border/40 hover:ring-primary/20 transition-all pr-4">
                                                <div className="flex items-center gap-3">
                                                    <Avatar className="h-8 w-8 rounded-xl ring-2 ring-background">
                                                        <AvatarImage src={(isModalEditing ? editingTask : selectedTask).assignee?.image} />
                                                        <AvatarFallback className="text-[10px] font-black bg-primary/5 text-primary">
                                                            {((isModalEditing ? editingTask : selectedTask).assignee?.name || "?").substring(0, 2).toUpperCase()}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div className="text-left">
                                                        <p className="text-[12px] font-black leading-none">{(isModalEditing ? editingTask : selectedTask).assignee?.name || "Unassigned"}</p>
                                                        <p className="text-[9px] text-muted-foreground font-black uppercase tracking-tighter mt-1 opacity-50">Assignee</p>
                                                    </div>
                                                </div>
                                            </SelectTrigger>
                                            <SelectContent className="rounded-xl border-none shadow-2xl p-2 max-h-[300px]">
                                                {employees.map(e => (
                                                    <SelectItem key={e.id} value={e.id} className="rounded-lg py-2">
                                                        <div className="flex items-center gap-3">
                                                            <Avatar className="h-6 w-6 rounded-md"><AvatarImage src={e.image} /><AvatarFallback className="text-[8px] font-bold">{e.name?.substring(0, 2)}</AvatarFallback></Avatar>
                                                            <span className="text-xs font-bold">{e.name}</span>
                                                        </div>
                                                    </SelectItem>
                                                ))}
                                                <SelectItem value="" className="rounded-lg py-2 text-muted-foreground italic">Unassigned</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {/* Metadata Section */}
                                    <div className="space-y-4 pt-10 border-t border-border/40">
                                        <div className="flex flex-col gap-4">
                                            <div className="flex flex-col">
                                                <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground opacity-30">Reporter</span>
                                                <span className="text-[11px] font-bold mt-1 inline-flex items-center gap-2">
                                                    <Avatar className="h-4 w-4"><AvatarImage src={selectedTask.reporter?.image} /><AvatarFallback className="text-[6px] font-black">{selectedTask.reporter?.name?.substring(0, 2)}</AvatarFallback></Avatar>
                                                    {selectedTask.reporter?.name || "System"}
                                                </span>
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground opacity-30">Created on</span>
                                                <span className="text-[11px] font-bold mt-1">{new Date(selectedTask.createdAt).toLocaleDateString(undefined, { dateStyle: 'long' })}</span>
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground opacity-30">Last Update</span>
                                                <span className="text-[11px] font-bold mt-1 text-primary italic">{new Date(selectedTask.updatedAt).toLocaleTimeString()}</span>
                                            </div>
                                        </div>

                                        <div className="pt-6">
                                            <button className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-primary transition-all group/attach">
                                                <Paperclip className="h-3.5 w-3.5 group-hover/attach:rotate-12 transition-transform" />
                                                <span>Attachments</span>
                                                <Badge variant="secondary" className="ml-auto text-[8px] h-4 px-1.5 opacity-50">0</Badge>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </DialogContent>
                )}
            </Dialog>
        </div>
    );
}
