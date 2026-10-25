import { HttpError, route } from "@/lib/api";
import { listDocuments, uploadDocument } from "@/services/documents";

export const dynamic = "force-dynamic";

/** ?scope=company|personal&userId=… */
export const GET = route(async ({ req, user }) => {
    const p = new URL(req.url).searchParams;
    return listDocuments(user, { scope: p.get("scope") as "company" | "personal" | null, userId: p.get("userId") });
});

/** multipart/form-data: file, title?, category, userId? ("" = company-wide), requiresAck? */
export const POST = route(async ({ req, user }) => {
    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!form || !(file instanceof File)) throw new HttpError(400, "Attach a file.");
    const userId = form.get("userId");
    const doc = await uploadDocument(user, {
        file,
        title: String(form.get("title") ?? ""),
        category: String(form.get("category") ?? "OTHER"),
        userId: userId === "" ? null : (userId as string | null) ?? undefined,
        requiresAck: form.get("requiresAck") === "true",
    });
    return Response.json(doc, { status: 201 });
});
