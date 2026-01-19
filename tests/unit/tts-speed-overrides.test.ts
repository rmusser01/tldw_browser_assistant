import { describe, expect, test } from "bun:test"
import { applyVoiceSpeedOverrides } from "../../src/utils/tts-speed"

describe("applyVoiceSpeedOverrides", () => {
  test("maps speed for tldw provider", () => {
    const result = applyVoiceSpeedOverrides({
      provider: "tldw",
      tldwModel: "model-a",
      speed: 1.25
    })
    expect(result.tldwSpeed).toBe(1.25)
    expect(result.openAiSpeed).toBeUndefined()
    expect(result.elevenLabsSpeed).toBeUndefined()
  })

  test("maps speed for openai provider", () => {
    const result = applyVoiceSpeedOverrides({
      provider: "openai",
      openAiModel: "tts-1",
      speed: 1.4
    })
    expect(result.openAiSpeed).toBe(1.4)
    expect(result.tldwSpeed).toBeUndefined()
  })

  test("maps speed for elevenlabs provider", () => {
    const result = applyVoiceSpeedOverrides({
      provider: "elevenlabs",
      elevenLabsModel: "eleven",
      speed: 0.8
    })
    expect(result.elevenLabsSpeed).toBe(0.8)
    expect(result.openAiSpeed).toBeUndefined()
  })

  test("fans speed out when provider is unset", () => {
    const result = applyVoiceSpeedOverrides({ speed: 1.1 })
    expect(result.tldwSpeed).toBe(1.1)
    expect(result.openAiSpeed).toBe(1.1)
    expect(result.elevenLabsSpeed).toBe(1.1)
  })

  test("returns original overrides when speed is missing", () => {
    const result = applyVoiceSpeedOverrides({ provider: "openai", openAiVoice: "nova" })
    expect(result).toEqual({ provider: "openai", openAiVoice: "nova" })
  })
})
