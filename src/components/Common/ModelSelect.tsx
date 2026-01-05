import { useQuery } from "@tanstack/react-query"
import { Avatar, Dropdown, Tooltip } from "antd"
import { LucideBrain } from "lucide-react"
import React from "react"
import { useTranslation } from "react-i18next"
import { useStorage } from "@plasmohq/storage/hook"
import { fetchChatModels } from "@/services/tldw-server"
import { useMessage } from "@/hooks/useMessage"
import { getProviderDisplayName } from "@/utils/provider-registry"
import { ProviderIcons } from "./ProviderIcon"
import { IconButton } from "./IconButton"

type Props = {
  iconClassName?: string
  showSelectedName?: boolean
}

export const ModelSelect: React.FC<Props> = ({iconClassName = "size-5", showSelectedName = false}) => {
  const { t } = useTranslation("common")
  const { setSelectedModel, selectedModel } = useMessage()
  const [menuDensity] = useStorage("menuDensity", "comfortable")
  const { data } = useQuery({
    queryKey: ["getAllModelsForSelect"],
    queryFn: async () => {
      const models = await fetchChatModels({ returnEmpty: false })
      return models
    }
  })

  const groupedItems = React.useMemo(() => {
    const groups = new Map<string, any[]>()
    const localProviders = new Set(["lmstudio", "llamafile", "ollama", "ollama2", "llamacpp", "vllm", "custom"]) // group as "custom"
    for (const d of data || []) {
      const providerRaw = (d.provider || "other").toLowerCase()
      const groupKey = providerRaw === 'chrome' ? 'default' : (localProviders.has(providerRaw) ? 'custom' : providerRaw)
      const providerLabel = getProviderDisplayName(d.provider)
      const modelLabel = d.nickname || d.model
      const details: any = d.details || {}
      const caps: string[] = Array.isArray(details.capabilities)
        ? details.capabilities
        : []
      const hasVision = caps.includes("vision")
      const hasTools = caps.includes("tools")
      const hasFast = caps.includes("fast")

      const labelNode = (
        <div className="w-52 gap-2 text-sm truncate inline-flex items-center leading-5">
          <div>
            {d.avatar ? (
              <Avatar src={d.avatar} alt={d.name} size="small" />
            ) : (
              <ProviderIcons provider={d?.provider} className="h-4 w-4 text-text-subtle" />
            )}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="truncate">
              {providerLabel} - {modelLabel}
            </span>
            {(hasVision || hasTools || hasFast) && (
              <div className="mt-0.5 flex flex-wrap gap-1 text-[10px]">
                {hasVision && (
                  <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-primary">
                    Vision
                  </span>
                )}
                {hasTools && (
                  <span className="rounded-full bg-accent/10 px-1.5 py-0.5 text-accent">
                    Tools
                  </span>
                )}
                {hasFast && (
                  <span className="rounded-full bg-success/10 px-1.5 py-0.5 text-success">
                    Fast
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )
      const item = {
        key: d.name,
        label: labelNode,
        onClick: () => {
          if (selectedModel === d.model) {
            setSelectedModel(null)
          } else {
            setSelectedModel(d.model)
          }
        }
      }
      if (!groups.has(groupKey)) groups.set(groupKey, [])
      groups.get(groupKey)!.push(item)
    }
    // Build grouped menu items
    const items: any[] = []
    for (const [groupKey, children] of groups) {
      const labelText = groupKey === 'default' ? 'Default' : (groupKey === 'custom' ? 'Custom' : groupKey)
      const iconKey = groupKey === 'default' ? 'chrome' : groupKey
      items.push({
        type: 'group',
        key: `group-${groupKey}`,
        label: (
          <div className="flex items-center gap-1.5 text-xs leading-4 font-medium uppercase tracking-wider text-text-subtle">
            <ProviderIcons provider={iconKey} className="h-3 w-3" />
            <span>{labelText}</span>
          </div>
        ),
        children
      })
    }
    return items
  }, [data, selectedModel, setSelectedModel])

  // Get display name for selected model
  const selectedModelDisplay = React.useMemo(() => {
    if (!selectedModel || !data) return null
    const model = data.find(m => m.model === selectedModel)
    if (!model) return selectedModel.split('/').pop() || selectedModel
    // Use nickname if available, otherwise extract short name from model ID
    const shortName = model.nickname || model.model.split('/').pop() || model.model
    // Truncate if too long
    return shortName.length > 20 ? shortName.substring(0, 18) + '…' : shortName
  }, [selectedModel, data])

  return (
    <>
      {data && data.length > 0 && (
        <Dropdown
          menu={{
            items: groupedItems,
            style: {
              maxHeight: 500,
              overflowY: "scroll"
            },
            className: `no-scrollbar ${menuDensity === 'compact' ? 'menu-density-compact' : 'menu-density-comfortable'}`,
            activeKey: selectedModel
          }}
          placement={"topLeft"}
          trigger={["click"]}>
          <Tooltip
            title={
              selectedModel
                ? `${t("modelSelect.tooltip", "Changes model for next message")}: ${selectedModel}`
                : t("modelSelect.tooltip", "Changes model for next message")
            }>
            <IconButton
              ariaLabel={t("selectAModel") as string}
              hasPopup="menu"
              dataTestId="chat-model-select"
              className="px-2 text-text-muted">
              <LucideBrain className={iconClassName} />
              {showSelectedName && selectedModelDisplay ? (
                <span className="ml-1.5 max-w-[120px] truncate text-xs font-medium text-text">
                  {selectedModelDisplay}
                </span>
              ) : (
                <span className="ml-1 hidden sm:inline text-xs">
                  {t("modelSelect.label", "Model")}
                </span>
              )}
            </IconButton>
          </Tooltip>
        </Dropdown>
      )}
    </>
  )
}
