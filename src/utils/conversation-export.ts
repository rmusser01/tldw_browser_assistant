/**
 * Conversation Export Utilities
 * Export conversations to JSON or Markdown format
 */

import { db } from "@/db/dexie/schema"
import type { Message } from "@/db/dexie/types"

export interface ExportedConversation {
  id: string
  title: string
  createdAt: string
  updatedAt?: string
  model?: string
  messages: ExportedMessage[]
}

export interface ExportedMessage {
  role: "user" | "assistant" | "system"
  content: string
  timestamp?: string
  model?: string
}

/**
 * Trigger a file download in the browser
 */
function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Sanitize filename for download
 */
function sanitizeFilename(name: string): string {
  return name
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, "_")
    .substring(0, 100)
}

/**
 * Get conversation data from IndexedDB
 */
async function getConversationData(
  historyId: string
): Promise<ExportedConversation | null> {
  try {
    const history = await db.chatHistories.get(historyId)
    if (!history) {
      console.warn(`Conversation not found: ${historyId}`)
      return null
    }

    const messages = await db.messages
      .where("history_id")
      .equals(historyId)
      .toArray()

    const exportedMessages: ExportedMessage[] = messages.map((msg: Message) => ({
      role: msg.role as "user" | "assistant" | "system",
      content: msg.content,
      timestamp: msg.createdAt
        ? new Date(msg.createdAt).toISOString()
        : undefined,
      model: msg.name
    }))

    return {
      id: historyId,
      title: history.title || "Untitled Conversation",
      createdAt: history.createdAt
        ? new Date(history.createdAt).toISOString()
        : new Date().toISOString(),
      model: history.model_id || undefined,
      messages: exportedMessages
    }
  } catch (error) {
    console.error("Error getting conversation data:", error)
    return null
  }
}

/**
 * Export conversation to JSON format
 */
export async function exportToJSON(historyId: string): Promise<boolean> {
  const data = await getConversationData(historyId)
  if (!data) {
    return false
  }

  const json = JSON.stringify(data, null, 2)
  const filename = `${sanitizeFilename(data.title)}_${Date.now()}.json`
  downloadFile(json, filename, "application/json")
  return true
}

/**
 * Export conversation to Markdown format
 */
export async function exportToMarkdown(historyId: string): Promise<boolean> {
  const data = await getConversationData(historyId)
  if (!data) {
    return false
  }

  const lines: string[] = []

  // Header
  lines.push(`# ${data.title}`)
  lines.push("")
  lines.push(`**Date:** ${new Date(data.createdAt).toLocaleDateString()}`)
  if (data.model) {
    lines.push(`**Model:** ${data.model}`)
  }
  lines.push("")
  lines.push("---")
  lines.push("")

  // Messages
  for (const msg of data.messages) {
    const roleLabel =
      msg.role === "user"
        ? "You"
        : msg.role === "assistant"
          ? "Assistant"
          : "System"

    lines.push(`## ${roleLabel}`)
    if (msg.timestamp) {
      lines.push(
        `*${new Date(msg.timestamp).toLocaleString()}*`
      )
    }
    lines.push("")
    lines.push(msg.content)
    lines.push("")
  }

  const markdown = lines.join("\n")
  const filename = `${sanitizeFilename(data.title)}_${Date.now()}.md`
  downloadFile(markdown, filename, "text/markdown")
  return true
}

/**
 * Export conversation by tab ID (convenience wrapper)
 * Looks up historyId from the tab and exports
 */
export async function exportTabToJSON(
  historyId: string | null
): Promise<boolean> {
  if (!historyId) {
    console.warn("No historyId provided for export")
    return false
  }
  return exportToJSON(historyId)
}

export async function exportTabToMarkdown(
  historyId: string | null
): Promise<boolean> {
  if (!historyId) {
    console.warn("No historyId provided for export")
    return false
  }
  return exportToMarkdown(historyId)
}
