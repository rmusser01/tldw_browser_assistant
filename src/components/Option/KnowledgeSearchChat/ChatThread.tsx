import React from "react"
import { useTranslation } from "react-i18next"
import { Spin } from "antd"
import { Send, X, MessageSquare, User, Bot } from "lucide-react"
import { apiSend } from "@/services/api-send"

type RagResult = {
  id?: string
  content?: string
  text?: string
  chunk?: string
  metadata?: {
    title?: string
    source?: string
    url?: string
    [key: string]: any
  }
}

type ChatMessage = {
  role: "user" | "assistant"
  content: string
}

type ChatThreadProps = {
  context: RagResult
  onClose: () => void
}

/**
 * ChatThread - Follow-up chat about a specific knowledge source
 *
 * Allows users to ask questions about a specific document/source
 * from the knowledge search results.
 */
export const ChatThread: React.FC<ChatThreadProps> = ({ context, onClose }) => {
  const { t } = useTranslation(["knowledge", "common"])
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  const messagesEndRef = React.useRef<HTMLDivElement>(null)

  const [messages, setMessages] = React.useState<ChatMessage[]>([])
  const [input, setInput] = React.useState("")
  const [loading, setLoading] = React.useState(false)

  const contextContent = context.content || context.text || context.chunk || ""
  const contextTitle =
    context.metadata?.title ||
    context.metadata?.source ||
    t("knowledge:chat.untitledSource", "Selected source")

  // Auto-scroll to bottom when new messages arrive
  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleSend = async () => {
    const q = input.trim()
    if (!q || loading) return

    const userMessage: ChatMessage = { role: "user", content: q }
    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setLoading(true)

    try {
      // Build context-aware prompt
      const systemContext = `You are answering questions about the following document excerpt:\n\n---\nTitle: ${contextTitle}\n\n${contextContent.slice(0, 2000)}\n---\n\nAnswer questions specifically about this content. If the question cannot be answered from this content, say so.`

      const response = await apiSend({
        path: "/api/v1/chat/completions",
        method: "POST",
        body: {
          messages: [
            { role: "system", content: systemContext },
            ...messages.map((m) => ({ role: m.role, content: m.content })),
            { role: "user", content: q }
          ]
        }
      })

      const assistantContent =
        response?.data?.choices?.[0]?.message?.content ||
        response?.data?.message?.content ||
        response?.data?.content ||
        t("knowledge:chat.noResponse", "No response received")

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: String(assistantContent) }
      ])
    } catch (e: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: t(
            "knowledge:chat.error",
            "Sorry, I encountered an error. Please try again."
          )
        }
      ])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-text">
            {t("knowledge:chat.title", "Ask about this source")}
          </span>
          <span className="text-xs text-text-muted">({contextTitle})</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1 text-text-muted transition-colors hover:bg-surface2 hover:text-text"
          aria-label={t("common:close", "Close")}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Context preview */}
      <div className="border-b border-border bg-surface2/50 px-4 py-2">
        <p className="text-xs text-text-muted line-clamp-2">
          {contextContent.slice(0, 200)}...
        </p>
      </div>

      {/* Messages */}
      <div className="max-h-80 min-h-40 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="py-8 text-center text-sm text-text-muted">
            {t(
              "knowledge:chat.hint",
              "Ask a question about this source to start a conversation"
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex gap-3 ${
                  msg.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                {msg.role === "assistant" && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-2 text-sm ${
                    msg.role === "user"
                      ? "bg-primary text-white"
                      : "bg-surface2 text-text"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
                {msg.role === "user" && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface2">
                    <User className="h-4 w-4 text-text-muted" />
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
                <div className="rounded-lg bg-surface2 px-4 py-2">
                  <Spin size="small" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-border p-4">
        <div className="flex gap-3">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t(
              "knowledge:chat.placeholder",
              "Ask a follow-up question..."
            )}
            rows={1}
            className="min-h-[40px] max-h-24 flex-1 resize-none rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="rounded-lg bg-primary px-4 py-2 text-white transition-colors hover:bg-primaryStrong disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
