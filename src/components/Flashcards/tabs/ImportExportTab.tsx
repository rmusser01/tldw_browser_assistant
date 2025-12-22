import React from "react"
import {
  Button,
  Card,
  Form,
  Input,
  Select,
  Space,
  Switch,
  Typography
} from "antd"
import { useTranslation } from "react-i18next"
import { useAntdMessage } from "@/hooks/useAntdMessage"
import {
  useDecksQuery,
  useImportFlashcardsMutation,
  useImportLimitsQuery
} from "../hooks"

const { Text } = Typography

/**
 * Import panel for CSV/TSV flashcard import.
 */
const ImportPanel: React.FC = () => {
  const message = useAntdMessage()
  const { t } = useTranslation(["option", "common"])
  const limitsQuery = useImportLimitsQuery()
  const importMutation = useImportFlashcardsMutation()

  const [content, setContent] = React.useState("")
  const [delimiter, setDelimiter] = React.useState<string>("\t")
  const [hasHeader, setHasHeader] = React.useState<boolean>(false)

  const handleImport = async () => {
    try {
      await importMutation.mutateAsync({
        content,
        delimiter,
        hasHeader
      })
      message.success(t("option:flashcards.imported", { defaultValue: "Imported" }))
      setContent("")
    } catch (e: any) {
      message.error(e?.message || "Import failed")
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <Text type="secondary">
          {t("option:flashcards.importHelp", {
            defaultValue: "Paste TSV/CSV lines: Deck, Front, Back, Tags, Notes"
          })}
        </Text>
        <pre className="mt-1 rounded bg-gray-50 p-2 text-xs text-gray-700 dark:bg-[#111] dark:text-gray-200">
          Deck	Front	Back	Tags	Notes
          My deck	What is a closure?	A function with preserved outer scope.	javascript; fundamentals	Lecture 3
        </pre>
      </div>
      <Input.TextArea
        rows={10}
        placeholder={t("option:flashcards.pasteContent", {
          defaultValue: "Paste content here..."
        })}
        value={content}
        onChange={(e) => setContent(e.target.value)}
      />
      <Space>
        <Select
          value={delimiter}
          onChange={setDelimiter}
          options={[
            {
              label: t("option:flashcards.tab", { defaultValue: "Tab" }),
              value: "\t"
            },
            {
              label: t("option:flashcards.comma", { defaultValue: ", (Comma)" }),
              value: ","
            },
            {
              label: t("option:flashcards.semicolon", {
                defaultValue: "; (Semicolon)"
              }),
              value: ";"
            },
            {
              label: t("option:flashcards.pipe", { defaultValue: "| (Pipe)" }),
              value: "|"
            }
          ]}
        />
        <Space>
          <Text>
            {t("option:flashcards.hasHeader", { defaultValue: "Has header" })}
          </Text>
          <Switch checked={hasHeader} onChange={setHasHeader} />
        </Space>
      </Space>
      {limitsQuery.data && (
        <Text type="secondary" className="text-xs">
          {t("option:flashcards.importLimits", {
            defaultValue:
              "Limits: max {{maxCards}} cards, {{maxSize}} bytes per import",
            maxCards: limitsQuery.data.max_cards_per_import,
            maxSize: limitsQuery.data.max_content_size_bytes
          })}
        </Text>
      )}
      <Button
        type="primary"
        onClick={handleImport}
        loading={importMutation.isPending}
        disabled={!content.trim()}
      >
        {t("option:flashcards.importButton", { defaultValue: "Import" })}
      </Button>
    </div>
  )
}

/**
 * Export panel for CSV/APKG export.
 */
const ExportPanel: React.FC = () => {
  const { t } = useTranslation(["option", "common"])
  const message = useAntdMessage()
  const decksQuery = useDecksQuery()
  const [exportDeckId, setExportDeckId] = React.useState<number | null>(null)
  const [exportFormat, setExportFormat] = React.useState<"csv" | "apkg">("csv")
  const [isExporting, setIsExporting] = React.useState(false)

  const handleExport = async () => {
    setIsExporting(true)
    try {
      const { exportFlashcardsFile, exportFlashcards } = await import(
        "@/services/flashcards"
      )
      let blob: Blob
      if (exportFormat === "apkg") {
        blob = await exportFlashcardsFile({
          deck_id: exportDeckId ?? undefined,
          format: "apkg"
        })
      } else {
        const text = await exportFlashcards({
          deck_id: exportDeckId ?? undefined,
          format: "csv"
        })
        blob = new Blob([text], { type: "text/csv;charset=utf-8" })
      }
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = exportFormat === "apkg" ? "flashcards.apkg" : "flashcards.csv"
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e: any) {
      message.error(e?.message || "Export failed")
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <Text type="secondary">
          {t("option:flashcards.exportHelp", {
            defaultValue:
              "Export your flashcards to CSV or Anki-compatible APKG format."
          })}
        </Text>
      </div>
      <Form.Item
        label={t("option:flashcards.deck", { defaultValue: "Deck" })}
        className="!mb-2"
      >
        <Select
          placeholder={t("option:flashcards.allDecks", {
            defaultValue: "All decks"
          })}
          allowClear
          loading={decksQuery.isLoading}
          value={exportDeckId as any}
          onChange={setExportDeckId}
          options={(decksQuery.data || []).map((d) => ({
            label: d.name,
            value: d.id
          }))}
        />
      </Form.Item>
      <Form.Item
        label={t("option:flashcards.exportFormat", { defaultValue: "Format" })}
        className="!mb-2"
      >
        <Select
          value={exportFormat}
          onChange={setExportFormat}
          options={[
            { label: "CSV", value: "csv" },
            { label: "APKG (Anki)", value: "apkg" }
          ]}
        />
      </Form.Item>
      <Button type="primary" onClick={handleExport} loading={isExporting}>
        {t("option:flashcards.exportButton", { defaultValue: "Export" })}
      </Button>
    </div>
  )
}

/**
 * Import/Export tab for flashcards.
 */
export const ImportExportTab: React.FC = () => {
  const { t } = useTranslation(["option", "common"])

  return (
    <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
      <Card
        title={t("option:flashcards.importTitle", {
          defaultValue: "Import Flashcards"
        })}
      >
        <ImportPanel />
      </Card>
      <Card
        title={t("option:flashcards.exportTitle", {
          defaultValue: "Export Flashcards"
        })}
      >
        <ExportPanel />
      </Card>
    </div>
  )
}

export default ImportExportTab
