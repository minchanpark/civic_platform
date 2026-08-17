export const AI_RISK_REASON_CODES = [
  "immediate_life_risk",
  "accident_risk",
  "health_risk",
  "spreading_pollution",
  "pedestrian_obstruction",
  "repeated_contamination",
  "service_disruption",
  "cosmetic_only",
] as const;

export const AI_FILTER_REASON_CODES = [
  "possible_personal_data",
  "advertising_irrelevant",
  "repetition",
  "harmful_content",
] as const;

type RiskReasonCode = typeof AI_RISK_REASON_CODES[number];
type FilterReasonCode = typeof AI_FILTER_REASON_CODES[number];

export type RiskAssessment = {
  riskLevel: number;
  riskReasonCodes: RiskReasonCode[];
  filterReasonCodes: FilterReasonCode[];
  inputScope: ["title", "body", "category"];
  model: string;
  modelVersion: string;
};

type RiskInput = { title: string; body: string; category: string };
type RiskConfig = { endpoint: string; apiKey?: string; model: string; modelVersion: string; timeoutMs: number };

const codeArray = <T extends string>(value: unknown, allowed: readonly T[], required: boolean): T[] | null => {
  if (!Array.isArray(value) || (required && value.length === 0)) return null;
  if (!value.every((item): item is T => typeof item === "string" && allowed.includes(item as T))) return null;
  return [...new Set(value)];
};

export function riskConfigFromEnv(): RiskConfig | null {
  const endpoint = process.env.AI_RISK_ENDPOINT?.trim();
  const model = process.env.AI_RISK_MODEL?.trim();
  const modelVersion = process.env.AI_RISK_MODEL_VERSION?.trim();
  if (!endpoint || !model || !modelVersion) return null;
  const configuredTimeout = Number(process.env.AI_RISK_TIMEOUT_MS ?? 2000);
  return {
    endpoint,
    apiKey: process.env.AI_RISK_API_KEY?.trim() || undefined,
    model,
    modelVersion,
    timeoutMs: Number.isFinite(configuredTimeout) ? Math.min(5000, Math.max(250, configuredTimeout)) : 2000,
  };
}

export async function assessIssueRisk(
  input: RiskInput,
  config = riskConfigFromEnv(),
  request: typeof fetch = fetch,
): Promise<RiskAssessment | null> {
  if (!config) return null;
  try {
    const response = await request(config.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
      },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(config.timeoutMs),
    });
    if (!response.ok) return null;
    const result = await response.json() as { riskLevel?: unknown; riskReasonCodes?: unknown; filterReasonCodes?: unknown };
    const riskReasonCodes = codeArray(result.riskReasonCodes, AI_RISK_REASON_CODES, true);
    const filterReasonCodes = codeArray(result.filterReasonCodes, AI_FILTER_REASON_CODES, false);
    if (!Number.isInteger(result.riskLevel) || Number(result.riskLevel) < 1 || Number(result.riskLevel) > 5
      || !riskReasonCodes || !filterReasonCodes) return null;
    return {
      riskLevel: Number(result.riskLevel),
      riskReasonCodes,
      filterReasonCodes,
      inputScope: ["title", "body", "category"],
      model: config.model,
      modelVersion: config.modelVersion,
    };
  } catch {
    return null;
  }
}
