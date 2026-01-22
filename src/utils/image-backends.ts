const IMAGE_BACKEND_KEYS = new Set(["fluxklein", "zturbo"])

const normalizeImageBackendKey = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9]/g, "")

const buildImageBackendCandidates = (value?: string): string[] => {
  if (!value) return []
  const trimmed = value.trim()
  if (!trimmed) return []
  const withoutPrefix = trimmed
    .replace(/^tldw:/i, "")
    .replace(/^tldw_server[-_: ]*/i, "")
    .trim()
  const baseValue = withoutPrefix || trimmed
  if (!baseValue) return []
  const normalizedKey = normalizeImageBackendKey(baseValue)
  if (!IMAGE_BACKEND_KEYS.has(normalizedKey)) return []

  const lower = baseValue.toLowerCase()
  const hasPrefix = /^tldw[:_ -]?/i.test(trimmed) || /^tldw_server/i.test(trimmed)
  const prefixedVariants = hasPrefix
    ? []
    : [
        `tldw_server-${baseValue}`,
        `tldw_server_${baseValue}`,
        `tldw:${baseValue}`
      ]
  const candidates = [
    trimmed,
    baseValue,
    ...prefixedVariants,
    lower,
    ...prefixedVariants.map((variant) => variant.toLowerCase()),
    lower.replace(/[-\s]+/g, "_"),
    lower.replace(/[_\s]+/g, "-"),
    normalizedKey
  ]
  return Array.from(new Set(candidates.filter(Boolean)))
}

export const resolveImageBackendCandidates = (
  ...values: Array<string | null | undefined>
): string[] => {
  const candidates = new Set<string>()
  values.forEach((value) => {
    buildImageBackendCandidates(value || undefined).forEach((candidate) => {
      candidates.add(candidate)
    })
  })
  return Array.from(candidates)
}
