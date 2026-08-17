import { jsonError } from "../../_shared";
import { getSupabasePublicClient, getSupabaseSecretClient, requestAddress, serverDigest } from "@/lib/supabase/server";

type Payload = { action?: unknown; email?: unknown; token?: unknown };
type RateResult = { allowed?: boolean; retryAfter?: number };

async function consume(scope: string, keyHash: string, limit: number) {
  const client = getSupabaseSecretClient();
  if (!client) return null;
  const { data, error } = await client.rpc("consume_admin_auth_rate_limit", {
    target_scope: scope,
    target_key_hash: keyHash,
    target_limit: limit,
    target_window_seconds: 900,
    target_lock_seconds: 900,
  });
  return error ? null : data as RateResult;
}

export async function POST(request: Request) {
  let payload: Payload;
  try {
    payload = await request.json() as Payload;
  } catch {
    return jsonError("요청 형식을 확인해 주세요.", 400);
  }

  const action = payload.action;
  const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  const token = typeof payload.token === "string" ? payload.token.trim() : "";
  if ((action !== "send" && action !== "verify") || email.length > 320 || !/^\S+@\S+\.\S+$/.test(email)) {
    return jsonError("요청 형식을 확인해 주세요.", 400);
  }

  const emailHash = serverDigest(`admin-email:${email}`);
  const ipHash = serverDigest(`admin-ip:${requestAddress(request)}`);
  const auth = getSupabasePublicClient();
  if (!emailHash || !ipHash || !auth) return jsonError("서버 인증 설정을 확인해 주세요.", 503);

  const prefix = action === "send" ? "otp-send" : "otp-verify";
  const limit = action === "send" ? 10 : 5;
  const [emailRate, ipRate] = await Promise.all([
    consume(`${prefix}-email`, emailHash, limit),
    consume(`${prefix}-ip`, ipHash, limit),
  ]);
  if (!emailRate || !ipRate) return jsonError("인증 잠금 상태를 확인하지 못했습니다.", 503);
  if (!emailRate.allowed || !ipRate.allowed) {
    const retryAfter = Math.max(emailRate.retryAfter ?? 1, ipRate.retryAfter ?? 1);
    return jsonError("인증 시도가 잠겼습니다. 잠시 후 다시 시도해 주세요.", 429, { "Retry-After": String(retryAfter) });
  }

  if (action === "send") {
    const sent = await auth.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
    if (sent.error?.status === 429) {
      return jsonError("인증번호는 잠시 후 다시 요청해 주세요.", 429, { "Retry-After": "30" });
    }
    if (sent.error) return jsonError("확인 코드를 보내지 못했습니다. 잠시 후 다시 시도해 주세요.", 503);
    return Response.json(
      { sent: true, message: "등록된 관리자 이메일이면 확인 코드를 보냈습니다." },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  }

  if (!/^\d{6}$/.test(token)) return jsonError("6자리 확인 코드를 입력해 주세요.", 400);
  const { data, error } = await auth.auth.verifyOtp({ email, token, type: "email" });
  if (error || !data.session) return jsonError("코드가 올바르지 않거나 만료되었습니다.", 400);
  return Response.json({
    session: {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    },
  }, { headers: { "Cache-Control": "private, no-store" } });
}
