import React from "react"
import { Alert } from "antd"

const isDevMode = Boolean(import.meta.env?.DEV) || import.meta.env?.MODE === "development"

type LocaleIssue = {
  path: string
  message: string
  line?: number
  column?: number
}

const findErrorPosition = (message: string): number | null => {
  const match = message.match(/position (\d+)/i)
  if (!match) return null
  const pos = Number(match[1])
  return Number.isFinite(pos) ? pos : null
}

const findLineColumn = (text: string, position: number) => {
  if (position < 0 || position > text.length) return null
  const before = text.slice(0, position)
  const line = before.split("\n").length
  const column = position - before.lastIndexOf("\n")
  return { line, column }
}

export const LocaleJsonDiagnostics: React.FC = () => {
  const issues = React.useMemo<LocaleIssue[]>(() => {
    if (!isDevMode) return []

    const rawModules = import.meta.glob("../../assets/locale/*/*.json", {
      as: "raw",
      eager: true
    }) as Record<string, string>

    const next: LocaleIssue[] = []
    Object.entries(rawModules).forEach(([path, raw]) => {
      if (typeof raw !== "string") return
      try {
        JSON.parse(raw)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        const position = findErrorPosition(message)
        const loc = position != null ? findLineColumn(raw, position) : null
        next.push({
          path,
          message,
          line: loc?.line,
          column: loc?.column
        })
      }
    })

    return next
  }, [])

  if (!isDevMode || issues.length === 0) return null

  return (
    <div className="mb-4">
      <Alert
        type="error"
        showIcon
        message="Locale JSON errors detected"
        description={
          <div className="space-y-1 text-xs">
            {issues.map((issue) => (
              <div key={issue.path} className="break-all">
                <span className="font-mono">{issue.path}</span>
                {issue.line && issue.column
                  ? ` (line ${issue.line}, col ${issue.column})`
                  : ""}
                {": "}
                {issue.message}
              </div>
            ))}
          </div>
        }
      />
    </div>
  )
}

export default LocaleJsonDiagnostics
