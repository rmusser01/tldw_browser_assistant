import React from "react"
import { shallow } from "zustand/shallow"
import type { TFunction } from "i18next"
import { useChatBaseState } from "@/hooks/chat/useChatBaseState"
import { useStoreMessageOption } from "@/store/option"
import { tldwClient } from "@/services/tldw/TldwApiClient"
import { getHistoriesWithMetadata, saveMessage } from "@/db/dexie/helpers"
import { normalizeConversationState } from "@/utils/conversation-state"
import { normalizeChatRole } from "@/utils/normalize-chat-role"
import { updatePageTitle } from "@/utils/update-page-title"

type NotificationApi = {
  error: (payload: { message: string; description?: string }) => void
}

type UseServerChatLoaderOptions = {
  ensureServerChatHistoryId: (
    chatId: string,
    title?: string
  ) => Promise<string | null>
  notification: NotificationApi
  t: TFunction
}

export const useServerChatLoader = ({
  ensureServerChatHistoryId,
  notification,
  t
}: UseServerChatLoaderOptions) => {
  const { setHistory, setMessages, setIsLoading } = useChatBaseState(
    useStoreMessageOption
  )
  const {
    serverChatId,
    serverChatTitle,
    serverChatCharacterId,
    serverChatMetaLoaded,
    temporaryChat,
    setServerChatTitle,
    setServerChatCharacterId,
    setServerChatState,
    setServerChatVersion,
    setServerChatTopic,
    setServerChatClusterId,
    setServerChatSource,
    setServerChatExternalRef,
    setServerChatMetaLoaded
  } = useStoreMessageOption(
    (state) => ({
      serverChatId: state.serverChatId,
      serverChatTitle: state.serverChatTitle,
      serverChatCharacterId: state.serverChatCharacterId,
      serverChatMetaLoaded: state.serverChatMetaLoaded,
      temporaryChat: state.temporaryChat,
      setServerChatTitle: state.setServerChatTitle,
      setServerChatCharacterId: state.setServerChatCharacterId,
      setServerChatState: state.setServerChatState,
      setServerChatVersion: state.setServerChatVersion,
      setServerChatTopic: state.setServerChatTopic,
      setServerChatClusterId: state.setServerChatClusterId,
      setServerChatSource: state.setServerChatSource,
      setServerChatExternalRef: state.setServerChatExternalRef,
      setServerChatMetaLoaded: state.setServerChatMetaLoaded
    }),
    shallow
  )

  const serverChatLoadRef = React.useRef<{
    chatId: string | null
    controller: AbortController | null
    inFlight: boolean
    loaded: boolean
  }>({ chatId: null, controller: null, inFlight: false, loaded: false })
  const serverChatDebounceRef = React.useRef<{
    chatId: string | null
    timer: ReturnType<typeof setTimeout> | null
  }>({ chatId: null, timer: null })

  React.useEffect(() => {
    return () => {
      if (serverChatDebounceRef.current.timer) {
        clearTimeout(serverChatDebounceRef.current.timer)
      }
      if (serverChatLoadRef.current.controller) {
        serverChatLoadRef.current.controller.abort()
      }
    }
  }, [])

  React.useEffect(() => {
    if (!serverChatId) return
    if (
      serverChatLoadRef.current.chatId === serverChatId &&
      serverChatLoadRef.current.loaded
    ) {
      return
    }
    if (serverChatLoadRef.current.inFlight) {
      if (serverChatLoadRef.current.chatId === serverChatId) {
        return
      }
      if (serverChatLoadRef.current.controller) {
        serverChatLoadRef.current.controller.abort()
      }
      serverChatLoadRef.current.inFlight = false
    }

    if (serverChatDebounceRef.current.timer) {
      clearTimeout(serverChatDebounceRef.current.timer)
    }

    serverChatDebounceRef.current.chatId = serverChatId
    serverChatDebounceRef.current.timer = setTimeout(() => {
      const controller = new AbortController()
      serverChatLoadRef.current = {
        chatId: serverChatId,
        controller,
        inFlight: true,
        loaded: false
      }

      const loadServerChat = async () => {
        try {
          setIsLoading(true)
          await tldwClient.initialize().catch(() => null)

          let assistantName = "Assistant"
          let chatTitle = serverChatTitle || ""
          let characterId = serverChatCharacterId ?? null

          if (!serverChatMetaLoaded) {
            try {
              const chat = await tldwClient.getChat(serverChatId)
              const meta = chat as unknown as Record<string, unknown>
              chatTitle = String(meta?.title || chatTitle || "")
              const resolvedCharacterId =
                (meta?.character_id as string | number | null | undefined) ??
                (meta?.characterId as string | number | null | undefined) ??
                null
              if (resolvedCharacterId != null) {
                characterId = resolvedCharacterId
              }
              setServerChatTitle(chatTitle || "")
              setServerChatCharacterId(resolvedCharacterId ?? null)
              setServerChatState(
                normalizeConversationState(
                  (meta?.state as string | null | undefined) ??
                    (meta?.conversation_state as string | null | undefined)
                )
              )
              setServerChatVersion(
                typeof meta?.version === "number" ? meta.version : null
              )
              setServerChatTopic(
                typeof meta?.topic_label === "string"
                  ? meta.topic_label
                  : null
              )
              setServerChatClusterId(
                typeof meta?.cluster_id === "string" ? meta.cluster_id : null
              )
              setServerChatSource(
                typeof meta?.source === "string" ? meta.source : null
              )
              setServerChatExternalRef(
                typeof meta?.external_ref === "string"
                  ? meta.external_ref
                  : null
              )
              setServerChatMetaLoaded(true)
            } catch {
              // ignore metadata failures; still try to load messages
            }
          }

          if (characterId != null) {
            try {
              const character = await tldwClient.getCharacter(characterId)
              if (character) {
                assistantName = character.name || character.title || assistantName
              }
            } catch {
              // ignore character lookup failures
            }
          }

          const list = await tldwClient.listChatMessages(
            serverChatId,
            { include_deleted: "false" },
            { signal: controller.signal }
          )

          const history = list.map((m) => ({
            role: m.role,
            content: m.content
          }))

          const mappedMessages = list.map((m) => {
            const meta = m as unknown as Record<string, unknown>
            const createdAt = Date.parse(m.created_at)
            return {
              createdAt: Number.isNaN(createdAt) ? undefined : createdAt,
              isBot: m.role === "assistant",
              role: normalizeChatRole(m.role),
              name:
                m.role === "assistant"
                  ? assistantName
                  : m.role === "system"
                    ? "System"
                    : "You",
              message: m.content,
              sources: [],
              images: [],
              id: String(m.id),
              serverMessageId: String(m.id),
              serverMessageVersion: m.version,
              parentMessageId:
                (meta?.parent_message_id as string | null | undefined) ??
                (meta?.parentMessageId as string | null | undefined) ??
                null,
              messageType:
                (meta?.message_type as string | undefined) ??
                (meta?.messageType as string | undefined),
              clusterId:
                (meta?.cluster_id as string | undefined) ??
                (meta?.clusterId as string | undefined),
              modelId:
                (meta?.model_id as string | undefined) ??
                (meta?.modelId as string | undefined),
              modelName:
                (meta?.model_name as string | undefined) ??
                (meta?.modelName as string | undefined) ??
                assistantName,
              modelImage:
                (meta?.model_image as string | undefined) ??
                (meta?.modelImage as string | undefined)
            }
          })

          setHistory(history)
          setMessages(mappedMessages)
          if (!temporaryChat) {
            try {
              const localHistoryId = await ensureServerChatHistoryId(
                serverChatId,
                chatTitle || undefined
              )
              if (localHistoryId) {
                const metadataMap = await getHistoriesWithMetadata([
                  localHistoryId
                ])
                const existingMeta = metadataMap.get(localHistoryId)
                if (!existingMeta || existingMeta.messageCount === 0) {
                  const now = Date.now()
                  await Promise.all(
                    list.map((m, index) => {
                      const meta = m as unknown as Record<string, unknown>
                      const parsedCreatedAt = Date.parse(m.created_at)
                      const resolvedCreatedAt = Number.isNaN(parsedCreatedAt)
                        ? now + index
                        : parsedCreatedAt
                      const role =
                        m.role === "assistant" ||
                        m.role === "system" ||
                        m.role === "user"
                          ? m.role
                          : "user"
                      const name =
                        role === "assistant"
                          ? assistantName
                          : role === "system"
                            ? "System"
                            : "You"
                      return saveMessage({
                        id: String(m.id),
                        history_id: localHistoryId,
                        name,
                        role,
                        content: m.content,
                        images: [],
                        source: [],
                        time: index,
                        message_type:
                          (meta?.message_type as string | undefined) ??
                          (meta?.messageType as string | undefined),
                        clusterId:
                          (meta?.cluster_id as string | undefined) ??
                          (meta?.clusterId as string | undefined),
                        modelId:
                          (meta?.model_id as string | undefined) ??
                          (meta?.modelId as string | undefined),
                        modelName:
                          (meta?.model_name as string | undefined) ??
                          (meta?.modelName as string | undefined) ??
                          assistantName,
                        modelImage:
                          (meta?.model_image as string | undefined) ??
                          (meta?.modelImage as string | undefined),
                        parent_message_id:
                          (meta?.parent_message_id as string | null | undefined) ??
                          (meta?.parentMessageId as string | null | undefined) ??
                          null,
                        createdAt: resolvedCreatedAt
                      })
                    })
                  )
                }
              }
            } catch {
              // Local mirror is best-effort for server chats.
            }
          }
          if (chatTitle) {
            updatePageTitle(chatTitle)
          }
        } catch (e: unknown) {
          const message = e instanceof Error ? e.message : String(e || "")
          const isAbort =
            e instanceof Error && e.name === "AbortError"
              ? true
              : message.toLowerCase().includes("abort")
          if (!isAbort) {
            notification.error({
              message: t("error", { defaultValue: "Error" }),
              description:
                message ||
                t("common:serverChatLoadError", {
                  defaultValue:
                    "Failed to load server chat. Check your connection and try again."
                })
            })
          }
        } finally {
          if (serverChatLoadRef.current.controller === controller) {
            serverChatLoadRef.current = {
              chatId: serverChatId,
              controller: null,
              inFlight: false,
              loaded: true
            }
          }
          setIsLoading(false)
        }
      }

      void loadServerChat()
    }, 200)

    return () => {
      if (serverChatDebounceRef.current.timer) {
        clearTimeout(serverChatDebounceRef.current.timer)
        serverChatDebounceRef.current.timer = null
      }
    }
  }, [
    ensureServerChatHistoryId,
    notification,
    serverChatCharacterId,
    serverChatId,
    serverChatMetaLoaded,
    serverChatTitle,
    setHistory,
    setIsLoading,
    setMessages,
    setServerChatCharacterId,
    setServerChatClusterId,
    setServerChatExternalRef,
    setServerChatMetaLoaded,
    setServerChatSource,
    setServerChatState,
    setServerChatTitle,
    setServerChatTopic,
    setServerChatVersion,
    t,
    temporaryChat
  ])
}
