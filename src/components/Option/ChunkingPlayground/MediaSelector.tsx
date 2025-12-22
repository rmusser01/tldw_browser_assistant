import React, { useState } from "react"
import { useTranslation } from "react-i18next"
import { Select, Spin, Alert, Typography } from "antd"
import { useQuery } from "@tanstack/react-query"
import { bgRequest } from "@/services/background-proxy"

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

interface MediaSelectorProps {
  onSelect: (content: string) => void
}

export const MediaSelector: React.FC<MediaSelectorProps> = ({ onSelect }) => {
  const { t } = useTranslation(["settings"])
  const [selectedMediaId, setSelectedMediaId] = useState<number | null>(null)
  const [isLoadingContent, setIsLoadingContent] = useState(false)
  const [contentError, setContentError] = useState<string | null>(null)

  // Fetch media list
  const {
    data: mediaList,
    isLoading: isLoadingList,
    error: listError
  } = useQuery<MediaListResponse>({
    queryKey: ["media-list-for-chunking"],
    queryFn: async () => {
      return await bgRequest<MediaListResponse>({
        path: "/api/v1/media?page=1&results_per_page=100",
        method: "GET"
      })
    },
    staleTime: 60 * 1000 // Cache for 1 minute
  })

  const handleMediaSelect = async (mediaId: number) => {
    setSelectedMediaId(mediaId)
    setIsLoadingContent(true)
    setContentError(null)

    try {
      const response = await bgRequest<MediaDetailResponse>({
        path: `/api/v1/media/${mediaId}?include_content=true`,
        method: "GET"
      })

      const content = response.content?.text
      if (content) {
        onSelect(content)
      } else {
        setContentError(
          t(
            "settings:chunkingPlayground.noContentFound",
            "No text content found for this media item"
          )
        )
      }
    } catch (err: any) {
      setContentError(
        err?.message ||
          t(
            "settings:chunkingPlayground.loadContentError",
            "Failed to load media content"
          )
      )
    } finally {
      setIsLoadingContent(false)
    }
  }

  const mediaOptions = React.useMemo(() => {
    if (!mediaList?.items) return []
    return mediaList.items.map((item) => ({
      value: item.id,
      label: (
        <div className="flex items-center justify-between">
          <span className="truncate">{item.title || `Media #${item.id}`}</span>
          <span className="text-xs text-gray-400 ml-2">{item.type}</span>
        </div>
      ),
      searchText: item.title || `Media ${item.id}`
    }))
  }, [mediaList])

  if (listError) {
    return (
      <Alert
        type="error"
        message={t(
          "settings:chunkingPlayground.loadMediaListError",
          "Failed to load media library"
        )}
        description={(listError as Error)?.message}
      />
    )
  }

  return (
    <div className="space-y-3">
      <Select
        showSearch
        placeholder={t(
          "settings:chunkingPlayground.selectMedia",
          "Select media item..."
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
            t("settings:chunkingPlayground.noMediaFound", "No media found")
          )
        }
      />

      {isLoadingContent && (
        <div className="flex items-center gap-2 text-gray-500">
          <Spin size="small" />
          <Text type="secondary">
            {t(
              "settings:chunkingPlayground.loadingMedia",
              "Loading content..."
            )}
          </Text>
        </div>
      )}

      {contentError && (
        <Alert type="warning" message={contentError} showIcon />
      )}

      {mediaList?.pagination && (
        <Text type="secondary" className="text-xs">
          {t(
            "settings:chunkingPlayground.mediaCount",
            "{{count}} media items available",
            { count: mediaList.pagination.total_items }
          )}
        </Text>
      )}
    </div>
  )
}
