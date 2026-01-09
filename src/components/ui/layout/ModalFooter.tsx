import React from "react"
import { cn } from "@/libs/utils"
import { Button } from "@/components/Common/Button"

export interface ModalFooterAction {
  /** Button label */
  label: React.ReactNode
  /** Click handler */
  onClick?: () => void
  /** Show loading spinner */
  loading?: boolean
  /** Disable the button */
  disabled?: boolean
  /** Use danger styling */
  danger?: boolean
  /** Button type for forms */
  type?: "button" | "submit"
}

export interface ModalFooterProps {
  /** Primary action (right side, emphasized) */
  primaryAction?: ModalFooterAction
  /** Secondary action (left of primary) */
  secondaryAction?: ModalFooterAction
  /** Cancel/close action */
  onCancel?: () => void
  /** Cancel button label (default: "Cancel") */
  cancelLabel?: React.ReactNode
  /** Hide the cancel button */
  hideCancel?: boolean
  /** Alignment of actions */
  align?: "left" | "center" | "right" | "between"
  /** Extra content on the left side */
  leftContent?: React.ReactNode
  /** Additional CSS classes */
  className?: string
  /** Test ID */
  "data-testid"?: string
}

/**
 * Standardized modal footer with consistent action button layout.
 *
 * Replaces custom footer implementations across 23+ modal files.
 *
 * @example
 * ```tsx
 * // Basic usage
 * <Modal footer={null}>
 *   <ModalFooter
 *     primaryAction={{ label: "Save", onClick: handleSave, loading: isSaving }}
 *     onCancel={handleClose}
 *   />
 * </Modal>
 *
 * // With secondary action
 * <ModalFooter
 *   primaryAction={{ label: "Submit", type: "submit" }}
 *   secondaryAction={{ label: "Save Draft", onClick: handleDraft }}
 *   onCancel={handleClose}
 * />
 *
 * // Danger action
 * <ModalFooter
 *   primaryAction={{ label: "Delete", onClick: handleDelete, danger: true }}
 *   onCancel={handleClose}
 *   cancelLabel="Keep"
 * />
 * ```
 */
export const ModalFooter = React.forwardRef<HTMLDivElement, ModalFooterProps>(
  (
    {
      primaryAction,
      secondaryAction,
      onCancel,
      cancelLabel = "Cancel",
      hideCancel = false,
      align = "right",
      leftContent,
      className,
      "data-testid": dataTestId,
    },
    ref
  ) => {
    const alignmentClasses = {
      left: "justify-start",
      center: "justify-center",
      right: "justify-end",
      between: "justify-between",
    }

    return (
      <div
        ref={ref}
        className={cn(
          "flex items-center gap-2 border-t border-border bg-surface px-4 py-3",
          alignmentClasses[align],
          className
        )}
        data-testid={dataTestId}
      >
        {leftContent && <div className="flex-1">{leftContent}</div>}

        <div className="flex items-center gap-2">
          {!hideCancel && onCancel && (
            <Button variant="ghost" onClick={onCancel}>
              {cancelLabel}
            </Button>
          )}

          {secondaryAction && (
            <Button
              variant="secondary"
              type={secondaryAction.type || "button"}
              onClick={secondaryAction.onClick}
              loading={secondaryAction.loading}
              disabled={secondaryAction.disabled}
            >
              {secondaryAction.label}
            </Button>
          )}

          {primaryAction && (
            <Button
              variant={primaryAction.danger ? "danger" : "primary"}
              type={primaryAction.type || "button"}
              onClick={primaryAction.onClick}
              loading={primaryAction.loading}
              disabled={primaryAction.disabled}
            >
              {primaryAction.label}
            </Button>
          )}
        </div>
      </div>
    )
  }
)

ModalFooter.displayName = "ModalFooter"

export default ModalFooter
