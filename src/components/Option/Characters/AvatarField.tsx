import React from "react"
import { Input, Radio, Upload, message } from "antd"
import { ImageIcon, Link, X, Upload as UploadIcon } from "lucide-react"
import { useTranslation } from "react-i18next"

// Allowed image MIME types (same as Manager.tsx)
const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif"
])

/**
 * Decode the first few bytes of a base64 string to check image headers.
 */
function decodeBase64Header(base64: string): Uint8Array | null {
  try {
    const decoded = atob(base64.slice(0, 16))
    const bytes = new Uint8Array(decoded.length)
    for (let i = 0; i < decoded.length; i++) {
      bytes[i] = decoded.charCodeAt(i)
    }
    return bytes
  } catch {
    return null
  }
}

/**
 * Detect MIME type from image header bytes.
 */
function detectImageMime(bytes: Uint8Array): string | null {
  // PNG signature: 89 50 4E 47
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return "image/png"
  }
  // JPEG signature: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg"
  }
  // GIF signature: 47 49 46 38
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) {
    return "image/gif"
  }
  return null
}

/**
 * Create a data URL from raw base64 image data.
 */
function createImageDataUrl(base64: string): string | null {
  if (!base64 || typeof base64 !== "string") return null
  if (base64.startsWith("data:image/")) return base64

  const headerBytes = decodeBase64Header(base64)
  if (!headerBytes) return null

  const mime = detectImageMime(headerBytes)
  if (!mime) return null

  return `data:${mime};base64,${base64}`
}

type AvatarMode = "url" | "upload"

interface AvatarFieldValue {
  mode: AvatarMode
  url?: string
  base64?: string
}

interface AvatarFieldProps {
  value?: AvatarFieldValue
  onChange?: (value: AvatarFieldValue) => void
}

/**
 * Unified avatar field that allows choosing between URL input or file upload.
 * Stores both mode and the corresponding value.
 */
export function AvatarField({ value, onChange }: AvatarFieldProps) {
  const { t } = useTranslation(["settings", "common"])
  const [loading, setLoading] = React.useState(false)

  const mode = value?.mode || "url"
  const urlValue = value?.url || ""
  const base64Value = value?.base64 || ""

  const handleModeChange = (newMode: AvatarMode) => {
    onChange?.({
      mode: newMode,
      url: newMode === "url" ? urlValue : "",
      base64: newMode === "upload" ? base64Value : ""
    })
  }

  const handleUrlChange = (newUrl: string) => {
    onChange?.({
      mode: "url",
      url: newUrl,
      base64: ""
    })
  }

  const handleUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      message.error(
        t("settings:manageCharacters.avatar.selectImageError", {
          defaultValue: "Please select an image file"
        })
      )
      return false
    }

    setLoading(true)
    try {
      const reader = new FileReader()
      reader.onload = (e) => {
        const result = e.target?.result as string
        if (result) {
          const base64Match = result.match(/^data:image\/[^;]+;base64,(.+)$/)
          if (base64Match) {
            const rawBase64 = base64Match[1]
            const headerBytes = decodeBase64Header(rawBase64)
            if (headerBytes) {
              const mime = detectImageMime(headerBytes)
              if (mime && ALLOWED_IMAGE_MIME_TYPES.has(mime)) {
                onChange?.({
                  mode: "upload",
                  url: "",
                  base64: rawBase64
                })
              } else {
                message.error(
                  t("settings:manageCharacters.avatar.formatError", {
                    defaultValue: "Only PNG, JPEG, and GIF images are supported"
                  })
                )
              }
            } else {
              message.error(
                t("settings:manageCharacters.avatar.invalidError", {
                  defaultValue: "Invalid image file"
                })
              )
            }
          } else {
            message.error(
              t("settings:manageCharacters.avatar.processError", {
                defaultValue: "Failed to process image"
              })
            )
          }
        }
        setLoading(false)
      }
      reader.onerror = () => {
        message.error(
          t("settings:manageCharacters.avatar.processError", {
            defaultValue: "Failed to process image"
          })
        )
        setLoading(false)
      }
      reader.readAsDataURL(file)
    } catch {
      message.error(
        t("settings:manageCharacters.avatar.processError", {
          defaultValue: "Failed to process image"
        })
      )
      setLoading(false)
    }
    return false // Prevent default upload behavior
  }

  const handleClearUpload = () => {
    onChange?.({
      mode: "upload",
      url: "",
      base64: ""
    })
  }

  const previewUrl = React.useMemo(() => {
    if (mode === "url" && urlValue) {
      return urlValue
    }
    if (mode === "upload" && base64Value) {
      return createImageDataUrl(base64Value)
    }
    return null
  }, [mode, urlValue, base64Value])

  return (
    <div className="space-y-3">
      {/* Mode selector */}
      <Radio.Group
        value={mode}
        onChange={(e) => handleModeChange(e.target.value)}
        className="flex gap-4">
        <Radio value="url" className="flex items-center gap-1">
          <Link className="w-4 h-4 inline-block mr-1" />
          {t("settings:manageCharacters.avatar.tabUrl", {
            defaultValue: "URL"
          })}
        </Radio>
        <Radio value="upload" className="flex items-center gap-1">
          <UploadIcon className="w-4 h-4 inline-block mr-1" />
          {t("settings:manageCharacters.avatar.tabUpload", {
            defaultValue: "Upload"
          })}
        </Radio>
      </Radio.Group>

      {/* URL input */}
      {mode === "url" && (
        <Input
          value={urlValue}
          onChange={(e) => handleUrlChange(e.target.value)}
          placeholder={t("settings:manageCharacters.form.avatarUrl.placeholder", {
            defaultValue: "https://example.com/avatar.png"
          })}
          prefix={<Link className="w-4 h-4 text-gray-400" />}
        />
      )}

      {/* Upload area */}
      {mode === "upload" && (
        <div className="space-y-2">
          {base64Value ? (
            <div className="relative inline-block">
              <img
                src={previewUrl || ""}
                alt="Avatar preview"
                className="w-16 h-16 rounded-lg object-cover border border-gray-200 dark:border-gray-700"
              />
              <button
                type="button"
                onClick={handleClearUpload}
                className="absolute -top-2 -right-2 rounded-full bg-red-500 p-1 text-white shadow-sm hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1"
                aria-label={t("common:clear", { defaultValue: "Clear" })}>
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <Upload.Dragger
              accept="image/png,image/jpeg,image/gif"
              showUploadList={false}
              beforeUpload={handleUpload}
              disabled={loading}
              className="!border-dashed !border-gray-300 dark:!border-gray-600 hover:!border-blue-400 dark:hover:!border-blue-500">
              <div className="flex flex-col items-center gap-2 py-4">
                <ImageIcon className="w-8 h-8 text-gray-400" />
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {loading
                    ? t("common:loading", { defaultValue: "Loading..." })
                    : t("settings:manageCharacters.avatar.dropzone", {
                        defaultValue: "Click or drag image to upload"
                      })}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  {t("settings:manageCharacters.avatar.formats", {
                    defaultValue: "PNG, JPEG, or GIF"
                  })}
                </p>
              </div>
            </Upload.Dragger>
          )}
        </div>
      )}

      {/* Preview for URL mode */}
      {mode === "url" && urlValue && (
        <div className="flex items-center gap-2">
          <img
            src={urlValue}
            alt="Avatar preview"
            className="w-10 h-10 rounded-lg object-cover border border-gray-200 dark:border-gray-700"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none"
            }}
          />
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {t("settings:manageCharacters.avatar.preview", {
              defaultValue: "Preview"
            })}
          </span>
        </div>
      )}
    </div>
  )
}

/**
 * Helper to extract avatar_url and image_base64 from AvatarFieldValue for form submission.
 */
export function extractAvatarValues(avatar?: AvatarFieldValue): {
  avatar_url?: string
  image_base64?: string
} {
  if (!avatar) return {}
  return {
    avatar_url: avatar.mode === "url" ? avatar.url || undefined : undefined,
    image_base64: avatar.mode === "upload" ? avatar.base64 || undefined : undefined
  }
}

/**
 * Helper to create AvatarFieldValue from existing avatar_url and image_base64.
 */
export function createAvatarValue(
  avatar_url?: string | null,
  image_base64?: string | null
): AvatarFieldValue {
  if (image_base64) {
    return { mode: "upload", url: "", base64: image_base64 }
  }
  return { mode: "url", url: avatar_url || "", base64: "" }
}
