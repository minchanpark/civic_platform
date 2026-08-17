import { authenticate, jsonError, rateLimitResponse } from "@/app/api/_shared";
import { runAiAssistanceJobs } from "@/lib/ai-assistance-worker";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;
  const { id } = await context.params;
  if (!UUID.test(id)) return jsonError("민원을 확인할 수 없습니다.", 404);
  const staff = await auth.client.rpc("is_staff");
  if (staff.error || staff.data !== true) return jsonError("관리자 권한이 필요합니다.", 403);
  const limited = rateLimitResponse(`ai-assistance:${auth.user.id}`, 10, 60_000);
  if (limited) return limited;

  let requestKey = "";
  try {
    const payload = await request.json() as { requestKey?: unknown };
    if (typeof payload.requestKey === "string") requestKey = payload.requestKey;
  } catch {
    return jsonError("요청 형식을 확인해 주세요.", 400);
  }
  if (!UUID.test(requestKey)) return jsonError("AI 작업 요청 키를 확인해 주세요.", 400);
  const queued = await auth.client.rpc("request_issue_ai_assistance", {
    target_issue_id: id, target_request_key: requestKey,
  });
  if (queued.error) {
    if (queued.error.code?.startsWith("22")) return jsonError("열람 또는 진행 중인 민원에서만 AI 작업을 요청할 수 있습니다.", 400);
    return jsonError("AI 작업을 저장하지 못했습니다.", 502);
  }

  await runAiAssistanceJobs(5);
  const detail = await auth.client.rpc("acknowledge_issue", { target_issue_id: id });
  if (detail.error || !detail.data) return jsonError("AI 작업 결과를 다시 불러오지 못했습니다.", 502);
  return Response.json(detail.data, { headers: { "Cache-Control": "private, no-store" } });
}
