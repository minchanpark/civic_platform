import assert from "node:assert/strict";
import test from "node:test";
import { snapshotFromRow, summarizeSnapshots, type PublicSnapshot } from "./player.ts";

test("public snapshot mapping exposes aggregate fields only", () => {
  const snapshot = snapshotFromRow({
    district_id: "taoyuan",
    period_start: "2026-05-01",
    period_end: "2026-07-30",
    ticket_count: 12,
    completed_count: 6,
    administrative_completion_rate: 50,
    field_spot_count: 10,
    resolved_spot_count: 4,
    field_resolution_rate: 40,
    category_counts: { road_sidewalk: 12 },
    hotspots: [],
    generated_at: "2026-07-31T00:00:00Z",
  });
  assert.deepEqual(Object.keys(snapshot).sort(), [
    "administrativeCompletionRate", "categoryCounts", "completedCount", "districtId",
    "fieldResolutionRate", "fieldSpotCount", "generatedAt", "hotspots", "periodEnd",
    "periodStart", "resolvedSpotCount", "ticketCount",
  ]);
});

test("city summary recomputes rates from all district database snapshots", () => {
  const snapshot = (districtId: PublicSnapshot["districtId"], ticketCount: number, completedCount: number, fieldSpotCount: number, resolvedSpotCount: number): PublicSnapshot => ({
    districtId, periodStart: "2026-05-18", periodEnd: "2026-08-16", ticketCount, completedCount,
    administrativeCompletionRate: null, fieldSpotCount, resolvedSpotCount, fieldResolutionRate: null,
    categoryCounts: { road_sidewalk: ticketCount }, hotspots: [], generatedAt: "2026-08-16T11:00:00Z",
  });
  assert.deepEqual(summarizeSnapshots([
    snapshot("taoyuan", 8, 4, 7, 2),
    snapshot("zhongli", 4, 2, 3, 3),
  ]), {
    periodStart: "2026-05-18", periodEnd: "2026-08-16", ticketCount: 12, completedCount: 6,
    administrativeCompletionRate: 50, fieldSpotCount: 10, resolvedSpotCount: 5,
    fieldResolutionRate: 50, categoryCounts: { road_sidewalk: 12 }, generatedAt: "2026-08-16T11:00:00Z",
  });
});
