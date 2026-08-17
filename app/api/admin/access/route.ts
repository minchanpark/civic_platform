import { authenticateWithClaims, jsonError } from "../../_shared";
import { getSupabaseSecretClient, requestAddress, serverDigest } from "@/lib/supabase/server";

type AccessResult = { authorized?: boolean; locked?: boolean; retryAfter?: number };

export async function POST(request: Request) {
  const auth = await authenticateWithClaims(request);
  if (!auth.ok) return auth.response;

  let staffNumber = "";
  try {
    const payload = await request.json() as { staffNumber?: unknown };
    if (typeof payload.staffNumber === "string") staffNumber = payload.staffNumber.trim().toUpperCase();
  } catch {
    return jsonError("요청 형식을 확인해 주세요.", 400);
  }
  if (staffNumber.length > 24) return jsonError("관리자 번호를 확인해 주세요.", 400);

  const ipHash = serverDigest(`admin-ip:${requestAddress(request)}`);
  const client = getSupabaseSecretClient();
  if (!ipHash || !client) return jsonError("서버 인증 설정을 확인해 주세요.", 503);
  const { data, error } = await client.rpc("verify_staff_number", {
    target_user_id: auth.user.id,
    target_session_id: auth.claims.sessionId,
    target_staff_number: staffNumber,
    target_ip_hash: ipHash,
  });
  if (error || !data) return jsonError("관리자 번호를 확인하지 못했습니다.", 503);
  const result = data as AccessResult;
  if (result.locked) {
    return jsonError("관리자 번호 확인이 잠겼습니다. 잠시 후 다시 시도해 주세요.", 429, {
      "Retry-After": String(result.retryAfter ?? 900),
    });
  }
  if (!result.authorized) return jsonError("관리자 번호를 확인해 주세요.", 403);
  return Response.json({ authorized: true }, { headers: { "Cache-Control": "private, no-store" } });
}
