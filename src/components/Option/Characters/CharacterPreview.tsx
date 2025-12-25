import { UserCircle2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useEffect, useMemo, useState } from "react"
import { createImageDataUrl } from "@/utils/image-utils"

interface CharacterPreviewProps {
  name?: string
  description?: string
  avatar_url?: string
  image_base64?: string
  system_prompt?: string
  greeting?: string
  tags?: string[]
}


export function CharacterPreview({
  name,
  description,
  avatar_url,
  image_base64,
  system_prompt,
  greeting,
  tags
}: CharacterPreviewProps) {
  const { t } = useTranslation(["settings", "common"])
  const [avatarImgError, setAvatarImgError] = useState(false)

  const avatarSrc = useMemo(() => {
    if (avatar_url) return avatar_url
    if (image_base64) return createImageDataUrl(image_base64)
    return null
  }, [avatar_url, image_base64])

  useEffect(() => {
    setAvatarImgError(false)
  }, [avatarSrc])

  const displayName = name || t("settings:manageCharacters.preview.untitled", {
    defaultValue: "Untitled character"
  })

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-[#0f1115]">
      <div className="mb-3 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {t("settings:manageCharacters.preview.title", {
          defaultValue: "Preview"
        })}
      </div>

      {/* Character Card */}
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="flex-shrink-0">
          {avatarSrc && !avatarImgError ? (
            <img
              src={avatarSrc}
              alt={displayName}
              className="h-12 w-12 rounded-full object-cover ring-2 ring-gray-200 dark:ring-gray-700"
              onError={() => {
                setAvatarImgError(true)
              }}
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-200 ring-2 ring-gray-300 dark:bg-gray-700 dark:ring-gray-600">
              <UserCircle2 className="h-8 w-8 text-gray-400 dark:text-gray-500" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1 space-y-1">
          <div className="font-semibold text-gray-900 dark:text-gray-100 truncate">
            {displayName}
          </div>
          {description && (
            <div className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
              {description}
            </div>
          )}
          {tags && tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {tags.slice(0, 4).map((tag, i) => (
                <span
                  key={`${tag}-${i}`}
                  className="inline-flex items-center rounded-full bg-gray-200 px-2 py-0.5 text-xs text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                  {tag}
                </span>
              ))}
              {tags.length > 4 && (
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  +{tags.length - 4}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Greeting Preview */}
      {greeting && (
        <div className="mt-4 rounded-md bg-white p-3 shadow-sm dark:bg-[#1a1a1a]">
          <div className="mb-1 text-xs font-medium text-gray-500 dark:text-gray-400">
            {t("settings:manageCharacters.preview.greeting", {
              defaultValue: "Greeting"
            })}
          </div>
          <div className="text-sm text-gray-700 dark:text-gray-300 line-clamp-3 italic">
            "{greeting}"
          </div>
        </div>
      )}

      {/* System Prompt Preview */}
      {system_prompt && (
        <div className="mt-3 rounded-md bg-white p-3 shadow-sm dark:bg-[#1a1a1a]">
          <div className="mb-1 text-xs font-medium text-gray-500 dark:text-gray-400">
            {t("settings:manageCharacters.preview.behavior", {
              defaultValue: "Behavior"
            })}
          </div>
          <div className="text-sm text-gray-700 dark:text-gray-300 line-clamp-3">
            {system_prompt}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!name && !description && !system_prompt && !greeting && (
        <div className="mt-3 text-center text-sm text-gray-400 dark:text-gray-500">
          {t("settings:manageCharacters.preview.empty", {
            defaultValue: "Fill in the form to see a preview"
          })}
        </div>
      )}
    </div>
  )
}
