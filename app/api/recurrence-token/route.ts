import { randomBytes } from "node:crypto";
import { authenticate, jsonError } from "../_shared";
import { getSupabaseSecretClient, requestAddress, serverDigest } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;
  if (!auth.user.phone || !auth.user.phone_confirmed_at || auth.user.is_anonymous) return jsonError("확인된 휴대전화 계정이 필요합니다.", 403);

  let latitude: number;
  let longitude: number;
  let accuracy: number;
  let sourceIssueId: string;
  try {
    const payload = await request.json() as { latitude?: unknown; longitude?: unknown; accuracy?: unknown; sourceIssueId?: unknown };
    latitude = Number(payload.latitude);
    longitude = Number(payload.longitude);
    accuracy = Number(payload.accuracy);
    sourceIssueId = typeof payload.sourceIssueId === "string" ? payload.sourceIssueId : "";
  } catch {
    return jsonError("현재 위치를 확인해 주세요.", 400);
  }
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !Number.isFinite(accuracy) || !UUID.test(sourceIssueId)) {
    return jsonError("현재 위치를 확인해 주세요.", 400);
  }

  const token = randomBytes(32).toString("base64url");
  const tokenHash = serverDigest(`recurrence:${token}`);
  const ipHash = serverDigest(`recurrence-ip:${requestAddress(request)}`);
  const client = getSupabaseSecretClient();
  if (!tokenHash || !ipHash || !client) return jsonError("서버 인증 설정을 확인해 주세요.", 503);
  const { data, error } = await client.rpc("create_recurrence_capture_token", {
    target_user_id: auth.user.id,
    target_source_issue_id: sourceIssueId,
    target_token_hash: tokenHash,
    target_latitude: latitude,
    target_longitude: longitude,
    target_accuracy_meters: accuracy,
    target_ip_hash: ipHash,
  });
  if (error?.code === "P0001") return jsonError("현장 촬영 요청이 너무 많습니다. 15분 뒤 다시 시도해 주세요.", 429, { "Retry-After": "900" });
  if (error?.code === "42501") return jsonError("재신고할 완료 티켓을 확인할 수 없습니다.", 403);
  if (error?.code?.startsWith("22")) return jsonError("현재 위치가 원래 이슈 위치의 500m 안에 있어야 합니다.", 400);
  if (error || typeof data !== "string") return jsonError("현장 촬영을 시작하지 못했습니다.", 502);
  return Response.json({ token, expiresAt: data }, { headers: { "Cache-Control": "private, no-store" } });
}
