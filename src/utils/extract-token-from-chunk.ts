const extractText = (value: unknown): string => {
  if (typeof value === "string") return value
  if (Array.isArray(value)) {
    return value.map(extractText).filter(Boolean).join("")
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>
    const text = extractText(record.text)
    if (text) return text
    const content = extractText(record.content)
    if (content) return content
    const parts = extractText(record.parts)
    if (parts) return parts
  }
  return ""
}

export function extractTokenFromChunk(chunk: unknown): string {
  if (typeof chunk === "string") return chunk
  if (!chunk || typeof chunk !== "object") return ""

  const record = chunk as Record<string, unknown>
  const choices = Array.isArray(record.choices) ? record.choices : []
  if (choices.length > 0) {
    const choice = choices[0] as Record<string, unknown>
    const deltaText = extractText(choice.delta ?? choice.message)
    if (deltaText) return deltaText
    const choiceText = extractText(choice.text ?? choice.content ?? choice)
    if (choiceText) return choiceText
  }

  const candidates = Array.isArray(record.candidates) ? record.candidates : []
  if (candidates.length > 0) {
    const candidate = candidates[0] as Record<string, unknown>
    const candidateText = extractText(
      candidate.content ?? candidate.message ?? candidate.output ?? candidate.parts ?? candidate.text
    )
    if (candidateText) return candidateText
  }

  const rootText = extractText(
    record.delta ??
      record.content ??
      record.message ??
      record.text ??
      record.completion ??
      record.output_text
  )
  return rootText
}
