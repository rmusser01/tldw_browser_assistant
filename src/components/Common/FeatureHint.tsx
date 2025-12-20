import React from "react"
import { useTranslation } from "react-i18next"
import { X, Lightbulb } from "lucide-react"
import { useStorage } from "@plasmohq/storage/hook"
import { createSafeStorage } from "@/utils/safe-storage"

type FeatureHintProps = {
  /** Unique key to track if this hint has been seen */
  featureKey: string
  /** Short title for the hint */
  title: string
  /** Description explaining the feature */
  description: string
  /** Position relative to the target element */
  position?: "top" | "bottom" | "left" | "right"
  /** Additional class names */
  className?: string
  /** Whether the hint should be shown (in addition to not being dismissed) */
  show?: boolean
  /** Callback when hint is dismissed */
  onDismiss?: () => void
}

const STORAGE_KEY = "tldw:seenHints"
const hintStorage = createSafeStorage({ area: "local" })

/**
 * First-time feature hint component.
 * Shows a tooltip-style callout that can be dismissed permanently.
 * Tracks seen hints in localStorage to only show once.
 */
export const FeatureHint: React.FC<FeatureHintProps> = ({
  featureKey,
  title,
  description,
  position = "bottom",
  className,
  show = true,
  onDismiss
}) => {
  const { t } = useTranslation(["common"])
  const [seenHints, setSeenHints] = useStorage<Record<string, boolean>>({
    key: STORAGE_KEY,
    instance: hintStorage
  })
  const [isVisible, setIsVisible] = React.useState(true)

  // Check if this hint has been seen
  const hasBeenSeen = seenHints?.[featureKey] === true

  // Don't render if already seen or explicitly hidden
  if (hasBeenSeen || !isVisible || !show) {
    return null
  }

  const handleDismiss = async () => {
    setIsVisible(false)
    // Mark as seen in storage
    await setSeenHints((prev) => ({
      ...(prev || {}),
      [featureKey]: true
    }))
    onDismiss?.()
  }

  // Position classes
  const positionClasses = {
    top: "bottom-full mb-2 left-1/2 -translate-x-1/2",
    bottom: "top-full mt-2 left-1/2 -translate-x-1/2",
    left: "right-full mr-2 top-1/2 -translate-y-1/2",
    right: "left-full ml-2 top-1/2 -translate-y-1/2"
  }

  // Arrow position classes
  const arrowClasses = {
    top: "top-full left-1/2 -translate-x-1/2 border-t-gray-800 dark:border-t-gray-700 border-l-transparent border-r-transparent border-b-transparent",
    bottom: "bottom-full left-1/2 -translate-x-1/2 border-b-gray-800 dark:border-b-gray-700 border-l-transparent border-r-transparent border-t-transparent",
    left: "left-full top-1/2 -translate-y-1/2 border-l-gray-800 dark:border-l-gray-700 border-t-transparent border-b-transparent border-r-transparent",
    right: "right-full top-1/2 -translate-y-1/2 border-r-gray-800 dark:border-r-gray-700 border-t-transparent border-b-transparent border-l-transparent"
  }

  return (
    <div
      role="tooltip"
      aria-live="polite"
      className={`absolute z-50 ${positionClasses[position]} ${className || ""}`}
    >
      <div className="relative bg-gray-800 dark:bg-gray-700 text-white rounded-lg shadow-lg max-w-xs animate-in fade-in slide-in-from-bottom-2 duration-200">
        {/* Arrow */}
        <div
          className={`absolute w-0 h-0 border-[6px] ${arrowClasses[position]}`}
          aria-hidden="true"
        />

        {/* Content */}
        <div className="px-3 py-2">
          <div className="flex items-start gap-2">
            <Lightbulb
              className="size-4 text-yellow-400 flex-shrink-0 mt-0.5"
              aria-hidden="true"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white">{title}</p>
              <p className="text-xs text-gray-300 mt-0.5">{description}</p>
            </div>
            <button
              onClick={handleDismiss}
              className="p-0.5 rounded hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 flex-shrink-0"
              aria-label={t("common:dismiss", "Dismiss")}
            >
              <X className="size-3.5 text-gray-400 hover:text-white" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Hook to check if a feature hint has been seen
 */
export const useFeatureHintSeen = (featureKey: string) => {
  const [seenHints] = useStorage<Record<string, boolean>>({
    key: STORAGE_KEY,
    instance: hintStorage
  })

  return seenHints?.[featureKey] === true
}

/**
 * Hook to mark a feature hint as seen programmatically
 */
export const useMarkFeatureHintSeen = () => {
  const [, setSeenHints] = useStorage<Record<string, boolean>>({
    key: STORAGE_KEY,
    instance: hintStorage
  })

  return React.useCallback(
    async (featureKey: string) => {
      await setSeenHints((prev) => ({
        ...(prev || {}),
        [featureKey]: true
      }))
    },
    [setSeenHints]
  )
}

/**
 * Hook to reset all feature hints (for testing/debugging)
 */
export const useResetFeatureHints = () => {
  const [, setSeenHints] = useStorage<Record<string, boolean>>({
    key: STORAGE_KEY,
    instance: hintStorage
  })

  return React.useCallback(async () => {
    await setSeenHints({})
  }, [setSeenHints])
}

export default FeatureHint
