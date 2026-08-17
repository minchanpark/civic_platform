import { runNotificationDispatch } from "@/lib/notification-worker";
import { authenticate, jsonError, rateLimitResponse } from "../../_shared";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;
  const staff = await auth.client.rpc("is_staff");
  if (staff.error || staff.data !== true) return jsonError("활성 관리자만 알림을 발송할 수 있습니다.", 403);
  const limited = rateLimitResponse(`notification-dispatch:${auth.user.id}`, 10, 60_000);
  if (limited) return limited;
  const result = await runNotificationDispatch();
  if (!result.ok) return jsonError("이메일 또는 작업 설정을 확인해 주세요.", result.error === "configuration" ? 503 : 502);
  return Response.json(result, { headers: { "Cache-Control": "private, no-store" } });
}
