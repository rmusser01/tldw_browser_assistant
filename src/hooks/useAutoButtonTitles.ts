import { useEffect } from "react"

const normalizeText = (value: string | null): string | null => {
  if (!value) return null
  const normalized = value.replace(/\s+/g, " ").trim()
  return normalized.length > 0 ? normalized : null
}

const getButtonTitle = (button: HTMLButtonElement): string | null => {
  const ariaLabel = normalizeText(button.getAttribute("aria-label"))
  if (ariaLabel) return ariaLabel
  return normalizeText(button.textContent)
}

const applyTitle = (button: HTMLButtonElement) => {
  const hasManualTitle =
    button.hasAttribute("title") &&
    button.getAttribute("data-auto-title") !== "true"
  if (hasManualTitle) return

  const title = getButtonTitle(button)
  if (!title) return

  button.setAttribute("title", title)
  button.setAttribute("data-auto-title", "true")
}

const applyTitlesInTree = (root: ParentNode) => {
  root.querySelectorAll("button").forEach((button) => {
    applyTitle(button as HTMLButtonElement)
  })
}

/**
 * Auto-populates button `title` attributes from aria-label or text content
 * for accessibility. Intended to be called once at the app root to avoid
 * multiple MutationObservers on the same document.
 */
export const useAutoButtonTitles = () => {
  useEffect(() => {
    if (typeof document === "undefined") return

    applyTitlesInTree(document)

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "attributes") {
          if (mutation.target instanceof HTMLButtonElement) {
            applyTitle(mutation.target)
          }
          continue
        }
        if (mutation.type === "characterData") {
          const parent = mutation.target.parentElement
          if (!parent) continue
          const button = parent.closest("button")
          if (button) {
            applyTitle(button)
          }
          continue
        }
        mutation.addedNodes.forEach((node) => {
          if (!(node instanceof Element)) return
          if (node instanceof HTMLButtonElement) {
            applyTitle(node)
            return
          }
          applyTitlesInTree(node)
        })
      }
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["aria-label"],
      characterData: true
    })

    return () => observer.disconnect()
  }, [])
}
