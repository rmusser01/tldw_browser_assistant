import { defineSetting, getSetting } from "@/services/settings/registry"

const ACTION_ICON_CLICK_VALUES = ["webui", "sidePanel"] as const
export type ActionIconClickValue = (typeof ACTION_ICON_CLICK_VALUES)[number]
const normalizeActionIconClick = (value: unknown, fallback: ActionIconClickValue) => {
  const normalized = String(value || "")
  return ACTION_ICON_CLICK_VALUES.includes(normalized as ActionIconClickValue)
    ? (normalized as ActionIconClickValue)
    : fallback
}

const CONTEXT_MENU_CLICK_VALUES = ["sidePanel", "webui"] as const
export type ContextMenuClickValue = (typeof CONTEXT_MENU_CLICK_VALUES)[number]
const normalizeContextMenuClick = (
  value: unknown,
  fallback: ContextMenuClickValue
) => {
  const normalized = String(value || "")
  return CONTEXT_MENU_CLICK_VALUES.includes(normalized as ContextMenuClickValue)
    ? (normalized as ContextMenuClickValue)
    : fallback
}

export const ACTION_ICON_CLICK_SETTING = defineSetting(
  "actionIconClick",
  "webui" as ActionIconClickValue,
  (value) => normalizeActionIconClick(value, "webui"),
  {
    validate: (value) => ACTION_ICON_CLICK_VALUES.includes(value)
  }
)

export const CONTEXT_MENU_CLICK_SETTING = defineSetting(
  "contextMenuClick",
  "sidePanel" as ContextMenuClickValue,
  (value) => normalizeContextMenuClick(value, "sidePanel"),
  {
    validate: (value) => CONTEXT_MENU_CLICK_VALUES.includes(value)
  }
)

export const getInitialConfig = async () => {
  const actionIconClick = await getSetting(ACTION_ICON_CLICK_SETTING)
  const contextMenuClick = await getSetting(CONTEXT_MENU_CLICK_SETTING)

  return {
    actionIconClick,
    contextMenuClick
  }
}

export const getActionIconClick = async (): Promise<ActionIconClickValue> => {
  return await getSetting(ACTION_ICON_CLICK_SETTING)
}
