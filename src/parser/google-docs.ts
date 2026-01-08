import { isChromiumTarget } from "@/config/platform"

export const isGoogleDocs = (url: string) => {
  const GOOGLE_DOCS_REGEX = /docs\.google\.com\/document/g
  return GOOGLE_DOCS_REGEX.test(url)
}

const getGoogleDocs = () => {
  try {
    const isElementLike = (
      value: unknown
    ): value is { nodeType: number; nodeName: string } => {
      if (!value || typeof value !== "object") return false
      const candidate = value as { nodeType?: number; nodeName?: string }
      return candidate.nodeType === 1 && typeof candidate.nodeName === "string"
    }

    function traverse(
      obj: Record<string, unknown>,
      predicate: (name: string, value: unknown) => boolean,
      maxDepth: number,
      propNames = Object.getOwnPropertyNames(obj)
    ) {
      const visited = new Set()
      const results = []
      let iterations = 0

      const traverseObj = (
        name: string,
        value: unknown,
        path: Array<string | number>,
        depth = 0
      ) => {
        iterations++
        if (name === "prototype" || value instanceof Window || depth > maxDepth)
          return

        const currentPath = [...path, name]

        try {
          if (predicate(name, value)) {
            results.push({ path: currentPath, value })
            return
          }
        } catch (error) {}

        if (value != null && !visited.has(value)) {
          visited.add(value)
          if (Array.isArray(value)) {
            value.forEach((val, index) => {
              try {
                traverseObj(index.toString(), val, currentPath, depth + 1)
              } catch (error) {}
            })
          } else if (typeof value === "object") {
            const propNamesForValue =
              isElementLike(value)
                ? Object.getOwnPropertyNames(obj)
                : Object.getOwnPropertyNames(value)

            propNamesForValue.forEach((prop) => {
              try {
                traverseObj(
                  prop,
                  (value as Record<string, unknown>)[prop],
                  currentPath,
                  depth + 1
                )
              } catch (error) {}
            })
          }
        }
      }

      propNames.forEach((prop) => {
        try {
          traverseObj(prop, obj[prop], [])
        } catch (error) {}
      })

      return { results, iterations }
    }

    const root = (window as { KX_kixApp?: unknown }).KX_kixApp
    if (!root || typeof root !== "object") {
      return { content: null }
    }

    const result = traverse(
      root as Record<string, unknown>,
      (_name, value) => {
        if (!value) return false
        try {
          return String(value).charAt(0) === "\x03"
        } catch {
          return false
        }
      },
      5
    )
    if (result.results?.[0]?.value) {
      return {
        content: result.results[0].value
      }
    }

    return {
      content: null
    }
  } catch (error) {
    return {
      content: null
    }
  }
}

export const parseGoogleDocs = async () => {
  const result = new Promise((resolve) => {
    if (isChromiumTarget) {
      chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
        const tab = tabs[0]

        const data = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          world: "MAIN",
          func: getGoogleDocs
        })

        if (data.length > 0) {
          resolve(data[0].result)
        }
      })
    } else {
      browser.tabs
        .query({ active: true, currentWindow: true })
        .then(async (tabs) => {
          const tab = tabs[0]

          const data = await browser.scripting.executeScript({
            target: { tabId: tab.id },
            func: getGoogleDocs
          })

          if (data.length > 0) {
            resolve(data[0].result)
          }
        })
    }
  }) as Promise<{
    content?: string
  }>

  const { content } = await result

  return content
}
