import type { CreateTableStep, DataTableSource } from "@/types/data-tables"

import type { DataTablesPrefill } from "@/utils/data-tables-prefill"

export type CreateTableChatInput = {
  id: string
  title?: string | null
  topic_label?: string | null
}

export type CreateTableFromChatDeps = {
  isOptionsPage: boolean
  navigate?: (path: string) => void
  resetWizard: () => void
  addSource: (source: DataTableSource) => void
  setWizardStep: (step: CreateTableStep) => void
  queuePrefill: (payload: DataTablesPrefill) => Promise<void>
  openOptionsPage: () => void
}

export const buildChatTableSource = (chat: CreateTableChatInput): DataTableSource => ({
  type: "chat",
  id: chat.id,
  title: chat.title || `Chat ${chat.id}`,
  snippet: chat.topic_label || undefined
})

export const startCreateTableFromChat = async (
  chat: CreateTableChatInput,
  deps: CreateTableFromChatDeps
): Promise<void> => {
  const source = buildChatTableSource(chat)

  if (deps.isOptionsPage) {
    deps.resetWizard()
    deps.addSource(source)
    deps.setWizardStep("prompt")
    if (deps.navigate) {
      deps.navigate("/data-tables")
      return
    }
  }

  await deps.queuePrefill({ kind: "chat", source })
  deps.openOptionsPage()
}
