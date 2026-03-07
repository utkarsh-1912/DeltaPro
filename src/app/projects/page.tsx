"use client";

import { useState, useEffect } from "react";
import { Plus, Briefcase, Users, Layout, MoreVertical, Search, Star, Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

export default function ProjectsPage() {
    const { toast } = useToast();
    const [projects, setProjects] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    // Create Project State
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
    }, []);

    const handleCreateProject = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newProject.name || !newProject.key) {
            toast({ title: "Validation Error", description: "Name and Key are required.", variant: "destructive" });
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
                toast({ title: "Project Created", description: `${newProject.name} has been added successfully.` });
                setIsCreateOpen(false);
                setNewProject({ name: "", key: "", description: "" });
                fetchProjects();
            } else {
                const data = await res.json();
                toast({ title: "Error", description: data.error || "Failed to create project", variant: "destructive" });
            }
        } catch (error) {
            toast({ title: "Error", description: "An unexpected error occurred.", variant: "destructive" });
        } finally {
            setIsCreating(false);
        }
    };

    const filteredProjects = projects.filter((p: any) =>
        p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.key?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight">Project Portfolio</h1>
                    <p className="text-muted-foreground mt-1 text-sm">Manage enterprise initiatives, tasks, and team collaborations.</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Find projects..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full md:w-64 pl-9 bg-muted/50 border-none shadow-none rounded-full focus-visible:ring-1"
                        />
                    </div>
                    <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                        <DialogTrigger asChild>
                            <Button className="rounded-full shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all"><Plus className="mr-2 h-4 w-4" /> New Project</Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[425px] border-none shadow-2xl bg-background/95 backdrop-blur-xl">
                            <form onSubmit={handleCreateProject}>
                                <DialogHeader>
                                    <DialogTitle>Create Enterprise Project</DialogTitle>
                                    <DialogDescription>
                                        Initialize a new project environment. The key must be unique.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="grid gap-4 py-6">
                                    <div className="space-y-2">
                                        <Label htmlFor="name">Project Name</Label>
                                        <Input id="name" placeholder="e.g. Marketing Q1" value={newProject.name} onChange={(e) => setNewProject({ ...newProject, name: e.target.value })} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="key">Project Key</Label>
                                        <Input id="key" placeholder="e.g. MKT" className="uppercase" maxLength={10} value={newProject.key} onChange={(e) => setNewProject({ ...newProject, key: e.target.value })} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="description">Description</Label>
                                        <Textarea id="description" placeholder="Briefly describe the project goals..." value={newProject.description} onChange={(e) => setNewProject({ ...newProject, description: e.target.value })} />
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button type="button" variant="ghost" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                                    <Button type="submit" disabled={isCreating}>
                                        {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Initialize Project
                                    </Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                <AnimatePresence mode="popLayout">
                    {isLoading ? (
                        [1, 2, 3, 4].map(i => <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-64 rounded-3xl bg-muted/50 animate-pulse border-2 border-dashed border-muted" />)
                    ) : filteredProjects.length === 0 ? (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="col-span-full">
                            <Card className="py-16 border-dashed border-2 text-center bg-muted/20 rounded-3xl">
                                <CardContent className="space-y-4">
                                    <div className="h-20 w-20 bg-muted rounded-full flex items-center justify-center mx-auto shadow-inner">
                                        <Briefcase className="h-10 w-10 text-muted-foreground/60" />
                                    </div>
                                    <div className="space-y-1">
                                        <CardTitle className="text-xl">No projects found</CardTitle>
                                        <CardDescription>Try adjusting your search or create a new initiative.</CardDescription>
                                    </div>
                                    <Button onClick={() => setIsCreateOpen(true)} className="rounded-full mt-4">Create Project</Button>
                                </CardContent>
                            </Card>
                        </motion.div>
                    ) : (
                        filteredProjects.map((project: any, idx) => (
                            <motion.div
                                key={project.id}
                                layout
                                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                transition={{ delay: idx * 0.05, type: "spring", stiffness: 300, damping: 24 }}
                            >
                                <Card className="group h-full flex flex-col hover:border-primary/40 focus-within:ring-2 focus-within:ring-primary/20 transition-all border-2 shadow-sm overflow-hidden rounded-3xl cursor-pointer bg-card/50 backdrop-blur-sm relative hover:shadow-xl hover:shadow-primary/5">
                                    <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                    <CardHeader className="pb-4 relative z-10 p-6">
                                        <div className="flex items-start justify-between mb-4">
                                            <div className="h-12 w-12 bg-primary text-primary-foreground rounded-2xl flex items-center justify-center font-black text-sm tracking-widest shadow-lg shadow-primary/20 group-hover:scale-110 transition-transform">
                                                {project.key}
                                            </div>
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all transform translate-x-4 group-hover:translate-x-0">
                                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-background"><Star className="h-4 w-4" /></Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-background"><MoreVertical className="h-4 w-4" /></Button>
                                            </div>
                                        </div>
                                        <CardTitle className="text-xl group-hover:text-primary transition-colors line-clamp-1">{project.name}</CardTitle>
                                        <CardDescription className="line-clamp-2 mt-2 text-xs leading-relaxed min-h-[40px]">{project.description || "No description provided. Click to add details."}</CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-6 flex-1 px-6 pb-2">
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-widest">
                                                <span className={cn(project.metrics?.status === "Completed" ? "text-emerald-500" : "text-muted-foreground")}>Progress</span>
                                                <span className={cn(project.metrics?.status === "Completed" ? "text-emerald-500" : "text-primary")}>{project.metrics?.progress || 0}%</span>
                                            </div>
                                            <Progress
                                                value={project.metrics?.progress || 0}
                                                className={cn("h-2 rounded-full", project.metrics?.status === "Completed" && "[&>div]:bg-emerald-500")}
                                            />
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <div className="flex -space-x-3">
                                                {project.team?.members?.slice(0, 3).map((m: any) => (
                                                    <Avatar key={m.id} className="h-8 w-8 border-2 border-background shadow-sm hover:z-10 hover:scale-110 transition-transform">
                                                        <AvatarImage src={m.image} />
                                                        <AvatarFallback className="text-[10px] bg-muted text-foreground font-bold">{m.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                                                    </Avatar>
                                                ))}
                                                {(!project.team?.members || project.team.members.length === 0) ? (
                                                    <div className="h-8 w-8 rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center">
                                                        <Users className="h-3 w-3 text-muted-foreground/50" />
                                                    </div>
                                                ) : (project.team.members.length > 3) && (
                                                    <div className="h-8 w-8 rounded-full bg-background border-2 border-background flex items-center justify-center text-[10px] font-bold shadow-sm z-10">
                                                        +{project.team.members.length - 3}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex flex-col items-end gap-1 text-xs font-medium text-muted-foreground">
                                                <span className="flex items-center gap-1.5 bg-muted/50 px-2 py-0.5 rounded-md"><Layout className="h-3 w-3" /> {project.metrics?.taskCount || 0} Tasks</span>
                                            </div>
                                        </div>
                                    </CardContent>
                                    <CardFooter className="bg-muted/20 p-4 border-t flex items-center justify-between text-[10px] font-bold uppercase tracking-widest mt-auto">
                                        <div className={cn(
                                            "flex items-center gap-2",
                                            project.metrics?.status === "Completed" ? "text-emerald-600 dark:text-emerald-400" :
                                                project.metrics?.status === "In Progress" ? "text-blue-600 dark:text-blue-400" : "text-muted-foreground"
                                        )}>
                                            <div className={cn(
                                                "h-2 w-2 rounded-full",
                                                project.metrics?.status === "Completed" ? "bg-emerald-500" :
                                                    project.metrics?.status === "In Progress" ? "bg-blue-500 animate-pulse" : "bg-muted-foreground"
                                            )} />
                                            {project.metrics?.status || "Not Started"}
                                        </div>
                                        <div className="flex items-center gap-1.5 text-muted-foreground/70">
                                            <Clock className="h-3 w-3" /> {format(new Date(project.updatedAt), "MMM d")}
                                        </div>
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
