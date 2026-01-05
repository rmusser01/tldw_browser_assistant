import { SettingsBody } from "~/components/Sidepanel/Settings/body"
import { SidepanelSettingsHeader } from "~/components/Sidepanel/Settings/header"
import { useAutoButtonTitles } from "@/hooks/useAutoButtonTitles"

const SidepanelSettings = () => {
  useAutoButtonTitles()
  return (
    <div className="flex bg-neutral-50 dark:bg-surface flex-col min-h-screen mx-auto max-w-7xl">
      <div className="sticky bg-white dark:bg-surface top-0 z-10">
        <SidepanelSettingsHeader />
      </div>
      <SettingsBody />
    </div>
  )
}

export default SidepanelSettings
