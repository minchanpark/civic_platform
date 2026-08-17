import { assessIssueRisk } from "@/lib/ai-risk";
import type { IssueCategory } from "@/lib/issues";
import { getSupabaseSecretClient } from "@/lib/supabase/server";

type AiRetry = { issue_id: string; title: string; body: string; category: IssueCategory };

export async function runAiRiskRetries(limit = 10) {
  const secret = getSupabaseSecretClient();
  if (!secret) return { ok: false as const, claimed: 0, evaluated: 0, failed: 0 };
  const lockToken = crypto.randomUUID();
  const claim = await secret.rpc("claim_ai_assessment_retries", { target_limit: limit, target_lock_token: lockToken });
  if (claim.error) return { ok: false as const, claimed: 0, evaluated: 0, failed: 0 };
  const jobs = (claim.data ?? []) as AiRetry[];
  let evaluated = 0;
  let failed = 0;
  for (const job of jobs) {
    const assessment = await assessIssueRisk({ title: job.title, body: job.body, category: job.category });
    const recorded = assessment ? await secret.rpc("record_issue_ai_assessment", {
      target_issue_id: job.issue_id,
      target_risk_level: assessment.riskLevel,
      target_risk_reason_codes: assessment.riskReasonCodes,
      target_filter_reason_codes: assessment.filterReasonCodes,
      target_input_scope: assessment.inputScope,
      target_model: assessment.model,
      target_model_version: assessment.modelVersion,
    }) : null;
    const success = Boolean(assessment && !recorded?.error);
    const finished = await secret.rpc("finish_ai_assessment_retry", {
      target_issue_id: job.issue_id, target_lock_token: lockToken,
      target_success: success, target_failure_code: assessment ? "provider_error" : "provider_unavailable",
    });
    if (success && !finished.error && finished.data === true) evaluated += 1;
    else failed += 1;
  }
  return { ok: true as const, claimed: jobs.length, evaluated, failed };
}
