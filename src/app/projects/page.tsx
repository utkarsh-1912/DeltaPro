"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Plus, Briefcase, Search, Loader2, ArrowUpRight, CheckCircle2, Activity, ListChecks, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { PageHeader, StatGrid, Stat, Panel, EmptyState, StatusPill, FieldLabel, PersonAvatar } from "@/components/page";
import { EASE } from "@/components/motion";

type Filter = "all" | "In Progress" | "Not Started" | "Completed";
const statusKey = (s?: string) => (s === "Completed" ? "DONE" : s === "In Progress" ? "IN_PROGRESS" : "PENDING");

export default function ProjectsPage() {
    const { toast } = useToast();
    const { data: session } = useSession();
    const canCreate = !!session?.user;

    const [projects, setProjects] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [filter, setFilter] = useState<Filter>("all");

    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [newProject, setNewProject] = useState({ name: "", key: "", description: "" });

    const fetchProjects = async () => {
        setIsLoading(true);
        try {
            const res = await fetch("/api/projects");
            const data = await res.json();
            setProjects(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error(err);
            toast({ title: "Error", description: "Failed to fetch projects.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchProjects();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Suggest a key from the name until the user edits the key themselves.
    const [keyTouched, setKeyTouched] = useState(false);
    const suggestKey = (name: string) =>
        name.split(/\s+/).filter(Boolean).map(w => w[0]).join("").replace(/[^A-Za-z0-9]/g, "").slice(0, 4).toUpperCase()
        || name.replace(/[^A-Za-z0-9]/g, "").slice(0, 3).toUpperCase();

    const handleCreateProject = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newProject.name || !newProject.key) {
            toast({ title: "Name and key are required", variant: "destructive" });
            return;
        }
        setIsCreating(true);
        try {
            const res = await fetch("/api/projects", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: newProject.name,
                    key: newProject.key.toUpperCase(),
                    description: newProject.description
                }),
            });
            if (res.ok) {
                toast({ title: "Project created", description: newProject.name });
                setIsCreateOpen(false);
                setNewProject({ name: "", key: "", description: "" });
                setKeyTouched(false);
                fetchProjects();
            } else {
                const data = await res.json().catch(() => ({}));
                toast({ title: "Could not create project", description: data.error || "Try a different key.", variant: "destructive" });
            }
        } catch (error) {
            toast({ title: "Error", description: "An unexpected error occurred.", variant: "destructive" });
        } finally {
            setIsCreating(false);
        }
    };

    const counts = useMemo(() => ({
        all: projects.length,
        "In Progress": projects.filter(p => p.metrics?.status === "In Progress").length,
        "Not Started": projects.filter(p => !p.metrics?.status || p.metrics?.status === "Not Started").length,
        Completed: projects.filter(p => p.metrics?.status === "Completed").length,
    }), [projects]);
    const totalTasks = projects.reduce((s, p) => s + (p.metrics?.taskCount || 0), 0);
    const avgProgress = projects.length ? Math.round(projects.reduce((s, p) => s + (p.metrics?.progress || 0), 0) / projects.length) : 0;

    const filteredProjects = projects.filter((p: any) => {
        const q = searchTerm.toLowerCase();
        const status = p.metrics?.status || "Not Started";
        if (filter !== "all" && status !== filter) return false;
        return !q || p.name?.toLowerCase().includes(q) || p.key?.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q);
    });

    return (
        <div className="space-y-8">
            <PageHeader
                eyebrow="Delivery · Projects"
                title="Projects"
                description="Every initiative, its progress and the people on it."
                actions={canCreate && <Button onClick={() => setIsCreateOpen(true)}><Plus className="h-4 w-4" /> New project</Button>}
            />

            <StatGrid>
                <Stat label="Projects" value={projects.length} icon={Briefcase} tone="signal" />
                <Stat label="In progress" value={counts["In Progress"]} icon={Activity} hint={`${counts["Not Started"]} not started`} />
                <Stat label="Completed" value={counts.Completed} icon={CheckCircle2} tone="ok" />
                <Stat label="Average progress" value={`${avgProgress}%`} icon={ListChecks} hint={`${totalTasks} tasks in total`} progress={avgProgress} />
            </StatGrid>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex gap-1.5 overflow-x-auto">
                    {(["all", "In Progress", "Not Started", "Completed"] as Filter[]).map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={cn(
                                "shrink-0 rounded-full border px-3 py-1.5 text-sm transition-colors",
                                filter === f ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            {f === "all" ? "All" : f} <span className="ml-1 font-mono text-[11px] opacity-60">{counts[f]}</span>
                        </button>
                    ))}
                </div>
                <div className="relative w-full sm:w-72">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input placeholder="Find a project…" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
                </div>
            </div>

            {isLoading ? (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {[0, 1, 2].map(i => <div key={i} className="h-64 animate-pulse rounded-2xl border bg-card" />)}
                </div>
            ) : filteredProjects.length === 0 ? (
                <Panel>
                    <EmptyState
                        icon={Layers}
                        title={projects.length === 0 ? "No projects yet" : "Nothing matches"}
                        description={projects.length === 0 ? "Create a project to start tracking tasks against it." : "Try another search or filter."}
                        action={projects.length === 0 && canCreate ? <Button onClick={() => setIsCreateOpen(true)}><Plus className="h-4 w-4" /> New project</Button> : undefined}
                    />
                </Panel>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <AnimatePresence mode="popLayout">
                        {filteredProjects.map((project: any, idx) => {
                            const progress = project.metrics?.progress || 0;
                            const members: any[] = project.team?.members ?? [];
                            return (
                                <motion.div
                                    key={project.id}
                                    layout
                                    initial={{ opacity: 0, y: 16 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.96 }}
                                    transition={{ delay: Math.min(idx, 9) * 0.04, duration: 0.5, ease: EASE }}
                                >
                                    <Link
                                        href={`/tasks?project=${project.id}`}
                                        className="group relative flex h-full flex-col overflow-hidden rounded-2xl border bg-card outline-none transition-colors hover:border-signal/50 focus-visible:ring-2 focus-visible:ring-ring"
                                    >
                                        <div className="flex items-start justify-between p-6 pb-0">
                                            <span className="rounded-md border px-2 py-1 font-mono text-xs font-medium tracking-wider">{project.key}</span>
                                            <ArrowUpRight className="h-5 w-5 text-muted-foreground transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground" />
                                        </div>
                                        <div className="flex-1 p-6">
                                            <h3 className="line-clamp-1 text-xl font-semibold tracking-tight">{project.name}</h3>
                                            <p className="mt-2 line-clamp-2 min-h-[40px] text-sm text-muted-foreground">{project.description || "No description."}</p>

                                            <div className="mt-6 flex items-end justify-between">
                                                <p className="text-4xl font-semibold tabular-nums tracking-tight">{progress}<span className="text-lg text-muted-foreground">%</span></p>
                                                <p className="font-mono-label text-muted-foreground">{project.metrics?.taskCount || 0} tasks</p>
                                            </div>
                                            <div className="mt-3 h-1 overflow-hidden rounded-full bg-secondary">
                                                <motion.div
                                                    className={cn("h-full origin-left", project.metrics?.status === "Completed" ? "bg-emerald-500" : "bg-signal")}
                                                    initial={{ scaleX: 0 }}
                                                    whileInView={{ scaleX: progress / 100 }}
                                                    viewport={{ once: true }}
                                                    transition={{ duration: 1, ease: EASE }}
                                                />
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between border-t px-6 py-4">
                                            <div className="flex -space-x-2">
                                                {members.slice(0, 4).map((m: any) => <PersonAvatar key={m.id} name={m.name} image={m.image} size="sm" className="ring-2 ring-card" />)}
                                                {members.length > 4 && (
                                                    <div className="flex h-8 w-8 items-center justify-center rounded-full border bg-secondary font-mono text-[10px] ring-2 ring-card">+{members.length - 4}</div>
                                                )}
                                                {members.length === 0 && <span className="text-xs text-muted-foreground">No team</span>}
                                            </div>
                                            <div className="flex flex-col items-end gap-1">
                                                <StatusPill status={statusKey(project.metrics?.status)} label={project.metrics?.status || "Not started"} />
                                                {project.updatedAt && <span className="text-[11px] text-muted-foreground">updated {formatDistanceToNow(new Date(project.updatedAt), { addSuffix: true })}</span>}
                                            </div>
                                        </div>
                                    </Link>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                </div>
            )}

            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogContent className="sm:max-w-[460px]">
                    <form onSubmit={handleCreateProject}>
                        <DialogHeader>
                            <p className="font-mono-label text-muted-foreground">New project</p>
                            <DialogTitle className="text-2xl">Start a project</DialogTitle>
                            <DialogDescription>The key prefixes every task, e.g. MKT-12. It must be unique.</DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-6">
                            <div className="space-y-2">
                                <FieldLabel htmlFor="name">Name</FieldLabel>
                                <Input
                                    id="name"
                                    placeholder="Marketing site relaunch"
                                    value={newProject.name}
                                    onChange={(e) => setNewProject(p => ({ ...p, name: e.target.value, key: keyTouched ? p.key : suggestKey(e.target.value) }))}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <FieldLabel htmlFor="key">Key</FieldLabel>
                                <Input
                                    id="key"
                                    placeholder="MKT"
                                    className="font-mono uppercase"
                                    maxLength={10}
                                    value={newProject.key}
                                    onChange={(e) => { setKeyTouched(true); setNewProject({ ...newProject, key: e.target.value.replace(/[^A-Za-z0-9]/g, "").toUpperCase() }); }}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <FieldLabel htmlFor="description">Description</FieldLabel>
                                <Textarea id="description" placeholder="What does done look like?" value={newProject.description} onChange={(e) => setNewProject({ ...newProject, description: e.target.value })} />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={isCreating}>{isCreating && <Loader2 className="h-4 w-4 animate-spin" />} Create project</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
