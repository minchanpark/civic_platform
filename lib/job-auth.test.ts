import assert from "node:assert/strict";
import test from "node:test";
import { validJobAuthorization } from "./job-auth.ts";

test("scheduled jobs require an exact high-entropy bearer secret", () => {
  const secret = "0123456789abcdef0123456789abcdef";
  assert.equal(validJobAuthorization(`Bearer ${secret}`, secret), true);
  assert.equal(validJobAuthorization(`Bearer ${secret}x`, secret), false);
  assert.equal(validJobAuthorization("Bearer short", "short"), false);
  assert.equal(validJobAuthorization(null, secret), false);
});
