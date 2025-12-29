/**
 * Feature flags test utilities for enabling new UX features in E2E tests.
 */

/**
 * All feature flags enabled - use this to test the new UX redesign.
 */
export const ALL_FEATURE_FLAGS_ENABLED = {
  ff_newOnboarding: true,
  ff_newChat: true,
  ff_newSettings: true,
  ff_commandPalette: true,
  ff_compactMessages: true,
  ff_chatSidebar: true,
  ff_compareMode: true
}

/**
 * All feature flags disabled - use this for baseline/comparison tests.
 */
export const ALL_FEATURE_FLAGS_DISABLED = {
  ff_newOnboarding: false,
  ff_newChat: false,
  ff_newSettings: false,
  ff_commandPalette: false,
  ff_compactMessages: false,
  ff_chatSidebar: false,
  ff_compareMode: false
}

/**
 * Feature flag keys for reference.
 */
export const FEATURE_FLAG_KEYS = {
  NEW_ONBOARDING: 'ff_newOnboarding',
  NEW_CHAT: 'ff_newChat',
  NEW_SETTINGS: 'ff_newSettings',
  COMMAND_PALETTE: 'ff_commandPalette',
  COMPACT_MESSAGES: 'ff_compactMessages',
  CHAT_SIDEBAR: 'ff_chatSidebar',
  COMPARE_MODE: 'ff_compareMode'
} as const

/**
 * Merge all feature flags (enabled) with additional config.
 * Use this to create seedConfig for launchWithExtension.
 *
 * @example
 * const { page } = await launchWithExtension(extPath, {
 *   seedConfig: withAllFeaturesEnabled({
 *     serverUrl: 'http://127.0.0.1:8000',
 *     authMode: 'single-user'
 *   })
 * })
 */
export function withAllFeaturesEnabled(baseConfig?: Record<string, any>): Record<string, any> {
  return {
    ...ALL_FEATURE_FLAGS_ENABLED,
    ...baseConfig,
  }
}

/**
 * Merge all feature flags (disabled) with additional config.
 * Use this for baseline comparison tests.
 */
export function withAllFeaturesDisabled(baseConfig?: Record<string, any>): Record<string, any> {
  return {
    ...ALL_FEATURE_FLAGS_DISABLED,
    ...baseConfig,
  }
}

/**
 * Create config with specific features enabled.
 *
 * @example
 * const config = withFeatures(['ff_commandPalette', 'ff_compactMessages'], {
 *   serverUrl: 'http://127.0.0.1:8000'
 * })
 */
export function withFeatures(
  flags: Array<keyof typeof ALL_FEATURE_FLAGS_ENABLED>,
  baseConfig?: Record<string, any>
): Record<string, any> {
  const flagConfig = Object.fromEntries(
    flags.map((flag) => [flag, true])
  )
  return {
    ...ALL_FEATURE_FLAGS_DISABLED,
    ...flagConfig,
    ...baseConfig,
  }
}
