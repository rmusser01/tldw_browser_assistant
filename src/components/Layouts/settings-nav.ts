import type { LucideIcon } from "lucide-react"
import { optionRoutes, type NavGroupKey } from "@/routes/route-registry"

export type SettingsNavItem = {
  to: string
  icon: LucideIcon
  labelToken: string
  beta?: boolean
}

export type SettingsNavGroup = {
  key: string
  titleToken: string
  items: SettingsNavItem[]
}

const NAV_GROUPS: Array<{ key: NavGroupKey; titleToken: string }> = [
  { key: "server", titleToken: "settings:navigation.serverAndAuth" },
  { key: "knowledge", titleToken: "settings:navigation.knowledgeTools" },
  { key: "workspace", titleToken: "settings:navigation.workspace" },
  { key: "about", titleToken: "settings:navigation.about" }
]

type NavItemWithOrder = SettingsNavItem & { order: number }

const navItemsByGroup = optionRoutes.reduce((acc, route) => {
  if (!route.nav) return acc
  const { group, labelToken, icon, beta, order } = route.nav
  const items = acc.get(group) ?? []
  items.push({ to: route.path, icon, labelToken, beta, order })
  acc.set(group, items)
  return acc
}, new Map<NavGroupKey, NavItemWithOrder[]>())

export const SETTINGS_NAV_GROUPS: SettingsNavGroup[] = NAV_GROUPS.map((group) => {
  const items = (navItemsByGroup.get(group.key) ?? [])
    .sort((a, b) => a.order - b.order)
    .map(({ order, ...item }) => item)
  return {
    key: group.key,
    titleToken: group.titleToken,
    items
  }
}).filter((group) => group.items.length > 0)
