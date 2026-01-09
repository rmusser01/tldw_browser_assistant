import React from "react"
import type { TFunction } from "i18next"
import { message } from "antd"

type UseBulkChatOperationsParams = {
  selectedConversationIds: string[]
  folderApiAvailable: boolean | null
  ensureKeyword: (keyword: string) => Promise<{ id: number } | null>
  addKeywordToConversation: (
    conversationId: string,
    keywordId: number
  ) => Promise<boolean>
  t: TFunction
  setBulkFolderPickerOpen: (open: boolean) => void
  setBulkTagPickerOpen: (open: boolean) => void
}

type BulkTrashResult = {
  failedConversationIds: Set<string>
}

export const useBulkChatOperations = ({
  selectedConversationIds,
  folderApiAvailable,
  ensureKeyword,
  addKeywordToConversation,
  t,
  setBulkFolderPickerOpen,
  setBulkTagPickerOpen
}: UseBulkChatOperationsParams) => {
  const openBulkFolderPicker = React.useCallback(() => {
    if (folderApiAvailable === false) {
      message.error(
        t(
          "sidepanel:folderPicker.notAvailable",
          "Folder organization is not available on this server"
        )
      )
      return
    }
    if (selectedConversationIds.length === 0) {
      message.warning(
        t(
          "sidepanel:multiSelect.serverOnlyWarning",
          "Select chats saved on the server to apply this action."
        )
      )
      return
    }
    setBulkFolderPickerOpen(true)
  }, [folderApiAvailable, selectedConversationIds, setBulkFolderPickerOpen, t])

  const openBulkTagPicker = React.useCallback(() => {
    if (folderApiAvailable === false) {
      message.error(
        t(
          "sidepanel:multiSelect.tagsUnavailable",
          "Tags are not available on this server"
        )
      )
      return
    }
    if (selectedConversationIds.length === 0) {
      message.warning(
        t(
          "sidepanel:multiSelect.serverOnlyWarning",
          "Select chats saved on the server to apply this action."
        )
      )
      return
    }
    setBulkTagPickerOpen(true)
  }, [folderApiAvailable, selectedConversationIds, setBulkTagPickerOpen, t])

  const applyBulkTrash = React.useCallback(async (): Promise<BulkTrashResult | null> => {
    if (selectedConversationIds.length === 0) return null

    const trashKeyword = await ensureKeyword("Trash")
    if (!trashKeyword) {
      message.error(
        t(
          "sidepanel:multiSelect.deleteFailed",
          "Unable to move chats to trash."
        )
      )
      return null
    }

    const results = await Promise.allSettled(
      selectedConversationIds.map((conversationId) =>
        addKeywordToConversation(conversationId, trashKeyword.id)
      )
    )
    const failedConversationIds = new Set<string>()
    let failures = 0
    results.forEach((result, index) => {
      if (result.status === "rejected" || !result.value) {
        failures += 1
        failedConversationIds.add(selectedConversationIds[index])
      }
    })

    if (failures > 0) {
      message.error(
        t(
          "sidepanel:multiSelect.deletePartial",
          "Some chats could not be moved to trash."
        )
      )
    } else {
      message.success(
        t(
          "sidepanel:multiSelect.deleteSuccess",
          "Chats moved to trash."
        )
      )
    }

    return { failedConversationIds }
  }, [addKeywordToConversation, ensureKeyword, selectedConversationIds, t])

  return {
    openBulkFolderPicker,
    openBulkTagPicker,
    applyBulkTrash
  }
}
