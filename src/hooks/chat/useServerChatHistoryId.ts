import React from "react"
import type { TFunction } from "i18next"
import {
  getHistoryByServerChatId,
  saveHistory,
  setHistoryServerChatId,
  updateHistory
} from "@/db/dexie/helpers"

type UseServerChatHistoryIdOptions = {
  serverChatId: string | null
  historyId: string | null
  setHistoryId: (
    historyId: string | null,
    options?: { preserveServerChatId?: boolean }
  ) => void
  temporaryChat: boolean
  t: TFunction
}

export const useServerChatHistoryId = ({
  serverChatId,
  historyId,
  setHistoryId,
  temporaryChat,
  t
}: UseServerChatHistoryIdOptions) => {
  const historyIdRef = React.useRef(historyId)
  const serverChatHistoryIdRef = React.useRef<{
    chatId: string | null
    historyId: string | null
  }>({ chatId: null, historyId: null })

  React.useEffect(() => {
    historyIdRef.current = historyId
  }, [historyId])

  React.useEffect(() => {
    if (serverChatHistoryIdRef.current.chatId !== serverChatId) {
      serverChatHistoryIdRef.current = {
        chatId: serverChatId ?? null,
        historyId: null
      }
    }
  }, [serverChatId])

  const ensureServerChatHistoryId = React.useCallback(
    async (chatId: string, title?: string) => {
      if (!chatId || temporaryChat) return null
      const currentHistoryId = historyIdRef.current
      if (
        serverChatHistoryIdRef.current.chatId === chatId &&
        serverChatHistoryIdRef.current.historyId
      ) {
        const existingId = serverChatHistoryIdRef.current.historyId
        if (currentHistoryId !== existingId) {
          setHistoryId(existingId, { preserveServerChatId: true })
        }
        return existingId
      }

      const existing = await getHistoryByServerChatId(chatId)
      const trimmedTitle = (title || existing?.title || "").trim()
      const resolvedTitle =
        trimmedTitle ||
        t("common:untitled", { defaultValue: "Untitled" })

      if (existing) {
        if (resolvedTitle && resolvedTitle !== existing.title) {
          await updateHistory(existing.id, resolvedTitle)
        }
        serverChatHistoryIdRef.current = {
          chatId,
          historyId: existing.id
        }
        if (currentHistoryId !== existing.id) {
          setHistoryId(existing.id, { preserveServerChatId: true })
        }
        return existing.id
      }

      if (currentHistoryId && currentHistoryId !== "temp") {
        await setHistoryServerChatId(currentHistoryId, chatId)
        if (resolvedTitle) {
          await updateHistory(currentHistoryId, resolvedTitle)
        }
        serverChatHistoryIdRef.current = {
          chatId,
          historyId: currentHistoryId
        }
        return currentHistoryId
      }

      const newHistory = await saveHistory(
        resolvedTitle,
        false,
        "server",
        undefined,
        chatId
      )
      serverChatHistoryIdRef.current = {
        chatId,
        historyId: newHistory.id
      }
      setHistoryId(newHistory.id, { preserveServerChatId: true })
      return newHistory.id
    },
    [setHistoryId, t, temporaryChat]
  )

  return {
    ensureServerChatHistoryId
  }
}
