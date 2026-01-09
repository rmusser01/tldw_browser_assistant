import React, { useRef, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { Card, Tag, Typography, Collapse } from "antd"
import { useDarkMode } from "@/hooks/useDarkmode"
import { getChunkColor, type Chunk } from "@/services/chunking"

const { Text } = Typography

interface ChunkCardViewProps {
  chunks: Chunk[]
  highlightedIndex: number | null
  onChunkHover?: (index: number | null) => void
}

export const ChunkCardView: React.FC<ChunkCardViewProps> = ({
  chunks,
  highlightedIndex,
  onChunkHover
}) => {
  const { t } = useTranslation(["settings"])
  const { mode } = useDarkMode()
  const isDark = mode === "dark"
  const cardRefs = useRef<Map<number, HTMLDivElement>>(new Map())

  // Scroll to highlighted card when changed externally
  useEffect(() => {
    if (highlightedIndex !== null) {
      const card = cardRefs.current.get(highlightedIndex)
      if (card) {
        card.scrollIntoView({ behavior: "smooth", block: "nearest" })
      }
    }
  }, [highlightedIndex])

  const renderChunkCard = (chunk: Chunk, index: number) => {
    const isHighlighted = highlightedIndex === index
    const color = getChunkColor(index, isDark)
    const metadata = chunk.metadata

    const charCount = metadata.char_count ?? chunk.text.length
    const wordCount = metadata.word_count ?? 0

    return (
      <div
        key={index}
        ref={(el) => {
          if (el) cardRefs.current.set(index, el)
        }}
        onMouseEnter={() => onChunkHover?.(index)}
        onMouseLeave={() => onChunkHover?.(null)}>
        <Card
          size="small"
          className={`mb-3 transition-all ${
            isHighlighted ? "ring-2 ring-focus shadow-lg" : ""
          }`}
          style={{
            borderLeft: `4px solid ${color.replace("0.3", "0.8")}`
          }}
          title={
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="font-medium">
                {t("settings:chunkingPlayground.chunkIndex", "Chunk {{index}}", {
                  index: index + 1
                })}
              </span>
              <div className="flex gap-1">
                <Tag color="blue">{charCount} chars</Tag>
                <Tag color="green">{wordCount} words</Tag>
                {metadata.overlap_with_previous != null &&
                  metadata.overlap_with_previous > 0 && (
                    <Tag color="orange">
                      +{metadata.overlap_with_previous} overlap
                    </Tag>
                  )}
              </div>
            </div>
          }>
          <Collapse
            ghost
            items={[
              {
                key: "1",
                label: (
                  <Text className="text-sm" ellipsis>
                    {chunk.text.slice(0, 150)}
                    {chunk.text.length > 150 ? "..." : ""}
                  </Text>
                ),
                children: (
                  <div
                    className="p-2 rounded font-mono text-xs whitespace-pre-wrap break-words"
                    style={{ backgroundColor: color }}>
                    {chunk.text}
                  </div>
                )
              }
            ]}
          />

          {/* Position info */}
          <div className="mt-2 text-xs text-text-muted">
            {t(
              "settings:chunkingPlayground.position",
              "Position: {{start}} - {{end}}",
              {
                start: metadata.start_char,
                end: metadata.end_char
              }
            )}
          </div>
        </Card>
      </div>
    )
  }

  if (chunks.length === 0) {
    return null
  }

  return (
    <div className="max-h-[600px] overflow-y-auto custom-scrollbar">
      {chunks.map((chunk, index) => renderChunkCard(chunk, index))}
    </div>
  )
}
