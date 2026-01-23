import React from "react"
import { useTranslation } from "react-i18next"
import { Tabs, Empty } from "antd"
import {
  X,
  Clock,
  Hash,
  Cpu,
  Wrench,
  FileJson,
  ChevronRight,
  AlertCircle
} from "lucide-react"
import { useMessageOption } from "@/hooks/useMessageOption"
import { humanizeMilliseconds } from "@/utils/humanize-milliseconds"

type DebugPanelProps = {
  onClose: () => void
}

type TokenInfo = {
  prompt?: number | null
  completion?: number | null
  total?: number | null
}

const extractTokenInfo = (generationInfo: any): TokenInfo | null => {
  if (!generationInfo || typeof generationInfo !== "object") return null

  const toNumber = (value: unknown) =>
    typeof value === "number" && Number.isFinite(value) ? value : null

  const usage = generationInfo?.usage

  const prompt =
    toNumber(generationInfo.prompt_eval_count) ??
    toNumber(generationInfo.prompt_tokens) ??
    toNumber(generationInfo.input_tokens) ??
    toNumber(usage?.prompt_tokens) ??
    toNumber(usage?.input_tokens)

  const completion =
    toNumber(generationInfo.eval_count) ??
    toNumber(generationInfo.completion_tokens) ??
    toNumber(generationInfo.output_tokens) ??
    toNumber(usage?.completion_tokens) ??
    toNumber(usage?.output_tokens)

  const total =
    toNumber(generationInfo.total_tokens) ??
    toNumber(generationInfo.total_token_count) ??
    toNumber(usage?.total_tokens) ??
    (prompt != null && completion != null ? prompt + completion : null)

  if (total == null && prompt == null && completion == null) return null

  return { prompt, completion, total }
}

/**
 * DebugPanel - Developer debug information panel
 *
 * Shows:
 * - Token counts per message
 * - Timing information
 * - Tool call traces
 * - Raw generation info
 */
export const DebugPanel: React.FC<DebugPanelProps> = ({ onClose }) => {
  const { t } = useTranslation(["playground", "common"])
  const { messages, actionInfo } = useMessageOption({
    forceCompareEnabled: true
  })

  const toolTraces = React.useMemo(() => {
    const traces: Array<{ tool: string; status?: string; input?: unknown }> = []
    messages.forEach((msg) => {
      const toolCalls =
        (msg as any)?.generationInfo?.tool_calls ??
        (msg as any)?.generationInfo?.toolCalls
      if (Array.isArray(toolCalls)) {
        toolCalls.forEach((call: any) => {
          const fn = call.function || {}
          traces.push({
            tool: fn.name || call.name || "Unknown Tool",
            status: call.status,
            input: fn.arguments ?? call.input
          })
        })
      }
    })
    return traces
  }, [messages])

  // Extract debug info from messages
  const debugInfo = React.useMemo(() => {
    const assistantMessages = messages.filter((m) => m.isBot)
    return assistantMessages.map((msg, idx) => ({
      index: idx,
      id: msg.id,
      modelName: msg.modelName || msg.name || "Unknown",
      tokens: extractTokenInfo(msg.generationInfo),
      latency: msg.reasoning_time_taken,
      generationInfo: msg.generationInfo,
      hasToolCalls: Boolean(msg.documents?.length)
    }))
  }, [messages])

  // Calculate totals
  const totals = React.useMemo(() => {
    let promptTokens = 0
    let completionTokens = 0
    let totalLatency = 0

    debugInfo.forEach((info) => {
      if (info.tokens?.prompt) promptTokens += info.tokens.prompt
      if (info.tokens?.completion) completionTokens += info.tokens.completion
      if (info.latency) totalLatency += info.latency
    })

    return {
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      totalLatency,
      messageCount: debugInfo.length
    }
  }, [debugInfo])

  const tabItems = [
    {
      key: "overview",
      label: (
        <span className="flex items-center gap-1.5 text-xs">
          <Cpu className="h-3.5 w-3.5" />
          {t("playground:debug.overview", "Overview")}
        </span>
      ),
      children: (
        <div className="p-3">
          {debugInfo.length === 0 ? (
            <Empty
              description={t(
                "playground:debug.noMessages",
                "No assistant messages yet"
              )}
              className="py-4"
            />
          ) : (
            <div className="space-y-4">
              {/* Summary stats */}
              <div className="grid grid-cols-4 gap-3">
                <div className="rounded-lg border border-border bg-surface2/50 p-3">
                  <div className="text-[10px] uppercase tracking-wide text-text-muted">
                    {t("playground:debug.messages", "Messages")}
                  </div>
                  <div className="mt-1 text-lg font-semibold text-text">
                    {totals.messageCount}
                  </div>
                </div>
                <div className="rounded-lg border border-border bg-surface2/50 p-3">
                  <div className="text-[10px] uppercase tracking-wide text-text-muted">
                    {t("playground:debug.promptTokens", "Prompt Tokens")}
                  </div>
                  <div className="mt-1 text-lg font-semibold text-text">
                    {totals.promptTokens.toLocaleString()}
                  </div>
                </div>
                <div className="rounded-lg border border-border bg-surface2/50 p-3">
                  <div className="text-[10px] uppercase tracking-wide text-text-muted">
                    {t("playground:debug.completionTokens", "Completion Tokens")}
                  </div>
                  <div className="mt-1 text-lg font-semibold text-text">
                    {totals.completionTokens.toLocaleString()}
                  </div>
                </div>
                <div className="rounded-lg border border-border bg-surface2/50 p-3">
                  <div className="text-[10px] uppercase tracking-wide text-text-muted">
                    {t("playground:debug.totalLatency", "Total Latency")}
                  </div>
                  <div className="mt-1 text-lg font-semibold text-text">
                    {humanizeMilliseconds(totals.totalLatency)}
                  </div>
                </div>
              </div>

              {/* Per-message breakdown */}
              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
                  {t("playground:debug.perMessage", "Per Message Breakdown")}
                </h4>
                <div className="max-h-32 space-y-1 overflow-y-auto">
                  {debugInfo.map((info) => (
                    <div
                      key={info.id || info.index}
                      className="flex items-center justify-between rounded border border-border bg-surface px-3 py-2 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-text">{info.modelName}</span>
                        {info.hasToolCalls && (
                          <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
                            <Wrench className="mr-0.5 inline h-3 w-3" />
                            Tools
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-text-muted">
                        {info.tokens && (
                          <span className="flex items-center gap-1">
                            <Hash className="h-3 w-3" />
                            {info.tokens.total?.toLocaleString() || "—"}
                          </span>
                        )}
                        {info.latency && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {humanizeMilliseconds(info.latency)}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )
    },
    {
      key: "traces",
      label: (
        <span className="flex items-center gap-1.5 text-xs">
          <Wrench className="h-3.5 w-3.5" />
          {t("playground:debug.toolTraces", "Tool Traces")}
        </span>
      ),
      children: (
        <div className="p-3">
          {toolTraces.length > 0 ? (
            <div className="space-y-2">
              {toolTraces.map((action, idx: number) => (
                <div
                  key={idx}
                  className="rounded border border-border bg-surface p-2 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <ChevronRight className="h-3 w-3 text-primary" />
                    <span className="font-medium text-text">
                      {action.tool || "Unknown Tool"}
                    </span>
                    {action.status === "error" && (
                      <AlertCircle className="h-3 w-3 text-danger" />
                    )}
                  </div>
                  {action.input && (
                    <pre className="mt-1 max-h-20 overflow-auto rounded bg-surface2 p-2 text-[10px] text-text-muted">
                      {typeof action.input === "string"
                        ? action.input
                        : JSON.stringify(action.input, null, 2)}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          ) : actionInfo ? (
            <div className="text-xs text-text-muted">{actionInfo}</div>
          ) : (
            <Empty
              description={t("playground:debug.noToolCalls", "No tool calls recorded")}
              className="py-4"
            />
          )}
        </div>
      )
    },
    {
      key: "raw",
      label: (
        <span className="flex items-center gap-1.5 text-xs">
          <FileJson className="h-3.5 w-3.5" />
          {t("playground:debug.rawData", "Raw Data")}
        </span>
      ),
      children: (
        <div className="p-3">
          {debugInfo.length === 0 ? (
            <Empty
              description={t("playground:debug.noData", "No data available")}
              className="py-4"
            />
          ) : (
            <div className="max-h-40 overflow-auto">
              <pre className="rounded bg-surface2 p-3 text-[10px] text-text-muted">
                {JSON.stringify(
                  debugInfo.map((d) => ({
                    model: d.modelName,
                    tokens: d.tokens,
                    latency: d.latency,
                    generationInfo: d.generationInfo
                  })),
                  null,
                  2
                )}
              </pre>
            </div>
          )}
        </div>
      )
    }
  ]

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-text">
          <Cpu className="h-4 w-4 text-primary" />
          {t("playground:debug.title", "Debug Panel")}
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-text-muted transition-colors hover:bg-surface2 hover:text-text"
          aria-label={t("common:close", "Close")}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <Tabs
          items={tabItems}
          size="small"
          className="workspace-debug-tabs h-full"
          tabBarStyle={{ marginBottom: 0, paddingLeft: 12 }}
        />
      </div>
    </div>
  )
}
