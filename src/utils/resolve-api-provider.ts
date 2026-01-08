import { tldwModels } from "@/services/tldw"
import { inferProviderFromModel } from "@/utils/provider-registry"

type ResolveApiProviderOptions = {
  modelId?: string | null
  explicitProvider?: string | null
  providerHint?: string | null
}

const normalizeProvider = (value: unknown): string => {
  const trimmed = String(value || "").trim().toLowerCase()
  if (!trimmed || trimmed === "unknown") return ""
  return trimmed
}

export const resolveApiProviderForModel = async ({
  modelId,
  explicitProvider,
  providerHint
}: ResolveApiProviderOptions): Promise<string | undefined> => {
  const explicit = normalizeProvider(explicitProvider)
  let resolved = normalizeProvider(providerHint)

  const normalizedModelId = String(modelId || "")
    .replace(/^tldw:/, "")
    .trim()

  if (!resolved && normalizedModelId) {
    try {
      const modelInfo = await tldwModels.getModel(normalizedModelId)
      resolved = normalizeProvider(modelInfo?.provider)
    } catch {
      // ignore model lookup failures
    }
  }

  if (!resolved && normalizedModelId) {
    const inferred =
      inferProviderFromModel(normalizedModelId, "llm") ||
      inferProviderFromModel(modelId || "", "llm")
    resolved = normalizeProvider(inferred)
  }

  if (explicit && resolved && explicit !== resolved) {
    return resolved
  }

  if (explicit) return explicit
  return resolved || undefined
}
