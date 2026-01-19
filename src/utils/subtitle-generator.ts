/**
 * Subtitle generation utilities for creating SRT and VTT files
 * from audiobook chapter timing data.
 */

import type { ChapterTiming } from "./audio-concat"

export type SubtitleFormat = "srt" | "vtt"

/**
 * Formats time in seconds to SRT timestamp format (HH:MM:SS,mmm)
 */
function formatSrtTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  const ms = Math.round((seconds % 1) * 1000)

  return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")},${ms.toString().padStart(3, "0")}`
}

/**
 * Formats time in seconds to VTT timestamp format (HH:MM:SS.mmm)
 */
function formatVttTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  const ms = Math.round((seconds % 1) * 1000)

  return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}.${ms.toString().padStart(3, "0")}`
}

/**
 * Generates SRT subtitle content from chapter timings
 *
 * SRT Format:
 * 1
 * 00:00:00,000 --> 00:01:30,000
 * Chapter Title
 *
 * 2
 * 00:01:30,000 --> 00:03:00,000
 * Chapter Title
 */
export function generateSrt(chapters: ChapterTiming[]): string {
  return chapters
    .map((chapter, index) => {
      const startTime = formatSrtTime(chapter.startTime)
      const endTime = formatSrtTime(chapter.endTime)
      return `${index + 1}\n${startTime} --> ${endTime}\n${chapter.title}`
    })
    .join("\n\n")
}

/**
 * Generates VTT (WebVTT) subtitle content from chapter timings
 *
 * VTT Format:
 * WEBVTT
 *
 * 1
 * 00:00:00.000 --> 00:01:30.000
 * Chapter Title
 */
export function generateVtt(chapters: ChapterTiming[]): string {
  const header = "WEBVTT\n\n"
  const cues = chapters
    .map((chapter, index) => {
      const startTime = formatVttTime(chapter.startTime)
      const endTime = formatVttTime(chapter.endTime)
      return `${index + 1}\n${startTime} --> ${endTime}\n${chapter.title}`
    })
    .join("\n\n")

  return header + cues
}

/**
 * Generates subtitles in the specified format
 */
export function generateSubtitles(
  chapters: ChapterTiming[],
  format: SubtitleFormat
): string {
  if (format === "srt") {
    return generateSrt(chapters)
  }
  return generateVtt(chapters)
}

/**
 * Downloads subtitle content as a file
 */
export function downloadSubtitles(
  content: string,
  filename: string,
  format: SubtitleFormat
): void {
  const mimeType = format === "srt" ? "text/srt" : "text/vtt"
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `${filename}.${format}`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Generates and downloads subtitles in the specified format
 */
export function exportSubtitles(
  chapters: ChapterTiming[],
  filename: string,
  format: SubtitleFormat
): void {
  const content = generateSubtitles(chapters, format)
  downloadSubtitles(content, filename, format)
}
