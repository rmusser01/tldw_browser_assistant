/**
 * Model pricing data for cost estimation
 * Prices are in USD per 1K tokens
 */

export type ModelPricing = {
  inputPer1K: number
  outputPer1K: number
}

// Pricing data for common models (approximate as of 2024)
const MODEL_PRICING: Record<string, ModelPricing> = {
  // OpenAI
  "gpt-4o": { inputPer1K: 0.0025, outputPer1K: 0.01 },
  "gpt-4o-mini": { inputPer1K: 0.00015, outputPer1K: 0.0006 },
  "gpt-4-turbo": { inputPer1K: 0.01, outputPer1K: 0.03 },
  "gpt-4": { inputPer1K: 0.03, outputPer1K: 0.06 },
  "gpt-3.5-turbo": { inputPer1K: 0.0005, outputPer1K: 0.0015 },
  "o1": { inputPer1K: 0.015, outputPer1K: 0.06 },
  "o1-mini": { inputPer1K: 0.003, outputPer1K: 0.012 },
  "o1-preview": { inputPer1K: 0.015, outputPer1K: 0.06 },

  // Anthropic
  "claude-3-5-sonnet-20241022": { inputPer1K: 0.003, outputPer1K: 0.015 },
  "claude-3-5-sonnet": { inputPer1K: 0.003, outputPer1K: 0.015 },
  "claude-3-5-haiku": { inputPer1K: 0.0008, outputPer1K: 0.004 },
  "claude-3-opus": { inputPer1K: 0.015, outputPer1K: 0.075 },
  "claude-3-sonnet": { inputPer1K: 0.003, outputPer1K: 0.015 },
  "claude-3-haiku": { inputPer1K: 0.00025, outputPer1K: 0.00125 },

  // Google
  "gemini-1.5-pro": { inputPer1K: 0.00125, outputPer1K: 0.005 },
  "gemini-1.5-flash": { inputPer1K: 0.000075, outputPer1K: 0.0003 },
  "gemini-2.0-flash": { inputPer1K: 0.0001, outputPer1K: 0.0004 },
  "gemini-pro": { inputPer1K: 0.0005, outputPer1K: 0.0015 },

  // Mistral
  "mistral-large": { inputPer1K: 0.002, outputPer1K: 0.006 },
  "mistral-medium": { inputPer1K: 0.0027, outputPer1K: 0.0081 },
  "mistral-small": { inputPer1K: 0.0002, outputPer1K: 0.0006 },
  "codestral": { inputPer1K: 0.0003, outputPer1K: 0.0009 },

  // Groq (cloud inference)
  "llama-3.1-70b-versatile": { inputPer1K: 0.00059, outputPer1K: 0.00079 },
  "llama-3.1-8b-instant": { inputPer1K: 0.00005, outputPer1K: 0.00008 },
  "mixtral-8x7b-32768": { inputPer1K: 0.00024, outputPer1K: 0.00024 },

  // Cohere
  "command-r-plus": { inputPer1K: 0.003, outputPer1K: 0.015 },
  "command-r": { inputPer1K: 0.0005, outputPer1K: 0.0015 },

  // DeepSeek
  "deepseek-chat": { inputPer1K: 0.00014, outputPer1K: 0.00028 },
  "deepseek-coder": { inputPer1K: 0.00014, outputPer1K: 0.00028 }
}

// Provider-based fallback pricing for unknown models
const PROVIDER_FALLBACK_PRICING: Record<string, ModelPricing> = {
  openai: { inputPer1K: 0.002, outputPer1K: 0.008 },
  anthropic: { inputPer1K: 0.003, outputPer1K: 0.015 },
  google: { inputPer1K: 0.001, outputPer1K: 0.004 },
  mistral: { inputPer1K: 0.001, outputPer1K: 0.003 },
  groq: { inputPer1K: 0.0003, outputPer1K: 0.0005 },
  cohere: { inputPer1K: 0.001, outputPer1K: 0.005 },
  deepseek: { inputPer1K: 0.00014, outputPer1K: 0.00028 },
  ollama: { inputPer1K: 0, outputPer1K: 0 }, // Local models are free
  local: { inputPer1K: 0, outputPer1K: 0 }
}

/**
 * Get pricing for a specific model
 */
export function getModelPricing(
  modelId: string,
  provider?: string | null
): ModelPricing | null {
  // Check exact model match first
  const normalizedModelId = modelId.toLowerCase()
  for (const [key, pricing] of Object.entries(MODEL_PRICING)) {
    if (normalizedModelId.includes(key.toLowerCase())) {
      return pricing
    }
  }

  // Fall back to provider-based pricing
  if (provider) {
    const normalizedProvider = provider.toLowerCase()
    for (const [key, pricing] of Object.entries(PROVIDER_FALLBACK_PRICING)) {
      if (normalizedProvider.includes(key)) {
        return pricing
      }
    }
  }

  return null
}

/**
 * Estimate cost for a request
 */
export function estimateCost(
  inputTokens: number,
  outputTokens: number,
  pricing: ModelPricing
): number {
  const inputCost = (inputTokens / 1000) * pricing.inputPer1K
  const outputCost = (outputTokens / 1000) * pricing.outputPer1K
  return inputCost + outputCost
}

/**
 * Format cost for display
 */
export function formatCost(cost: number): string {
  if (cost === 0) {
    return "Free (local)"
  }
  if (cost < 0.0001) {
    return "<$0.0001"
  }
  if (cost < 0.01) {
    return `$${cost.toFixed(4)}`
  }
  return `$${cost.toFixed(3)}`
}

/**
 * Get a human-readable price tier for a model
 */
export function getPriceTier(pricing: ModelPricing): "free" | "low" | "medium" | "high" | "premium" {
  const avgPer1K = (pricing.inputPer1K + pricing.outputPer1K) / 2
  if (avgPer1K === 0) return "free"
  if (avgPer1K < 0.001) return "low"
  if (avgPer1K < 0.005) return "medium"
  if (avgPer1K < 0.02) return "high"
  return "premium"
}
