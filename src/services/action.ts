import { Storage } from "@plasmohq/storage"
import { createSafeStorage } from "@/utils/safe-storage"

const storage = createSafeStorage({
    area: "local"
})


export const getInitialConfig = async () => {
    const actionIconClickValue = await storage.get("actionIconClick")
    const contextMenuClickValue = await storage.get("contextMenuClick")

    let actionIconClick = actionIconClickValue || "webui"
    let contextMenuClick = contextMenuClickValue || "sidePanel"

    return {
        actionIconClick,
        contextMenuClick
    }

}

export const getActionIconClick = async () => {
    const actionIconClickValue = await storage.get("actionIconClick")
    return actionIconClickValue || "webui"
}
