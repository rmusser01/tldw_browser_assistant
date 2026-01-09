import React, { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { Tooltip } from "antd"
import { useDarkMode } from "@/hooks/useDarkmode"
import { getChunkColor, type Chunk } from "@/services/chunking"

interface ChunkInlineViewProps {
  originalText: string
  chunks: Chunk[]
  highlightedIndex: number | null
  onChunkClick?: (index: number | null) => void
}

interface TextSegment {
  text: string
  chunkIndices: number[] // Can belong to multiple chunks if overlap
  start: number
  end: number
}

const adjustColorOpacity = (color: string, delta: number): string => {
  const match = color.match(
    /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/
  )
  if (!match) return color
  const [, r, g, b, a = "1"] = match
  const alpha = Number.parseFloat(a)
  if (Number.isNaN(alpha)) return color
  const newAlpha = Math.min(1, Math.max(0, alpha + delta))
  return `rgba(${r}, ${g}, ${b}, ${newAlpha})`
}

export const ChunkInlineView: React.FC<ChunkInlineViewProps> = ({
  originalText,
  chunks,
  highlightedIndex,
  onChunkClick
}) => {
  const { t } = useTranslation(["settings"])
  const { mode } = useDarkMode()
  const isDark = mode === "dark"

  // Build segments from chunks with proper overlap handling
  const segments = useMemo(() => {
    if (!chunks.length || !originalText) return []

    // Collect all boundary points
    const boundaries = new Set<number>()
    boundaries.add(0)
    boundaries.add(originalText.length)

    for (const chunk of chunks) {
      boundaries.add(chunk.metadata.start_char)
      boundaries.add(chunk.metadata.end_char)
    }

    // Sort boundaries
    const sortedBoundaries = Array.from(boundaries).sort((a, b) => a - b)

    // Create segments between boundaries
    const result: TextSegment[] = []
    for (let i = 0; i < sortedBoundaries.length - 1; i++) {
      const start = sortedBoundaries[i]
      const end = sortedBoundaries[i + 1]

      if (start >= end) continue

      // Find which chunks this segment belongs to
      const chunkIndices: number[] = []
      chunks.forEach((chunk, idx) => {
        if (start >= chunk.metadata.start_char && end <= chunk.metadata.end_char) {
          chunkIndices.push(idx)
        }
      })

      result.push({
        text: originalText.slice(start, end),
        chunkIndices,
        start,
        end
      })
    }

    return result
  }, [originalText, chunks])

  const getSegmentStyle = (
    segment: TextSegment
  ): React.CSSProperties => {
    if (segment.chunkIndices.length === 0) {
      return {}
    }

    const isHighlighted = segment.chunkIndices.includes(highlightedIndex ?? -1)

    if (segment.chunkIndices.length === 1) {
      // Single chunk - solid color
      const color = getChunkColor(segment.chunkIndices[0], isDark)
      return {
        backgroundColor: isHighlighted
          ? adjustColorOpacity(color, 0.3)
          : color,
        cursor: "pointer",
        transition: "background-color 0.2s"
      }
    }

    // Overlap region - use striped pattern
    const colors = segment.chunkIndices.map((idx) => getChunkColor(idx, isDark))
    const stripeWidth = 4 // pixels

    // Create a diagonal stripe gradient
    const gradientStops = colors.flatMap((color, i) => [
      `${color} ${i * stripeWidth}px`,
      `${color} ${(i + 1) * stripeWidth}px`
    ])

    return {
      backgroundImage: `repeating-linear-gradient(
        45deg,
        ${gradientStops.join(", ")}
      )`,
      backgroundSize: `${stripeWidth * colors.length * 2}px ${stripeWidth * colors.length * 2}px`,
      cursor: "pointer",
      transition: "opacity 0.2s",
      opacity: isHighlighted ? 1 : 0.8,
      border: isHighlighted ? "1px solid rgba(0,0,0,0.3)" : "none"
    }
  }

  const renderSegment = (segment: TextSegment, idx: number) => {
    if (segment.chunkIndices.length === 0) {
      // Not part of any chunk - render as plain text
      return (
        <span key={idx} className="text-text-subtle">
          {segment.text}
        </span>
      )
    }

    const chunkInfo = segment.chunkIndices.map((chunkIdx) => {
      const chunk = chunks[chunkIdx]
      return t(
        "settings:chunkingPlayground.chunkInfo",
        "Chunk {{index}}: {{words}} words",
        {
          index: chunkIdx + 1,
          words: chunk.metadata.word_count
        }
      )
    })

    const isOverlap = segment.chunkIndices.length > 1

    return (
      <Tooltip
        key={idx}
        title={
          <div>
            {isOverlap && (
              <div className="font-bold text-warn mb-1">
                {t("settings:chunkingPlayground.overlapRegion", "Overlap Region")}
              </div>
            )}
            {chunkInfo.map((info, i) => (
              <div key={i}>{info}</div>
            ))}
          </div>
        }
        placement="top">
        <span
          style={getSegmentStyle(segment)}
          className="rounded-sm px-0.5"
          onClick={() => {
            // Click to highlight the first chunk in this segment
            onChunkClick?.(segment.chunkIndices[0])
          }}>
          {segment.text}
        </span>
      </Tooltip>
    )
  }

  if (!originalText || chunks.length === 0) {
    return null
  }

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex flex-wrap gap-2 text-xs">
        {chunks.slice(0, 8).map((_, idx) => (
          <div
            key={idx}
            className="flex items-center gap-1 px-2 py-1 rounded"
            style={{ backgroundColor: getChunkColor(idx, isDark) }}>
            <span>
              {t("settings:chunkingPlayground.chunkIndex", "Chunk {{index}}", {
                index: idx + 1
              })}
            </span>
          </div>
        ))}
        {chunks.length > 8 && (
          <span className="text-text-muted">
            {t("settings:chunkingPlayground.additionalChunks", "+{{count}} more", {
              count: chunks.length - 8
            })}
          </span>
        )}
      </div>

      {/* Text with highlights */}
      <div
        className="p-4 rounded-lg bg-surface2 font-mono text-sm whitespace-pre-wrap break-words max-h-[500px] overflow-y-auto custom-scrollbar"
        style={{ lineHeight: 1.8 }}>
        {segments.map((segment, idx) => renderSegment(segment, idx))}
      </div>

      {/* Click hint */}
      <p className="text-xs text-text-muted text-center">
        {t(
          "settings:chunkingPlayground.clickHint",
          "Click on a highlighted section to focus on that chunk"
        )}
      </p>
    </div>
  )
}
