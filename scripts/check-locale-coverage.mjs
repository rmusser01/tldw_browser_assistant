// Simple i18n coverage check for common keys across all locales.
// Run with: npm run check:i18n:coverage

import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

const ASSET_LOCALES_DIR = "src/assets/locale"
const CHROME_LOCALES_DIR = "src/public/_locales"

// Map asset locale folders to Chrome _locales codes
const LOCALE_MAPPING = {
  ar: "ar",
  da: "da",
  de: "de",
  en: "en",
  es: "es",
  fa: "fa",
  fr: "fr",
  it: "it",
  "ja-JP": "ja",
  ko: "ko",
  ml: "ml",
  no: "no",
  "pt-BR": "pt-BR",
  ru: "ru",
  sv: "sv",
  uk: "uk",
  zh: "zh",
  "zh-TW": "zh_TW"
}

// Common top-level keys in common.json that should exist for all locales
const REQUIRED_COMMON_KEYS = [
  "noToolCalls",
  "arguments",
  "invalidJson",
  "result",
  "fileChanges",
  "deletions",
  "gitOperations",
  "commands",
  "otherOperations",
  "ttsShort",
  "copyShort",
  "branchShort",
  "infoShort",
  "regenShort",
  "continueShort"
]

// Nested commandPalette keys that should be present everywhere
const REQUIRED_COMMAND_PALETTE_KEYS = [
  "goToChat",
  "goToMedia",
  "goToNotes",
  "goToFlashcards",
  "goToSettings",
  "goToHealth",
  "newChat",
  "toggleKnowledgeSearch",
  "toggleKnowledgeSearchDesc",
  "toggleWebSearch",
  "toggleWebDesc",
  "ingestPage",
  "ingestDesc",
  "switchModel",
  "toggleSidebar",
  "toggleSidebarDesc",
  "placeholder",
  "noResults",
  "title",
  "navigate",
  "select",
  "toOpen",
  "categoryActions",
  "categoryNavigation",
  "categorySettings",
  "categoryRecent"
]

// Nested markdown keys that should be present everywhere
const REQUIRED_MARKDOWN_KEYS = [
  "unableToRender",
  "couldNotDisplay",
  "showRawContent"
]

// Nested modelSelect keys (currently required for en only)
const REQUIRED_MODEL_SELECT_KEYS = ["label", "tooltip"]

// Tool keys used in Agent tool UI
const REQUIRED_TOOL_KEYS = [
  "fs_list",
  "fs_read",
  "fs_write",
  "fs_apply_patch",
  "fs_mkdir",
  "fs_delete",
  "search_grep",
  "search_glob",
  "git_status",
  "git_diff",
  "git_log",
  "git_branch",
  "git_add",
  "git_commit",
  "exec_run"
]

// Nested error keys that should exist in common.json
const REQUIRED_ERROR_KEYS = [
  "label",
  "friendlyApiKeySummary",
  "friendlyApiKeyHint",
  "friendlyTimeoutSummary",
  "friendlyTimeoutHint",
  "friendlyGenericSummary",
  "friendlyGenericHint",
  "showDetails",
  "hideDetails"
]

// Feature hint sections/fields to validate when present
const FEATURE_HINT_SECTIONS = [
  "knowledge",
  "moreTools",
  "commandPalette",
  "modelSettings"
]

const FEATURE_HINT_FIELDS = ["title", "description"]

// chatSidebar keys to validate when present
const CHAT_SIDEBAR_KEYS = [
  "title",
  "newChat",
  "collapse",
  "expand",
  "search",
  "ingest",
  "media",
  "notes",
  "settings",
  "loadError",
  "localTab",
  "serverTab",
  "foldersTab",
  "noServerChats",
  "foldersRequireConnection"
]

const CHAT_SIDEBAR_TABS_KEYS = ["local", "server", "folders"]

function loadJson(path) {
  return JSON.parse(readFileSync(path, "utf8"))
}

function main() {
  const localeDirs = readdirSync(ASSET_LOCALES_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)

  const errors = []

  for (const locale of localeDirs) {
    const commonPath = join(ASSET_LOCALES_DIR, locale, "common.json")

    let common
    try {
      common = loadJson(commonPath)
    } catch (err) {
      errors.push(`✗ ${locale}: failed to read ${commonPath}: ${err.message}`)
      continue
    }

    // Check required top-level keys
    for (const key of REQUIRED_COMMON_KEYS) {
      if (!(key in common)) {
        errors.push(`✗ ${locale}: missing common key "${key}" in ${commonPath}`)
      }
    }

    // Check commandPalette nested keys
    const palette = common.commandPalette
    if (!palette || typeof palette !== "object") {
      errors.push(`✗ ${locale}: missing "commandPalette" object in ${commonPath}`)
    } else {
      for (const key of REQUIRED_COMMAND_PALETTE_KEYS) {
        if (!(key in palette)) {
          errors.push(
            `✗ ${locale}: missing commandPalette key "${key}" in ${commonPath}`
          )
        }
      }
    }

    // Check markdown nested keys
    const markdown = common.markdown
    if (!markdown || typeof markdown !== "object") {
      errors.push(`✗ ${locale}: missing "markdown" object in ${commonPath}`)
    } else {
      for (const key of REQUIRED_MARKDOWN_KEYS) {
        if (!(key in markdown)) {
          errors.push(
            `✗ ${locale}: missing markdown key "${key}" in ${commonPath}`
          )
        }
      }
    }

    // Check error nested keys
    const error = common.error
    if (!error || typeof error !== "object") {
      errors.push(`✗ ${locale}: missing "error" object in ${commonPath}`)
    } else {
      for (const key of REQUIRED_ERROR_KEYS) {
        if (!(key in error)) {
          errors.push(`✗ ${locale}: missing error key "${key}" in ${commonPath}`)
        }
      }

      // Newer error.createFolder helper currently guaranteed only for en
      if (locale === "en" && !("createFolder" in error)) {
        errors.push(
          `✗ ${locale}: missing error key "createFolder" in ${commonPath}`
        )
      }
    }

    // Model select (currently required for en locale)
    if (locale === "en") {
      const modelSelect = common.modelSelect
      if (!modelSelect || typeof modelSelect !== "object") {
        errors.push(`✗ ${locale}: missing "modelSelect" object in ${commonPath}`)
      } else {
        for (const key of REQUIRED_MODEL_SELECT_KEYS) {
          if (!(key in modelSelect)) {
            errors.push(
              `✗ ${locale}: missing modelSelect key "${key}" in ${commonPath}`
            )
          }
        }
      }
    }

    // Feature hints (validate where defined; currently en)
    const featureHints = common.featureHints
    if (featureHints && typeof featureHints === "object") {
      for (const section of FEATURE_HINT_SECTIONS) {
        const obj = featureHints[section]
        if (!obj || typeof obj !== "object") {
          errors.push(
            `✗ ${locale}: missing featureHints.${section} in ${commonPath}`
          )
          continue
        }
        for (const field of FEATURE_HINT_FIELDS) {
          if (!(field in obj)) {
            errors.push(
              `✗ ${locale}: missing featureHints.${section}.${field} in ${commonPath}`
            )
          }
        }
      }
    }

    // chatSidebar (validate where defined; currently en)
    const chatSidebar = common.chatSidebar
    if (chatSidebar && typeof chatSidebar === "object") {
      for (const key of CHAT_SIDEBAR_KEYS) {
        if (!(key in chatSidebar)) {
          errors.push(
            `✗ ${locale}: missing chatSidebar.${key} in ${commonPath}`
          )
        }
      }

      const tabs = chatSidebar.tabs
      if (!tabs || typeof tabs !== "object") {
        errors.push(
          `✗ ${locale}: missing chatSidebar.tabs object in ${commonPath}`
        )
      } else {
        for (const key of CHAT_SIDEBAR_TABS_KEYS) {
          if (!(key in tabs)) {
            errors.push(
              `✗ ${locale}: missing chatSidebar.tabs.${key} in ${commonPath}`
            )
          }
        }
      }
    }

    // -----------------------------------------------------------------------
    // Chrome _locales coverage for this locale (where mapping exists)
    // -----------------------------------------------------------------------
    const chromeLocale = LOCALE_MAPPING[locale]
    if (!chromeLocale) {
      continue
    }

    const messagesPath = join(
      CHROME_LOCALES_DIR,
      chromeLocale,
      "messages.json"
    )

    let messages
    try {
      messages = loadJson(messagesPath)
    } catch (err) {
      errors.push(
        `✗ ${locale}: failed to read Chrome messages at ${messagesPath}: ${err.message}`
      )
      continue
    }

    // Tools_* flattened keys
    for (const toolKey of REQUIRED_TOOL_KEYS) {
      const chromeKey = `tools_${toolKey}`
      if (!messages[chromeKey] || typeof messages[chromeKey].message !== "string") {
        errors.push(
          `✗ ${locale}: missing or invalid Chrome key "${chromeKey}" in ${messagesPath}`
        )
      }
    }

    // commandPalette_* flattened keys
    for (const k of REQUIRED_COMMAND_PALETTE_KEYS) {
      const chromeKey = `commandPalette_${k}`
      if (!messages[chromeKey] || typeof messages[chromeKey].message !== "string") {
        errors.push(
          `✗ ${locale}: missing or invalid Chrome key "${chromeKey}" in ${messagesPath}`
        )
      }
    }

    // markdown_* flattened keys
    for (const k of REQUIRED_MARKDOWN_KEYS) {
      const chromeKey = `markdown_${k}`
      if (!messages[chromeKey] || typeof messages[chromeKey].message !== "string") {
        errors.push(
          `✗ ${locale}: missing or invalid Chrome key "${chromeKey}" in ${messagesPath}`
        )
      }
    }

    // error_label flattened key for Chrome _locales
    if (
      !messages.error_label ||
      typeof messages.error_label.message !== "string"
    ) {
      errors.push(
        `✗ ${locale}: missing or invalid Chrome key "error_label" in ${messagesPath}`
      )
    }

    // Model select flattened keys (en locale)
    if (locale === "en") {
      for (const key of REQUIRED_MODEL_SELECT_KEYS) {
        const chromeKey = `modelSelect_${key}`
        if (
          !messages[chromeKey] ||
          typeof messages[chromeKey].message !== "string"
        ) {
          errors.push(
            `✗ ${locale}: missing or invalid Chrome key "${chromeKey}" in ${messagesPath}`
          )
        }
      }
    }

    // Feature hints flattened keys (validate where featureHints is defined)
    if (featureHints && typeof featureHints === "object") {
      for (const section of FEATURE_HINT_SECTIONS) {
        for (const field of FEATURE_HINT_FIELDS) {
          const chromeKey = `featureHints_${section}_${field}`
          if (
            !messages[chromeKey] ||
            typeof messages[chromeKey].message !== "string"
          ) {
            errors.push(
              `✗ ${locale}: missing or invalid Chrome key "${chromeKey}" in ${messagesPath}`
            )
          }
        }
      }
    }

    // chatSidebar flattened keys (validate where chatSidebar is defined)
    if (chatSidebar && typeof chatSidebar === "object") {
      const chromeChatKeys = [
        ...CHAT_SIDEBAR_KEYS,
        ...CHAT_SIDEBAR_TABS_KEYS.map((k) => `tabs_${k}`)
      ]
      for (const key of chromeChatKeys) {
        const chromeKey = `chatSidebar_${key}`
        if (
          !messages[chromeKey] ||
          typeof messages[chromeKey].message !== "string"
        ) {
          errors.push(
            `✗ ${locale}: missing or invalid Chrome key "${chromeKey}" in ${messagesPath}`
          )
        }
      }
    }
  }

  if (errors.length) {
    console.error("i18n coverage check failed:\n")
    for (const line of errors) {
      console.error(line)
    }
    console.error(
      "\nAdd the missing keys to the corresponding src/assets/locale/<locale>/common.json files."
    )
    process.exit(1)
  } else {
    console.log(
      "✓ i18n coverage OK for required common, tools, commandPalette, markdown, error, and featureHints/chatSidebar (where defined) plus Chrome _locales mirrors"
    )
  }
}

main()
