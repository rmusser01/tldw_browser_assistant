const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google",
  mistral: "Mistral",
  cohere: "Cohere",
  groq: "Groq",
  huggingface: "HuggingFace",
  openrouter: "OpenRouter",
  ollama: "Ollama",
  llama: "Llama.cpp",
  kobold: "Kobold.cpp",
  ooba: "Oobabooga",
  tabby: "TabbyAPI",
  vllm: "vLLM",
  aphrodite: "Aphrodite",
  zai: "Z.AI",
  custom_openai_api: "Custom OpenAI API",
  chrome: "Chrome"
}

export const normalizeProviderKey = (provider?: string): string =>
  String(provider || "unknown").toLowerCase()

export const getProviderDisplayName = (provider?: string): string => {
  const key = normalizeProviderKey(provider)
  if (PROVIDER_DISPLAY_NAMES[key]) return PROVIDER_DISPLAY_NAMES[key]
  return provider || "API"
}
