import { type ChatHistory, type Message } from "~/store/option"
import {
  deleteChatForEdit,
  formatToChatHistory,
  formatToMessage,
  saveHistory,
  saveMessage,
  updateMessageByIndex
} from "@/db/dexie/helpers"
import { generateBranchMessage } from "@/db/dexie/branch"
import { getPromptById, getSessionFiles, UploadedFile } from "@/db"
import { tldwClient, type ConversationState } from "@/services/tldw/TldwApiClient"
import { notification } from "antd"

export const createRegenerateLastMessage = ({
  validateBeforeSubmitFn,
  history,
  messages,
  setHistory,
  setMessages,
  onSubmit
}: {
  validateBeforeSubmitFn: () => boolean
  history: ChatHistory
  messages: Message[]
  setHistory: (history: ChatHistory) => void
  setMessages: (messages: Message[]) => void
  onSubmit: (params: any) => Promise<void>
}) => {
  return async () => {
    const isOk = validateBeforeSubmitFn()

    if (!isOk) {
      return
    }
    if (history.length > 0) {
      const lastMessage = history[history.length - 2]
      const lastAssistant = messages[messages.length - 1]
      if (!lastAssistant || !lastAssistant.isBot) {
        return
      }
      let newHistory = history.slice(0, -2)
      const mewMessages = messages.slice(0, -1)
      setHistory(newHistory)
      setMessages(mewMessages)
      if (lastMessage.role === "user") {
        const newController = new AbortController()
        await onSubmit({
          message: lastMessage.content,
          image: lastMessage.image || "",
          isRegenerate: true,
          memory: newHistory,
          controller: newController,
          regenerateFromMessage: lastAssistant
        })
      }
    }
  }
}

export const createEditMessage = ({
  messages,
  history,
  setMessages,
  setHistory,
  historyId,
  validateBeforeSubmitFn,
  onSubmit
}: {
  messages: Message[]
  history: ChatHistory
  setMessages: (messages: Message[]) => void
  setHistory: (history: ChatHistory) => void
  historyId: string | null
  validateBeforeSubmitFn: () => boolean
  onSubmit: (params: any) => Promise<void>
}) => {
  return async (
    index: number,
    message: string,
    isHuman: boolean,
    isSend: boolean
  ) => {
    const newHistory = history

    // if human message and send then only trigger the submit
    if (isHuman && isSend) {
      const isOk = validateBeforeSubmitFn()

      if (!isOk) {
        return
      }

      const currentHumanMessage = messages[index]
      const updatedMessages = messages.map((msg, idx) =>
        idx === index ? { ...msg, message } : msg
      )
      const previousMessages = updatedMessages.slice(0, index + 1)
      setMessages(previousMessages)
      const previousHistory = newHistory.slice(0, index)
      setHistory(previousHistory)
      await updateMessageByIndex(historyId, index, message)
      await deleteChatForEdit(historyId, index)
      const abortController = new AbortController()
      await onSubmit({
        message: message,
        image: currentHumanMessage.images[0] || "",
        isRegenerate: true,
        messages: previousMessages,
        memory: previousHistory,
        controller: abortController
      })
      return
    }
    const updatedMessages = messages.map((msg, idx) =>
      idx === index ? { ...msg, message } : msg
    )
    setMessages(updatedMessages)
    const updatedHistory = newHistory.map((item, idx) =>
      idx === index ? { ...item, content: message } : item
    )
    setHistory(updatedHistory)
    await updateMessageByIndex(historyId, index, message)
  }
}

export const createBranchMessage = ({
  setMessages,
  setHistory,
  historyId,
  setHistoryId,
  setContext,
  setSelectedSystemPrompt,
  setSystemPrompt,
  serverChatId,
  setServerChatId,
  setServerChatState,
  setServerChatVersion,
  setServerChatTopic,
  setServerChatClusterId,
  setServerChatSource,
  setServerChatExternalRef,
  characterId,
  chatTitle,
  serverChatState,
  serverChatTopic,
  serverChatClusterId,
  serverChatSource,
  serverChatExternalRef,
  messages,
  history,
  onServerChatMutated
}: {
  setMessages: (messages: Message[]) => void
  setHistory: (history: ChatHistory) => void
  historyId: string | null
  setHistoryId: (id: string | null) => void
  setSelectedSystemPrompt?: (prompt: string) => void
  setSystemPrompt?: (prompt: string) => void
  setContext?: (context: UploadedFile[]) => void
  serverChatId?: string | null
  setServerChatId?: (id: string | null) => void
  setServerChatState?: (state: ConversationState | null) => void
  setServerChatVersion?: (version: number | null) => void
  setServerChatTopic?: (topic: string | null) => void
  setServerChatClusterId?: (clusterId: string | null) => void
  setServerChatSource?: (source: string | null) => void
  setServerChatExternalRef?: (ref: string | null) => void
  characterId?: string | number | null
  chatTitle?: string | null
  serverChatState?: ConversationState | null
  serverChatTopic?: string | null
  serverChatClusterId?: string | null
  serverChatSource?: string | null
  serverChatExternalRef?: string | null
  messages?: Message[]
  history?: ChatHistory
  onServerChatMutated?: () => void
}) => {
  const createLocalBranch = async (index: number): Promise<string | null> => {
    if (!historyId) {
      // No persisted history; nothing to branch from.
      return null
    }

    try {
      const newBranch = await generateBranchMessage(historyId, index)
      setHistory(formatToChatHistory(newBranch.messages))
      setMessages(formatToMessage(newBranch.messages))
      setHistoryId(newBranch.history.id)
      const systemFiles = await getSessionFiles(newBranch.history.id)
      if (setContext) {
        setContext(systemFiles)
      }

      const lastUsedPrompt = newBranch?.history?.last_used_prompt
      if (lastUsedPrompt) {
        if (lastUsedPrompt.prompt_id) {
          const prompt = await getPromptById(lastUsedPrompt.prompt_id)
          if (prompt && setSelectedSystemPrompt) {
            setSelectedSystemPrompt(lastUsedPrompt.prompt_id)
          }
        }
        if (setSystemPrompt) {
          setSystemPrompt(lastUsedPrompt.prompt_content)
        }
      }
      return newBranch.history.id
    } catch (e) {
      console.log("[branch] local branch failed", e)
      return null
    }
  }

  const createLocalBranchFromSnapshot = async (
    index: number,
    branchTitle: string
  ): Promise<string | null> => {
    if (!messages || messages.length === 0) {
      return null
    }

    const snapshot = messages.slice(0, index + 1)
    if (snapshot.length === 0) {
      return null
    }

    try {
      const newHistory = await saveHistory(branchTitle, false, "branch")
      const savedMessages: any[] = []

      for (let i = 0; i < snapshot.length; i++) {
        const msg = snapshot[i]
        const role =
          msg.name === "System"
            ? "system"
            : msg.isBot
              ? "assistant"
              : "user"
        const name =
          msg.name ||
          (role === "assistant"
            ? "Assistant"
            : role === "system"
              ? "System"
              : "You")
        const saved = await saveMessage({
          history_id: newHistory.id,
          name,
          role,
          content: String(msg.message ?? ""),
          images: msg.images || [],
          source: msg.sources || [],
          time: i,
          message_type: msg.messageType,
          clusterId: msg.clusterId,
          modelId: msg.modelId,
          modelImage: msg.modelImage,
          modelName: msg.modelName,
          parent_message_id: msg.parentMessageId ?? null,
          documents: msg.documents
        })
        savedMessages.push(saved)
      }

      setHistory(formatToChatHistory(savedMessages))
      setMessages(formatToMessage(savedMessages))
      setHistoryId(newHistory.id)
      if (setContext) {
        setContext([])
      }
      return newHistory.id
    } catch (e) {
      console.log("[branch] local snapshot branch failed", e)
      return null
    }
  }

  return async (index: number): Promise<string | null> => {
    // When a server-backed character chat is active, create a new server chat
    // branched from the current context and mirror the prefix messages.
    if (serverChatId) {
      try {
        await tldwClient.initialize().catch(() => null)

        let resolvedTitle = (chatTitle || "").trim()
        let resolvedCharacterId = characterId ?? null
        if (resolvedCharacterId == null) {
          try {
            const chat = await tldwClient.getChat(serverChatId)
            if (!resolvedTitle) {
              resolvedTitle = (chat?.title || "").trim()
            }
            resolvedCharacterId =
              (chat as any)?.character_id ?? (chat as any)?.characterId ?? null
          } catch (e) {
            console.log("[branch] server metadata fetch failed", e)
          }
        }

        const originalTitle =
          resolvedTitle || (serverChatTopic || "").trim() || "Extension chat"
        const shortId = String(serverChatId).slice(0, 8)
        const base =
          originalTitle.length > 60
            ? `${originalTitle.slice(0, 57)}…`
            : originalTitle
        const branchTitle = `${base} [${shortId}] · msg #${index + 1}`

        const payload: Record<string, any> = {
          title: branchTitle,
          parent_conversation_id: serverChatId,
          state: serverChatState || "in-progress",
          topic_label: serverChatTopic || undefined,
          cluster_id: serverChatClusterId || undefined,
          source: serverChatSource || undefined,
          external_ref: serverChatExternalRef || undefined
        }
        if (resolvedCharacterId != null) {
          payload.character_id = resolvedCharacterId
        }

        const created = await tldwClient.createChat(payload)
        const rawId =
          (created as any)?.id ?? (created as any)?.chat_id ?? created
        const newChatId = rawId != null ? String(rawId) : ""
        if (!newChatId) {
          throw new Error("Failed to create server branch chat")
        }
        onServerChatMutated?.()

        const snapshot: ChatHistory =
          (history && Array.isArray(history) ? history : []).slice(
            0,
            index + 1
          )

        for (const msg of snapshot) {
          const content = (msg.content || "").trim()
          if (!content) continue
          const role =
            msg.role === "system" ||
            msg.role === "assistant" ||
            msg.role === "user"
              ? msg.role
              : "user"
          await tldwClient.addChatMessage(newChatId, {
            role,
            content
          })
        }

        if (setServerChatId) {
          setServerChatId(newChatId)
        }
        if (setServerChatState) {
          setServerChatState(
            (created as any)?.state ??
              (created as any)?.conversation_state ??
              "in-progress"
          )
        }
        if (setServerChatVersion) {
          setServerChatVersion((created as any)?.version ?? null)
        }
        if (setServerChatTopic) {
          setServerChatTopic((created as any)?.topic_label ?? null)
        }
        if (setServerChatClusterId) {
          setServerChatClusterId((created as any)?.cluster_id ?? null)
        }
        if (setServerChatSource) {
          setServerChatSource((created as any)?.source ?? null)
        }
        if (setServerChatExternalRef) {
          setServerChatExternalRef((created as any)?.external_ref ?? null)
        }

        if (messages && messages.length > 0) {
          const slicedMessages = messages.slice(0, index + 1)
          setMessages(slicedMessages)
          if (history && history.length > 0) {
            setHistory(snapshot)
          }
        }

        return newChatId
      } catch (e) {
        console.log("[branch] server branch failed", e)
        const fallbackTitle = `${String(serverChatId).slice(0, 8)} · msg #${
          index + 1
        }`
        const fallbackId =
          (await createLocalBranch(index)) ??
          (await createLocalBranchFromSnapshot(index, fallbackTitle))
        if (fallbackId) {
          notification.warning({
            message: "Branch fallback",
            description:
              "Server branch failed. Created a local branch instead."
          })
          return fallbackId
        }
        notification.error({
          message: "Branch failed",
          description:
            "Unable to create a branched server chat. Check your server connection and try again."
        })
        return null
      }
    }

    // Local Dexie-backed branch (existing behavior)
    return (
      (await createLocalBranch(index)) ??
      (await createLocalBranchFromSnapshot(index, `Branch · msg #${index + 1}`))
    )
  }
}

export const createStopStreamingRequest = (
  abortController: AbortController | null,
  setAbortController: (controller: AbortController | null) => void
) => {
  return () => {
    if (abortController) {
      abortController.abort()
      setAbortController(null)
    }
  }
}
