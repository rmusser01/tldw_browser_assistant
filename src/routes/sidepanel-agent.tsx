/**
 * Sidepanel Agent Page
 *
 * Main agent interface integrating workspace selection, chat, diffs, and terminal
 */

import { FC, useState, useRef, useEffect, useCallback, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { Tabs, Input, Button, message } from "antd"
import {
  MessageSquare,
  FileCode,
  Terminal as TerminalIcon,
  Send,
  Square,
  Loader2,
  Settings,
  History,
  X
} from "lucide-react"
import { useStorage } from "@plasmohq/storage/hook"

import {
  WorkspaceSelector,
  ToolCallLog,
  DiffViewer,
  ApprovalBanner,
  TerminalOutput,
  AgentErrorBoundary,
  SessionHistoryPanel,
  SessionRestoreDialog,
  parseDiff
} from "@/components/Agent"
import { useSessionPersistence } from "@/hooks/useSessionPersistence"
import { useAutoButtonTitles } from "@/hooks/useAutoButtonTitles"
import type { SessionSaveInput } from "@/services/agent/storage"
import { sessionToRestoreOutput, generateSessionId } from "@/services/agent/storage"
import type {
  Workspace,
  ToolCallEntry,
  FileDiff,
  CommandExecution
} from "@/components/Agent"
import { AgentLoop } from "@/services/agent/agent-loop"
import type {
  AgentEvent,
  AgentSettings,
  PendingApproval,
  ToolCall
} from "@/services/agent/types"
import { DEFAULT_AGENT_SETTINGS } from "@/services/agent/types"

const { TextArea } = Input

type TabKey = "chat" | "diff" | "terminal"

const SidepanelAgent: FC = () => {
  useAutoButtonTitles()
  const { t } = useTranslation(["common", "sidepanel"])

  // Workspace state
  const [workspace, setWorkspace] = useState<Workspace | null>(null)

  // Agent settings
  const [settings] = useStorage<AgentSettings>("agent:settings", DEFAULT_AGENT_SETTINGS)

  // Agent loop state
  const agentRef = useRef<AgentLoop | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)

  // Chat state
  const [inputValue, setInputValue] = useState("")
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([])
  const [streamingContent, setStreamingContent] = useState("")

  // Tool call state
  const [toolCalls, setToolCalls] = useState<ToolCallEntry[]>([])
  const [expandedToolIds, setExpandedToolIds] = useState<Set<string>>(new Set())

  // Approval state
  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([])
  const [approvalExpanded, setApprovalExpanded] = useState(false)

  // Diff state
  const [diffs, setDiffs] = useState<FileDiff[]>([])
  const [selectedHunks, setSelectedHunks] = useState<Set<string>>(new Set())

  // Terminal state
  const [executions, setExecutions] = useState<CommandExecution[]>([])

  // UI state
  const [activeTab, setActiveTab] = useState<TabKey>("chat")
  const [showHistory, setShowHistory] = useState(false)
  const [showRestoreDialog, setShowRestoreDialog] = useState(false)
  const chatContainerRef = useRef<HTMLDivElement>(null)

  // Track current task for session saving
  const currentTaskRef = useRef<string>("")

  // Session persistence
  const {
    sessions,
    isLoading: sessionsLoading,
    restorableSession,
    saveCurrentSession,
    saveCurrentSessionImmediate,
    loadSession,
    deleteSession: deleteStoredSession,
    clearAllSessions,
    dismissRestorableSession,
  } = useSessionPersistence(workspace?.id || null)

  // Cleanup agent on unmount
  useEffect(() => {
    return () => {
      if (agentRef.current) {
        agentRef.current.cancel()
        agentRef.current = null
      }
    }
  }, [])

  // Show restore dialog when restorable session exists
  useEffect(() => {
    if (restorableSession && !isRunning) {
      setShowRestoreDialog(true)
    }
  }, [restorableSession, isRunning])

  // Build session input for saving
  const buildSessionInput = useCallback((): SessionSaveInput | null => {
    if (!workspace) return null
    return {
      workspaceId: workspace.id,
      task: currentTaskRef.current,
      status: "running",
      currentStep,
      messages,
      toolCalls: toolCalls.map(tc => ({
        id: tc.id,
        toolCall: tc.toolCall,
        status: tc.status,
        result: tc.result,
        error: tc.error,
        timestamp: tc.timestamp
      })),
      pendingApprovals: pendingApprovals.map(pa => ({
        toolCallId: pa.toolCallId,
        toolName: pa.toolName,
        args: pa.args,
        tier: pa.tier,
        status: pa.status
      })),
      diffs: diffs.map(d => ({
        path: d.newPath || d.oldPath,
        type: d.isNew ? "create" : d.isDeleted ? "delete" : "modify",
        hunks: d.hunks.map(h => ({
          oldStart: h.oldStart,
          oldLines: h.oldCount,
          newStart: h.newStart,
          newLines: h.newCount,
          lines: h.lines.map(line => {
            switch (line.type) {
              case "header":
                return line.content
              case "add":
                return `+${line.content}`
              case "remove":
                return `-${line.content}`
              case "context":
              default:
                return ` ${line.content}`
            }
          })
        }))
      })),
      executions: executions.map(e => ({
        id: e.id,
        commandId: e.commandId,
        status: e.status,
        exitCode: e.exitCode,
        stdout: e.stdout,
        stderr: e.stderr,
        timestamp: e.timestamp
      }))
    }
  }, [workspace, currentStep, messages, toolCalls, pendingApprovals, diffs, executions])

  // Auto-scroll chat
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
    }
  }, [messages, streamingContent, toolCalls])

  // Handle agent events
  const handleAgentEvent = useCallback((event: AgentEvent) => {
    switch (event.type) {
      case "step_start":
        setCurrentStep(event.step)
        break

      case "llm_chunk":
        setStreamingContent(prev => prev + event.content)
        break

      case "llm_complete":
        if (event.content) {
          setMessages(prev => [...prev, { role: "assistant", content: event.content }])
        }
        setStreamingContent("")
        break

      case "tool_start":
        setToolCalls(prev => [
          ...prev,
          {
            id: event.tool_call.id,
            toolCall: event.tool_call,
            status: "running",
            timestamp: new Date()
          }
        ])
        break

      case "tool_complete":
        setToolCalls(prev =>
          prev.map(tc =>
            tc.id === event.tool_call_id
              ? {
                  ...tc,
                  status: event.result?.ok === false ? "error" : "complete",
                  result: event.result,
                  error: event.result?.error
                }
              : tc
          )
        )

        // Debounced auto-save during execution
        {
          const input = buildSessionInput()
          if (input) {
            saveCurrentSession({ ...input, status: "running" })
          }
        }

        // Handle patch results - extract diffs for review
        const tcEntry = toolCalls.find(tc => tc.id === event.tool_call_id)
        if (tcEntry?.toolCall.function.name === "fs_apply_patch") {
          try {
            const args = JSON.parse(tcEntry.toolCall.function.arguments || "{}")
            if (args.patch) {
              const parsedDiffs = parseDiff(args.patch)
              setDiffs(prev => [...prev, ...parsedDiffs])
              setSelectedHunks(prev => {
                const next = new Set(prev)
                parsedDiffs.forEach(d => d.hunks.forEach(h => next.add(h.id)))
                return next
              })
            }
          } catch {
            // Ignore parse errors
          }
        }

        // Handle exec results
        if (tcEntry?.toolCall.function.name === "exec_run") {
          const result = event.result
          setExecutions(prev => [
            ...prev,
            {
              // Use a locally generated UUID for execution IDs to avoid relying
              // on tool_call_id uniqueness across providers or sessions.
              id: generateSessionId(),
              commandId: JSON.parse(tcEntry.toolCall.function.arguments || "{}").command_id || "",
              args: JSON.parse(tcEntry.toolCall.function.arguments || "{}").args,
              cwd: JSON.parse(tcEntry.toolCall.function.arguments || "{}").cwd,
              status: result?.ok ? "complete" : "error",
              exitCode: result?.data?.exit_code,
              stdout: result?.data?.stdout,
              stderr: result?.data?.stderr,
              durationMs: result?.data?.duration_ms,
              timestamp: new Date()
            }
          ])
        }
        break

      case "approval_needed":
        setPendingApprovals(event.approvals)
        setApprovalExpanded(true)

        // Immediate save - user may close browser while waiting for approval
        {
          const input = buildSessionInput()
          if (input) {
            saveCurrentSessionImmediate({ ...input, status: "waiting_approval" })
              .catch(err => console.error("Failed to save session on approval_needed:", err))
          }
        }
        break

      case "complete":
        setIsRunning(false)
        agentRef.current = null
        if (event.result.status === "complete") {
          message.success(t("agentComplete", "Agent completed successfully"))
        } else if (event.result.status === "max_steps_reached") {
          message.warning(t("agentMaxSteps", "Agent reached maximum steps"))
        }

        // Save final session state
        {
          const input = buildSessionInput()
          if (input) {
            const finalStatus = event.result.status === "cancelled" ? "cancelled" : "complete"
            saveCurrentSessionImmediate({ ...input, status: finalStatus })
              .catch(err => console.error("Failed to save session on complete:", err))
          }
        }
        break

      case "error":
        setIsRunning(false)
        agentRef.current = null
        message.error(event.error)

        // Save error state
        {
          const input = buildSessionInput()
          if (input) {
            saveCurrentSessionImmediate({ ...input, status: "error" })
              .catch(err => console.error("Failed to save session on error:", err))
          }
        }
        break
    }
  }, [toolCalls, t, buildSessionInput, saveCurrentSession, saveCurrentSessionImmediate])

  // Start agent
  const handleSubmit = useCallback(async () => {
    if (!inputValue.trim() || !workspace) {
      if (!workspace) {
        message.warning(t("selectWorkspaceFirst", "Please select a workspace first"))
      }
      return
    }

    const task = inputValue.trim()
    currentTaskRef.current = task
    setInputValue("")
    setMessages(prev => [...prev, { role: "user", content: task }])
    setToolCalls([])
    setDiffs([])
    setExecutions([])
    setPendingApprovals([])
    setIsRunning(true)
    setCurrentStep(0)

    const agent = new AgentLoop(workspace.id, task, settings || DEFAULT_AGENT_SETTINGS, handleAgentEvent)
    agentRef.current = agent

    await agent.run()
  }, [inputValue, workspace, settings, handleAgentEvent, t])

  // Restore session from history
  const handleRestoreSession = useCallback(async (sessionId: string) => {
    const session = await loadSession(sessionId)
    if (!session) {
      message.error(t("failedToLoadSession", "Failed to load session"))
      return
    }

    const restored = sessionToRestoreOutput(session)
    currentTaskRef.current = session.task
    setMessages(restored.messages)
    setToolCalls(restored.toolCalls)
    setPendingApprovals(restored.pendingApprovals)
    setDiffs(restored.diffs.map((d, i) => ({
      id: `restored-${i}`,
      oldPath: d.path,
      newPath: d.path,
      hunks: [],
      isNew: d.type === "create",
      isDeleted: d.type === "delete",
    })))
    setExecutions(restored.executions)
    setCurrentStep(session.currentStep)
    setShowHistory(false)

    message.success(t("sessionRestored", "Session restored"))
  }, [loadSession, t])

  // Handle restore dialog actions
  const handleRestoreFromDialog = useCallback(async () => {
    if (restorableSession) {
      await handleRestoreSession(restorableSession.id)
      setShowRestoreDialog(false)
    }
  }, [restorableSession, handleRestoreSession])

  const handleStartFresh = useCallback(async () => {
    await dismissRestorableSession()
    setShowRestoreDialog(false)
  }, [dismissRestorableSession])

  // Cancel agent
  const handleCancel = useCallback(() => {
    if (agentRef.current) {
      agentRef.current.cancel()
      setIsRunning(false)
      message.info(t("agentCancelled", "Agent cancelled"))
    }
  }, [t])

  // Handle approvals
  const handleApprove = useCallback((ids: string[]) => {
    if (agentRef.current) {
      agentRef.current.approvePending(ids)
      setPendingApprovals(prev => prev.filter(a => !ids.includes(a.toolCallId)))
    }
  }, [])

  const handleReject = useCallback((ids: string[]) => {
    if (agentRef.current) {
      agentRef.current.rejectPending(ids)
      setPendingApprovals(prev => prev.filter(a => !ids.includes(a.toolCallId)))
    }
  }, [])

  // Toggle tool expansion
  const toggleToolExpand = useCallback((id: string) => {
    setExpandedToolIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  // Tab items
  const tabItems = useMemo(() => [
    {
      key: "chat" as TabKey,
      label: (
        <span className="flex items-center gap-1.5">
          <MessageSquare className="size-4" />
          {t("chat", "Chat")}
        </span>
      ),
      children: (
        <div className="flex flex-col h-full">
          {/* Chat messages */}
          <div
            ref={chatContainerRef}
            className="flex-1 overflow-y-auto space-y-4 p-4"
          >
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  tabIndex={0}
                  role="article"
                  aria-label={`${msg.role === "user" ? t("userMessage", "Your message") : t("assistantMessage", "Assistant message")}: ${msg.content.substring(0, 50)}${msg.content.length > 50 ? "..." : ""}`}
                  className={`max-w-[80%] rounded-lg px-4 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-500 ${
                    msg.role === "user"
                      ? "bg-blue-500 text-white"
                      : "bg-gray-100 dark:bg-gray-800"
                  }`}
                >
                  <pre className="whitespace-pre-wrap font-sans text-sm">
                    {msg.content}
                  </pre>
                </div>
              </div>
            ))}

            {/* Streaming content */}
            {streamingContent && (
              <div className="flex justify-start">
                <div className="max-w-[80%] rounded-lg px-4 py-2 bg-gray-100 dark:bg-gray-800">
                  <pre className="whitespace-pre-wrap font-sans text-sm">
                    {streamingContent}
                  </pre>
                </div>
              </div>
            )}

            {/* Tool calls */}
            {toolCalls.length > 0 && (
              <div className="mt-4">
                <h3 className="text-sm font-medium text-gray-500 mb-2">
                  {t("toolCalls", "Tool Calls")} ({toolCalls.length})
                </h3>
                <ToolCallLog
                  entries={toolCalls}
                  expandedIds={expandedToolIds}
                  onToggleExpand={toggleToolExpand}
                  className="max-h-64"
                />
              </div>
            )}
          </div>
        </div>
      )
    },
    {
      key: "diff" as TabKey,
      label: (
        <span className="flex items-center gap-1.5">
          <FileCode className="size-4" />
          {t("diff", "Diff")}
          {diffs.length > 0 && (
            <span className="px-1.5 py-0.5 text-xs rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300">
              {diffs.length}
            </span>
          )}
        </span>
      ),
      children: (
        <div className="p-4 overflow-y-auto h-full">
          {diffs.length > 0 && diffs.every(d => d.hunks.length === 0) && (
            <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
              {t("diffMetadataOnly", "Diff content not stored; showing metadata only")}
            </p>
          )}
          <DiffViewer
            diffs={diffs}
            selectedHunks={selectedHunks}
            onHunkSelectionChange={setSelectedHunks}
          />
        </div>
      )
    },
    {
      key: "terminal" as TabKey,
      label: (
        <span className="flex items-center gap-1.5">
          <TerminalIcon className="size-4" />
          {t("terminal", "Terminal")}
          {executions.length > 0 && (
            <span className="px-1.5 py-0.5 text-xs rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300">
              {executions.length}
            </span>
          )}
        </span>
      ),
      children: (
        <div className="p-4 overflow-y-auto h-full">
          <TerminalOutput executions={executions} />
        </div>
      )
    }
  ], [messages, streamingContent, toolCalls, expandedToolIds, toggleToolExpand, diffs, selectedHunks, executions, t])

  return (
    <AgentErrorBoundary
      fallbackMessage={t("agentError", "Agent encountered an error")}
      onReset={() => {
        setIsRunning(false)
        setMessages([])
        setToolCalls([])
        setDiffs([])
        setExecutions([])
        setPendingApprovals([])
        setStreamingContent("")
        agentRef.current = null
      }}
    >
      <div className="relative flex flex-col h-dvh bg-white dark:bg-surface">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700">
        <WorkspaceSelector
          onWorkspaceChange={setWorkspace}
          className="flex-1 max-w-[250px]"
        />

        <div className="flex items-center gap-2">
          {isRunning && (
            <span className="flex items-center gap-1.5 text-sm text-blue-500">
              <Loader2 className="size-4 animate-spin" />
              {t("step", "Step")} {currentStep}
            </span>
          )}
          <button
            className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-500"
            onClick={() => setShowHistory(!showHistory)}
            title={t("sessionHistory", "Session History")}
            aria-label={t("sessionHistory", "Session History")}
            aria-expanded={showHistory}
          >
            <History className="size-4 text-gray-500" />
          </button>
          <button
            className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-500"
            title={t("settings", "Settings")}
            aria-label={t("settings", "Settings")}
          >
            <Settings className="size-4 text-gray-500" />
          </button>
        </div>
      </div>

      {/* Session History Panel (slide-out) */}
      {showHistory && (
        <div className="absolute right-0 top-0 bottom-0 w-80 bg-white dark:bg-surface border-l border-gray-200 dark:border-gray-700 z-50 flex flex-col shadow-xl">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <h2 className="font-semibold">{t("sessionHistory", "Session History")}</h2>
            <button
              onClick={() => setShowHistory(false)}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-500"
              aria-label={t("close", "Close")}
              title={t("close", "Close")}
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <SessionHistoryPanel
              sessions={sessions}
              isLoading={sessionsLoading}
              onRestore={handleRestoreSession}
              onDelete={deleteStoredSession}
              onClearAll={clearAllSessions}
            />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 overflow-hidden">
        <Tabs
          activeKey={activeTab}
          onChange={(key) => setActiveTab(key as TabKey)}
          items={tabItems}
          className="h-full [&_.ant-tabs-content]:h-[calc(100%-46px)] [&_.ant-tabs-tabpane]:h-full"
        />
      </div>

      {/* Approval banner */}
      {pendingApprovals.length > 0 && (
        <ApprovalBanner
          approvals={pendingApprovals}
          onApprove={handleApprove}
          onReject={handleReject}
          onViewDetails={() => setActiveTab("diff")}
          expanded={approvalExpanded}
          onToggleExpanded={() => setApprovalExpanded(!approvalExpanded)}
        />
      )}

      {/* Input area */}
      <div className="border-t border-gray-200 dark:border-gray-700 p-4">
        <div className="flex gap-2">
          <TextArea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={
              workspace
                ? t("askAgent", "Ask the agent to help with your code...")
                : t("selectWorkspace", "Select a workspace to get started")
            }
            disabled={!workspace || isRunning}
            autoSize={{ minRows: 1, maxRows: 4 }}
            onPressEnter={(e) => {
              if (!e.shiftKey) {
                e.preventDefault()
                handleSubmit()
              }
            }}
            className="flex-1"
          />

          {isRunning ? (
            <Button
              type="primary"
              danger
              icon={<Square className="size-4" />}
              onClick={handleCancel}
            >
              {t("stop", "Stop")}
            </Button>
          ) : (
            <Button
              type="primary"
              icon={<Send className="size-4" />}
              onClick={handleSubmit}
              disabled={!workspace || !inputValue.trim()}
            >
              {t("send", "Send")}
            </Button>
          )}
        </div>
      </div>

      {/* Session Restore Dialog */}
      <SessionRestoreDialog
        session={restorableSession}
        open={showRestoreDialog}
        onRestore={handleRestoreFromDialog}
        onStartFresh={handleStartFresh}
        onCancel={() => setShowRestoreDialog(false)}
      />
      </div>
    </AgentErrorBoundary>
  )
}

export default SidepanelAgent
