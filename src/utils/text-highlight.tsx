import React from "react"

/**
 * Highlights occurrences of query terms within text by wrapping matches in <mark> elements.
 *
 * @param text - The text to search within.
 * @param query - The search query; may contain multiple terms separated by whitespace.
 * @param options - Optional settings.
 * @param options.caseSensitive - If true, matches respect case (default: false).
 * @param options.highlightClassName - Class name applied to each <mark> (default: "bg-yellow-200 dark:bg-yellow-700 rounded px-0.5").
 * @returns A React node with matched segments wrapped in <mark>, or the original `text` when no matches are found.
 */
export function highlightText(
  text: string,
  query: string,
  options: {
    caseSensitive?: boolean
    highlightClassName?: string
  } = {}
): React.ReactNode {
  if (!query || !text) {
    return text
  }

  const {
    caseSensitive = false,
    highlightClassName = "bg-yellow-200 dark:bg-yellow-700 rounded px-0.5"
  } = options

  // Escape special regex characters in the query
  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

  // Split query on whitespace to highlight multiple terms
  const terms = escapedQuery.split(/\s+/).filter(Boolean)
  if (terms.length === 0) {
    return text
  }

  // Create a regex pattern that matches any of the terms
  const pattern = terms.join("|")
  const flags = caseSensitive ? "g" : "gi"
  const regex = new RegExp(`(${pattern})`, flags)

  const parts = text.split(regex)

  if (parts.length === 1) {
    // No matches found
    return text
  }

  return (
    <>
      {parts.map((part, index) => {
        // Check if this part matches any of the search terms
        const isMatch = terms.some((term) =>
          caseSensitive
            ? part === term
            : part.toLowerCase() === term.toLowerCase()
        )

        if (isMatch) {
          return (
            <mark key={index} className={highlightClassName}>
              {part}
            </mark>
          )
        }
        return part
      })}
    </>
  )
}

/**
 * Determines whether any whitespace-separated term from `query` appears in `text`.
 *
 * The `query` is split on whitespace into terms; the function returns `true` if at least one term is found.
 *
 * @param text - The text to search within
 * @param query - Whitespace-separated terms to search for
 * @param caseSensitive - If `true`, matching is case-sensitive; otherwise matching is case-insensitive
 * @returns `true` if any term from `query` is found in `text`, `false` otherwise
 */
export function textContainsQuery(
  text: string,
  query: string,
  caseSensitive = false
): boolean {
  if (!query || !text) {
    return false
  }

  const terms = query.split(/\s+/).filter(Boolean)
  if (terms.length === 0) {
    return false
  }

  const searchText = caseSensitive ? text : text.toLowerCase()

  return terms.some((term) => {
    const searchTerm = caseSensitive ? term : term.toLowerCase()
    return searchText.includes(searchTerm)
  })
}

/**
 * Count occurrences of one or more query terms in the given text.
 *
 * Splits `query` on whitespace into terms, escapes regex metacharacters, and counts all non-overlapping occurrences of any term. Returns 0 when `text` or `query` is falsy or when no terms remain after splitting. Matching respects the `caseSensitive` flag.
 *
 * @param text - The text to search within
 * @param query - Whitespace-separated search terms
 * @param caseSensitive - Whether matching is case-sensitive (default: `false`)
 * @returns The number of matches found
 */
export function countMatches(
  text: string,
  query: string,
  caseSensitive = false
): number {
  if (!query || !text) {
    return 0
  }

  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const terms = escapedQuery.split(/\s+/).filter(Boolean)
  if (terms.length === 0) {
    return 0
  }

  const pattern = terms.join("|")
  const flags = caseSensitive ? "g" : "gi"
  const regex = new RegExp(pattern, flags)

  const matches = text.match(regex)
  return matches ? matches.length : 0
}