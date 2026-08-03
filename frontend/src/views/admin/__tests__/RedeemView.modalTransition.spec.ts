/**
 * Every `.modal-content` in this view must sit inside a `<Transition name="modal">`.
 *
 * Why this is a source assertion rather than a rendered-motion one: the sheet
 * animation is defined as `.modal-enter-active .modal-content` in style.css, so
 * it only ever runs when a `modal` transition ancestor supplies those classes.
 * Whether the panel animates is therefore decided entirely by the markup, and
 * that IS checkable here — whereas the animation itself is not: jsdom has no
 * compositor, and src/__tests__/setup.ts makes matchMedia answer `matches: true`
 * for every query, so prefers-reduced-motion reads ON and any mount-and-look
 * motion test would pass without measuring anything.
 *
 * The rendered motion was verified in Chromium instead (see the note at the end).
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const source = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../RedeemView.vue'),
  'utf8'
)

/**
 * Source with comments removed, for assertions about what the file *does*.
 * Without this, a comment that explains where reduced motion is handled reads as
 * reduced-motion handling.
 */
const code = source
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:])\/\/.*$/gm, '$1')

/** Index of every `.modal-content` occurrence in the template. */
function modalContentOffsets(text: string): number[] {
  const offsets: number[] = []
  const re = /class="[^"]*\bmodal-content\b/g
  let match: RegExpExecArray | null
  while ((match = re.exec(text))) offsets.push(match.index)
  return offsets
}

/**
 * Whether `offset` is inside an open `<Transition name="modal">`.
 *
 * Counts opening and closing Transition tags before the offset instead of
 * regex-matching a block, so a panel nested several levels deep inside the
 * transition root still counts — which is the shape ProfilePasskeyCard and the
 * result dialog both use.
 */
function insideModalTransition(text: string, offset: number): boolean {
  const before = text.slice(0, offset)
  const opens = (before.match(/<[Tt]ransition\s+name="modal"/g) ?? []).length
  const closes = (before.match(/<\/[Tt]ransition>/g) ?? []).length
  return opens > closes
}

describe('RedeemView · modal transitions', () => {
  it('has the three dialogs this view is known to own', () => {
    // Pins the count, so a fourth dialog added later cannot silently skip the
    // wrapper and still pass the assertion below.
    expect(modalContentOffsets(source)).toHaveLength(3)
  })

  it('wraps every .modal-content in <Transition name="modal">', () => {
    const unwrapped = modalContentOffsets(source).filter(
      (offset) => !insideModalTransition(source, offset)
    )

    expect(
      unwrapped,
      unwrapped.length === 0
        ? ''
        : `\n${unwrapped.length} .modal-content site(s) with no <Transition name="modal"> ancestor.\n` +
            `The sheet animation is .modal-enter-active .modal-content, so these mount with no\n` +
            `transition and pop in. Lines: ${unwrapped
              .map((o) => source.slice(0, o).split('\n').length)
              .join(', ')}\n`
    ).toEqual([])
  })

  it('keeps the scrim inside the transition so it cross-fades with the panel', () => {
    // A scrim left outside the transition would appear instantly behind a panel
    // that fades in — the two would visibly disagree.
    const scrims = [...source.matchAll(/class="modal-scrim[^"]*"/g)].map((m) => m.index ?? 0)
    expect(scrims.length).toBe(3)
    for (const offset of scrims) {
      expect(insideModalTransition(source, offset)).toBe(true)
    }
  })

  it('adds no per-site reduced-motion handling', () => {
    // style.css already neutralises `.modal-*-active`, `.modal-*-active
    // .modal-content` and the enter/leave transform under the preference. A local
    // copy here would be a second source of truth that can drift.
    //
    // Scoped to real `@media` rules: the file legitimately *mentions*
    // prefers-reduced-motion in a comment explaining where it is handled, and it
    // has a pre-existing prefers-reduced-TRANSPARENCY block for `.modal-scrim`
    // that is a different preference and none of this task's business.
    const mediaQueries = [...code.matchAll(/@media\s*\(([^)]*)\)/g)].map((m) => m[1])
    expect(mediaQueries.filter((q) => q.includes('prefers-reduced-motion'))).toEqual([])
  })
})

/*
 * Browser-verified, not asserted above: the actual motion.
 *
 * Chromium, reducedMotion: 'no-preference', no CSS freeze —
 *   enter: one frame after open the panel is at
 *          transform matrix(0.94, 0, 0, 0.94, 0, 6.88) with
 *          transition-duration 0.44s/0.34s/0.44s, settling to `none`.
 *   leave: still in the DOM one frame after close with transition-duration
 *          0.24s, and removed afterwards.
 */
