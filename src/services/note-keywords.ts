import { bgRequest } from "@/services/background-proxy"
import { buildQuery } from "@/services/resource-client"

const KEYWORDS_CACHE_TTL_MS = 5 * 60 * 1000

type KeywordCacheEntry = {
  data: string[]
  expiresAt: number
}

const listCache = new Map<number, KeywordCacheEntry>()
const listInFlight = new Map<number, Promise<string[]>>()
const allCache = new Map<number, KeywordCacheEntry>()
const allInFlight = new Map<number, Promise<string[]>>()

const normalizeKeyword = (value: any): string | null => {
  const raw =
    value?.keyword ??
    value?.keyword_text ??
    value?.text ??
    value
  if (raw == null) return null
  const text = String(raw).trim()
  return text.length ? text : null
}

const dedupeKeywords = (items: string[]): string[] => {
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of items) {
    if (seen.has(item)) continue
    seen.add(item)
    out.push(item)
  }
  return out
}

export const getNoteKeywords = async (limit = 200): Promise<string[]> => {
  const now = Date.now()
  const cached = listCache.get(limit)
  if (cached && cached.expiresAt > now) return cached.data

  const inFlight = listInFlight.get(limit)
  if (inFlight) return inFlight

  const request = (async () => {
    const abs = await bgRequest<any>({
      path: `/api/v1/notes/keywords${buildQuery({ limit })}` as any,
      method: "GET" as any
    })
    const arr = Array.isArray(abs)
      ? abs
          .map((item: any) => normalizeKeyword(item))
          .filter(Boolean) as string[]
      : []
    const deduped = dedupeKeywords(arr)
    listCache.set(limit, {
      data: deduped,
      expiresAt: Date.now() + KEYWORDS_CACHE_TTL_MS
    })
    return deduped
  })()

  listInFlight.set(limit, request)
  try {
    return await request
  } finally {
    listInFlight.delete(limit)
  }
}

export const getAllNoteKeywords = async (pageSize = 1000): Promise<string[]> => {
  const now = Date.now()
  const cached = allCache.get(pageSize)
  if (cached && cached.expiresAt > now) return cached.data

  const inFlight = allInFlight.get(pageSize)
  if (inFlight) return inFlight

  const request = (async () => {
    const out: string[] = []
    let offset = 0
    const maxPages = 100

    for (let page = 0; page < maxPages; page += 1) {
      const abs = await bgRequest<any>({
        path: `/api/v1/notes/keywords${buildQuery({ limit: pageSize, offset })}` as any,
        method: "GET" as any
      })
      const arr = Array.isArray(abs)
        ? abs
            .map((item: any) => normalizeKeyword(item))
            .filter(Boolean) as string[]
        : []
      if (!arr.length) break
      out.push(...arr)
      if (arr.length < pageSize) break
      offset += pageSize
    }

    const deduped = dedupeKeywords(out)
    allCache.set(pageSize, {
      data: deduped,
      expiresAt: Date.now() + KEYWORDS_CACHE_TTL_MS
    })
    return deduped
  })()

  allInFlight.set(pageSize, request)
  try {
    return await request
  } finally {
    allInFlight.delete(pageSize)
  }
}

export const searchNoteKeywords = async (
  query: string,
  limit = 10
): Promise<string[]> => {
  const q = String(query || "").trim()
  if (!q) return []
  const abs = await bgRequest<any>({
    path: `/api/v1/notes/keywords/search${buildQuery({ query: q, limit })}` as any,
    method: "GET" as any
  })
  const arr = Array.isArray(abs)
    ? abs
        .map((item: any) => normalizeKeyword(item))
        .filter(Boolean) as string[]
    : []
  return dedupeKeywords(arr)
}
