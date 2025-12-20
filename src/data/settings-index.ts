/**
 * Searchable settings index for global settings search (⌘K).
 * Each setting has metadata for fuzzy matching and navigation.
 */

export interface SettingDefinition {
  /** Unique identifier */
  id: string
  /** i18n key for the label */
  labelKey: string
  /** Fallback label if translation not available */
  defaultLabel: string
  /** i18n key for description */
  descriptionKey?: string
  /** Fallback description */
  defaultDescription?: string
  /** Route to navigate to */
  route: string
  /** Section name for breadcrumb display */
  section: string
  /** Additional search keywords */
  keywords: string[]
  /** Storage key if directly toggleable */
  storageKey?: string
  /** Type of control */
  controlType?: "switch" | "select" | "input" | "slider" | "button"
}

export const SETTINGS_INDEX: SettingDefinition[] = [
  // ========================================
  // General Settings
  // ========================================
  {
    id: "setting-theme",
    labelKey: "settings:generalSettings.settings.theme.label",
    defaultLabel: "Theme",
    defaultDescription: "Choose between light, dark, or system theme",
    route: "/settings",
    section: "General",
    keywords: ["dark", "light", "mode", "appearance", "color"],
    controlType: "select",
  },
  {
    id: "setting-language",
    labelKey: "settings:generalSettings.settings.language.label",
    defaultLabel: "Language",
    defaultDescription: "Change the interface language",
    route: "/settings",
    section: "General",
    keywords: ["locale", "i18n", "translation", "localization"],
    controlType: "select",
  },
  {
    id: "setting-restore-model",
    labelKey: "settings:generalSettings.settings.restoreLastChatModel.label",
    defaultLabel: "Restore last model",
    defaultDescription: "Automatically select the model you used previously",
    route: "/settings/chat",
    section: "Chat",
    keywords: ["model", "restore", "remember", "previous", "default"],
    storageKey: "restoreLastChatModel",
    controlType: "switch",
  },
  {
    id: "setting-resume-chat",
    labelKey: "settings:generalSettings.settings.webUIResumeLastChat.label",
    defaultLabel: "Resume last chat",
    defaultDescription: "Continue your previous conversation when opening",
    route: "/settings",
    section: "General",
    keywords: ["restore", "continue", "session", "history"],
    storageKey: "webUIResumeLastChat",
    controlType: "switch",
  },
  {
    id: "setting-auto-copy",
    labelKey: "settings:generalSettings.settings.autoCopyResponseToClipboard.label",
    defaultLabel: "Auto-copy responses",
    defaultDescription: "Automatically copy AI responses to clipboard",
    route: "/settings/chat",
    section: "Chat",
    keywords: ["clipboard", "copy", "automatic"],
    storageKey: "autoCopyResponseToClipboard",
    controlType: "switch",
  },
  {
    id: "setting-user-bubble",
    labelKey: "settings:generalSettings.settings.userChatBubble.label",
    defaultLabel: "Message bubbles",
    defaultDescription: "Show messages in chat bubble style",
    route: "/settings/chat",
    section: "Chat",
    keywords: ["bubble", "style", "message", "appearance"],
    storageKey: "userChatBubble",
    controlType: "switch",
  },
  {
    id: "setting-wide-mode",
    labelKey: "settings:generalSettings.settings.checkWideMode.label",
    defaultLabel: "Wide mode",
    defaultDescription: "Use full width for the chat interface",
    route: "/settings/chat",
    section: "Chat",
    keywords: ["width", "full", "wide", "layout"],
    storageKey: "checkWideMode",
    controlType: "switch",
  },
  {
    id: "setting-reasoning",
    labelKey: "settings:generalSettings.settings.openReasoning.label",
    defaultLabel: "Show reasoning",
    defaultDescription: "Display AI reasoning steps when available",
    route: "/settings/chat",
    section: "Chat",
    keywords: ["thinking", "chain", "thought", "reasoning", "cot"],
    storageKey: "openReasoning",
    controlType: "switch",
  },
  {
    id: "setting-menu-density",
    labelKey: "settings:generalSettings.settings.menuDensity.label",
    defaultLabel: "Menu density",
    defaultDescription: "Adjust spacing in menus and lists",
    route: "/settings/chat",
    section: "Chat",
    keywords: ["compact", "comfortable", "spacing", "density"],
    storageKey: "menuDensity",
    controlType: "select",
  },
  {
    id: "setting-ocr-language",
    labelKey: "settings:generalSettings.settings.ocrLanguage.label",
    defaultLabel: "OCR language",
    defaultDescription: "Default language for text recognition in images",
    route: "/settings",
    section: "General",
    keywords: ["ocr", "text", "recognition", "image", "language"],
    controlType: "select",
  },

  // ========================================
  // Server Settings
  // ========================================
  {
    id: "setting-server-url",
    labelKey: "settings:tldw.serverUrl.label",
    defaultLabel: "Server URL",
    defaultDescription: "URL of your tldw_server instance",
    route: "/settings/tldw",
    section: "Server",
    keywords: ["url", "address", "host", "endpoint", "connection"],
    controlType: "input",
  },
  {
    id: "setting-api-key",
    labelKey: "settings:tldw.apiKey.label",
    defaultLabel: "API Key",
    defaultDescription: "Authentication key for the server",
    route: "/settings/tldw",
    section: "Server",
    keywords: ["key", "auth", "authentication", "token", "password"],
    controlType: "input",
  },

  // ========================================
  // RAG Settings
  // ========================================
  {
    id: "setting-embedding-model",
    labelKey: "settings:rag.embeddingModel.label",
    defaultLabel: "Embedding model",
    defaultDescription: "Model used for text embeddings in RAG",
    route: "/settings/rag",
    section: "RAG",
    keywords: ["embedding", "vector", "model", "semantic", "search"],
    controlType: "select",
  },
  {
    id: "setting-chunk-size",
    labelKey: "settings:rag.chunkSize.label",
    defaultLabel: "Chunk size",
    defaultDescription: "Size of text chunks for embedding",
    route: "/settings/rag",
    section: "RAG",
    keywords: ["chunk", "size", "split", "segment"],
    controlType: "slider",
  },
  {
    id: "setting-top-k",
    labelKey: "settings:rag.topK.label",
    defaultLabel: "Top K results",
    defaultDescription: "Number of documents to retrieve",
    route: "/settings/rag",
    section: "RAG",
    keywords: ["top", "results", "documents", "retrieve", "k"],
    controlType: "slider",
  },

  // ========================================
  // Model Settings
  // ========================================
  {
    id: "setting-default-model",
    labelKey: "settings:manageModels.defaultModel.label",
    defaultLabel: "Default model",
    defaultDescription: "Model to use when starting new chats",
    route: "/settings/model",
    section: "Models",
    keywords: ["model", "default", "ai", "llm"],
    controlType: "select",
  },

  // ========================================
  // TTS/STT Settings
  // ========================================
  {
    id: "setting-tts-voice",
    labelKey: "settings:ttsSettings.voice.label",
    defaultLabel: "Text-to-speech voice",
    defaultDescription: "Voice for reading responses aloud",
    route: "/settings",
    section: "General",
    keywords: ["voice", "tts", "speech", "read", "aloud", "speak"],
    controlType: "select",
  },
  {
    id: "setting-stt-language",
    labelKey: "settings:generalSettings.settings.speechRecognitionLang.label",
    defaultLabel: "Speech recognition language",
    defaultDescription: "Language for voice input",
    route: "/settings",
    section: "General",
    keywords: ["speech", "voice", "recognition", "stt", "dictation", "microphone"],
    controlType: "select",
  },

  // ========================================
  // Notifications & Behavior
  // ========================================
  {
    id: "setting-notifications",
    labelKey: "settings:generalSettings.settings.sendNotificationAfterIndexing.label",
    defaultLabel: "Indexing notifications",
    defaultDescription: "Show notification when indexing completes",
    route: "/settings",
    section: "General",
    keywords: ["notification", "alert", "indexing", "complete"],
    storageKey: "sendNotificationAfterIndexing",
    controlType: "switch",
  },
  {
    id: "setting-generate-title",
    labelKey: "settings:generalSettings.settings.generateTitle.label",
    defaultLabel: "Auto-generate titles",
    defaultDescription: "Automatically create titles for new chats",
    route: "/settings",
    section: "General",
    keywords: ["title", "generate", "automatic", "name"],
    storageKey: "titleGenEnabled",
    controlType: "switch",
  },

  // ========================================
  // Advanced Settings
  // ========================================
  {
    id: "setting-hide-model-settings",
    labelKey: "settings:generalSettings.settings.hideCurrentChatModelSettings.label",
    defaultLabel: "Hide model settings",
    defaultDescription: "Hide the inline model configuration in chat",
    route: "/settings/chat",
    section: "Chat",
    keywords: ["hide", "model", "settings", "inline", "configuration"],
    storageKey: "hideCurrentChatModelSettings",
    controlType: "switch",
  },
  {
    id: "setting-formatted-copy",
    labelKey: "settings:generalSettings.settings.copyAsFormattedText.label",
    defaultLabel: "Copy as formatted text",
    defaultDescription: "Include formatting when copying messages",
    route: "/settings/chat",
    section: "Chat",
    keywords: ["copy", "format", "markdown", "rich", "text"],
    storageKey: "copyAsFormattedText",
    controlType: "switch",
  },

  // ========================================
  // Health & Diagnostics
  // ========================================
  {
    id: "setting-health",
    labelKey: "settings:healthNav",
    defaultLabel: "Health & Diagnostics",
    defaultDescription: "Check server connection and system status",
    route: "/settings/health",
    section: "Server",
    keywords: ["health", "status", "diagnostic", "connection", "check"],
    controlType: "button",
  },

  // ========================================
  // Knowledge Tools
  // ========================================
  {
    id: "setting-knowledge",
    labelKey: "settings:knowledgeNav",
    defaultLabel: "Knowledge Base",
    defaultDescription: "Manage your RAG knowledge base and documents",
    route: "/settings/knowledge",
    section: "Knowledge",
    keywords: ["knowledge", "rag", "documents", "files", "upload", "index"],
    controlType: "button",
  },
  {
    id: "setting-world-books",
    labelKey: "settings:worldBooksNav",
    defaultLabel: "World Books",
    defaultDescription: "Create and manage world-building content",
    route: "/settings/world-books",
    section: "Knowledge",
    keywords: ["world", "books", "lore", "context", "background"],
    controlType: "button",
  },
  {
    id: "setting-dictionaries",
    labelKey: "settings:dictionariesNav",
    defaultLabel: "Chat Dictionaries",
    defaultDescription: "Custom terminology and replacements",
    route: "/settings/chat-dictionaries",
    section: "Knowledge",
    keywords: ["dictionary", "terms", "glossary", "replace", "vocabulary"],
    controlType: "button",
  },
  {
    id: "setting-characters",
    labelKey: "settings:charactersNav",
    defaultLabel: "Characters",
    defaultDescription: "Create AI personas and characters",
    route: "/settings/characters",
    section: "Knowledge",
    keywords: ["character", "persona", "roleplay", "actor", "profile"],
    controlType: "button",
  },
  {
    id: "setting-media",
    labelKey: "settings:mediaNav",
    defaultLabel: "Media Library",
    defaultDescription: "Browse and manage uploaded media files",
    route: "/media",
    section: "Knowledge",
    keywords: ["media", "files", "library", "documents", "browse"],
    controlType: "button",
  },

  // ========================================
  // Workspace
  // ========================================
  {
    id: "setting-flashcards",
    labelKey: "settings:flashcardsNav",
    defaultLabel: "Flashcards",
    defaultDescription: "Spaced repetition learning with flashcards",
    route: "/flashcards",
    section: "Workspace",
    keywords: ["flashcards", "study", "learn", "spaced", "repetition", "cards"],
    controlType: "button",
  },
  {
    id: "setting-notes",
    labelKey: "settings:notesNav",
    defaultLabel: "Notes",
    defaultDescription: "View and manage your saved notes",
    route: "/notes",
    section: "Workspace",
    keywords: ["notes", "save", "text", "snippets", "notebook"],
    controlType: "button",
  },
  {
    id: "setting-prompts",
    labelKey: "settings:promptsNav",
    defaultLabel: "Prompt Library",
    defaultDescription: "Manage system prompts and templates",
    route: "/settings/prompt",
    section: "Workspace",
    keywords: ["prompts", "template", "system", "instruction", "preset"],
    controlType: "button",
  },
  {
    id: "setting-prompt-studio",
    labelKey: "settings:promptStudioNav",
    defaultLabel: "Prompt Studio",
    defaultDescription: "Advanced prompt engineering tools",
    route: "/settings/prompt-studio",
    section: "Workspace",
    keywords: ["prompt", "studio", "engineering", "test", "iterate"],
    controlType: "button",
  },
  {
    id: "setting-evaluations",
    labelKey: "settings:evaluationsNav",
    defaultLabel: "Evaluations",
    defaultDescription: "Run and review model evaluations",
    route: "/settings/evaluations",
    section: "Workspace",
    keywords: ["evaluation", "benchmark", "test", "compare", "metrics"],
    controlType: "button",
  },

  // ========================================
  // Chat Appearance
  // ========================================
  {
    id: "setting-user-text-color",
    labelKey: "settings:chatAppearance.userColor",
    defaultLabel: "User text color",
    defaultDescription: "Color for your messages in chat",
    route: "/settings/chat",
    section: "Chat Appearance",
    keywords: ["color", "user", "message", "text", "appearance"],
    controlType: "select",
  },
  {
    id: "setting-assistant-text-color",
    labelKey: "settings:chatAppearance.assistantColor",
    defaultLabel: "Assistant text color",
    defaultDescription: "Color for AI responses in chat",
    route: "/settings/chat",
    section: "Chat Appearance",
    keywords: ["color", "assistant", "ai", "response", "text"],
    controlType: "select",
  },
  {
    id: "setting-user-font",
    labelKey: "settings:chatAppearance.userFont",
    defaultLabel: "User message font",
    defaultDescription: "Font style for your messages",
    route: "/settings/chat",
    section: "Chat Appearance",
    keywords: ["font", "user", "message", "typography", "style"],
    controlType: "select",
  },
  {
    id: "setting-assistant-font",
    labelKey: "settings:chatAppearance.assistantFont",
    defaultLabel: "Assistant message font",
    defaultDescription: "Font style for AI responses",
    route: "/settings/chat",
    section: "Chat Appearance",
    keywords: ["font", "assistant", "ai", "response", "typography"],
    controlType: "select",
  },
  {
    id: "setting-markdown-user",
    labelKey: "settings:generalSettings.settings.useMarkdownForUserMessage.label",
    defaultLabel: "Markdown for user messages",
    defaultDescription: "Enable markdown formatting in your messages",
    route: "/settings/chat",
    section: "Chat",
    keywords: ["markdown", "user", "format", "rich", "text"],
    storageKey: "useMarkdownForUserMessage",
    controlType: "switch",
  },

  // ========================================
  // About
  // ========================================
  {
    id: "setting-about",
    labelKey: "settings:aboutNav",
    defaultLabel: "About",
    defaultDescription: "Extension version and information",
    route: "/settings/about",
    section: "About",
    keywords: ["about", "version", "info", "extension", "credits"],
    controlType: "button",
  },
  {
    id: "setting-restart-onboarding",
    labelKey: "settings:generalSettings.restartOnboarding",
    defaultLabel: "Restart onboarding",
    defaultDescription: "Re-run the initial setup wizard",
    route: "/settings",
    section: "General",
    keywords: ["onboarding", "setup", "wizard", "restart", "reset"],
    controlType: "button",
  },
]

/**
 * Search settings by query string.
 * Returns settings that match the query in label, description, or keywords.
 */
export function searchSettings(
  query: string,
  t?: (key: string, defaultValue?: string) => string
): SettingDefinition[] {
  const normalizedQuery = query.toLowerCase().trim()
  if (!normalizedQuery) return []

  return SETTINGS_INDEX.filter((setting) => {
    // Get translated or default values
    const label = t
      ? t(setting.labelKey, setting.defaultLabel)
      : setting.defaultLabel
    const description = setting.descriptionKey && t
      ? t(setting.descriptionKey, setting.defaultDescription)
      : setting.defaultDescription || ""

    // Check matches
    const labelMatch = label.toLowerCase().includes(normalizedQuery)
    const descMatch = description.toLowerCase().includes(normalizedQuery)
    const keywordMatch = setting.keywords.some((kw) =>
      kw.toLowerCase().includes(normalizedQuery)
    )
    const sectionMatch = setting.section.toLowerCase().includes(normalizedQuery)

    return labelMatch || descMatch || keywordMatch || sectionMatch
  }).sort((a, b) => {
    // Prioritize exact label matches
    const aLabel = (t ? t(a.labelKey, a.defaultLabel) : a.defaultLabel).toLowerCase()
    const bLabel = (t ? t(b.labelKey, b.defaultLabel) : b.defaultLabel).toLowerCase()

    const aExact = aLabel === normalizedQuery
    const bExact = bLabel === normalizedQuery
    if (aExact && !bExact) return -1
    if (bExact && !aExact) return 1

    const aStarts = aLabel.startsWith(normalizedQuery)
    const bStarts = bLabel.startsWith(normalizedQuery)
    if (aStarts && !bStarts) return -1
    if (bStarts && !aStarts) return 1

    return aLabel.localeCompare(bLabel)
  })
}

/**
 * Get a setting by its storage key
 */
export function getSettingByStorageKey(
  storageKey: string
): SettingDefinition | undefined {
  return SETTINGS_INDEX.find((s) => s.storageKey === storageKey)
}

/**
 * Get all settings for a given route
 */
export function getSettingsByRoute(route: string): SettingDefinition[] {
  return SETTINGS_INDEX.filter((s) => s.route === route)
}

/**
 * Get all settings for a given section
 */
export function getSettingsBySection(section: string): SettingDefinition[] {
  return SETTINGS_INDEX.filter((s) => s.section === section)
}
