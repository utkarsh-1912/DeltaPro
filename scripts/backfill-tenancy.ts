/**
 * One-off migration to multi-tenancy. Run after `prisma db push`:
 *   npm run db:backfill-tenancy
 *
 * Creates one organization (BACKFILL_ORG_NAME, default "DeltaPro") on the Enterprise plan so no
 * existing feature disappears, then assigns every row without an organization to it.
 * Safe to run more than once: rows that already have an organization are left alone.
 */
import "dotenv/config";
import { Plan } from "@prisma/client";
import { rootPrisma } from "../src/lib/prisma";
import { TENANT_MODELS } from "../src/server/db/tenant";

async function main() {
    const name = process.env.BACKFILL_ORG_NAME || "DeltaPro";
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "deltapro";

    const org =
        (await rootPrisma.organization.findUnique({ where: { slug } })) ??
        (await rootPrisma.organization.create({ data: { name, slug, plan: Plan.ENTERPRISE } }));
    console.log(`Organization: ${org.name} (${org.id}, ${org.plan})`);

    let total = 0;
    for (const model of TENANT_MODELS) {
        // Model names are a fixed allow-list from code, so interpolating the table name is safe.
        const count = await rootPrisma.$executeRawUnsafe(`UPDATE "${model}" SET "organizationId" = $1 WHERE "organizationId" IS NULL`, org.id);
        if (count) console.log(`  ${model}: ${count}`);
        total += count;
    }
    console.log(`Assigned ${total} rows.`);

    const people = await rootPrisma.user.count({ where: { organizationId: org.id } });
    console.log(`${people} user(s) now belong to ${org.name}. Anyone listed in AUTH_ADMIN_EMAILS becomes an admin on next sign-in.`);
}

main()
    .catch(e => {
        console.error(e);
        process.exitCode = 1;
    })
    .finally(() => rootPrisma.$disconnect());
