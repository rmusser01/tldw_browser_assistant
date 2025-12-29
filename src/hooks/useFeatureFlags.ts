import { useCallback } from "react"
import { useStorage } from "@plasmohq/storage/hook"

/**
 * Feature flags for gradual UX redesign rollout.
 * Most flags default to true (new UX); specific flags may default off.
 */

// Flag keys
export const FEATURE_FLAGS = {
  NEW_ONBOARDING: "ff_newOnboarding",
  NEW_CHAT: "ff_newChat",
  NEW_SETTINGS: "ff_newSettings",
  COMMAND_PALETTE: "ff_commandPalette",
  COMPACT_MESSAGES: "ff_compactMessages",
  CHAT_SIDEBAR: "ff_chatSidebar",
  COMPARE_MODE: "ff_compareMode"
} as const

export type FeatureFlagKey = (typeof FEATURE_FLAGS)[keyof typeof FEATURE_FLAGS]

const FEATURE_FLAG_DEFAULTS: Partial<Record<FeatureFlagKey, boolean>> = {
  [FEATURE_FLAGS.COMPARE_MODE]: false
}

/**
 * Hook to check if a feature flag is enabled.
 * @param flag - The feature flag key
 * @returns [isEnabled, setEnabled] tuple
 */
export function useFeatureFlag(flag: FeatureFlagKey) {
  // Default to true to enable new UX features by default
  return useStorage(flag, FEATURE_FLAG_DEFAULTS[flag] ?? true)
}

/**
 * Hook to get all feature flags at once.
 * Useful for settings page or debugging.
 */
export function useAllFeatureFlags() {
  const [newOnboarding, setNewOnboarding] = useStorage(
    FEATURE_FLAGS.NEW_ONBOARDING,
    true
  )
  const [newChat, setNewChat] = useStorage(FEATURE_FLAGS.NEW_CHAT, true)
  const [newSettings, setNewSettings] = useStorage(
    FEATURE_FLAGS.NEW_SETTINGS,
    true
  )
  const [commandPalette, setCommandPalette] = useStorage(
    FEATURE_FLAGS.COMMAND_PALETTE,
    true
  )
  const [compactMessages, setCompactMessages] = useStorage(
    FEATURE_FLAGS.COMPACT_MESSAGES,
    true
  )
  const [chatSidebar, setChatSidebar] = useStorage(
    FEATURE_FLAGS.CHAT_SIDEBAR,
    true
  )
  const [compareMode, setCompareMode] = useStorage(
    FEATURE_FLAGS.COMPARE_MODE,
    FEATURE_FLAG_DEFAULTS[FEATURE_FLAGS.COMPARE_MODE] ?? true
  )

  return {
    flags: {
      newOnboarding,
      newChat,
      newSettings,
      commandPalette,
      compactMessages,
      chatSidebar,
      compareMode
    },
    setters: {
      setNewOnboarding,
      setNewChat,
      setNewSettings,
      setCommandPalette,
      setCompactMessages,
      setChatSidebar,
      setCompareMode
    },
    // Enable all new UX features
    enableAll: useCallback(() => {
      setNewOnboarding(true)
      setNewChat(true)
      setNewSettings(true)
      setCommandPalette(true)
      setCompactMessages(true)
      setChatSidebar(true)
      setCompareMode(true)
    }, [
      setNewOnboarding,
      setNewChat,
      setNewSettings,
      setCommandPalette,
      setCompactMessages,
      setChatSidebar,
      setCompareMode
    ]),
    // Disable all new UX features (revert to old)
    disableAll: useCallback(() => {
      setNewOnboarding(false)
      setNewChat(false)
      setNewSettings(false)
      setCommandPalette(false)
      setCompactMessages(false)
      setChatSidebar(false)
      setCompareMode(false)
    }, [
      setNewOnboarding,
      setNewChat,
      setNewSettings,
      setCommandPalette,
      setCompactMessages,
      setChatSidebar,
      setCompareMode
    ])
  }
}

/**
 * Convenience hooks for specific features
 */
export function useNewOnboarding() {
  return useFeatureFlag(FEATURE_FLAGS.NEW_ONBOARDING)
}

export function useNewChat() {
  return useFeatureFlag(FEATURE_FLAGS.NEW_CHAT)
}

export function useNewSettings() {
  return useFeatureFlag(FEATURE_FLAGS.NEW_SETTINGS)
}

export function useCommandPalette() {
  return useFeatureFlag(FEATURE_FLAGS.COMMAND_PALETTE)
}

export function useCompactMessages() {
  return useFeatureFlag(FEATURE_FLAGS.COMPACT_MESSAGES)
}

export function useChatSidebar() {
  return useFeatureFlag(FEATURE_FLAGS.CHAT_SIDEBAR)
}
