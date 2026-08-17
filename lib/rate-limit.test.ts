import assert from "node:assert/strict";
import test from "node:test";
import { takeRateLimit } from "./rate-limit.ts";

test("blocks a key until its fixed window expires", () => {
  const key = crypto.randomUUID();
  assert.equal(takeRateLimit(key, 2, 1_000, 1_000).allowed, true);
  assert.equal(takeRateLimit(key, 2, 1_000, 1_100).allowed, true);
  assert.deepEqual(takeRateLimit(key, 2, 1_000, 1_200), { allowed: false, retryAfterSeconds: 1 });
  assert.equal(takeRateLimit(key, 2, 1_000, 2_000).allowed, true);
});

test("tracks different authenticated callers independently", () => {
  const first = crypto.randomUUID();
  const second = crypto.randomUUID();
  assert.equal(takeRateLimit(first, 1, 1_000, 10_000).allowed, true);
  assert.equal(takeRateLimit(first, 1, 1_000, 10_001).allowed, false);
  assert.equal(takeRateLimit(second, 1, 1_000, 10_001).allowed, true);
});
