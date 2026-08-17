import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { IssuePhotoError, parseIssueForm, processIssuePhoto } from "./input.ts";

async function validForm() {
  const form = new FormData();
  form.set("submissionKey", "123e4567-e89b-42d3-a456-426614174000");
  form.set("category", "road_sidewalk");
  form.set("districtId", "taoyuan");
  form.set("latitude", "24.9937");
  form.set("longitude", "121.301");
  form.set("title", "도로 포트홀 신고");
  form.set("body", "차량 통행 중 위험한 포트홀이 발견되었습니다.");
  form.set("realName", "홍길동");
  form.set("gender", "other");
  form.set("ageGroup", "31_40");
  form.set("cellPhone", "0912-345-678");
  form.set("lineId", "civic.pin");
  form.set("contactEmail", "CONTACT@example.com");
  const png = await sharp({ create: { width: 3, height: 2, channels: 4, background: "#55aaff" } }).png().toBuffer();
  form.set("photo", new File([png], "damage.png", { type: "image/png" }));
  return form;
}

test("accepts exactly one photo and normalizes it to JPEG", async () => {
  const parsed = parseIssueForm(await validForm());
  assert.deepEqual(parsed.contact, {
    realName: "홍길동",
    gender: "other",
    ageGroup: "31_40",
    cellPhone: "+886912345678",
    lineId: "civic.pin",
    contactEmail: "contact@example.com",
  });
  const processed = await processIssuePhoto(parsed.photo);
  const metadata = await sharp(processed.data).metadata();
  assert.equal(metadata.format, "jpeg");
  assert.deepEqual([processed.width, processed.height], [3, 2]);
});

test("requires valid citizen contact fields at the server boundary", async () => {
  const form = await validForm();
  form.set("cellPhone", "not-a-phone");
  assert.throws(() => parseIssueForm(form), /휴대전화/);
});

test("rejects an extra file even under another field name", async () => {
  const form = await validForm();
  form.set("extra", new File(["extra"], "extra.jpg", { type: "image/jpeg" }));
  assert.throws(() => parseIssueForm(form), IssuePhotoError);
});

test("validates the PIN against the selected official district boundary", async () => {
  const fuxing = await validForm();
  fuxing.set("districtId", "fuxing");
  fuxing.set("latitude", "24.81538");
  fuxing.set("longitude", "121.3519");
  assert.equal(parseIssueForm(fuxing).input.districtId, "fuxing");

  const mismatch = await validForm();
  mismatch.set("districtId", "fuxing");
  assert.throws(() => parseIssueForm(mismatch), IssuePhotoError);
});

test("rejects content that sharp cannot decode", async () => {
  await assert.rejects(
    processIssuePhoto(new File(["not an image"], "broken.png", { type: "image/png" })),
    IssuePhotoError,
  );
});

test("rejects an SVG disguised with an allowed MIME type", async () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"><rect width="2" height="2"/></svg>';
  await assert.rejects(
    processIssuePhoto(new File([svg], "disguised.png", { type: "image/png" })),
    IssuePhotoError,
  );
});

test("accepts one bounded recurrence capture token without changing photo validation", async () => {
  const form = await validForm();
  form.set("districtId", "fuxing");
  form.set("recurrenceToken", "A".repeat(43));
  const parsed = parseIssueForm(form);
  assert.equal(parsed.recurrenceToken, "A".repeat(43));
  assert.equal(parsed.photo.name, "damage.png");
  assert.equal(parsed.input.districtId, "fuxing");
});

test("rejects a malformed recurrence capture token", async () => {
  const form = await validForm();
  form.set("recurrenceToken", "raw-token");
  assert.throws(() => parseIssueForm(form), IssuePhotoError);
});
