import { GONKAGATE_BASE_URL } from "../constants/gateway.js";

export interface GonkaGateModel {
  id: string;
  name: string;
  isDefault?: boolean;
}

interface ModelsResponse {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}

type ModelsFetch = (input: string, init: RequestInit) => Promise<ModelsResponse>;

export async function fetchGonkaGateModels(
  apiKey: string,
  fetchImpl: ModelsFetch = fetch
): Promise<GonkaGateModel[]> {
  let response: ModelsResponse;

  try {
    response = await fetchImpl(new URL("/v1/models", GONKAGATE_BASE_URL).href, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${apiKey}`
      }
    });
  } catch {
    throw new Error("Failed to fetch GonkaGate models from https://api.gonkagate.com/v1/models.");
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch GonkaGate models from https://api.gonkagate.com/v1/models (HTTP ${response.status}).`);
  }

  let body: unknown;

  try {
    body = await response.json();
  } catch {
    throw new Error("Failed to parse GonkaGate models response as JSON.");
  }

  return parseGonkaGateModelsResponse(body);
}

export function parseGonkaGateModelsResponse(body: unknown): GonkaGateModel[] {
  if (!isRecord(body) || !Array.isArray(body.data)) {
    throw new Error("Invalid GonkaGate models response: expected a data array.");
  }

  const defaultId = getDefaultId(body);
  const seen = new Set<string>();
  const models: GonkaGateModel[] = [];

  for (const rawModel of body.data) {
    if (!isRecord(rawModel)) {
      throw new Error("Invalid GonkaGate models response: each model must be an object.");
    }

    if (typeof rawModel.id !== "string" || rawModel.id.trim().length === 0) {
      throw new Error("Invalid GonkaGate models response: each model must include a non-empty string id.");
    }

    if (rawModel.name !== undefined && typeof rawModel.name !== "string") {
      throw new Error("Invalid GonkaGate models response: model name must be a string when present.");
    }

    const id = rawModel.id.trim();
    if (seen.has(id)) {
      continue;
    }

    seen.add(id);
    models.push({
      id,
      name: typeof rawModel.name === "string" && rawModel.name.trim().length > 0 ? rawModel.name.trim() : id,
      isDefault: rawModel.is_default === true || rawModel.isDefault === true || rawModel.default === true || defaultId === id || undefined
    });
  }

  if (models.length === 0) {
    throw new Error("GonkaGate models response did not include any model ids.");
  }

  return models;
}

export function getDefaultModel(models: readonly GonkaGateModel[]): GonkaGateModel {
  const defaultModel = models.find((model) => model.isDefault) ?? models[0];

  if (!defaultModel) {
    throw new Error("No GonkaGate models are available.");
  }

  return defaultModel;
}

export function requireModelById(models: readonly GonkaGateModel[], id: string): GonkaGateModel {
  const model = models.find((candidate) => candidate.id === id);

  if (!model) {
    const requestedId = id.startsWith("gp-") ? "[redacted gp-... value]" : `"${id}"`;
    throw new Error(`Unsupported model id ${requestedId}. Choose one returned by /v1/models: ${models.map((candidate) => candidate.id).join(", ")}`);
  }

  return model;
}

function getDefaultId(body: Record<string, unknown>): string | undefined {
  const defaultValue = body.default_model ?? body.defaultModel ?? body.default;
  return typeof defaultValue === "string" && defaultValue.trim().length > 0 ? defaultValue.trim() : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
