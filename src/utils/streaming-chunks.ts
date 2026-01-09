import { mergeReasoningContent } from "@/libs/reasoning"
import { extractTokenFromChunk } from "@/utils/extract-token-from-chunk"

export type StreamingChunk =
  | string
  | {
      content?: string
      choices?: Array<{
        delta?: {
          content?: string
          reasoning_content?: string
        }
      }>
      additional_kwargs?: {
        reasoning_content?: string
      }
    }

type StreamingAccumulator = {
  fullText: string
  contentToSave: string
  apiReasoning: boolean
}

type StreamingChunkResult = StreamingAccumulator & {
  token: string
}

export const consumeStreamingChunk = (
  state: StreamingAccumulator,
  chunk: StreamingChunk
): StreamingChunkResult => {
  let { fullText, contentToSave, apiReasoning } = state
  const token = extractTokenFromChunk(chunk)
  const reasoningDelta =
    typeof chunk === "string"
      ? undefined
      : chunk?.choices?.[0]?.delta?.reasoning_content ??
        chunk?.additional_kwargs?.reasoning_content

  if (reasoningDelta) {
    const reasoningText =
      typeof reasoningDelta === "string" ? reasoningDelta : ""
    const reasoningContent = mergeReasoningContent(fullText, reasoningText || "")
    fullText = reasoningContent
    contentToSave = reasoningContent
    apiReasoning = true
  } else if (apiReasoning) {
    fullText += "</think>"
    contentToSave += "</think>"
    apiReasoning = false
  }

  if (token) {
    fullText += token
    contentToSave += token
  }

  return { fullText, contentToSave, apiReasoning, token }
}
