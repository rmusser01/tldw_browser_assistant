import { UserCircle2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useMemo } from "react"

interface CharacterPreviewProps {
  name?: string
  description?: string
  avatar_url?: string
  image_base64?: string
  system_prompt?: string
  greeting?: string
  tags?: string[]
}

/**
 * Validates and creates a data URL from base64 image data.
 * Returns null if the base64 data is invalid or not a supported image type.
 */
function validateAndCreateImageDataUrl(base64: string | null | undefined): string | null {
  if (!base64 || typeof base64 !== "string") return null
  // If already a data URL, validate and return
  if (base64.startsWith("data:image/")) {
    return base64
  }
  // Check for valid base64 pattern
  const base64Pattern = /^[A-Za-z0-9+/=]+$/
  if (!base64Pattern.test(base64)) return null
  // Decode first few bytes to detect image type
  try {
    const decoded = atob(base64.slice(0, 16))
    const bytes = new Uint8Array(decoded.length)
    for (let i = 0; i < decoded.length; i++) {
      bytes[i] = decoded.charCodeAt(i)
    }
    // PNG signature: 89 50 4E 47
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
      return `data:image/png;base64,${base64}`
    }
    // JPEG signature: FF D8 FF
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
      return `data:image/jpeg;base64,${base64}`
    }
    // GIF signature: 47 49 46 38
    if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) {
      return `data:image/gif;base64,${base64}`
    }
  } catch {
    return null
  }
  return null
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

  const avatarSrc = useMemo(() => {
    if (avatar_url) return avatar_url
    if (image_base64) return validateAndCreateImageDataUrl(image_base64)
    return null
  }, [avatar_url, image_base64])

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
          {avatarSrc ? (
            <img
              src={avatarSrc}
              alt={displayName}
              className="h-12 w-12 rounded-full object-cover ring-2 ring-gray-200 dark:ring-gray-700"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none"
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
              {tags.slice(0, 4).map((tag) => (
                <span
                  key={tag}
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
