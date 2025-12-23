import React from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Button, Card, Empty, Input, Select, Space, Tag, Tooltip, Typography } from "antd"
import { useTranslation } from "react-i18next"
import { useAntdMessage } from "@/hooks/useAntdMessage"
import {
  useDecksQuery,
  useReviewQuery,
  useReviewFlashcardMutation,
  useFlashcardShortcuts
} from "../hooks"
import { MarkdownWithBoundary } from "../components/MarkdownWithBoundary"

const { Text, Title } = Typography

interface ReviewTabProps {
  onNavigateToCreate: () => void
  onNavigateToImport: () => void
}

/**
 * Review tab for studying flashcards with spaced repetition.
 */
export const ReviewTab: React.FC<ReviewTabProps> = ({
  onNavigateToCreate,
  onNavigateToImport
}) => {
  const { t } = useTranslation(["option", "common"])
  const qc = useQueryClient()
  const message = useAntdMessage()

  // State
  const [reviewDeckId, setReviewDeckId] = React.useState<number | null | undefined>(undefined)
  const [showAnswer, setShowAnswer] = React.useState(false)
  const [answerMs, setAnswerMs] = React.useState<number | undefined>(undefined)
  const [showAdvancedTiming, setShowAdvancedTiming] = React.useState(false)

  // Queries and mutations
  const decksQuery = useDecksQuery()
  const reviewQuery = useReviewQuery(reviewDeckId)
  const reviewMutation = useReviewFlashcardMutation()

  // Rating options for Anki-style review with colors and shortcuts
  const ratingOptions = React.useMemo(
    () => [
      {
        value: 0,
        key: "1",
        label: t("option:flashcards.ratingAgain", { defaultValue: "Again" }),
        description: t("option:flashcards.ratingAgainHelp", {
          defaultValue: "I didn't remember this card."
        }),
        color: "#f5222d", // red
        bgClass: "bg-red-500 hover:bg-red-600 border-red-500"
      },
      {
        value: 2,
        key: "2",
        label: t("option:flashcards.ratingHard", { defaultValue: "Hard" }),
        description: t("option:flashcards.ratingHardHelp", {
          defaultValue: "I barely remembered; it felt difficult."
        }),
        color: "#fa8c16", // orange
        bgClass: "bg-orange-500 hover:bg-orange-600 border-orange-500"
      },
      {
        value: 3,
        key: "3",
        label: t("option:flashcards.ratingGood", { defaultValue: "Good" }),
        description: t("option:flashcards.ratingGoodHelp", {
          defaultValue: "I remembered with a bit of effort."
        }),
        color: "#52c41a", // green
        bgClass: "bg-green-500 hover:bg-green-600 border-green-500"
      },
      {
        value: 5,
        key: "4",
        label: t("option:flashcards.ratingEasy", { defaultValue: "Easy" }),
        description: t("option:flashcards.ratingEasyHelp", {
          defaultValue: "I remembered easily; no problem."
        }),
        color: "#1890ff", // blue
        bgClass: "bg-blue-500 hover:bg-blue-600 border-blue-500"
      }
    ],
    [t]
  )

  const onSubmitReview = React.useCallback(
    async (rating: number) => {
      try {
        const card = reviewQuery.data
        if (!card) return
        const answer_time_ms =
          typeof answerMs === "number" && !Number.isNaN(answerMs)
            ? Math.round(answerMs * 1000)
            : undefined
        await reviewMutation.mutateAsync({
          cardUuid: card.uuid,
          rating,
          answerTimeMs: answer_time_ms
        })
        setShowAnswer(false)
        setAnswerMs(undefined)
        setShowAdvancedTiming(false)
        message.success(t("common:success", { defaultValue: "Success" }))
      } catch (e: any) {
        message.error(e?.message || "Failed to submit review")
      }
    },
    [reviewQuery.data, answerMs, reviewMutation, message, t]
  )

  // Keyboard shortcuts for review
  useFlashcardShortcuts({
    enabled: !!reviewQuery.data,
    showingAnswer: showAnswer,
    onFlip: () => setShowAnswer(true),
    onRate: onSubmitReview
  })

  return (
    <div>
      <Space wrap className="mb-3">
        <Select
          placeholder={t("option:flashcards.selectDeck", {
            defaultValue: "Select deck (optional)"
          })}
          allowClear
          loading={decksQuery.isLoading}
          value={reviewDeckId as any}
          className="min-w-64"
          onChange={(v) => setReviewDeckId(v)}
          data-testid="flashcards-review-deck-select"
          options={(decksQuery.data || []).map((d) => ({
            label: d.name,
            value: d.id
          }))}
        />
        <Button
          onClick={() =>
            qc.invalidateQueries({
              queryKey: ["flashcards:review:next"]
            })
          }
          loading={reviewQuery.isFetching}
          data-testid="flashcards-review-next-due"
        >
          {t("option:flashcards.nextDue", { defaultValue: "Next due" })}
        </Button>
      </Space>

      {reviewQuery.data ? (
        <Card>
          <div className="flex flex-col gap-3">
            <div>
              <Tag>
                {reviewQuery.data.model_type}
                {reviewQuery.data.reverse ? " - reverse" : ""}
              </Tag>
              {reviewQuery.data.tags?.map((tag) => (
                <Tag key={tag}>{tag}</Tag>
              ))}
            </div>

            <div>
              <Title level={5} className="!mb-2">
                {t("option:flashcards.front", { defaultValue: "Front" })}
              </Title>
              <div className="border rounded p-3 bg-white dark:bg-[#111] text-sm">
                <MarkdownWithBoundary
                  content={reviewQuery.data.front}
                  size="sm"
                />
              </div>
            </div>

            {showAnswer && (
              <div>
                <Title level={5} className="!mb-2">
                  {t("option:flashcards.back", { defaultValue: "Back" })}
                </Title>
                <div className="border rounded p-3 bg-white dark:bg-[#111] text-sm">
                  <MarkdownWithBoundary
                    content={reviewQuery.data.back}
                    size="sm"
                  />
                </div>
                {reviewQuery.data.extra && (
                  <div className="mt-2 text-sm opacity-80">
                    <MarkdownWithBoundary
                      content={reviewQuery.data.extra}
                      size="xs"
                    />
                  </div>
                )}
              </div>
            )}

            <div className="mt-2 flex flex-col gap-3">
              {!showAnswer ? (
                <div className="flex flex-col gap-2">
                  <Button
                    type="primary"
                    onClick={() => setShowAnswer(true)}
                    data-testid="flashcards-review-show-answer"
                  >
                    {t("option:flashcards.showAnswer", {
                      defaultValue: "Show Answer"
                    })}
                  </Button>
                  <Text type="secondary" className="text-xs">
                    {t("option:flashcards.shortcutFlip", {
                      defaultValue: "Press Space to flip"
                    })}
                  </Text>
                </div>
              ) : (
                <>
                  <div className="flex flex-col gap-2">
                    <Text>
                      {t("option:flashcards.rate", {
                        defaultValue: "How well did you remember this card?"
                      })}
                    </Text>
                    <div className="flex flex-wrap gap-2">
                      {ratingOptions.map((opt) => (
                        <Tooltip
                          key={opt.value}
                          title={`${opt.description} (${opt.key})`}
                        >
                          <Button
                            onClick={() => onSubmitReview(opt.value)}
                            aria-label={`${opt.label} (${opt.key})`}
                            style={{
                              backgroundColor: opt.color,
                              borderColor: opt.color,
                              color: "white"
                            }}
                            className="hover:opacity-90"
                            data-testid={`flashcards-review-rate-${opt.key}`}
                          >
                            <span className="font-medium">{opt.label}</span>
                            <span className="ml-1.5 opacity-70 text-xs">
                              ({opt.key})
                            </span>
                          </Button>
                        </Tooltip>
                      ))}
                    </div>
                    <Text type="secondary" className="text-xs">
                      {t("option:flashcards.shortcutRate", {
                        defaultValue: "Press 1-4 to rate"
                      })}
                    </Text>
                  </div>
                  <button
                    type="button"
                    className="self-start text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    onClick={() => setShowAdvancedTiming((v) => !v)}
                  >
                    {showAdvancedTiming
                      ? t("option:flashcards.hideTiming", {
                          defaultValue: "Hide timing"
                        })
                      : t("option:flashcards.showTiming", {
                          defaultValue: "Track answer time"
                        })}
                  </button>
                  {showAdvancedTiming && (
                    <div className="flex items-center gap-2">
                      <Text type="secondary">
                        {t("option:flashcards.answerMs", {
                          defaultValue: "Time to answer (seconds, optional)"
                        })}
                      </Text>
                      <Input
                        className="w-32"
                        type="number"
                        min={0}
                        value={
                          typeof answerMs === "number" && !Number.isNaN(answerMs)
                            ? String(answerMs)
                            : ""
                        }
                        onChange={(e) => {
                          const v = Number(e.target.value)
                          setAnswerMs(
                            Number.isFinite(v) && v >= 0 ? v : undefined
                          )
                        }}
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </Card>
      ) : (
        <Card>
          <Empty
            description={t("option:flashcards.noDueTitle", {
              defaultValue: "No cards due for review"
            })}
          >
            <Space direction="vertical" align="center">
              <Text type="secondary">
                {t("option:flashcards.noDueDescription", {
                  defaultValue:
                    "You're all caught up. Create new cards or import an existing deck to start reviewing."
                })}
              </Text>
              <Space>
                <Button type="primary" onClick={onNavigateToCreate}>
                  {t("option:flashcards.noDueCreateCta", {
                    defaultValue: "Create a new card"
                  })}
                </Button>
                <Button onClick={onNavigateToImport}>
                  {t("option:flashcards.noDueImportCta", {
                    defaultValue: "Import a deck"
                  })}
                </Button>
              </Space>
            </Space>
          </Empty>
        </Card>
      )}
    </div>
  )
}

export default ReviewTab
