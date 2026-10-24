"use client";

import { useState, useEffect, useCallback, useMemo, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Plus, Search, AlertCircle, CheckCircle2, Circle, Clock, Loader2, ChevronsUp, ChevronUp, ChevronDown, MessageSquare, UserPlus, X, Send, Columns3, Grid3x3, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { PageHeader, FieldLabel, Segmented, PersonAvatar, EmptyState } from "@/components/page";
import { EASE } from "@/components/motion";

const STATUS_COLUMNS = [
    { id: "TODO", label: "To do", icon: Circle, color: "text-muted-foreground" },
    { id: "IN_PROGRESS", label: "In progress", icon: Clock, color: "text-signal" },
    { id: "REVIEW", label: "In review", icon: AlertCircle, color: "text-amber-500" },
    { id: "DONE", label: "Done", icon: CheckCircle2, color: "text-emerald-500" },
];

const PRIORITIES = ["URGENT", "HIGH", "MEDIUM", "LOW"] as const;

const PRIORITY_ICONS = {
    URGENT: { icon: ChevronsUp, color: "text-destructive", label: "Urgent" },
    HIGH: { icon: ChevronUp, color: "text-amber-600", label: "High" },
    MEDIUM: { icon: ChevronUp, color: "text-signal", label: "Medium" },
    LOW: { icon: ChevronDown, color: "text-muted-foreground", label: "Low" },
};

const UNASSIGNED = "__unassigned__";
const EMPTY_TASK = { title: "", description: "", projectId: "", assigneeId: "", priority: "MEDIUM", type: "TASK", status: "TODO" };

export default function TasksPage() {
    return (
        <Suspense fallback={null}>
            <TasksBoard />
        </Suspense>
    );
}

function TasksBoard() {
    const { toast } = useToast();
    const { data: session } = useSession();
    const searchParams = useSearchParams();
    const router = useRouter();

    const [tasks, setTasks] = useState<any[]>([]);
    const [projects, setProjects] = useState<any[]>([]);
    const [employees, setEmployees] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [view, setView] = useState<"board" | "matrix">("board");
    const [query, setQuery] = useState("");

    const [filterAssignees, setFilterAssignees] = useState<string[]>([]);
    const [filterPriorities, setFilterPriorities] = useState<string[]>([]);
    const [filterProjects, setFilterProjects] = useState<string[]>(() => {
        const p = searchParams.get("project");
        return p ? [p] : [];
    });

    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [newTask, setNewTask] = useState(EMPTY_TASK);

    const [selectedTask, setSelectedTask] = useState<any>(null);
    const [editingTask, setEditingTask] = useState<any>(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [isModalEditing, setIsModalEditing] = useState(false);
    const [commentText, setCommentText] = useState("");
    const [isCommenting, setIsCommenting] = useState(false);

    const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
    const [dropTarget, setDropTarget] = useState<string | null>(null);

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

    // Keep ?project= in sync with a single-project filter so the view can be linked to.
    useEffect(() => {
        const current = searchParams.get("project");
        const next = filterProjects.length === 1 ? filterProjects[0] : null;
        if (current !== next) router.replace(next ? `/tasks?project=${next}` : "/tasks", { scroll: false });
    }, [filterProjects, searchParams, router]);

    const openCreate = (preset: Partial<typeof EMPTY_TASK> = {}) => {
        setNewTask({ ...EMPTY_TASK, projectId: filterProjects.length === 1 ? filterProjects[0] : "", ...preset });
        setIsCreateOpen(true);
    };

    const handleCreateTask = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTask.title || !newTask.projectId) {
            toast({ title: "Title and project are required", variant: "destructive" });
            return;
        }
        setIsCreating(true);
        try {
            const res = await fetch("/api/tasks", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...newTask, assigneeId: newTask.assigneeId || undefined }),
            });
            if (res.ok) {
                toast({ title: "Task created" });
                setIsCreateOpen(false);
                setNewTask(EMPTY_TASK);
                fetchData();
            } else {
                const err = await res.json().catch(() => ({}));
                toast({ title: "Could not create task", description: err.error, variant: "destructive" });
            }
        } catch (error) {
            toast({ title: "Error", description: "An unexpected error occurred.", variant: "destructive" });
        } finally {
            setIsCreating(false);
        }
    };

    const handleUpdateTask = async (id: string, data: any) => {
        setIsUpdating(true);
        if ("assigneeId" in data) {
            const emp = employees.find(e => e.id === data.assigneeId) ?? null;
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
            if (!res.ok) throw new Error("Update failed");
            const updated = await res.json();
            setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updated } : t));
            if (selectedTask?.id === id) {
                setSelectedTask((prev: any) => ({ ...prev, ...updated }));
                setEditingTask((prev: any) => ({ ...prev, ...updated }));
            }
        } catch (error) {
            toast({ title: "Update failed", description: "Could not save changes.", variant: "destructive" });
            fetchData();
        } finally {
            setIsUpdating(false);
        }
    };

    const handleModalSave = async () => {
        if (!editingTask) return;
        await handleUpdateTask(editingTask.id, {
            title: editingTask.title,
            description: editingTask.description,
            status: editingTask.status,
            priority: editingTask.priority,
            assigneeId: editingTask.assigneeId || null,
            type: editingTask.type,
        });
        toast({ title: "Task saved" });
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
                setSelectedTask((prev: any) => ({ ...prev, taskComments: [newComment, ...(prev.taskComments || [])] }));
                setTasks(prev => prev.map(t => t.id === selectedTask.id ? { ...t, taskComments: [newComment, ...(t.taskComments || [])] } : t));
            } else {
                toast({ title: "Could not post comment", variant: "destructive" });
            }
        } catch (err) {
            toast({ title: "Error", description: "An unexpected error occurred.", variant: "destructive" });
        } finally {
            setIsCommenting(false);
        }
    };

    const moveTask = async (id: string, status: string, priority?: string) => {
        const task = tasks.find(t => t.id === id);
        if (!task || (task.status === status && (!priority || task.priority === priority))) return;
        const patch = priority ? { status, priority } : { status };
        setTasks(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t));
        try {
            const res = await fetch(`/api/tasks/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(patch)
            });
            if (!res.ok) throw new Error("Update failed");
        } catch (error) {
            toast({ title: "Could not move task", variant: "destructive" });
            fetchData();
        }
    };

    const dropProps = (key: string, status: string, priority?: string) => ({
        onDragOver: (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (dropTarget !== key) setDropTarget(key); },
        onDragLeave: () => setDropTarget(t => (t === key ? null : t)),
        onDrop: (e: React.DragEvent) => {
            e.preventDefault();
            setDropTarget(null);
            if (draggedTaskId) moveTask(draggedTaskId, status, priority);
            setDraggedTaskId(null);
        },
    });

    const filteredTasks = useMemo(() => {
        const q = query.trim().toLowerCase();
        return tasks.filter((t: any) => {
            const assigneeKey = t.assigneeId || UNASSIGNED;
            if (filterAssignees.length && !filterAssignees.includes(assigneeKey)) return false;
            if (filterPriorities.length && !filterPriorities.includes(t.priority)) return false;
            if (filterProjects.length && !filterProjects.includes(t.projectId)) return false;
            if (q && !(`${t.title} ${t.project?.key}-${t.key} ${t.assignee?.name ?? ""}`.toLowerCase().includes(q))) return false;
            return true;
        });
    }, [tasks, filterAssignees, filterPriorities, filterProjects, query]);

    const openTaskDetail = (task: any) => {
        setSelectedTask(task);
        setEditingTask(task);
        setIsDetailOpen(true);
        setIsModalEditing(false);
    };

    const toggle = (setter: React.Dispatch<React.SetStateAction<string[]>>, v: string) =>
        setter(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]);
    const anyFilter = filterAssignees.length + filterPriorities.length + filterProjects.length > 0 || !!query;
    const doneCount = filteredTasks.filter(t => t.status === "DONE").length;
    const activeProject = filterProjects.length === 1 ? projects.find(p => p.id === filterProjects[0]) : null;

    const FilterMenu = ({ label, values, options, onToggle, onClear }: {
        label: string; values: string[]; options: { value: string; label: string }[]; onToggle: (v: string) => void; onClear: () => void;
    }) => (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className={cn("gap-1.5", values.length > 0 && "border-signal/60 text-foreground")}>
                    {label}
                    {values.length > 0 && <span className="rounded bg-signal px-1 font-mono text-[10px] text-white">{values.length}</span>}
                    <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="max-h-[320px] w-56 overflow-y-auto">
                {options.map(o => (
                    <DropdownMenuItem key={o.value} onSelect={(ev) => { ev.preventDefault(); onToggle(o.value); }} className="gap-2">
                        <span className={cn("flex h-4 w-4 items-center justify-center rounded border", values.includes(o.value) && "border-signal bg-signal text-white")}>
                            {values.includes(o.value) && <Check className="h-3 w-3" />}
                        </span>
                        <span className="truncate">{o.label}</span>
                    </DropdownMenuItem>
                ))}
                {values.length > 0 && (
                    <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onSelect={onClear} className="justify-center text-muted-foreground">Clear</DropdownMenuItem>
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );

    const TaskCard = ({ task, showPriority }: { task: any; showPriority: boolean }) => {
        const pInfo = PRIORITY_ICONS[task.priority as keyof typeof PRIORITY_ICONS] ?? PRIORITY_ICONS.MEDIUM;
        const comments = task.taskComments?.length ?? 0;
        return (
            <motion.div layout="position" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }} transition={{ duration: 0.3, ease: EASE }}>
                <div
                    draggable
                    onDragStart={(e) => { setDraggedTaskId(task.id); e.dataTransfer.effectAllowed = "move"; }}
                    onDragEnd={() => { setDraggedTaskId(null); setDropTarget(null); }}
                    onClick={() => openTaskDetail(task)}
                    onKeyDown={(e) => { if (e.key === "Enter") openTaskDetail(task); }}
                    tabIndex={0}
                    role="button"
                    className={cn(
                        "group/card cursor-grab rounded-xl border bg-card p-3 outline-none transition-[border-color,box-shadow,opacity] hover:border-signal/50 focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing",
                        draggedTaskId === task.id && "opacity-40"
                    )}
                >
                    <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[11px] text-muted-foreground">{task.project?.key}-{task.key}</span>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 transition-opacity focus-visible:opacity-100 group-hover/card:opacity-100" aria-label="Assign">
                                    <UserPlus className="h-3.5 w-3.5" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="max-h-[300px] w-56 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                                <DropdownMenuLabel className="font-mono-label text-muted-foreground">Assign to</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                {employees.map(emp => (
                                    <DropdownMenuItem key={emp.id} onSelect={() => handleUpdateTask(task.id, { assigneeId: emp.id })} className="gap-3">
                                        <PersonAvatar name={emp.name} image={emp.image} size="sm" className="h-6 w-6 text-[9px]" />
                                        <span className="truncate">{emp.name}</span>
                                        {task.assigneeId === emp.id && <Check className="ml-auto h-3.5 w-3.5 text-signal" />}
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-sm font-medium leading-snug">{task.title}</p>
                    <div className="mt-3 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-muted-foreground">
                            {showPriority && <pInfo.icon className={cn("h-3.5 w-3.5", pInfo.color)} aria-label={pInfo.label} />}
                            <span className="font-mono text-[10px] uppercase tracking-wider">{task.type}</span>
                            {comments > 0 && <span className="flex items-center gap-1 text-[11px]"><MessageSquare className="h-3 w-3" />{comments}</span>}
                        </div>
                        {task.assignee ? (
                            <PersonAvatar name={task.assignee.name} image={task.assignee.image} size="sm" className="h-6 w-6 text-[9px]" />
                        ) : (
                            <span className="flex h-6 w-6 items-center justify-center rounded-full border border-dashed text-muted-foreground"><UserPlus className="h-3 w-3" /></span>
                        )}
                    </div>
                </div>
            </motion.div>
        );
    };

    const current = isModalEditing ? editingTask : selectedTask;

    return (
        <div className="flex h-[calc(100vh-7rem)] flex-col gap-6">
            <PageHeader
                eyebrow={<>Delivery · Tasks{activeProject ? <> · <span className="text-foreground">{activeProject.name}</span></> : null}</>}
                title={activeProject ? activeProject.name : "Tasks"}
                description={`${filteredTasks.length} task${filteredTasks.length === 1 ? "" : "s"} · ${doneCount} done`}
                className="pb-6"
                actions={
                    <>
                        <Segmented value={view} onChange={setView} options={[{ value: "board", label: "Board", icon: Columns3 }, { value: "matrix", label: "Matrix", icon: Grid3x3 }]} />
                        <Button onClick={() => openCreate()}><Plus className="h-4 w-4" /> New task</Button>
                    </>
                }
            />

            {/* Filters */}
            <div className="flex shrink-0 flex-wrap items-center gap-2">
                <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input placeholder="Search tasks…" value={query} onChange={(e) => setQuery(e.target.value)} className="h-9 pl-9" />
                </div>
                <FilterMenu label="Project" values={filterProjects} options={projects.map(p => ({ value: p.id, label: `${p.key} · ${p.name}` }))} onToggle={(v) => toggle(setFilterProjects, v)} onClear={() => setFilterProjects([])} />
                <FilterMenu label="Assignee" values={filterAssignees} options={[{ value: UNASSIGNED, label: "Unassigned" }, ...employees.map(e => ({ value: e.id, label: e.name }))]} onToggle={(v) => toggle(setFilterAssignees, v)} onClear={() => setFilterAssignees([])} />
                <FilterMenu label="Priority" values={filterPriorities} options={PRIORITIES.map(p => ({ value: p, label: PRIORITY_ICONS[p].label }))} onToggle={(v) => toggle(setFilterPriorities, v)} onClear={() => setFilterPriorities([])} />
                {session?.user?.id && (
                    <Button variant="ghost" size="sm" onClick={() => setFilterAssignees(a => a.length === 1 && a[0] === session.user.id ? [] : [session.user.id])} className={cn(filterAssignees.length === 1 && filterAssignees[0] === session.user.id && "bg-secondary")}>
                        Assigned to me
                    </Button>
                )}
                {anyFilter && (
                    <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => { setFilterAssignees([]); setFilterPriorities([]); setFilterProjects([]); setQuery(""); }}>
                        <X className="h-3.5 w-3.5" /> Reset
                    </Button>
                )}
            </div>

            {/* Board */}
            <div className="min-h-0 flex-1 overflow-auto pb-6">
                {isLoading ? (
                    <div className="grid min-w-[960px] grid-cols-4 gap-4">
                        {STATUS_COLUMNS.map(c => <div key={c.id} className="h-[420px] animate-pulse rounded-2xl border bg-card" />)}
                    </div>
                ) : tasks.length === 0 ? (
                    <div className="rounded-2xl border bg-card">
                        <EmptyState icon={Columns3} title="No tasks yet" description="Create the first task for one of your projects." action={<Button onClick={() => openCreate()}><Plus className="h-4 w-4" /> New task</Button>} />
                    </div>
                ) : view === "board" ? (
                    <div className="grid h-full min-w-[960px] grid-cols-4 gap-4">
                        {STATUS_COLUMNS.map(column => {
                            const items = filteredTasks.filter(t => t.status === column.id);
                            const key = `col-${column.id}`;
                            return (
                                <section
                                    key={column.id}
                                    {...dropProps(key, column.id)}
                                    className={cn(
                                        "flex min-h-0 flex-col rounded-2xl border bg-secondary/30 transition-colors",
                                        dropTarget === key && "border-signal bg-signal/5"
                                    )}
                                >
                                    <header className="flex items-center gap-2 border-b px-4 py-3">
                                        <column.icon className={cn("h-4 w-4", column.color)} />
                                        <h2 className="text-sm font-medium">{column.label}</h2>
                                        <span className="ml-auto font-mono text-[11px] text-muted-foreground">{items.length}</span>
                                    </header>
                                    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2">
                                        <AnimatePresence initial={false}>
                                            {items
                                                .slice()
                                                .sort((a, b) => PRIORITIES.indexOf(a.priority) - PRIORITIES.indexOf(b.priority))
                                                .map((task: any) => <TaskCard key={task.id} task={task} showPriority />)}
                                        </AnimatePresence>
                                        <button
                                            onClick={() => openCreate({ status: column.id })}
                                            className="mt-1 flex h-9 items-center justify-center gap-1.5 rounded-xl border border-dashed text-sm text-muted-foreground transition-colors hover:border-signal/50 hover:text-foreground"
                                        >
                                            <Plus className="h-3.5 w-3.5" /> Add
                                        </button>
                                    </div>
                                </section>
                            );
                        })}
                    </div>
                ) : (
                    <div className="min-w-[1000px]">
                        <div className="sticky top-0 z-10 grid grid-cols-[110px_repeat(4,1fr)] gap-3 border-b bg-background/95 pb-2 backdrop-blur">
                            <div className="font-mono-label self-end px-2 text-muted-foreground">Priority</div>
                            {STATUS_COLUMNS.map(column => (
                                <div key={column.id} className="flex items-center gap-2 px-2 py-1">
                                    <column.icon className={cn("h-4 w-4", column.color)} />
                                    <span className="text-sm font-medium">{column.label}</span>
                                    <span className="ml-auto font-mono text-[11px] text-muted-foreground">{filteredTasks.filter(t => t.status === column.id).length}</span>
                                </div>
                            ))}
                        </div>
                        <div className="mt-3 space-y-3">
                            {PRIORITIES.map((priority) => {
                                const pInfo = PRIORITY_ICONS[priority];
                                return (
                                    <div key={priority} className="grid min-h-[132px] grid-cols-[110px_repeat(4,1fr)] gap-3">
                                        <div className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border bg-card">
                                            <pInfo.icon className={cn("h-5 w-5", pInfo.color)} />
                                            <span className="font-mono-label">{pInfo.label}</span>
                                            <span className="font-mono text-[11px] text-muted-foreground">{filteredTasks.filter(t => t.priority === priority).length}</span>
                                        </div>
                                        {STATUS_COLUMNS.map((column) => {
                                            const key = `${priority}-${column.id}`;
                                            return (
                                                <div
                                                    key={key}
                                                    {...dropProps(key, column.id, priority)}
                                                    className={cn("group flex flex-col gap-2 rounded-2xl border border-dashed p-2 transition-colors", dropTarget === key ? "border-signal bg-signal/5" : "hover:bg-secondary/40")}
                                                >
                                                    <AnimatePresence initial={false}>
                                                        {filteredTasks
                                                            .filter(t => t.priority === priority && t.status === column.id)
                                                            .map((task: any) => <TaskCard key={task.id} task={task} showPriority={false} />)}
                                                    </AnimatePresence>
                                                    <button
                                                        onClick={() => openCreate({ status: column.id, priority })}
                                                        className="mt-auto flex h-8 items-center justify-center rounded-lg text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
                                                        aria-label={`Add ${pInfo.label.toLowerCase()} task to ${column.label}`}
                                                    >
                                                        <Plus className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Create */}
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogContent className="sm:max-w-[520px]">
                    <form onSubmit={handleCreateTask}>
                        <DialogHeader>
                            <p className="font-mono-label text-muted-foreground">
                                New task · {STATUS_COLUMNS.find(c => c.id === newTask.status)?.label} · {PRIORITY_ICONS[newTask.priority as keyof typeof PRIORITY_ICONS]?.label}
                            </p>
                            <DialogTitle className="text-2xl">What needs doing?</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-5 py-6">
                            <div className="space-y-2">
                                <FieldLabel htmlFor="task-title">Title</FieldLabel>
                                <Input id="task-title" required autoFocus placeholder="Short, specific summary" value={newTask.title} onChange={(e) => setNewTask({ ...newTask, title: e.target.value })} />
                            </div>
                            <div className="space-y-2">
                                <FieldLabel htmlFor="task-desc">Description</FieldLabel>
                                <Textarea id="task-desc" placeholder="Context, acceptance criteria, links…" value={newTask.description} onChange={(e) => setNewTask({ ...newTask, description: e.target.value })} className="min-h-[90px]" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <FieldLabel>Project</FieldLabel>
                                    <Select value={newTask.projectId} onValueChange={(v) => setNewTask({ ...newTask, projectId: v })}>
                                        <SelectTrigger><SelectValue placeholder="Choose project" /></SelectTrigger>
                                        <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.key} · {p.name}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <FieldLabel>Priority</FieldLabel>
                                    <Select value={newTask.priority} onValueChange={(v) => setNewTask({ ...newTask, priority: v })}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>{PRIORITIES.map(p => <SelectItem key={p} value={p}>{PRIORITY_ICONS[p].label}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <FieldLabel>Assignee</FieldLabel>
                                <Select value={newTask.assigneeId || UNASSIGNED} onValueChange={(v) => setNewTask({ ...newTask, assigneeId: v === UNASSIGNED ? "" : v })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                                        {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={isCreating || projects.length === 0}>{isCreating && <Loader2 className="h-4 w-4 animate-spin" />} Create task</Button>
                        </DialogFooter>
                        {projects.length === 0 && <p className="mt-3 text-sm text-muted-foreground">Create a project first; every task belongs to one.</p>}
                    </form>
                </DialogContent>
            </Dialog>

            {/* Detail */}
            <Dialog open={isDetailOpen} onOpenChange={(open) => { setIsDetailOpen(open); if (!open) setIsModalEditing(false); }}>
                {selectedTask && current && (
                    <DialogContent className="h-[88vh] overflow-hidden p-0 sm:max-w-[960px]">
                        <DialogTitle className="sr-only">{selectedTask.title}</DialogTitle>
                        <DialogDescription className="sr-only">Task details, comments and status.</DialogDescription>
                        <div className="flex h-full flex-col md:flex-row">
                            <div className="flex-1 overflow-y-auto border-r p-8">
                                <div className="mb-6 flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-2">
                                        <span className="rounded-md border px-2 py-0.5 font-mono text-xs">{selectedTask.project?.key}-{selectedTask.key}</span>
                                        <span className="font-mono-label text-muted-foreground">{selectedTask.type}</span>
                                    </div>
                                    <div className="flex items-center gap-2 pr-8">
                                        {isModalEditing ? (
                                            <>
                                                <Button variant="ghost" size="sm" onClick={() => { setEditingTask(selectedTask); setIsModalEditing(false); }}>Cancel</Button>
                                                <Button size="sm" onClick={handleModalSave} disabled={isUpdating}>{isUpdating && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save</Button>
                                            </>
                                        ) : (
                                            <Button variant="outline" size="sm" onClick={() => setIsModalEditing(true)}>Edit</Button>
                                        )}
                                    </div>
                                </div>

                                {isModalEditing ? (
                                    <Input value={editingTask.title} onChange={(e) => setEditingTask({ ...editingTask, title: e.target.value })} className="h-12 text-xl font-semibold" />
                                ) : (
                                    <h2 className="text-3xl font-semibold leading-tight tracking-tight">{selectedTask.title}</h2>
                                )}

                                <div className="mt-8 space-y-2">
                                    <FieldLabel>Description</FieldLabel>
                                    {isModalEditing ? (
                                        <Textarea value={editingTask.description || ""} onChange={(e) => setEditingTask({ ...editingTask, description: e.target.value })} className="min-h-[220px] leading-relaxed" placeholder="Add a description…" />
                                    ) : (
                                        <div className="min-h-[120px] whitespace-pre-wrap rounded-xl border bg-secondary/30 p-5 text-sm leading-relaxed">
                                            {selectedTask.description || <span className="text-muted-foreground">No description.</span>}
                                        </div>
                                    )}
                                </div>

                                <div className="mt-10 border-t pt-8">
                                    <div className="mb-5 flex items-center justify-between">
                                        <h3 className="flex items-center gap-2 font-medium"><MessageSquare className="h-4 w-4 text-signal" /> Comments</h3>
                                        <span className="font-mono text-[11px] text-muted-foreground">{selectedTask.taskComments?.length || 0}</span>
                                    </div>
                                    <form onSubmit={handleAddComment} className="flex items-start gap-3">
                                        <PersonAvatar name={session?.user?.name} image={session?.user?.image} />
                                        <div className="relative flex-1">
                                            <Input value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="Write a comment…" className="h-10 pr-11" />
                                            <Button type="submit" size="icon" disabled={!commentText.trim() || isCommenting} className="absolute right-1 top-1 h-8 w-8" aria-label="Post comment">
                                                {isCommenting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                            </Button>
                                        </div>
                                    </form>
                                    <ol className="mt-6 space-y-5">
                                        {(selectedTask.taskComments || []).map((comment: any) => (
                                            <li key={comment.id} className="flex items-start gap-3">
                                                <PersonAvatar name={comment.user?.name} image={comment.user?.image} />
                                                <div className="flex-1">
                                                    <div className="flex items-baseline gap-2">
                                                        <span className="text-sm font-medium">{comment.user?.name}</span>
                                                        <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}</span>
                                                    </div>
                                                    <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{comment.content}</p>
                                                </div>
                                            </li>
                                        ))}
                                    </ol>
                                </div>
                            </div>

                            <aside className="w-full shrink-0 space-y-6 overflow-y-auto bg-secondary/20 p-8 md:w-80">
                                <div className="space-y-2">
                                    <FieldLabel>Status</FieldLabel>
                                    <Select value={current.status} onValueChange={(v) => isModalEditing ? setEditingTask({ ...editingTask, status: v }) : handleUpdateTask(selectedTask.id, { status: v })}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>{STATUS_COLUMNS.map(c => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <FieldLabel>Priority</FieldLabel>
                                    <Select value={current.priority} onValueChange={(v) => isModalEditing ? setEditingTask({ ...editingTask, priority: v }) : handleUpdateTask(selectedTask.id, { priority: v })}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>{PRIORITIES.map(p => <SelectItem key={p} value={p}>{PRIORITY_ICONS[p].label}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <FieldLabel>Assignee</FieldLabel>
                                    <Select
                                        value={current.assigneeId || UNASSIGNED}
                                        onValueChange={(v) => {
                                            const id = v === UNASSIGNED ? null : v;
                                            if (isModalEditing) setEditingTask({ ...editingTask, assigneeId: id, assignee: employees.find(e => e.id === id) ?? null });
                                            else handleUpdateTask(selectedTask.id, { assigneeId: id });
                                        }}
                                    >
                                        <SelectTrigger className="h-auto py-2">
                                            <div className="flex items-center gap-3">
                                                <PersonAvatar name={current.assignee?.name} image={current.assignee?.image} size="sm" />
                                                <span className="text-sm">{current.assignee?.name || "Unassigned"}</span>
                                            </div>
                                        </SelectTrigger>
                                        <SelectContent className="max-h-[300px]">
                                            <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                                            {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <dl className="space-y-4 border-t pt-6 text-sm">
                                    <div>
                                        <dt className="font-mono-label text-muted-foreground">Reporter</dt>
                                        <dd className="mt-1.5 flex items-center gap-2"><PersonAvatar name={selectedTask.reporter?.name} image={selectedTask.reporter?.image} size="sm" className="h-6 w-6 text-[9px]" />{selectedTask.reporter?.name || "System"}</dd>
                                    </div>
                                    <div>
                                        <dt className="font-mono-label text-muted-foreground">Created</dt>
                                        <dd className="mt-1">{new Date(selectedTask.createdAt).toLocaleDateString(undefined, { dateStyle: "long" })}</dd>
                                    </div>
                                    <div>
                                        <dt className="font-mono-label text-muted-foreground">Updated</dt>
                                        <dd className="mt-1">{formatDistanceToNow(new Date(selectedTask.updatedAt), { addSuffix: true })}</dd>
                                    </div>
                                    {selectedTask.project && (
                                        <div>
                                            <dt className="font-mono-label text-muted-foreground">Project</dt>
                                            <dd className="mt-1">{selectedTask.project.name}</dd>
                                        </div>
                                    )}
                                </dl>
                            </aside>
                        </div>
                    </DialogContent>
                )}
            </Dialog>
        </div>
    );
}
