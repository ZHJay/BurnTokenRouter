import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'

import TablePageLayout from '../TablePageLayout.vue'

const componentPath = resolve(dirname(fileURLToPath(import.meta.url)), '../TablePageLayout.vue')
const componentSource = readFileSync(componentPath, 'utf8')

describe('TablePageLayout responsive table scrolling', () => {
  it('keeps pagination inside the same elevated surface as the table', () => {
    const wrapper = mount(TablePageLayout, {
      slots: {
        table: '<div data-test="table-content" />',
        pagination: '<div data-test="pagination-content" />'
      }
    })

    const tableSurface = wrapper.get('.table-scroll-container').element
    const pagination = wrapper.get('[data-test="pagination-content"]').element

    expect(tableSurface.contains(pagination)).toBe(true)
  })

  it('does not disable the table horizontal scroll container in mobile mode', () => {
    const tableWrapperBlocks = Array.from(
      componentSource.matchAll(/([^{}]*:deep\(\.table-wrapper\)[^{}]*)\{([^{}]*)\}/g)
    )

    expect(tableWrapperBlocks.length).toBeGreaterThan(0)

    const baseBlock = tableWrapperBlocks.find(([selector]) => !selector.includes('.mobile-mode'))
    const mobileBlocks = tableWrapperBlocks.filter(([selector]) => selector.includes('.mobile-mode'))

    expect(baseBlock?.[2]).toContain('overflow-x-auto')
    expect(mobileBlocks.every(([, , declarations]) => !declarations.includes('overflow-visible'))).toBe(
      true
    )
  })

  it('reserves the accepted desktop header and 24px/48px content gutters', () => {
    expect(componentSource).toContain('height: calc(100vh - 77px - 4.5rem)')
  })
})
