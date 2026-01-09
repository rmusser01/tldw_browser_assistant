import React from "react"
import { Spin } from "antd"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { useServerOnline } from "@/hooks/useServerOnline"
import { useServerCapabilities } from "@/hooks/useServerCapabilities"
import { useDemoMode } from "@/context/demo-mode"
import { useScrollToServerCard } from "@/hooks/useScrollToServerCard"
import { useConnectionActions } from "@/hooks/useConnectionState"
import FeatureEmptyState from "@/components/Common/FeatureEmptyState"
import ConnectionProblemBanner from "@/components/Common/ConnectionProblemBanner"
import { StatusBadge } from "@/components/Common/StatusBadge"
import { getDemoFlashcardDecks } from "@/utils/demo-content"
const FlashcardsManager = React.lazy(() =>
  import("./FlashcardsManager").then((m) => ({ default: m.FlashcardsManager }))
)

/**
 * FlashcardsWorkspace handles connection state, demo mode, and feature availability.
 * When online and feature is available, it renders FlashcardsManager.
 */
export const FlashcardsWorkspace: React.FC = () => {
  const { t } = useTranslation(["option", "common", "settings"])
  const navigate = useNavigate()
  const isOnline = useServerOnline()
  const { demoEnabled } = useDemoMode()
  const { capabilities, loading: capsLoading } = useServerCapabilities()
  const scrollToServerCard = useScrollToServerCard("/flashcards")
  const { checkOnce } = useConnectionActions()
  const [checkingConnection, setCheckingConnection] = React.useState(false)

  const flashcardsUnsupported = !capsLoading && !!capabilities && !capabilities.hasFlashcards

  const demoDecks = React.useMemo(() => getDemoFlashcardDecks(t), [t])

  const handleRetryConnection = React.useCallback(() => {
    if (checkingConnection) return
    setCheckingConnection(true)
    Promise.resolve(checkOnce())
      .catch(() => {
        // errors are surfaced via connection UX state
      })
      .finally(() => {
        setCheckingConnection(false)
      })
  }, [checkOnce, checkingConnection])

  // Offline state - show demo or connection banner
  if (!isOnline) {
    return demoEnabled ? (
      <div className="space-y-4">
        <FeatureEmptyState
          title={
            <span className="inline-flex items-center gap-2">
              <StatusBadge variant="demo">Demo</StatusBadge>
              <span>
                {t("option:flashcards.demoTitle", {
                  defaultValue: "Explore Flashcards in demo mode"
                })}
              </span>
            </span>
          }
          description={t("option:flashcards.demoDescription", {
            defaultValue:
              "This demo shows how Flashcards can turn your content into spaced-repetition cards. Connect your own server later to generate and review cards from your own notes and media."
          })}
          examples={[
            t("option:flashcards.demoExample1", {
              defaultValue:
                "See how decks, cards, and tags are organized across Review and Manage tabs."
            }),
            t("option:flashcards.demoExample2", {
              defaultValue:
                "When you connect, you'll be able to generate cards from lectures, meetings, or notes and review them on a schedule."
            }),
            t("option:flashcards.demoExample3", {
              defaultValue:
                "Use Flashcards together with Notes and Media to keep important ideas fresh."
            })
          ]}
          primaryActionLabel={t("option:connectionCard.buttonGoToServerCard", {
            defaultValue: "Go to server card"
          })}
          onPrimaryAction={scrollToServerCard}
        />
        <div className="rounded-lg border border-dashed border-border bg-surface p-3 text-xs text-text">
          <div className="mb-2 font-semibold">
            {t("option:flashcards.demoPreviewHeading", {
              defaultValue: "Example decks (preview only)"
            })}
          </div>
          <div className="divide-y divide-border">
            {demoDecks.map((deck) => (
              <div key={deck.id} className="py-2">
                <div className="text-sm font-medium text-text">
                  {deck.name}
                </div>
                <div className="mt-1 text-[11px] text-text-muted">
                  {deck.summary}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    ) : (
      <ConnectionProblemBanner
        badgeLabel="Not connected"
        title={t("option:flashcards.emptyConnectTitle", {
          defaultValue: "Connect to use Flashcards"
        })}
        description={t("option:flashcards.emptyConnectDescription", {
          defaultValue:
            "This view needs a connected server. Use the server connection card above to fix your connection, then return here to review and generate flashcards."
        })}
        examples={[
          t("option:flashcards.emptyConnectExample1", {
            defaultValue:
              "Use the connection card at the top of this page to add your server URL and API key."
          })
        ]}
        primaryActionLabel={t("option:connectionCard.buttonGoToServerCard", {
          defaultValue: "Go to server card"
        })}
        onPrimaryAction={scrollToServerCard}
        retryActionLabel={t("option:buttonRetry", "Retry connection")}
        onRetry={handleRetryConnection}
        retryDisabled={checkingConnection}
      />
    )
  }

  // Feature not supported on this server
  if (flashcardsUnsupported) {
    return (
      <FeatureEmptyState
        title={
          <span className="inline-flex items-center gap-2">
            <StatusBadge variant="error">Feature unavailable</StatusBadge>
            <span>
              {t("option:flashcards.offlineTitle", {
                defaultValue: "Flashcards API not available on this server"
              })}
            </span>
          </span>
        }
        description={t("option:flashcards.offlineDescription", {
          defaultValue:
            "This tldw server does not advertise the Flashcards endpoints. Upgrade your server to a version that includes /api/v1/flashcards... to use this workspace."
        })}
        examples={[
          t("option:flashcards.offlineExample1", {
            defaultValue:
              "Check Health & diagnostics to confirm your server version and available APIs."
          }),
          t("option:flashcards.offlineExample2", {
            defaultValue:
              "After upgrading, reload the extension and return to Flashcards."
          })
        ]}
        primaryActionLabel={t("settings:healthSummary.diagnostics", {
          defaultValue: "Health & diagnostics"
        })}
        onPrimaryAction={() => navigate("/settings/health")}
      />
    )
  }

  // Online and feature supported - render main manager
  return (
    <React.Suspense
      fallback={
        <div className="flex justify-center py-8">
          <Spin />
        </div>
      }
    >
      <FlashcardsManager />
    </React.Suspense>
  )
}

export default FlashcardsWorkspace
