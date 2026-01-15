export interface GgufModelMetadata {
  quantization?: string
  parameterCount?: string
}

const QUANTIZATION_PATTERN =
  /(?:^|[^A-Z0-9])(IQ\d+_[A-Z0-9_]+|Q\d+_[A-Z0-9_]+|Q\d+|F16|F32|BF16|FP16|FP32)(?:$|[^A-Z0-9])/i

const MOE_SIZE_PATTERN =
  /(?:^|[^A-Z0-9])(\d+X\d+B)(?:$|[^A-Z0-9])/i

const SIZE_PATTERN =
  /(?:^|[^A-Z0-9])(\d+(?:\.\d+)?B)(?:$|[^A-Z0-9])/i

export const parseGgufModelMetadata = (filename: string): GgufModelMetadata => {
  const base = String(filename || "").replace(/\.gguf$/i, "")

  const quantization = (() => {
    const match = base.match(QUANTIZATION_PATTERN)
    return match?.[1]?.toUpperCase()
  })()

  const parameterCount = (() => {
    const moeMatch = base.match(MOE_SIZE_PATTERN)
    if (moeMatch?.[1]) return moeMatch[1].toUpperCase()
    const match = base.match(SIZE_PATTERN)
    return match?.[1]?.toUpperCase()
  })()

  return {
    quantization: quantization || undefined,
    parameterCount: parameterCount || undefined
  }
}
