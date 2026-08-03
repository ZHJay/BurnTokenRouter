/**
 * Static CSS invariants — a regression net for the bug *classes* that all
 * shipped undetected, because nothing in this project could see them.
 *
 * INVARIANTS A–F. No count is pinned in this comment on purpose: the net has
 * grown twice already, and a stale "four" here is the same failure mode the
 * `.toast` note in `style.css` argues against.
 *
 * Read `src/style.css`'s header comment first: it documents the three-tier
 * material hierarchy and the accessibility-branch reasoning that these
 * invariants encode. The short version is that each preference branch
 * (`prefers-contrast`, `prefers-reduced-transparency`, `prefers-reduced-motion`)
 * is an independent signal, and each one has to keep working in BOTH themes.
 *
 * Why this file exists at all:
 *   `frontend/scripts/` (the Playwright / axe harnesses) is gitignored, so the
 *   runtime a11y checks never run in CI. This spec is the only verification
 *   vehicle here that is simultaneously committed, dependency-free (postcss is
 *   already a devDependency) and CI-runnable. It is pure node: no browser, no
 *   dev server.
 *
 * Why postcss and not jsdom's CSSOM:
 *   jsdom can enumerate `CSSMediaRule` / `mediaText` / `selectorText`, but it
 *   discards source positions, and this file's failure messages are required to
 *   name a `file:line`. postcss keeps `node.source.start.line` and parses
 *   `@tailwind` / `@layer` / `@apply` verbatim instead of dropping them. The
 *   assertions below are structural, so a real cascade is not needed.
 *
 * Every invariant here is a STRUCTURAL PROXY. They prove a case was
 * considered, not that its value is right. Value-level checks (real contrast
 * ratios, real animation timings) need a browser and live in
 * `scripts/a11y-runtime-check.mjs`.
 *
 * D, E and F all read the same `prefers-reduced-motion` block from different
 * sides, and the split matters when one of them fails: D asks whether the
 * transform kill is too BROAD (it must not reach `.switch`), E asks whether what
 * it kills is load-bearing AT A CALL SITE, and F asks whether the kill is too
 * NARROW (the six press-scale classes must still be killed). Each failure names
 * one fix, in one place; they are written so they can never both fire pointing
 * in opposite directions about the same class.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import postcss, {
  type AtRule,
  type Container,
  type Declaration,
  type Document,
  type Rule
} from 'postcss'
import { describe, expect, it } from 'vitest'

/* ------------------------------------------------------------------------- */
/* Paths and source loading                                                   */
/* ------------------------------------------------------------------------- */

/** `src/design/__tests__` -> `frontend`. */
const FRONTEND_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const SRC_ROOT = join(FRONTEND_ROOT, 'src')
const GLOBAL_CSS_PATH = join(SRC_ROOT, 'style.css')

/** Repo-relative path, so failure messages are clickable from `frontend/`. */
function rel(absolutePath: string): string {
  return relative(FRONTEND_ROOT, absolutePath)
}

interface SourceFile {
  /** Repo-relative path, e.g. `src/components/layout/AppHeader.vue`. */
  path: string
  text: string
}

function collectSourceFiles(dir: string, out: SourceFile[] = []): SourceFile[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      // Test fixtures must not make a class look "live" in the app.
      if (entry.name === '__tests__') continue
      collectSourceFiles(full, out)
      continue
    }
    if (!/\.(vue|ts|js|tsx|jsx)$/.test(entry.name)) continue
    if (/\.(spec|test)\.[tj]sx?$/.test(entry.name)) continue
    out.push({ path: rel(full), text: readFileSync(full, 'utf8') })
  }
  return out
}

let sourceFileCache: SourceFile[] | null = null
function sourceFiles(): SourceFile[] {
  sourceFileCache ??= collectSourceFiles(SRC_ROOT)
  return sourceFileCache
}

function globalCss(): string {
  return readFileSync(GLOBAL_CSS_PATH, 'utf8')
}

function lineOf(text: string, index: number): number {
  let line = 1
  for (let i = 0; i < index; i += 1) {
    if (text.charCodeAt(i) === 10) line += 1
  }
  return line
}

/* ------------------------------------------------------------------------- */
/* Shared CSS helpers                                                         */
/* ------------------------------------------------------------------------- */

/**
 * Preference queries only. Deliberately NOT all `@media`: viewport
 * breakpoints legitimately declare light-only values, because the base `.dark`
 * rule (which appears later in the file) still overrides them. Inside a
 * preference query that source order is inverted — see INVARIANT A.
 */
const PREFERENCE_FEATURES = [
  'prefers-contrast',
  'prefers-reduced-transparency',
  'prefers-reduced-motion',
  'forced-colors'
] as const

function isPreferenceQuery(params: string): boolean {
  return PREFERENCE_FEATURES.some((feature) => params.includes(feature))
}

/** True when `rule` sits (at any depth) inside a preference `@media` block. */
function isInsidePreferenceQuery(rule: Rule): boolean {
  let parent: Container | Document | undefined = rule.parent
  while (parent) {
    if (parent.type === 'atrule') {
      const atRule = parent as AtRule
      if (atRule.name === 'media' && isPreferenceQuery(atRule.params)) return true
    }
    parent = parent.parent
  }
  return false
}

function selectorList(rule: Rule): string[] {
  return rule.selectors.map((selector) => selector.trim()).filter(Boolean)
}

function customPropertyDeclarations(rule: Rule): Declaration[] {
  const declarations: Declaration[] = []
  rule.each((node) => {
    if (node.type === 'decl' && node.prop.startsWith('--')) declarations.push(node)
  })
  return declarations
}

/** Extract `<style>` block contents from an SFC. */
function styleBlocks(sfcText: string): string[] {
  const blocks: string[] = []
  const re = /<style[^>]*>([\s\S]*?)<\/style>/g
  let match: RegExpExecArray | null
  while ((match = re.exec(sfcText))) blocks.push(match[1])
  return blocks
}

/* ========================================================================= */
/* INVARIANT A — preference-branch theme parity                               */
/* ========================================================================= */

/**
 * Every custom property declared by an in-query `:root` rule must also be
 * declared by the sibling in-query dark rule.
 *
 * The bug: inside `@media (prefers-contrast: more)` the in-query `:root`
 * declared `--label-secondary`, `--label-tertiary`, `--c-gray-400` and
 * `--c-gray-500`, but the sibling in-query `.dark` declared only
 * `--label-tertiary`. Both selectors are specificity (0,1,0) and both match
 * `<html>`; the in-query `:root` comes LATER in source order, so its
 * light-theme dark ink won on a dark surface. The table header measured
 * 6.1:1 -> 1.45:1. Twelve CRITICAL findings, one root cause.
 *
 * The asymmetry that let it slip through: in the BASE (non-query) blocks,
 * `.dark` legitimately overrides `:root` because `.dark` appears later in the
 * file. Inside a preference query the author writes `:root` after `.dark`, so
 * the winner flips. Same code shape, opposite outcome.
 *
 * LIMITATION (structural proxy): this proves dark was *considered*, not that
 * the dark value is correct. A `.dark` rule declaring a light value passes here
 * and is caught only by `scripts/a11y-runtime-check.mjs` in a real browser.
 */
const LIGHT_ROOT_SELECTORS = new Set([':root', 'html', 'html:root', ':root:where(html)'])

/**
 * Both spellings are accepted on purpose: `.dark` is what ships today, and
 * `html.dark` is the higher-specificity form the style.css fix moves to.
 */
const DARK_ROOT_SELECTORS = new Set(['.dark', 'html.dark', ':root.dark', '.dark:root'])

/**
 * Custom properties that are genuinely theme-neutral, i.e. one value is
 * correct in both themes, so the in-query dark rule does not need to restate
 * them.
 *
 * EMPTY BY DESIGN. Adding an entry must be a deliberate act with a reason,
 * because every entry is a hole in the net. Blur radii and geometry are the
 * plausible candidates; anything carrying a COLOR is not theme-neutral and
 * does not belong here. Note that `--mat-*` is absent even though it is
 * declared once for `:root, .dark` — a combined selector list already
 * satisfies this invariant, so it needs no allowlist entry.
 */
const THEME_NEUTRAL_PROPERTIES = new Set<string>([])

interface ParityViolation {
  query: string
  property: string
  location: string
  lightSelector: string
  darkLocation: string | null
}

function findThemeParityViolations(css: string, cssPath: string): ParityViolation[] {
  const root = postcss.parse(css, { from: cssPath })
  const violations: ParityViolation[] = []

  root.walkAtRules('media', (atRule) => {
    if (!isPreferenceQuery(atRule.params)) return

    const lightDeclarations = new Map<string, { line: number; selector: string }>()
    const darkProperties = new Set<string>()
    let darkRuleLine: number | null = null

    atRule.walkRules((rule) => {
      const selectors = selectorList(rule)
      const matchesLight = selectors.some((selector) => LIGHT_ROOT_SELECTORS.has(selector))
      const matchesDark = selectors.some((selector) => DARK_ROOT_SELECTORS.has(selector))
      if (!matchesLight && !matchesDark) return

      if (matchesDark) darkRuleLine ??= rule.source?.start?.line ?? null

      for (const declaration of customPropertyDeclarations(rule)) {
        if (matchesDark) darkProperties.add(declaration.prop)
        if (matchesLight && !matchesDark && !lightDeclarations.has(declaration.prop)) {
          lightDeclarations.set(declaration.prop, {
            line: declaration.source?.start?.line ?? rule.source?.start?.line ?? 0,
            selector: selectors.find((s) => LIGHT_ROOT_SELECTORS.has(s)) ?? ':root'
          })
        }
      }
    })

    for (const [property, where] of lightDeclarations) {
      if (darkProperties.has(property)) continue
      if (THEME_NEUTRAL_PROPERTIES.has(property)) continue
      violations.push({
        query: `@media ${atRule.params}`,
        property,
        location: `${cssPath}:${where.line}`,
        lightSelector: where.selector,
        darkLocation: darkRuleLine === null ? null : `${cssPath}:${darkRuleLine}`
      })
    }
  })

  return violations
}

function formatParityViolation(violation: ParityViolation): string {
  const target =
    violation.darkLocation === null
      ? `there is NO in-query dark rule in this block — add one (\`html.dark { ... }\`)`
      : `add it to the in-query dark rule at ${violation.darkLocation}`
  return [
    `${violation.location}  ${violation.query}`,
    `  ${violation.lightSelector} declares ${violation.property}, the sibling in-query dark rule does not.`,
    `  Inside a preference query the in-query :root comes AFTER the in-query dark rule,`,
    `  and both are specificity (0,1,0) on <html> — so this light value WINS in dark mode.`,
    `  Fix: ${target}, or add ${violation.property} to THEME_NEUTRAL_PROPERTIES in this spec`,
    `  if one value is genuinely correct in both themes (colors never are).`
  ].join('\n')
}

/* ========================================================================= */
/* INVARIANT B — no dead preference selectors                                  */
/* ========================================================================= */

/**
 * Every selector inside a `prefers-reduced-motion` block must match at least
 * one live element in the codebase.
 *
 * The bug: the block listed `.toast`, but `Toast.vue` never applied that class
 * — it builds its element from `glass-thin shadow-glass-edge` plus a `toast-*`
 * border variant. The rule matched nothing, so every toast slid a full element
 * width no matter what the user had asked for. Toasts appear unprompted, which
 * is the worst case for a vestibular-sensitive user.
 *
 * IMPLEMENTATION NOTE — this distinction is load-bearing. A naive text scan for
 * `toast` hits 22 files, every one a false positive (`toast.type`, `showToast`,
 * comments, i18n keys). So we tokenize ATTRIBUTE VALUES only: `class`,
 * `:class` / `v-bind:class`, and the Vue transition class attributes. Strict
 * tokenization finds `toast` as a class exactly zero times.
 *
 * We also expand `<transition name="X">` into the `X-enter-active` /
 * `X-leave-active` family, because those classes only ever exist at runtime;
 * without that expansion `.modal-enter-active` would read as a false dead.
 *
 * KNOWN HOLE: a dynamically assembled class (`:class="'animate-' + kind"`)
 * reads as a false dead, because no literal token exists. Verified today: no
 * such construction exists for any selector in this block — every `:class`
 * animation binding in `src/` is a ternary over literal strings. If one is
 * added later, this test will point at the selector and the allowlist below is
 * the escape hatch.
 *
 * SCOPE NOTE: this is scoped to `prefers-reduced-motion`, where an inert rule
 * means motion the user asked to remove still plays. The same scan across all
 * four preference queries currently surfaces only one extra thing — `.toast`
 * again, at style.css:1818 (`prefers-reduced-transparency`) and style.css:1952
 * (`prefers-contrast`), i.e. the same root cause, not new ones. Widening the
 * scope is a one-line change to the `atRule.params` filter below if that ever
 * becomes worth failing on.
 */

/**
 * Selectors that are knowingly dead and must stay in the stylesheet.
 *
 * All 8 are defensive rules for Tailwind animation utilities that no template
 * currently uses. They are cheap insurance: the moment someone writes
 * `animate-slide-up` in a template, the reduced-motion branch already covers
 * it. They are NOT bugs, so they are allowlisted rather than deleted — which
 * keeps the failure signal meaningful instead of noisy.
 *
 * `.toast` is deliberately NOT here: it is the real bug. As of this writing
 * `Toast.vue` owns its own motion via a scoped `.toast-item` rule and a scoped
 * `prefers-reduced-motion` block, which fixes the BEHAVIOUR — vestibular users
 * no longer get the full-width slide. What is left is an orphan: nothing in
 * `src/` applies `toast` as a class any more, so the base `.toast` rule
 * (style.css:1294) and its three preference-branch overrides are unreachable
 * code. The remaining fix is to delete those rules from style.css, not to
 * allowlist the selector here — allowlisting would preserve dead CSS that
 * still reads as if it governs toasts.
 */
const KNOWN_DEAD_MOTION_SELECTORS = new Set([
  '.animate-pulse-slow',
  '.animate-shimmer',
  '.animate-glow',
  '.animate-fade-in',
  '.animate-slide-up',
  '.animate-slide-down',
  '.animate-slide-in-right',
  '.animate-materialize'
])

/** Class tokens referenced by a selector. Returns [] when there are none. */
function classTokensInSelector(selector: string): string[] {
  const cleaned = selector
    .replace(/\[[^\]]*\]/g, ' ') // attribute selectors, e.g. [class*='active:scale']
    .replace(/::[\w-]+/g, ' ') // pseudo-elements
  const tokens: string[] = []
  const re = /\.((?:[\w-]|\\.)+)/g
  let match: RegExpExecArray | null
  while ((match = re.exec(cleaned))) tokens.push(match[1].replace(/\\/g, ''))
  return tokens
}

const STATIC_CLASS_ATTR = /(?:^|[\s"'>])class\s*=\s*(?:"([^"]*)"|'([^']*)')/g
const BOUND_CLASS_ATTR = /(?::|v-bind:)class\s*=\s*(?:"([^"]*)"|'([^']*)')/g
const TRANSITION_CLASS_ATTR =
  /:?(?:enter|leave|appear)(?:-(?:from|active|to))?-class\s*=\s*(?:"([^"]*)"|'([^']*)')/g
const TRANSITION_NAME_ATTR =
  /<[Tt]ransition(?:-?[Gg]roup)?\b[^>]*?\bname\s*=\s*(?:"([^"]+)"|'([^']+)')/g

function addWhitespaceSeparated(value: string, into: Set<string>): void {
  for (const token of value.split(/\s+/)) {
    const trimmed = token.trim()
    if (!trimmed) continue
    into.add(trimmed)
    // A Tailwind variant (`dark:bg-x`, `hover:scale-95`) also implies the base
    // utility name; recording it keeps variant-only usage from reading dead.
    const colon = trimmed.lastIndexOf(':')
    if (colon > -1 && colon < trimmed.length - 1) into.add(trimmed.slice(colon + 1))
  }
}

/**
 * Tokens found inside a bound class expression. Over-inclusive on purpose: we
 * take every string literal and every object key, so a non-class string can
 * leak in. That biases toward false-LIVE rather than false-DEAD, which is the
 * right direction for a test that gates CI.
 */
function tokensFromBoundExpression(expression: string, into: Set<string>): void {
  const literals = expression.match(/'[^']*'|`[^`]*`/g) ?? []
  for (const literal of literals) addWhitespaceSeparated(literal.slice(1, -1), into)

  // Object keys: { 'is-open': x, active: y }
  const keyRe = /[{,]\s*(?:'([^']+)'|"([^"]+)"|([A-Za-z_][\w-]*))\s*:/g
  let match: RegExpExecArray | null
  while ((match = keyRe.exec(expression))) {
    const key = match[1] ?? match[2] ?? match[3]
    if (key) addWhitespaceSeparated(key, into)
  }
}

function expandTransitionName(name: string, into: Set<string>): void {
  for (const phase of ['enter', 'leave', 'appear'] as const) {
    for (const stage of ['from', 'active', 'to'] as const) into.add(`${name}-${phase}-${stage}`)
    into.add(`${name}-${phase}`)
  }
}

function collectLiveClasses(files: SourceFile[]): Set<string> {
  const live = new Set<string>()
  for (const file of files) {
    let match: RegExpExecArray | null

    STATIC_CLASS_ATTR.lastIndex = 0
    while ((match = STATIC_CLASS_ATTR.exec(file.text))) {
      addWhitespaceSeparated(match[1] ?? match[2] ?? '', live)
    }

    BOUND_CLASS_ATTR.lastIndex = 0
    while ((match = BOUND_CLASS_ATTR.exec(file.text))) {
      tokensFromBoundExpression(match[1] ?? match[2] ?? '', live)
    }

    TRANSITION_CLASS_ATTR.lastIndex = 0
    while ((match = TRANSITION_CLASS_ATTR.exec(file.text))) {
      const value = match[1] ?? match[2] ?? ''
      addWhitespaceSeparated(value, live)
      tokensFromBoundExpression(value, live)
    }

    TRANSITION_NAME_ATTR.lastIndex = 0
    while ((match = TRANSITION_NAME_ATTR.exec(file.text))) {
      expandTransitionName(match[1] ?? match[2] ?? '', live)
    }
  }
  return live
}

interface DeadSelector {
  selector: string
  location: string
  missing: string[]
}

function findDeadMotionSelectors(
  css: string,
  cssPath: string,
  liveClasses: Set<string>
): DeadSelector[] {
  const root = postcss.parse(css, { from: cssPath })
  const dead: DeadSelector[] = []

  root.walkAtRules('media', (atRule) => {
    if (!atRule.params.includes('prefers-reduced-motion')) return

    atRule.walkRules((rule) => {
      const line = rule.source?.start?.line ?? 0
      for (const selector of selectorList(rule)) {
        const tokens = classTokensInSelector(selector)
        // No class token (`html`, `[class*='active:scale']:active`) => not
        // statically verifiable. Skipped rather than guessed at.
        if (tokens.length === 0) continue
        const missing = tokens.filter((token) => !liveClasses.has(token))
        if (missing.length === 0) continue
        dead.push({ selector, location: `${cssPath}:${line}`, missing })
      }
    })
  })

  return dead
}

function formatDeadSelector(entry: DeadSelector): string {
  return [
    `${entry.location}  ${entry.selector}`,
    `  never matches: no template applies ${entry.missing.map((c) => `\`${c}\``).join(', ')}`,
    `  as a class (checked class= / :class= values and <transition name> expansion).`,
    `  This rule is inert, so the reduced-motion preference is silently ignored here.`,
    `  Fix, in order of preference:`,
    `    1. If a component still needs this behaviour, apply the class there, or repoint`,
    `       the selector at the classes that component actually uses.`,
    `    2. If the class is no longer used anywhere, delete the rule — and check the`,
    `       matching base rule too, since an orphan here usually means an orphan there.`,
    `    3. If it is deliberate cover for a Tailwind utility nobody uses yet, add it to`,
    `       KNOWN_DEAD_MOTION_SELECTORS with a reason.`
  ].join('\n')
}

/* ========================================================================= */
/* INVARIANT C — no double-driven animation (narrow form)                     */
/* ========================================================================= */

/**
 * An element whose class list carries an intrinsic `animation` must not be the
 * transitioned child of a `<transition name="X">` whose CSS drives `transform`.
 *
 * The bug: `.dropdown` carries an intrinsic `animate-scale-in`
 * (style.css ~1035) and `AppHeader.vue:161` ALSO wraps it in
 * `<transition name="dropdown">`, whose `.dropdown-enter-from` sets
 * `transform: scale(0.95) translateY(-4px)`. Keyframe and transition then drive
 * `transform` concurrently with different scale values.
 *
 * Three other files use `<transition name="dropdown">` correctly: they put the
 * glass classes (`glass-thin glass-edge`) on the transitioned element instead of
 * `.dropdown`, so nothing is double-driven. This detector must NOT flag them.
 *
 * SCOPE — deliberately narrow. The general form ("no element has both an
 * animation and a transition on the same property") would need Tailwind's
 * generated utilities, Vue's runtime-injected transition classes, and
 * per-element class composition resolved across 287 SFCs. A half-built version
 * of that produces false confidence, which is worse than no check.
 *
 * HEURISTIC — the `<transition>` pairing is a BOUNDED FORWARD LOOK-AHEAD: from
 * the `<transition>` tag we take the first element tag that follows, skipping
 * comments, and treat it as the transitioned child. Vue requires a single
 * element child there, so this holds for the straightforward markup in this
 * repo. It does NOT resolve `<component :is>`, a child component's own root
 * element, or a slot-forwarded root. Those read as no-hit (false negatives),
 * not as false positives.
 *
 * `animate-none` on the element is treated as an explicit opt-out — that is the
 * established fix in this repo (`AccountGroupsCell.vue:39`).
 */
const ANIMATION_OPT_OUT = 'animate-none'

/** `.X-enter-from`, `.X-leave-active`, ... — a single compound, no combinator. */
const TRANSITION_STATE_SELECTOR = /^\.([\w-]+)-(enter|leave|appear)-(from|active|to)$/

/** Any Tailwind `animate-*` utility sets `animation`. `animate-none` clears it. */
function isIntrinsicAnimationUtility(token: string): boolean {
  return token.startsWith('animate-') && token !== ANIMATION_OPT_OUT
}

/**
 * Classes that carry an intrinsic animation: an `@apply animate-*`, or a real
 * `animation` declaration.
 *
 * Rules inside preference queries are EXCLUDED: those are accessibility
 * overrides that replace motion (`animation: rm-fade-in ...`), not baseline
 * animation. Counting them would wrongly mark `.glass-card` and friends as
 * intrinsically animated.
 */
function collectAnimatedClasses(css: string, cssPath: string): Set<string> {
  const animated = new Set<string>()
  const root = postcss.parse(css, { from: cssPath })

  root.walkRules((rule) => {
    if (isInsidePreferenceQuery(rule)) return

    let hasAnimation = false
    rule.each((node) => {
      if (node.type === 'atrule' && node.name === 'apply') {
        for (const token of node.params.split(/\s+/)) {
          if (isIntrinsicAnimationUtility(token)) hasAnimation = true
        }
        return
      }
      if (node.type !== 'decl') return
      if (node.prop !== 'animation' && node.prop !== 'animation-name') return
      if (/^\s*none\s*$/.test(node.value)) return
      hasAnimation = true
    })
    if (!hasAnimation) return

    for (const selector of selectorList(rule)) {
      // Only the last compound actually receives the animation.
      const lastCompound = selector.split(/[\s>+~]+/).filter(Boolean).pop() ?? selector
      for (const token of classTokensInSelector(lastCompound)) animated.add(token)
    }
  })

  return animated
}

/** Transition names whose own state classes drive `transform`. */
function collectTransformDrivingTransitionNames(css: string, cssPath: string): Set<string> {
  const names = new Set<string>()
  const root = postcss.parse(css, { from: cssPath })

  root.walkRules((rule) => {
    let drivesTransform = false
    rule.each((node) => {
      if (node.type !== 'decl') return
      if (node.prop === 'transform' && !/^\s*none\s*$/.test(node.value)) {
        drivesTransform = true
        return
      }
      if (node.prop === 'transition' || node.prop === 'transition-property') {
        if (/\b(transform|all)\b/.test(node.value)) drivesTransform = true
      }
    })
    if (!drivesTransform) return

    for (const selector of selectorList(rule)) {
      // Must target the transitioned element itself. A descendant selector
      // (`.modal-enter-from .modal-content`) drives a CHILD's transform, which
      // is a different element and not this bug.
      const match = TRANSITION_STATE_SELECTOR.exec(selector.trim())
      if (match) names.add(match[1])
    }
  })

  return names
}

interface AttributeRegion {
  /** Raw attribute text of the opening tag. */
  attributes: string
  /** Index in the file where the tag starts. */
  index: number
}

/** First element tag after `fromIndex`, skipping comments and whitespace. */
function firstElementAfter(text: string, fromIndex: number): AttributeRegion | null {
  let cursor = fromIndex
  const limit = Math.min(text.length, fromIndex + 4000)
  while (cursor < limit) {
    const next = text.indexOf('<', cursor)
    if (next === -1 || next >= limit) return null
    if (text.startsWith('<!--', next)) {
      const end = text.indexOf('-->', next)
      if (end === -1) return null
      cursor = end + 3
      continue
    }
    // A closing tag before any element means the transition had no element
    // child we can resolve.
    if (text.startsWith('</', next)) return null
    const tagEnd = text.indexOf('>', next)
    if (tagEnd === -1) return null
    return { attributes: text.slice(next, tagEnd), index: next }
  }
  return null
}

function classTokensOnElement(attributes: string): Set<string> {
  const tokens = new Set<string>()
  let match: RegExpExecArray | null

  STATIC_CLASS_ATTR.lastIndex = 0
  while ((match = STATIC_CLASS_ATTR.exec(attributes))) {
    addWhitespaceSeparated(match[1] ?? match[2] ?? '', tokens)
  }
  BOUND_CLASS_ATTR.lastIndex = 0
  while ((match = BOUND_CLASS_ATTR.exec(attributes))) {
    tokensFromBoundExpression(match[1] ?? match[2] ?? '', tokens)
  }
  return tokens
}

interface DoubleDrivenHit {
  location: string
  transitionName: string
  animatedClass: string
}

function findDoubleDrivenAnimations(
  files: SourceFile[],
  globalAnimatedClasses: Set<string>,
  globalTransformDrivingNames: Set<string>
): DoubleDrivenHit[] {
  const hits: DoubleDrivenHit[] = []

  for (const file of files) {
    if (!file.path.endsWith('.vue')) continue

    // Scoped styles are per-component, so resolve names/classes per file:
    // a `fade` transition that drives transform in one SFC says nothing about
    // a `fade` transition in another.
    const animatedClasses = new Set(globalAnimatedClasses)
    const transformDrivingNames = new Set(globalTransformDrivingNames)
    for (const block of styleBlocks(file.text)) {
      for (const token of collectAnimatedClasses(block, file.path)) animatedClasses.add(token)
      for (const name of collectTransformDrivingTransitionNames(block, file.path)) {
        transformDrivingNames.add(name)
      }
    }

    TRANSITION_NAME_ATTR.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = TRANSITION_NAME_ATTR.exec(file.text))) {
      const name = match[1] ?? match[2] ?? ''
      if (!transformDrivingNames.has(name)) continue

      const tagEnd = file.text.indexOf('>', match.index)
      if (tagEnd === -1) continue
      const child = firstElementAfter(file.text, tagEnd + 1)
      if (!child) continue

      const tokens = classTokensOnElement(child.attributes)
      if (tokens.has(ANIMATION_OPT_OUT)) continue

      for (const token of tokens) {
        if (!animatedClasses.has(token) && !isIntrinsicAnimationUtility(token)) continue
        hits.push({
          location: `${file.path}:${lineOf(file.text, child.index)}`,
          transitionName: name,
          animatedClass: token
        })
        break
      }
    }
  }

  return hits
}

function formatDoubleDrivenHit(hit: DoubleDrivenHit): string {
  return [
    `${hit.location}  <transition name="${hit.transitionName}"> wraps .${hit.animatedClass}`,
    `  .${hit.animatedClass} already has an intrinsic animation, and the`,
    `  .${hit.transitionName}-enter-*/.${hit.transitionName}-leave-* CSS also drives transform.`,
    `  Both run at once with different values, so the element's scale/translate is`,
    `  whichever one wins per frame.`,
    `  Fix: add \`animate-none\` to the transitioned element and let <transition> own the`,
    `  motion (see src/components/account/AccountGroupsCell.vue:39), or drop the`,
    `  <transition name> wrapper and keep the intrinsic animation.`
  ].join('\n')
}

/* ========================================================================= */
/* INVARIANT D — reduced motion may clamp a switch's timing, never its shape  */
/* ========================================================================= */

/**
 * Inside `prefers-reduced-motion`, `.switch` and `.switch-thumb` must each be
 * clamped to a short `transition-duration` and must NEVER receive a
 * `transform` declaration.
 *
 * The bug: `.switch` was folded into the six-selector kill list, which applies
 * `transition-property` + `transition-duration: 120ms` + `transform: none
 * !important` as one unit. Only the clamp was intended — a browser probe had
 * measured the track still running `background-color 240ms` while every peer
 * control was capped at 120ms. `transform: none !important` rode along.
 *
 * That third declaration is not inert, because the track's transform is not
 * press feedback. A call site owns it permanently:
 *   src/components/admin/ErrorPassthroughRulesModal.vue:171
 *     class="switch ... origin-left scale-[0.72]"
 * The rule is `!important` in `@layer components`; the utility is normal in
 * `@layer utilities`. An important declaration in an EARLIER layer beats a
 * normal one in a later layer regardless of specificity, so under the
 * preference that toggle snapped from ~31.7x17.3px back to its full 44x24px
 * inside a table cell laid out for the smaller control.
 *
 * `.switch-thumb` is guarded here for a stronger reason. Its ON-state
 * displacement comes from `.switch-active .switch-thumb { @apply
 * translate-x-5 }` plus `!translate-x-4` at the two size variants. Nulling
 * that transform leaves ON/OFF conveyed by a 2.22:1 colour change alone —
 * WCAG 1.4.1 and 1.4.11. Its exemption is deliberately a rule of its own; this
 * invariant fails if either class is ever merged into a transform-nulling rule.
 *
 * BOTH HALVES ARE ASSERTED, because the two regressions are opposites:
 *   - putting `transform` back on either rule restores the shape bug;
 *   - dropping either class out of the duration clamp restores the 240ms bug.
 * Checking one half leaves the other free to come back silently.
 *
 * Any `transform` declaration fails, not only `!important` ones. A normal
 * `transform: none` here would in fact lose to the utility on layer order and
 * so be harmless — but nothing legitimate needs it, and the stronger form is
 * the one that cannot be tiptoed around. `@apply transform-none` is read too,
 * since a declaration-only check would miss it.
 *
 * WHAT THIS DELIBERATELY DOES NOT CATCH (structural proxy, as with A/B/C):
 *  - No rendered size and no real duration is measured. `120ms` and `1ms` are
 *    not asserted as values; only that a clamp is present. Values belong to
 *    `scripts/a11y-runtime-check.mjs`, which reports the track at 120ms and the
 *    thumb delta at ~20px in a real browser.
 *  - It says nothing about the other six classes. `.btn`, `.card`,
 *    `.card-hover`, `.sidebar-link`, `.progress-bar` and `.tab` keep
 *    `transform: none !important` ON PURPOSE — that is what neutralises
 *    press-scale for vestibular-sensitive users — so they are out of scope by
 *    construction, not by oversight.
 *  - It is keyed on an explicit class list, not derived, because it asks a
 *    STYLESHEET question: does `style.css` still hold these two classes out of
 *    the transform kill? The mirror-image CALL-SITE question — may a class the
 *    kill list nulls ever carry a static transform utility in a template — is
 *    the general form, and it is asserted separately as INVARIANT E below.
 */

/**
 * Classes whose transform is load-bearing, so reduced motion must clamp their
 * timing without touching their geometry.
 *
 * Each entry costs a real justification, and the third test below enforces
 * that: an entry survives only while some permanent transform actually lands on
 * the class. Delete the `scale-[0.72]` call site and the entry must go too,
 * which puts `.switch` back in line for the kill list instead of leaving an
 * exemption nobody can explain.
 */
const TRANSFORM_LOAD_BEARING_CLASSES = new Map<string, string>([
  [
    'switch',
    'a table column scales the track down for layout ' +
      '(ErrorPassthroughRulesModal.vue, `origin-left scale-[0.72]`)'
  ],
  [
    'switch-thumb',
    'the ON-state displacement is the non-colour signal for ON/OFF ' +
      '(WCAG 1.4.1 / 1.4.11)'
  ]
])

/** Tailwind utilities that write a transform. `transform-none` is not one. */
const TRANSFORM_UTILITY = /^-?(?:scale|translate|rotate|skew)(?:-[xyz])?-/

/**
 * Transform utilities that resolve to the identity matrix. `transform: none`
 * renders identically, so these are not evidence that a transform is
 * load-bearing — counting them would manufacture justifications.
 */
const IDENTITY_TRANSFORM_UTILITIES = new Set([
  'scale-100',
  'scale-x-100',
  'scale-y-100',
  'rotate-0',
  '-rotate-0',
  'skew-x-0',
  'skew-y-0',
  'translate-x-0',
  'translate-y-0',
  '-translate-x-0',
  '-translate-y-0'
])

/**
 * Variants that do not gate on interaction state. A responsive or theme
 * variant still applies at rest, so `md:scale-95` is permanent; `active:` /
 * `hover:` / `focus:` are press-or-hover feedback, which is exactly what the
 * reduced-motion branch is entitled to remove.
 */
const UNCONDITIONAL_VARIANTS = new Set(['sm', 'md', 'lg', 'xl', '2xl', 'dark', 'ltr', 'rtl'])

/**
 * True for a utility that transforms the element at rest.
 *
 * Variant prefixes are peeled with an explicit character class so an arbitrary
 * variant (`[&>*]:`) reads as conditional rather than being mis-split, and so a
 * bracketed value containing a colon (`ring-[color:var(--x)]`) is never
 * mistaken for a variant prefix.
 */
function isPermanentTransformUtility(rawToken: string): boolean {
  let token = rawToken.startsWith('!') ? rawToken.slice(1) : rawToken
  for (;;) {
    const variant = /^([A-Za-z0-9_-]+):/.exec(token)
    if (!variant) break
    if (!UNCONDITIONAL_VARIANTS.has(variant[1])) return false
    token = token.slice(variant[0].length)
  }
  if (token.startsWith('!')) token = token.slice(1)
  if (IDENTITY_TRANSFORM_UTILITIES.has(token)) return false
  return TRANSFORM_UTILITY.test(token)
}

/**
 * Raw whitespace-separated tokens of a class attribute, VARIANTS INTACT.
 *
 * Deliberately not `addWhitespaceSeparated`: that helper also records the
 * post-colon base of every variant, which turns `active:scale-[0.96]` into
 * `scale-[0.96]` — correct for INVARIANT B's liveness question, fatal here,
 * where the whole point is telling a permanent transform from a pressed one.
 */
function rawClassTokens(attributeValue: string): string[] {
  const literals = attributeValue.match(/'[^']*'|`[^`]*`|"[^"]*"/g)
  const chunks = literals?.length
    ? literals.map((literal) => literal.slice(1, -1))
    : [attributeValue]
  const tokens: string[] = []
  for (const chunk of chunks) {
    for (const token of chunk.split(/\s+/)) {
      const trimmed = token.trim()
      if (trimmed) tokens.push(trimmed)
    }
  }
  return tokens
}

/** One `class=` / `:class=` attribute value, with the file offset it sits at. */
const ANY_CLASS_ATTR = /(?:^|[\s"'>])(?::|v-bind:)?class\s*=\s*(?:"([^"]*)"|'([^']*)')/g

interface TransformSource {
  location: string
  utility: string
}

/**
 * Everywhere a permanent transform lands on `className`.
 *
 * Two sources, because the two guarded classes are justified differently:
 *   - CALL SITE: the class and a permanent transform utility share one class
 *     attribute. `.switch` is justified only this way.
 *   - STYLESHEET: a rule outside every preference query gives the class a
 *     transform, via `@apply` or a real declaration. `.switch-thumb` is
 *     justified this way (`.switch-active .switch-thumb`), which is why the
 *     stylesheet half has to exist — deleting the two smaller toggles must not
 *     read as "the thumb no longer needs its displacement".
 */
function findPermanentTransformSources(
  className: string,
  files: SourceFile[],
  css: string,
  cssPath: string
): TransformSource[] {
  const sources: TransformSource[] = []

  for (const file of files) {
    ANY_CLASS_ATTR.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = ANY_CLASS_ATTR.exec(file.text))) {
      const tokens = rawClassTokens(match[1] ?? match[2] ?? '')
      if (!tokens.includes(className)) continue
      for (const token of tokens) {
        if (!isPermanentTransformUtility(token)) continue
        sources.push({
          location: `${file.path}:${lineOf(file.text, match.index)}`,
          utility: token
        })
      }
    }
  }

  postcss.parse(css, { from: cssPath }).walkRules((rule) => {
    if (isInsidePreferenceQuery(rule)) return
    // Only the last compound receives the transform, same as INVARIANT C.
    const owns = selectorList(rule).some((selector) => {
      const lastCompound = selector.split(/[\s>+~]+/).filter(Boolean).pop() ?? selector
      return classTokensInSelector(lastCompound).includes(className)
    })
    if (!owns) return

    rule.each((node) => {
      const line = node.source?.start?.line ?? rule.source?.start?.line ?? 0
      if (node.type === 'atrule' && node.name === 'apply') {
        for (const token of node.params.split(/\s+/)) {
          if (isPermanentTransformUtility(token)) {
            sources.push({ location: `${cssPath}:${line}`, utility: `@apply ${token}` })
          }
        }
        return
      }
      if (node.type !== 'decl' || node.prop !== 'transform') return
      if (/^\s*none\s*$/.test(node.value)) return
      sources.push({ location: `${cssPath}:${line}`, utility: `transform: ${node.value}` })
    })
  })

  return sources
}

interface MotionTreatment {
  /** Where a `transform` reaches this class inside reduced motion, if it does. */
  transformAt: string | null
  /** The offending text, for the failure message. */
  transformText: string | null
  /** Where its `transition-duration` clamp is, if there is one. */
  clampAt: string | null
}

/**
 * How the reduced-motion block treats `className`.
 *
 * A declaration counts for a class when the class appears in the LAST compound
 * of one of the rule's selectors, so `.btn:active` counts for `btn`, and
 * `.modal-enter-from .modal-content` counts for `modal-content` rather than for
 * `modal-enter-from`.
 */
function motionTreatmentOf(className: string, css: string, cssPath: string): MotionTreatment {
  const treatment: MotionTreatment = { transformAt: null, transformText: null, clampAt: null }

  postcss.parse(css, { from: cssPath }).walkAtRules('media', (atRule) => {
    if (!atRule.params.includes('prefers-reduced-motion')) return

    atRule.walkRules((rule) => {
      const targets = selectorList(rule).some((selector) => {
        const lastCompound = selector.split(/[\s>+~]+/).filter(Boolean).pop() ?? selector
        return classTokensInSelector(lastCompound).includes(className)
      })
      if (!targets) return

      rule.each((node) => {
        const at = `${cssPath}:${node.source?.start?.line ?? rule.source?.start?.line ?? 0}`

        if (node.type === 'atrule' && node.name === 'apply') {
          // `@apply transform-none` is the same kill spelled differently.
          for (const token of node.params.split(/\s+/)) {
            const bare = token.replace(/^!/, '').split(':').pop() ?? token
            if (bare === 'transform-none' || isPermanentTransformUtility(token)) {
              treatment.transformAt ??= at
              treatment.transformText ??= `@apply ${token}`
            }
          }
          return
        }
        if (node.type !== 'decl') return

        if (node.prop === 'transform') {
          treatment.transformAt ??= at
          treatment.transformText ??=
            `transform: ${node.value}${node.important ? ' !important' : ''}`
          return
        }
        // The shorthand carries a duration too, so accept either spelling.
        if (node.prop === 'transition-duration') {
          treatment.clampAt ??= at
          return
        }
        if (node.prop === 'transition' && /\d\s*m?s\b/.test(node.value)) {
          treatment.clampAt ??= at
        }
      })
    })
  })

  return treatment
}

/* ========================================================================= */
/* INVARIANT E — a killed transform must never be load-bearing at a call site */
/* ========================================================================= */

/**
 * The general form of INVARIANT D, asked from the other end.
 *
 * INVARIANT D asks a stylesheet question: does `style.css` keep `.switch` and
 * `.switch-thumb` out of the transform kill? This asks the call-site question:
 * given the kill list `style.css` actually declares, does any template put a
 * STATIC transform utility on one of those classes?
 *
 * The distinction the whole net turns on is what the transform is FOR:
 *   - press feedback (`active:scale-[0.96]`) — the preference exists to remove
 *     it, and `[class*="active:scale"]:active` pins the scale variables back to
 *     1 so bare utilities are neutralised too. Killing it is correct.
 *   - static positioning (`-translate-y-1/2` as the second half of `top-1/2`
 *     centring, `scale-[0.72]` as a layout fit) — present at rest, part of the
 *     layout, and nulling it MOVES or RESIZES the control.
 * `isPermanentTransformUtility` is what separates them, so this invariant is
 * only as good as that function; the test below pins its behaviour directly.
 *
 * This shipped as a real regression on `/login`, which is why the net exists.
 * The four password-visibility toggles were centred with `top-1/2
 * -translate-y-1/2`. `.btn` is in the kill list, the kill is `!important` in
 * `@layer components`, and the centring pull-back was a normal utility in
 * `@layer utilities` — an important declaration in an earlier layer wins
 * regardless of specificity, so each button lost half its own height of
 * pull-back and dropped: 18px at `height: 36px`, 22px where `(pointer:
 * coarse)` raises `min-height` to 44px. Measured in a browser, both themes,
 * both pointer types. Visible only while the preference is emulated.
 *
 * The fix belongs at the call site, not in the stylesheet: unlike `.switch`,
 * `.btn` genuinely wants its press-scale killed. All four now centre with
 * `absolute inset-y-0 right-2 my-auto`, which auto margins resolve from the
 * same `(containing block − own height) / 2` and no transform can erase.
 *
 * NOT AN ALLOWLIST, DELIBERATELY. An earlier revision of this file pinned the
 * count of these four sites as a known-bad constant. That is the pattern the
 * `.toast` note in `style.css` argues against: a pinned defect count reads as
 * a passing test, and the failure it produces once someone fixes a site says
 * "lower the constant" rather than "good". Recording a genuine defect is not
 * verification of it. The assertion below is `[]`, so the only way to satisfy
 * it is to fix the call site.
 *
 * WHAT THIS DELIBERATELY DOES NOT CATCH (structural proxy, as with A–D):
 *  - Only `!important` kills count. A normal `transform: none` inside the
 *    query loses to a utility in the later `@layer utilities` and so cannot
 *    erase anything — `.modal-content` has exactly that, resetting a
 *    transition's own start state, and flagging it would be a false positive.
 *  - Classes INVARIANT D guards are excluded. If `.switch` were ever folded
 *    back into the kill list, INVARIANT D fails and names the stylesheet fix;
 *    this invariant would otherwise fail alongside it and point at the call
 *    site, which is the opposite of the right advice. One failure, one fix.
 *  - Stylesheet-side transforms on a killed class are not call sites, so they
 *    are filtered out: that is the component's own baseline geometry, which
 *    the kill is entitled to neutralise.
 *  - No geometry is measured. That a `-translate-y-1/2` is load-bearing rather
 *    than decorative is inferred from the utility being unconditional, not
 *    from a rendered rect. Real rects live in `scripts/a11y-runtime-check.mjs`.
 */

/** Interaction-gated selectors: a kill there is feedback, not resting layout. */
const INTERACTION_PSEUDO = /:(?:active|hover|focus|focus-visible|focus-within|target)\b/

/**
 * Classes the reduced-motion block nulls the transform of, mapped to the
 * `file:line` doing it. Derived from `style.css`, never hardcoded: the six-name
 * list has already grown once (`.animate-ping` nulls its `scale(2)` spread), so
 * a literal copy here would silently stop covering new entries.
 *
 * `gate` selects WHICH of the block's two independent kills to read. They are
 * different declarations with different reach, so they are never pooled:
 *   - `resting` (default) — kills on a plain selector, in force at rest. This
 *     is the one that can erase a call site's static transform, so it is what
 *     INVARIANT E must ask about.
 *   - `interaction` — kills behind `:active` / `:hover` (`.btn:active`,
 *     `.card-hover:hover`), in force only mid-gesture. INVARIANT F reads these
 *     solely to say "you kept this one and lost the other".
 */
function transformKilledClasses(
  css: string,
  cssPath: string,
  gate: 'resting' | 'interaction' = 'resting'
): Map<string, string> {
  const killed = new Map<string, string>()

  postcss.parse(css, { from: cssPath }).walkAtRules('media', (atRule) => {
    if (!atRule.params.includes('prefers-reduced-motion')) return

    atRule.walkRules((rule) => {
      rule.each((node) => {
        const line = node.source?.start?.line ?? rule.source?.start?.line ?? 0
        let kills = false
        if (node.type === 'atrule' && node.name === 'apply') {
          // `@apply !transform-none` is the same kill spelled as a utility. The
          // unprefixed `@apply transform-none` is not important, so like a
          // normal declaration it cannot beat a call-site utility.
          kills = node.params
            .split(/\s+/)
            .some((token) => token.replace(/^!/, '').split(':').pop() === 'transform-none' && token.startsWith('!'))
        } else if (node.type === 'decl' && node.prop === 'transform') {
          kills = node.important && /^\s*none\s*$/.test(node.value)
        }
        if (!kills) return

        for (const selector of selectorList(rule)) {
          const lastCompound = selector.split(/[\s>+~]+/).filter(Boolean).pop() ?? selector
          if (INTERACTION_PSEUDO.test(lastCompound) !== (gate === 'interaction')) continue
          for (const className of classTokensInSelector(lastCompound)) {
            if (!killed.has(className)) killed.set(className, `${cssPath}:${line}`)
          }
        }
      })
    })
  })

  return killed
}

/* ========================================================================= */
/* INVARIANT F — the deliberate press-scale kill must stay killed             */
/* ========================================================================= */

/**
 * The third question about the same block, and the only one asked from the
 * DEFENDING side: is the transform kill still there at all?
 *
 * INVARIANT D says `transform: none !important` must not reach `.switch` /
 * `.switch-thumb`. INVARIANT E says nothing the kill list nulls may carry a
 * static transform at a call site. Both are written against the kill being too
 * BROAD. Neither notices it going too NARROW — and narrow is a real regression:
 * `transform: none !important` on the six semantic classes is what neutralises
 * press-scale feedback for vestibular-sensitive users, which is the reason this
 * branch exists at all.
 *
 * Delete that declaration and D is unmoved, because D only ever asked for these
 * six to be left alone. E goes VACUOUS: E derives its kill list from the
 * stylesheet, so a missing kill SHRINKS the list, and a shrunken list means
 * fewer call sites to check and a greener `[]`. The derivation is correct for E,
 * whose subject is call sites, and it is exactly what makes E unable to defend
 * the kill itself. Something has to assert the floor.
 *
 * HARDCODED EXPECTATIONS — THE OPPOSITE OF INVARIANT E, on purpose. Read this
 * before "fixing" the inconsistency. E asks "of whatever is killed, is any of it
 * load-bearing?", so deriving can only widen the question and a literal copy
 * would stop covering new entries. This asks "are these specific classes still
 * killed?", which is an existence claim, and deriving it would be circular: the
 * mutation to catch IS the stylesheet losing an entry, and a list read out of
 * the stylesheet loses that entry in the same edit. So the six names live here,
 * as a contract with the block's documented purpose rather than a copy of it.
 *
 * A SUPERSET IS FINE. These six are required; extra kills are not failures. The
 * real list has already grown once (`.animate-ping` nulls its own `scale(2)`
 * spread) and legitimately may grow again, so the assertion is per-class
 * presence — never a count, never an exact-set comparison.
 *
 * AN INTERACTION-GATED KILL DOES NOT SATISFY THIS. `.btn:active` and
 * `.card-hover:hover` in the same block are a SECOND, DISTINCT kill: they null
 * the transform only while the gesture is held. A class can keep that one and
 * lose the resting-state kill, which still leaves the press-scale to run
 * wherever the gesture is not the thing driving it (a `transition` easing the
 * scale back out after release, an `animation` holding it). So `resting` is
 * required, and a surviving interaction kill is reported as insufficient rather
 * than accepted.
 *
 * WHAT THIS DELIBERATELY DOES NOT CATCH (structural proxy, as with A–E):
 *  - No rendered scale. That the kill really flattens a `scale(0.96)` to the
 *    identity matrix is a browser fact, and `scripts/a11y-runtime-check.mjs`
 *    owns it. This asserts only that the declaration is present and important.
 *  - Nothing about the block's other half. `[class*='active:scale']:active`
 *    pinning `--tw-scale-x/y` back to 1 is what covers the 319 template call
 *    sites carrying no semantic class; different mechanism, not asserted here.
 *  - No allowlist, and nothing to allowlist: every entry is satisfied today. If
 *    a future change genuinely needs one of the six to keep its transform, the
 *    honest move is to move that class into TRANSFORM_LOAD_BEARING_CLASSES with
 *    a justification INVARIANT D then enforces — not to except it here.
 */

/**
 * Classes whose `transform` the reduced-motion branch must null AT REST.
 *
 * Hardcoded, per the note above: this is the existence half of the contract, so
 * the list cannot be read out of the file it is checking. Every entry is a class
 * whose press feedback is a transform, i.e. precisely what the preference asks
 * to have removed.
 */
const PRESS_SCALE_KILL_CLASSES = [
  'btn',
  'card',
  'card-hover',
  'sidebar-link',
  'progress-bar',
  'tab'
] as const

/**
 * `file:line` to name when a required kill is MISSING.
 *
 * A declaration that is not there has no source position of its own, and this
 * file's failure messages have to point somewhere worth opening. Best available
 * anchor, in order: a peer of the six that kept its resting kill (that IS the
 * rule the missing name belongs in), then this class's own surviving timing
 * clamp (the rule the declaration was deleted from), then any other resting kill
 * in the branch, then the branch itself. The last case only happens if the whole
 * block is gone, when five other invariants fail too.
 */
function pressScaleKillAnchor(className: string, css: string, cssPath: string): string {
  const resting = transformKilledClasses(css, cssPath)

  for (const peer of PRESS_SCALE_KILL_CLASSES) {
    const at = resting.get(peer)
    if (at) return at
  }

  const { clampAt } = motionTreatmentOf(className, css, cssPath)
  if (clampAt) return clampAt

  for (const at of resting.values()) return at

  let blockAt: string | null = null
  postcss.parse(css, { from: cssPath }).walkAtRules('media', (atRule) => {
    if (!atRule.params.includes('prefers-reduced-motion')) return
    blockAt ??= `${cssPath}:${atRule.source?.start?.line ?? 0}`
  })
  return blockAt ?? `${cssPath}:0`
}

interface MissingKill {
  className: string
  /** Where to look in the stylesheet, since the declaration itself is absent. */
  anchor: string
  /** Set when the class kept its `:active` / `:hover` kill and lost only this one. */
  interactionKillAt: string | null
}

function findMissingPressScaleKills(css: string, cssPath: string): MissingKill[] {
  const resting = transformKilledClasses(css, cssPath)
  const interaction = transformKilledClasses(css, cssPath, 'interaction')

  return PRESS_SCALE_KILL_CLASSES.filter(
    // INVARIANT D asserts the OPPOSITE of this about the classes it guards. If
    // one of these names were ever moved under D's protection, the two would
    // fail pointing in opposite directions; excluding them is what makes that
    // impossible. One failure, one fix.
    (className) => !TRANSFORM_LOAD_BEARING_CLASSES.has(className)
  )
    .filter((className) => !resting.has(className))
    .map((className) => ({
      className,
      anchor: pressScaleKillAnchor(className, css, cssPath),
      interactionKillAt: interaction.get(className) ?? null
    }))
}

function formatMissingKill({ className, anchor, interactionKillAt }: MissingKill): string {
  const lines = [
    `${anchor}  .${className} is not given \`transform: none !important\` at rest inside`,
    `  @media (prefers-reduced-motion: reduce).`,
    `  That kill is deliberate, not incidental: it is what neutralises press-scale`,
    `  feedback for vestibular-sensitive users, which is why this branch exists.`,
    `  Losing it is invisible to the rest of this file. INVARIANT D only asks that the`,
    `  kill stay OFF .switch/.switch-thumb, and INVARIANT E DERIVES its kill list from`,
    `  this stylesheet — so a deleted kill shrinks E's list and E passes on the smaller`,
    `  set. This invariant is the only one that reads the absence as a defect.`
  ]

  if (interactionKillAt) {
    lines.push(
      `  .${className} does still get an interaction-gated kill at ${interactionKillAt}, but`,
      `  that is a separate declaration: it nulls the transform only while the gesture is`,
      `  held, so it does not satisfy this invariant.`
    )
  }

  lines.push(
    `  Fix in style.css, not at the call site: put .${className} back in the resting-state`,
    `  rule that sets \`transform: none !important\` inside the reduced-motion branch. If`,
    `  .${className} genuinely needs its transform now, move it into`,
    `  TRANSFORM_LOAD_BEARING_CLASSES with a justification INVARIANT D can enforce.`
  )

  return lines.join('\n')
}

/* ========================================================================= */
/* Tests                                                                      */
/* ========================================================================= */

describe('CSS invariants: preference-branch theme parity (INVARIANT A)', () => {
  it('declares every in-query :root custom property on the in-query dark rule too', () => {
    const violations = findThemeParityViolations(globalCss(), 'src/style.css')
    const report = violations.map(formatParityViolation).join('\n\n')

    expect(
      violations,
      violations.length === 0
        ? ''
        : `\n${violations.length} preference-branch parity violation(s):\n\n${report}\n`
    ).toEqual([])
  })

  it('detects a planted light-only declaration (detector is not vacuous)', () => {
    const planted = `
      @media (prefers-contrast: more) {
        .dark { --label-tertiary: rgba(235, 235, 245, 0.75); }
        :root { --label-secondary: rgba(60, 60, 67, 0.86); --label-tertiary: rgba(60,60,67,0.7); }
      }
    `
    const violations = findThemeParityViolations(planted, 'planted.css')
    expect(violations.map((violation) => violation.property)).toEqual(['--label-secondary'])
  })

  it('accepts a combined :root, .dark selector list and the html.dark spelling', () => {
    const combined = `
      @media (prefers-reduced-transparency: reduce) {
        :root, .dark { --mat-thin: var(--surface) !important; }
      }
      @media (prefers-contrast: more) {
        html.dark { --label-secondary: rgba(235, 235, 245, 0.9); }
        :root { --label-secondary: rgba(60, 60, 67, 0.86); }
      }
    `
    expect(findThemeParityViolations(combined, 'combined.css')).toEqual([])
  })

  it('ignores non-preference media queries, where base .dark still wins by source order', () => {
    const breakpoint = `
      @media (min-width: 768px) {
        :root { --sidebar-width: 260px; }
      }
    `
    expect(findThemeParityViolations(breakpoint, 'breakpoint.css')).toEqual([])
  })
})

describe('CSS invariants: no dead preference selectors (INVARIANT B)', () => {
  it('matches every prefers-reduced-motion selector to a live element', () => {
    const live = collectLiveClasses(sourceFiles())
    const dead = findDeadMotionSelectors(globalCss(), 'src/style.css', live).filter(
      (entry) => !KNOWN_DEAD_MOTION_SELECTORS.has(entry.selector)
    )
    const report = dead.map(formatDeadSelector).join('\n\n')

    expect(
      dead,
      dead.length === 0
        ? ''
        : `\n${dead.length} inert reduced-motion selector(s):\n\n${report}\n`
    ).toEqual([])
  })

  it('keeps the allowlist honest: every entry is a selector that exists in the block', () => {
    const selectorsInBlock = new Set(
      findDeadMotionSelectors(globalCss(), 'src/style.css', new Set()).map(
        (entry) => entry.selector
      )
    )
    const stale = [...KNOWN_DEAD_MOTION_SELECTORS].filter(
      (selector) => !selectorsInBlock.has(selector)
    )
    expect(
      stale,
      `KNOWN_DEAD_MOTION_SELECTORS lists selector(s) that no prefers-reduced-motion rule ` +
        `declares: ${stale.join(', ')}. Remove them so the allowlist keeps describing reality.`
    ).toEqual([])
  })

  it('tokenizes class attributes rather than file text (detector is not vacuous)', () => {
    // `toast` appears as an identifier, a property, an i18n key and a comment —
    // 22 files' worth of false positives for a naive text scan, zero for a
    // tokenizer. This fixture is that difference in miniature.
    const decoy: SourceFile[] = [
      {
        path: 'decoy.vue',
        text: `
          <template>
            <!-- toast lives here -->
            <div :class="['glass-thin', getBorderColor(toast.type)]">{{ toast.title }}</div>
          </template>
          <script setup lang="ts">const showToast = (toast: Toast) => toast.id</script>
        `
      }
    ]
    const live = collectLiveClasses(decoy)
    expect(live.has('toast')).toBe(false)
    expect(live.has('glass-thin')).toBe(true)

    const planted = `
      @media (prefers-reduced-motion: reduce) {
        .toast { animation: rm-fade-in 120ms both !important; }
        .glass-thin { animation: rm-fade-in 120ms both !important; }
      }
    `
    const dead = findDeadMotionSelectors(planted, 'planted.css', live)
    expect(dead.map((entry) => entry.selector)).toEqual(['.toast'])
  })

  it('counts <transition name> expansion and skips selectors with no class token', () => {
    const live = collectLiveClasses([
      { path: 'modal.vue', text: '<template><transition name="modal"><div /></transition></template>' }
    ])
    expect(live.has('modal-enter-active')).toBe(true)

    const planted = `
      @media (prefers-reduced-motion: reduce) {
        .modal-enter-active { transition-duration: 1ms; }
        html { scroll-behavior: auto !important; }
        [class*='active:scale']:active { --tw-scale-x: 1 !important; }
      }
    `
    expect(findDeadMotionSelectors(planted, 'planted.css', live)).toEqual([])
  })
})

describe('CSS invariants: no double-driven animation (INVARIANT C)', () => {
  it('never wraps an intrinsically animated class in a transform-driving <transition>', () => {
    const animated = collectAnimatedClasses(globalCss(), 'src/style.css')
    const names = collectTransformDrivingTransitionNames(globalCss(), 'src/style.css')
    const hits = findDoubleDrivenAnimations(sourceFiles(), animated, names)
    const report = hits.map(formatDoubleDrivenHit).join('\n\n')

    expect(
      hits,
      hits.length === 0 ? '' : `\n${hits.length} double-driven animation(s):\n\n${report}\n`
    ).toEqual([])
  })

  it('reads .dropdown as intrinsically animated and dropdown as transform-driving', () => {
    // Guards the two lookups the real assertion depends on. If `.dropdown`
    // stops resolving as animated, the invariant above silently passes forever.
    const animated = collectAnimatedClasses(globalCss(), 'src/style.css')
    expect(animated.has('dropdown')).toBe(true)
    expect(animated.has('skeleton')).toBe(true)

    const appHeader = readFileSync(join(SRC_ROOT, 'components/layout/AppHeader.vue'), 'utf8')
    const names = new Set<string>()
    for (const block of styleBlocks(appHeader)) {
      for (const name of collectTransformDrivingTransitionNames(block, 'AppHeader.vue')) {
        names.add(name)
      }
    }
    expect(names.has('dropdown')).toBe(true)
  })

  it('detects a planted double-drive and spares the correct variants (not vacuous)', () => {
    const css = `
      .spin-badge { animation: spin 1s linear infinite; }
      .pop-enter-from, .pop-leave-to { transform: scale(0.94); }
      .pop-enter-active { transition: opacity 240ms, transform 240ms; }
    `
    const animated = collectAnimatedClasses(css, 'planted.css')
    const names = collectTransformDrivingTransitionNames(css, 'planted.css')

    const violating: SourceFile = {
      path: 'violating.vue',
      text: '<template><transition name="pop"><div class="spin-badge p-2" /></transition></template>'
    }
    expect(findDoubleDrivenAnimations([violating], animated, names)).toHaveLength(1)

    // The three correct call sites, in miniature: glass classes on the
    // transitioned element, and the `animate-none` opt-out.
    const correct: SourceFile[] = [
      {
        path: 'glass.vue',
        text: '<template><transition name="pop"><div class="glass-thin glass-edge" /></transition></template>'
      },
      {
        path: 'opted-out.vue',
        text: '<template><transition name="pop"><div class="spin-badge animate-none" /></transition></template>'
      },
      {
        path: 'untransformed.vue',
        text: '<template><transition name="fade"><div class="spin-badge" /></transition></template>'
      }
    ]
    expect(findDoubleDrivenAnimations(correct, animated, names)).toEqual([])
  })

  it('does not flag a transition that only transforms a descendant', () => {
    // `.modal-enter-from .modal-content` drives a CHILD's transform. Different
    // element, different lifetime, not this bug.
    const css = `
      .sheet { animation: materialize 0.44s var(--spring); }
      .modal-enter-active { transition: opacity 340ms var(--ease-out); }
      .modal-enter-from .modal-content { transform: scale(0.96); }
    `
    const animated = collectAnimatedClasses(css, 'planted.css')
    const names = collectTransformDrivingTransitionNames(css, 'planted.css')
    expect(names.has('modal')).toBe(false)

    const file: SourceFile = {
      path: 'modal.vue',
      text: '<template><transition name="modal"><div class="sheet" /></transition></template>'
    }
    expect(findDoubleDrivenAnimations([file], animated, names)).toEqual([])
  })
})

describe('CSS invariants: reduced motion clamps switch timing, not shape (INVARIANT D)', () => {
  it('never lets a transform reach a transform-load-bearing class under reduced motion', () => {
    const css = globalCss()
    const offenders = [...TRANSFORM_LOAD_BEARING_CLASSES].flatMap(([className, why]) => {
      const { transformAt, transformText } = motionTreatmentOf(className, css, 'src/style.css')
      if (transformAt === null) return []
      return [
        [
          `${transformAt}  .${className} receives \`${transformText}\` under prefers-reduced-motion.`,
          `  That transform is load-bearing: ${why}.`,
          `  An !important declaration in @layer components beats a normal utility in`,
          `  @layer utilities whatever the specificity, so this silently overrides the`,
          `  call site — visible only while the preference is emulated.`,
          `  Fix: give .${className} its own rule with the timing clamp alone. Do NOT merge`,
          `  it back into the .btn/.card/.card-hover/.sidebar-link/.progress-bar/.tab list,`,
          `  whose \`transform: none !important\` is a deliberate press-scale kill.`
        ].join('\n')
      ]
    })

    expect(
      offenders,
      offenders.length === 0 ? '' : `\n${offenders.length} clobbered transform(s):\n\n${offenders.join('\n\n')}\n`
    ).toEqual([])
  })

  it('still clamps their transition-duration under reduced motion', () => {
    // The other half. Exempting a class from the transform kill by dropping it
    // out of the block entirely would restore the original defect: the track
    // measured 240ms while every peer control was capped at 120ms.
    const css = globalCss()
    const unclamped = [...TRANSFORM_LOAD_BEARING_CLASSES.keys()].filter(
      (className) => motionTreatmentOf(className, css, 'src/style.css').clampAt === null
    )

    expect(
      unclamped,
      `\n.${unclamped.join(', .')} is exempt from the transform kill but has no ` +
        `transition-duration clamp\ninside @media (prefers-reduced-motion: reduce) either, so its ` +
        `full-speed transition survives\nthe preference. That is the 240ms bug this block was ` +
        `extended to fix.\nFix: keep the class in a reduced-motion rule that clamps ` +
        `transition-duration, just\nnot in one that sets transform.\n`
    ).toEqual([])
  })

  it('keeps every exemption justified by a real transform (no cargo-culted entries)', () => {
    // An exemption is only defensible while something actually transforms the
    // class. Without this, a stale entry would quietly hold a class out of the
    // kill list forever.
    const css = globalCss()
    const files = sourceFiles()
    const unjustified = [...TRANSFORM_LOAD_BEARING_CLASSES.keys()].filter(
      (className) => findPermanentTransformSources(className, files, css, 'src/style.css').length === 0
    )

    expect(
      unjustified,
      `TRANSFORM_LOAD_BEARING_CLASSES lists .${unjustified.join(', .')}, but nothing ` +
        `applies a permanent transform to it any more (checked class= / :class= call sites and ` +
        `non-preference-query rules in style.css). Either the justification moved, or the ` +
        `exemption is stale — if it is stale, remove the entry and let the class rejoin the ` +
        `transform kill list.`
    ).toEqual([])
  })

  it('reads the .switch justification off the real call site (detector is not vacuous)', () => {
    // Pins the lookup the assertions above depend on. If `scale-[0.72]` stops
    // resolving as a permanent transform, the exemption looks unjustified and
    // the previous test starts failing for the wrong reason.
    const sources = findPermanentTransformSources(
      'switch',
      sourceFiles(),
      globalCss(),
      'src/style.css'
    )
    expect(sources.map((source) => source.utility)).toContain('scale-[0.72]')
    expect(sources.some((source) => source.location.includes('ErrorPassthroughRulesModal.vue'))).toBe(
      true
    )

    // The thumb is justified from the stylesheet instead, via
    // `.switch-active .switch-thumb { @apply translate-x-5 }`.
    const thumbSources = findPermanentTransformSources(
      'switch-thumb',
      sourceFiles(),
      globalCss(),
      'src/style.css'
    )
    expect(thumbSources.some((source) => source.utility === '@apply translate-x-5')).toBe(true)
  })

  it('separates permanent transforms from press feedback and identity no-ops', () => {
    // The whole detector turns on this distinction. `active:`/`hover:` scaling
    // is exactly what the preference exists to remove, so counting it would
    // justify exempting every button in the app.
    expect(isPermanentTransformUtility('scale-[0.72]')).toBe(true)
    expect(isPermanentTransformUtility('-translate-y-1/2')).toBe(true)
    expect(isPermanentTransformUtility('!translate-x-4')).toBe(true)
    expect(isPermanentTransformUtility('md:scale-95')).toBe(true)
    expect(isPermanentTransformUtility('dark:md:-rotate-3')).toBe(true)

    expect(isPermanentTransformUtility('active:scale-[0.96]')).toBe(false)
    expect(isPermanentTransformUtility('hover:-translate-y-0.5')).toBe(false)
    expect(isPermanentTransformUtility('group-hover:scale-105')).toBe(false)
    expect(isPermanentTransformUtility('translate-x-0')).toBe(false)
    expect(isPermanentTransformUtility('scale-100')).toBe(false)
    expect(isPermanentTransformUtility('origin-left')).toBe(false)
    expect(isPermanentTransformUtility('transform-none')).toBe(false)
    // A bracketed value containing a colon must not read as a variant prefix.
    expect(isPermanentTransformUtility('ring-[color:var(--accent-tint-strong)]')).toBe(false)
  })

  it('detects the planted regression in both directions (detector is not vacuous)', () => {
    // 1. The bug as it shipped: `.switch` folded into the kill list.
    const regressed = `
      @media (prefers-reduced-motion: reduce) {
        .btn, .tab, .switch {
          transition-duration: 120ms !important;
          transform: none !important;
        }
        .switch-thumb { transition-duration: 1ms !important; }
      }
    `
    const killed = motionTreatmentOf('switch', regressed, 'planted.css')
    // Derived, not hardcoded: a `file:line` is required of every failure
    // message, and hardcoding it would make the fixture brittle to reindenting.
    expect(killed.transformAt).toBe(
      `planted.css:${lineOf(regressed, regressed.indexOf('transform: none'))}`
    )
    expect(killed.transformText).toBe('transform: none !important')
    expect(killed.clampAt).not.toBeNull()
    // `.btn` keeps its kill and is deliberately not guarded.
    expect(motionTreatmentOf('btn', regressed, 'planted.css').transformAt).not.toBeNull()

    // 2. The opposite regression: exempted so hard it left the block.
    const unclamped = `
      @media (prefers-reduced-motion: reduce) {
        .btn, .tab { transform: none !important; }
      }
    `
    const dropped = motionTreatmentOf('switch', unclamped, 'planted.css')
    expect(dropped.transformAt).toBeNull()
    expect(dropped.clampAt).toBeNull()

    // 3. The fix: clamp present, transform absent.
    const fixed = `
      @media (prefers-reduced-motion: reduce) {
        .btn, .tab { transition-duration: 120ms !important; transform: none !important; }
        .switch { transition-duration: 120ms !important; }
        .switch-thumb { transition-duration: 1ms !important; }
      }
    `
    for (const className of ['switch', 'switch-thumb']) {
      const treatment = motionTreatmentOf(className, fixed, 'planted.css')
      expect(treatment.transformAt).toBeNull()
      expect(treatment.clampAt).not.toBeNull()
    }

    // 4. Spellings that must not slip past: the shorthand carries a duration,
    //    and `@apply transform-none` is the same kill by another name.
    const shorthand = `
      @media (prefers-reduced-motion: reduce) {
        .switch { transition: background-color 120ms linear !important; }
        .switch-thumb { @apply transform-none; transition-duration: 1ms !important; }
      }
    `
    expect(motionTreatmentOf('switch', shorthand, 'planted.css').clampAt).not.toBeNull()
    const thumb = motionTreatmentOf('switch-thumb', shorthand, 'planted.css')
    expect(thumb.transformText).toBe('@apply transform-none')
  })
})

describe('CSS invariants: a killed transform is never load-bearing (INVARIANT E)', () => {
  it('never lets a call site put a static transform on a transform-killed class', () => {
    const css = globalCss()
    const files = sourceFiles()
    const killed = transformKilledClasses(css, 'src/style.css')

    const offenders = [...killed]
      // INVARIANT D owns these: their fix is in style.css, not at the call site.
      .filter(([className]) => !TRANSFORM_LOAD_BEARING_CLASSES.has(className))
      .flatMap(([className, killedAt]) =>
        findPermanentTransformSources(className, files, css, 'src/style.css')
          // A stylesheet-side transform is the component's own baseline, not a
          // call site stacking a utility on top of it.
          .filter((source) => !source.location.startsWith('src/style.css:'))
          .map((source) =>
            [
              `${source.location}  .${className} carries \`${source.utility}\`, which is a static`,
              `  transform, and ${killedAt} sets \`transform: none !important\` on .${className}`,
              `  under prefers-reduced-motion.`,
              `  That kill is correct — it neutralises press-scale for vestibular-sensitive`,
              `  users — and !important in @layer components beats a normal utility in`,
              `  @layer utilities whatever the specificity. So under the preference this`,
              `  utility is erased and the element moves or resizes at rest.`,
              `  Fix at the call site, not in style.css: express the position without a`,
              `  transform. The four password toggles centre with \`absolute inset-y-0 right-2`,
              `  my-auto\`, which resolves to the same offset and no transform can erase;`,
              `  a flex/grid wrapper works too. \`active:\`-gated scaling is fine here.`
            ].join('\n')
          )
      )

    expect(
      offenders,
      offenders.length === 0
        ? ''
        : `\n${offenders.length} static transform(s) on a transform-killed class:\n\n${offenders.join('\n\n')}\n`
    ).toEqual([])
  })

  it('derives the kill list from style.css and skips kills that cannot bite', () => {
    // Derived, not hardcoded: the real list has already grown past the six
    // semantic classes, and a literal copy would stop covering new entries.
    const killed = transformKilledClasses(globalCss(), 'src/style.css')
    for (const className of ['btn', 'card', 'card-hover', 'sidebar-link', 'progress-bar', 'tab']) {
      expect(killed.has(className), `${className} should be read as transform-killed`).toBe(true)
    }
    // Grown once already: animate-ping nulls its own scale(2) spread.
    expect(killed.has('animate-ping')).toBe(true)
    // Not important, so it loses to a utility in the later layer: it resets a
    // transition's start state and cannot erase anything at a call site.
    expect(killed.has('modal-content')).toBe(false)
    // Never guarded and never killed.
    expect(killed.has('switch-thumb')).toBe(false)
  })

  it('detects the planted call site in both directions (detector is not vacuous)', () => {
    const planted = `
      @media (prefers-reduced-motion: reduce) {
        .btn, .tab { transform: none !important; }
        .modal-content { transform: none; }
        .btn:active { transform: none !important; }
      }
    `
    const killed = transformKilledClasses(planted, 'planted.css')
    expect([...killed.keys()].sort()).toEqual(['btn', 'tab'])
    expect(killed.get('btn')).toBe(
      `planted.css:${lineOf(planted, planted.indexOf('transform: none !important'))}`
    )

    // The regression as it shipped: static centring on a killed class.
    const regressed: SourceFile[] = [
      {
        path: 'src/views/auth/LoginView.vue',
        text: '<button class="btn btn-icon absolute right-2 top-1/2 -translate-y-1/2" />'
      }
    ]
    const hits = findPermanentTransformSources('btn', regressed, planted, 'planted.css')
      .filter((source) => !source.location.startsWith('planted.css:'))
    expect(hits).toEqual([
      { location: 'src/views/auth/LoginView.vue:1', utility: '-translate-y-1/2' }
    ])

    // The fix, and the press feedback that must NOT be flagged alongside it.
    const fixed: SourceFile[] = [
      {
        path: 'src/views/auth/LoginView.vue',
        text: '<button class="btn btn-icon absolute inset-y-0 right-2 my-auto active:scale-[0.96]" />'
      }
    ]
    expect(
      findPermanentTransformSources('btn', fixed, planted, 'planted.css').filter(
        (source) => !source.location.startsWith('planted.css:')
      )
    ).toEqual([])
  })

  it('reads @apply !transform-none as a kill and plain @apply transform-none as harmless', () => {
    // The utility spelling of the same declaration. Without the bang it is not
    // important, so it cannot beat a call-site utility either.
    const important = `
      @media (prefers-reduced-motion: reduce) {
        .btn { @apply !transform-none; }
      }
    `
    expect(transformKilledClasses(important, 'planted.css').has('btn')).toBe(true)

    const normal = `
      @media (prefers-reduced-motion: reduce) {
        .btn { @apply transform-none; }
      }
    `
    expect(transformKilledClasses(normal, 'planted.css').has('btn')).toBe(false)
  })
})

describe('CSS invariants: the press-scale kill stays killed (INVARIANT F)', () => {
  it('nulls the transform of every press-scale class at rest under reduced motion', () => {
    const missing = findMissingPressScaleKills(globalCss(), 'src/style.css')

    expect(
      missing.map((entry) => entry.className),
      missing.length === 0
        ? ''
        : `\n${missing.length} press-scale kill(s) missing:\n\n` +
          `${missing.map(formatMissingKill).join('\n\n')}\n`
    ).toEqual([])
  })

  it('reads the resting and interaction kills as two separate declarations', () => {
    // The gate has to partition, not pool. If interaction-gated kills ever
    // leaked into the resting set, the assertion above would be satisfiable by
    // `.btn:active` alone — which is the regression it exists to catch.
    //
    // Asserted on a fixture, NOT on style.css. The assertion above already owns
    // the stylesheet question, and pinning the same facts twice would make one
    // deleted declaration fail two tests — the "one failure, one fix" rule this
    // file follows for D vs E.
    const both = `
      @media (prefers-reduced-motion: reduce) {
        .btn, .card, .card-hover { transform: none !important; }
        .btn:active, .card-hover:hover { transform: none !important; }
      }
    `
    const resting = transformKilledClasses(both, 'planted.css')
    const interaction = transformKilledClasses(both, 'planted.css', 'interaction')

    // Same class, both gates, different lines — the sets overlap without either
    // being the other, so a pooled read would be indistinguishable from a
    // partitioned one on a simpler fixture.
    expect(resting.get('btn')).toBe(
      `planted.css:${lineOf(both, both.indexOf('transform: none !important'))}`
    )
    expect(interaction.get('btn')).toBe(
      `planted.css:${lineOf(both, both.lastIndexOf('transform: none !important'))}`
    )
    expect(resting.get('btn')).not.toBe(interaction.get('btn'))

    // `.card` is resting-only: it must not appear in the interaction set at all.
    expect(resting.has('card')).toBe(true)
    expect(interaction.has('card')).toBe(false)

    // The inverse: an interaction-only kill must not leak into the resting set,
    // which is what would let `.btn:active` alone satisfy this invariant.
    const gatedOnly = `
      @media (prefers-reduced-motion: reduce) {
        .btn:active { transform: none !important; }
      }
    `
    expect(transformKilledClasses(gatedOnly, 'planted.css').has('btn')).toBe(false)
    expect(transformKilledClasses(gatedOnly, 'planted.css', 'interaction').has('btn')).toBe(true)
    expect(findMissingPressScaleKills(gatedOnly, 'planted.css')[0].className).toBe('btn')
  })

  it('never disagrees with INVARIANT D about the same class', () => {
    // The one cross-invariant fact worth asserting against the real stylesheet:
    // the two lists must stay disjoint. D says its classes must NOT be killed, F
    // says these MUST be, so an overlap would be two failures demanding opposite
    // edits. The filter in `findMissingPressScaleKills` makes that unreachable;
    // this pins the intent so the filter cannot be quietly dropped as dead code.
    for (const guarded of TRANSFORM_LOAD_BEARING_CLASSES.keys()) {
      expect(
        (PRESS_SCALE_KILL_CLASSES as readonly string[]).includes(guarded),
        `.${guarded} is guarded by INVARIANT D and must not also be required to be killed`
      ).toBe(false)
    }

    // And with `.switch` wrongly folded into the kill list, F must stay silent
    // and leave the failure to D, which names the stylesheet fix.
    const folded = `
      @media (prefers-reduced-motion: reduce) {
        .btn, .card, .card-hover, .sidebar-link, .progress-bar, .tab, .switch {
          transform: none !important;
        }
      }
    `
    expect(findMissingPressScaleKills(folded, 'planted.css')).toEqual([])
    expect(motionTreatmentOf('switch', folded, 'planted.css').transformAt).not.toBeNull()
  })

  it('detects both planted deletions and tolerates a grown list (not vacuous)', () => {
    // 1. The whole declaration deleted from the six-selector rule. The clamp
    //    stays, so the block still looks busy and D/E stay green.
    const noKill = `
      @media (prefers-reduced-motion: reduce) {
        .btn, .card, .card-hover, .sidebar-link, .progress-bar, .tab {
          transition-property: opacity, background-color, color !important;
          transition-duration: 120ms !important;
        }
        .btn:active { transform: none !important; }
      }
    `
    const allMissing = findMissingPressScaleKills(noKill, 'planted.css')
    expect(allMissing.map((entry) => entry.className)).toEqual([...PRESS_SCALE_KILL_CLASSES])
    // Derived, not hardcoded: with no resting kill left to point at, the anchor
    // falls back to the rule the declaration was deleted from — the surviving
    // clamp — so the message still names a `file:line`.
    const btn = allMissing[0]
    expect(btn.anchor).toBe(motionTreatmentOf('btn', noKill, 'planted.css').clampAt)
    // `.btn` kept its `:active` kill, which must be reported as insufficient
    // rather than accepted: a held gesture is not the resting state.
    expect(btn.interactionKillAt).not.toBeNull()
    expect(formatMissingKill(btn).startsWith(`${btn.anchor}  .btn is not given`)).toBe(true)
    expect(formatMissingKill(btn)).toContain('interaction-gated kill')
    // `.card` has no interaction kill, so that paragraph must not appear.
    const card = allMissing[1]
    expect(card.className).toBe('card')
    expect(card.interactionKillAt).toBeNull()
    expect(formatMissingKill(card)).not.toContain('interaction-gated kill')

    // 2. One name dropped out of the selector list. Five kills still stand, so
    //    the anchor is the rule the sixth name belongs in.
    const dropped = `
      @media (prefers-reduced-motion: reduce) {
        .btn, .card, .sidebar-link, .progress-bar, .tab {
          transform: none !important;
        }
        .card-hover:hover { transform: none !important; }
      }
    `
    const one = findMissingPressScaleKills(dropped, 'planted.css')
    expect(one.map((entry) => entry.className)).toEqual(['card-hover'])
    expect(one[0].anchor).toBe(
      `planted.css:${lineOf(dropped, dropped.indexOf('transform: none !important'))}`
    )
    expect(one[0].interactionKillAt).not.toBe(one[0].anchor)

    // 3. A LEGITIMATELY GROWN list must not fail. `.animate-ping` already nulls
    //    its own `scale(2)`, and more may follow; the assertion is per-class
    //    presence, never an exact set.
    const grown = `
      @media (prefers-reduced-motion: reduce) {
        .btn, .card, .card-hover, .sidebar-link, .progress-bar, .tab, .chip {
          transform: none !important;
        }
        .animate-ping { transform: none !important; }
      }
    `
    expect(findMissingPressScaleKills(grown, 'planted.css')).toEqual([])

    // 4. A kill that cannot bite is not a kill. Without `!important` it loses to
    //    the call-site utility in the later @layer, exactly as INVARIANT E reads
    //    `.modal-content`, so it must not satisfy this invariant either.
    const weakened = `
      @media (prefers-reduced-motion: reduce) {
        .btn, .card, .card-hover, .sidebar-link, .progress-bar, .tab {
          transform: none;
        }
      }
    `
    expect(findMissingPressScaleKills(weakened, 'planted.css').map((e) => e.className)).toEqual([
      ...PRESS_SCALE_KILL_CLASSES
    ])
  })
})
