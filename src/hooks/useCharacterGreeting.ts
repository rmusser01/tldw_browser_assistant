import React from "react"
import { generateID } from "@/db/dexie/helpers"
import { tldwClient } from "@/services/tldw/TldwApiClient"
import type { ChatHistory, Message } from "@/store/option/types"
import type { Character } from "@/types/character"
import { collectGreetings, pickGreeting } from "@/utils/character-greetings"

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
  const greetingInjectedRef = React.useRef<string | null>(null)
  const greetingFetchRef = React.useRef<string | null>(null)
  const chatWasEmptyRef = React.useRef(false)

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
    if (!playgroundReady) return
    if (!selectedCharacter?.id) return

    const injectGreeting = (greetingValue: string, avatarUrl?: string | null) => {
      const trimmed = greetingValue.trim()
      if (!trimmed) return
      if (serverChatId) return
      const characterId = String(selectedCharacter.id)
      if (greetingInjectedRef.current === characterId) return

      const createdAt = Date.now()
      const messageId = generateID()
      let injected = false

      setMessages((prev) => {
        if (prev.length > 0) return prev
        injected = true
        return [
          {
            isBot: true,
            name: selectedCharacter.name || "Assistant",
            role: "assistant",
            message: trimmed,
            messageType: "character:greeting",
            sources: [],
            createdAt,
            id: messageId,
            modelName: selectedCharacter.name || "Assistant",
            modelImage: avatarUrl ?? undefined
          }
        ]
      })

      if (!injected) return
      greetingInjectedRef.current = characterId

      if (history.length > 0) {
        setHistory(history)
        return
      }
      setHistory([
        {
          role: "assistant",
          content: trimmed,
          messageType: "character:greeting"
        }
      ])
    }

    const greeting = selectedCharacter.greeting?.trim() || ""
    if (!greeting) {
      const characterId = String(selectedCharacter.id)
      if (greetingFetchRef.current !== characterId) {
        greetingFetchRef.current = characterId
        void tldwClient
          .initialize()
          .catch(() => null)
          .then(() => tldwClient.getCharacter(characterId))
          .then((full) => {
            const greetings = collectGreetings(full)
            const picked = pickGreeting(greetings)
            if (!picked) return
            setSelectedCharacter({
              ...selectedCharacter,
              greeting: picked,
              avatar_url: full?.avatar_url ?? selectedCharacter.avatar_url ?? null
            })
            injectGreeting(picked, full?.avatar_url ?? null)
          })
          .catch(() => {})
      }
      return
    }

    injectGreeting(greeting, selectedCharacter.avatar_url ?? null)
  }, [
    messagesLength,
    history,
    playgroundReady,
    selectedCharacter,
    serverChatId,
    setHistory,
    setMessages,
    setSelectedCharacter
  ])
}
