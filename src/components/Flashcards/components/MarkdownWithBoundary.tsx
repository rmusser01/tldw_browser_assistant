import React from "react"
import { MarkdownErrorBoundary } from "@/components/Common/MarkdownErrorBoundary"

const Markdown = React.lazy(() => import("@/components/Common/Markdown"))

interface SafeMarkdownProps {
  content: string
  className?: string
  size?: "xs" | "sm" | "base"
}

/**
 * Markdown renderer with error boundary and lazy loading.
 * Falls back to plain text if markdown rendering fails.
 */
export const MarkdownWithBoundary: React.FC<SafeMarkdownProps> = ({
  content,
  className = "",
  size = "sm"
}) => {
  const sizeClass =
    size === "xs" ? "prose-xs" : size === "sm" ? "prose-sm" : "prose"

  return (
    <MarkdownErrorBoundary fallbackText={content}>
      <React.Suspense
        fallback={<div className="whitespace-pre-wrap">{content}</div>}
      >
        <Markdown
          message={content}
          className={`${sizeClass} break-words dark:prose-invert max-w-none prose-p:leading-relaxed prose-pre:p-0 dark:prose-dark ${className}`}
        />
      </React.Suspense>
    </MarkdownErrorBoundary>
  )
}

export default MarkdownWithBoundary
