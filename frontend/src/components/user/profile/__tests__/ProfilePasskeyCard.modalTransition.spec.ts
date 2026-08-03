/**
 * The passkey delete confirmation must animate, which here means: its
 * `.modal-content` must have a `<Transition name="modal">` ancestor.
 *
 * The motion itself is defined in style.css as `.modal-enter-active
 * .modal-content`, so markup fully determines whether it runs — and markup is
 * what a jsdom test can honestly check. It cannot check the animation: there is
 * no compositor, and src/__tests__/setup.ts answers `matches: true` for every
 * matchMedia query, so prefers-reduced-motion reads ON and a mount-and-look
 * motion assertion would pass while measuring the stub.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const source = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../ProfilePasskeyCard.vue'),
  'utf8'
)

describe('ProfilePasskeyCard · delete confirmation transition', () => {
  it('wraps the .modal-content in <Transition name="modal">', () => {
    const panel = source.indexOf('modal-content')
    expect(panel).toBeGreaterThan(-1)

    const before = source.slice(0, panel)
    const opens = (before.match(/<[Tt]ransition\s+name="modal"/g) ?? []).length
    const closes = (before.match(/<\/[Tt]ransition>/g) ?? []).length
    expect(opens - closes).toBe(1)
  })

  it('transitions the full-screen wrapper, so the scrim fades with the panel', () => {
    // The transitioned element is the `fixed inset-0` wrapper that contains both
    // `.dialog-overlay` and `.modal-content`. Transitioning only the panel would
    // snap the scrim in behind a panel that fades.
    const transitionAt = source.search(/<Transition\s+name="modal">/)
    expect(transitionAt).toBeGreaterThan(-1)

    const afterTransition = source.slice(transitionAt)
    const firstElement = afterTransition.match(/<div[^>]*>/)
    expect(firstElement).not.toBeNull()
    expect(firstElement![0]).toContain('v-if="deleteTarget"')
    expect(firstElement![0]).toContain('fixed inset-0')

    // And the scrim is inside it, not a sibling of the transition.
    const overlayAt = source.indexOf('dialog-overlay')
    expect(overlayAt).toBeGreaterThan(transitionAt)
  })

  it('adds no per-site reduced-motion handling', () => {
    const code = source
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
    expect(code).not.toMatch(/prefers-reduced-motion/)
  })
})

/*
 * Browser-verified separately in Chromium with motion enabled: the sibling
 * RedeemView sheets, which share this exact CSS path, animate in over 0.44s and
 * out over 0.24s, and are still painted one frame after close. This component
 * takes the same `.modal-enter-active .modal-content` rule.
 */
