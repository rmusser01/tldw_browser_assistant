import React from "react"
import { Button, Drawer, Tag, Typography } from "antd"

type QuickIngestRow = {
  id: string
  url: string
  type: "auto" | "html" | "pdf" | "document" | "audio" | "video"
}

type StatusSummary = {
  label: string
  color: string
  reason?: string
}

type QuickIngestInspectorDrawerProps = {
  open: boolean
  onClose: () => void
  showIntro: boolean
  onDismissIntro: () => void
  qi: (key: string, defaultValue: string, options?: Record<string, any>) => string
  selectedRow: QuickIngestRow | null
  selectedFile: File | null
  typeIcon: (type: string) => React.ReactNode
  inferIngestTypeFromUrl: (url: string) => string
  fileTypeFromName: (file: File) => string
  statusForUrlRow: (row: QuickIngestRow) => StatusSummary
  statusForFile: (file: File) => StatusSummary
  formatBytes: (size: number) => string
}

export const QuickIngestInspectorDrawer: React.FC<
  QuickIngestInspectorDrawerProps
> = ({
  open,
  onClose,
  showIntro,
  onDismissIntro,
  qi,
  selectedRow,
  selectedFile,
  typeIcon,
  inferIngestTypeFromUrl,
  fileTypeFromName,
  statusForUrlRow,
  statusForFile,
  formatBytes
}) => {
  return (
    <Drawer
      title={qi("inspectorTitle", "Inspector")}
      placement="right"
      onClose={onClose}
      open={open}
      destroyOnHidden
      width={380}>
      <div className="space-y-3">
        {showIntro && (
          <div className="rounded-md border border-primary/20 bg-primary/10 p-3 text-sm text-text">
            <Typography.Text strong className="block mb-1">
              {qi("inspectorIntroTitle", "How to use the Inspector")}
            </Typography.Text>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>
                {qi(
                  "inspectorIntroItem1",
                  "Click a queued item to see its detected type, status, and warnings."
                )}
              </li>
              <li>
                {qi(
                  "inspectorIntroItem2",
                  "Use per-type controls on the main panel to set defaults; any per-row override marks it Custom."
                )}
              </li>
              <li>
                {qi(
                  "inspectorIntroItem3",
                  "For auth-required URLs, add cookies/headers in Advanced before ingesting."
                )}
              </li>
            </ul>
            <Button
              size="small"
              className="mt-2"
              aria-label={qi(
                "inspectorIntroDismiss",
                "Dismiss Inspector intro and close"
              )}
              title={qi(
                "inspectorIntroDismiss",
                "Dismiss Inspector intro and close"
              )}
              onClick={onDismissIntro}>
              {qi("gotIt", "Got it")}
            </Button>
          </div>
        )}
        {selectedRow || selectedFile ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              {typeIcon(
                selectedRow
                  ? selectedRow.type === "auto"
                    ? inferIngestTypeFromUrl(selectedRow.url)
                    : selectedRow.type
                  : selectedFile
                    ? fileTypeFromName(selectedFile)
                    : "auto"
              )}
              <Typography.Text strong>
                {selectedRow
                  ? selectedRow.url || qi("untitledUrl", "Untitled URL")
                  : selectedFile?.name}
              </Typography.Text>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
              {selectedRow ? (
                <>
                  <Tag
                    color={
                      statusForUrlRow(selectedRow).color === "default"
                        ? undefined
                        : statusForUrlRow(selectedRow).color
                    }>
                    {statusForUrlRow(selectedRow).label}
                  </Tag>
                  <Tag color="geekblue">
                    {(
                      selectedRow.type === "auto"
                        ? inferIngestTypeFromUrl(selectedRow.url)
                        : selectedRow.type
                    ).toUpperCase()}
                  </Tag>
                  {statusForUrlRow(selectedRow).reason ? (
                    <span className="text-orange-600">
                      {statusForUrlRow(selectedRow).reason}
                    </span>
                  ) : (
                    <span>{qi("defaultsApplied", "Defaults will be applied.")}</span>
                  )}
                </>
              ) : null}
              {selectedFile ? (
                <>
                  <Tag
                    color={
                      statusForFile(selectedFile).color === "default"
                        ? undefined
                        : statusForFile(selectedFile).color
                    }>
                    {statusForFile(selectedFile).label}
                  </Tag>
                  <Tag color="geekblue">
                    {fileTypeFromName(selectedFile).toUpperCase()}
                  </Tag>
                  <span>
                    {formatBytes(selectedFile.size)}
                    {selectedFile.type ? ` · ${selectedFile.type}` : ""}
                  </span>
                  {statusForFile(selectedFile).reason ? (
                    <span className="text-orange-600">
                      {statusForFile(selectedFile).reason}
                    </span>
                  ) : null}
                </>
              ) : null}
            </div>
            {selectedRow ? (
              <div className="text-xs text-text-muted">
                {qi(
                  "inspectorRowEditHint",
                  "Editing the URL or forcing a type marks this item as Custom."
                )}
              </div>
            ) : null}
            {selectedFile ? (
              <div className="text-xs text-text-muted">
                {qi(
                  "inspectorFileHint",
                  "File settings follow the per-type controls on the main panel."
                )}
              </div>
            ) : null}
            <div className="text-xs text-text-subtle">
              {qi(
                "inspectorAdvancedHint",
                "Use Advanced options to set cookies/auth if required. Errors or warnings appear on each row."
              )}
            </div>
          </div>
        ) : (
          <div className="text-sm text-text-muted">
            {qi("inspectorEmpty", "Select a queued item to view details.")}
          </div>
        )}
      </div>
    </Drawer>
  )
}
