import React from "react"
import { generateID } from "@/db/dexie/helpers"
import { tldwClient } from "@/services/tldw/TldwApiClient"
import type { ChatHistory, Message } from "@/store/option/types"
import type { Character } from "@/types/character"
import { collectGreetings, pickGreeting } from "@/utils/character-greetings"
import { replaceUserDisplayNamePlaceholders } from "@/utils/chat-display-name"
import { useStorage } from "@plasmohq/storage/hook"

type UseCharacterGreetingOptions = {
  playgroundReady: boolean
  selectedCharacter: Character | null
  serverChatId: string | number | null
  messagesLength: number
  history: ChatHistory
  setMessages: (
    messagesOrUpdater: Message[] | ((prev: Message[]) => Message[])
  ) => void
  setHistory: (
    historyOrUpdater: ChatHistory | ((prev: ChatHistory) => ChatHistory)
  ) => void
  setSelectedCharacter: (next: Character | null) => void
}

export const useCharacterGreeting = ({
  playgroundReady,
  selectedCharacter,
  serverChatId,
  messagesLength,
  history,
  setMessages,
  setHistory,
  setSelectedCharacter
}: UseCharacterGreetingOptions) => {
  const [userDisplayName] = useStorage("chatUserDisplayName", "")
  const greetingInjectedRef = React.useRef<string | null>(null)
  const greetingFetchRef = React.useRef<string | null>(null)
  const chatWasEmptyRef = React.useRef(false)
  const selectedCharacterIdRef = React.useRef<string | null>(null)

  React.useEffect(() => {
    const isEmpty = messagesLength === 0
    if (isEmpty && !chatWasEmptyRef.current) {
      greetingInjectedRef.current = null
    }
    chatWasEmptyRef.current = isEmpty
  }, [messagesLength])

  React.useEffect(() => {
    greetingFetchRef.current = null
  }, [selectedCharacter?.id])

  React.useEffect(() => {
    selectedCharacterIdRef.current = selectedCharacter?.id
      ? String(selectedCharacter.id)
      : null
  }, [selectedCharacter?.id])

  React.useEffect(() => {
    if (!playgroundReady) return
    if (!selectedCharacter?.id) return

    const characterId = String(selectedCharacter.id)
    const characterName = selectedCharacter.name || "Assistant"
    const characterAvatarUrl = selectedCharacter.avatar_url ?? null
    const isCurrentSelection = () =>
      selectedCharacterIdRef.current === characterId

    const injectGreeting = (
      greetingValue: string,
      avatarUrl?: string | null
    ) => {
      if (!isCurrentSelection()) return
      const rendered = replaceUserDisplayNamePlaceholders(
        greetingValue,
        userDisplayName
      )
      const trimmed = rendered.trim()
      if (!trimmed) return
      if (serverChatId) return
      if (greetingInjectedRef.current === characterId) return

      const createdAt = Date.now()
      const messageId = generateID()
      let injected = false

      setMessages((prev) => {
        if (!isCurrentSelection()) return prev
        const onlyGreetings =
          prev.length > 0 &&
          prev.every((message) => message.messageType === "character:greeting")
        const singleAssistant = prev.length === 1 && prev[0]?.isBot
        const canReplace =
          prev.length === 0 || onlyGreetings || singleAssistant
        if (!canReplace) return prev
        injected = true
        return [
          {
            isBot: true,
            name: characterName,
            role: "assistant",
            message: trimmed,
            messageType: "character:greeting",
            sources: [],
            createdAt,
            id: messageId,
            modelName: characterName,
            modelImage: avatarUrl ?? undefined
          }
        ]
      })

      if (!injected) return
      greetingInjectedRef.current = characterId

      setHistory((prev) => {
        if (!isCurrentSelection()) return prev
        const onlyGreetings =
          prev.length > 0 &&
          prev.every((entry) => entry.messageType === "character:greeting")
        const singleAssistant =
          prev.length === 1 && prev[0]?.role === "assistant"
        const canReplace =
          prev.length === 0 || onlyGreetings || singleAssistant
        if (!canReplace) return prev
        return [
          {
            role: "assistant",
            content: trimmed,
            messageType: "character:greeting"
          }
        ]
      })
    }

    const greeting = selectedCharacter.greeting?.trim() || ""
    if (!greeting) {
      if (greetingFetchRef.current !== characterId) {
        greetingFetchRef.current = characterId
        void (async () => {
          try {
            await tldwClient.initialize().catch(() => null)
            if (!isCurrentSelection() || greetingFetchRef.current !== characterId) {
              return
            }
            const full = await tldwClient.getCharacter(characterId)
            if (!isCurrentSelection() || greetingFetchRef.current !== characterId) {
              return
            }
            const greetings = collectGreetings(full)
            const picked = pickGreeting(greetings)
            if (!picked) return
            if (!isCurrentSelection() || greetingFetchRef.current !== characterId) {
              return
            }
            if (
              !selectedCharacter ||
              String(selectedCharacter.id) !== characterId
            ) {
              return
            }
            setSelectedCharacter({
              ...selectedCharacter,
              greeting: picked,
              avatar_url: full?.avatar_url ?? selectedCharacter.avatar_url ?? null
            })
            if (!isCurrentSelection() || greetingFetchRef.current !== characterId) {
              return
            }
            injectGreeting(picked, full?.avatar_url ?? null)
          } catch {
            // ignore
          }
        })()
      }
      return
    }

    injectGreeting(greeting, characterAvatarUrl)
  }, [
    messagesLength,
    history,
    playgroundReady,
    selectedCharacter,
    serverChatId,
    setHistory,
    setMessages,
    setSelectedCharacter,
    userDisplayName
  ])
}
