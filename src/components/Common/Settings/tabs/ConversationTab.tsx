import { FileIcon, X } from "lucide-react"
import { Form, Input, notification, Select, Switch } from "antd"
import { useQueryClient } from "@tanstack/react-query"
import type { FormInstance } from "antd"
import { useTranslation } from "react-i18next"
import { tldwClient } from "@/services/tldw/TldwApiClient"

interface UploadedFile {
  id: string
  filename: string
  size: number
  processed?: boolean
}

interface ConversationTabProps {
  form: FormInstance
  useDrawer?: boolean
  selectedSystemPrompt: string | null
  onSystemPromptChange: (value: string) => void
  uploadedFiles: UploadedFile[]
  onRemoveFile: (id: string) => void
  fileRetrievalEnabled: boolean
  onFileRetrievalChange: (enabled: boolean) => void
  serverChatId: string | null
  serverChatState: string | null
  onStateChange: (state: string) => void
  serverChatTopic: string | null
  onTopicChange: (topic: string | null) => void
  onVersionChange: (version: number | null) => void
}

export function ConversationTab({
  useDrawer,
  selectedSystemPrompt,
  onSystemPromptChange,
  uploadedFiles,
  onRemoveFile,
  fileRetrievalEnabled,
  onFileRetrievalChange,
  serverChatId,
  serverChatState,
  onStateChange,
  serverChatTopic,
  onTopicChange,
  onVersionChange
}: ConversationTabProps) {
  const { t } = useTranslation(["common", "playground"])
  const queryClient = useQueryClient()

  const conversationStateOptions = [
    {
      value: "in-progress",
      label: t("playground:composer.state.inProgress", "in-progress")
    },
    {
      value: "resolved",
      label: t("playground:composer.state.resolved", "resolved")
    },
    {
      value: "backlog",
      label: t("playground:composer.state.backlog", "backlog")
    },
    {
      value: "non-viable",
      label: t("playground:composer.state.nonViable", "non-viable")
    }
  ]

  const handleStateChange = async (val: string) => {
    const next = val || "in-progress"
    onStateChange(next)
    if (!serverChatId) return
    try {
      const updated = await tldwClient.updateChat(serverChatId, {
        state: next
      })
      onVersionChange((updated as any)?.version ?? null)
      queryClient.invalidateQueries({ queryKey: ["serverChatHistory"] })
    } catch (error: any) {
      notification.error({
        message: t("common:error", { defaultValue: "Error" }),
        description:
          error?.message ||
          t("common:somethingWentWrong", {
            defaultValue: "Something went wrong"
          })
      })
    }
  }

  const handleTopicBlur = async (value: string) => {
    const normalized = value.trim()
    const topicValue = normalized.length > 0 ? normalized : null
    onTopicChange(topicValue)
    if (!serverChatId) return
    try {
      const updated = await tldwClient.updateChat(serverChatId, {
        topic_label: topicValue || undefined
      })
      onVersionChange((updated as any)?.version ?? null)
      queryClient.invalidateQueries({ queryKey: ["serverChatHistory"] })
    } catch (error: any) {
      notification.error({
        message: t("common:error", { defaultValue: "Error" }),
        description:
          error?.message ||
          t("common:somethingWentWrong", {
            defaultValue: "Something went wrong"
          })
      })
    }
  }

  return (
    <div className="space-y-4">
      {useDrawer && (
        <Form.Item
          name="systemPrompt"
          help={t("common:modelSettings.form.systemPrompt.help")}
          label={t("common:modelSettings.form.systemPrompt.label")}>
          <div className="space-y-1">
            <Input.TextArea
              rows={4}
              placeholder={t("common:modelSettings.form.systemPrompt.placeholder")}
              onChange={(e) => onSystemPromptChange(e.target.value)}
            />
            {selectedSystemPrompt && (
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />
                <span>
                  {t(
                    "playground:composer.sceneTemplateActive",
                    "Scene template active: Actor respects template interaction settings."
                  )}
                </span>
              </div>
            )}
          </div>
        </Form.Item>
      )}

      {uploadedFiles.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-text">
              Uploaded Files ({uploadedFiles.length})
            </h4>
            <div className="flex items-center gap-2">
              <span className="text-sm text-text-muted">File Retrieval</span>
              <Switch
                size="small"
                checked={fileRetrievalEnabled}
                onChange={onFileRetrievalChange}
              />
            </div>
          </div>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {uploadedFiles.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between p-2 bg-surface2 rounded-md">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <FileIcon className="h-4 w-4 flex-shrink-0 text-text-subtle" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-text truncate">
                      {file.filename}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-text-subtle">
                      <span>{(file.size / 1024).toFixed(1)} KB</span>
                      {fileRetrievalEnabled && (
                        <span className="flex items-center gap-1">
                          <span
                            className={`inline-block w-2 h-2 rounded-full ${
                              file.processed ? "bg-success" : "bg-warn"
                            }`}
                          />
                          {file.processed ? "Processed" : "Processing..."}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => onRemoveFile(file.id)}
                  className="rounded p-1 text-danger hover:bg-danger/10 hover:text-danger">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <Form.Item
        label={t("playground:composer.conversationTags", "Conversation state")}
        help={t(
          "playground:composer.stateHelp",
          'Default state is "in-progress." Update it as the conversation progresses.'
        )}>
        <Select
          value={serverChatState || "in-progress"}
          options={conversationStateOptions}
          onChange={handleStateChange}
        />
      </Form.Item>

      <Form.Item
        label={t("playground:composer.topicPlaceholder", "Conversation tag")}
        help={t(
          "playground:composer.persistence.topicHelp",
          "Optional label for this chat; saved to the server when available."
        )}>
        <Input
          value={serverChatTopic || ""}
          onChange={(e) => onTopicChange(e.target.value || null)}
          onBlur={(e) => handleTopicBlur(e.target.value)}
          placeholder={t(
            "playground:composer.topicPlaceholder",
            "Conversation tag (optional)"
          )}
        />
      </Form.Item>
    </div>
  )
}
