import type { SupabaseClient, User } from "@supabase/supabase-js";
import { takeRateLimit } from "@/lib/rate-limit";
import { bearerToken, getSupabaseClientForToken } from "@/lib/supabase/server";

type Authentication =
  | { ok: true; client: SupabaseClient; user: User }
  | { ok: false; response: Response };

export function jsonError(message: string, status: number, headers?: HeadersInit) {
  return Response.json({ error: message }, { status, headers });
}

export async function authenticate(request: Request): Promise<Authentication> {
  const token = bearerToken(request);
  if (!token) return { ok: false, response: jsonError("인증이 필요합니다.", 401) };
  const client = getSupabaseClientForToken(token);
  if (!client) return { ok: false, response: jsonError("서버 인증 설정을 확인해 주세요.", 503) };

  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return { ok: false, response: jsonError("인증이 만료되었거나 올바르지 않습니다.", 401) };
  return { ok: true, client, user: data.user };
}

export async function authenticateWithClaims(request: Request) {
  const authentication = await authenticate(request);
  if (!authentication.ok) return authentication;
  const token = bearerToken(request)!;
  const { data, error } = await authentication.client.auth.getClaims(token);
  const sessionId = data?.claims.session_id;
  if (error || typeof sessionId !== "string") {
    return { ok: false as const, response: jsonError("인증 세션을 확인할 수 없습니다.", 401) };
  }
  return { ...authentication, claims: { sessionId } };
}

export function rateLimitResponse(key: string, limit: number, windowMs: number) {
  const result = takeRateLimit(key, limit, windowMs);
  return result.allowed
    ? null
    : jsonError("요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.", 429, { "Retry-After": String(result.retryAfterSeconds) });
}
