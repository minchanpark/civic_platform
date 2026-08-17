import { getSupabaseSecretClient } from "@/lib/supabase/server";
import { authenticate, jsonError, rateLimitResponse } from "../../../_shared";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;
  const { id } = await context.params;
  if (!UUID.test(id)) return jsonError("사진을 찾을 수 없습니다.", 404);
  const kind = new URL(request.url).searchParams.get("kind") === "resolution" ? "resolution" : "report";
  const limited = rateLimitResponse(`issue-photo:${kind}:${auth.user.id}`, 60, 60_000);
  if (limited) return limited;

  const authorization = await auth.client.rpc(
    kind === "resolution" ? "authorize_resolution_evidence_photo" : "authorize_issue_photo",
    { target_issue_id: id },
  );
  if (authorization.error || typeof authorization.data !== "string") {
    return jsonError("사진을 찾을 수 없습니다.", 404, { "Cache-Control": "private, no-store" });
  }

  const secret = getSupabaseSecretClient();
  if (!secret) return jsonError("서버 저장소 설정을 확인해 주세요.", 503);
  const photo = await secret.storage.from("issue-photos").download(authorization.data, {}, { cache: "no-store" });
  if (photo.error || !photo.data) {
    console.error("Authorized issue photo download failed", photo.error);
    return jsonError("사진을 찾을 수 없습니다.", 404, { "Cache-Control": "private, no-store" });
  }

  const bytes = await photo.data.arrayBuffer();
  return new Response(bytes, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": "inline",
      "Content-Length": String(bytes.byteLength),
      "Content-Type": "image/jpeg",
      "Pragma": "no-cache",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
