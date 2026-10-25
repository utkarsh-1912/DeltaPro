import { prisma } from "@/lib/prisma";
import { audit, notify } from "@/lib/activity";
import { HttpError, canActOnUser, isPeopleAdmin, type SessionUser } from "@/lib/api";

export const DOCUMENT_CATEGORIES = ["POLICY", "CONTRACT", "ID_PROOF", "CERTIFICATE", "RECEIPT", "PAYSLIP", "OTHER"] as const;
export const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/webp", "text/plain",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/msword"];

const META = { id: true, userId: true, title: true, category: true, fileName: true, mimeType: true, size: true, requiresAck: true, uploadedById: true, createdAt: true } as const;

/**
 * Company documents (userId = null) are visible to everyone; personal documents to the owner,
 * their manager and HR. Policy rows include whether the viewer has acknowledged them.
 */
export async function listDocuments(actor: SessionUser, opts: { userId?: string | null; scope?: "company" | "personal" | null }) {
    if (opts.userId && opts.userId !== actor.id && !(await canActOnUser(actor, opts.userId))) throw new HttpError(403, "Forbidden");
    const where = opts.scope === "company" ? { userId: null } : opts.scope === "personal" ? { userId: opts.userId ?? actor.id } : { OR: [{ userId: null }, { userId: opts.userId ?? actor.id }] };
    const docs = await prisma.document.findMany({
        where,
        select: { ...META, user: { select: { id: true, name: true } }, acks: { where: { userId: actor.id }, select: { acknowledgedAt: true } }, _count: { select: { acks: true } } },
        orderBy: { createdAt: "desc" },
    });
    const activePeople = isPeopleAdmin(actor) ? await prisma.user.count({ where: { isActive: true } }) : null;
    return docs.map(({ acks, _count, ...d }) => ({ ...d, acknowledgedAt: acks[0]?.acknowledgedAt ?? null, ackCount: _count.acks, ackTotal: d.requiresAck ? activePeople : null }));
}

export async function uploadDocument(actor: SessionUser, input: { file: File; title?: string; category: string; userId?: string | null; requiresAck?: boolean }) {
    const { file } = input;
    if (!DOCUMENT_CATEGORIES.includes(input.category as any)) throw new HttpError(400, `Category must be one of ${DOCUMENT_CATEGORIES.join(", ")}.`);
    if (file.size === 0) throw new HttpError(400, "The file is empty.");
    if (file.size > MAX_DOCUMENT_BYTES) throw new HttpError(413, "Files can be up to 5 MB.");
    if (!ALLOWED_TYPES.includes(file.type)) throw new HttpError(415, "Upload a PDF, image, Word or text file.");

    const companyWide = input.userId === null || input.category === "POLICY";
    if (companyWide && !isPeopleAdmin(actor)) throw new HttpError(403, "Only HR or an admin can publish company documents.");
    const ownerId = companyWide ? null : input.userId || actor.id;
    if (ownerId && ownerId !== actor.id && !isPeopleAdmin(actor)) throw new HttpError(403, "Only HR can upload documents for someone else.");

    const doc = await prisma.document.create({
        data: {
            userId: ownerId,
            title: input.title?.trim() || file.name,
            category: input.category,
            fileName: file.name,
            mimeType: file.type,
            size: file.size,
            content: new Uint8Array(await file.arrayBuffer()),
            requiresAck: companyWide && !!input.requiresAck,
            uploadedById: actor.id,
        },
        select: META,
    });
    if (doc.requiresAck) {
        const people = await prisma.user.findMany({ where: { isActive: true, id: { not: actor.id } }, select: { id: true } });
        for (const p of people) await notify(prisma, p.id, "Policy to acknowledge", `Read and acknowledge "${doc.title}".`, "alert");
    }
    await audit(prisma, actor.id, "document.uploaded", "Document", doc.id, { category: doc.category, companyWide });
    return doc;
}

async function loadReadable(actor: SessionUser, id: string) {
    const doc = await prisma.document.findUnique({ where: { id } });
    if (!doc) throw new HttpError(404, "Document not found.");
    if (doc.userId && doc.userId !== actor.id && !(await canActOnUser(actor, doc.userId))) throw new HttpError(403, "Forbidden");
    return doc;
}

export async function downloadDocument(actor: SessionUser, id: string) {
    const doc = await loadReadable(actor, id);
    return { fileName: doc.fileName, mimeType: doc.mimeType, content: doc.content };
}

export async function acknowledgeDocument(actor: SessionUser, id: string) {
    const doc = await loadReadable(actor, id);
    if (!doc.requiresAck) throw new HttpError(400, "This document does not need acknowledgement.");
    return prisma.documentAck.upsert({
        where: { documentId_userId: { documentId: id, userId: actor.id } },
        create: { documentId: id, userId: actor.id },
        update: {},
    });
}

export async function deleteDocument(actor: SessionUser, id: string) {
    const doc = await prisma.document.findUnique({ where: { id }, select: { userId: true, uploadedById: true } });
    if (!doc) throw new HttpError(404, "Document not found.");
    if (!isPeopleAdmin(actor) && doc.uploadedById !== actor.id) throw new HttpError(403, "Only the uploader or HR can delete this document.");
    await prisma.document.delete({ where: { id } });
    await audit(prisma, actor.id, "document.deleted", "Document", id);
}

/** Who has and hasn't acknowledged a policy (HR view). */
export async function acknowledgementReport(actor: SessionUser, id: string) {
    if (!isPeopleAdmin(actor)) throw new HttpError(403, "Forbidden");
    const [people, acks] = await Promise.all([
        prisma.user.findMany({ where: { isActive: true }, select: { id: true, name: true, email: true }, orderBy: { name: "asc" } }),
        prisma.documentAck.findMany({ where: { documentId: id }, select: { userId: true, acknowledgedAt: true } }),
    ]);
    const at = new Map(acks.map(a => [a.userId, a.acknowledgedAt]));
    return people.map(p => ({ ...p, acknowledgedAt: at.get(p.id) ?? null }));
}
