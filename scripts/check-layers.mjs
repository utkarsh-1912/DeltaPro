// Enforces DeltaPro's tiers (see docs/architecture.md):
//   presentation  src/app/**/page.tsx, src/components/**   → calls the HTTP API only
//   API           src/app/api/**                            → parses, authorises, calls services
//   application   src/services/**, src/integrations/**      → business rules and transactions
//   data          src/lib/prisma.ts, src/server/db/**       → tenant-scoped Prisma client
// Fails the build when a file reaches past its neighbour tier.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const root = process.cwd();
const src = join(root, "src");

const RULES = [
    {
        name: "API routes and UI must not touch the database client",
        applies: f => f.startsWith("app/") || f.startsWith("components/"),
        banned: [/["']@\/lib\/prisma["']/, /["']@\/server\/db(\/[^"']*)?["']/],
    },
    {
        name: "UI must not import server-side services or integrations",
        applies: f => f.startsWith("components/") || (f.startsWith("app/") && !f.startsWith("app/api/") && /\.(tsx|ts)$/.test(f)),
        banned: [/["']@\/services\/[^"']+["']/, /["']@\/integrations\/[^"']+["']/, /["']@\/server\/[^"']+["']/],
    },
];

function walk(dir) {
    return readdirSync(dir).flatMap(name => {
        const full = join(dir, name);
        return statSync(full).isDirectory() ? walk(full) : /\.(ts|tsx)$/.test(name) ? [full] : [];
    });
}

const violations = [];
for (const file of walk(src)) {
    const rel = relative(src, file).split(sep).join("/");
    const lines = readFileSync(file, "utf8").split("\n");
    for (const rule of RULES) {
        if (!rule.applies(rel)) continue;
        lines.forEach((line, i) => {
            if (!/^\s*(import|export)\b/.test(line) || /^\s*import\s+type\b/.test(line)) return;
            if (rule.banned.some(re => re.test(line))) violations.push(`src/${rel}:${i + 1}  ${rule.name}\n    ${line.trim()}`);
        });
    }
}

if (violations.length) {
    console.error(`Layer check failed (${violations.length}):\n\n${violations.join("\n")}`);
    process.exit(1);
}
console.log("Layer check passed.");
