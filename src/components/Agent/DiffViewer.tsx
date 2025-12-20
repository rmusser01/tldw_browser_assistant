/**
 * DiffViewer - Display unified diffs with hunk selection
 */

import { FC, useState, useMemo, useEffect } from "react"
import { useTranslation } from "react-i18next"
import {
  FileText,
  Plus,
  Minus,
  ChevronDown,
  ChevronRight,
  Check,
  X,
  Copy,
  CheckCheck
} from "lucide-react"
import { message } from "antd"

export interface DiffHunk {
  id: string
  oldStart: number
  oldCount: number
  newStart: number
  newCount: number
  lines: DiffLine[]
}

export interface DiffLine {
  type: "context" | "add" | "remove" | "header"
  content: string
  oldLineNum?: number
  newLineNum?: number
}

export interface FileDiff {
  id: string
  oldPath: string
  newPath: string
  hunks: DiffHunk[]
  isNew?: boolean
  isDeleted?: boolean
  isRenamed?: boolean
}

interface DiffViewerProps {
  diffs: FileDiff[]
  selectedHunks?: Set<string>
  onHunkSelectionChange?: (hunkIds: Set<string>) => void
  // Currently only unified view is implemented
  viewMode?: "unified"
  className?: string
  collapsible?: boolean
  showLineNumbers?: boolean
}

/**
 * Parse a unified diff string into structured FileDiff objects
 */
export function parseDiff(diffText: string): FileDiff[] {
  const files: FileDiff[] = []
  const lines = diffText.split("\n")
  let currentFile: FileDiff | null = null
  let currentHunk: DiffHunk | null = null
  let oldLineNum = 0
  let newLineNum = 0

  const finalizeFile = (file: FileDiff, hunk: DiffHunk | null) => {
    if (hunk) {
      file.hunks.push(hunk)
    }
    if (!file.isNew && !file.isDeleted && file.oldPath && file.newPath && file.oldPath !== file.newPath) {
      file.isRenamed = true
    }
    files.push(file)
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // File header: diff --git a/path b/path
    if (line.startsWith("diff --git")) {
      if (currentFile) {
        finalizeFile(currentFile, currentHunk)
      }
      currentFile = {
        id: `file-${files.length}`,
        oldPath: "",
        newPath: "",
        hunks: []
      }
      currentHunk = null
      continue
    }

    // Old file path: --- a/path or --- /dev/null
    if (line.startsWith("--- ")) {
      if (currentFile) {
        const path = line.slice(4)
        currentFile.oldPath = path.startsWith("a/") ? path.slice(2) : path
        if (path === "/dev/null") {
          currentFile.isNew = true
        }
      }
      continue
    }

    // New file path: +++ b/path or +++ /dev/null
    if (line.startsWith("+++ ")) {
      if (currentFile) {
        const path = line.slice(4)
        currentFile.newPath = path.startsWith("b/") ? path.slice(2) : path
        if (path === "/dev/null") {
          currentFile.isDeleted = true
        }
      }
      continue
    }

    // Rename metadata: "rename from"/"rename to"
    if (line.startsWith("rename from ")) {
      if (currentFile) {
        currentFile.isRenamed = true
        const path = line.slice("rename from ".length)
        currentFile.oldPath = path.startsWith("a/") ? path.slice(2) : path
      }
      continue
    }
    if (line.startsWith("rename to ")) {
      if (currentFile) {
        currentFile.isRenamed = true
        const path = line.slice("rename to ".length)
        currentFile.newPath = path.startsWith("b/") ? path.slice(2) : path
      }
      continue
    }

    // Hunk header: @@ -oldStart,oldCount +newStart,newCount @@
    const hunkMatch = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$/)
    if (hunkMatch && currentFile) {
      if (currentHunk) {
        currentFile.hunks.push(currentHunk)
      }
      oldLineNum = parseInt(hunkMatch[1], 10)
      newLineNum = parseInt(hunkMatch[3], 10)
      currentHunk = {
        id: `${currentFile.id}-hunk-${currentFile.hunks.length}`,
        oldStart: oldLineNum,
        oldCount: parseInt(hunkMatch[2] || "1", 10),
        newStart: newLineNum,
        newCount: parseInt(hunkMatch[4] || "1", 10),
        lines: [{
          type: "header",
          content: line
        }]
      }
      continue
    }

    // Diff content lines
    if (currentHunk) {
      if (line.startsWith("+")) {
        currentHunk.lines.push({
          type: "add",
          content: line.slice(1),
          newLineNum: newLineNum++
        })
      } else if (line.startsWith("-")) {
        currentHunk.lines.push({
          type: "remove",
          content: line.slice(1),
          oldLineNum: oldLineNum++
        })
      } else if (line.startsWith(" ") || line === "") {
        currentHunk.lines.push({
          type: "context",
          content: line.slice(1) || "",
          oldLineNum: oldLineNum++,
          newLineNum: newLineNum++
        })
      }
    }
  }

  // Push last file and hunk
  if (currentFile) {
    finalizeFile(currentFile, currentHunk)
  }

  return files
}

/**
 * Get display name for a file diff
 */
function getFilePath(diff: FileDiff): string {
  if (diff.isNew) return diff.newPath
  if (diff.isDeleted) return diff.oldPath
  if (diff.isRenamed) return `${diff.oldPath} → ${diff.newPath}`
  return diff.newPath || diff.oldPath
}

/**
 * Get file status badge
 */
const FileStatusBadge: FC<{ diff: FileDiff }> = ({ diff }) => {
  if (diff.isNew) {
    return (
      <span className="px-1.5 py-0.5 text-xs font-medium rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
        NEW
      </span>
    )
  }
  if (diff.isDeleted) {
    return (
      <span className="px-1.5 py-0.5 text-xs font-medium rounded bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
        DEL
      </span>
    )
  }
  if (diff.isRenamed) {
    return (
      <span className="px-1.5 py-0.5 text-xs font-medium rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
        RENAME
      </span>
    )
  }
  return null
}

/**
 * Line number component
 */
const LineNumber: FC<{ num?: number; className?: string }> = ({ num, className = "" }) => (
  <span className={`select-none text-gray-400 dark:text-gray-600 min-w-10 text-right pr-2 ${className}`}>
    {num ?? ""}
  </span>
)

export const DiffViewer: FC<DiffViewerProps> = ({
  diffs,
  selectedHunks,
  onHunkSelectionChange,
  viewMode = "unified",
  className = "",
  collapsible = true,
  showLineNumbers = true
}) => {
  const { t } = useTranslation("common")
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(
    () => new Set(diffs.map(d => d.id))
  )
  const [copiedHunk, setCopiedHunk] = useState<string | null>(null)

  // Track selected hunks internally if not controlled
  const [internalSelected, setInternalSelected] = useState<Set<string>>(
    () => new Set(diffs.flatMap(d => d.hunks.map(h => h.id)))
  )
  const selected = selectedHunks ?? internalSelected
  const setSelected = onHunkSelectionChange ?? setInternalSelected

  useEffect(() => {
    setExpandedFiles((prev) => {
      let changed = false
      const next = new Set(prev)
      for (const diff of diffs) {
        if (!next.has(diff.id)) {
          next.add(diff.id)
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [diffs])

  useEffect(() => {
    if (selectedHunks) {
      return
    }
    setInternalSelected((prev) => {
      let changed = false
      const next = new Set(prev)
      for (const diff of diffs) {
        for (const hunk of diff.hunks) {
          if (!next.has(hunk.id)) {
            next.add(hunk.id)
            changed = true
          }
        }
      }
      return changed ? next : prev
    })
  }, [diffs, selectedHunks])

  // Count changes
  const stats = useMemo(() => {
    let additions = 0
    let deletions = 0
    for (const diff of diffs) {
      for (const hunk of diff.hunks) {
        for (const line of hunk.lines) {
          if (line.type === "add") additions++
          if (line.type === "remove") deletions++
        }
      }
    }
    return { additions, deletions }
  }, [diffs])

  const toggleFile = (fileId: string) => {
    const next = new Set(expandedFiles)
    if (next.has(fileId)) {
      next.delete(fileId)
    } else {
      next.add(fileId)
    }
    setExpandedFiles(next)
  }

  const toggleHunk = (hunkId: string) => {
    const next = new Set(selected)
    if (next.has(hunkId)) {
      next.delete(hunkId)
    } else {
      next.add(hunkId)
    }
    setSelected(next)
  }

  const selectAllHunks = () => {
    setSelected(new Set(diffs.flatMap(d => d.hunks.map(h => h.id))))
  }

  const deselectAllHunks = () => {
    setSelected(new Set())
  }

  const copyHunk = async (hunk: DiffHunk) => {
    const text = hunk.lines
      .filter(l => l.type !== "header")
      .map(l => {
        if (l.type === "add") return `+${l.content}`
        if (l.type === "remove") return `-${l.content}`
        return ` ${l.content}`
      })
      .join("\n")

    try {
      await navigator.clipboard.writeText(text)
      setCopiedHunk(hunk.id)
      message.success(t("copiedToClipboard", "Copied to clipboard"))
      setTimeout(() => setCopiedHunk(null), 2000)
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Failed to copy hunk to clipboard:", err)
      message.error(t("copyFailed", "Failed to copy"))
    }
  }

  if (diffs.length === 0) {
    return (
      <div className={`flex items-center justify-center h-32 text-gray-400 dark:text-gray-500 ${className}`}>
        <span className="text-sm">{t("noDiffs", "No changes to display")}</span>
      </div>
    )
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Summary header */}
      <div className="flex items-center justify-between px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium">
            {diffs.length}{" "}
            {diffs.length === 1
              ? t("fileChanged", "file changed")
              : t("filesChanged", "files changed")}
          </span>
          <span className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
            <Plus className="size-3" />
            {stats.additions}
          </span>
          <span className="flex items-center gap-1 text-sm text-red-600 dark:text-red-400">
            <Minus className="size-3" />
            {stats.deletions}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={selectAllHunks}
            className="text-xs px-2 py-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-500"
            aria-label={t("selectAllHunks", "Select all diff hunks")}
          >
            {t("selectAll", "Select All")}
          </button>
          <button
            onClick={deselectAllHunks}
            className="text-xs px-2 py-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-500"
            aria-label={t("deselectAllHunks", "Deselect all diff hunks")}
          >
            {t("deselectAll", "Deselect All")}
          </button>
        </div>
      </div>

      {/* File diffs */}
      {diffs.map((diff) => {
        const isExpanded = expandedFiles.has(diff.id)
        const fileSelected = diff.hunks.every(h => selected.has(h.id))
        const filePartial = diff.hunks.some(h => selected.has(h.id)) && !fileSelected

        return (
          <div
            key={diff.id}
            className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
          >
            {/* File header */}
            <button
              onClick={() => collapsible && toggleFile(diff.id)}
              disabled={!collapsible}
              className={`w-full flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-800/50 transition-colors text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-pink-500 ${
                collapsible ? "hover:bg-gray-100 dark:hover:bg-gray-800" : "cursor-default"
              }`}
              aria-expanded={collapsible ? isExpanded : undefined}
              aria-label={`${getFilePath(diff)} - ${isExpanded ? t("collapse", "Collapse") : t("expand", "Expand")}`}
            >
              {collapsible && (
                isExpanded
                  ? <ChevronDown className="size-4 text-gray-400" />
                  : <ChevronRight className="size-4 text-gray-400" />
              )}

              <FileText className="size-4 text-gray-500" />

              <span className="font-mono text-sm flex-1 truncate">
                {getFilePath(diff)}
              </span>

              <FileStatusBadge diff={diff} />

              {/* File selection indicator */}
              <div className={`size-4 rounded border flex items-center justify-center ${
                fileSelected
                  ? "bg-blue-500 border-blue-500"
                  : filePartial
                    ? "bg-blue-200 border-blue-500"
                    : "border-gray-300 dark:border-gray-600"
              }`}>
                {fileSelected && <Check className="size-3 text-white" />}
                {filePartial && <Minus className="size-3 text-blue-500" />}
              </div>
            </button>

            {/* Hunks */}
            {isExpanded && (
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {diff.hunks.map((hunk) => {
                  const isSelected = selected.has(hunk.id)

                  return (
                    <div key={hunk.id} className="relative">
                      {/* Hunk header */}
                      <div className="flex items-center justify-between px-3 py-1 bg-blue-50 dark:bg-blue-900/20 border-b border-gray-200 dark:border-gray-700">
                        <span className="font-mono text-xs text-blue-700 dark:text-blue-300">
                          @@ -{hunk.oldStart},{hunk.oldCount} +{hunk.newStart},{hunk.newCount} @@
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => copyHunk(hunk)}
                            className="p-1 rounded hover:bg-blue-100 dark:hover:bg-blue-900/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-500"
                            title={t("copyHunk", "Copy hunk")}
                            aria-label={t("copyHunk", "Copy hunk")}
                          >
                            {copiedHunk === hunk.id ? (
                              <CheckCheck className="size-3.5 text-green-500" />
                            ) : (
                              <Copy className="size-3.5 text-gray-400" />
                            )}
                          </button>
                          <button
                            onClick={() => toggleHunk(hunk.id)}
                            className={`size-5 rounded border flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-500 ${
                              isSelected
                                ? "bg-blue-500 border-blue-500"
                                : "border-gray-300 dark:border-gray-600 hover:border-blue-400"
                            }`}
                            title={isSelected ? t("deselectHunk", "Deselect hunk") : t("selectHunk", "Select hunk")}
                            aria-label={isSelected ? t("deselectHunk", "Deselect hunk") : t("selectHunk", "Select hunk")}
                            aria-pressed={isSelected}
                          >
                            {isSelected && <Check className="size-3 text-white" />}
                          </button>
                        </div>
                      </div>

                      {/* Diff lines */}
                      <div className={`font-mono text-sm overflow-x-auto ${!isSelected ? "opacity-50" : ""}`}>
                        {hunk.lines.filter(l => l.type !== "header").map((line, idx) => (
                          <div
                            key={idx}
                          className={`flex ${
                              line.type === "add"
                                ? "bg-green-50 dark:bg-green-900/20"
                                : line.type === "remove"
                                  ? "bg-red-50 dark:bg-red-900/20"
                                  : ""
                            }`}
                          >
                            {showLineNumbers && (
                              <>
                                <LineNumber num={line.oldLineNum} className="border-r border-gray-200 dark:border-gray-700" />
                                <LineNumber num={line.newLineNum} className="border-r border-gray-200 dark:border-gray-700" />
                              </>
                            )}
                            <span className={`w-5 flex-shrink-0 text-center select-none ${
                              line.type === "add"
                                ? "text-green-600 dark:text-green-400"
                                : line.type === "remove"
                                  ? "text-red-600 dark:text-red-400"
                                  : "text-gray-400"
                            }`}>
                              {line.type === "add" ? "+" : line.type === "remove" ? "-" : " "}
                            </span>
                            <pre className="flex-1 px-2 whitespace-pre">
                              {line.content}
                            </pre>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default DiffViewer
