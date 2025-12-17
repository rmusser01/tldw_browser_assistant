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
  Settings
} from "lucide-react"
import { useStorage } from "@plasmohq/storage/hook"

import {
  WorkspaceSelector,
  ToolCallLog,
  DiffViewer,
  ApprovalBanner,
  TerminalOutput,
  AgentErrorBoundary,
  parseDiff
} from "@/components/Agent"
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
  const chatContainerRef = useRef<HTMLDivElement>(null)

  // Cleanup agent on unmount
  useEffect(() => {
    return () => {
      if (agentRef.current) {
        agentRef.current.cancel()
        agentRef.current = null
      }
    }
  }, [])

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
              id: event.tool_call_id,
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
        break

      case "complete":
        setIsRunning(false)
        agentRef.current = null
        if (event.result.status === "complete") {
          message.success(t("agentComplete", "Agent completed successfully"))
        } else if (event.result.status === "max_steps_reached") {
          message.warning(t("agentMaxSteps", "Agent reached maximum steps"))
        }
        break

      case "error":
        setIsRunning(false)
        agentRef.current = null
        message.error(event.error)
        break
    }
  }, [toolCalls, t])

  // Start agent
  const handleSubmit = useCallback(async () => {
    if (!inputValue.trim() || !workspace) {
      if (!workspace) {
        message.warning(t("selectWorkspaceFirst", "Please select a workspace first"))
      }
      return
    }

    const task = inputValue.trim()
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
                  className={`max-w-[80%] rounded-lg px-4 py-2 ${
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
            <span className="px-1.5 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-gray-800">
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
      <div className="flex flex-col h-dvh bg-white dark:bg-[#171717]">
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
            className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
            title={t("settings", "Settings")}
          >
            <Settings className="size-4 text-gray-500" />
          </button>
        </div>
      </div>

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
      </div>
    </AgentErrorBoundary>
  )
}

export default SidepanelAgent
