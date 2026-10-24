import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { tenantExtension } from "@/server/db/tenant";

// Data tier. Only services, repositories and integrations import this module;
// scripts/check-layers.mjs fails the build if UI or API route code does.

const rootSingleton = () => {
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    const adapter = new PrismaPg(pool);
    return new PrismaClient({ adapter });
};

declare global {
    var prismaRoot: undefined | ReturnType<typeof rootSingleton>;
}

/** Unscoped client: auth adapter, migrations, and explicit cross-tenant system work only. */
export const rootPrisma = globalThis.prismaRoot ?? rootSingleton();
if (process.env.NODE_ENV !== "production") globalThis.prismaRoot = rootPrisma;

/** Tenant-scoped client used by the application. */
export const prisma = rootPrisma.$extends(tenantExtension);

/** A client or interactive-transaction client of the scoped instance. */
export type Db = Omit<typeof prisma, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">;
