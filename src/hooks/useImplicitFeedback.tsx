import React from "react"
import {
  getFeedbackSessionId,
  submitImplicitFeedback
} from "@/services/feedback"
import {
  collectImpressionList,
  extractSourceFeedbackIds,
  getSourceImpressionId
} from "@/utils/feedback"

type ImplicitFeedbackContext = {
  conversationId?: string | null
  messageId?: string | null
  query?: string | null
  sources?: any[]
  enabled?: boolean
}

const normalizeQuery = (value?: string | null) => {
  if (!value) return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

export const useImplicitFeedback = ({
  conversationId,
  messageId,
  query,
  sources = [],
  enabled = true
}: ImplicitFeedbackContext) => {
  const sessionId = React.useMemo(() => getFeedbackSessionId(), [])
  const lastEventRef = React.useRef<Record<string, number>>({})

  const sendEvent = React.useCallback(
    async (payload: {
      event_type: "click" | "expand" | "copy"
      doc_id?: string
      chunk_ids?: string[]
      rank?: number
      impression_list?: string[]
      corpus?: string
    }) => {
      if (!enabled) return
      const key = `${payload.event_type}:${payload.doc_id || ""}:${payload.rank || ""}`
      const now = Date.now()
      if (lastEventRef.current[key] && now - lastEventRef.current[key] < 500) {
        return
      }
      lastEventRef.current[key] = now
      try {
        await submitImplicitFeedback({
          ...payload,
          query: normalizeQuery(query),
          session_id: sessionId,
          conversation_id: conversationId || undefined,
          message_id: messageId || undefined
        })
      } catch {
        // best-effort only
      }
    },
    [conversationId, enabled, messageId, query, sessionId]
  )

  const trackCopy = React.useCallback(() => {
    void sendEvent({ event_type: "copy" })
  }, [sendEvent])

  const trackSourcesExpanded = React.useCallback(() => {
    const impressionList = collectImpressionList(sources)
    void sendEvent({
      event_type: "expand",
      impression_list: impressionList.length > 0 ? impressionList : undefined
    })
  }, [sendEvent, sources])

  const trackSourceClick = React.useCallback(
    (source: any, index?: number) => {
      const { documentIds, chunkIds, corpus } =
        extractSourceFeedbackIds(source)
      const docId =
        documentIds[0] ||
        chunkIds[0] ||
        getSourceImpressionId(source, index)
      void sendEvent({
        event_type: "click",
        doc_id: docId,
        chunk_ids: chunkIds.length > 0 ? chunkIds : undefined,
        rank: typeof index === "number" ? index + 1 : undefined,
        impression_list:
          sources.length > 0 ? collectImpressionList(sources) : undefined,
        corpus
      })
    },
    [sendEvent, sources]
  )

  return {
    trackCopy,
    trackSourcesExpanded,
    trackSourceClick
  }
}
