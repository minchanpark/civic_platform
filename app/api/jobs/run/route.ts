import { validJobAuthorization } from "@/lib/job-auth";
import { runAiRiskRetries } from "@/lib/ai-retry-worker";
import { runAiAssistanceJobs } from "@/lib/ai-assistance-worker";
import { runNotificationDispatch } from "@/lib/notification-worker";
import { getSupabaseSecretClient } from "@/lib/supabase/server";
import { jsonError } from "../../_shared";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!validJobAuthorization(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return jsonError("Unauthorized", 401);
  }
  const secret = getSupabaseSecretClient();
  if (!secret) return jsonError("Job storage is not configured", 503);

  const [snapshot, notifications, aiRisk, aiAssistance, orphaned] = await Promise.all([
    secret.rpc("refresh_public_snapshots_if_due"),
    runNotificationDispatch(50),
    runAiRiskRetries(10),
    runAiAssistanceJobs(5),
    secret.rpc("list_orphaned_issue_photos", { target_limit: 100 }),
  ]);
  const paths = orphaned.error ? [] : ((orphaned.data ?? []) as Array<{ object_path: string }>).map((item) => item.object_path);
  const removed = paths.length ? await secret.storage.from("issue-photos").remove(paths) : { error: null };
  const ok = !snapshot.error && notifications.ok && aiRisk.ok && aiAssistance.ok
    && !orphaned.error && !removed.error && notifications.finishErrors === 0;
  return Response.json({
    ok,
    snapshot: snapshot.error ? { success: false } : snapshot.data,
    notifications: notifications.ok ? notifications : { ok: false },
    aiRisk,
    aiAssistance,
    orphanPhotosRemoved: removed.error ? 0 : paths.length,
  }, { status: ok ? 200 : 502, headers: { "Cache-Control": "private, no-store" } });
}
