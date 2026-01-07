import { createSafeStorage } from "@/utils/safe-storage"

export type LocalRegistryRecord<T> = {
  value: T
  updatedAt: number
}

type LocalRegistryBucketOptions = {
  prefix: string
  ttlMs?: number
}

export type LocalRegistryBucket<T> = {
  get: (key: string) => Promise<LocalRegistryRecord<T> | null>
  set: (key: string, value: T, updatedAt?: number) => Promise<void>
  remove: (key: string) => Promise<void>
  cleanup: () => Promise<number>
  buildKey: (key: string) => string
}

const storage = createSafeStorage({ area: "local" })

const parseRecord = <T>(raw: unknown): LocalRegistryRecord<T> | null => {
  if (!raw || typeof raw !== "object") return null
  if (!("value" in raw) || !("updatedAt" in raw)) return null
  const record = raw as LocalRegistryRecord<T>
  if (!Number.isFinite(record.updatedAt)) return null
  return record
}

const isStale = (updatedAt: number, now: number, ttlMs?: number) => {
  if (!ttlMs) return false
  return now - updatedAt > ttlMs
}

export const createLocalRegistryBucket = <T>({
  prefix,
  ttlMs
}: LocalRegistryBucketOptions): LocalRegistryBucket<T> => {
  const buildKey = (key: string) => `${prefix}${key}`

  const get = async (key: string): Promise<LocalRegistryRecord<T> | null> => {
    const storageKey = buildKey(key)
    try {
      const raw = await storage.get(storageKey)
      if (raw == null) return null
      const record = parseRecord<T>(raw)
      if (!record) {
        await storage.remove(storageKey)
        return null
      }
      if (isStale(record.updatedAt, Date.now(), ttlMs)) {
        await storage.remove(storageKey)
        return null
      }
      return record
    } catch {
      return null
    }
  }

  const set = async (key: string, value: T, updatedAt = Date.now()): Promise<void> => {
    const storageKey = buildKey(key)
    try {
      await storage.set(storageKey, { value, updatedAt })
    } catch {
      // ignore storage errors
    }
  }

  const remove = async (key: string): Promise<void> => {
    const storageKey = buildKey(key)
    try {
      await storage.remove(storageKey)
    } catch {
      // ignore storage errors
    }
  }

  const cleanup = async (): Promise<number> => {
    try {
      const entries = await storage.getAll()
      const now = Date.now()
      const keysToRemove = Object.entries(entries)
        .filter(([key]) => key.startsWith(prefix))
        .filter(([, value]) => {
          const record = parseRecord<T>(value)
          return !record || isStale(record.updatedAt, now, ttlMs)
        })
        .map(([key]) => key)

      if (keysToRemove.length > 0) {
        await storage.removeMany(keysToRemove)
      }
      return keysToRemove.length
    } catch {
      return 0
    }
  }

  return {
    get,
    set,
    remove,
    cleanup,
    buildKey
  }
}
