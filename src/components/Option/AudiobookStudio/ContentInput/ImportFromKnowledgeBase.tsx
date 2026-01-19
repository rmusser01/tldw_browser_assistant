import React, { useState } from "react"
import { useTranslation } from "react-i18next"
import { Modal, Select, Spin, Alert, Typography, Button, Space } from "antd"
import { useQuery } from "@tanstack/react-query"
import { bgRequest } from "@/services/background-proxy"
import { Database, FileText } from "lucide-react"

const { Text } = Typography

interface MediaItem {
  id: number
  title: string
  type: string
  url?: string
}

interface MediaListResponse {
  items: MediaItem[]
  pagination?: {
    page: number
    total_pages: number
    total_items: number
  }
}

interface MediaDetailResponse {
  id: number
  title: string
  content?: {
    text?: string
    metadata?: Record<string, any>
  }
}

interface ImportFromKnowledgeBaseProps {
  open: boolean
  onClose: () => void
  onImport: (content: string, title?: string) => void
}

export const ImportFromKnowledgeBase: React.FC<ImportFromKnowledgeBaseProps> = ({
  open,
  onClose,
  onImport
}) => {
  const { t } = useTranslation(["audiobook", "common"])
  const [selectedMediaId, setSelectedMediaId] = useState<number | null>(null)
  const [isLoadingContent, setIsLoadingContent] = useState(false)
  const [contentError, setContentError] = useState<string | null>(null)
  const [previewContent, setPreviewContent] = useState<string | null>(null)
  const [previewTitle, setPreviewTitle] = useState<string | null>(null)

  // Fetch media list
  const {
    data: mediaList,
    isLoading: isLoadingList,
    error: listError
  } = useQuery<MediaListResponse>({
    queryKey: ["media-list-for-audiobook"],
    queryFn: async () => {
      return await bgRequest<MediaListResponse>({
        path: "/api/v1/media?page=1&results_per_page=100",
        method: "GET"
      })
    },
    staleTime: 60 * 1000,
    enabled: open
  })

  const handleMediaSelect = async (mediaId: number) => {
    setSelectedMediaId(mediaId)
    setIsLoadingContent(true)
    setContentError(null)
    setPreviewContent(null)
    setPreviewTitle(null)

    try {
      const response = await bgRequest<MediaDetailResponse>({
        path: `/api/v1/media/${mediaId}?include_content=true`,
        method: "GET"
      })

      const content = response.content?.text
      if (content) {
        setPreviewContent(content)
        setPreviewTitle(response.title || null)
      } else {
        setContentError(
          t(
            "audiobook:import.noContentFound",
            "No text content found for this media item"
          )
        )
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      setContentError(
        errorMessage ||
          t("audiobook:import.loadContentError", "Failed to load media content")
      )
    } finally {
      setIsLoadingContent(false)
    }
  }

  const handleImport = () => {
    if (previewContent) {
      onImport(previewContent, previewTitle || undefined)
      handleClose()
    }
  }

  const handleClose = () => {
    setSelectedMediaId(null)
    setContentError(null)
    setPreviewContent(null)
    setPreviewTitle(null)
    onClose()
  }

  const mediaOptions = React.useMemo(() => {
    if (!mediaList?.items) return []
    return mediaList.items.map((item) => ({
      value: item.id,
      label: (
        <div className="flex items-center justify-between">
          <span className="truncate">{item.title || `Media #${item.id}`}</span>
          <span className="text-xs text-text-subtle ml-2">{item.type}</span>
        </div>
      ),
      searchText: item.title || `Media ${item.id}`
    }))
  }, [mediaList])

  return (
    <Modal
      title={
        <div className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          {t("audiobook:import.title", "Import from Knowledge Base")}
        </div>
      }
      open={open}
      onCancel={handleClose}
      footer={
        <Space>
          <Button onClick={handleClose}>
            {t("common:cancel", "Cancel")}
          </Button>
          <Button
            type="primary"
            onClick={handleImport}
            disabled={!previewContent}
            icon={<FileText className="h-4 w-4" />}
          >
            {t("audiobook:import.importButton", "Import Content")}
          </Button>
        </Space>
      }
      width={600}
    >
      <div className="space-y-4 py-4">
        {listError ? (
          <Alert
            type="error"
            message={t(
              "audiobook:import.loadMediaListError",
              "Failed to load media library"
            )}
            description={(listError as Error)?.message}
          />
        ) : (
          <>
            <div className="space-y-2">
              <Text strong>
                {t("audiobook:import.selectMedia", "Select media item")}
              </Text>
              <Select
                showSearch
                placeholder={t(
                  "audiobook:import.selectPlaceholder",
                  "Search and select media..."
                )}
                loading={isLoadingList}
                value={selectedMediaId}
                onChange={handleMediaSelect}
                options={mediaOptions}
                filterOption={(input, option) =>
                  (option?.searchText as string)
                    ?.toLowerCase()
                    .includes(input.toLowerCase()) ?? false
                }
                className="w-full"
                notFoundContent={
                  isLoadingList ? (
                    <Spin size="small" />
                  ) : (
                    t("audiobook:import.noMediaFound", "No media found")
                  )
                }
              />
            </div>

            {isLoadingContent && (
              <div className="flex items-center gap-2 text-text-muted py-4 justify-center">
                <Spin size="small" />
                <Text type="secondary">
                  {t("audiobook:import.loadingContent", "Loading content...")}
                </Text>
              </div>
            )}

            {contentError && (
              <Alert type="warning" message={contentError} showIcon />
            )}

            {previewContent && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Text strong>
                    {t("audiobook:import.preview", "Content Preview")}
                  </Text>
                  <Text type="secondary" className="text-xs">
                    {t("audiobook:import.charCount", "{{count}} characters", {
                      count: previewContent.length
                    })}
                  </Text>
                </div>
                <div className="max-h-64 overflow-y-auto rounded-md border border-border bg-surface p-3">
                  <Text className="whitespace-pre-wrap text-sm">
                    {previewContent.length > 2000
                      ? previewContent.slice(0, 2000) + "..."
                      : previewContent}
                  </Text>
                </div>
              </div>
            )}

            {mediaList?.pagination && (
              <Text type="secondary" className="text-xs">
                {t("audiobook:import.mediaCount", "{{count}} media items available", {
                  count: mediaList.pagination.total_items
                })}
              </Text>
            )}
          </>
        )}
      </div>
    </Modal>
  )
}

export default ImportFromKnowledgeBase
