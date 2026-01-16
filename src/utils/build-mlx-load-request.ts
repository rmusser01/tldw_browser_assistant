import type { MlxLoadRequest } from "@/services/tldw/TldwApiClient"

export interface MlxLoadRequestInput {
  modelPath: string
  compile: boolean
  warmup: boolean
  maxConcurrent: number
  device: string
  maxSeqLen?: number
  maxBatchSize?: number
  dtype: string
  maxKvCacheSize?: number
  quantization: string
  revision: string
  trustRemoteCode: boolean
  tokenizer: string
  promptTemplate: string
  adapter: string
  adapterWeights: string
}

export const buildMlxLoadRequest = ({
  modelPath,
  compile,
  warmup,
  maxConcurrent,
  device,
  maxSeqLen,
  maxBatchSize,
  dtype,
  maxKvCacheSize,
  quantization,
  revision,
  trustRemoteCode,
  tokenizer,
  promptTemplate,
  adapter,
  adapterWeights
}: MlxLoadRequestInput): MlxLoadRequest => {
  const req: MlxLoadRequest = {
    model_path: modelPath.trim(),
    compile,
    warmup,
    max_concurrent: maxConcurrent
  }

  if (device && device !== "auto") req.device = device
  if (maxSeqLen !== undefined) req.max_seq_len = maxSeqLen
  if (maxBatchSize !== undefined) req.max_batch_size = maxBatchSize
  if (dtype && dtype !== "auto") req.dtype = dtype
  if (maxKvCacheSize !== undefined) req.max_kv_cache_size = maxKvCacheSize
  if (quantization) req.quantization = quantization
  if (revision.trim()) req.revision = revision.trim()
  if (trustRemoteCode) req.trust_remote_code = true
  if (tokenizer.trim()) req.tokenizer = tokenizer.trim()
  if (promptTemplate.trim()) req.prompt_template = promptTemplate.trim()
  if (adapter.trim()) req.adapter = adapter.trim()
  if (adapterWeights.trim()) req.adapter_weights = adapterWeights.trim()

  return req
}
