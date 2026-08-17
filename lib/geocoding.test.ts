import assert from "node:assert/strict";
import test from "node:test";
import { reverseGeocode } from "./geocoding.ts";

test("reverse geocoding returns a bounded address and rejects coordinates outside Taoyuan", async () => {
  const original = process.env.NOMINATIM_URL;
  process.env.NOMINATIM_URL = `data:application/json,${encodeURIComponent(JSON.stringify({ display_name: "桃園市桃園區測試路1號" }))}`;
  try {
    assert.equal(await reverseGeocode(24.9937, 121.301), "桃園市桃園區測試路1號");
    assert.equal(await reverseGeocode(23, 121.301), null);
  } finally {
    if (original === undefined) delete process.env.NOMINATIM_URL;
    else process.env.NOMINATIM_URL = original;
  }
});
