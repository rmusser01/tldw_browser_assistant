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

// Regex search safety limits
const MAX_REGEX_PATTERN_LENGTH = 100
const REGEX_MATCH_TIME_LIMIT_MS = 500

// ============================================================================
// Types
// ============================================================================

export type SearchMode = 'fragments' | 'substring' | 'regex'

export interface SearchOptions {
  mode?: SearchMode
  caseSensitive?: boolean
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
   * Returns HTML string with <mark> tags around matches; input text is escaped.
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
    // Guard: limit pattern length to reduce ReDoS risk
    if (query.length > MAX_REGEX_PATTERN_LENGTH) {
      return this.substringSearch(nodes, query, caseSensitive)
    }

    // Guard: reject patterns that look prone to catastrophic backtracking
    if (!this.isSafeRegexPattern(query)) {
      return this.substringSearch(nodes, query, caseSensitive)
    }

    let regex: RegExp
    try {
      regex = new RegExp(query, caseSensitive ? 'g' : 'gi')
    } catch {
      // Invalid regex, fall back to substring
      return this.substringSearch(nodes, query, caseSensitive)
    }

    const matches: SearchMatch[] = []
    const startTime =
      typeof performance !== 'undefined' ? performance.now() : Date.now()

    for (const node of nodes) {
      if (node.type === 'root') continue

      const content = node.content
      const highlightRanges: HighlightRange[] = []
      const matchedFragments: string[] = []

      regex.lastIndex = 0
      // Use exec loop so we can enforce a time limit and handle zero-length matches
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const now =
          typeof performance !== 'undefined' ? performance.now() : Date.now()
        if (now - startTime > REGEX_MATCH_TIME_LIMIT_MS) {
          // Matching is taking too long – fall back to substring search
          return this.substringSearch(nodes, query, caseSensitive)
        }

        const match = regex.exec(content)
        if (!match) break

        const matchText = match[0]
        const matchIndex = match.index ?? 0

        if (matchText.length === 0) {
          // Avoid infinite loops on zero-length matches
          regex.lastIndex = matchIndex + 1
          continue
        }

        highlightRanges.push({
          start: matchIndex,
          end: matchIndex + matchText.length,
          fragment: matchText
        })
        matchedFragments.push(matchText)
      }

      if (highlightRanges.length > 0) {
        matches.push({
          node,
          matchedFragments,
          highlightRanges,
          score: highlightRanges.length
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
    if (ranges.length > 0 && contentLength > 0) {
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
   * Lightweight regex safety check to avoid obvious catastrophic backtracking patterns.
   *
   * Heuristics:
   * - Disallow groups that contain a quantifier and are themselves quantified, e.g. (a+)+
   * - Disallow patterns with an excessive number of groups.
   */
  private isSafeRegexPattern(pattern: string): boolean {
    const isQuantifier = (ch: string | undefined): boolean =>
      ch === '*' || ch === '+' || ch === '?' || ch === '{'

    type GroupState = { hasInnerQuantifier: boolean }
    const groupStack: GroupState[] = []

    let escaped = false

    for (let i = 0; i < pattern.length; i++) {
      const ch = pattern[i]

      if (escaped) {
        escaped = false
        continue
      }

      if (ch === '\\') {
        escaped = true
        continue
      }

      if (ch === '(') {
        groupStack.push({ hasInnerQuantifier: false })
        continue
      }

      if (ch === ')' && groupStack.length > 0) {
        const group = groupStack.pop()!
        const next = pattern[i + 1]

        // If the group contained a quantifier and is itself quantified, this is a common ReDoS pattern
        if (group.hasInnerQuantifier && isQuantifier(next)) {
          return false
        }
        continue
      }

      if (isQuantifier(ch) && groupStack.length > 0) {
        groupStack[groupStack.length - 1].hasInnerQuantifier = true
      }
    }

    // Basic structural limit: too many groups can be a red flag
    const openParens = pattern.split('(').length - 1
    const closeParens = pattern.split(')').length - 1
    if (openParens > 10 || closeParens > 10) {
      return false
    }

    return true
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
