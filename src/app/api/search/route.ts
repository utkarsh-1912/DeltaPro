import { route } from "@/lib/api";
import { search } from "@/services/workspace";

export const dynamic = "force-dynamic";

export const GET = route(async ({ req }) => search(new URL(req.url).searchParams.get("q") ?? ""));
