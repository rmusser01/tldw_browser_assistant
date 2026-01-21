import type { TFunction } from "i18next"
import { SUPPORTED_LANGUAGES } from "@/utils/supported-languages"
import { getProviderDisplayName } from "@/utils/provider-registry"

export type SelectOption = {
  value: string
  label: string
}

type ModelOption = {
  model?: string
  name?: string
  nickname?: string
  provider?: string
  details?: { provider?: string }
}

const CHUNK_METHOD_OPTIONS = [
  "semantic",
  "tokens",
  "paragraphs",
  "sentences",
  "words",
  "ebook_chapters",
  "json",
  "propositions"
] as const
const CLAIMS_EXTRACTOR_MODE_OPTIONS = [
  "auto",
  "heuristic",
  "ner",
  "aps",
  "llm"
] as const
const CONTEXT_STRATEGY_OPTIONS = [
  "auto",
  "full",
  "window",
  "outline_window"
] as const
const SCRAPE_METHOD_OPTIONS = [
  "Individual URLs",
  "Sitemap",
  "URL Level",
  "Recursive Scraping"
] as const
const CRAWL_STRATEGY_OPTIONS = [
  "best_first",
  "best-first",
  "bestfirst"
] as const

const toTitleCase = (value: string) =>
  value
    .split("_")
    .map((part) =>
      part ? part.charAt(0).toUpperCase() + part.slice(1) : part
    )
    .join(" ")

const toEnumOptions = (values?: unknown[]) => {
  if (!Array.isArray(values) || values.length === 0) return []
  return values
    .map((value) => String(value))
    .filter((value) => value.length > 0)
    .map((value) => ({
      value,
      label: toTitleCase(value)
    }))
}

export const getChunkLanguageOptions = (): SelectOption[] =>
  SUPPORTED_LANGUAGES.reduce<SelectOption[]>((acc, option) => {
    const value = String(option.value)
    if (!value) return acc
    if (acc.some((item) => item.value === value)) return acc
    acc.push({ value, label: option.label })
    return acc
  }, [])

const toSimpleOptions = (values: readonly string[]) =>
  values.map((value) => ({
    value,
    label: toTitleCase(value)
  }))

export const getAdvancedFieldSelectOptions = ({
  fieldName,
  fieldEnum,
  t,
  chatModels,
  embeddingModels
}: {
  fieldName: string
  fieldEnum?: unknown[]
  t: TFunction
  chatModels?: ModelOption[]
  embeddingModels?: ModelOption[]
}): SelectOption[] | null => {
  const enumOptions = toEnumOptions(fieldEnum)

  switch (fieldName) {
    case "chunk_language":
      return getChunkLanguageOptions()
    case "chunk_method":
      return enumOptions.length > 0
        ? enumOptions
        : toSimpleOptions(CHUNK_METHOD_OPTIONS)
    case "claims_extractor_mode":
      return enumOptions.length > 0
        ? enumOptions
        : toSimpleOptions(CLAIMS_EXTRACTOR_MODE_OPTIONS)
    case "context_strategy":
      return enumOptions.length > 0
        ? enumOptions
        : toSimpleOptions(CONTEXT_STRATEGY_OPTIONS)
    case "scrape_method":
      return enumOptions.length > 0
        ? enumOptions
        : toSimpleOptions(SCRAPE_METHOD_OPTIONS)
    case "crawl_strategy":
      return enumOptions.length > 0
        ? enumOptions
        : toSimpleOptions(CRAWL_STRATEGY_OPTIONS)
    case "contextual_llm_model":
    case "embedding_model": {
      const source =
        fieldName === "contextual_llm_model" ? chatModels : embeddingModels
      const seen = new Set<string>()
      const options = (source || [])
        .map((model) => {
          const value = String(model?.model || "").trim()
          if (!value || seen.has(value)) return null
          seen.add(value)
          const providerRaw = model?.details?.provider ?? model?.provider
          const providerLabel = providerRaw
            ? getProviderDisplayName(providerRaw)
            : ""
          const modelLabel =
            model?.nickname || model?.name || model?.model || value
          const label = providerLabel
            ? `${providerLabel} - ${modelLabel}`
            : modelLabel
          return { value, label }
        })
        .filter(Boolean) as SelectOption[]
      if (options.length > 0) return options
      if (enumOptions.length > 0) return enumOptions
      return null
    }
    default:
      return null
  }
}

export const ensureSelectOption = (
  options: SelectOption[],
  value: unknown
) => {
  if (value === undefined || value === null || value === "") return options
  const normalized = String(value)
  const exists = options.some((option) => String(option.value) === normalized)
  if (exists) return options
  return [...options, { value: normalized, label: normalized }]
}
