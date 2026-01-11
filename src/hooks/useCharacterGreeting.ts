import React from "react"
import { generateID } from "@/db/dexie/helpers"
import { tldwClient } from "@/services/tldw/TldwApiClient"
import type { ChatHistory, Message } from "@/store/option/types"
import type { Character } from "@/types/character"
import { collectGreetings, pickGreeting } from "@/utils/character-greetings"
import { replaceUserDisplayNamePlaceholders } from "@/utils/chat-display-name"
import { useStorage } from "@plasmohq/storage/hook"
import {
  SELECTED_CHARACTER_STORAGE_KEY,
  selectedCharacterStorage,
  parseSelectedCharacterValue
} from "@/utils/selected-character-storage"

type UseCharacterGreetingOptions = {
  playgroundReady: boolean
  selectedCharacter: Character | null
  serverChatId: string | number | null
  messagesLength: number
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
  setMessages,
  setHistory,
  setSelectedCharacter
}: UseCharacterGreetingOptions) => {
  const [userDisplayName] = useStorage("chatUserDisplayName", "")
  const greetingInjectedRef = React.useRef<string | null>(null)
  const greetingFetchRef = React.useRef<string | null>(null)
  const greetingTemplateRef = React.useRef<{
    characterId: string
    greeting: string
  } | null>(null)
  const chatWasEmptyRef = React.useRef(false)
  const selectedCharacterIdRef = React.useRef<string | null>(null)

  React.useEffect(() => {
    if (!playgroundReady) return
    let cancelled = false
    const syncSelection = async () => {
      try {
        const storedRaw = await selectedCharacterStorage.get(
          SELECTED_CHARACTER_STORAGE_KEY
        )
        const stored = parseSelectedCharacterValue<Character>(storedRaw)
        if (!stored?.id || cancelled) return
        const storedId = String(stored.id)
        const currentId = selectedCharacter?.id
          ? String(selectedCharacter.id)
          : null
        if (storedId !== currentId) {
          setSelectedCharacter(stored)
        }
      } catch {
        // ignore
      }
    }
    void syncSelection()
    return () => {
      cancelled = true
    }
  }, [playgroundReady, selectedCharacter?.id, setSelectedCharacter])

  React.useEffect(() => {
    const isEmpty = messagesLength === 0
    if (isEmpty && !chatWasEmptyRef.current) {
      greetingInjectedRef.current = null
      greetingTemplateRef.current = null
    }
    chatWasEmptyRef.current = isEmpty
  }, [messagesLength])

  React.useEffect(() => {
    greetingFetchRef.current = null
    greetingTemplateRef.current = null
  }, [selectedCharacter?.id])

  React.useEffect(() => {
    if (!playgroundReady) return
    if (!selectedCharacter?.id) {
      selectedCharacterIdRef.current = null
      return
    }

    const characterId = String(selectedCharacter.id)
    selectedCharacterIdRef.current = characterId
    const characterName = selectedCharacter.name || "Assistant"
    const characterAvatarUrl = selectedCharacter.avatar_url ?? null
    const isCurrentSelection = () =>
      selectedCharacterIdRef.current === characterId

    const upsertGreeting = (
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

      const createdAt = Date.now()
      const messageId = generateID()
      let updated = false

      setMessages((prev) => {
        if (!isCurrentSelection()) return prev
        const onlyGreetings =
          prev.length > 0 &&
          prev.every((message) => message.messageType === "character:greeting")
        const singleAssistant = prev.length === 1 && prev[0]?.isBot
        const canReplace =
          prev.length === 0 || onlyGreetings || singleAssistant
        if (!canReplace) return prev
        updated = true
        if (prev.length === 1 && prev[0]?.messageType === "character:greeting") {
          return [
            {
              ...prev[0],
              name: characterName,
              role: "assistant",
              message: trimmed,
              modelName: characterName,
              modelImage: avatarUrl ?? prev[0]?.modelImage
            }
          ]
        }
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

      if (!updated) return
      greetingInjectedRef.current = characterId
      greetingTemplateRef.current = { characterId, greeting: greetingValue }

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
        if (prev.length === 1 && prev[0]?.messageType === "character:greeting") {
          return [
            {
              ...prev[0],
              content: trimmed
            }
          ]
        }
        return [
          {
            role: "assistant",
            content: trimmed,
            messageType: "character:greeting"
          }
        ]
      })
    }

    const cachedGreeting =
      greetingTemplateRef.current?.characterId === characterId
        ? greetingTemplateRef.current?.greeting
        : ""
    if (cachedGreeting) {
      upsertGreeting(cachedGreeting, characterAvatarUrl)
      return
    }

    const greetings = collectGreetings(selectedCharacter)
    if (greetings.length > 1) {
      const picked = pickGreeting(greetings)
      greetingTemplateRef.current = { characterId, greeting: picked }
      upsertGreeting(picked, characterAvatarUrl)
      return
    }

    const fallbackGreeting = greetings[0]?.trim() || ""
    if (greetingFetchRef.current !== characterId) {
      greetingFetchRef.current = characterId
      void (async () => {
        try {
          await tldwClient.initialize().catch(() => null)
          if (
            !isCurrentSelection() ||
            greetingFetchRef.current !== characterId
          ) {
            return
          }
          const full = await tldwClient.getCharacter(characterId)
          if (
            !isCurrentSelection() ||
            greetingFetchRef.current !== characterId
          ) {
            return
          }
          const fetchedGreetings = collectGreetings(full)
          const picked = pickGreeting(fetchedGreetings) || fallbackGreeting
          if (!picked) return
          greetingTemplateRef.current = { characterId, greeting: picked }
          const nextAvatar =
            full?.avatar_url ?? selectedCharacter.avatar_url ?? null
          if (nextAvatar !== selectedCharacter.avatar_url) {
            setSelectedCharacter({
              ...selectedCharacter,
              avatar_url: nextAvatar
            })
          }
          if (
            !isCurrentSelection() ||
            greetingFetchRef.current !== characterId
          ) {
            return
          }
          upsertGreeting(picked, nextAvatar)
        } catch {
          if (fallbackGreeting) {
            greetingTemplateRef.current = {
              characterId,
              greeting: fallbackGreeting
            }
            upsertGreeting(fallbackGreeting, characterAvatarUrl)
          }
        } finally {
          if (greetingFetchRef.current === characterId) {
            greetingFetchRef.current = null
          }
        }
      })()
    }
  }, [
    playgroundReady,
    selectedCharacter,
    serverChatId,
    setHistory,
    setMessages,
    setSelectedCharacter,
    userDisplayName
  ])
}
