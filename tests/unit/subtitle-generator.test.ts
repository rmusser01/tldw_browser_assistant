import { describe, expect, test } from "bun:test"
import {
  generateSrt,
  generateVtt,
  generateSubtitles
} from "../../src/utils/subtitle-generator"

const chapters = [
  { id: "c1", title: "Intro", startTime: 0, endTime: 1.5, duration: 1.5 },
  { id: "c2", title: "Chapter 1", startTime: 1.5, endTime: 62, duration: 60.5 }
]

describe("subtitle-generator", () => {
  test("generateSrt formats chapter cues", () => {
    const srt = generateSrt(chapters)
    expect(srt).toBe(
      "1\n00:00:00,000 --> 00:00:01,500\nIntro\n\n2\n00:00:01,500 --> 00:01:02,000\nChapter 1"
    )
  })

  test("generateVtt formats chapter cues with header", () => {
    const vtt = generateVtt(chapters)
    expect(vtt).toBe(
      "WEBVTT\n\n1\n00:00:00.000 --> 00:00:01.500\nIntro\n\n2\n00:00:01.500 --> 00:01:02.000\nChapter 1"
    )
  })

  test("generateSubtitles routes by format", () => {
    expect(generateSubtitles(chapters, "srt")).toContain("00:00:00,000")
    expect(generateSubtitles(chapters, "vtt")).toContain("WEBVTT")
  })
})
