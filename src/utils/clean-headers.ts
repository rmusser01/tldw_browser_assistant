type HeaderEntry = { key: string; value: string }

export const getCustomHeaders = ({
  headers
}: {
  headers?: HeaderEntry[] | unknown
}) => {
  try {
    if (!headers || !Array.isArray(headers)) return {}

    const customHeaders: Record<string, string> = {}
    for (const header of headers) {
      if (header && typeof header.key === "string" && header.value !== undefined) {
        customHeaders[header.key] = header.value
      }
    }
    return customHeaders
  } catch (e) {
    console.error(e, headers)
    return {}
  }
}
