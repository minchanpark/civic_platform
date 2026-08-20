export type SubmittedIssue = {
  id: string;
  ticketNumber: string;
  status: string;
  createdAt: string;
};

type SubmitResult = { issue?: unknown };
type FetchRequest = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export class IssueSubmissionRequestError extends Error {}

function submittedIssue(value: unknown): SubmittedIssue | null {
  if (!value || typeof value !== "object") return null;
  const issue = value as Record<string, unknown>;
  return typeof issue.id === "string"
    && typeof issue.ticketNumber === "string"
    && typeof issue.status === "string"
    && typeof issue.createdAt === "string"
    ? issue as SubmittedIssue
    : null;
}

async function parseSubmitResult(response: Response) {
  try {
    const text = await response.text();
    return text ? JSON.parse(text) as SubmitResult : null;
  } catch {
    return null;
  }
}

export async function submitIssueForm(
  form: FormData,
  accessToken: string,
  request: FetchRequest = fetch,
) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await request("/api/issues", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: form,
      });
      const result = await parseSubmitResult(response);
      const issue = submittedIssue(result?.issue);
      if (response.ok && issue) return issue;

      const ambiguousFailure = response.ok || response.status >= 500;
      if (!ambiguousFailure || attempt === 1) throw new IssueSubmissionRequestError();
    } catch (error) {
      if (error instanceof IssueSubmissionRequestError || attempt === 1) {
        throw new IssueSubmissionRequestError();
      }
    }
  }
  throw new IssueSubmissionRequestError();
}
