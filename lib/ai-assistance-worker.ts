import { createAiAssistance } from "@/lib/ai-assistance";
import { getSupabaseSecretClient } from "@/lib/supabase/server";

type AiAssistanceJob = { job_id: string; title: string; body: string; category: string };

export async function runAiAssistanceJobs(limit = 5) {
  const secret = getSupabaseSecretClient();
  if (!secret) return { ok: false as const, claimed: 0, succeeded: 0, failed: 0 };
  const lockToken = crypto.randomUUID();
  const claim = await secret.rpc("claim_ai_assistance_jobs", { target_limit: limit, target_lock_token: lockToken });
  if (claim.error) return { ok: false as const, claimed: 0, succeeded: 0, failed: 0 };
  const jobs = (claim.data ?? []) as AiAssistanceJob[];
  let succeeded = 0;
  let failed = 0;
  for (const job of jobs) {
    const result = await createAiAssistance({ title: job.title, body: job.body, category: job.category });
    const finish = await secret.rpc("finish_ai_assistance_job", {
      target_job_id: job.job_id,
      target_lock_token: lockToken,
      target_success: Boolean(result),
      target_summary: result?.summary ?? null,
      target_answer_draft: result?.answerDraft ?? null,
      target_model: result?.model ?? null,
      target_model_version: result?.modelVersion ?? null,
      target_failure_code: result ? "provider_error" : "provider_unavailable",
    });
    if (!finish.error && finish.data === true && result) succeeded += 1;
    else failed += 1;
  }
  return { ok: true as const, claimed: jobs.length, succeeded, failed };
}
