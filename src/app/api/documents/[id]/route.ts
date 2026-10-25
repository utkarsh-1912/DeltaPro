import { route } from "@/lib/api";
import { deleteDocument, downloadDocument } from "@/services/documents";

export const dynamic = "force-dynamic";

/** Streams the file. ?download=1 forces a download instead of opening inline. */
export const GET = route<{ id: string }>(async ({ req, user, params }) => {
    const doc = await downloadDocument(user, params.id);
    const disposition = new URL(req.url).searchParams.get("download") ? "attachment" : "inline";
    return new Response(Buffer.from(doc.content), {
        headers: {
            "Content-Type": doc.mimeType,
            "Content-Disposition": `${disposition}; filename="${encodeURIComponent(doc.fileName)}"`,
            "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff",
        },
    });
});

export const DELETE = route<{ id: string }>(async ({ user, params }) => {
    await deleteDocument(user, params.id);
    return { ok: true };
});
