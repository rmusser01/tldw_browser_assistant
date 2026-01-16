import "katex/dist/katex.min.css"

import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import ReactMarkdown from "react-markdown"
import rehypeKatex from "rehype-katex"
import { Highlight } from "prism-react-renderer"

import "property-information"
import React from "react"
import { CodeBlock } from "./CodeBlock"
import { TableBlock } from "./TableBlock"
import { preprocessLaTeX } from "@/utils/latex"
import { useStorage } from "@plasmohq/storage/hook"
import { highlightText } from "@/utils/text-highlight"
import { DEFAULT_CHAT_SETTINGS } from "@/types/chat-settings"
import { normalizeLanguage, resolveTheme, safeLanguage } from "@/utils/code-theme"

function Markdown({
  message,
  className = "prose break-words dark:prose-invert prose-p:leading-relaxed prose-pre:p-0 dark:prose-dark",
  searchQuery,
  codeBlockVariant = "default",
  allowExternalImages
}: {
  message: string
  className?: string
  searchQuery?: string
  codeBlockVariant?: "default" | "plain" | "compact"
  allowExternalImages?: boolean
}) {
  const [checkWideMode] = useStorage("checkWideMode", false)
  const [codeTheme] = useStorage("codeTheme", "auto")
  const [allowExternalImagesSetting] = useStorage(
    "allowExternalImages",
    DEFAULT_CHAT_SETTINGS.allowExternalImages
  )
  const blockIndexRef = React.useRef(0)
  blockIndexRef.current = 0
  if (checkWideMode) {
    className += " max-w-none"
  }
  const resolvedAllowExternalImages =
    typeof allowExternalImages === "boolean"
      ? allowExternalImages
      : allowExternalImagesSetting
  const paragraphClass =
    codeBlockVariant === "plain" || codeBlockVariant === "compact"
      ? "mb-2 last:mb-0 whitespace-pre-wrap"
      : "mb-2 last:mb-0"
  message = preprocessLaTeX(message)
  return (
    <React.Fragment>
      <ReactMarkdown
        className={className}
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          pre({ children }) {
            return children
          },
          code({ node, inline, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || "")
            const blockIndex = blockIndexRef.current++
            const value = String(children).replace(/\n$/, "")
            if (!inline) {
              if (codeBlockVariant === "plain") {
                return (
                  <div className="my-2 rounded-lg border border-border bg-surface2/70 px-3 py-2 text-xs font-mono leading-relaxed text-text whitespace-pre overflow-x-auto">
                    {value}
                  </div>
                )
              }
              if (codeBlockVariant === "compact") {
                const rawLanguage = match ? match[1] : ""
                const normalizedLanguage = normalizeLanguage(rawLanguage)
                const highlightLanguage = rawLanguage
                  ? normalizedLanguage
                  : "markdown"
                return (
                  <div className="not-prose my-2 rounded-lg border border-border bg-surface2/70 px-3 py-2 overflow-x-auto">
                    <Highlight
                      code={value}
                      language={safeLanguage(highlightLanguage)}
                      theme={resolveTheme(codeTheme || "dracula")}>
                      {({
                        className: highlightClassName,
                        style,
                        tokens,
                        getLineProps,
                        getTokenProps
                      }) => (
                        <pre
                          className={`${highlightClassName} m-0 text-xs font-mono leading-relaxed`}
                          style={{
                            ...style,
                            backgroundColor: "transparent",
                            fontFamily: "var(--font-mono)"
                          }}>
                          {tokens.map((line, i) => (
                            <div key={i} {...getLineProps({ line, key: i })}>
                              {line.map((token, key) => (
                                <span
                                  key={key}
                                  {...getTokenProps({ token, key })}
                                />
                              ))}
                            </div>
                          ))}
                        </pre>
                      )}
                    </Highlight>
                  </div>
                )
              }
              return (
                <CodeBlock
                  language={match ? match[1] : ""}
                  value={value}
                  blockIndex={blockIndex}
                />
              )
            }
            return (
              <code className={`${className} font-semibold`} {...props}>
                {children}
              </code>
            )
          },
          a({ node, ...props }) {
            return (
              <a
                target="_blank"
                rel="noreferrer"
                className="text-blue-500 text-sm hover:underline"
                {...props}>
                {props.children}
              </a>
            )
          },
          img({ src, alt }) {
            const resolvedSrc = typeof src === "string" ? src : ""
            const isExternal =
              /^https?:\/\//i.test(resolvedSrc) ||
              /^\/\/[^/]/.test(resolvedSrc)
            const isAllowed = !isExternal || resolvedAllowExternalImages
            if (!resolvedSrc) return null
            if (!isAllowed) {
              return (
                <span className="inline-flex items-center gap-2 rounded-md border border-border bg-surface2 px-2 py-1 text-[11px] text-text-muted">
                  <span>
                    {alt ? `Image: ${alt}` : "External image blocked"}
                  </span>
                  <a
                    href={resolvedSrc}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline"
                  >
                    Open
                  </a>
                </span>
              )
            }
            return (
              <img
                src={resolvedSrc}
                alt={alt || ""}
                loading="lazy"
                referrerPolicy="no-referrer"
                className="my-2 max-w-full rounded-md border border-border"
              />
            )
          },
          table({ children }) {
            return <TableBlock>{children}</TableBlock>
          },
          p({ children }) {
            return <p className={paragraphClass}>{children}</p>
          },
          // Apply search highlighting to text nodes
          text({ children }) {
            if (searchQuery && typeof children === "string") {
              return highlightText(children, searchQuery)
            }
            return <>{children}</>
          }
        }}>
        {message}
      </ReactMarkdown>
    </React.Fragment>
  )
}

export default Markdown
