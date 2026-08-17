export type AiAssistance = {
  summary: string;
  answerDraft: string;
  model: string;
  modelVersion: string;
};

type AiAssistanceConfig = {
  endpoint: string;
  apiKey?: string;
  model: string;
  modelVersion: string;
  timeoutMs: number;
};

export function aiAssistanceConfigFromEnv(): AiAssistanceConfig | null {
  const endpoint = process.env.AI_ASSIST_ENDPOINT?.trim();
  const model = process.env.AI_ASSIST_MODEL?.trim();
  const modelVersion = process.env.AI_ASSIST_MODEL_VERSION?.trim();
  if (!endpoint || !model || !modelVersion) return null;
  const configuredTimeout = Number(process.env.AI_ASSIST_TIMEOUT_MS ?? 5000);
  return {
    endpoint,
    apiKey: process.env.AI_ASSIST_API_KEY?.trim() || undefined,
    model,
    modelVersion,
    timeoutMs: Number.isFinite(configuredTimeout) ? Math.min(15_000, Math.max(500, configuredTimeout)) : 5000,
  };
}

export async function createAiAssistance(
  input: { title: string; body: string; category: string },
  config = aiAssistanceConfigFromEnv(),
  request: typeof fetch = fetch,
): Promise<AiAssistance | null> {
  if (!config) return null;
  try {
    const response = await request(config.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
      },
      body: JSON.stringify({ task: "summarize_and_draft", inputScope: ["title", "body", "category"], ...input }),
      signal: AbortSignal.timeout(config.timeoutMs),
    });
    if (!response.ok) return null;
    const result = await response.json() as { summary?: unknown; answerDraft?: unknown };
    const summary = typeof result.summary === "string" ? result.summary.trim() : "";
    const answerDraft = typeof result.answerDraft === "string" ? result.answerDraft.trim() : "";
    if (!summary || summary.length > 1000 || !answerDraft || answerDraft.length > 4000) return null;
    return { summary, answerDraft, model: config.model, modelVersion: config.modelVersion };
  } catch {
    return null;
  }
}
