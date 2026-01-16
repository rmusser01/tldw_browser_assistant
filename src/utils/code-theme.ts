import { themes } from "prism-react-renderer"
import type { Language, PrismTheme } from "prism-react-renderer"

export const normalizeLanguage = (language: string): string => {
  const lang = (language || "").toLowerCase()
  if (lang === "js" || lang === "jsx") return "javascript"
  if (lang === "ts" || lang === "tsx") return "typescript"
  if (lang === "sh" || lang === "bash") return "bash"
  if (lang === "py") return "python"
  if (lang === "md" || lang === "markdown") return "markdown"
  if (lang === "yml") return "yaml"
  if (!lang) return "plaintext"
  return lang
}

export const safeLanguage = (language: string): Language =>
  normalizeLanguage(language) as Language

export const resolveTheme = (key: string): PrismTheme => {
  if (key === "auto") {
    let isDark = false
    try {
      if (typeof document !== "undefined") {
        const root = document.documentElement
        if (root.classList.contains("dark")) {
          isDark = true
        } else if (root.classList.contains("light")) {
          isDark = false
        } else if (typeof window !== "undefined") {
          isDark = window.matchMedia("(prefers-color-scheme: dark)").matches
        }
      }
    } catch {
      isDark = false
    }
    return isDark ? themes.dracula : themes.github
  }
  switch (key) {
    case "github":
      return themes.github
    case "nightOwl":
      return themes.nightOwl
    case "nightOwlLight":
      return themes.nightOwlLight
    case "vsDark":
      return themes.vsDark
    case "dracula":
    default:
      return themes.dracula
  }
}
