export interface TextStats {
  wordCount: number
  charCount: number
  paragraphCount: number
}

export const getTextStats = (text: string): TextStats => {
  const safeText = text || ''
  const trimmed = safeText.trim()

  const charCount = safeText.length
  const wordCount = trimmed
    ? trimmed.split(/\s+/).filter((word) => word.length > 0).length
    : 0
  const paragraphCount = trimmed
    ? safeText
        .split(/\n\n/)
        .filter((paragraph) => paragraph.trim().length > 0).length
    : 0

  return {
    wordCount,
    charCount,
    paragraphCount
  }
}

