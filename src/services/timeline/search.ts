/**
 * Timeline Search Service
 *
 * Implements SillyTavern-style "swoop" fragment search:
 * - Query is split into space-delimited fragments
 * - All fragments must match (AND logic)
 * - Order-independent matching
 * - Real-time highlighting support
 */

import type { TimelineNode } from './graph-builder'

// ============================================================================
// Types
// ============================================================================

export type SearchMode = 'fragments' | 'substring' | 'regex'

export interface SearchOptions {
  mode?: SearchMode
  caseSensitive?: boolean
  wholeWord?: boolean
}

export interface SearchMatch {
  node: TimelineNode
  matchedFragments: string[]
  highlightRanges: HighlightRange[]
  score: number  // Higher = better match (more fragments, earlier position)
}

export interface HighlightRange {
  start: number
  end: number
  fragment: string
}

// ============================================================================
// Search Service Class
// ============================================================================

export class TimelineSearchService {
  /**
   * Search nodes using swoop-style fragment search
   * Returns nodes that match ALL query fragments
   */
  searchNodes(
    nodes: TimelineNode[],
    query: string,
    options: SearchOptions = {}
  ): SearchMatch[] {
    const { mode = 'fragments', caseSensitive = false } = options

    const trimmedQuery = query.trim()
    if (!trimmedQuery) {
      return []
    }

    const matches: SearchMatch[] = []

    switch (mode) {
      case 'fragments':
        return this.fragmentSearch(nodes, trimmedQuery, caseSensitive)
      case 'substring':
        return this.substringSearch(nodes, trimmedQuery, caseSensitive)
      case 'regex':
        return this.regexSearch(nodes, trimmedQuery, caseSensitive)
      default:
        return this.fragmentSearch(nodes, trimmedQuery, caseSensitive)
    }
  }

  /**
   * Parse query into unique fragments (swoop-style)
   * "hello world hello" -> ["hello", "world"]
   */
  parseQueryFragments(query: string): string[] {
    const fragments = query
      .trim()
      .split(/\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0)

    // Return unique fragments only
    return [...new Set(fragments)]
  }

  /**
   * Highlight matching fragments in text
   * Returns HTML string with <mark> tags around matches
   */
  highlightMatches(text: string, fragments: string[], caseSensitive = false): string {
    if (!fragments.length || !text) {
      return this.escapeHtml(text)
    }

    const ranges = this.findHighlightRanges(text, fragments, caseSensitive)

    // Merge overlapping ranges
    const mergedRanges = this.mergeOverlappingRanges(ranges)

    // Build highlighted string
    let result = ''
    let lastEnd = 0

    for (const range of mergedRanges) {
      // Add text before this range
      result += this.escapeHtml(text.slice(lastEnd, range.start))
      // Add highlighted text
      result += `<mark class="timeline-search-highlight">${this.escapeHtml(text.slice(range.start, range.end))}</mark>`
      lastEnd = range.end
    }

    // Add remaining text
    result += this.escapeHtml(text.slice(lastEnd))

    return result
  }

  /**
   * Get all highlight ranges in text for given fragments
   */
  findHighlightRanges(
    text: string,
    fragments: string[],
    caseSensitive = false
  ): HighlightRange[] {
    const ranges: HighlightRange[] = []
    const searchText = caseSensitive ? text : text.toLowerCase()

    for (const fragment of fragments) {
      const searchFragment = caseSensitive ? fragment : fragment.toLowerCase()
      let pos = 0

      while ((pos = searchText.indexOf(searchFragment, pos)) !== -1) {
        ranges.push({
          start: pos,
          end: pos + fragment.length,
          fragment
        })
        pos += 1  // Move forward to find overlapping matches
      }
    }

    // Sort by start position
    return ranges.sort((a, b) => a.start - b.start)
  }

  // ============================================================================
  // Private Search Methods
  // ============================================================================

  /**
   * Fragment search (swoop): All fragments must be present
   */
  private fragmentSearch(
    nodes: TimelineNode[],
    query: string,
    caseSensitive: boolean
  ): SearchMatch[] {
    const fragments = this.parseQueryFragments(query)
    if (fragments.length === 0) return []

    const matches: SearchMatch[] = []

    for (const node of nodes) {
      if (node.type === 'root') continue  // Skip root node

      const content = caseSensitive ? node.content : node.content.toLowerCase()
      const searchFragments = caseSensitive
        ? fragments
        : fragments.map((f) => f.toLowerCase())

      // Check if ALL fragments are present
      const matchedFragments = searchFragments.filter((f) => content.includes(f))

      if (matchedFragments.length === fragments.length) {
        // All fragments matched
        const highlightRanges = this.findHighlightRanges(
          node.content,
          fragments,
          caseSensitive
        )

        // Calculate score: more matches + earlier position = higher score
        const score = this.calculateMatchScore(
          matchedFragments,
          highlightRanges,
          content.length
        )

        matches.push({
          node,
          matchedFragments: fragments,  // Use original case
          highlightRanges,
          score
        })
      }
    }

    // Sort by score (descending)
    return matches.sort((a, b) => b.score - a.score)
  }

  /**
   * Simple substring search
   */
  private substringSearch(
    nodes: TimelineNode[],
    query: string,
    caseSensitive: boolean
  ): SearchMatch[] {
    const searchQuery = caseSensitive ? query : query.toLowerCase()
    const matches: SearchMatch[] = []

    for (const node of nodes) {
      if (node.type === 'root') continue

      const content = caseSensitive ? node.content : node.content.toLowerCase()

      if (content.includes(searchQuery)) {
        const highlightRanges = this.findHighlightRanges(
          node.content,
          [query],
          caseSensitive
        )

        matches.push({
          node,
          matchedFragments: [query],
          highlightRanges,
          score: highlightRanges.length
        })
      }
    }

    return matches.sort((a, b) => b.score - a.score)
  }

  /**
   * Regex search
   */
  private regexSearch(
    nodes: TimelineNode[],
    query: string,
    caseSensitive: boolean
  ): SearchMatch[] {
    let regex: RegExp
    try {
      regex = new RegExp(query, caseSensitive ? 'g' : 'gi')
    } catch {
      // Invalid regex, fall back to substring
      return this.substringSearch(nodes, query, caseSensitive)
    }

    const matches: SearchMatch[] = []

    for (const node of nodes) {
      if (node.type === 'root') continue

      const content = node.content
      const regexMatches = [...content.matchAll(regex)]

      if (regexMatches.length > 0) {
        const highlightRanges: HighlightRange[] = regexMatches.map((m) => ({
          start: m.index!,
          end: m.index! + m[0].length,
          fragment: m[0]
        }))

        matches.push({
          node,
          matchedFragments: regexMatches.map((m) => m[0]),
          highlightRanges,
          score: regexMatches.length
        })
      }
    }

    return matches.sort((a, b) => b.score - a.score)
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  /**
   * Calculate match score for ranking results
   */
  private calculateMatchScore(
    matchedFragments: string[],
    ranges: HighlightRange[],
    contentLength: number
  ): number {
    // Base score: number of fragments matched
    let score = matchedFragments.length * 100

    // Bonus for matches near the beginning
    if (ranges.length > 0) {
      const firstMatchPos = ranges[0].start
      const positionBonus = Math.max(0, 50 - (firstMatchPos / contentLength) * 50)
      score += positionBonus
    }

    // Bonus for more matches (density)
    score += ranges.length * 5

    return score
  }

  /**
   * Merge overlapping highlight ranges
   */
  private mergeOverlappingRanges(ranges: HighlightRange[]): HighlightRange[] {
    if (ranges.length === 0) return []

    const sorted = [...ranges].sort((a, b) => a.start - b.start)
    const merged: HighlightRange[] = [sorted[0]]

    for (let i = 1; i < sorted.length; i++) {
      const current = sorted[i]
      const last = merged[merged.length - 1]

      if (current.start <= last.end) {
        // Overlapping - merge
        last.end = Math.max(last.end, current.end)
        last.fragment = last.fragment + '|' + current.fragment
      } else {
        // No overlap - add new range
        merged.push(current)
      }
    }

    return merged
  }

  /**
   * Escape HTML special characters
   */
  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    }
    return text.replace(/[&<>"']/g, (m) => map[m])
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const timelineSearch = new TimelineSearchService()
