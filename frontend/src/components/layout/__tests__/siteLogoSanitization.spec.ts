/**
 * Guards the locked branding decision: the site logo is NEVER rendered as an
 * image in the UI. The brand is the site name as a plain-text wordmark, and the
 * only permitted consumer of `site_logo` is the favicon.
 *
 * Because no component renders `site_logo` into the DOM anymore, the sanitization
 * surface collapsed to a single sink: `utils/branding.ts#updateFavicon`, which is
 * covered (including the `javascript:` payload case) by
 * `src/utils/__tests__/branding.spec.ts`. This spec therefore guards the render
 * rule — the thing that would silently regress if someone reintroduced a logo.
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const dir = dirname(fileURLToPath(import.meta.url))

/** Every file that rendered a site-logo image before the Apple redesign. */
const FORMER_LOGO_SITES: Record<string, string> = {
  'layout/GlobalNav.vue': '../GlobalNav.vue',
  'layout/AuthLayout.vue': '../AuthLayout.vue',
  'views/HomeView.vue': '../../../views/HomeView.vue',
  'views/KeyUsageView.vue': '../../../views/KeyUsageView.vue',
  'views/public/LegalDocumentView.vue': '../../../views/public/LegalDocumentView.vue',
  'components/modelPlaza/PlazaNavBar.vue': '../../modelPlaza/PlazaNavBar.vue',
}

const sources = Object.fromEntries(
  Object.entries(FORMER_LOGO_SITES).map(([name, rel]) => [
    name,
    readFileSync(resolve(dir, rel), 'utf8'),
  ])
)

/** Strip the <script> block so we only inspect rendered markup. */
function templateOf(source: string): string {
  const scriptStart = source.search(/<script[\s>]/)
  return scriptStart === -1 ? source : source.slice(0, scriptStart)
}

describe('site logo is never rendered as an image', () => {
  for (const [name, source] of Object.entries(sources)) {
    it(`${name} renders no site-logo image`, () => {
      const template = templateOf(source)

      // No <img> may be bound to a logo source.
      const imgTags = template.match(/<img\b[^>]*>/gs) ?? []
      const logoImgs = imgTags.filter((tag) => /site_?[Ll]ogo|logo\.svg/.test(tag))
      expect(logoImgs).toEqual([])

      // The old default-logo fallback must be gone entirely.
      expect(template).not.toContain('/logo.svg')
      expect(template).not.toContain('alt="Logo"')
    })
  }

  it('no former logo site still reads site_logo from the store', () => {
    const offenders = Object.entries(sources)
      .filter(([, source]) => /siteLogo|site_logo/.test(source))
      .map(([name]) => name)
    expect(offenders).toEqual([])
  })

  it('the favicon remains the only site_logo consumer', () => {
    const branding = readFileSync(resolve(dir, '../../../utils/branding.ts'), 'utf8')
    expect(branding).toContain('sanitizeUrl(')
    expect(branding).toContain('allowRelative: true')
    expect(branding).toContain('allowDataUrl: true')
  })
})
