/**
 * Fuzzy subsequence matcher for the ⌘K command palette.
 *
 * Why hand-rolled instead of a dependency: the nav model is tiny (~30 entries),
 * the labels are mixed zh/en, and adding a package would need a pinned version
 * plus a lockfile write — which this branch explicitly cannot do.
 *
 * Contract:
 *  - Case-insensitive subsequence match. Every character of the query must
 *    appear in the text, in order, but not necessarily adjacently.
 *  - Works for CJK without word segmentation: Chinese labels match by
 *    character subsequence ("渠道监控" matches "监控" and "渠监").
 *  - Whitespace in the query is ignored, so "channel mon" matches
 *    "Channel Monitor" and "渠道 监控" matches "渠道监控".
 *  - Returns the matched index ranges so the UI can highlight the hit
 *    characters. `null` means "no match" (never an empty result).
 *
 * Scoring is heuristic and only has to produce a sensible *ordering*:
 * consecutive runs, matches at the start of the string, and matches right
 * after a separator all rank higher; large gaps are penalised; shorter labels
 * win ties so "用户管理" beats "用户订阅管理" for the query "用户".
 */

/** Half-open `[start, end)` index range into the matched text. */
export type FuzzyRange = [start: number, end: number]

export interface FuzzyResult {
  score: number
  ranges: FuzzyRange[]
}

export interface HighlightSegment {
  text: string
  /** True when this segment was matched by the query (render it highlighted). */
  hit: boolean
}

/**
 * Characters that start a new "word" for scoring purposes. Includes the CJK
 * punctuation that shows up in localized labels, plus `/` so path matches
 * score segment starts (`/admin/users` scores the `u` of `users`).
 */
const WORD_SEPARATORS = new Set([
  ' ', '/', '-', '_', '.', ':', '·', '(', ')', '[', ']',
  '（', '）', '、', '，', '：', '·',
])

const CONSECUTIVE_BONUS = 8
const MATCH_BASE = 1
const START_BONUS = 12
const WORD_START_BONUS = 6
const MAX_GAP_PENALTY = 4
const SHORT_TEXT_WEIGHT = 0.25
const SHORT_TEXT_CEILING = 16

/**
 * Match `query` against `text`.
 *
 * An empty query matches everything with score 0 and no ranges, which lets the
 * caller render the full command list unfiltered without a special case.
 */
export function fuzzyMatch(text: string, query: string): FuzzyResult | null {
  const needle = query.replace(/\s+/g, '').toLowerCase()
  if (needle.length === 0) return { score: 0, ranges: [] }
  if (text.length === 0) return null

  const haystack = text.toLowerCase()
  const ranges: FuzzyRange[] = []
  let cursor = 0
  let previousMatch = -2
  let score = 0

  for (const char of needle) {
    const found = haystack.indexOf(char, cursor)
    if (found === -1) return null

    score += found === previousMatch + 1 ? CONSECUTIVE_BONUS : MATCH_BASE
    if (found === 0) score += START_BONUS
    else if (WORD_SEPARATORS.has(text[found - 1])) score += WORD_START_BONUS

    const gap = found - cursor
    if (gap > 0) score -= Math.min(gap, MAX_GAP_PENALTY)

    // Merge adjacent hits so highlighting renders one <span> per run.
    const last = ranges[ranges.length - 1]
    const end = found + char.length
    if (last && last[1] === found) last[1] = end
    else ranges.push([found, end])

    previousMatch = found
    cursor = end
  }

  // Tie-break toward shorter labels (a query is more "of" a short label).
  score += Math.max(0, SHORT_TEXT_CEILING - text.length) * SHORT_TEXT_WEIGHT
  return { score, ranges }
}

/**
 * Split `text` into alternating plain / matched segments for rendering.
 * Returns a single unmatched segment when there are no ranges.
 */
export function splitHighlight(text: string, ranges: FuzzyRange[]): HighlightSegment[] {
  if (ranges.length === 0) return text.length > 0 ? [{ text, hit: false }] : []

  const segments: HighlightSegment[] = []
  let cursor = 0
  for (const [start, end] of ranges) {
    if (start > cursor) segments.push({ text: text.slice(cursor, start), hit: false })
    segments.push({ text: text.slice(start, end), hit: true })
    cursor = end
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor), hit: false })
  return segments
}
