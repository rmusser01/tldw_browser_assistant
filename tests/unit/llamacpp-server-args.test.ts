import { describe, expect, test } from "bun:test"
import { buildLlamacppServerArgs } from "../../src/utils/build-llamacpp-server-args"

describe("buildLlamacppServerArgs", () => {
  test("builds base args and omits unset optional fields", () => {
    const args = buildLlamacppServerArgs({
      contextSize: 4096,
      gpuLayers: 0,
      mlock: false,
      customArgs: {}
    })

    expect(args).toEqual({
      n_ctx: 4096,
      n_gpu_layers: 0
    })
  })

  test("merges custom args and respects overrides", () => {
    const args = buildLlamacppServerArgs({
      contextSize: 4096,
      gpuLayers: 4,
      threads: 8,
      batchSize: 512,
      mlock: true,
      customArgs: { n_ctx: 2048, foo: "bar" }
    })

    expect(args).toEqual({
      n_ctx: 2048,
      n_gpu_layers: 4,
      threads: 8,
      n_batch: 512,
      mlock: true,
      foo: "bar"
    })
  })
})
