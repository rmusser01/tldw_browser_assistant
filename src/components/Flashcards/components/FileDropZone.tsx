import { Button } from "antd"
import { Upload } from "lucide-react"
import React from "react"
import { useTranslation } from "react-i18next"

interface FileDropZoneProps {
  onFileContent: (content: string) => void
  onError?: (error: string) => void
  accept?: string
  maxSizeBytes?: number
}

export const FileDropZone: React.FC<FileDropZoneProps> = ({
  onFileContent,
  onError,
  accept = ".csv,.tsv,.txt",
  maxSizeBytes = 5 * 1024 * 1024 // 5MB default
}) => {
  const { t } = useTranslation(["option", "common"])
  const [isDragging, setIsDragging] = React.useState(false)
  const [fileName, setFileName] = React.useState<string | null>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)
  // Use drag counter to prevent flickering when dragging over nested elements
  const dragCounterRef = React.useRef(0)

  const processFile = async (file: File) => {
    // Validate file size
    if (file.size > maxSizeBytes) {
      onError?.(
        t("option:flashcards.importDropzone.fileTooLarge", {
          defaultValue: "File is too large. Maximum size is 5MB."
        })
      )
      return
    }

    // Validate file type
    const validExtensions = accept.split(",").map((ext) => ext.trim().toLowerCase())
    const fileExt = "." + file.name.split(".").pop()?.toLowerCase()
    if (!validExtensions.includes(fileExt)) {
      onError?.(
        t("option:flashcards.importDropzone.invalidFileType", {
          defaultValue: "Invalid file type. Please use CSV, TSV, or TXT files."
        })
      )
      return
    }

    try {
      const text = await file.text()
      setFileName(file.name)
      onFileContent(text)
    } catch {
      onError?.(
        t("option:flashcards.importDropzone.readError", {
          defaultValue: "Failed to read file. Please try again."
        })
      )
    }
  }

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    dragCounterRef.current += 1
    if (dragCounterRef.current === 1) {
      setIsDragging(true)
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    dragCounterRef.current -= 1
    if (dragCounterRef.current === 0) {
      setIsDragging(false)
    }
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    dragCounterRef.current = 0
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) await processFile(file)
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) await processFile(file)
    // Reset input so same file can be selected again
    if (e.target) e.target.value = ""
  }

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`
        border-2 border-dashed rounded-lg p-6 text-center transition-colors
        ${isDragging ? "border-primary bg-primary/5" : "border-border"}
      `}
    >
      <Upload className="size-8 mx-auto mb-2 text-text-muted" />
      {fileName ? (
        <p className="text-sm text-text mb-2">
          <span className="font-medium">{fileName}</span>{" "}
          {t("option:flashcards.importDropzone.loaded", { defaultValue: "loaded" })}
        </p>
      ) : (
        <p className="text-sm text-text-muted mb-2">
          {t("option:flashcards.importDropzone.dropHint", {
            defaultValue: "Drag and drop a CSV/TSV file here, or"
          })}
        </p>
      )}
      <Button onClick={() => inputRef.current?.click()}>
        {fileName
          ? t("option:flashcards.importDropzone.chooseDifferent", { defaultValue: "Choose different file" })
          : t("option:flashcards.importDropzone.browseFiles", { defaultValue: "Browse files" })}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  )
}
