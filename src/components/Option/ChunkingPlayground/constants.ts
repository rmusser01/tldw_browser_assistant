type TranslationFn = (key: string, defaultValue: string) => string

const LANGUAGE_OPTIONS = [
  {
    value: "auto",
    labelKey: "settings:chunkingPlayground.languages.auto",
    defaultLabel: "Auto-detect"
  },
  {
    value: "en",
    labelKey: "settings:chunkingPlayground.languages.en",
    defaultLabel: "English"
  },
  {
    value: "es",
    labelKey: "settings:chunkingPlayground.languages.es",
    defaultLabel: "Spanish"
  },
  {
    value: "fr",
    labelKey: "settings:chunkingPlayground.languages.fr",
    defaultLabel: "French"
  },
  {
    value: "de",
    labelKey: "settings:chunkingPlayground.languages.de",
    defaultLabel: "German"
  },
  {
    value: "it",
    labelKey: "settings:chunkingPlayground.languages.it",
    defaultLabel: "Italian"
  },
  {
    value: "pt",
    labelKey: "settings:chunkingPlayground.languages.pt",
    defaultLabel: "Portuguese"
  },
  {
    value: "zh",
    labelKey: "settings:chunkingPlayground.languages.zh",
    defaultLabel: "Chinese"
  },
  {
    value: "ja",
    labelKey: "settings:chunkingPlayground.languages.ja",
    defaultLabel: "Japanese"
  },
  {
    value: "ko",
    labelKey: "settings:chunkingPlayground.languages.ko",
    defaultLabel: "Korean"
  }
] as const

export const getLanguageOptions = (t: TranslationFn) =>
  LANGUAGE_OPTIONS.map((option) => ({
    value: option.value,
    label: t(option.labelKey, option.defaultLabel)
  }))
