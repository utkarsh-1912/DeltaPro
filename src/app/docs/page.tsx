"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Plus, Search, Folder, FileText, Loader2, ArrowLeft, Pencil, Eye, Trash2, Save, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { EmptyState, FieldLabel, Segmented } from "@/components/page";
import { EASE } from "@/components/motion";

/** Minimal, safe markdown: headings, lists, quotes, fenced code, inline code/bold/italic/links. No raw HTML. */
function Markdown({ source }: { source: string }) {
    const inline = (text: string, key: string): React.ReactNode[] => {
        const out: React.ReactNode[] = [];
        const re = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\((https?:\/\/[^)\s]+)\))/g;
        let last = 0, m: RegExpExecArray | null, i = 0;
        while ((m = re.exec(text))) {
            if (m.index > last) out.push(text.slice(last, m.index));
            const t = m[0];
            const k = `${key}-${i++}`;
            if (t.startsWith("`")) out.push(<code key={k} className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[0.9em]">{t.slice(1, -1)}</code>);
            else if (t.startsWith("**")) out.push(<strong key={k}>{t.slice(2, -2)}</strong>);
            else if (t.startsWith("*")) out.push(<em key={k}>{t.slice(1, -1)}</em>);
            else {
                const label = t.slice(1, t.indexOf("]"));
                out.push(<a key={k} href={m[2]} target="_blank" rel="noopener noreferrer" className="text-signal underline underline-offset-4">{label}</a>);
            }
            last = m.index + t.length;
        }
        if (last < text.length) out.push(text.slice(last));
        return out;
    };

    const blocks: React.ReactNode[] = [];
    const lines = source.replace(/\r\n/g, "\n").split("\n");
    let i = 0;
    while (i < lines.length) {
        const line = lines[i];
        if (line.startsWith("```")) {
            const code: string[] = [];
            i++;
            while (i < lines.length && !lines[i].startsWith("```")) code.push(lines[i++]);
            i++;
            blocks.push(<pre key={i} className="overflow-x-auto rounded-xl border bg-secondary/50 p-4 font-mono text-sm">{code.join("\n")}</pre>);
            continue;
        }
        const h = /^(#{1,3})\s+(.*)/.exec(line);
        if (h) {
            const cls = ["text-3xl font-semibold tracking-tight mt-10", "text-2xl font-semibold tracking-tight mt-8", "text-lg font-semibold mt-6"][h[1].length - 1];
            blocks.push(React.createElement(`h${h[1].length + 1}`, { key: i, className: cls }, inline(h[2], `h${i}`)));
            i++;
            continue;
        }
        if (/^\s*[-*]\s+/.test(line) || /^\s*\d+\.\s+/.test(line)) {
            const ordered = /^\s*\d+\./.test(line);
            const items: string[] = [];
            while (i < lines.length && (ordered ? /^\s*\d+\.\s+/ : /^\s*[-*]\s+/).test(lines[i])) items.push(lines[i++].replace(/^\s*(?:[-*]|\d+\.)\s+/, ""));
            const Tag = ordered ? "ol" : "ul";
            blocks.push(<Tag key={i} className={cn("my-4 space-y-1.5 pl-6", ordered ? "list-decimal" : "list-disc")}>{items.map((it, j) => <li key={j}>{inline(it, `l${i}-${j}`)}</li>)}</Tag>);
            continue;
        }
        if (line.startsWith(">")) {
            const quote: string[] = [];
            while (i < lines.length && lines[i].startsWith(">")) quote.push(lines[i++].replace(/^>\s?/, ""));
            blocks.push(<blockquote key={i} className="my-4 border-l-2 border-signal pl-4 text-muted-foreground">{inline(quote.join(" "), `q${i}`)}</blockquote>);
            continue;
        }
        if (/^---+$/.test(line.trim())) { blocks.push(<hr key={i} className="my-8" />); i++; continue; }
        if (!line.trim()) { i++; continue; }
        const para: string[] = [];
        while (i < lines.length && lines[i].trim() && !/^(#{1,3}\s|```|>|\s*[-*]\s|\s*\d+\.\s)/.test(lines[i])) para.push(lines[i++]);
        blocks.push(<p key={i} className="my-4 leading-7">{inline(para.join(" "), `p${i}`)}</p>);
    }
    return <div className="max-w-none text-[15px]">{blocks}</div>;
}

export default function DocsPage() {
    const { toast } = useToast();
    const [workspaces, setWorkspaces] = useState<any[]>([]);
    const [selectedWsId, setSelectedWsId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    const [isCreateWsOpen, setIsCreateWsOpen] = useState(false);
    const [isCreatePageOpen, setIsCreatePageOpen] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [newWs, setNewWs] = useState({ name: "", description: "" });
    const [newPage, setNewPage] = useState({ title: "", content: "" });

    // Open document
    const [openPageId, setOpenPageId] = useState<string | null>(null);
    const [doc, setDoc] = useState<any>(null);
    const [draft, setDraft] = useState({ title: "", content: "" });
    const [mode, setMode] = useState<"read" | "edit">("read");
    const [isSaving, setIsSaving] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);

    const selectedWorkspace = workspaces.find(w => w.id === selectedWsId) ?? null;
    const dirty = !!doc && (draft.title !== doc.title || draft.content !== (doc.content ?? ""));

    const fetchWorkspaces = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await fetch("/api/docs/workspaces");
            const data = await res.json();
            const list = Array.isArray(data) ? data : [];
            setWorkspaces(list);
            setSelectedWsId(prev => (prev && list.some((w: any) => w.id === prev) ? prev : list[0]?.id ?? null));
        } catch (err) {
            console.error(err);
            toast({ title: "Error", description: "Failed to load workspaces.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    useEffect(() => { fetchWorkspaces(); }, [fetchWorkspaces]);

    const openDoc = async (id: string) => {
        setOpenPageId(id);
        setMode("read");
        const cached = selectedWorkspace?.pages?.find((p: any) => p.id === id);
        if (cached) { setDoc(cached); setDraft({ title: cached.title, content: cached.content ?? "" }); }
        try {
            const res = await fetch(`/api/docs/pages/${id}`);
            if (res.ok) {
                const full = await res.json();
                setDoc(full);
                setDraft({ title: full.title, content: full.content ?? "" });
            }
        } catch { /* keep cached copy */ }
    };

    const closeDoc = () => {
        if (dirty && !window.confirm("Discard unsaved changes?")) return;
        setOpenPageId(null);
        setDoc(null);
    };

    const saveDoc = async () => {
        if (!doc) return;
        setIsSaving(true);
        try {
            const res = await fetch(`/api/docs/pages/${doc.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title: draft.title.trim() || doc.title, content: draft.content }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || "Could not save.");
            }
            const updated = await res.json();
            setDoc((d: any) => ({ ...d, ...updated }));
            setWorkspaces(ws => ws.map(w => w.id !== selectedWsId ? w : { ...w, pages: w.pages?.map((p: any) => p.id === doc.id ? { ...p, ...updated } : p) }));
            setMode("read");
            toast({ title: "Saved" });
        } catch (e: any) {
            toast({ title: "Save failed", description: e.message, variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    const deleteDoc = async () => {
        if (!doc) return;
        setIsSaving(true);
        try {
            const res = await fetch(`/api/docs/pages/${doc.id}`, { method: "DELETE" });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || "Could not delete.");
            }
            toast({ title: "Page deleted" });
            setConfirmDelete(false);
            setOpenPageId(null);
            setDoc(null);
            fetchWorkspaces();
        } catch (e: any) {
            toast({ title: "Delete failed", description: e.message, variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    // Ctrl/Cmd+S saves while editing
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "s" && mode === "edit" && doc) { e.preventDefault(); saveDoc(); }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    });

    const handleCreateWorkspace = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newWs.name) return;
        setIsCreating(true);
        try {
            const res = await fetch("/api/docs/workspaces", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(newWs),
            });
            if (res.ok) {
                const created = await res.json();
                toast({ title: "Workspace created", description: newWs.name });
                setIsCreateWsOpen(false);
                setNewWs({ name: "", description: "" });
                setSelectedWsId(created.id);
                await fetchWorkspaces();
            } else {
                const err = await res.json().catch(() => ({}));
                toast({ title: "Could not create workspace", description: err.error, variant: "destructive" });
            }
        } catch (error) {
            toast({ title: "Error", description: "Unexpected error occurred.", variant: "destructive" });
        } finally {
            setIsCreating(false);
        }
    };

    const handleCreatePage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newPage.title || !selectedWorkspace) return;
        setIsCreating(true);
        try {
            const res = await fetch("/api/docs/pages", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...newPage, workspaceId: selectedWorkspace.id }),
            });
            if (res.ok) {
                const created = await res.json().catch(() => null);
                toast({ title: "Page created", description: newPage.title });
                setIsCreatePageOpen(false);
                setNewPage({ title: "", content: "" });
                await fetchWorkspaces();
                if (created?.id) { openDoc(created.id); setMode("edit"); }
            } else {
                const err = await res.json().catch(() => ({}));
                toast({ title: "Could not create page", description: err.error, variant: "destructive" });
            }
        } catch (error) {
            toast({ title: "Error", description: "Unexpected error occurred.", variant: "destructive" });
        } finally {
            setIsCreating(false);
        }
    };

    const q = searchTerm.trim().toLowerCase();
    const filteredWorkspaces = workspaces.filter(ws =>
        !q || ws.name.toLowerCase().includes(q) || ws.pages?.some((p: any) => p.title?.toLowerCase().includes(q))
    );
    const pages = useMemo(() => {
        const list = [...(selectedWorkspace?.pages ?? [])];
        list.sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
        return q ? list.filter(p => p.title?.toLowerCase().includes(q) || p.content?.toLowerCase().includes(q)) : list;
    }, [selectedWorkspace, q]);
    const totalPages = workspaces.reduce((s, w) => s + (w.pages?.length ?? 0), 0);
    const words = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);

    return (
        <div className="flex h-[calc(100vh-7rem)] overflow-hidden rounded-2xl border bg-card">
            {/* Workspace rail */}
            <aside className="hidden w-72 shrink-0 flex-col border-r bg-secondary/30 md:flex">
                <div className="space-y-4 border-b p-5">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-mono-label text-muted-foreground">Knowledge</p>
                            <h2 className="mt-1 text-xl font-semibold tracking-tight">Workspaces</h2>
                        </div>
                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setIsCreateWsOpen(true)} aria-label="New workspace"><Plus className="h-4 w-4" /></Button>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input placeholder="Search pages…" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="h-9 pl-9" />
                    </div>
                </div>
                <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
                    {isLoading && workspaces.length === 0 ? (
                        [0, 1, 2].map(i => <div key={i} className="mb-1 h-10 animate-pulse rounded-lg bg-secondary" />)
                    ) : filteredWorkspaces.length === 0 ? (
                        <p className="p-4 text-center text-sm text-muted-foreground">No workspaces match.</p>
                    ) : filteredWorkspaces.map((ws: any) => {
                        const active = ws.id === selectedWsId;
                        return (
                            <button
                                key={ws.id}
                                onClick={() => { if (openPageId) closeDoc(); setSelectedWsId(ws.id); }}
                                className={cn("relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors", active ? "text-foreground" : "text-muted-foreground hover:text-foreground")}
                            >
                                {active && <motion.span layoutId="ws-pill" className="absolute inset-0 rounded-lg border bg-card" transition={{ type: "spring", stiffness: 420, damping: 36 }} />}
                                <Folder className={cn("relative h-4 w-4 shrink-0", active && "text-signal")} />
                                <span className="relative flex-1 truncate font-medium">{ws.name}</span>
                                <span className="relative font-mono text-[11px] text-muted-foreground">{ws.pages?.length ?? 0}</span>
                            </button>
                        );
                    })}
                </nav>
                <div className="border-t p-5">
                    <p className="font-mono-label text-muted-foreground">{workspaces.length} workspaces · {totalPages} pages</p>
                </div>
            </aside>

            {/* Main */}
            <main className="relative flex min-w-0 flex-1 flex-col">
                <AnimatePresence mode="wait">
                    {openPageId && doc ? (
                        <motion.div key={`doc-${openPageId}`} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.35, ease: EASE }} className="flex min-h-0 flex-1 flex-col">
                            <div className="flex flex-wrap items-center justify-between gap-3 border-b px-6 py-3">
                                <div className="flex min-w-0 items-center gap-2">
                                    <Button variant="ghost" size="sm" onClick={closeDoc}><ArrowLeft className="h-4 w-4" /> {selectedWorkspace?.name}</Button>
                                    {dirty && <span className="font-mono-label text-amber-600 dark:text-amber-400">Unsaved</span>}
                                </div>
                                <div className="flex items-center gap-2">
                                    <Segmented value={mode} onChange={setMode} options={[{ value: "read", label: "Read", icon: Eye }, { value: "edit", label: "Edit", icon: Pencil }]} />
                                    {mode === "edit" && <Button size="sm" onClick={saveDoc} disabled={isSaving || !dirty}>{isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save</Button>}
                                    <Button size="icon" variant="ghost" className="h-9 w-9 text-muted-foreground hover:text-destructive" onClick={() => setConfirmDelete(true)} aria-label="Delete page"><Trash2 className="h-4 w-4" /></Button>
                                </div>
                            </div>
                            <div className="min-h-0 flex-1 overflow-y-auto">
                                <article className="mx-auto max-w-3xl px-6 py-12">
                                    <p className="font-mono-label text-muted-foreground">
                                        {selectedWorkspace?.name} · updated {doc.updatedAt ? formatDistanceToNow(new Date(doc.updatedAt), { addSuffix: true }) : "just now"} · {words(draft.content)} words
                                    </p>
                                    {mode === "edit" ? (
                                        <>
                                            <input
                                                value={draft.title}
                                                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                                                className="mt-4 w-full bg-transparent text-4xl font-semibold tracking-tight outline-none sm:text-5xl"
                                                placeholder="Untitled"
                                            />
                                            <Textarea
                                                value={draft.content}
                                                onChange={(e) => setDraft({ ...draft, content: e.target.value })}
                                                className="mt-8 min-h-[55vh] resize-none border-0 bg-transparent px-0 font-mono text-sm leading-7 shadow-none focus-visible:ring-0"
                                                placeholder={"Write in Markdown.\n\n# Heading\n- bullet\n**bold**, *italic*, `code`, [link](https://…)"}
                                                autoFocus
                                            />
                                            <p className="font-mono-label text-muted-foreground">Ctrl/⌘ + S to save</p>
                                        </>
                                    ) : (
                                        <>
                                            <h1 className="mt-4 text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">{doc.title}</h1>
                                            <div className="mt-10">
                                                {doc.content?.trim() ? <Markdown source={doc.content} /> : (
                                                    <button onClick={() => setMode("edit")} className="text-muted-foreground hover:text-foreground">This page is empty. Start writing →</button>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </article>
                            </div>
                        </motion.div>
                    ) : selectedWorkspace ? (
                        <motion.div key={`ws-${selectedWorkspace.id}`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.35, ease: EASE }} className="flex min-h-0 flex-1 flex-col">
                            <header className="relative overflow-hidden border-b px-8 py-10">
                                <div className="dotgrid absolute inset-0 opacity-40 [mask-image:linear-gradient(90deg,transparent,#000)]" />
                                <div className="relative flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
                                    <div className="min-w-0">
                                        <p className="font-mono-label text-muted-foreground">Workspace · {selectedWorkspace.pages?.length ?? 0} pages</p>
                                        <h1 className="mt-3 text-4xl font-semibold leading-[1] tracking-tight">{selectedWorkspace.name}</h1>
                                        <p className="mt-3 max-w-2xl text-muted-foreground">{selectedWorkspace.description || "Team knowledge, policies and how-tos."}</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button variant="outline" className="md:hidden" onClick={() => setIsCreateWsOpen(true)}><Plus className="h-4 w-4" /> Workspace</Button>
                                        <Button onClick={() => setIsCreatePageOpen(true)}><Plus className="h-4 w-4" /> New page</Button>
                                    </div>
                                </div>
                                {/* Mobile workspace switcher */}
                                <div className="relative mt-6 flex gap-1.5 overflow-x-auto md:hidden">
                                    {workspaces.map(ws => (
                                        <button key={ws.id} onClick={() => setSelectedWsId(ws.id)} className={cn("shrink-0 rounded-full border px-3 py-1.5 text-sm", ws.id === selectedWsId ? "border-foreground bg-foreground text-background" : "text-muted-foreground")}>{ws.name}</button>
                                    ))}
                                </div>
                            </header>
                            <div className="min-h-0 flex-1 overflow-y-auto">
                                {pages.length === 0 ? (
                                    <EmptyState
                                        icon={FileText}
                                        title={q ? "No pages match" : "No pages yet"}
                                        description={q ? "Try another search." : "Write the first page for this workspace."}
                                        action={!q ? <Button onClick={() => setIsCreatePageOpen(true)}><Plus className="h-4 w-4" /> New page</Button> : undefined}
                                        className="py-24"
                                    />
                                ) : (
                                    <ul>
                                        {pages.map((page: any, idx: number) => (
                                            <motion.li key={page.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(idx, 10) * 0.03, ease: EASE }}>
                                                <button
                                                    onClick={() => openDoc(page.id)}
                                                    className="group grid w-full grid-cols-[auto_1fr_auto] items-center gap-5 border-b px-8 py-5 text-left transition-colors hover:bg-secondary/40"
                                                >
                                                    <span className="font-mono text-[11px] text-muted-foreground">{String(idx + 1).padStart(2, "0")}</span>
                                                    <div className="min-w-0">
                                                        <p className="truncate text-lg font-medium tracking-tight group-hover:text-signal">{page.title}</p>
                                                        <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">{page.content?.replace(/[#*`>\-\[\]]/g, "").slice(0, 180) || "Empty page"}</p>
                                                    </div>
                                                    <span className="whitespace-nowrap text-xs text-muted-foreground">{formatDistanceToNow(new Date(page.updatedAt), { addSuffix: true })}</span>
                                                </button>
                                            </motion.li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-1 items-center justify-center">
                            <EmptyState
                                icon={BookOpen}
                                title={isLoading ? "Loading…" : "No workspaces yet"}
                                description="A workspace groups related pages: a handbook, policies, runbooks."
                                action={!isLoading ? <Button onClick={() => setIsCreateWsOpen(true)}><Plus className="h-4 w-4" /> Create workspace</Button> : undefined}
                            />
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>

            {/* Create workspace */}
            <Dialog open={isCreateWsOpen} onOpenChange={setIsCreateWsOpen}>
                <DialogContent className="sm:max-w-[440px]">
                    <form onSubmit={handleCreateWorkspace}>
                        <DialogHeader>
                            <p className="font-mono-label text-muted-foreground">New workspace</p>
                            <DialogTitle className="text-2xl">Create a workspace</DialogTitle>
                            <DialogDescription>A top-level space for a team or topic.</DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-6">
                            <div className="space-y-2">
                                <FieldLabel htmlFor="ws-name">Name</FieldLabel>
                                <Input id="ws-name" required placeholder="Engineering handbook" value={newWs.name} onChange={(e) => setNewWs({ ...newWs, name: e.target.value })} />
                            </div>
                            <div className="space-y-2">
                                <FieldLabel htmlFor="ws-desc">Description</FieldLabel>
                                <Textarea id="ws-desc" placeholder="What lives here?" value={newWs.description} onChange={(e) => setNewWs({ ...newWs, description: e.target.value })} className="h-24" />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => setIsCreateWsOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={isCreating}>{isCreating && <Loader2 className="h-4 w-4 animate-spin" />} Create</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Create page */}
            <Dialog open={isCreatePageOpen} onOpenChange={setIsCreatePageOpen}>
                <DialogContent className="sm:max-w-[440px]">
                    <form onSubmit={handleCreatePage}>
                        <DialogHeader>
                            <p className="font-mono-label text-muted-foreground">New page · {selectedWorkspace?.name}</p>
                            <DialogTitle className="text-2xl">Name your page</DialogTitle>
                            <DialogDescription>You'll go straight into the editor.</DialogDescription>
                        </DialogHeader>
                        <div className="py-6">
                            <FieldLabel htmlFor="page-title">Title</FieldLabel>
                            <Input id="page-title" required autoFocus placeholder="Leave policy 2026" value={newPage.title} onChange={(e) => setNewPage({ ...newPage, title: e.target.value })} className="mt-2" />
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => setIsCreatePageOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={isCreating}>{isCreating && <Loader2 className="h-4 w-4 animate-spin" />} Create and edit</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete “{doc?.title}”?</AlertDialogTitle>
                        <AlertDialogDescription>This can't be undone. Any child pages move up one level.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isSaving}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={(e) => { e.preventDefault(); deleteDoc(); }} disabled={isSaving} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            {isSaving && <Loader2 className="h-4 w-4 animate-spin" />} Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
