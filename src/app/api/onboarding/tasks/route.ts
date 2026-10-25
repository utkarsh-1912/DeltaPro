import { route } from "@/lib/api";
import { myChecklistTasks } from "@/services/onboarding";

export const dynamic = "force-dynamic";

/** Open onboarding / offboarding tasks assigned to the signed-in user. */
export const GET = route(async ({ user }) => myChecklistTasks(user), { feature: "onboarding" });
