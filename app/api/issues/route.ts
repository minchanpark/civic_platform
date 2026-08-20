import { createHash } from "node:crypto";
import { reverseGeocode } from "@/lib/geocoding";
import { IssueInputError, normalizeCellPhone } from "@/lib/issues";
import { getSupabaseSecretClient, serverDigest } from "@/lib/supabase/server";
import { authenticate, jsonError, rateLimitResponse } from "../_shared";
import { IssuePhotoError, MAX_PHOTO_BYTES, parseIssueForm, processIssuePhoto } from "./input";

export const runtime = "nodejs";

const MAX_REQUEST_BYTES = MAX_PHOTO_BYTES + 128 * 1024;
const NO_STORE = { "Cache-Control": "private, no-store" };

type StoredIssue = {
  id: string;
  ticket_number: string;
  status: string;
  created_at: string;
};

function issueResponse(issue: StoredIssue, created = false) {
  return Response.json({
    created,
    issue: {
      id: issue.id,
      ticketNumber: issue.ticket_number,
      status: issue.status,
      createdAt: issue.created_at,
    },
  }, { status: created ? 201 : 200, headers: NO_STORE });
}

export async function POST(request: Request) {
  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;
  const verifiedPhone = auth.user.phone_confirmed_at ? normalizeCellPhone(auth.user.phone ?? "") : null;
  if (!verifiedPhone || auth.user.is_anonymous) {
    return jsonError("확인된 휴대전화 계정으로 로그인해 주세요.", 403);
  }
  const limited = rateLimitResponse(`issue-submit:${auth.user.id}`, 5, 60_000);
  if (limited) return limited;

  if (!request.headers.get("content-type")?.toLowerCase().startsWith("multipart/form-data")) {
    return jsonError("multipart/form-data 요청이 필요합니다.", 415);
  }
  const contentLength = request.headers.get("content-length");
  if (contentLength && (!/^\d+$/.test(contentLength) || Number(contentLength) > MAX_REQUEST_BYTES)) {
    return jsonError("요청 또는 사진이 너무 큽니다.", 413);
  }

  let parsed: ReturnType<typeof parseIssueForm>;
  try {
    parsed = parseIssueForm(await request.formData());
  } catch (error) {
    if (error instanceof IssuePhotoError) return jsonError(error.message, error.status);
    if (error instanceof IssueInputError) return jsonError(error.message, 400);
    return jsonError("제출 내용을 읽을 수 없습니다.", 400);
  }
  if (parsed.contact.cellPhone !== verifiedPhone) {
    return jsonError("인증한 휴대전화 번호와 시민 정보의 번호가 일치해야 합니다.", 403);
  }

  const secret = getSupabaseSecretClient();
  if (!secret) return jsonError("서버 저장소 설정을 확인해 주세요.", 503);

  const address = await reverseGeocode(parsed.input.latitude, parsed.input.longitude);
  if (!address) return jsonError("선택한 위치의 주소를 확인할 수 없습니다. 위치를 다시 선택해 주세요.", 502);

  let photo: Awaited<ReturnType<typeof processIssuePhoto>>;
  try {
    photo = await processIssuePhoto(parsed.photo);
  } catch (error) {
    if (error instanceof IssuePhotoError) return jsonError(error.message, error.status);
    return jsonError("사진을 처리할 수 없습니다.", 400);
  }

  const photoHash = createHash("sha256").update(photo.data).digest("hex");
  const photoPath = `${auth.user.id}/${parsed.input.submissionKey}/${photoHash}.jpg`;
  // Ambiguous failures retain content-addressed uploads for safe retry; the
  // protected automatic job removes unreferenced objects after a 24-hour grace period.
  const upload = await secret.storage.from("issue-photos").upload(photoPath, photo.data, {
    contentType: "image/jpeg",
    cacheControl: "0",
    upsert: false,
  });
  if (upload.error) {
    const existingObject = await secret.storage.from("issue-photos").exists(photoPath);
    if (existingObject.error || !existingObject.data) {
      console.error("Issue photo upload failed", upload.error);
      return jsonError("사진을 저장하지 못했습니다. 같은 제출을 다시 시도해 주세요.", 502);
    }
  }

  const issueParameters = {
    target_reporter_id: auth.user.id,
    target_submission_key: parsed.input.submissionKey,
    target_category: parsed.input.category,
    target_district_id: parsed.input.districtId,
    target_latitude: parsed.input.latitude,
    target_longitude: parsed.input.longitude,
    target_address: address,
    target_title: parsed.input.title,
    target_body: parsed.input.body,
    target_photo_path: photoPath,
    target_photo_bytes: photo.data.byteLength,
    target_photo_width: photo.width,
    target_photo_height: photo.height,
    target_real_name: parsed.contact.realName,
    target_gender: parsed.contact.gender,
    target_age_group: parsed.contact.ageGroup,
    target_cell_phone: parsed.contact.cellPhone,
    target_line_id: parsed.contact.lineId,
    target_contact_email: parsed.contact.contactEmail,
  };
  const recurrenceTokenHash = parsed.recurrenceToken
    ? serverDigest(`recurrence:${parsed.recurrenceToken}`)
    : null;
  if (parsed.recurrenceToken && !recurrenceTokenHash) return jsonError("서버 인증 설정을 확인해 주세요.", 503);
  const { data, error } = parsed.recurrenceToken
    ? await secret.rpc("submit_recurrence_issue", { ...issueParameters, target_token_hash: recurrenceTokenHash! })
    : await secret.rpc("submit_issue", issueParameters);

  if (error) {
    console.error("Issue submission RPC failed", error);
    if (error.code === "23505") return jsonError("같은 제출 키가 다른 내용에 이미 사용되었습니다.", 409);
    if (error.code === "42501") return jsonError(parsed.recurrenceToken ? "재발 증빙이 만료되었거나 사용할 수 없습니다." : "확인된 휴대전화 계정으로 로그인해 주세요.", 403);
    if (error.code?.startsWith("22")) return jsonError(parsed.recurrenceToken ? "현재 위치·PIN·촬영 후 5분 조건을 다시 확인해 주세요." : "제출 내용이 올바르지 않습니다.", 400);
    return jsonError("민원을 접수하지 못했습니다. 같은 제출을 다시 시도해 주세요.", 502);
  }

  if (!data || typeof data !== "object") {
    console.error("Issue submission RPC returned an invalid result", data);
    return jsonError("민원 접수 결과를 확인하지 못했습니다.", 502);
  }
  const result = data as Record<string, unknown>;
  if (typeof result.id !== "string" || typeof result.ticketNumber !== "string"
    || typeof result.status !== "string" || typeof result.createdAt !== "string") {
    console.error("Issue submission RPC returned an incomplete result", data);
    return jsonError("민원 접수 결과를 확인하지 못했습니다.", 502);
  }

  // The insert trigger queues risk evaluation; the scheduled worker handles it separately.
  return issueResponse({
    id: result.id,
    ticket_number: result.ticketNumber,
    status: result.status,
    created_at: result.createdAt,
  }, result.created === true);
}
