import React, { useEffect, useState } from "react"
import { Alert, Input, Select, Switch } from "antd"
import { useTranslation } from "react-i18next"
import { Loader2, RotateCcw, Upload } from "lucide-react"
import { useAntdNotification } from "@/hooks/useAntdNotification"
import { tldwClient } from "@/services/tldw/TldwApiClient"
import { useServerCapabilities } from "@/hooks/useServerCapabilities"
import { useMessageOption } from "@/hooks/useMessageOption"

export const ChatbooksSettings = () => {
  const { t } = useTranslation(["settings", "common"])
  const notification = useAntdNotification()
  const { capabilities } = useServerCapabilities()
  const { serverChatId } = useMessageOption()
  const [chatbookName, setChatbookName] = useState("")
  const [chatbookDescription, setChatbookDescription] = useState("")
  const [chatbookConversationIds, setChatbookConversationIds] = useState("")
  const [chatbookIncludeMedia, setChatbookIncludeMedia] = useState(false)
  const [chatbookIncludeEmbeddings, setChatbookIncludeEmbeddings] =
    useState(false)
  const [chatbookIncludeGenerated, setChatbookIncludeGenerated] =
    useState(true)
  const [chatbookAsync, setChatbookAsync] = useState(true)
  const [chatbookExporting, setChatbookExporting] = useState(false)
  const [chatbookExportJobs, setChatbookExportJobs] = useState<any[]>([])
  const [chatbookImportJobs, setChatbookImportJobs] = useState<any[]>([])
  const [chatbookImporting, setChatbookImporting] = useState(false)
  const [chatbookImportConflict, setChatbookImportConflict] =
    useState("skip")
  const [chatbookImportPrefix, setChatbookImportPrefix] = useState(false)
  const [chatbookImportMedia, setChatbookImportMedia] = useState(true)
  const [chatbookImportEmbeddings, setChatbookImportEmbeddings] =
    useState(false)
  const [chatbookImportAsync, setChatbookImportAsync] = useState(true)
  const [chatbookJobsLoading, setChatbookJobsLoading] = useState(false)

  const parseIdList = (raw: string) =>
    raw
      .split(/[\n,]+/)
      .map((id) => id.trim())
      .filter(Boolean)

  const loadChatbookJobs = async () => {
    if (!capabilities?.hasChatbooks) return
    setChatbookJobsLoading(true)
    try {
      await tldwClient.initialize().catch(() => null)
      const [exports, imports] = await Promise.all([
        tldwClient.listChatbookExportJobs({ limit: 20, offset: 0 }),
        tldwClient.listChatbookImportJobs({ limit: 20, offset: 0 })
      ])
      const exportItems =
        (exports as any)?.jobs ||
        (exports as any)?.items ||
        (exports as any)?.results ||
        exports ||
        []
      const importItems =
        (imports as any)?.jobs ||
        (imports as any)?.items ||
        (imports as any)?.results ||
        imports ||
        []
      setChatbookExportJobs(exportItems)
      setChatbookImportJobs(importItems)
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      notification.error({
        message: t(
          "settings:chatbooks.jobsError",
          "Unable to load chatbook jobs"
        ),
        description: msg
      })
    } finally {
      setChatbookJobsLoading(false)
    }
  }

  const handleChatbookExport = async () => {
    if (!capabilities?.hasChatbooks) return
    const conversationIds = parseIdList(chatbookConversationIds)
    if (conversationIds.length === 0) {
      notification.error({
        message: t(
          "settings:chatbooks.exportMissingIds",
          "Add at least one conversation ID."
        )
      })
      return
    }
    setChatbookExporting(true)
    try {
      await tldwClient.initialize().catch(() => null)
      const payload = {
        name: chatbookName || `Chatbook ${new Date().toLocaleDateString()}`,
        description:
          chatbookDescription ||
          t("settings:chatbooks.exportDescriptionFallback", "Chatbook export"),
        content_selections: {
          conversation: conversationIds
        },
        include_media: chatbookIncludeMedia,
        include_embeddings: chatbookIncludeEmbeddings,
        include_generated_content: chatbookIncludeGenerated,
        async_mode: chatbookAsync
      }
      const res = await tldwClient.exportChatbook(payload)
      if (res?.job_id) {
        notification.success({
          message: t(
            "settings:chatbooks.exportQueued",
            "Export job created"
          )
        })
      } else {
        notification.success({
          message: t(
            "settings:chatbooks.exportComplete",
            "Chatbook export complete"
          )
        })
      }
      await loadChatbookJobs()
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      notification.error({
        message: t(
          "settings:chatbooks.exportError",
          "Chatbook export failed"
        ),
        description: msg
      })
    } finally {
      setChatbookExporting(false)
    }
  }

  const handleChatbookDownload = async (jobId: string) => {
    try {
      await tldwClient.initialize().catch(() => null)
      const { blob, filename } = await tldwClient.downloadChatbookExport(jobId)
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      notification.error({
        message: t("settings:chatbooks.downloadError", "Download failed"),
        description: msg
      })
    }
  }

  const handleChatbookImport = async (file: File) => {
    if (!capabilities?.hasChatbooks) return
    setChatbookImporting(true)
    try {
      await tldwClient.initialize().catch(() => null)
      const res = await tldwClient.importChatbook(file, {
        conflict_resolution: chatbookImportConflict,
        prefix_imported: chatbookImportPrefix,
        import_media: chatbookImportMedia,
        import_embeddings: chatbookImportEmbeddings,
        async_mode: chatbookImportAsync
      })
      if (res?.job_id) {
        notification.success({
          message: t(
            "settings:chatbooks.importQueued",
            "Import job created"
          )
        })
      } else {
        notification.success({
          message: t(
            "settings:chatbooks.importComplete",
            "Chatbook import complete"
          )
        })
      }
      await loadChatbookJobs()
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      notification.error({
        message: t(
          "settings:chatbooks.importError",
          "Chatbook import failed"
        ),
        description: msg
      })
    } finally {
      setChatbookImporting(false)
    }
  }

  useEffect(() => {
    if (!chatbookName) {
      setChatbookName(
        t(
          "settings:chatbooks.defaultName",
          "Chatbook {{date}}",
          { date: new Date().toLocaleDateString() }
        )
      )
    }
  }, [chatbookName, t])

  useEffect(() => {
    if (serverChatId && !chatbookConversationIds) {
      setChatbookConversationIds(serverChatId)
    }
  }, [chatbookConversationIds, serverChatId])

  useEffect(() => {
    if (capabilities?.hasChatbooks) {
      void loadChatbookJobs()
    }
  }, [capabilities?.hasChatbooks])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-text">
          {t("settings:chatbooks.heading", "Chatbooks")}
        </h2>
        <p className="text-sm text-text-muted">
          {t(
            "settings:chatbooks.subheading",
            "Export conversations into portable archives, or import them later."
          )}
        </p>
      </div>

      <div className="rounded-md border border-border bg-surface p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-semibold text-text">
            {t("settings:chatbooks.exportTitle", "Export chatbook")}
          </div>
          <button
            onClick={() => loadChatbookJobs()}
            className="text-text-muted hover:text-text"
            aria-label={t("common:refresh", "Refresh")}
            type="button"
          >
            <RotateCcw
              className={`h-4 w-4 ${chatbookJobsLoading ? "animate-spin" : ""}`}
            />
          </button>
        </div>

        {capabilities && !capabilities.hasChatbooks && (
          <Alert
            type="info"
            showIcon
            className="mt-3"
            message={t(
              "settings:chatbooks.unavailable",
              "Chatbooks are not available on this server."
            )}
          />
        )}

        <div className="mt-4 space-y-3">
          <Input
            value={chatbookName}
            onChange={(e) => setChatbookName(e.target.value)}
            placeholder={t("settings:chatbooks.exportName", "Chatbook name")}
          />
          <Input.TextArea
            rows={2}
            value={chatbookDescription}
            onChange={(e) => setChatbookDescription(e.target.value)}
            placeholder={t(
              "settings:chatbooks.exportDescription",
              "Short description"
            )}
          />
          <Input.TextArea
            rows={2}
            value={chatbookConversationIds}
            onChange={(e) => setChatbookConversationIds(e.target.value)}
            placeholder={t(
              "settings:chatbooks.exportConversationIds",
              "Conversation IDs (comma-separated)"
            )}
          />
          <div className="flex flex-wrap items-center gap-3 text-xs text-text-muted">
            <label className="flex items-center gap-2">
              <Switch
                checked={chatbookIncludeMedia}
                onChange={setChatbookIncludeMedia}
              />
              {t("settings:chatbooks.includeMedia", "Include media")}
            </label>
            <label className="flex items-center gap-2">
              <Switch
                checked={chatbookIncludeEmbeddings}
                onChange={setChatbookIncludeEmbeddings}
              />
              {t("settings:chatbooks.includeEmbeddings", "Include embeddings")}
            </label>
            <label className="flex items-center gap-2">
              <Switch
                checked={chatbookIncludeGenerated}
                onChange={setChatbookIncludeGenerated}
              />
              {t(
                "settings:chatbooks.includeGenerated",
                "Include generated docs"
              )}
            </label>
            <label className="flex items-center gap-2">
              <Switch checked={chatbookAsync} onChange={setChatbookAsync} />
              {t("settings:chatbooks.runAsync", "Run as background job")}
            </label>
          </div>
          <button
            onClick={handleChatbookExport}
            disabled={chatbookExporting || !capabilities?.hasChatbooks}
            className="cursor-pointer rounded-md bg-primary px-4 py-2 text-white transition-colors hover:bg-primaryStrong disabled:cursor-not-allowed disabled:opacity-60"
          >
            {chatbookExporting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            {t("settings:chatbooks.exportButton", "Export chatbook")}
          </button>
          {chatbookExportJobs.length === 0 ? (
            <div className="text-xs text-text-muted">
              {t("settings:chatbooks.noExportJobs", "No export jobs yet.")}
            </div>
          ) : (
            <div className="space-y-2">
              {chatbookExportJobs.map((job: any) => (
                <div
                  key={job.job_id || job.id}
                  className="rounded-md border border-border bg-surface2 p-2 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-text">
                        {job.chatbook_name || job.name || job.job_id}
                      </div>
                      <div className="text-text-subtle">
                        {job.status || "pending"}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {job.job_id && job.status === "completed" && (
                        <button
                          onClick={() => handleChatbookDownload(job.job_id)}
                          className="text-primary hover:underline"
                          type="button"
                        >
                          {t("settings:chatbooks.download", "Download")}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-md border border-border bg-surface p-4">
        <div className="text-sm font-semibold text-text">
          {t("settings:chatbooks.importTitle", "Import chatbook")}
        </div>
        <div className="mt-4 space-y-3">
          <Select
            value={chatbookImportConflict}
            onChange={setChatbookImportConflict}
            options={[
              {
                value: "skip",
                label: t("settings:chatbooks.conflictSkip", "Skip conflicts")
              },
              {
                value: "overwrite",
                label: t(
                  "settings:chatbooks.conflictOverwrite",
                  "Overwrite existing"
                )
              },
              {
                value: "rename",
                label: t(
                  "settings:chatbooks.conflictRename",
                  "Rename imported"
                )
              },
              {
                value: "merge",
                label: t(
                  "settings:chatbooks.conflictMerge",
                  "Merge when possible"
                )
              }
            ]}
          />
          <div className="flex flex-wrap items-center gap-3 text-xs text-text-muted">
            <label className="flex items-center gap-2">
              <Switch
                checked={chatbookImportPrefix}
                onChange={setChatbookImportPrefix}
              />
              {t("settings:chatbooks.prefixImported", "Prefix imported")}
            </label>
            <label className="flex items-center gap-2">
              <Switch
                checked={chatbookImportMedia}
                onChange={setChatbookImportMedia}
              />
              {t("settings:chatbooks.importMedia", "Import media")}
            </label>
            <label className="flex items-center gap-2">
              <Switch
                checked={chatbookImportEmbeddings}
                onChange={setChatbookImportEmbeddings}
              />
              {t(
                "settings:chatbooks.importEmbeddings",
                "Import embeddings"
              )}
            </label>
            <label className="flex items-center gap-2">
              <Switch
                checked={chatbookImportAsync}
                onChange={setChatbookImportAsync}
              />
              {t("settings:chatbooks.runAsync", "Run as background job")}
            </label>
          </div>
          <label
            htmlFor="chatbook-import"
            className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-primary px-4 py-2 text-white transition-colors hover:bg-primaryStrong"
          >
            {chatbookImporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {t("settings:chatbooks.importButton", "Import chatbook")}
          </label>
          <input
            id="chatbook-import"
            type="file"
            accept=".zip"
            className="hidden"
            disabled={chatbookImporting || !capabilities?.hasChatbooks}
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleChatbookImport(e.target.files[0])
                e.target.value = ""
              }
            }}
          />
          {chatbookImportJobs.length === 0 ? (
            <div className="text-xs text-text-muted">
              {t("settings:chatbooks.noImportJobs", "No import jobs yet.")}
            </div>
          ) : (
            <div className="space-y-2">
              {chatbookImportJobs.map((job: any) => (
                <div
                  key={job.job_id || job.id}
                  className="rounded-md border border-border bg-surface2 p-2 text-xs"
                >
                  <div className="text-text">{job.job_id || job.id}</div>
                  <div className="text-text-subtle">
                    {job.status || "pending"}
                  </div>
                  {typeof job.items_imported === "number" && (
                    <div className="text-text-subtle">
                      {t(
                        "settings:chatbooks.importedCount",
                        "{{count}} items imported",
                        { count: job.items_imported }
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
