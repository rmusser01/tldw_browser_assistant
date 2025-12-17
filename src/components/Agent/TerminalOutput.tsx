/**
 * TerminalOutput - Display command execution output with terminal styling
 */

import { FC, useRef, useEffect, useState, useMemo } from "react"
import { useTranslation } from "react-i18next"
import {
  Terminal,
  CheckCircle2,
  XCircle,
  Clock,
  Copy,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  Loader2,
  AlertTriangle
} from "lucide-react"
import { message } from "antd"

export interface CommandExecution {
  id: string
  commandId: string
  args?: string[]
  cwd?: string
  status: "pending" | "running" | "complete" | "error" | "timeout"
  exitCode?: number
  stdout?: string
  stderr?: string
  durationMs?: number
  timestamp: Date
}

interface TerminalOutputProps {
  executions: CommandExecution[]
  className?: string
  autoScroll?: boolean
  collapsible?: boolean
  maxHeight?: string
}

// Simple ANSI color code parser (basic support)
function parseAnsiColors(text: string): { text: string; className: string }[] {
  const segments: { text: string; className: string }[] = []
  let currentClass = ""
  let buffer = ""

  // Map ANSI codes to Tailwind classes
  const colorMap: Record<string, string> = {
    "30": "text-gray-900 dark:text-gray-100",
    "31": "text-red-500",
    "32": "text-green-500",
    "33": "text-yellow-500",
    "34": "text-blue-500",
    "35": "text-purple-500",
    "36": "text-cyan-500",
    "37": "text-gray-300",
    "90": "text-gray-500",
    "91": "text-red-400",
    "92": "text-green-400",
    "93": "text-yellow-400",
    "94": "text-blue-400",
    "95": "text-purple-400",
    "96": "text-cyan-400",
    "97": "text-white",
    "1": "font-bold",
    "0": ""
  }

  // Simple regex to match ANSI escape codes
  const ansiRegex = /\x1b\[([0-9;]+)m/g
  let lastIndex = 0
  let match

  while ((match = ansiRegex.exec(text)) !== null) {
    // Push text before this match
    if (match.index > lastIndex) {
      buffer = text.slice(lastIndex, match.index)
      if (buffer) {
        segments.push({ text: buffer, className: currentClass })
      }
    }

    // Parse color / style codes
    const codes = match[1].split(";")
    const classes: string[] = currentClass ? currentClass.split(" ") : []
    for (const code of codes) {
      if (colorMap[code] !== undefined) {
        if (code === "0") {
          // Reset all styles
          classes.length = 0
        } else if (colorMap[code]) {
          classes.push(colorMap[code])
        }
      }
    }
    currentClass = classes.join(" ")

    lastIndex = ansiRegex.lastIndex
  }

  // Push remaining text
  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex), className: currentClass })
  }

  // If no ANSI codes found, return the whole text
  if (segments.length === 0) {
    segments.push({ text, className: "" })
  }

  return segments
}

// Format duration for display
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  const minutes = Math.floor(ms / 60000)
  const seconds = ((ms % 60000) / 1000).toFixed(0)
  return `${minutes}m ${seconds}s`
}

// Get command display name
function getCommandDisplay(exec: CommandExecution): string {
  const parts = [exec.commandId]
  if (exec.args?.length) {
    parts.push(...exec.args)
  }
  return parts.join(" ")
}

// Status indicator component
const StatusIndicator: FC<{ status: CommandExecution["status"]; exitCode?: number }> = ({
  status,
  exitCode
}) => {
  switch (status) {
    case "pending":
      return <Clock className="size-4 text-gray-400" />
    case "running":
      return <Loader2 className="size-4 text-blue-500 animate-spin" />
    case "complete":
      return exitCode === 0
        ? <CheckCircle2 className="size-4 text-green-500" />
        : <XCircle className="size-4 text-red-500" />
    case "error":
      return <XCircle className="size-4 text-red-500" />
    case "timeout":
      return <AlertTriangle className="size-4 text-yellow-500" />
    default:
      return null
  }
}

// Single execution output component
const ExecutionOutput: FC<{
  execution: CommandExecution
  collapsible: boolean
  defaultExpanded?: boolean
}> = ({ execution, collapsible, defaultExpanded = true }) => {
  const { t } = useTranslation("common")
  const [expanded, setExpanded] = useState(defaultExpanded)
  const [copied, setCopied] = useState(false)

  const hasOutput = execution.stdout || execution.stderr
  const output = useMemo(() => {
    const parts: string[] = []
    if (execution.stdout) parts.push(execution.stdout)
    if (execution.stderr) parts.push(execution.stderr)
    return parts.join("\n")
  }, [execution.stdout, execution.stderr])

  const parsedStdout = useMemo(
    () =>
      execution.stdout
        ? execution.stdout.split("\n").map((line) => parseAnsiColors(line))
        : [],
    [execution.stdout]
  )

  const copyOutput = async () => {
    if (!output) {
      return
    }

    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard API not available")
      }

      await navigator.clipboard.writeText(output)
      setCopied(true)
      message.success(t("copiedToClipboard", "Copied to clipboard"))
      setTimeout(() => setCopied(false), 2000)
      return
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[TerminalOutput] Clipboard write failed, attempting fallback", err)

      try {
        const textarea = document.createElement("textarea")
        textarea.value = output
        textarea.style.position = "fixed"
        textarea.style.opacity = "0"
        textarea.style.left = "-9999px"
        document.body.appendChild(textarea)
        textarea.focus()
        textarea.select()
        const ok = document.execCommand("copy")
        document.body.removeChild(textarea)

        if (ok) {
          setCopied(true)
          message.success(t("copiedToClipboard", "Copied to clipboard"))
          setTimeout(() => setCopied(false), 2000)
          return
        }
      } catch (fallbackErr) {
        // eslint-disable-next-line no-console
        console.error("[TerminalOutput] Fallback copy failed", fallbackErr)
      }

      setCopied(false)
      message.error(t("copyFailed", "Failed to copy"))
    }
  }

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => collapsible && setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 bg-gray-900 text-left hover:bg-gray-800 transition-colors"
        disabled={!collapsible}
      >
        {collapsible && (
          expanded
            ? <ChevronDown className="size-4 text-gray-400" />
            : <ChevronRight className="size-4 text-gray-400" />
        )}

        <StatusIndicator status={execution.status} exitCode={execution.exitCode} />

        <Terminal className="size-4 text-gray-400" />

        <span className="font-mono text-sm text-green-400 flex-1 truncate">
          $ {getCommandDisplay(execution)}
        </span>

        {execution.cwd && (
          <span className="text-xs text-gray-500 truncate max-w-[150px]">
            {execution.cwd}
          </span>
        )}

        {execution.status === "complete" && execution.exitCode !== undefined && (
          <span className={`text-xs px-1.5 py-0.5 rounded ${
            execution.exitCode === 0
              ? "bg-green-900/50 text-green-400"
              : "bg-red-900/50 text-red-400"
          }`}>
            exit {execution.exitCode}
          </span>
        )}

        {execution.durationMs !== undefined && (
          <span className="flex items-center gap-1 text-xs text-gray-500">
            <Clock className="size-3" />
            {formatDuration(execution.durationMs)}
          </span>
        )}
      </button>

      {/* Output */}
      {expanded && hasOutput && (
        <div className="relative bg-gray-950">
          {/* Copy button */}
          <button
            onClick={copyOutput}
            className="absolute top-2 right-2 p-1.5 rounded bg-gray-800 hover:bg-gray-700 transition-colors"
            title={t("copyOutput", "Copy output")}
          >
            {copied ? (
              <CheckCheck className="size-4 text-green-500" />
            ) : (
              <Copy className="size-4 text-gray-400" />
            )}
          </button>

          {/* stdout */}
          {parsedStdout.length > 0 && (
            <div className="p-3 font-mono text-sm overflow-x-auto">
              {parsedStdout.map((segments, idx) => (
                <div key={idx} className="whitespace-pre-wrap break-all">
                  {segments.map((segment, segIdx) => (
                    <span key={segIdx} className={segment.className}>
                      {segment.text}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* stderr */}
          {execution.stderr && (
            <div className="p-3 font-mono text-sm overflow-x-auto border-t border-gray-800 bg-red-950/30">
              <div className="text-xs text-red-400 mb-1 font-sans">stderr:</div>
              {execution.stderr.split("\n").map((line, idx) => (
                <div key={idx} className="text-red-400 whitespace-pre-wrap break-all">
                  {line}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Running indicator */}
      {execution.status === "running" && (
        <div className="px-3 py-2 bg-gray-950 border-t border-gray-800 flex items-center gap-2">
          <Loader2 className="size-4 text-blue-500 animate-spin" />
          <span className="text-sm text-gray-400">{t("running", "Running...")}</span>
        </div>
      )}

      {/* Pending indicator */}
      {execution.status === "pending" && (
        <div className="px-3 py-2 bg-gray-950 border-t border-gray-800 flex items-center gap-2">
          <Clock className="size-4 text-gray-500" />
          <span className="text-sm text-gray-500">{t("waitingApproval", "Waiting for approval...")}</span>
        </div>
      )}

      {/* Timeout message */}
      {execution.status === "timeout" && (
        <div className="px-3 py-2 bg-yellow-950/30 border-t border-yellow-800/50 flex items-center gap-2">
          <AlertTriangle className="size-4 text-yellow-500" />
          <span className="text-sm text-yellow-400">{t("commandTimedOut", "Command timed out")}</span>
        </div>
      )}
    </div>
  )
}

export const TerminalOutput: FC<TerminalOutputProps> = ({
  executions,
  className = "",
  autoScroll = true,
  collapsible = true,
  maxHeight = "400px"
}) => {
  const { t } = useTranslation("common")
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [executions, autoScroll])

  if (executions.length === 0) {
    return (
      <div className={`flex flex-col items-center justify-center h-32 text-gray-400 dark:text-gray-500 ${className}`}>
        <Terminal className="size-8 mb-2 opacity-50" />
        <span className="text-sm">{t("noCommands", "No commands executed yet")}</span>
      </div>
    )
  }

  return (
    <div
      ref={scrollRef}
      className={`space-y-2 overflow-y-auto ${className}`}
      style={{ maxHeight }}
    >
      {executions.map((exec, idx) => (
        <ExecutionOutput
          key={exec.id}
          execution={exec}
          collapsible={collapsible}
          defaultExpanded={idx === executions.length - 1} // Only expand last one by default
        />
      ))}
    </div>
  )
}

export default TerminalOutput
