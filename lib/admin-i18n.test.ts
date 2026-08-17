import assert from "node:assert/strict";
import test from "node:test";
import { adminCategoryLabel, adminStatusLabel, adminText, detectAdminLocale } from "./admin-i18n.ts";

test("admin locale follows Chinese browsers and falls back to English", () => {
  assert.equal(detectAdminLocale("zh-TW"), "zh-TW");
  assert.equal(detectAdminLocale("zh-CN"), "zh-TW");
  assert.equal(detectAdminLocale("en-US"), "en");
  assert.equal(detectAdminLocale("ko-KR"), "en");
});

test("admin labels have English and Traditional Chinese variants", () => {
  assert.equal(adminText("en", "Complaint management"), "Complaint management");
  assert.equal(adminText("zh-TW", "Complaint management"), "陳情管理");
  assert.equal(adminStatusLabel("en", "completed"), "Complete");
  assert.equal(adminStatusLabel("zh-TW", "completed"), "已完成");
  assert.equal(adminCategoryLabel("zh-TW", "road_sidewalk"), "路面不平");
});
