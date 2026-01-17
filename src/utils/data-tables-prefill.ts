import { createSafeStorage } from "@/utils/safe-storage"
import type { DataTable, DataTableSource } from "@/types/data-tables"

export type DataTablesPrefill =
  | {
      kind: "chat"
      source: DataTableSource
    }
  | {
      kind: "artifact"
      table: DataTable
      source?: DataTableSource
    }

const PREFILL_KEY = "__tldw_dataTables_prefill"
const storage = createSafeStorage({ area: "local" })

export const queueDataTablesPrefill = async (
  payload: DataTablesPrefill
): Promise<void> => {
  try {
    await storage.set(PREFILL_KEY, payload)
  } catch {
    // ignore storage failures; prefill is optional
  }
}

export const consumeDataTablesPrefill = async (): Promise<DataTablesPrefill | null> => {
  try {
    const payload = await storage.get<DataTablesPrefill | null>(PREFILL_KEY)
    if (payload) {
      await storage.remove(PREFILL_KEY)
      return payload
    }
  } catch {
    // ignore storage failures
  }
  return null
}
