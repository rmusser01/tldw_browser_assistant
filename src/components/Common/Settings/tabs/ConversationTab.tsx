import { FileIcon, X } from "lucide-react"
import { Form, Input, notification, Select, Switch } from "antd"
import { useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { tldwClient, type ConversationState } from "@/services/tldw/TldwApiClient"
import {
  CONVERSATION_STATE_OPTIONS,
  normalizeConversationState
} from "@/utils/conversation-state"

interface UploadedFile {
  id: string
  filename: string
  size: number
  processed?: boolean
}

interface ConversationTabProps {
  useDrawer?: boolean
  selectedSystemPrompt: string | null
  onSystemPromptChange: (value: string) => void
  uploadedFiles: UploadedFile[]
  onRemoveFile: (id: string) => void
  fileRetrievalEnabled: boolean
  onFileRetrievalChange: (enabled: boolean) => void
  serverChatId: string | null
  serverChatState: ConversationState | null
  onStateChange: (state: ConversationState) => void
  serverChatTopic: string | null
  onTopicChange: (topic: string | null) => void
  onVersionChange: (version: number | null) => void
}

interface UpdateChatResponse {
  version?: number | null
}

function isErrorWithMessage(error: unknown): error is { message: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  )
}

function isUpdateChatResponse(value: unknown): value is UpdateChatResponse {
  if (!value || typeof value !== "object") return false
  if (!("version" in value)) return true
  const version = (value as { version?: unknown }).version
  return version === null || version === undefined || typeof version === "number"
}

function getUpdateChatVersion(value: unknown): number | null {
  if (!isUpdateChatResponse(value)) return null
  return value.version ?? null
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

  const conversationStateOptions = CONVERSATION_STATE_OPTIONS.map((option) => ({
    value: option.value,
    label: t(option.labelToken, option.defaultLabel)
  }))

  const handleStateChange = async (val: string) => {
    const next = normalizeConversationState(val)
    onStateChange(next)
    if (!serverChatId) return
    try {
      const updated = await tldwClient.updateChat(serverChatId, {
        state: next
      })
      onVersionChange(getUpdateChatVersion(updated))
      queryClient.invalidateQueries({ queryKey: ["serverChatHistory"] })
    } catch (error: unknown) {
      notification.error({
        message: t("common:error", { defaultValue: "Error" }),
        description:
          (isErrorWithMessage(error)
            ? error.message
            : t("common:somethingWentWrong", {
                defaultValue: "Something went wrong"
              }))
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
      onVersionChange(getUpdateChatVersion(updated))
      queryClient.invalidateQueries({ queryKey: ["serverChatHistory"] })
    } catch (error: unknown) {
      notification.error({
        message: t("common:error", { defaultValue: "Error" }),
        description:
          (isErrorWithMessage(error)
            ? error.message
            : t("common:somethingWentWrong", {
                defaultValue: "Something went wrong"
              }))
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
              {t("playground:composer.uploadedFiles", {
                count: uploadedFiles.length,
                defaultValue: "Uploaded Files ({{count}})"
              })}
            </h4>
            <div className="flex items-center gap-2">
              <span className="text-sm text-text-muted">
                {t("playground:composer.fileRetrieval", {
                  defaultValue: "File Retrieval"
                })}
              </span>
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
                          {file.processed
                            ? t("playground:composer.fileStatusProcessed", {
                                defaultValue: "Processed"
                              })
                            : t("playground:composer.fileStatusProcessing", {
                                defaultValue: "Processing..."
                              })}
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
