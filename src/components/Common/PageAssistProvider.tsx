import { PageAssistContext } from "@/context"
import { useStoreMessageOption } from "@/store/option"
import React from "react"

// Note: messages state has been moved to useStoreMessageOption (Zustand store)
// This provider now only manages abort controllers for streaming requests
export const PageAssistProvider = ({
  children
}: {
  children: React.ReactNode
}) => {
  const [controller, setController] = React.useState<AbortController | null>(
    null
  )
  const [embeddingController, setEmbeddingController] =
    React.useState<AbortController | null>(null)

  // Expose store accessors for debugging (messages now come from Zustand store)
  if (typeof window !== "undefined") {
    const w = window as any
    w.__tldw_pageAssist = {
      setMessages: useStoreMessageOption.getState().setMessages,
      getMessages: () => useStoreMessageOption.getState().messages
    }
  }

  return (
    <PageAssistContext.Provider
      value={{
        controller,
        setController,

        embeddingController,
        setEmbeddingController
      }}>
      {children}
    </PageAssistContext.Provider>
  )
}
