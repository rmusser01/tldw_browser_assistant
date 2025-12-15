import { useStorage } from "@plasmohq/storage/hook"

/**
 * Feature flags for gradual UX redesign rollout.
 * All flags default to false (old UX) and can be enabled per-user.
 */

// Flag keys
export const FEATURE_FLAGS = {
  NEW_ONBOARDING: "ff_newOnboarding",
  NEW_CHAT: "ff_newChat",
  NEW_SETTINGS: "ff_newSettings",
  COMMAND_PALETTE: "ff_commandPalette",
  COMPACT_MESSAGES: "ff_compactMessages",
  CHAT_SIDEBAR: "ff_chatSidebar",
} as const

export type FeatureFlagKey = (typeof FEATURE_FLAGS)[keyof typeof FEATURE_FLAGS]

/**
 * Hook to check if a feature flag is enabled.
 * @param flag - The feature flag key
 * @returns [isEnabled, setEnabled] tuple
 */
export function useFeatureFlag(flag: FeatureFlagKey) {
  // Default to true to enable new UX features by default
  return useStorage(flag, true)
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

  return {
    flags: {
      newOnboarding,
      newChat,
      newSettings,
      commandPalette,
      compactMessages,
      chatSidebar,
    },
    setters: {
      setNewOnboarding,
      setNewChat,
      setNewSettings,
      setCommandPalette,
      setCompactMessages,
      setChatSidebar,
    },
    // Enable all new UX features
    enableAll: () => {
      setNewOnboarding(true)
      setNewChat(true)
      setNewSettings(true)
      setCommandPalette(true)
      setCompactMessages(true)
      setChatSidebar(true)
    },
    // Disable all new UX features (revert to old)
    disableAll: () => {
      setNewOnboarding(false)
      setNewChat(false)
      setNewSettings(false)
      setCommandPalette(false)
      setCompactMessages(false)
      setChatSidebar(false)
    },
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
