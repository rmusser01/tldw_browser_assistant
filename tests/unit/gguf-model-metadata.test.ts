import { describe, expect, test } from "bun:test"
import { parseGgufModelMetadata } from "../../src/utils/gguf-model-metadata"

describe("parseGgufModelMetadata", () => {
  test("detects parameter count and quantization tokens", () => {
    const meta = parseGgufModelMetadata("mistral-7b-instruct-v0.2.Q4_K_M.gguf")
    expect(meta).toEqual({
      parameterCount: "7B",
      quantization: "Q4_K_M"
    })
  })

  test("handles MoE size patterns", () => {
    const meta = parseGgufModelMetadata("mixtral-8x7b-instruct.Q6_K.gguf")
    expect(meta).toEqual({
      parameterCount: "8X7B",
      quantization: "Q6_K"
    })
  })

  test("handles fp tokens", () => {
    const meta = parseGgufModelMetadata("llama-3-70b-f16.gguf")
    expect(meta).toEqual({
      parameterCount: "70B",
      quantization: "F16"
    })
  })
})
