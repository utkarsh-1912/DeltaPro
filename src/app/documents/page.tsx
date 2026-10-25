"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { format } from "date-fns";
import { CheckCircle2, FileText, Loader2, ShieldCheck, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { EmptyState, FieldLabel, PageHeader, Panel, Segmented, Stat, StatGrid, StatusPill } from "@/components/page";
import { api, useApi } from "@/components/use-api";

const CATEGORIES = ["POLICY", "CONTRACT", "ID_PROOF", "CERTIFICATE", "RECEIPT", "PAYSLIP", "OTHER"];
const TH = "h-10 px-6 text-left font-mono text-[11px] font-medium uppercase tracking-wider text-muted-foreground";
const ROW = "border-b last:border-0 hover:bg-secondary/40";
const nice = (s: string) => s.charAt(0) + s.slice(1).toLowerCase().replace("_", " ");
const size = (b: number) => (b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

function UploadDialog({ company, onClose, onSaved }: { company: boolean; onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast();
  const [file, setFile] = React.useState<File | null>(null);
  const [title, setTitle] = React.useState("");
  const [category, setCategory] = React.useState(company ? "POLICY" : "ID_PROOF");
  const [requiresAck, setRequiresAck] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("title", title);
      fd.append("category", category);
      if (company) { fd.append("userId", ""); fd.append("requiresAck", String(category === "POLICY" && requiresAck)); }
      await api("/api/documents", { method: "POST", body: fd });
      toast({ title: "Uploaded" });
      onSaved();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Not uploaded", description: err.message });
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader><DialogTitle>{company ? "Publish a company document" : "Upload a document"}</DialogTitle><DialogDescription>PDF, image, Word or text, up to 5 MB.</DialogDescription></DialogHeader>
          <div className="space-y-2"><FieldLabel htmlFor="doc-file">File</FieldLabel><Input id="doc-file" type="file" required accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.doc,.docx" onChange={e => { const f = e.target.files?.[0] ?? null; setFile(f); if (f && !title) setTitle(f.name.replace(/\.[^.]+$/, "")); }} /></div>
          <div className="space-y-2"><FieldLabel htmlFor="doc-title">Title</FieldLabel><Input id="doc-title" value={title} onChange={e => setTitle(e.target.value)} /></div>
          <div className="space-y-2"><FieldLabel>Category</FieldLabel>
            <Select value={category} onValueChange={setCategory}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{CATEGORIES.filter(c => company || c !== "POLICY").map(c => <SelectItem key={c} value={c}>{nice(c)}</SelectItem>)}</SelectContent></Select>
          </div>
          {company && category === "POLICY" && <label className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">Everyone must acknowledge<Switch checked={requiresAck} onCheckedChange={setRequiresAck} /></label>}
          <DialogFooter><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" disabled={!file || saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Upload</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AckReport({ doc, onClose }: { doc: any; onClose: () => void }) {
  const { data } = useApi<any[]>(`/api/documents/${doc.id}/ack`);
  const pending = (data ?? []).filter(p => !p.acknowledgedAt);
  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{doc.title}</DialogTitle><DialogDescription>{data ? `${data.length - pending.length} of ${data.length} acknowledged` : "Loading…"}</DialogDescription></DialogHeader>
        <ul className="divide-y">
          {(data ?? []).map(p => (
            <li key={p.id} className="flex items-center justify-between py-2 text-sm">
              <span>{p.name ?? p.email}</span>
              {p.acknowledgedAt ? <span className="font-mono text-[11px] text-muted-foreground">{format(new Date(p.acknowledgedAt), "d MMM yyyy")}</span> : <StatusPill status="PENDING" label="Pending" />}
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

export default function DocumentsPage() {
  const { data: session } = useSession();
  const { toast } = useToast();
  const isHr = ["ADMIN", "HR"].includes(session?.user?.role ?? "");
  const [scope, setScope] = React.useState<"company" | "personal">("company");
  const [uploading, setUploading] = React.useState(false);
  const [report, setReport] = React.useState<any | null>(null);
  const list = useApi<any[]>(`/api/documents?scope=${scope}`);
  const rows = list.data ?? [];

  const ack = async (id: string) => {
    try { await api(`/api/documents/${id}/ack`, { method: "POST" }); toast({ title: "Acknowledged" }); list.reload(); }
    catch (e: any) { toast({ variant: "destructive", title: "Not saved", description: e.message }); }
  };
  const remove = async (id: string) => {
    try { await api(`/api/documents/${id}`, { method: "DELETE" }); list.reload(); }
    catch (e: any) { toast({ variant: "destructive", title: "Not deleted", description: e.message }); }
  };
  const toAck = rows.filter(d => d.requiresAck && !d.acknowledgedAt);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="People · Documents"
        title="Documents & policies"
        description="Company policies everyone acknowledges, and each person's own documents: contracts, ID proofs and certificates."
        actions={<>
          <Segmented value={scope} onChange={setScope} options={[{ value: "company", label: "Company" }, { value: "personal", label: "My documents" }]} />
          {(scope === "personal" || isHr) && <Button onClick={() => setUploading(true)}><Upload className="mr-2 h-4 w-4" />Upload</Button>}
        </>}
      />
      {scope === "company" && (
        <StatGrid>
          <Stat label="Policies" value={rows.filter(d => d.category === "POLICY").length} icon={ShieldCheck} />
          <Stat label="Waiting on you" value={toAck.length} hint={toAck.length ? "read and acknowledge" : "all acknowledged"} tone={toAck.length ? "warn" : "ok"} icon={CheckCircle2} />
          <Stat label="Documents" value={rows.length} icon={FileText} />
        </StatGrid>
      )}
      <Panel title={scope === "company" ? "Company documents" : "My documents"} bodyClassName="p-0">
        {list.loading && !rows.length ? <p className="p-6 text-sm text-muted-foreground">Loading…</p> : rows.length === 0 ? (
          <EmptyState icon={FileText} title="Nothing here yet" description={scope === "company" ? "HR publishes handbooks and policies here." : "Keep your contract, ID proofs and certificates in one place."} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/40"><tr>{["Document", "Category", "Added", "Status", ""].map(h => <th key={h} className={TH}>{h}</th>)}</tr></thead>
              <tbody>
                {rows.map(d => (
                  <tr key={d.id} className={ROW}>
                    <td className="px-6 py-3"><a href={`/api/documents/${d.id}`} target="_blank" rel="noreferrer" className="font-medium hover:underline">{d.title}</a><p className="font-mono-label text-muted-foreground">{d.fileName} · {size(d.size)}</p></td>
                    <td className="px-6 py-3 text-muted-foreground">{nice(d.category)}</td>
                    <td className="px-6 py-3 text-muted-foreground">{format(new Date(d.createdAt), "d MMM yyyy")}</td>
                    <td className="px-6 py-3">
                      {d.requiresAck ? (d.acknowledgedAt ? <StatusPill status="DONE" label="Acknowledged" /> : <StatusPill status="PENDING" label="To acknowledge" />) : <span className="text-muted-foreground">—</span>}
                      {isHr && d.requiresAck && <button className="ml-3 font-mono-label text-signal hover:underline" onClick={() => setReport(d)}>{d.ackCount}/{d.ackTotal ?? "?"}</button>}
                    </td>
                    <td className="px-6 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        {d.requiresAck && !d.acknowledgedAt && <Button size="sm" onClick={() => ack(d.id)}>I have read this</Button>}
                        {(isHr || d.uploadedById === session?.user?.id) && <Button size="sm" variant="ghost" aria-label={`Delete ${d.title}`} onClick={() => remove(d.id)}><Trash2 className="h-4 w-4" /></Button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      {uploading && <UploadDialog company={scope === "company"} onClose={() => setUploading(false)} onSaved={() => { setUploading(false); list.reload(); }} />}
      {report && <AckReport doc={report} onClose={() => setReport(null)} />}
    </div>
  );
}
