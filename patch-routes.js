const fs = require('fs');
const path = require('path');

const apiPath = path.join(__dirname, 'src', 'app', 'api');

function processRouteFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    if (content.includes('requireRole')) return; // already processed

    const isAttendance = filePath.includes('attendance');
    const allowedRoles = isAttendance ? `[Role.ADMIN, Role.HR, Role.PM, Role.USER, Role.DEV]` : `[Role.ADMIN, Role.HR, Role.PM]`;

    let newContent = content;

    // Add imports if missing
    if (!newContent.includes('requireRole') || !newContent.includes('handleAuthError')) {
        const importStatement = `import { requireRole, handleAuthError } from "@/lib/auth-utils";\nimport { Role } from "@prisma/client";\n`;
        // Insert after the first import or at the top
        newContent = importStatement + newContent;
    }

    // Replace try { with role check inside POST, PUT, DELETE
    const regex = /export\s+async\s+function\s+(POST|PUT|DELETE|PATCH)\s*\([^)]*\)\s*\{\s*try\s*\{/g;

    newContent = newContent.replace(regex, (match) => {
        return `${match}\n        await requireRole(${allowedRoles});`;
    });

    // Replace catch (error) { return NextResponse.json({ error: "..." }, { status: 500 }); }
    // We can just add a check at the start of catch block
    const catchRegex = /catch\s*\(\s*error\s*\)\s*\{/g;
    newContent = newContent.replace(catchRegex, (match) => {
        return `${match}\n        if (error instanceof Error && (error.message === "Unauthorized" || error.message === "Forbidden")) return handleAuthError(error);`;
    });

    if (newContent !== content) {
        fs.writeFileSync(filePath, newContent, 'utf-8');
        console.log(`Updated ${filePath}`);
    }
}

function traverseDir(dir) {
    fs.readdirSync(dir).forEach(file => {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            traverseDir(fullPath);
        } else if (file === 'route.ts' && !fullPath.includes('auth')) {
            processRouteFile(fullPath);
        }
    });
}

traverseDir(apiPath);
console.log('Done mapping API routes.');
