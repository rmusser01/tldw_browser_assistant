export interface LlamacppServerArgsInput {
  contextSize: number
  gpuLayers: number
  threads?: number
  batchSize?: number
  mlock: boolean
  customArgs?: Record<string, any>
}

export interface LlamacppServerArgs {
  n_ctx?: number
  n_gpu_layers?: number
  threads?: number
  n_batch?: number
  mlock?: boolean
  [key: string]: any
}

export const buildLlamacppServerArgs = ({
  contextSize,
  gpuLayers,
  threads,
  batchSize,
  mlock,
  customArgs
}: LlamacppServerArgsInput): LlamacppServerArgs => {
  const args: LlamacppServerArgs = {
    n_ctx: contextSize,
    n_gpu_layers: gpuLayers
  }

  if (threads !== undefined) args.threads = threads
  if (batchSize !== undefined) args.n_batch = batchSize
  if (mlock) args.mlock = true

  return { ...args, ...(customArgs || {}) }
}
