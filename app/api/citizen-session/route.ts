import { normalizeCellPhone } from "@/lib/issues";
import { getSupabasePublicClient, getSupabaseSecretClient, requestAddress, serverDigest } from "@/lib/supabase/server";
import { jsonError, rateLimitResponse } from "../_shared";

const NO_STORE = { "Cache-Control": "private, no-store" };

async function findUserByPhone(phone: string) {
  const client = getSupabaseSecretClient();
  if (!client) return null;
  let page = 1;
  for (;;) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const user = data.users.find((candidate) => normalizeCellPhone(candidate.phone ?? "") === phone);
    if (user || !data.nextPage) return user ?? null;
    page = data.nextPage;
  }
}

export async function POST(request: Request) {
  let phone: string | null;
  try {
    const payload = await request.json() as { phone?: unknown };
    phone = normalizeCellPhone(typeof payload.phone === "string" ? payload.phone : "");
  } catch {
    return jsonError("휴대전화 번호를 확인해 주세요.", 400);
  }
  if (!phone) return jsonError("휴대전화 번호를 확인해 주세요.", 400);

  const phoneHash = serverDigest(`citizen-phone:${phone}`);
  const ipHash = serverDigest(`citizen-ip:${requestAddress(request)}`);
  if (!phoneHash || !ipHash) return jsonError("서버 인증 설정을 확인해 주세요.", 503);
  const phoneLimited = rateLimitResponse(`citizen-session:phone:${phoneHash}`, 10, 60_000);
  const ipLimited = rateLimitResponse(`citizen-session:ip:${ipHash}`, 30, 60_000);
  if (phoneLimited) return phoneLimited;
  if (ipLimited) return ipLimited;

  const secret = getSupabaseSecretClient();
  const auth = getSupabasePublicClient();
  const password = serverDigest(`citizen-password:${phone}`);
  if (!secret || !auth || !password) return jsonError("서버 인증 설정을 확인해 주세요.", 503);

  try {
    let user = await findUserByPhone(phone);
    if (user) {
      const updated = await secret.auth.admin.updateUserById(user.id, { password, phone_confirm: true });
      if (updated.error) throw updated.error;
    } else {
      const created = await secret.auth.admin.createUser({ phone, password, phone_confirm: true });
      if (created.error) {
        user = await findUserByPhone(phone);
        if (!user) throw created.error;
        const updated = await secret.auth.admin.updateUserById(user.id, { password, phone_confirm: true });
        if (updated.error) throw updated.error;
      }
    }
    const signedIn = await auth.auth.signInWithPassword({ phone, password });
    if (signedIn.error || !signedIn.data.session) throw signedIn.error ?? new Error("No session");
    return Response.json({
      session: {
        access_token: signedIn.data.session.access_token,
        refresh_token: signedIn.data.session.refresh_token,
      },
    }, { headers: NO_STORE });
  } catch (error) {
    console.error("Phone-only citizen session failed", error);
    return jsonError("휴대전화 번호로 시민 세션을 시작하지 못했습니다.", 503, NO_STORE);
  }
}
