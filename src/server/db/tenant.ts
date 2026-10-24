import { Prisma } from "@prisma/client";
import { currentOrgId } from "@/server/context";

/** Models whose rows belong to one organization. Keep in sync with prisma/schema.prisma. */
export const TENANT_MODELS = new Set<string>([
    "User", "LeaveBalance", "Team", "TeamMember", "Shift", "Leave", "RotaGeneration", "WeekendRota",
    "AttendanceLog", "AttendanceRequest", "AttendanceSettings", "Project", "Task", "TaskComment",
    "Workspace", "Page", "EmployeeProfile", "LeaveRequest", "Notification", "AuditLog", "Integration", "OutboxEvent",
    "Holiday", "Document", "DocumentAck", "ChecklistTemplate", "Checklist", "ChecklistTask",
    "ExpenseClaim", "Asset", "AssetEvent", "SalaryStructure", "PayrollRun", "Payslip",
    "ReviewCycle", "Goal", "KeyResult", "Review", "Feedback",
]);

const FILTERED = new Set([
    "findFirst", "findFirstOrThrow", "findMany", "findUnique", "findUniqueOrThrow",
    "count", "aggregate", "groupBy", "update", "updateMany", "updateManyAndReturn", "delete", "deleteMany", "upsert",
]);

const withOrg = (data: any, orgId: string) => (data && data.organizationId === undefined ? { ...data, organizationId: orgId } : data);

/**
 * Row-level tenant isolation. Inside a tenant context every read and write on a tenant model
 * is filtered by, and stamped with, the caller's organizationId. Nested writes are not
 * rewritten, so services set organizationId explicitly on nested creates.
 */
export const tenantExtension = Prisma.defineExtension({
    name: "tenant-isolation",
    query: {
        $allModels: {
            async $allOperations({ model, operation, args, query }) {
                const orgId = currentOrgId();
                if (!orgId || !model || !TENANT_MODELS.has(model)) return query(args);
                const a: any = { ...(args ?? {}) };
                if (FILTERED.has(operation)) a.where = { ...(a.where ?? {}), organizationId: orgId };
                if (operation === "create") a.data = withOrg(a.data, orgId);
                if (operation === "createMany" || operation === "createManyAndReturn") {
                    a.data = (Array.isArray(a.data) ? a.data : [a.data]).map((d: any) => withOrg(d, orgId));
                }
                if (operation === "upsert") a.create = withOrg(a.create, orgId);
                return query(a);
            },
        },
    },
});
