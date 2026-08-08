/**
 * ⌘K command palette — headless behavior (Phase C).
 *
 * Owns everything about the palette that is not markup: fuzzy filtering,
 * grouped results with highlight ranges, keyboard selection, the global
 * shortcut listener, body-scroll locking and focus restoration.
 *
 * The palette state itself (`isOpen`) is passed in as a writable ref so the
 * owner (GlobalNav) stays the single source of truth — it needs the same flag
 * to raise the curtain and to drive `aria-expanded` on the bar's search button.
 *
 * Command entries are supplied by the caller and must already be filtered by
 * `featureFlag` / `hideInSimpleMode` (see `navItems.buildCommandEntries`).
 * This module never derives its own nav list.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch, type ComputedRef, type Ref } from 'vue'
import {
  fuzzyMatch,
  splitHighlight,
  type FuzzyRange,
  type HighlightSegment,
} from '@/components/command/fuzzy'
import type { CommandEntry } from '@/components/layout/navItems'

/* ------------------------------------------------------------------ scroll lock */

/**
 * Reference-counted body scroll lock.
 *
 * Counted rather than a plain boolean because two overlays in the same tree can
 * both want the lock (the mobile hamburger menu and this palette). With naive
 * `overflow = ''` teardown, whichever closes last wins and can unlock the page
 * while the other overlay is still open — the watchers fire in component
 * creation order, not in "who is still open" order.
 */
let scrollLockCount = 0
let savedBodyOverflow = ''

export function lockBodyScroll(): void {
  if (scrollLockCount === 0) {
    savedBodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  }
  scrollLockCount += 1
}

export function unlockBodyScroll(): void {
  if (scrollLockCount === 0) return
  scrollLockCount -= 1
  if (scrollLockCount === 0) document.body.style.overflow = savedBodyOverflow
}

/** Test-only: drop all locks (guards against cross-test leakage). */
export function resetBodyScrollLock(): void {
  scrollLockCount = 0
  savedBodyOverflow = ''
  document.body.style.overflow = ''
}

/* -------------------------------------------------------------------- shortcut */

/** macOS/iOS use ⌘K; everything else uses Ctrl+K. */
function isApplePlatform(): boolean {
  const nav = window.navigator as Navigator & { userAgentData?: { platform?: string } }
  const platform = nav.userAgentData?.platform || nav.platform || ''
  return /mac|iphone|ipad|ipod/i.test(platform)
}

/** Display label for the shortcut hint, e.g. `⌘K` or `Ctrl K`. */
export function commandShortcutLabel(): string {
  return isApplePlatform() ? '⌘K' : 'Ctrl K'
}

/**
 * Both Meta+K and Ctrl+K are accepted on every platform: external keyboards on
 * macOS and remote sessions routinely deliver the "wrong" one, and no other
 * binding in the app claims either combination.
 */
export function isCommandPaletteShortcut(event: KeyboardEvent): boolean {
  if (!event.metaKey && !event.ctrlKey) return false
  if (event.altKey) return false
  return event.key === 'k' || event.key === 'K'
}

/* --------------------------------------------------------------------- results */

export interface CommandResultItem {
  entry: CommandEntry
  /** Position in the flattened render order — drives ↑/↓ and aria-activedescendant. */
  index: number
  labelSegments: HighlightSegment[]
  pathSegments: HighlightSegment[]
}

export interface CommandResultGroup {
  key: string
  labelKey: string
  items: CommandResultItem[]
}

export interface UseCommandPaletteOptions {
  /** Already-filtered entries (feature flags + simple mode applied upstream). */
  entries: Ref<CommandEntry[]> | ComputedRef<CommandEntry[]>
  /** Writable open state, owned by the caller. */
  isOpen: Ref<boolean>
  /** Invoked with the chosen entry after the palette closes. */
  onSelect: (entry: CommandEntry) => void
  /** Max rows rendered (defaults to 50 — the whole nav fits well under this). */
  limit?: number
}

/** A label hit outranks a path-only hit, so "users" prefers 用户管理 over /admin/usage. */
const LABEL_MATCH_BONUS = 40
const DEFAULT_LIMIT = 50

export function useCommandPalette(options: UseCommandPaletteOptions) {
  const { entries, isOpen, onSelect } = options
  const limit = options.limit ?? DEFAULT_LIMIT

  const query = ref('')
  const activeIndex = ref(0)
  const shortcutLabel = ref(commandShortcutLabel())
  /** Element to hand focus back to on close (the bar's search button, usually). */
  let previouslyFocused: HTMLElement | null = null
  let holdsScrollLock = false

  /**
   * Filter + rank. An empty query matches everything with equal score, so the
   * palette opens showing the full command list in nav order.
   */
  const groups = computed<CommandResultGroup[]>(() => {
    const raw = entries.value
    const q = query.value

    const hits: {
      entry: CommandEntry
      score: number
      labelRanges: FuzzyRange[]
      pathRanges: FuzzyRange[]
    }[] = []

    for (const entry of raw) {
      const labelHit = fuzzyMatch(entry.label, q)
      const pathHit = fuzzyMatch(entry.path, q)
      if (!labelHit && !pathHit) continue
      hits.push({
        entry,
        score: labelHit ? labelHit.score + LABEL_MATCH_BONUS : (pathHit?.score ?? 0),
        labelRanges: labelHit?.ranges ?? [],
        // Only highlight the path when that is what actually matched.
        pathRanges: labelHit ? [] : (pathHit?.ranges ?? []),
      })
    }

    // Array#sort is stable, so equal scores keep nav order.
    hits.sort((a, b) => b.score - a.score)
    const capped = hits.slice(0, limit)

    // Bucket into groups, preserving each group's first-appearance order, then
    // number the rows in that same render order so ↑/↓ tracks what is on screen.
    const buckets = new Map<string, { labelKey: string; hits: typeof capped }>()
    for (const hit of capped) {
      const existing = buckets.get(hit.entry.groupKey)
      if (existing) existing.hits.push(hit)
      else buckets.set(hit.entry.groupKey, { labelKey: hit.entry.groupLabelKey, hits: [hit] })
    }

    const out: CommandResultGroup[] = []
    let index = 0
    for (const [key, bucket] of buckets) {
      out.push({
        key,
        labelKey: bucket.labelKey,
        items: bucket.hits.map((hit) => ({
          entry: hit.entry,
          index: index++,
          labelSegments: splitHighlight(hit.entry.label, hit.labelRanges),
          pathSegments: splitHighlight(hit.entry.path, hit.pathRanges),
        })),
      })
    }
    return out
  })

  const flatResults = computed<CommandResultItem[]>(() =>
    groups.value.flatMap((group) => group.items),
  )
  const resultCount = computed(() => flatResults.value.length)
  const activeItem = computed<CommandResultItem | null>(
    () => flatResults.value[activeIndex.value] ?? null,
  )

  /** Stable DOM id per row, for `aria-activedescendant`. */
  function optionId(index: number): string {
    return `gn-cmdk-option-${index}`
  }

  /* ------------------------------------------------------------- open / close */

  /*
   * These only flip the flag; every side effect (query reset, scroll lock,
   * focus capture/restore) lives in the `isOpen` watcher below.
   *
   * That split matters because the flag has more than one writer: the bar's
   * search button toggles it through `v-model:open` from GlobalNav, the ⌘K
   * listener toggles it here, and a route change closes it. Putting the side
   * effects in the setters would make focus restoration depend on which writer
   * happened to be used.
   */
  function open(): void {
    if (!isOpen.value) isOpen.value = true
  }

  function close(): void {
    if (isOpen.value) isOpen.value = false
  }

  function toggle(): void {
    isOpen.value = !isOpen.value
  }

  /* -------------------------------------------------------------- selection */

  function setActiveIndex(index: number): void {
    if (index < 0 || index >= resultCount.value) return
    activeIndex.value = index
  }

  /** Move the selection by `delta`, wrapping at both ends. */
  function moveSelection(delta: number): void {
    const total = resultCount.value
    if (total === 0) return
    activeIndex.value = (activeIndex.value + delta + total) % total
  }

  function selectEntry(entry: CommandEntry): void {
    close()
    onSelect(entry)
  }

  function selectActive(): void {
    const item = activeItem.value
    if (item) selectEntry(item.entry)
  }

  /** Keydown handler for the palette input (↑/↓/Enter/Esc/Home/End). */
  function handleInputKeydown(event: KeyboardEvent): void {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        moveSelection(1)
        break
      case 'ArrowUp':
        event.preventDefault()
        moveSelection(-1)
        break
      case 'Home':
        if (resultCount.value === 0) return
        event.preventDefault()
        activeIndex.value = 0
        break
      case 'End':
        if (resultCount.value === 0) return
        event.preventDefault()
        activeIndex.value = resultCount.value - 1
        break
      case 'Enter':
        event.preventDefault()
        selectActive()
        break
      case 'Escape':
        event.preventDefault()
        close()
        break
      default:
        break
    }
  }

  /* ---------------------------------------------------------- global listener */

  function handleGlobalKeydown(event: KeyboardEvent): void {
    if (isCommandPaletteShortcut(event)) {
      // Chrome/Firefox bind ⌘K/Ctrl+K to the address bar — take it back.
      event.preventDefault()
      toggle()
      return
    }
    if (event.key === 'Escape' && isOpen.value) close()
  }

  onMounted(() => {
    shortcutLabel.value = commandShortcutLabel()
    document.addEventListener('keydown', handleGlobalKeydown)
  })

  onBeforeUnmount(() => {
    document.removeEventListener('keydown', handleGlobalKeydown)
    if (holdsScrollLock) {
      unlockBodyScroll()
      holdsScrollLock = false
    }
  })

  // Reset the highlight whenever the query changes so ↑/↓ starts from the top
  // of the new result set instead of a stale row.
  watch(query, () => {
    activeIndex.value = 0
  })

  // Keep the highlight inside the result list when entries change underneath.
  watch(resultCount, (count) => {
    if (activeIndex.value >= count) activeIndex.value = count > 0 ? count - 1 : 0
  })

  /*
   * `immediate` so a palette that is mounted already-open still acquires the
   * scroll lock and captures focus. Without it the side effects only ran on a
   * *transition*, so an initially-open palette left the page scrollable — and
   * the unmount path would then have nothing to release.
   */
  watch(
    isOpen,
    (open_) => {
      if (open_) {
        // Captured before focus moves into the palette input, so closing can put
        // the caret back where the user left it (usually the bar search button).
        const active = document.activeElement
        previouslyFocused = active instanceof HTMLElement ? active : null
        query.value = ''
        activeIndex.value = 0
        if (!holdsScrollLock) {
          lockBodyScroll()
          holdsScrollLock = true
        }
        return
      }

      query.value = ''
      activeIndex.value = 0
      if (holdsScrollLock) {
        unlockBodyScroll()
        holdsScrollLock = false
      }
      const target = previouslyFocused
      previouslyFocused = null
      target?.focus()
    },
    { immediate: true },
  )

  return {
    query,
    activeIndex,
    groups,
    flatResults,
    resultCount,
    activeItem,
    shortcutLabel,
    optionId,
    open,
    close,
    toggle,
    setActiveIndex,
    moveSelection,
    selectEntry,
    selectActive,
    handleInputKeydown,
  }
}
