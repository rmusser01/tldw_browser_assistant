import { Dropdown, Tooltip, ConfigProvider, Modal } from "antd"
import {
  CopyCheckIcon,
  CopyIcon,
  DownloadIcon,
  TableIcon,
  ExpandIcon,
  XIcon
} from "lucide-react"
import { FC, useState, useMemo, useRef } from "react"
import { useTranslation } from "react-i18next"
import { IconButton } from "./IconButton"

interface TableProps {
  children: React.ReactNode
}

interface TableData {
  headers: string[]
  rows: string[][]
}

export const TableBlock: FC<TableProps> = ({ children }) => {
  const [copyStatus, setCopyStatus] = useState<string>("")
  const [isModalOpen, setIsModalOpen] = useState(false)
  const { t } = useTranslation("common")
  const ref = useRef<HTMLDivElement>(null)

  const parseData = () => {
    // get table from ref
    const table = ref.current
    if (!table) return

    const headers: string[] = []
    const rows: string[][] = []

    const headerCells = table.querySelectorAll("thead th")
    headerCells.forEach((cell) => {
      headers.push(cell.textContent || "")
    })

    const bodyRows = table.querySelectorAll("tbody tr")
    bodyRows.forEach((row) => {
      const rowData: string[] = []
      const cells = row.querySelectorAll("td")
      cells.forEach((cell) => {
        rowData.push(cell.textContent || "")
      })
      rows.push(rowData)
    })

    return { headers, rows }
  }

  const convertToCSV = () => {
    const tableData = parseData()
    if (!tableData) return

    const escapeCSV = (value: string): string => {
      if (value.includes(",") || value.includes('"') || value.includes("\n")) {
        return `"${value.replace(/"/g, '""')}"`
      }
      return value
    }

    const csvRows = []

    // Add headers
    if (tableData.headers.length > 0) {
      csvRows.push(tableData.headers.map(escapeCSV).join(","))
    }

    // Add data rows
    tableData.rows.forEach((row) => {
      csvRows.push(row.map(escapeCSV).join(","))
    })

    return csvRows.join("\n")
  }

  const handleCopyCSV = () => {
    const csvContent = convertToCSV()
    navigator.clipboard.writeText(csvContent)
    setCopyStatus("csv")
    setTimeout(() => setCopyStatus(""), 3000)
  }

  const handleDownloadCSV = () => {
    const csvContent = convertToCSV()
    downloadFile(csvContent, `table-${Date.now()}.csv`, "text/csv")
  }

  const handleExpandTable = () => {
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
  }

  const downloadFile = (
    content: string,
    filename: string,
    mimeType: string
  ) => {
    const blob = new Blob([content], { type: mimeType })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  }

  return (
    <div className="not-prose">
      <div className="my-4 bg-surface rounded-xl border border-border overflow-hidden">
        <div className="flex flex-row px-4 py-2 rounded-t-xl bg-surface2 border-b border-border">
          <div className="flex items-center gap-2 flex-1">
            <TableIcon className="size-4 text-text-muted" />
            <span className="font-mono text-xs text-text-muted">
              Table
            </span>
          </div>

          <div className="flex items-center gap-1">
            <Tooltip title={t('table.copyCsv', 'Copy as CSV')}>
              <IconButton
                ariaLabel={t('table.copyCsv', 'Copy as CSV') as string}
                onClick={handleCopyCSV}
                className="flex gap-1.5 items-center rounded bg-none p-1 text-xs text-text-muted hover:bg-surface2 hover:text-text focus:outline-none transition-colors">
                {copyStatus === "csv" ? (
                  <CopyCheckIcon className="size-4 text-success" />
                ) : (
                  <CopyIcon className="size-4" />
                )}
              </IconButton>
            </Tooltip>

            <ConfigProvider
              theme={{
                components: {
                  Dropdown: {
                    colorBgElevated: "var(--color-elevated)",
                    colorText: "var(--color-text)",
                    colorBgTextHover: "var(--color-surface-2)",
                    borderRadiusOuter: 8,
                    boxShadowSecondary:
                      "0 6px 16px 0 rgba(0, 0, 0, 0.08), 0 3px 6px -4px rgba(0, 0, 0, 0.12), 0 9px 28px 8px rgba(0, 0, 0, 0.05)"
                  }
                }
              }}>
              <Tooltip title={t('table.downloadCsv', 'Download CSV')}>
                <IconButton
                  ariaLabel={t('table.downloadCsv', 'Download CSV') as string}
                  onClick={handleDownloadCSV}
                  className="flex gap-1.5 items-center rounded bg-none p-1 text-xs text-text-muted hover:bg-surface2 hover:text-text focus:outline-none transition-colors">
                  <DownloadIcon className="size-4" />
                </IconButton>
              </Tooltip>
            </ConfigProvider>
          </div>
        </div>

        <div className="overflow-x-auto">
          <div
            ref={ref}
            className={`prose dark:prose-invert max-w-none [&_table]:table-fixed [&_table]:text-sm [&_table]:w-full [&_table]:border-collapse [&_thead]:bg-surface2 [&_th]:px-6 [&_th]:py-4 [&_th]:text-left [&_th]:font-semibold [&_th]:text-text [&_th]:text-xs [&_th]:uppercase [&_th]:tracking-wider [&_th]:whitespace-nowrap [&_th:nth-child(1)]:w-1/2 [&_th:nth-child(2)]:w-1/2 [&_th:nth-child(3)]:w-1/3 [&_th]:border-b [&_th]:border-border [&_td]:px-6 [&_td]:py-4 [&_td]:text-text-muted [&_td]:text-sm [&_td]:text-left [&_td]:whitespace-nowrap  [&_td]:border-b [&_td]:border-border [&_tr:last-child_td]:border-b-0`}>
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
