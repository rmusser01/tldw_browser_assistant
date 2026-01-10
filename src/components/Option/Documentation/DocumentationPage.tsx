import React from "react"
import { Input, Tabs } from "antd"
import { FileText, Search } from "lucide-react"
import { useTranslation } from "react-i18next"

import FeatureEmptyState from "@/components/Common/FeatureEmptyState"
import { MarkdownErrorBoundary } from "@/components/Common/MarkdownErrorBoundary"
import { PageShell } from "@/components/Common/PageShell"
import { classNames } from "@/libs/class-name"
import { textContainsQuery } from "@/utils/text-highlight"

const Markdown = React.lazy(() => import("@/components/Common/Markdown"))

type DocSource = "extension" | "server"

type DocEntry = {
  id: string
  title: string
  content: string
  source: DocSource
  relativePath: string
  fullPath: string
}

const EXTENSION_DOC_IMPORTS = import.meta.glob<string>(
  "/Docs/User_Documentation/**/*.{md,mdx}",
  { eager: true, as: "raw" }
)
const SERVER_DOC_IMPORTS = import.meta.glob<string>(
  "/Docs/Published/**/*.{md,mdx}",
  { eager: true, as: "raw" }
)

const stripFrontmatter = (content: string) =>
  content.replace(/^---[\s\S]*?---\s*/, "")

const normalizeTitle = (value: string) =>
  value.replace(/\s+/g, " ").trim()

const toTitleCase = (value: string) =>
  value.replace(/\b\w/g, (char) => char.toUpperCase())

const fileTitleFromPath = (path: string) => {
  const fileName = path.split("/").pop() || path
  const baseName = fileName.replace(/\.[^.]+$/, "")
  return toTitleCase(normalizeTitle(baseName.replace(/[_-]+/g, " ")))
}

const extractTitle = (content: string, fallback: string) => {
  const stripped = stripFrontmatter(content)
  const match = stripped.match(/^#\s+(.+)$/m)
  if (match?.[1]) {
    return normalizeTitle(match[1])
  }
  return normalizeTitle(fallback)
}

const normalizePath = (path: string) => path.replace(/^\/+/, "")

const buildDocs = (
  imports: Record<string, string>,
  source: DocSource,
  baseDir: string
): DocEntry[] =>
  Object.entries(imports)
    .map(([path, content]) => {
      const fullPath = normalizePath(path)
      const relativePath = fullPath.startsWith(`${baseDir}/`)
        ? fullPath.slice(baseDir.length + 1)
        : fullPath
      const fallbackTitle = fileTitleFromPath(relativePath)
      const title = extractTitle(content, fallbackTitle)
      return {
        id: `${source}:${fullPath}`,
        title,
        content,
        source,
        relativePath,
        fullPath
      }
    })
    .sort((a, b) => a.title.localeCompare(b.title))

const EXTENSION_DOCS = buildDocs(
  EXTENSION_DOC_IMPORTS,
  "extension",
  "Docs/User_Documentation"
)
const SERVER_DOCS = buildDocs(
  SERVER_DOC_IMPORTS,
  "server",
  "Docs/Published"
)

export const DocumentationPage: React.FC = () => {
  const { t } = useTranslation(["option", "common"])
  const [activeSource, setActiveSource] = React.useState<DocSource>(() => {
    if (EXTENSION_DOCS.length > 0) return "extension"
    if (SERVER_DOCS.length > 0) return "server"
    return "extension"
  })
  const [activeDocIds, setActiveDocIds] = React.useState<
    Record<DocSource, string | null>
  >(() => ({
    extension: EXTENSION_DOCS[0]?.id ?? null,
    server: SERVER_DOCS[0]?.id ?? null
  }))
  const [searchQuery, setSearchQuery] = React.useState("")

  const docsBySource = React.useMemo(
    () => ({
      extension: EXTENSION_DOCS,
      server: SERVER_DOCS
    }),
    []
  )

  const sourceMeta = React.useMemo(
    () => ({
      extension: {
        label: t(
          "option:documentation.sourceExtension",
          "tldw browser extension"
        ),
        path: "Docs/User_Documentation"
      },
      server: {
        label: t("option:documentation.sourceServer", "tldw_server"),
        path: "Docs/Published"
      }
    }),
    [t]
  )

  const trimmedQuery = searchQuery.trim()

  const filterDocs = React.useCallback(
    (docs: DocEntry[]) => {
      if (!trimmedQuery) return docs
      return docs.filter((doc) =>
        textContainsQuery(`${doc.title}\n${doc.content}`, trimmedQuery)
      )
    },
    [trimmedQuery]
  )

  const renderDocPane = (source: DocSource) => {
    const docs = docsBySource[source]
    const filteredDocs = filterDocs(docs)
    const activeDocId = activeDocIds[source]
    const selectedDocId =
      activeDocId && filteredDocs.some((doc) => doc.id === activeDocId)
        ? activeDocId
        : filteredDocs[0]?.id ?? null
    const selectedDoc =
      filteredDocs.find((doc) => doc.id === selectedDocId) ?? null

    if (docs.length === 0) {
      return (
        <FeatureEmptyState
          title={t(
            "option:documentation.emptyTitle",
            "No documentation found"
          )}
          description={t(
            "option:documentation.emptyDescription",
            "Add markdown files under {{path}} to populate this section.",
            { path: sourceMeta[source].path }
          )}
          icon={FileText}
        />
      )
    }

    return (
      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="lg:w-72 lg:shrink-0">
          <div className="rounded-2xl border border-border bg-surface/90 p-4">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                {t("option:documentation.documentsLabel", "Documents")}
              </p>
              <p className="text-sm font-medium text-text">
                {sourceMeta[source].label}
              </p>
              <p className="text-xs text-text-muted font-mono">
                {sourceMeta[source].path}
              </p>
              <p className="text-xs text-text-muted">
                {t("option:documentation.resultsLabel", "{{count}} results", {
                  count: filteredDocs.length
                })}
              </p>
            </div>
            <div className="mt-3 max-h-[60vh] space-y-2 overflow-auto pr-1">
              {filteredDocs.length > 0 ? (
                filteredDocs.map((doc) => {
                  const isActive = selectedDocId === doc.id
                  return (
                    <button
                      key={doc.id}
                      type="button"
                      aria-pressed={isActive}
                      onClick={() =>
                        setActiveDocIds((prev) => ({
                          ...prev,
                          [source]: doc.id
                        }))
                      }
                      className={classNames(
                        "w-full rounded-xl border px-3 py-2 text-left text-sm transition",
                        isActive
                          ? "border-primary/40 bg-primary/10 text-text"
                          : "border-transparent text-text-muted hover:border-border hover:bg-surface2 hover:text-text"
                      )}
                    >
                      <div className="font-medium">{doc.title}</div>
                      <div className="mt-0.5 text-xs text-text-muted">
                        {doc.relativePath}
                      </div>
                    </button>
                  )
                })
              ) : (
                <div className="rounded-xl border border-dashed border-border px-3 py-4 text-xs text-text-muted">
                  {t(
                    "option:documentation.noMatchesList",
                    "No matches in this source."
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex-1">
          {selectedDoc ? (
            <div className="rounded-2xl border border-border bg-surface/90 p-5">
              <div className="flex flex-col gap-1 border-b border-border pb-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-text">
                      {selectedDoc.title}
                    </h2>
                    <p className="text-xs text-text-muted">
                      {selectedDoc.relativePath}
                    </p>
                  </div>
                  <span className="rounded-full bg-surface2 px-2 py-0.5 text-[11px] font-semibold text-text-muted">
                    {sourceMeta[source].label}
                  </span>
                </div>
              </div>
              <div className="pt-4">
                <MarkdownErrorBoundary fallbackText={selectedDoc.content}>
                  <React.Suspense
                    fallback={
                      <div className="text-sm text-text-muted">
                        {t("common:loading.content", "Loading content...")}
                      </div>
                    }
                  >
                    <Markdown
                      message={selectedDoc.content}
                      searchQuery={trimmedQuery}
                      className="prose break-words dark:prose-invert max-w-none prose-p:leading-relaxed prose-pre:p-0 dark:prose-dark"
                    />
                  </React.Suspense>
                </MarkdownErrorBoundary>
              </div>
            </div>
          ) : (
            <FeatureEmptyState
              title={t(
                "option:documentation.noMatchesTitle",
                "No matches"
              )}
              description={t(
                "option:documentation.noMatchesDescription",
                "Try a different search term."
              )}
              icon={Search}
            />
          )}
        </div>
      </div>
    )
  }

  return (
    <PageShell className="py-6" maxWidthClassName="max-w-6xl">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold text-text">
            {t("option:documentation.title", "Documentation")}
          </h1>
          <p className="text-sm text-text-muted">
            {t(
              "option:documentation.subtitle",
              "Browse documentation for the tldw browser extension and tldw_server."
            )}
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            allowClear
            prefix={<Search className="h-4 w-4 text-text-muted" />}
            placeholder={t(
              "option:documentation.searchPlaceholder",
              "Search documentation..."
            )}
            className="bg-surface"
          />
          <p className="text-xs text-text-muted">
            {t(
              "option:documentation.sourceHint",
              "Sources: {{extensionPath}} and {{serverPath}}",
              {
                extensionPath: "Docs/User_Documentation",
                serverPath: "Docs/Published"
              }
            )}
          </p>
        </div>
        <Tabs
          activeKey={activeSource}
          onChange={(key) => setActiveSource(key as DocSource)}
          items={[
            {
              key: "extension",
              label: `${sourceMeta.extension.label} (${docsBySource.extension.length})`,
              children: renderDocPane("extension")
            },
            {
              key: "server",
              label: `${sourceMeta.server.label} (${docsBySource.server.length})`,
              children: renderDocPane("server")
            }
          ]}
        />
      </div>
    </PageShell>
  )
}

export default DocumentationPage
