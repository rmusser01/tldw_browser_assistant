import React from "react"
import { useTranslation } from "react-i18next"
import { Drawer, Select, Switch, Slider, Checkbox, Button } from "antd"
import { useMessageOption } from "@/hooks/useMessageOption"
import { useNavigate } from "react-router-dom"

type AdvancedRagDrawerProps = {
  open: boolean
  onClose: () => void
}

/**
 * AdvancedRagDrawer - Advanced RAG settings drawer
 *
 * Contains all the detailed RAG configuration options
 * that power users might want to tweak.
 */
export const AdvancedRagDrawer: React.FC<AdvancedRagDrawerProps> = ({
  open,
  onClose
}) => {
  const { t } = useTranslation(["knowledge", "sidepanel", "common"])
  const navigate = useNavigate()

  const {
    chatMode,
    setChatMode,
    ragSearchMode,
    setRagSearchMode,
    ragTopK,
    setRagTopK,
    ragEnableGeneration,
    setRagEnableGeneration,
    ragEnableCitations,
    setRagEnableCitations,
    ragSources,
    setRagSources
  } = useMessageOption()

  const autoRagOn = chatMode === "rag"

  const handleResetDefaults = () => {
    setRagSearchMode("hybrid")
    setRagTopK(null)
    setRagEnableGeneration(false)
    setRagEnableCitations(false)
    setRagSources([])
  }

  return (
    <Drawer
      title={t("knowledge:settings.title", "Advanced RAG Settings")}
      placement="right"
      onClose={onClose}
      open={open}
      width={400}
      footer={
        <div className="flex justify-between">
          <Button onClick={handleResetDefaults}>
            {t("knowledge:settings.reset", "Reset to defaults")}
          </Button>
          <Button type="primary" onClick={onClose}>
            {t("common:done", "Done")}
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Auto RAG for chat */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-text">
                {t("knowledge:settings.autoRag", "RAG for every reply")}
              </div>
              <p className="text-xs text-text-muted">
                {t(
                  "knowledge:settings.autoRagHelp",
                  "Enable RAG search for all chat messages"
                )}
              </p>
            </div>
            <Switch
              checked={autoRagOn}
              onChange={(checked) => setChatMode(checked ? "rag" : "normal")}
            />
          </div>
        </div>

        {/* Search Mode */}
        <div className="space-y-2">
          <label className="block font-medium text-text">
            {t("knowledge:settings.searchMode", "Search Mode")}
          </label>
          <Select
            value={ragSearchMode}
            onChange={(val) => setRagSearchMode(val as "hybrid" | "vector" | "fts")}
            className="w-full"
            options={[
              {
                value: "hybrid",
                label: t("knowledge:settings.searchModeHybrid", "Hybrid (recommended)")
              },
              {
                value: "vector",
                label: t("knowledge:settings.searchModeVector", "Vector (semantic)")
              },
              {
                value: "fts",
                label: t("knowledge:settings.searchModeFts", "Full-text (keyword)")
              }
            ]}
          />
          <p className="text-xs text-text-muted">
            {t(
              "knowledge:settings.searchModeHelp",
              "Hybrid combines semantic and keyword search for best results"
            )}
          </p>
        </div>

        {/* Top K */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="font-medium text-text">
              {t("knowledge:settings.topK", "Results per query (top-k)")}
            </label>
            <span className="text-sm text-text-muted">
              {ragTopK ?? 10}
            </span>
          </div>
          <Slider
            min={1}
            max={50}
            value={ragTopK ?? 10}
            onChange={(val) => setRagTopK(val)}
          />
          <p className="text-xs text-text-muted">
            {t(
              "knowledge:settings.topKHelp",
              "Higher values return more results but may include less relevant content"
            )}
          </p>
        </div>

        {/* Generation options */}
        <div className="space-y-3">
          <label className="block font-medium text-text">
            {t("knowledge:settings.generationOptions", "Generation Options")}
          </label>
          <div className="space-y-2">
            <Checkbox
              checked={ragEnableGeneration}
              onChange={(e) => setRagEnableGeneration(e.target.checked)}
            >
              {t("knowledge:settings.enableGeneration", "Enable answer generation")}
            </Checkbox>
            <p className="ml-6 text-xs text-text-muted">
              {t(
                "knowledge:settings.enableGenerationHelp",
                "Generate AI summaries from search results"
              )}
            </p>
          </div>
          <div className="space-y-2">
            <Checkbox
              checked={ragEnableCitations}
              onChange={(e) => setRagEnableCitations(e.target.checked)}
            >
              {t("knowledge:settings.enableCitations", "Include citations")}
            </Checkbox>
            <p className="ml-6 text-xs text-text-muted">
              {t(
                "knowledge:settings.enableCitationsHelp",
                "Add source references to generated answers"
              )}
            </p>
          </div>
        </div>

        {/* Sources */}
        <div className="space-y-2">
          <label className="block font-medium text-text">
            {t("knowledge:settings.sources", "Source Types")}
          </label>
          <Checkbox.Group
            className="flex flex-col gap-2"
            value={ragSources}
            onChange={(vals) => setRagSources(vals as string[])}
            options={[
              {
                value: "media_db",
                label: t("knowledge:settings.sourceMedia", "Media (videos, audio)")
              },
              {
                value: "notes",
                label: t("knowledge:settings.sourceNotes", "Notes")
              },
              {
                value: "characters",
                label: t("knowledge:settings.sourceCharacters", "Characters")
              },
              {
                value: "chats",
                label: t("knowledge:settings.sourceChats", "Chat history")
              }
            ]}
          />
          <p className="text-xs text-text-muted">
            {t(
              "knowledge:settings.sourcesHelp",
              "Leave empty to search all sources"
            )}
          </p>
        </div>

        {/* Link to full RAG settings */}
        <div className="border-t border-border pt-4">
          <Button
            type="link"
            onClick={() => {
              onClose()
              navigate("/settings/rag")
            }}
            className="p-0"
          >
            {t("knowledge:settings.openFullSettings", "Open full RAG settings")} →
          </Button>
        </div>
      </div>
    </Drawer>
  )
}
