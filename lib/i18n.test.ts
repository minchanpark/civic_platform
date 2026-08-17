import assert from "node:assert/strict";
import test from "node:test";
import { LOCALES, MESSAGES } from "./i18n.ts";

test("every supported locale has the complete zh-TW message contract", () => {
  const expected = Object.keys(MESSAGES["zh-TW"]).sort();
  for (const locale of LOCALES) {
    assert.deepEqual(Object.keys(MESSAGES[locale]).sort(), expected);
    assert.ok(Object.values(MESSAGES[locale]).every((message) => message.trim().length > 0));
  }
});

test("citizen administrative progress uses the agreed five-stage labels", () => {
  assert.deepEqual(
    ["received", "viewed", "in_progress", "on_hold", "completed"].map(
      (status) => MESSAGES.en[`status.${status}` as keyof typeof MESSAGES.en],
    ),
    ["Received", "Under staff review", "Field work in progress", "On hold", "Complete"],
  );
});
