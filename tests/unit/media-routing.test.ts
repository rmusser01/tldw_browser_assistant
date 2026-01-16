import { describe, expect, test } from "bun:test"
import {
  inferIngestTypeFromUrl,
  inferMediaTypeFromUrl
} from "../../src/services/tldw/media-routing"

describe("media routing inference", () => {
  test("treats YouTube watch URLs as video", () => {
    const url = "https://www.youtube.com/watch?v=abc123xyz"
    expect(inferIngestTypeFromUrl(url)).toBe("video")
  })

  test("treats youtu.be short URLs as video", () => {
    const url = "https://youtu.be/abc123xyz"
    expect(inferMediaTypeFromUrl(url)).toBe("video")
  })

  test("keeps YouTube playlists as html", () => {
    const url = "https://www.youtube.com/playlist?list=PL1234567890"
    expect(inferMediaTypeFromUrl(url)).toBe("html")
  })
})
