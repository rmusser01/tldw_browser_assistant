import { getModelInfo, isCustomModel } from "@/db/dexie/models"
import { Storage } from "@plasmohq/storage"
import { createSafeStorage } from "@/utils/safe-storage"

const storage = createSafeStorage()

export const getSelectedModelName = async (): Promise<string> => {
    const selectedModel = await storage.get("selectedModel")
    const isCustom = isCustomModel(selectedModel)
    if (isCustom) {
        const customModel = await getModelInfo(selectedModel)
        if (customModel) {
            return customModel.name
        } else {
            return selectedModel
        }
    }
    return selectedModel
}
