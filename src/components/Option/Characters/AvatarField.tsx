import React from "react"
import { Input, Radio, Upload, message } from "antd"
import { ImageIcon, Link, X, Upload as UploadIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import {
  ALLOWED_IMAGE_MIME_TYPES,
  createImageDataUrl,
  decodeBase64Header,
  detectImageMime
} from "@/utils/image-utils"

export type AvatarMode = "url" | "upload"

export interface AvatarFieldValue {
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
  const [urlImgError, setUrlImgError] = React.useState(false)

  const mode = value?.mode || "url"
  const urlValue = value?.url || ""
  const base64Value = value?.base64 || ""

  React.useEffect(() => {
    setUrlImgError(false)
  }, [urlValue])

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
      const result = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          if (typeof reader.result === "string") {
            resolve(reader.result)
            return
          }
          reject(new Error("Invalid image data"))
        }
        reader.onerror = () => {
          reject(reader.error || new Error("Failed to process image"))
        }
        reader.readAsDataURL(file)
      })

      const base64Match = result.match(/^data:image\/[^;]+;base64,(.+)$/)
      if (!base64Match) {
        message.error(
          t("settings:manageCharacters.avatar.processError", {
            defaultValue: "Failed to process image"
          })
        )
        return false
      }

      const rawBase64 = base64Match[1]
      const headerBytes = decodeBase64Header(rawBase64)
      if (!headerBytes) {
        message.error(
          t("settings:manageCharacters.avatar.invalidError", {
            defaultValue: "Invalid image file"
          })
        )
        return false
      }

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
    } catch {
      message.error(
        t("settings:manageCharacters.avatar.processError", {
          defaultValue: "Failed to process image"
        })
      )
    } finally {
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
          prefix={<Link className="w-4 h-4 text-text-subtle" />}
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
                className="w-16 h-16 rounded-lg object-cover border border-border"
              />
              <button
                type="button"
                onClick={handleClearUpload}
                className="absolute -top-2 -right-2 rounded-full bg-danger p-1 text-white shadow-sm hover:bg-danger focus:outline-none focus:ring-2 focus:ring-danger focus:ring-offset-1"
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
              className="!border-dashed !border-border hover:!border-primary">
              <div className="flex flex-col items-center gap-2 py-4">
                <ImageIcon className="w-8 h-8 text-text-subtle" />
                <p className="text-sm text-text-muted">
                  {loading
                    ? t("common:loading.title", {
                        defaultValue: "Loading..."
                      })
                    : t("settings:manageCharacters.avatar.dropzone", {
                        defaultValue: "Click or drag image to upload"
                      })}
                </p>
                <p className="text-xs text-text-subtle">
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
      {mode === "url" && urlValue && !urlImgError && (
        <div className="flex items-center gap-2">
          <img
            src={urlValue}
            alt="Avatar preview"
            className="w-10 h-10 rounded-lg object-cover border border-border"
            onError={() => {
              setUrlImgError(true)
            }}
          />
          <span className="text-xs text-text-subtle">
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
