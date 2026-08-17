import assert from "node:assert/strict";
import test from "node:test";
import { createAiAssistance } from "./ai-assistance.ts";

const config = { endpoint: "https://ai.invalid/assist", model: "assist", modelVersion: "v1", timeoutMs: 1000 };

test("AI assistance sends only the bounded issue text scope and validates its result", async () => {
  let sent: Record<string, unknown> = {};
  const result = await createAiAssistance(
    { title: "Blocked path", body: "Debris blocks the path", category: "road_sidewalk" },
    config,
    async (_input, init) => {
      sent = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ summary: "Path is obstructed.", answerDraft: "We are reviewing the obstruction." }));
    },
  );
  assert.deepEqual(sent, {
    task: "summarize_and_draft", inputScope: ["title", "body", "category"],
    title: "Blocked path", body: "Debris blocks the path", category: "road_sidewalk",
  });
  assert.deepEqual(result, {
    summary: "Path is obstructed.", answerDraft: "We are reviewing the obstruction.", model: "assist", modelVersion: "v1",
  });
});

test("AI assistance rejects incomplete or oversized provider output", async () => {
  const incomplete = await createAiAssistance(
    { title: "x", body: "y", category: "road_sidewalk" }, config,
    async () => new Response(JSON.stringify({ summary: "only" })),
  );
  const oversized = await createAiAssistance(
    { title: "x", body: "y", category: "road_sidewalk" }, config,
    async () => new Response(JSON.stringify({ summary: "x".repeat(1001), answerDraft: "draft" })),
  );
  assert.equal(incomplete, null);
  assert.equal(oversized, null);
});
