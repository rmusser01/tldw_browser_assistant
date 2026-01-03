import { PageAssistContext } from "@/context"
import { Message } from "@/types/message"
import React from "react"

export const PageAssistProvider = ({
  children
}: {
  children: React.ReactNode
}) => {
  const [messages, setMessages] = React.useState<Message[]>([])
  const [controller, setController] = React.useState<AbortController | null>(
    null
  )
  const [embeddingController, setEmbeddingController] =
    React.useState<AbortController | null>(null)

  if (typeof window !== "undefined") {
    const w = window as any
    w.__tldw_pageAssist = {
      setMessages,
      getMessages: () => messages
    }
  }

  return (
    <PageAssistContext.Provider
      value={{
        messages,
        setMessages,

        controller,
        setController,

        embeddingController,
        setEmbeddingController
      }}>
      {children}
    </PageAssistContext.Provider>
  )
}
