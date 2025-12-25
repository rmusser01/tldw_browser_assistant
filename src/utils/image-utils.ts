export const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif"
])

const BASE64_IMAGE_PATTERN =
  /^(?:[A-Za-z0-9+/_-]{4})*(?:[A-Za-z0-9+/_-]{2}==|[A-Za-z0-9+/_-]{3}=)?$/

export function decodeBase64Header(
  value: string,
  maxChars = 128,
  maxBytes = 32
): Uint8Array | null {
  if (typeof atob !== "function") return null
  if (!value) return null

  try {
    const trimmed = value.trim()
    const decoded = atob(trimmed.slice(0, Math.min(trimmed.length, maxChars)))
    const headerBytes = new Uint8Array(Math.min(decoded.length, maxBytes))
    for (let i = 0; i < headerBytes.length; i += 1) {
      headerBytes[i] = decoded.charCodeAt(i)
    }
    return headerBytes
  } catch {
    return null
  }
}

export function detectImageMime(bytes: Uint8Array): string | null {
  const isPng =
    bytes.length >= 4 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  if (isPng) return "image/png"

  const isJpeg =
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  if (isJpeg) return "image/jpeg"

  const isGif =
    bytes.length >= 6 &&
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38 &&
    (bytes[4] === 0x39 || bytes[4] === 0x37) &&
    bytes[5] === 0x61
  if (isGif) return "image/gif"

  return null
}

export function createImageDataUrl(base64: string): string | null {
  if (!base64 || typeof base64 !== "string") return null

  const trimmed = base64.trim()
  if (!trimmed) return null
  if (trimmed.toLowerCase().startsWith("data:image/")) return trimmed
  if (!BASE64_IMAGE_PATTERN.test(trimmed)) return null

  const headerBytes = decodeBase64Header(trimmed)
  if (!headerBytes) return null

  const mime = detectImageMime(headerBytes)
  if (!mime || !ALLOWED_IMAGE_MIME_TYPES.has(mime)) return null

  return `data:${mime};base64,${trimmed}`
}

export function validateAndCreateImageDataUrl(value: unknown): string {
  if (typeof value !== "string") return ""

  const trimmed = value.trim()
  if (!trimmed || trimmed.toLowerCase().startsWith("data:")) return ""

  return createImageDataUrl(trimmed) || ""
}
