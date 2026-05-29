export interface SupportedModelDefinition {
  key: string;
  displayName: string;
  modelId: string;
  description?: string;
  isDefault?: boolean;
}

const curatedModelRegistry = [
  {
    key: "qwen3-235b",
    displayName: "Qwen 3 235B Instruct",
    modelId: "qwen/qwen3-235b-a22b-instruct-2507-fp8",
    description: "Current GonkaGate public Claude Code model.",
    isDefault: false
  },
  {
    key: "kimi-k2.6",
    displayName: "MoonshotAI Kimi K2.6",
    modelId: "moonshotai/Kimi-K2.6",
    description: "GonkaGate public Claude Code model.",
    isDefault: true
  },
  {
    key: "minimax-m2.7",
    displayName: "MiniMax M2.7",
    modelId: "minimaxai/minimax-m2.7",
    description: "GonkaGate public Claude Code model.",
    isDefault: false
  }
] as const satisfies readonly SupportedModelDefinition[];

const defaultModels = curatedModelRegistry.filter((model) => model.isDefault);

if (defaultModels.length !== 1) {
  throw new Error(`Expected exactly one default supported model, found ${defaultModels.length}.`);
}

export const SUPPORTED_MODELS = curatedModelRegistry;
export type SupportedModel = (typeof SUPPORTED_MODELS)[number];
export type SupportedModelKey = SupportedModel["key"];
export const DEFAULT_MODEL = defaultModels[0];
export const DEFAULT_MODEL_KEY: SupportedModelKey = DEFAULT_MODEL.key;
export const SUPPORTED_MODEL_KEYS = SUPPORTED_MODELS.map((model) => model.key);

export function getSupportedModelByKey(key: string): SupportedModel | undefined {
  return SUPPORTED_MODELS.find((model) => model.key === key);
}

export function requireSupportedModel(key: string): SupportedModel {
  const model = getSupportedModelByKey(key);

  if (!model) {
    throw new Error(`Unsupported model key "${key}". Supported model keys: ${SUPPORTED_MODEL_KEYS.join(", ")}`);
  }

  return model;
}
