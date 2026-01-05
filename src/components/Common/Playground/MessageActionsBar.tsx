import React from "react"
import type { TFunction } from "i18next"
import { Popover, Tooltip } from "antd"
import {
  CheckIcon,
  ChevronLeft,
  ChevronRight,
  CopyIcon,
  GitBranchIcon,
  InfoIcon,
  Layers,
  Pen,
  PlayCircle,
  RotateCcw,
  Square,
  StickyNote,
  FileText,
  Volume2Icon,
  CornerUpLeft,
  Trash2
} from "lucide-react"
import { IconButton } from "../IconButton"
import { GenerationInfo } from "./GenerationInfo"
import { FeedbackButtons } from "@/components/Sidepanel/Chat/FeedbackButtons"
import type { FeedbackThumb } from "@/store/feedback"
import type { GenerationInfo as GenerationInfoType } from "./types"

const ACTION_BUTTON_CLASS =
  "flex items-center justify-center rounded-full border border-border bg-surface2 text-text-muted hover:bg-surface hover:text-text transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-focus min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0"

const ActionButtonWithLabel: React.FC<{
  icon: React.ReactNode
  label: string
  showLabel?: boolean
  className?: string
}> = ({ icon, label, showLabel = false, className = "" }) => (
  <span className={`inline-flex items-center gap-1 ${className}`}>
    {icon}
    {showLabel && (
      <span className="text-label text-text-subtle">{label}</span>
    )}
  </span>
)

type MessageActionsBarProps = {
  t: TFunction
  isProMode: boolean
  isBot: boolean
  showVariantPager: boolean
  resolvedVariantIndex: number
  variantCount: number
  canSwipePrev: boolean
  canSwipeNext: boolean
  onSwipePrev?: () => void
  onSwipeNext?: () => void
  overflowChipVisibility: string
  actionRowVisibility: string
  isTtsEnabled?: boolean
  ttsDisabledReason?: string | null
  ttsActionDisabled?: boolean
  isSpeaking: boolean
  onToggleTts: () => void
  hideCopy?: boolean
  copyPressed: boolean
  onCopy: () => void | Promise<void>
  canReply: boolean
  onReply: () => void
  canSaveToNotes: boolean
  canSaveToFlashcards: boolean
  canGenerateDocument: boolean
  onGenerateDocument: () => void
  onSaveKnowledge: (makeFlashcard: boolean) => void
  savingKnowledge: "note" | "flashcard" | null
  generationInfo?: GenerationInfoType
  isLastMessage: boolean
  hideEditAndRegenerate?: boolean
  onRegenerate: () => void
  onNewBranch?: () => void
  temporaryChat?: boolean
  hideContinue?: boolean
  onContinue?: () => void
  onEdit: () => void
  editMode: boolean
  feedbackSelected?: FeedbackThumb
  feedbackDisabled: boolean
  feedbackDisabledReason: string
  isFeedbackSubmitting: boolean
  showThanks: boolean
  onThumbUp: () => void
  onThumbDown: () => void
  onOpenDetails: () => void
  onDelete?: () => void
}

export function MessageActionsBar({
  t,
  isProMode,
  isBot,
  showVariantPager,
  resolvedVariantIndex,
  variantCount,
  canSwipePrev,
  canSwipeNext,
  onSwipePrev,
  onSwipeNext,
  overflowChipVisibility,
  actionRowVisibility,
  isTtsEnabled,
  ttsDisabledReason,
  ttsActionDisabled = false,
  isSpeaking,
  onToggleTts,
  hideCopy,
  copyPressed,
  onCopy,
  canReply,
  onReply,
  canSaveToNotes,
  canSaveToFlashcards,
  canGenerateDocument,
  onGenerateDocument,
  onSaveKnowledge,
  savingKnowledge,
  generationInfo,
  isLastMessage,
  hideEditAndRegenerate,
  onRegenerate,
  onNewBranch,
  temporaryChat,
  hideContinue,
  onContinue,
  onEdit,
  editMode,
  feedbackSelected,
  feedbackDisabled,
  feedbackDisabledReason,
  isFeedbackSubmitting,
  showThanks,
  onThumbUp,
  onThumbDown,
  onOpenDetails,
  onDelete
}: MessageActionsBarProps) {
  const actionButtonClass = `${ACTION_BUTTON_CLASS} ${
    isProMode ? "h-11 px-3 sm:h-8 sm:px-2" : "h-11 w-11 sm:h-7 sm:w-7"
  }`

  return (
    <div className="flex w-full justify-end">
      <div className="flex items-center gap-1">
        {showVariantPager && (
          <div className="inline-flex items-center gap-1 rounded-full border border-border bg-surface2 px-1.5 py-0.5 text-[11px] text-text-muted">
            <button
              type="button"
              aria-label={t(
                "playground:actions.previousVariant",
                "Previous response"
              ) as string}
              title={t(
                "playground:actions.previousVariant",
                "Previous response"
              ) as string}
              onClick={() => {
                if (canSwipePrev) {
                  onSwipePrev?.()
                }
              }}
              disabled={!canSwipePrev}
              className={`flex h-4 w-4 items-center justify-center rounded-full transition-colors ${
                canSwipePrev
                  ? "text-text-subtle hover:text-text"
                  : "text-text-muted/50"
              }`}
            >
              <ChevronLeft className="h-3 w-3" />
            </button>
            <span className="tabular-nums text-[10px]">
              {resolvedVariantIndex + 1}/{variantCount}
            </span>
            <button
              type="button"
              aria-label={t(
                "playground:actions.nextVariant",
                "Next response"
              ) as string}
              title={t(
                "playground:actions.nextVariant",
                "Next response"
              ) as string}
              onClick={() => {
                if (canSwipeNext) {
                  onSwipeNext?.()
                }
              }}
              disabled={!canSwipeNext}
              className={`flex h-4 w-4 items-center justify-center rounded-full transition-colors ${
                canSwipeNext
                  ? "text-text-subtle hover:text-text"
                  : "text-text-muted/50"
              }`}
            >
              <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        )}
        <button
          type="button"
          aria-label={t("common:moreActions", "More actions") as string}
          title={t("common:moreActions", "More actions") as string}
          className={`${overflowChipVisibility} rounded-full border border-border bg-surface2 px-2 py-0.5 text-[11px] text-text-muted transition-colors hover:text-text`}
        >
          •••
        </button>
        <div className={`${actionRowVisibility} flex-wrap items-center gap-2`}>
          <div className="flex flex-wrap items-center gap-1">
            {isTtsEnabled && (
              <Tooltip title={ttsDisabledReason || t("tts")}>
                <IconButton
                  ariaLabel={t("tts") as string}
                  onClick={onToggleTts}
                  className={`${actionButtonClass} disabled:cursor-not-allowed disabled:opacity-50`}
                  disabled={ttsActionDisabled}
                >
                  <ActionButtonWithLabel
                    icon={
                      !isSpeaking ? (
                        <Volume2Icon
                          className={`w-3 h-3 ${
                            ttsActionDisabled
                              ? "text-text-muted"
                              : "text-text-subtle group-hover:text-text"
                          }`}
                        />
                      ) : (
                        <Square className="w-3 h-3 text-danger group-hover:text-danger" />
                      )
                    }
                    label={t("ttsShort", "TTS")}
                    showLabel={isProMode}
                  />
                </IconButton>
              </Tooltip>
            )}
            {!hideCopy && (
              <Tooltip title={t("copyToClipboard")}>
                <IconButton
                  ariaLabel={t("copyToClipboard") as string}
                  onClick={() => {
                    void onCopy()
                  }}
                  className={actionButtonClass}
                >
                  <ActionButtonWithLabel
                    icon={
                      !copyPressed ? (
                        <CopyIcon className="w-3 h-3 text-text-subtle group-hover:text-text" />
                      ) : (
                        <CheckIcon className="w-3 h-3 text-success group-hover:text-success" />
                      )
                    }
                    label={t("copyShort", "Copy")}
                    showLabel={isProMode}
                  />
                </IconButton>
              </Tooltip>
            )}
            {canReply && (
              <Tooltip title={t("common:reply", "Reply")}>
                <IconButton
                  ariaLabel={t("common:reply", "Reply") as string}
                  onClick={onReply}
                  className={actionButtonClass}
                >
                  <ActionButtonWithLabel
                    icon={
                      <CornerUpLeft className="w-3 h-3 text-text-subtle group-hover:text-text" />
                    }
                    label={t("common:replyShort", "Reply")}
                    showLabel={isProMode}
                  />
                </IconButton>
              </Tooltip>
            )}
            {isBot && (
              <>
                {canSaveToNotes && (
                  <Tooltip title={t("saveToNotes", "Save to Notes")}>
                    <IconButton
                      ariaLabel={t("saveToNotes", "Save to Notes") as string}
                      onClick={() => onSaveKnowledge(false)}
                      disabled={savingKnowledge !== null}
                      className={actionButtonClass}
                    >
                      <ActionButtonWithLabel
                        icon={
                          <StickyNote className="w-3 h-3 text-text-subtle group-hover:text-text" />
                        }
                        label={t("saveNoteShort", "Note")}
                        showLabel={isProMode}
                      />
                    </IconButton>
                  </Tooltip>
                )}
                {canSaveToFlashcards && (
                  <Tooltip title={t("saveToFlashcards", "Save to Flashcards")}>
                    <IconButton
                      ariaLabel={
                        t("saveToFlashcards", "Save to Flashcards") as string
                      }
                      onClick={() => onSaveKnowledge(true)}
                      disabled={savingKnowledge !== null}
                      className={actionButtonClass}
                    >
                      <ActionButtonWithLabel
                        icon={
                          <Layers className="w-3 h-3 text-text-subtle group-hover:text-text" />
                        }
                        label={t("saveFlashcardShort", "Card")}
                        showLabel={isProMode}
                      />
                    </IconButton>
                  </Tooltip>
                )}
                {canGenerateDocument && (
                  <Tooltip title={t("generateDocument", "Generate document")}>
                    <IconButton
                      ariaLabel={
                        t("generateDocument", "Generate document") as string
                      }
                      onClick={onGenerateDocument}
                      className={actionButtonClass}
                    >
                      <ActionButtonWithLabel
                        icon={
                          <FileText className="w-3 h-3 text-text-subtle group-hover:text-text" />
                        }
                        label={t("documentShort", "Doc")}
                        showLabel={isProMode}
                      />
                    </IconButton>
                  </Tooltip>
                )}
                {generationInfo && (
                  <Popover
                    content={<GenerationInfo generationInfo={generationInfo} />}
                    title={t("generationInfo")}
                  >
                    <IconButton
                      ariaLabel={t("generationInfo") as string}
                      className={actionButtonClass}
                    >
                      <ActionButtonWithLabel
                        icon={
                          <InfoIcon className="w-3 h-3 text-text-subtle group-hover:text-text" />
                        }
                        label={t("infoShort", "Info")}
                        showLabel={isProMode}
                      />
                    </IconButton>
                  </Popover>
                )}
                {!hideEditAndRegenerate && isLastMessage && (
                  <Tooltip title={t("regenerate")}>
                    <IconButton
                      ariaLabel={t("regenerate") as string}
                      onClick={onRegenerate}
                      className={actionButtonClass}
                    >
                      <ActionButtonWithLabel
                        icon={
                          <RotateCcw className="w-3 h-3 text-text-subtle group-hover:text-text" />
                        }
                        label={t("regenShort", "Redo")}
                        showLabel={isProMode}
                      />
                    </IconButton>
                  </Tooltip>
                )}
                {onNewBranch && !temporaryChat && (
                  <Tooltip title={t("newBranch")}>
                    <IconButton
                      ariaLabel={t("newBranch") as string}
                      onClick={onNewBranch}
                      className={actionButtonClass}
                    >
                      <ActionButtonWithLabel
                        icon={
                          <GitBranchIcon className="w-3 h-3 text-text-subtle group-hover:text-text" />
                        }
                        label={t("branchShort", "Branch")}
                        showLabel={isProMode}
                      />
                    </IconButton>
                  </Tooltip>
                )}
                {!hideContinue && isLastMessage && (
                  <Tooltip title={t("continue")}>
                    <IconButton
                      ariaLabel={t("continue") as string}
                      onClick={onContinue}
                      className={actionButtonClass}
                    >
                      <ActionButtonWithLabel
                        icon={
                          <PlayCircle className="w-3 h-3 text-text-subtle group-hover:text-text" />
                        }
                        label={t("continueShort", "More")}
                        showLabel={isProMode}
                      />
                    </IconButton>
                  </Tooltip>
                )}
              </>
            )}
            {!hideEditAndRegenerate && (
              <Tooltip title={t("edit")}>
                <IconButton
                  onClick={onEdit}
                  ariaLabel={t("edit") as string}
                  className={actionButtonClass}
                >
                  <ActionButtonWithLabel
                    icon={
                      <Pen className="w-3 h-3 text-text-subtle group-hover:text-text" />
                    }
                    label={t("edit", "Edit")}
                    showLabel={isProMode}
                  />
                </IconButton>
              </Tooltip>
            )}
            {onDelete && (
              <Tooltip title={t("common:delete", "Delete")}>
                <IconButton
                  onClick={onDelete}
                  ariaLabel={t("common:delete", "Delete") as string}
                  className={actionButtonClass}
                >
                  <ActionButtonWithLabel
                    icon={
                      <Trash2 className="w-3 h-3 text-danger group-hover:text-danger" />
                    }
                    label={t("common:delete", "Delete")}
                    showLabel={isProMode}
                  />
                </IconButton>
              </Tooltip>
            )}
          </div>
          {!editMode && isBot && (
            <FeedbackButtons
              compact
              selected={feedbackSelected}
              disabled={feedbackDisabled}
              disabledReason={feedbackDisabledReason}
              isSubmitting={isFeedbackSubmitting}
              onThumbUp={onThumbUp}
              onThumbDown={onThumbDown}
              onOpenDetails={onOpenDetails}
              showThanks={showThanks}
            />
          )}
        </div>
      </div>
    </div>
  )
}
