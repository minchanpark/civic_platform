import assert from "node:assert/strict";
import test from "node:test";
import { IssueInputError, REPORT_CATEGORIES, normalizeCellPhone, validateIssueSubmission } from "./issues.ts";

const valid = {
  submissionKey: "123e4567-e89b-42d3-a456-426614174000",
  category: "road_sidewalk",
  districtId: "taoyuan",
  latitude: 24.9937,
  longitude: 121.301,
  title: "도로 포트홀 신고",
  body: "차량 통행 중 위험한 포트홀이 발견되었습니다.",
};

test("normalizes a valid issue submission", () => {
  assert.equal(validateIssueSubmission({ ...valid, title: `  ${valid.title}  ` }).title, valid.title);
});

test("normalizes Taiwan mobile numbers to E.164", () => {
  assert.equal(normalizeCellPhone("0912-345-678"), "+886912345678");
  assert.equal(normalizeCellPhone("886 912 345 678"), "+886912345678");
  assert.equal(normalizeCellPhone("+84912345678"), "+84912345678");
  assert.equal(normalizeCellPhone("912345678"), null);
});

test("accepts every citizen report category", () => {
  for (const category of REPORT_CATEGORIES) {
    assert.equal(validateIssueSubmission({ ...valid, category: category.id }).category, category.id);
  }
});

test("rejects coordinates outside the configured map", () => {
  assert.throws(() => validateIssueSubmission({ ...valid, latitude: 23 }), IssueInputError);
});

test("rejects short content", () => {
  assert.throws(() => validateIssueSubmission({ ...valid, body: "짧음" }), IssueInputError);
});

test("accepts every Taoyuan district and rejects unknown districts", () => {
  assert.equal(validateIssueSubmission({ ...valid, districtId: "fuxing" }).districtId, "fuxing");
  assert.throws(() => validateIssueSubmission({ ...valid, districtId: "taipei" }), IssueInputError);
});
