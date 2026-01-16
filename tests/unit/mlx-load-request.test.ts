import { describe, expect, test } from "bun:test"
import { buildMlxLoadRequest } from "../../src/utils/build-mlx-load-request"

describe("buildMlxLoadRequest", () => {
  test("builds minimal payload and omits auto settings", () => {
    const payload = buildMlxLoadRequest({
      modelPath: "mlx-community/model",
      compile: true,
      warmup: true,
      maxConcurrent: 1,
      device: "auto",
      maxSeqLen: undefined,
      maxBatchSize: undefined,
      dtype: "auto",
      maxKvCacheSize: undefined,
      quantization: "",
      revision: "",
      trustRemoteCode: false,
      tokenizer: "",
      promptTemplate: "",
      adapter: "",
      adapterWeights: ""
    })

    expect(payload).toEqual({
      model_path: "mlx-community/model",
      compile: true,
      warmup: true,
      max_concurrent: 1
    })
  })

  test("includes optional overrides and trims strings", () => {
    const payload = buildMlxLoadRequest({
      modelPath: "  local/model  ",
      compile: false,
      warmup: false,
      maxConcurrent: 2,
      device: "mps",
      maxSeqLen: 4096,
      maxBatchSize: 8,
      dtype: "float16",
      maxKvCacheSize: 1024,
      quantization: "4bit",
      revision: " main ",
      trustRemoteCode: true,
      tokenizer: " tokenizer ",
      promptTemplate: " template ",
      adapter: " adapter ",
      adapterWeights: " weights "
    })

    expect(payload).toEqual({
      model_path: "local/model",
      compile: false,
      warmup: false,
      max_concurrent: 2,
      device: "mps",
      max_seq_len: 4096,
      max_batch_size: 8,
      dtype: "float16",
      max_kv_cache_size: 1024,
      quantization: "4bit",
      revision: "main",
      trust_remote_code: true,
      tokenizer: "tokenizer",
      prompt_template: "template",
      adapter: "adapter",
      adapter_weights: "weights"
    })
  })
})
