export type ProviderIconKey =
  | "tldw"
  | "chrome"
  | "custom"
  | "fireworks"
  | "groq"
  | "lmstudio"
  | "openai"
  | "together"
  | "openrouter"
  | "llamafile"
  | "gemini"
  | "mistral"
  | "deepseek"
  | "siliconflow"
  | "volcengine"
  | "tencentcloud"
  | "alibabacloud"
  | "llamacpp"
  | "infinitenceai"
  | "novita"
  | "vllm"
  | "moonshot"
  | "xai"
  | "huggingface"
  | "vercel"
  | "chutes"
  | "ollama"
  | "default"

export type ProviderMeta = {
  label: string
  baseUrl?: string
  iconKey?: ProviderIconKey
  order?: number
}

export const PROVIDER_REGISTRY: Record<string, ProviderMeta> = {
  custom: {
    label: "Custom",
    baseUrl: "",
    iconKey: "custom",
    order: 1
  },
  llamacpp: {
    label: "LLaMa.cpp",
    baseUrl: "http://localhost:8080/v1",
    iconKey: "llamacpp",
    order: 2
  },
  lmstudio: {
    label: "LM Studio",
    baseUrl: "http://localhost:1234/v1",
    iconKey: "lmstudio",
    order: 3
  },
  llamafile: {
    label: "Llamafile",
    baseUrl: "http://127.0.0.1:8080/v1",
    iconKey: "llamafile",
    order: 4
  },
  openai: {
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    iconKey: "openai",
    order: 5
  },
  deepseek: {
    label: "DeepSeek",
    baseUrl: "https://api.deepseek.com",
    iconKey: "deepseek",
    order: 6
  },
  fireworks: {
    label: "Fireworks",
    baseUrl: "https://api.fireworks.ai/inference/v1",
    iconKey: "fireworks",
    order: 7
  },
  novita: {
    label: "Novita AI",
    baseUrl: "https://api.novita.ai/v3/openai",
    iconKey: "novita",
    order: 8
  },
  huggingface: {
    label: "Hugging Face",
    baseUrl: "https://router.huggingface.co/v1",
    iconKey: "huggingface",
    order: 9
  },
  groq: {
    label: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    iconKey: "groq",
    order: 10
  },
  together: {
    label: "Together",
    baseUrl: "https://api.together.xyz/v1",
    iconKey: "together",
    order: 11
  },
  openrouter: {
    label: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    iconKey: "openrouter",
    order: 12
  },
  gemini: {
    label: "Google AI",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    iconKey: "gemini",
    order: 13
  },
  mistral: {
    label: "Mistral",
    baseUrl: "https://api.mistral.ai/v1",
    iconKey: "mistral",
    order: 14
  },
  infinitenceai: {
    label: "Infinigence AI",
    baseUrl: "https://cloud.infini-ai.com/maas/v1",
    iconKey: "infinitenceai",
    order: 15
  },
  infinigenceai: {
    label: "Infinigence AI",
    iconKey: "infinitenceai"
  },
  siliconflow: {
    label: "SiliconFlow",
    baseUrl: "https://api.siliconflow.cn/v1",
    iconKey: "siliconflow",
    order: 16
  },
  volcengine: {
    label: "VolcEngine",
    baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    iconKey: "volcengine",
    order: 17
  },
  tencentcloud: {
    label: "TencentCloud",
    baseUrl: "https://api.lkeap.cloud.tencent.com/v1",
    iconKey: "tencentcloud",
    order: 18
  },
  alibabacloud: {
    label: "AliBaBaCloud",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    iconKey: "alibabacloud",
    order: 19
  },
  vllm: {
    label: "vLLM",
    baseUrl: "http://localhost:8000/v1",
    iconKey: "vllm",
    order: 20
  },
  moonshot: {
    label: "Moonshot",
    baseUrl: "https://api.moonshot.ai/v1",
    iconKey: "moonshot",
    order: 21
  },
  xai: {
    label: "xAI",
    baseUrl: "https://api.x.ai/v1",
    iconKey: "xai",
    order: 22
  },
  vercel: {
    label: "Vercel AI Gateway",
    baseUrl: "https://ai-gateway.vercel.sh/v1",
    iconKey: "vercel",
    order: 23
  },
  chutes: {
    label: "Chutes",
    baseUrl: "https://llm.chutes.ai/v1",
    iconKey: "chutes",
    order: 24
  },
  tldw: {
    label: "tldw",
    iconKey: "tldw"
  },
  chrome: {
    label: "Chrome",
    iconKey: "chrome"
  },
  anthropic: {
    label: "Anthropic"
  },
  google: {
    label: "Google"
  },
  meta: {
    label: "Meta"
  },
  cohere: {
    label: "Cohere"
  },
  ollama: {
    label: "Ollama",
    iconKey: "ollama"
  },
  llama: {
    label: "LLaMa.cpp",
    iconKey: "llamacpp"
  },
  kobold: {
    label: "Kobold.cpp"
  },
  ooba: {
    label: "Oobabooga"
  },
  tabby: {
    label: "TabbyAPI"
  },
  aphrodite: {
    label: "Aphrodite"
  },
  zai: {
    label: "Z.AI"
  },
  custom_openai_api: {
    label: "Custom OpenAI API"
  },
  unknown: {
    label: "Unknown"
  }
}

export const normalizeProviderKey = (provider?: string): string =>
  String(provider || "unknown").toLowerCase()

export const getProviderMeta = (provider?: string): ProviderMeta | null => {
  const key = normalizeProviderKey(provider)
  return PROVIDER_REGISTRY[key] ?? null
}

export const getProviderDisplayName = (provider?: string): string => {
  return getProviderMeta(provider)?.label || provider || "API"
}

export const getProviderIconKey = (provider?: string): ProviderIconKey => {
  const meta = getProviderMeta(provider)
  return meta?.iconKey ?? "default"
}
