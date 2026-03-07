"use client";

import { useState, useEffect } from "react";
import { Plus, Search, Folder, FileText, ChevronRight, MoreVertical, Star, History, Users, Settings, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

export default function DocsPage() {
    const { toast } = useToast();
    const [workspaces, setWorkspaces] = useState<any[]>([]);
    const [selectedWorkspace, setSelectedWorkspace] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    // Create States
    const [isCreateWsOpen, setIsCreateWsOpen] = useState(false);
    const [isCreatePageOpen, setIsCreatePageOpen] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [newWs, setNewWs] = useState({ name: "", description: "" });
    const [newPage, setNewPage] = useState({ title: "", content: "" });

    const fetchWorkspaces = async () => {
        setIsLoading(true);
        try {
            const res = await fetch("/api/docs/workspaces");
            const data = await res.json();
            const validData = Array.isArray(data) ? data : [];
            setWorkspaces(validData);
            if (validData.length > 0 && !selectedWorkspace) {
                setSelectedWorkspace(validData[0]);
            } else if (selectedWorkspace) {
                const updatedWs = validData.find((w: any) => w.id === selectedWorkspace.id);
                setSelectedWorkspace(updatedWs || validData[0] || null);
            }
        } catch (err) {
            console.error(err);
            toast({ title: "Error", description: "Failed to load workspaces.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchWorkspaces();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleCreateWorkspace = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newWs.name) {
            toast({ title: "Validation Error", description: "Workspace name is required.", variant: "destructive" });
            return;
        }

        setIsCreating(true);
        try {
            const res = await fetch("/api/docs/workspaces", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(newWs),
            });

            if (res.ok) {
                const created = await res.json();
                toast({ title: "Workspace Created", description: `${newWs.name} has been added.` });
                setIsCreateWsOpen(false);
                setNewWs({ name: "", description: "" });
                await fetchWorkspaces();
                setSelectedWorkspace(created); // Auto select new
            } else {
                toast({ title: "Error", description: "Failed to create workspace", variant: "destructive" });
            }
        } catch (error) {
            toast({ title: "Error", description: "Unexpected error occurred.", variant: "destructive" });
        } finally {
            setIsCreating(false);
        }
    };

    const handleCreatePage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newPage.title || !selectedWorkspace) {
            toast({ title: "Validation Error", description: "Page title and active workspace are required.", variant: "destructive" });
            return;
        }

        setIsCreating(true);
        try {
            const res = await fetch("/api/docs/pages", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...newPage, workspaceId: selectedWorkspace.id }),
            });

            if (res.ok) {
                toast({ title: "Page Created", description: `"${newPage.title}" has been added.` });
                setIsCreatePageOpen(false);
                setNewPage({ title: "", content: "" });
                fetchWorkspaces(); // Refresh to get nested pages
            } else {
                toast({ title: "Error", description: "Failed to create page", variant: "destructive" });
            }
        } catch (error) {
            toast({ title: "Error", description: "Unexpected error occurred.", variant: "destructive" });
        } finally {
            setIsCreating(false);
        }
    };

    const filteredWorkspaces = workspaces.filter(ws => ws.name.toLowerCase().includes(searchTerm.toLowerCase()));

    return (
        <div className="flex flex-1 overflow-hidden rounded-3xl border-2 bg-card/60 backdrop-blur-xl shadow-xl h-[calc(100vh-8rem)]">
            {/* SIDEBAR NAVIGATION */}
            <div className="w-80 border-r bg-muted/30 flex flex-col pt-2">
                <div className="p-6 pb-4 border-b space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-black tracking-tight">Workspaces</h2>
                        <Dialog open={isCreateWsOpen} onOpenChange={setIsCreateWsOpen}>
                            <DialogTrigger asChild>
                                <Button variant="secondary" size="icon" className="h-8 w-8 rounded-full shadow-sm hover:bg-primary hover:text-primary-foreground transition-all"><Plus className="h-4 w-4" /></Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[425px] border-none shadow-2xl bg-background/95 backdrop-blur-xl rounded-2xl">
                                <form onSubmit={handleCreateWorkspace}>
                                    <DialogHeader>
                                        <DialogTitle>Create Workspace</DialogTitle>
                                        <DialogDescription>Add a new top-level directory for your team's documents.</DialogDescription>
                                    </DialogHeader>
                                    <div className="grid gap-4 py-6">
                                        <div className="space-y-2">
                                            <Label htmlFor="ws-name">Workspace Name</Label>
                                            <Input id="ws-name" required placeholder="e.g. Engineering Handbook" value={newWs.name} onChange={(e) => setNewWs({ ...newWs, name: e.target.value })} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="ws-desc">Description</Label>
                                            <Textarea id="ws-desc" placeholder="What goes in this workspace?" value={newWs.description} onChange={(e) => setNewWs({ ...newWs, description: e.target.value })} className="h-24" />
                                        </div>
                                    </div>
                                    <DialogFooter>
                                        <Button type="button" variant="ghost" onClick={() => setIsCreateWsOpen(false)}>Cancel</Button>
                                        <Button type="submit" disabled={isCreating}>
                                            {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Create Workspace
                                        </Button>
                                    </DialogFooter>
                                </form>
                            </DialogContent>
                        </Dialog>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Find workspace..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 bg-background/50 h-10 text-sm border-none shadow-sm focus-visible:ring-1 rounded-xl"
                        />
                    </div>
                </div>

                <ScrollArea className="flex-1 p-4">
                    <div className="space-y-1">
                        {isLoading && workspaces.length === 0 ? (
                            [1, 2, 3].map(i => <div key={i} className="h-10 bg-muted/50 rounded-lg animate-pulse mb-2" />)
                        ) : filteredWorkspaces.length === 0 ? (
                            <div className="p-4 text-center text-xs text-muted-foreground italic">No workspaces found.</div>
                        ) : (
                            filteredWorkspaces.map((ws: any) => (
                                <button
                                    key={ws.id}
                                    onClick={() => setSelectedWorkspace(ws)}
                                    className={cn(
                                        "w-full flex items-center justify-between p-3 rounded-xl text-sm font-bold transition-all group",
                                        selectedWorkspace?.id === ws.id
                                            ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-[1.02]"
                                            : "hover:bg-muted/80 text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    <div className="flex items-center gap-3">
                                        <Folder className={cn("h-4 w-4", selectedWorkspace?.id === ws.id ? "text-primary-foreground fill-primary-foreground/20" : "text-blue-500 fill-blue-500/20")} />
                                        <span className="truncate max-w-[150px]">{ws.name}</span>
                                    </div>
                                    <ChevronRight className={cn("h-4 w-4 transition-transform", selectedWorkspace?.id === ws.id ? "rotate-90" : "opacity-0 group-hover:opacity-100")} />
                                </button>
                            ))
                        )}
                    </div>
                </ScrollArea>

                <div className="p-4 border-t bg-muted/40">
                    <Button variant="outline" className="w-full justify-start gap-3 h-10 rounded-xl border-dashed hover:border-solid transition-all text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-primary">
                        <Settings className="h-4 w-4" /> Workspace Settings
                    </Button>
                </div>
            </div>

            {/* MAIN CONTENT AREA */}
            <div className="flex-1 flex flex-col bg-muted/10 relative overflow-hidden">
                {selectedWorkspace ? (
                    <>
                        <div className="p-8 border-b bg-background/80 backdrop-blur-xl sticky top-0 z-10 flex items-center justify-between">
                            <div>
                                <div className="flex items-center gap-2 text-xs font-extrabold text-primary mb-2 uppercase tracking-widest">
                                    <Folder className="h-3 w-3 fill-primary/20" /> Active Workspace
                                </div>
                                <h1 className="text-4xl font-black tracking-tight">{selectedWorkspace.name}</h1>
                                <p className="text-sm font-medium text-muted-foreground mt-2 max-w-2xl leading-relaxed">{selectedWorkspace.description || "Organize your team's knowledge and documentation in this collaborative space."}</p>
                            </div>
                            <div className="flex items-center gap-4">
                                <Button variant="secondary" className="rounded-full shadow-sm">
                                    <Users className="mr-2 h-4 w-4" />
                                    {selectedWorkspace.owner ? '1 Owner' : 'Team'}
                                </Button>

                                <Dialog open={isCreatePageOpen} onOpenChange={setIsCreatePageOpen}>
                                    <DialogTrigger asChild>
                                        <Button className="rounded-full shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all"><Plus className="mr-2 h-4 w-4" /> New Page</Button>
                                    </DialogTrigger>
                                    <DialogContent className="sm:max-w-[600px] border-none shadow-2xl bg-background/95 backdrop-blur-xl rounded-2xl">
                                        <form onSubmit={handleCreatePage}>
                                            <DialogHeader>
                                                <DialogTitle>Create Document</DialogTitle>
                                                <DialogDescription>Add a new wealthy text document to {selectedWorkspace.name}.</DialogDescription>
                                            </DialogHeader>
                                            <div className="grid gap-4 py-6">
                                                <div className="space-y-2">
                                                    <Label htmlFor="page-title">Document Title</Label>
                                                    <Input id="page-title" required placeholder="e.g. Q3 Architecture Overview" value={newPage.title} onChange={(e) => setNewPage({ ...newPage, title: e.target.value })} className="text-lg font-bold" />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor="page-content">Initial Content (Markdown)</Label>
                                                    <Textarea id="page-content" placeholder="# Overview\n\nWrite something brilliant..." value={newPage.content} onChange={(e) => setNewPage({ ...newPage, content: e.target.value })} className="h-48 font-mono text-sm leading-relaxed" />
                                                </div>
                                            </div>
                                            <DialogFooter>
                                                <Button type="button" variant="ghost" onClick={() => setIsCreatePageOpen(false)}>Cancel</Button>
                                                <Button type="submit" disabled={isCreating}>
                                                    {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Create Document
                                                </Button>
                                            </DialogFooter>
                                        </form>
                                    </DialogContent>
                                </Dialog>

                            </div>
                        </div>

                        <ScrollArea className="flex-1">
                            <div className="p-8">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {/* QUICK ACTIONS / FAVORITES */}
                                    <Card className="col-span-full border-2 border-primary/20 bg-primary/5 p-1 shadow-md group rounded-3xl overflow-hidden">
                                        <CardContent className="bg-background rounded-[calc(1.5rem-2px)] p-6 flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className="h-14 w-14 bg-rose-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-rose-500/20 group-hover:scale-110 transition-transform">
                                                    <Star className="h-6 w-6 fill-white/20" />
                                                </div>
                                                <div>
                                                    <h3 className="font-extrabold text-lg tracking-tight">Starred Documents</h3>
                                                    <p className="text-sm font-medium text-muted-foreground">Quick access to essential resources.</p>
                                                </div>
                                            </div>
                                            <Button variant="ghost" className="transition-transform group-hover:translate-x-2 rounded-full font-bold">View favorites <ChevronRight className="ml-2 h-4 w-4" /></Button>
                                        </CardContent>
                                    </Card>

                                    {/* PAGES LIST */}
                                    <div className="col-span-full space-y-4 mt-4">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-xl font-black flex items-center gap-2 tracking-tight"><FileText className="h-5 w-5 text-muted-foreground fill-muted-foreground/20" /> Library</h3>
                                            <Button variant="ghost" size="sm" className="text-xs font-bold text-muted-foreground rounded-full hover:bg-muted"><History className="mr-2 h-4 w-4" /> Activity Log</Button>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                            <AnimatePresence mode="popLayout">
                                                {(!selectedWorkspace.pages || selectedWorkspace.pages.length === 0) ? (
                                                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="col-span-full p-16 text-center border-2 border-dashed border-muted-foreground/20 rounded-3xl bg-muted/10">
                                                        <FileText className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
                                                        <p className="text-sm font-bold text-muted-foreground">No pages found in this workspace yet.</p>
                                                        <Button onClick={() => setIsCreatePageOpen(true)} variant="outline" className="mt-4 rounded-full border-2 border-dashed hover:border-solid hover:bg-primary/5">Create First Page</Button>
                                                    </motion.div>
                                                ) : (
                                                    selectedWorkspace.pages.map((page: any, idx: number) => (
                                                        <motion.div
                                                            key={page.id}
                                                            layout
                                                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                                            animate={{ opacity: 1, scale: 1, y: 0 }}
                                                            exit={{ opacity: 0, scale: 0.9 }}
                                                            transition={{ delay: idx * 0.05, type: "spring" }}
                                                            whileHover={{ y: -4 }}
                                                            className="h-full"
                                                        >
                                                            <Card className="cursor-pointer h-full flex flex-col hover:border-primary/40 focus-within:ring-2 focus-within:ring-primary/20 transition-all group border-2 shadow-sm rounded-2xl overflow-hidden hover:shadow-xl hover:shadow-primary/5 relative bg-card/80 backdrop-blur-sm">
                                                                <CardHeader className="p-5 pb-3 flex flex-row items-center justify-between">
                                                                    <div className="h-10 w-10 bg-blue-500/10 text-blue-600 rounded-xl flex items-center justify-center group-hover:bg-blue-500 group-hover:text-white transition-all shadow-inner group-hover:shadow-blue-500/30">
                                                                        <FileText className="h-5 w-5" />
                                                                    </div>
                                                                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-background"><MoreVertical className="h-4 w-4" /></Button>
                                                                </CardHeader>
                                                                <CardContent className="p-5 pt-2 flex-1">
                                                                    <h4 className="font-bold text-lg leading-tight group-hover:text-primary transition-colors line-clamp-2">{page.title}</h4>
                                                                    <p className="text-xs font-medium text-muted-foreground mt-2 line-clamp-3 leading-relaxed">{page.content || "Empty page..."}</p>
                                                                </CardContent>
                                                                <div className="p-4 bg-muted/20 border-t flex flex-col justify-between mt-auto">
                                                                    <div className="flex items-center justify-between text-[10px] uppercase font-black tracking-widest text-muted-foreground">
                                                                        <span className="flex items-center gap-1.5"><History className="h-3 w-3" /> {format(new Date(page.updatedAt), "MMM d")}</span>
                                                                        <span className="bg-emerald-500/10 text-emerald-600 px-2 py-0.5 rounded-full">Active</span>
                                                                    </div>
                                                                </div>
                                                            </Card>
                                                        </motion.div>
                                                    ))
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </ScrollArea>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center p-12 text-center space-y-6 bg-muted/5">
                        <div className="h-32 w-32 bg-background border-4 border-muted/50 rounded-[3rem] flex items-center justify-center shadow-2xl shadow-muted">
                            <Folder className="h-16 w-16 text-muted-foreground/40" />
                        </div>
                        <div className="max-w-md space-y-3">
                            <h2 className="text-3xl font-black tracking-tight">Select a Workspace</h2>
                            <p className="text-sm font-medium text-muted-foreground leading-relaxed">Choose a workspace from the sidebar to view documents, or initialize a new collaborative space for your team.</p>
                        </div>
                        <Button size="lg" onClick={() => setIsCreateWsOpen(true)} className="rounded-full px-8 shadow-xl shadow-primary/20"><Plus className="mr-2 h-4 w-4" /> Create Workspace</Button>
                    </div>
                )}
            </div>
        </div>
    );
}
