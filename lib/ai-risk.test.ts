import assert from "node:assert/strict";
import test from "node:test";
import { assessIssueRisk } from "./ai-risk.ts";

const config = {
  endpoint: "https://ai.example.test/risk",
  apiKey: "test-secret",
  model: "civic-risk",
  modelVersion: "2026-08",
  timeoutMs: 500,
};

test("AI risk accepts only the bounded provider contract and sends no reporter metadata", async () => {
  let sentBody = "";
  const result = await assessIssueRisk(
    { title: "Blocked sidewalk", body: "A fallen sign blocks pedestrians.", category: "road_sidewalk" },
    config,
    async (_input, init) => {
      sentBody = String(init?.body);
      return Response.json({
        riskLevel: 4,
        riskReasonCodes: ["accident_risk", "pedestrian_obstruction", "accident_risk"],
        filterReasonCodes: [],
        confidence: 0.99,
      });
    },
  );

  assert.deepEqual(result, {
    riskLevel: 4,
    riskReasonCodes: ["accident_risk", "pedestrian_obstruction"],
    filterReasonCodes: [],
    inputScope: ["title", "body", "category"],
    model: "civic-risk",
    modelVersion: "2026-08",
  });
  assert.deepEqual(Object.keys(JSON.parse(sentBody)).sort(), ["body", "category", "title"]);
});

test("AI risk fails closed to evaluation-required on invalid or unavailable output", async () => {
  const invalid = await assessIssueRisk(
    { title: "Issue", body: "Something happened", category: "park_facility" },
    config,
    async () => Response.json({ riskLevel: 5, riskReasonCodes: ["invented_reason"], filterReasonCodes: [] }),
  );
  const unavailable = await assessIssueRisk(
    { title: "Issue", body: "Something happened", category: "park_facility" },
    config,
    async () => { throw new Error("provider unavailable"); },
  );
  assert.equal(invalid, null);
  assert.equal(unavailable, null);
});

test("AI risk does not run without an explicitly configured provider", async () => {
  let called = false;
  const result = await assessIssueRisk(
    { title: "Issue", body: "Something happened", category: "park_facility" },
    null,
    async () => { called = true; return Response.json({}); },
  );
  assert.equal(result, null);
  assert.equal(called, false);
});
