import {
  getLastChatHistory,
  saveHistory,
  saveMessage,
  updateMessage,
  updateLastUsedModel as setLastUsedChatModel,
  updateLastUsedPrompt as setLastUsedChatSystemPrompt,
  updateChatHistoryCreatedAt
} from "@/db/dexie/helpers"
import { ChatDocuments } from "@/models/ChatTypes"
import { generateTitle } from "@/services/title"
import { ChatHistory } from "@/store/option"
import { updatePageTitle } from "@/utils/update-page-title"

export const saveMessageOnError = async ({
  e,
  history,
  setHistory,
  image,
  userMessage,
  botMessage,
  historyId,
  selectedModel,
  setHistoryId,
  isRegenerating,
  message_source = "web-ui",
  message_type,
  prompt_content,
  prompt_id,
  isContinue,
  documents = []
}: {
  e: any
  setHistory: (history: ChatHistory) => void
  history: ChatHistory
  userMessage: string
  image: string
  botMessage: string
  historyId: string | null
  selectedModel: string
  setHistoryId: (historyId: string) => void
  isRegenerating: boolean
  message_source?: "copilot" | "web-ui"
  message_type?: string
  prompt_id?: string
  prompt_content?: string
  isContinue?: boolean
  documents?: ChatDocuments
}) => {
  const isAbort = (
    e?.name === "AbortError" ||
    e?.message === "AbortError" ||
    e?.name?.includes?.("AbortError") ||
    e?.message?.includes?.("AbortError")
  )

  // Compose assistant message content: prefer partial botMessage, else show error detail
  const errText = String(e?.message || e?.error || e?.detail || 'Request failed')
  const assistantContent = (botMessage && String(botMessage).trim().length > 0)
    ? String(botMessage)
    : `Error: ${errText}`

  if (isAbort) {
    setHistory([
      ...history,
      {
        role: "user",
        content: userMessage,
        image
      },
      {
        role: "assistant",
        content: assistantContent
      }
    ])

    if (historyId) {
      if (!isRegenerating && !isContinue) {
        await saveMessage({
          history_id: historyId,
          name: selectedModel,
          role: "user",
          content: userMessage,
          images: [image],
          time: 1,
          message_type,
          documents
        })
      }

      if (isContinue) {
        console.log("Saving Last Message")
        const lastMessage = await getLastChatHistory(historyId)
        await updateMessage(historyId, lastMessage.id, botMessage)
      } else {
        await saveMessage({
          history_id: historyId,
          name: selectedModel,
          role: "assistant",
          content: assistantContent,
          images: [],
          source: [],
          time: 2,
          message_type
        })
      }
      await setLastUsedChatModel(historyId, selectedModel)
      if (prompt_id || prompt_content) {
        await setLastUsedChatSystemPrompt(historyId, {
          prompt_content,
          prompt_id
        })
      }

      return historyId
    } else {
      const title = await generateTitle(selectedModel, userMessage, userMessage)
      const newHistoryId = await saveHistory(title, false, message_source)
      updatePageTitle(title)
      if (!isRegenerating) {
        await saveMessage({
          history_id: newHistoryId.id,
          name: selectedModel,
          role: "user",
          content: userMessage,
          images: [image],
          time: 1,
          message_type,
          documents
        })
      }

      await saveMessage({
        history_id: newHistoryId.id,
        name: selectedModel,
        role: "assistant",
        content: assistantContent,
        images: [],
        source: [],
        time: 2,
        message_type
      })
      setHistoryId(newHistoryId.id)
      await setLastUsedChatModel(newHistoryId.id, selectedModel)
      if (prompt_id || prompt_content) {
        await setLastUsedChatSystemPrompt(newHistoryId.id, {
          prompt_content,
          prompt_id
        })
      }

      return newHistoryId.id
    }
  }

  // Non-abort errors: append user + assistant with error content as well
  setHistory([
    ...history,
    {
      role: "user",
      content: userMessage,
      image
    },
    {
      role: "assistant",
      content: assistantContent
    }
  ])

  if (historyId) {
    try {
      // Save user message if not regenerating
      await saveMessage({
        history_id: historyId,
        name: selectedModel,
        role: "user",
        content: userMessage,
        images: [image],
        time: 1,
        message_type,
        documents
      })
      // Save assistant error message
      await saveMessage({
        history_id: historyId,
        name: selectedModel,
        role: "assistant",
        content: assistantContent,
        images: [],
        source: [],
        time: 2,
        message_type
      })
    } catch {}
    return historyId
  } else {
    // Create new history on error
    const title = await generateTitle(selectedModel, userMessage, userMessage)
    const newHistoryId = await saveHistory(title, false, message_source)
    updatePageTitle(title)
    try {
      await saveMessage({
        history_id: newHistoryId.id,
        name: selectedModel,
        role: "user",
        content: userMessage,
        images: [image],
        time: 1,
        message_type,
        documents
      })
      await saveMessage({
        history_id: newHistoryId.id,
        name: selectedModel,
        role: "assistant",
        content: assistantContent,
        images: [],
        source: [],
        time: 2,
        message_type
      })
    } catch {}
    setHistoryId(newHistoryId.id)
    return newHistoryId.id
  }
}

export const saveMessageOnSuccess = async ({
  historyId,
  setHistoryId,
  isRegenerate,
  selectedModel,
  message,
  image,
  fullText,
  source,
  message_source = "web-ui",
  message_type,
  generationInfo,
  prompt_id,
  prompt_content,
  reasoning_time_taken = 0,
  isContinue,
  documents = []
}: {
  historyId: string | null
  setHistoryId: (historyId: string) => void
  isRegenerate: boolean
  selectedModel: string | null
  message: string
  image: string
  fullText: string
  source: any[]
  message_source?: "copilot" | "web-ui"
  message_type?: string
  generationInfo?: any
  prompt_id?: string
  prompt_content?: string
  reasoning_time_taken?: number
  isContinue?: boolean
  documents?: ChatDocuments
}) => {
  if (historyId) {
    if (!isRegenerate && !isContinue) {
      await saveMessage({
        history_id: historyId,
        name: selectedModel,
        role: "user",
        content: message,
        images: [image],
        time: 1,
        message_type,
        generationInfo,
        reasoning_time_taken,
        documents
      })
    }

    if (isContinue) {
      console.log("Saving Last Message")
      const lastMessage = await getLastChatHistory(historyId)
      console.log("lastMessage", lastMessage)
      await updateMessage(historyId, lastMessage.id, fullText)
    } else {
      await saveMessage(
        {
          history_id: historyId,
          name: selectedModel,
          role: "assistant",
          content: fullText,
          images: [],
          source,
          time: 2,
          message_type,
          generationInfo,
          reasoning_time_taken
        }
        // historyId,
        // selectedModel!,
        // "assistant",
        // fullText,
        // [],
        // source,
        // 2,
        // message_type,
        // generationInfo,
        // reasoning_time_taken
      )
    }

    await setLastUsedChatModel(historyId, selectedModel!)
    if (prompt_id || prompt_content) {
      await setLastUsedChatSystemPrompt(historyId, {
        prompt_content,
        prompt_id
      })
    }

    await updateChatHistoryCreatedAt(historyId)

    return historyId
  } else {
    const title = await generateTitle(selectedModel, message, message)
    updatePageTitle(title)
    const newHistoryId = await saveHistory(title, false, message_source)

    await saveMessage(
      {
        history_id: newHistoryId.id,
        name: selectedModel,
        role: "user",
        content: message,
        images: [image],
        time: 1,
        message_type,
        generationInfo,
        reasoning_time_taken,
        documents
      }
      // newHistoryId.id,
      // selectedModel,
      // "user",
      // message,
      // [image],
      // [],
      // 1,
      // message_type,
      // generationInfo,
      // reasoning_time_taken
    )

    await saveMessage(
      {
        history_id: newHistoryId.id,
        name: selectedModel,
        role: "assistant",
        content: fullText,
        images: [],
        source,
        time: 2,
        message_type,
        generationInfo,
        reasoning_time_taken
      }
      // newHistoryId.id,
      // selectedModel!,
      // "assistant",
      // fullText,
      // [],
      // source,
      // 2,
      // message_type,
      // generationInfo,
      // reasoning_time_taken
    )
    setHistoryId(newHistoryId.id)
    await setLastUsedChatModel(newHistoryId.id, selectedModel!)
    if (prompt_id || prompt_content) {
      await setLastUsedChatSystemPrompt(newHistoryId.id, {
        prompt_content,
        prompt_id
      })
    }

    return newHistoryId.id
  }
}
