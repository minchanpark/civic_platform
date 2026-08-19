import assert from "node:assert/strict";
import test from "node:test";
import { districtAtPosition, isInsideDistrict } from "./district-boundaries.ts";
import { DISTRICTS } from "./issues.ts";

test("resolves coordinates to their official Taoyuan district", () => {
  for (const district of DISTRICTS) {
    assert.equal(
      districtAtPosition(district.latitude, district.longitude),
      district.id,
      `${district.label} center should resolve to ${district.id}`,
    );
  }
});

test("does not resolve a coordinate against the wrong district", () => {
  assert.equal(isInsideDistrict("fuxing", 24.9937, 121.301), false);
  assert.equal(districtAtPosition(24.9937, 121.301), "taoyuan");
});
