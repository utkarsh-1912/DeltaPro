"use client";

import { useState, useEffect } from "react";
import { Plus, Filter, Search, MoreHorizontal, AlertCircle, CheckCircle2, Circle, Clock, Loader2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const STATUS_COLUMNS = [
    { id: "TODO", label: "To Do", icon: Circle, color: "text-slate-400" },
    { id: "IN_PROGRESS", label: "In Progress", icon: Clock, color: "text-blue-500" },
    { id: "REVIEW", label: "In Review", icon: AlertCircle, color: "text-amber-500" },
    { id: "DONE", label: "Done", icon: CheckCircle2, color: "text-emerald-500" },
];

const PRIORITY_STYLES = {
    LOW: "bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-400",
    MEDIUM: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-400",
    HIGH: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-400",
    URGENT: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400 border-rose-200",
};

export default function TasksPage() {
    const { toast } = useToast();
    const [tasks, setTasks] = useState<any[]>([]);
    const [projects, setProjects] = useState<any[]>([]);
    const [employees, setEmployees] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [newTask, setNewTask] = useState({
        title: "", description: "", projectId: "", assigneeId: "", priority: "MEDIUM", type: "TASK"
    });

    const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

    const fetchData = async () => {
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
    };

    useEffect(() => {
        fetchData();
    }, []);

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
                setNewTask({ title: "", description: "", projectId: "", assigneeId: "", priority: "MEDIUM", type: "TASK" });
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

    const handleDragStart = (e: React.DragEvent, id: string) => {
        setDraggedTaskId(id);
        e.dataTransfer.effectAllowed = "move";
        // Optionally store data in dataTransfer
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
    };

    const handleDrop = async (e: React.DragEvent, status: string) => {
        e.preventDefault();
        if (!draggedTaskId) return;

        // Optimistic update
        const updatedTasks = tasks.map(t => t.id === draggedTaskId ? { ...t, status } : t);
        setTasks(updatedTasks);
        setDraggedTaskId(null);

        try {
            const res = await fetch(`/api/tasks/${draggedTaskId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status })
            });

            if (!res.ok) {
                throw new Error("Update failed");
            }
            toast({ title: "Status Updated", description: "Task moved successfully." });
        } catch (error) {
            toast({ title: "Error", description: "Failed to update task status.", variant: "destructive" });
            fetchData(); // Revert on failure
        }
    };

    const filteredTasks = tasks.filter((t: any) =>
        t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.key.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getTasksByStatus = (status: string) => filteredTasks.filter((t: any) => t.status === status);

    const uniqueAssignees = Array.from(new Set(tasks.map(t => t.assigneeId))).filter(Boolean);

    return (
        <div className="flex flex-col h-[calc(100vh-8rem)] gap-6">
            <div className="flex flex-col gap-4 shrink-0">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-extrabold tracking-tight">Active Tasks</h1>
                        <p className="text-sm text-muted-foreground mt-1">Multi-Project Enterprise Kanban Board</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button variant="outline" className="rounded-full"><Filter className="mr-2 h-4 w-4" /> Filters</Button>
                        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                            <DialogTrigger asChild>
                                <Button className="rounded-full shadow-lg shadow-primary/20 hover:shadow-primary/30"><Plus className="mr-2 h-4 w-4" /> New Task</Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[500px] border-none shadow-2xl bg-background/95 backdrop-blur-xl">
                                <form onSubmit={handleCreateTask}>
                                    <DialogHeader>
                                        <DialogTitle>Create New Task</DialogTitle>
                                        <DialogDescription>Add a new work item to a project board.</DialogDescription>
                                    </DialogHeader>
                                    <div className="grid gap-4 py-6">
                                        <div className="space-y-2">
                                            <Label htmlFor="title">Task Title</Label>
                                            <Input id="title" required placeholder="e.g. Implement OAuth Flow" value={newTask.title} onChange={(e) => setNewTask({ ...newTask, title: e.target.value })} />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label>Project</Label>
                                                <Select value={newTask.projectId} onValueChange={(v) => setNewTask({ ...newTask, projectId: v })}>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select project" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {projects.map(p => (
                                                            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Assignee</Label>
                                                <Select value={newTask.assigneeId} onValueChange={(v) => setNewTask({ ...newTask, assigneeId: v })}>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Unassigned" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="unassigned">Unassigned</SelectItem>
                                                        {employees.map(e => (
                                                            <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label>Priority</Label>
                                                <Select value={newTask.priority} onValueChange={(v) => setNewTask({ ...newTask, priority: v })}>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Priority" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="LOW">Low</SelectItem>
                                                        <SelectItem value="MEDIUM">Medium</SelectItem>
                                                        <SelectItem value="HIGH">High</SelectItem>
                                                        <SelectItem value="URGENT">Urgent</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Type</Label>
                                                <Select value={newTask.type} onValueChange={(v) => setNewTask({ ...newTask, type: v })}>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Type" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="TASK">Task</SelectItem>
                                                        <SelectItem value="BUG">Bug</SelectItem>
                                                        <SelectItem value="STORY">Story</SelectItem>
                                                        <SelectItem value="EPIC">Epic</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="description">Description</Label>
                                            <Textarea id="description" placeholder="Task requirements and context..." value={newTask.description} onChange={(e) => setNewTask({ ...newTask, description: e.target.value })} className="h-24" />
                                        </div>
                                    </div>
                                    <DialogFooter>
                                        <Button type="button" variant="ghost" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                                        <Button type="submit" disabled={isCreating}>
                                            {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                            Create Task
                                        </Button>
                                    </DialogFooter>
                                </form>
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>
                <div className="flex items-center gap-4 bg-muted/30 p-2 rounded-2xl border">
                    <div className="flex px-2 -space-x-2">
                        {uniqueAssignees.slice(0, 4).map((assigneeId: any) => {
                            const task = tasks.find(t => t.assigneeId === assigneeId) as any;
                            return (
                                <Avatar key={assigneeId} className="h-8 w-8 border-2 border-background ring-2 ring-muted shadow-sm hover:z-10 hover:scale-110 transition-transform">
                                    <AvatarImage src={task?.assignee?.image} />
                                    <AvatarFallback className="text-[10px] bg-primary/10 font-bold">{task?.assignee?.name?.substring(0, 2).toUpperCase()}</AvatarFallback>
                                </Avatar>
                            );
                        })}
                        {uniqueAssignees.length > 4 && (
                            <div className="h-8 w-8 rounded-full bg-background border-2 border-background flex items-center justify-center text-[10px] font-bold shadow-sm z-10">
                                +{uniqueAssignees.length - 4}
                            </div>
                        )}
                        {uniqueAssignees.length === 0 && (
                            <span className="text-xs text-muted-foreground mr-2 font-medium">No active task assignees</span>
                        )}
                    </div>
                    <div className="h-6 w-px bg-border/60 mx-1" />
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Quick search by ID or title..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 bg-transparent border-none shadow-none focus-visible:ring-0 h-9"
                        />
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-x-auto flex gap-6 pb-4 snap-x">
                {STATUS_COLUMNS.map((column) => (
                    <div
                        key={column.id}
                        className="min-w-[340px] max-w-[340px] flex flex-col gap-4 bg-muted/10 rounded-3xl p-4 border snap-center"
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, column.id)}
                    >
                        <div className="flex items-center justify-between px-2 mb-2">
                            <div className="flex items-center gap-2">
                                <column.icon className={cn("h-5 w-5", column.color)} />
                                <span className="font-extrabold text-sm tracking-widest uppercase">{column.label}</span>
                                <Badge variant="secondary" className="h-5 px-1.5 font-bold text-[10px] rounded-sm">{getTasksByStatus(column.id).length}</Badge>
                            </div>
                            <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full hover:bg-background"><MoreHorizontal className="h-4 w-4" /></Button>
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin scrollbar-thumb-muted">
                            <AnimatePresence>
                                {isLoading ? (
                                    [1, 2].map(i => <div key={i} className="h-32 bg-background/50 rounded-2xl animate-pulse" />)
                                ) : getTasksByStatus(column.id).map((task: any, idx: number) => (
                                    <motion.div
                                        key={task.id}
                                        layout
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.9 }}
                                        whileHover={{ y: -4 }}
                                        transition={{ type: "spring", stiffness: 300, damping: 24 }}
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, task.id)}
                                    >
                                        <Card className="shadow-sm hover:shadow-xl hover:border-primary/40 transition-all border shadow-primary/5 cursor-grab active:cursor-grabbing rounded-2xl bg-card/80 backdrop-blur-sm">
                                            <CardHeader className="p-4 pb-2 space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <Badge variant="outline" className="text-[9px] uppercase tracking-widest font-bold py-0.5 border-primary/20 bg-primary/5 text-primary">
                                                        {task.project?.key}-{task.key}
                                                    </Badge>
                                                    <Badge className={cn("text-[9px] font-bold py-0.5", PRIORITY_STYLES[task.priority as keyof typeof PRIORITY_STYLES])}>
                                                        {task.priority}
                                                    </Badge>
                                                </div>
                                                <CardTitle className="text-sm font-bold leading-snug">
                                                    {task.title}
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent className="p-4 py-2">
                                                <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                                                    {task.description || "No description provided."}
                                                </p>
                                            </CardContent>
                                            <CardFooter className="p-4 pt-3 flex items-center justify-between border-t bg-muted/20">
                                                <div className="flex items-center gap-2">
                                                    <Avatar className="h-6 w-6 ring-2 ring-background shadow-sm">
                                                        <AvatarImage src={task.assignee?.image} />
                                                        <AvatarFallback className="text-[9px] bg-primary/10 text-primary font-bold">
                                                            {(task.assignee?.name || "?").substring(0, 2).toUpperCase()}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <span className="text-[10px] font-bold text-muted-foreground truncate max-w-[100px]">
                                                        {task.assignee?.name || "Unassigned"}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-1.5 text-muted-foreground/80 bg-background px-2 py-0.5 rounded-full border">
                                                    <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
                                                    <span className="text-[9px] font-extrabold tracking-wider">{task.type}</span>
                                                </div>
                                            </CardFooter>
                                        </Card>
                                    </motion.div>
                                ))}
                            </AnimatePresence>

                            {!isLoading && (
                                <Button
                                    variant="ghost"
                                    className="w-full border-2 border-dashed border-muted-foreground/20 text-muted-foreground hover:text-primary hover:border-primary/50 hover:bg-primary/5 text-xs font-bold h-12 group transition-all rounded-2xl mt-2"
                                    onClick={() => {
                                        setNewTask(prev => ({ ...prev, status: column.id }));
                                        setIsCreateOpen(true);
                                    }}
                                >
                                    <Plus className="mr-2 h-4 w-4 group-hover:scale-125 transition-transform" /> Add Task
                                </Button>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
