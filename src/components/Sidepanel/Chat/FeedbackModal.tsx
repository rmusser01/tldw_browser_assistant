import React from "react"
import { Button, Checkbox, Input, Modal, Rate } from "antd"
import { useTranslation } from "react-i18next"

type Props = {
  open: boolean
  onClose: () => void
  onSubmit: (payload: {
    rating?: number | null
    issues?: string[]
    notes?: string
  }) => Promise<boolean>
  isSubmitting?: boolean
  initialRating?: number | null
  initialIssues?: string[]
  initialNotes?: string
}

export const FeedbackModal = ({
  open,
  onClose,
  onSubmit,
  isSubmitting = false,
  initialRating = null,
  initialIssues = [],
  initialNotes = ""
}: Props) => {
  const { t } = useTranslation("playground")
  const [rating, setRating] = React.useState<number | null>(initialRating)
  const [issues, setIssues] = React.useState<string[]>(initialIssues)
  const [notes, setNotes] = React.useState<string>(initialNotes)

  React.useEffect(() => {
    if (open) {
      setRating(initialRating)
      setIssues(initialIssues)
      setNotes(initialNotes)
    }
  }, [open, initialIssues, initialNotes, initialRating])

  const issueOptions = [
    {
      label: t("feedback.issues.incorrect", "Incorrect information"),
      value: "incorrect"
    },
    {
      label: t("feedback.issues.notRelevant", "Not relevant to my question"),
      value: "not_relevant"
    },
    {
      label: t("feedback.issues.missingDetails", "Missing important details"),
      value: "missing_details"
    },
    {
      label: t("feedback.issues.badSources", "Sources were unhelpful"),
      value: "bad_sources"
    },
    {
      label: t("feedback.issues.tooVerbose", "Too verbose"),
      value: "too_verbose"
    },
    {
      label: t("feedback.issues.tooBrief", "Too brief"),
      value: "too_brief"
    },
    {
      label: t("feedback.issues.other", "Other"),
      value: "other"
    }
  ]

  const hasContent =
    (typeof rating === "number" && rating > 0) ||
    issues.length > 0 ||
    notes.trim().length > 0

  return (
    <Modal
      open={open}
      title={t("feedback.modalTitle", "Feedback")}
      onCancel={onClose}
      footer={null}
      destroyOnHidden={false}>
      <div className="space-y-4" data-testid="feedback-modal">
        <div>
          <div className="text-sm font-medium text-text">
            {t("feedback.modalRatingLabel", "How would you rate this response?")}
          </div>
          <div className="mt-2 flex items-center gap-3">
            <Rate
              allowClear
              value={rating || 0}
              onChange={(value) =>
                setRating(value > 0 ? value : null)
              }
            />
            <span className="text-xs text-text-muted">
              {rating ? `${rating}/5` : ""}
            </span>
          </div>
        </div>

        <div>
          <div className="text-sm font-medium text-text">
            {t(
              "feedback.modalIssuesLabel",
              "What was the issue? (select all that apply)"
            )}
          </div>
          <Checkbox.Group
            className="mt-2 grid gap-2"
            value={issues}
            options={issueOptions}
            onChange={(values) => setIssues(values as string[])}
          />
        </div>

        <div>
          <div className="text-sm font-medium text-text">
            {t(
              "feedback.modalNotesLabel",
              "Additional comments (optional)"
            )}
          </div>
          <Input.TextArea
            className="mt-2"
            data-testid="feedback-notes"
            value={notes}
            rows={4}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <div className="flex items-center justify-end gap-2">
          <Button
            data-testid="feedback-cancel"
            onClick={onClose}
            disabled={isSubmitting}>
            {t("common:cancel", "Cancel")}
          </Button>
          <Button
            type="primary"
            data-testid="feedback-submit"
            onClick={async () => {
              const ok = await onSubmit({
                rating,
                issues,
                notes
              })
              if (ok) {
                onClose()
              }
            }}
            disabled={!hasContent || isSubmitting}
            loading={isSubmitting}>
            {t("feedback.modalSubmit", "Submit feedback")}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
