import sharp from "sharp";
import { isInsideDistrict } from "../../../lib/district-boundaries.ts";
import {
  validateCitizenContact,
  validateIssueSubmission,
  type CitizenContactInput,
  type IssueSubmissionInput,
} from "../../../lib/issues.ts";

export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
export const MAX_PHOTO_PIXELS = 25_000_000;
const SUPPORTED_PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const SUPPORTED_PHOTO_FORMATS = new Set(["jpeg", "png", "webp"]);

export class IssuePhotoError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function requiredText(form: FormData, key: string) {
  const values = form.getAll(key);
  if (values.length !== 1 || typeof values[0] !== "string") throw new IssuePhotoError(`${key} 값이 필요합니다.`);
  return values[0];
}

function optionalText(form: FormData, key: string) {
  const values = form.getAll(key);
  if (values.length > 1 || (values.length === 1 && typeof values[0] !== "string")) throw new IssuePhotoError(`${key} 값이 올바르지 않습니다.`);
  return values.length ? String(values[0]) : "";
}

export function parseIssueForm(form: FormData): {
  input: ReturnType<typeof validateIssueSubmission>;
  contact: ReturnType<typeof validateCitizenContact>;
  photo: File;
  recurrenceToken: string | null;
} {
  const files = [...form.entries()].filter((entry): entry is [string, File] => entry[1] instanceof File);
  if (files.length !== 1 || files[0][0] !== "photo") throw new IssuePhotoError("사진을 정확히 한 장 첨부해 주세요.");
  const photo = files[0][1];
  if (photo.size < 1) throw new IssuePhotoError("빈 사진은 제출할 수 없습니다.");
  if (photo.size > MAX_PHOTO_BYTES) throw new IssuePhotoError("사진은 10 MiB 이하여야 합니다.", 413);
  if (!SUPPORTED_PHOTO_TYPES.has(photo.type.toLowerCase())) throw new IssuePhotoError("JPEG, PNG 또는 WebP 사진만 제출할 수 있습니다.");

  const input: IssueSubmissionInput = {
    submissionKey: requiredText(form, "submissionKey"),
    category: requiredText(form, "category"),
    districtId: requiredText(form, "districtId"),
    latitude: Number(requiredText(form, "latitude")),
    longitude: Number(requiredText(form, "longitude")),
    title: requiredText(form, "title"),
    body: requiredText(form, "body"),
  };
  const validated = validateIssueSubmission(input);
  const contactInput: CitizenContactInput = {
    realName: requiredText(form, "realName"),
    gender: requiredText(form, "gender"),
    ageGroup: requiredText(form, "ageGroup"),
    cellPhone: requiredText(form, "cellPhone"),
    lineId: optionalText(form, "lineId"),
    contactEmail: optionalText(form, "contactEmail"),
  };
  const contact = validateCitizenContact(contactInput);
  const recurrenceValues = form.getAll("recurrenceToken");
  if (recurrenceValues.length > 1 || (recurrenceValues.length === 1 && typeof recurrenceValues[0] !== "string")) {
    throw new IssuePhotoError("재발 증빙 토큰이 올바르지 않습니다.");
  }
  const recurrenceToken = recurrenceValues.length ? String(recurrenceValues[0]).trim() : null;
  if (recurrenceToken && !/^[A-Za-z0-9_-]{43}$/.test(recurrenceToken)) {
    throw new IssuePhotoError("재발 증빙 토큰이 올바르지 않습니다.");
  }
  if (!recurrenceToken && !isInsideDistrict(validated.districtId, validated.latitude, validated.longitude)) {
    throw new IssuePhotoError("선택한 행정구 경계 안에 PIN을 놓아 주세요.");
  }
  return { input: validated, contact, photo, recurrenceToken: recurrenceToken || null };
}

async function encodeJpeg(input: Buffer, quality: number) {
  return sharp(input, { failOn: "error", limitInputPixels: MAX_PHOTO_PIXELS })
    .rotate()
    .flatten({ background: "#ffffff" })
    .jpeg({ quality, chromaSubsampling: "4:2:0" })
    .toBuffer({ resolveWithObject: true });
}

export async function processIssuePhoto(photo: File) {
  const source = Buffer.from(await photo.arrayBuffer());
  try {
    const metadata = await sharp(source, { failOn: "error", limitInputPixels: MAX_PHOTO_PIXELS }).metadata();
    if (!metadata.format || !SUPPORTED_PHOTO_FORMATS.has(metadata.format)) {
      throw new IssuePhotoError("JPEG, PNG 또는 WebP 사진만 제출할 수 있습니다.");
    }
    let encoded = await encodeJpeg(source, 82);
    if (encoded.data.byteLength > MAX_PHOTO_BYTES) encoded = await encodeJpeg(source, 65);
    const { width, height } = encoded.info;
    if (!width || !height || width * height > MAX_PHOTO_PIXELS) throw new IssuePhotoError("사진 해상도는 25MP 이하여야 합니다.");
    if (encoded.data.byteLength > MAX_PHOTO_BYTES) throw new IssuePhotoError("처리한 사진은 10 MiB 이하여야 합니다.", 413);
    return { data: encoded.data, width, height };
  } catch (error) {
    if (error instanceof IssuePhotoError) throw error;
    throw new IssuePhotoError("사진을 읽거나 처리할 수 없습니다.");
  }
}
