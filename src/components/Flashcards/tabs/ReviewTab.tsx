import React from "react"
import { Button, Card, Empty, Input, Select, Space, Tag, Tooltip, Typography } from "antd"
import { useTranslation } from "react-i18next"
import { useAntdMessage } from "@/hooks/useAntdMessage"
import {
  useDecksQuery,
  useReviewQuery,
  useReviewFlashcardMutation,
  useFlashcardShortcuts,
  useDueCountsQuery,
  useHasCardsQuery
} from "../hooks"
import { MarkdownWithBoundary, ReviewProgress } from "../components"
import { calculateIntervals } from "../utils/calculateIntervals"

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
  const message = useAntdMessage()

  // State
  const [reviewDeckId, setReviewDeckId] = React.useState<number | null | undefined>(undefined)
  const [showAnswer, setShowAnswer] = React.useState(false)
  const [answerMs, setAnswerMs] = React.useState<number | undefined>(undefined)
  const [showAdvancedTiming, setShowAdvancedTiming] = React.useState(false)
  const [reviewedCount, setReviewedCount] = React.useState(0)

  // Queries and mutations
  const decksQuery = useDecksQuery()
  const reviewQuery = useReviewQuery(reviewDeckId)
  const reviewMutation = useReviewFlashcardMutation()
  const dueCountsQuery = useDueCountsQuery(reviewDeckId)
  const hasCardsQuery = useHasCardsQuery()

  // Get deck name for progress display
  const currentDeckName = React.useMemo(() => {
    if (!reviewDeckId || !decksQuery.data) return undefined
    return decksQuery.data.find((d) => d.id === reviewDeckId)?.name
  }, [reviewDeckId, decksQuery.data])

  // Calculate intervals for current card
  const intervals = React.useMemo(() => {
    const card = reviewQuery.data
    if (!card) return null
    return calculateIntervals(card)
  }, [reviewQuery.data])

  // Rating options for Anki-style review with colors, shortcuts, and interval previews
  const ratingOptions = React.useMemo(
    () => [
      {
        value: 0,
        key: "1",
        label: t("option:flashcards.ratingAgain", { defaultValue: "Again" }),
        description: t("option:flashcards.ratingAgainHelp", {
          defaultValue: "I didn't remember this card."
        }),
        interval: intervals?.again ?? "< 1 min",
        bgClass: "bg-red-500 hover:bg-red-600 border-red-500"
      },
      {
        value: 2,
        key: "2",
        label: t("option:flashcards.ratingHard", { defaultValue: "Hard" }),
        description: t("option:flashcards.ratingHardHelp", {
          defaultValue: "I barely remembered; it felt difficult."
        }),
        interval: intervals?.hard ?? "< 10 min",
        bgClass: "bg-orange-500 hover:bg-orange-600 border-orange-500"
      },
      {
        value: 3,
        key: "3",
        label: t("option:flashcards.ratingGood", { defaultValue: "Good" }),
        description: t("option:flashcards.ratingGoodHelp", {
          defaultValue: "I remembered with a bit of effort."
        }),
        interval: intervals?.good ?? "1 day",
        bgClass: "bg-green-500 hover:bg-green-600 border-green-500",
        primary: true
      },
      {
        value: 5,
        key: "4",
        label: t("option:flashcards.ratingEasy", { defaultValue: "Easy" }),
        description: t("option:flashcards.ratingEasyHelp", {
          defaultValue: "I remembered easily; no problem."
        }),
        interval: intervals?.easy ?? "4 days",
        bgClass: "bg-blue-500 hover:bg-blue-600 border-blue-500"
      }
    ],
    [t, intervals]
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
        setReviewedCount((c) => c + 1)
        message.success(t("common:success", { defaultValue: "Success" }))
      } catch (e: unknown) {
        const errorMessage =
          e instanceof Error ? e.message : "Failed to submit review"
        message.error(errorMessage)
      }
    },
    [reviewQuery.data, answerMs, reviewMutation, message, t]
  )

  // Reset reviewed count when deck changes
  React.useEffect(() => {
    setReviewedCount(0)
  }, [reviewDeckId])

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
          value={reviewDeckId ?? undefined}
          className="min-w-64"
          onChange={(v) => setReviewDeckId(v)}
          data-testid="flashcards-review-deck-select"
          options={(decksQuery.data || []).map((d) => ({
            label: d.name,
            value: d.id
          }))}
        />
        <Button
          onClick={() => reviewQuery.refetch()}
          loading={reviewQuery.isFetching}
          data-testid="flashcards-review-next-due"
        >
          {t("option:flashcards.nextDue", { defaultValue: "Next due" })}
        </Button>
      </Space>

      {dueCountsQuery.data && dueCountsQuery.data.total > 0 && (
        <ReviewProgress
          dueCount={dueCountsQuery.data.total}
          reviewedCount={reviewedCount}
          deckName={currentDeckName}
        />
      )}

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
              <div className="rounded border border-border bg-surface p-3 text-sm">
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
                <div className="rounded border border-border bg-surface p-3 text-sm">
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
                    <div className="flex flex-wrap gap-2 justify-center">
                      {ratingOptions.map((opt) => (
                        <Tooltip
                          key={opt.value}
                          title={`${opt.description} (${opt.key})`}
                        >
                          <Button
                            onClick={() => onSubmitReview(opt.value)}
                            aria-label={`${opt.label} (${opt.key})`}
                            className={`!text-white ${opt.bgClass} ${opt.primary ? "!px-6" : ""}`}
                            data-testid={`flashcards-review-rate-${opt.key}`}
                          >
                            <div className="flex flex-col items-center">
                              <span className="font-medium">
                                {opt.label}
                                <span className="ml-1 opacity-70 text-xs">
                                  ({opt.key})
                                </span>
                              </span>
                              <span className="text-xs opacity-80">
                                {opt.interval}
                              </span>
                            </div>
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
                    className="self-start text-xs text-text-subtle hover:text-text"
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
            description={
              hasCardsQuery.data === false
                ? t("option:flashcards.noCardsYet", {
                    defaultValue: "No flashcards yet"
                  })
                : t("option:flashcards.allCaughtUp", {
                    defaultValue: "You're all caught up!"
                  })
            }
          >
            <Space direction="vertical" align="center">
              {hasCardsQuery.data === false ? (
                <>
                  <Text type="secondary">
                    {t("option:flashcards.noCardsDescription", {
                      defaultValue:
                        "Create your first flashcard to start studying."
                    })}
                  </Text>
                  <Space>
                    <Button type="primary" onClick={onNavigateToCreate}>
                      {t("option:flashcards.createFirstCard", {
                        defaultValue: "Create a flashcard"
                      })}
                    </Button>
                    <Button onClick={onNavigateToImport}>
                      {t("option:flashcards.noDueImportCta", {
                        defaultValue: "Import a deck"
                      })}
                    </Button>
                  </Space>
                </>
              ) : (
                <>
                  <Text type="secondary">
                    {t("option:flashcards.allCaughtUpDescription", {
                      defaultValue:
                        "No cards are due for review. Great job!"
                    })}
                  </Text>
                  <Button onClick={onNavigateToCreate}>
                    {t("option:flashcards.createMoreCards", {
                      defaultValue: "Create more cards"
                    })}
                  </Button>
                </>
              )}
            </Space>
          </Empty>
        </Card>
      )}
    </div>
  )
}

export default ReviewTab
