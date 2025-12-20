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
      "✓ i18n coverage OK for required common, tools, commandPalette keys and Chrome _locales mirrors"
    )
  }
}

main()
