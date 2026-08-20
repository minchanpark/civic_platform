import assert from "node:assert/strict";
import test from "node:test";
import { IssueSubmissionRequestError, submitIssueForm } from "./issue-submit-client.ts";

const issue = {
  id: "123e4567-e89b-42d3-a456-426614174000",
  ticketNumber: "CP-20260819-000001",
  status: "received",
  createdAt: "2026-08-19T02:01:00Z",
};

test("retries one ambiguous non-JSON response with the same form", async () => {
  const form = new FormData();
  form.set("submissionKey", "123e4567-e89b-42d3-a456-426614174000");
  const bodies: BodyInit[] = [];
  const result = await submitIssueForm(form, "access-token", async (_input, init) => {
    bodies.push(init?.body as BodyInit);
    return bodies.length === 1
      ? new Response("gateway timeout", { status: 504, headers: { "Content-Type": "text/plain" } })
      : Response.json({ issue }, { status: 200 });
  });

  assert.deepEqual(result, issue);
  assert.equal(bodies.length, 2);
  assert.equal(bodies[0], form);
  assert.equal(bodies[1], form);
});

test("retries a network interruption without leaking its browser message", async () => {
  let attempts = 0;
  const result = await submitIssueForm(new FormData(), "access-token", async () => {
    attempts += 1;
    if (attempts === 1) throw new SyntaxError("The string did not match the expected pattern.");
    return Response.json({ issue }, { status: 201 });
  });

  assert.deepEqual(result, issue);
  assert.equal(attempts, 2);
});

test("does not retry a definitive client error", async () => {
  let attempts = 0;
  await assert.rejects(
    submitIssueForm(new FormData(), "access-token", async () => {
      attempts += 1;
      return Response.json({ error: "invalid input" }, { status: 400 });
    }),
    IssueSubmissionRequestError,
  );
  assert.equal(attempts, 1);
});
