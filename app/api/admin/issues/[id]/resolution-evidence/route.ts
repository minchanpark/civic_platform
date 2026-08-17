import { createHash } from "node:crypto";
import { IssuePhotoError, MAX_PHOTO_BYTES, processIssuePhoto } from "@/app/api/issues/input";
import { authenticate, jsonError } from "@/app/api/_shared";
import { getSupabaseSecretClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;
  const { id } = await context.params;
  if (!UUID.test(id)) return jsonError("민원을 확인할 수 없습니다.", 404);
  const staff = await auth.client.rpc("is_staff");
  if (staff.error || staff.data !== true) return jsonError("관리자 권한이 필요합니다.", 403);

  const contentLength = request.headers.get("content-length");
  if (contentLength && (!/^\d+$/.test(contentLength) || Number(contentLength) > MAX_PHOTO_BYTES + 64 * 1024)) {
    return jsonError("요청 또는 사진이 너무 큽니다.", 413);
  }

  let photo: File;
  let note: string;
  try {
    const form = await request.formData();
    const files = [...form.entries()].filter((entry): entry is [string, File] => entry[1] instanceof File);
    if (files.length !== 1 || files[0][0] !== "photo") throw new IssuePhotoError("처리 후 사진 한 장이 필요합니다.");
    photo = files[0][1];
    const notes = form.getAll("inspectionNote");
    if (notes.length !== 1 || typeof notes[0] !== "string") throw new IssuePhotoError("현장 점검 기록이 필요합니다.");
    note = notes[0].trim();
    if ([...note].length < 10 || [...note].length > 1000) throw new IssuePhotoError("현장 점검 기록은 10~1,000자로 입력해 주세요.");
  } catch (error) {
    return jsonError(error instanceof IssuePhotoError ? error.message : "처리 후 증빙을 읽을 수 없습니다.", 400);
  }

  let processed: Awaited<ReturnType<typeof processIssuePhoto>>;
  try {
    processed = await processIssuePhoto(photo);
  } catch (error) {
    return jsonError(error instanceof IssuePhotoError ? error.message : "처리 후 사진을 읽을 수 없습니다.", 400);
  }
  const secret = getSupabaseSecretClient();
  if (!secret) return jsonError("서버 저장소 설정을 확인해 주세요.", 503);
  const hash = createHash("sha256").update(processed.data).digest("hex");
  const objectPath = `resolution/${id}/${hash}.jpg`;
  const upload = await secret.storage.from("issue-photos").upload(objectPath, processed.data, {
    contentType: "image/jpeg",
    cacheControl: "0",
    upsert: false,
  });
  if (upload.error) {
    const exists = await secret.storage.from("issue-photos").exists(objectPath);
    if (exists.error || !exists.data) return jsonError("처리 후 사진을 저장하지 못했습니다.", 502);
  }

  const recorded = await auth.client.rpc("record_resolution_evidence", {
    target_issue_id: id,
    target_object_path: objectPath,
    target_inspection_note: note,
  });
  if (recorded.error || !recorded.data) {
    if (recorded.error?.code?.startsWith("22")) return jsonError("진행 중인 민원과 현장 점검 기록을 확인해 주세요.", 400);
    if (recorded.error?.code === "23505") return jsonError("다른 처리 후 증빙이 이미 기록되었습니다.", 409);
    return jsonError("처리 후 증빙을 기록하지 못했습니다.", 502);
  }
  return Response.json(recorded.data, { headers: { "Cache-Control": "private, no-store" } });
}
