import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const componentPath = resolve(dirname(fileURLToPath(import.meta.url)), '../AppHeader.vue')
const componentSource = readFileSync(componentPath, 'utf8')

describe('AppHeader responsive page identity', () => {
  it('keeps the page title visible on mobile while hiding only the description', () => {
    const titleContainerClasses =
      componentSource.match(/<div class="([^"]*)">\s*<h1 class="app-header__title">/)?.[1] ?? ''
    const descriptionClasses =
      componentSource.match(/<p v-if="pageDescription" class="([^"]*)">/)?.[1] ?? ''

    expect(titleContainerClasses.split(/\s+/)).not.toContain('hidden')
    expect(titleContainerClasses.split(/\s+/)).toContain('min-w-0')
    expect(descriptionClasses).toContain('hidden lg:block')
  })

  it('matches the accepted 77px desktop top bar while retaining a compact mobile header', () => {
    const headerInnerBlock =
      componentSource.match(/\.app-header__inner\s*\{[\s\S]*?\n\}/)?.[0] ?? ''

    expect(headerInnerBlock).toContain('h-16')
    expect(headerInnerBlock).toContain('lg:h-[77px]')
  })
})
