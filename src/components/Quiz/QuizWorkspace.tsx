import React from "react"
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
import { QuizPlayground } from "./QuizPlayground"

/**
 * QuizWorkspace handles connection state, demo mode, and feature availability.
 * When online and feature is available, it renders QuizPlayground.
 */
export const QuizWorkspace: React.FC = () => {
  const { t } = useTranslation(["option", "common", "settings"])
  const navigate = useNavigate()
  const isOnline = useServerOnline()
  const { demoEnabled } = useDemoMode()
  const { capabilities, loading: capsLoading } = useServerCapabilities()
  const scrollToServerCard = useScrollToServerCard("/quiz")
  const { checkOnce } = useConnectionActions()
  const [checkingConnection, setCheckingConnection] = React.useState(false)

  const quizzesUnsupported = !capsLoading && !!capabilities && !capabilities.hasQuizzes

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
                {t("option:quiz.demoTitle", {
                  defaultValue: "Explore Quiz Playground in demo mode"
                })}
              </span>
            </span>
          }
          description={t("option:quiz.demoDescription", {
            defaultValue:
              "This demo shows how Quiz Playground can help you create and take quizzes from your content. Connect your own server later to generate quizzes from your media."
          })}
          examples={[
            t("option:quiz.demoExample1", {
              defaultValue:
                "Generate quizzes automatically from videos, articles, or documents."
            }),
            t("option:quiz.demoExample2", {
              defaultValue:
                "Create custom quizzes with multiple choice, true/false, and fill-in-the-blank questions."
            }),
            t("option:quiz.demoExample3", {
              defaultValue:
                "Track your quiz results and review incorrect answers to improve retention."
            })
          ]}
          primaryActionLabel={t("option:connectionCard.buttonGoToServerCard", {
            defaultValue: "Go to server card"
          })}
          onPrimaryAction={scrollToServerCard}
        />
      </div>
    ) : (
      <ConnectionProblemBanner
        badgeLabel="Not connected"
        title={t("option:quiz.emptyConnectTitle", {
          defaultValue: "Connect to use Quiz Playground"
        })}
        description={t("option:quiz.emptyConnectDescription", {
          defaultValue:
            "This view needs a connected server. Use the server connection card above to fix your connection, then return here to create and take quizzes."
        })}
        examples={[
          t("option:quiz.emptyConnectExample1", {
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
  if (quizzesUnsupported) {
    return (
      <FeatureEmptyState
        title={
          <span className="inline-flex items-center gap-2">
            <StatusBadge variant="error">Feature unavailable</StatusBadge>
            <span>
              {t("option:quiz.offlineTitle", {
                defaultValue: "Quiz API not available on this server"
              })}
            </span>
          </span>
        }
        description={t("option:quiz.offlineDescription", {
          defaultValue:
            "This tldw server does not advertise the Quiz endpoints. Upgrade your server to a version that includes /api/v1/quizzes to use this workspace."
        })}
        examples={[
          t("option:quiz.offlineExample1", {
            defaultValue:
              "Check Health & diagnostics to confirm your server version and available APIs."
          }),
          t("option:quiz.offlineExample2", {
            defaultValue:
              "After upgrading, reload the extension and return to Quiz Playground."
          })
        ]}
        primaryActionLabel={t("settings:healthSummary.diagnostics", {
          defaultValue: "Health & diagnostics"
        })}
        onPrimaryAction={() => navigate("/settings/health")}
      />
    )
  }

  // Online and feature supported - render main playground
  return <QuizPlayground />
}

export default QuizWorkspace
