import type { DraftSection } from "@/db/dexie/types"

export type SectionStrategy =
  | "server"
  | "headings"
  | "paragraphs"
  | "timestamps"

type SegmentInput = Record<string, any>

const headingRegex = /^(#{1,6})\s+(.+)$/
const timestampRegex = /^\s*(?:\d{1,2}:)?\d{1,2}:\d{2}(?:\.\d+)?/

const formatTimestamp = (seconds?: number): string | null => {
  if (seconds == null || Number.isNaN(Number(seconds))) return null
  const total = Math.max(0, Math.floor(seconds))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
  return `${m}:${String(s).padStart(2, "0")}`
}

const lineOffsets = (content: string) => {
  const lines = content.split("\n")
  const offsets: number[] = []
  let offset = 0
  lines.forEach((line, i) => {
    offsets.push(offset)
    offset += line.length + (i < lines.length - 1 ? 1 : 0)
  })
  return { lines, offsets }
}

const buildSectionsFromHeadings = (content: string): DraftSection[] => {
  const { lines, offsets } = lineOffsets(content)
  const headings: Array<{ index: number; offset: number; level: number; label: string }> = []

  lines.forEach((line, i) => {
    const match = headingRegex.exec(line.trim())
    if (!match) return
    headings.push({
      index: i,
      offset: offsets[i],
      level: match[1].length,
      label: match[2].trim()
    })
  })

  if (headings.length < 2) return []

  const sections: DraftSection[] = headings.map((heading, idx) => {
    const next = headings[idx + 1]
    const startOffset = heading.offset
    const endOffset = next ? next.offset : content.length
    const contentSlice = content.slice(startOffset, endOffset).trim()
    return {
      id: crypto.randomUUID(),
      label: heading.label || `Section ${idx + 1}`,
      kind: "heading",
      startOffset,
      endOffset,
      content: contentSlice,
      level: heading.level,
      source: "heuristic"
    }
  })

  return sections.filter((section) => section.content.length > 0)
}

const buildSectionsFromTimestamps = (content: string): DraftSection[] => {
  const { lines, offsets } = lineOffsets(content)
  const markers: Array<{ index: number; offset: number; label: string }> = []

  lines.forEach((line, i) => {
    if (!timestampRegex.test(line)) return
    const label = line.trim().slice(0, 32)
    markers.push({ index: i, offset: offsets[i], label })
  })

  if (markers.length < 2) return []

  const sections: DraftSection[] = markers.map((marker, idx) => {
    const next = markers[idx + 1]
    const startOffset = marker.offset
    const endOffset = next ? next.offset : content.length
    const contentSlice = content.slice(startOffset, endOffset).trim()
    return {
      id: crypto.randomUUID(),
      label: marker.label || `Segment ${idx + 1}`,
      kind: "speaker_turn",
      startOffset,
      endOffset,
      content: contentSlice,
      source: "heuristic"
    }
  })

  return sections.filter((section) => section.content.length > 0)
}

const buildSectionsFromParagraphs = (content: string): DraftSection[] => {
  const sections: DraftSection[] = []
  const regex = /\n{2,}/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  let index = 0

  while ((match = regex.exec(content)) !== null) {
    const end = match.index
    const paragraph = content.slice(lastIndex, end).trim()
    if (paragraph) {
      sections.push({
        id: crypto.randomUUID(),
        label: `Paragraph ${index + 1}`,
        kind: "paragraph",
        startOffset: lastIndex,
        endOffset: end,
        content: paragraph,
        source: "heuristic"
      })
      index += 1
    }
    lastIndex = match.index + match[0].length
  }

  const tail = content.slice(lastIndex).trim()
  if (tail) {
    sections.push({
      id: crypto.randomUUID(),
      label: `Paragraph ${index + 1}`,
      kind: "paragraph",
      startOffset: lastIndex,
      endOffset: content.length,
      content: tail,
      source: "heuristic"
    })
  }

  return sections.length > 1 ? sections : []
}

const buildSectionsFromSegments = (
  content: string,
  segments: SegmentInput[]
): DraftSection[] => {
  let cursor = 0
  const sections: DraftSection[] = []

  segments.forEach((segment, index) => {
    const rawText =
      segment?.text ||
      segment?.content ||
      segment?.segment ||
      segment?.utterance ||
      ""
    const text = String(rawText || "").trim()
    if (!text) return

    const idx = content.indexOf(text, cursor)
    const startOffset = idx >= 0 ? idx : cursor
    const endOffset = idx >= 0 ? idx + text.length : Math.min(content.length, cursor + text.length)
    cursor = Math.max(endOffset, cursor)

    const speaker = segment?.speaker ? `Speaker ${segment.speaker}` : null
    const timeLabel = formatTimestamp(segment?.start)
    const label = speaker || timeLabel || `Segment ${index + 1}`

    sections.push({
      id: crypto.randomUUID(),
      label,
      kind: "speaker_turn",
      startOffset,
      endOffset,
      content: text,
      source: "server",
      meta: {
        start: segment?.start,
        end: segment?.end,
        speaker: segment?.speaker
      }
    })
  })

  return sections.length > 1 ? sections : []
}

export const detectSections = (
  content: string,
  segments?: SegmentInput[]
): { sections: DraftSection[]; strategy: SectionStrategy | null } => {
  const safeContent = String(content || "")
  if (!safeContent.trim()) {
    return { sections: [], strategy: null }
  }

  if (segments && Array.isArray(segments) && segments.length > 1) {
    const sections = buildSectionsFromSegments(safeContent, segments)
    if (sections.length > 0) return { sections, strategy: "server" }
  }

  const headingSections = buildSectionsFromHeadings(safeContent)
  if (headingSections.length > 0) {
    return { sections: headingSections, strategy: "headings" }
  }

  const timestampSections = buildSectionsFromTimestamps(safeContent)
  if (timestampSections.length > 0) {
    return { sections: timestampSections, strategy: "timestamps" }
  }

  const paragraphSections = buildSectionsFromParagraphs(safeContent)
  if (paragraphSections.length > 0) {
    return { sections: paragraphSections, strategy: "paragraphs" }
  }

  return { sections: [], strategy: null }
}

export const buildContentFromSections = (
  sections: DraftSection[],
  excludedIds: string[] = []
): string => {
  const excluded = new Set(excludedIds)
  const filtered = sections.filter((section) => !excluded.has(section.id))
  return filtered.map((section) => section.content).join("\n\n").trim()
}
