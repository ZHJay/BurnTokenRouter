import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import DataTable from '../DataTable.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

const stubDesktopMatchMedia = () => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn()
    }))
  })
}

const stubMobileMatchMedia = () => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn()
    }))
  })
}

/**
 * jsdom reports 0 for every layout metric, so horizontal overflow has to be faked
 * on the specific wrapper element that DataTable measures.
 */
const stubWrapperGeometry = (el: HTMLElement, scrollWidth: number, clientWidth: number) => {
  Object.defineProperty(el, 'scrollWidth', { configurable: true, value: scrollWidth })
  Object.defineProperty(el, 'clientWidth', { configurable: true, value: clientWidth })
}

/** One animation frame (the component batches RO-driven re-measures to rAF). */
const rafFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

// Read the SFC as text: the pinned-column rules live in <style scoped>, and jsdom
// never applies stylesheets (probe: zero injected <style> tags, zero cssRules).
// What these tests lock is the stylesheet STRUCTURE — rule bodies and source order,
// which are the only layer-cascade inputs jsdom can observe. Whether the cascade
// actually renders correctly is verified in a real browser by phase-b-qa/verify.py.
const dataTableSource = readFileSync(
  resolve(process.cwd(), 'src/components/common/DataTable.vue'),
  'utf8'
)

/**
 * The stylesheet with comments stripped.
 *
 * Comments must go before any rule matching: most of the rules under test are
 * preceded by explanatory comment blocks, and a matcher that anchors a rule to
 * the preceding `}` cannot see past a comment.
 */
const dataTableCss = dataTableSource.replace(/\/\*[\s\S]*?\*\//g, '')

const normalizeSelectorList = (selectors: string[]): string =>
  selectors.map((selector) => selector.trim().replace(/\s+/g, ' ')).join(', ')

/**
 * Declaration bodies of every rule whose selector list matches exactly, in
 * source order.
 *
 * Exact matching rather than a substring search is what keeps
 * `tbody .sticky-col` from also matching `tbody tr:hover .sticky-col`. Rules
 * nested in at-rules are reached because the `[^{}]` prelude/body classes
 * cannot span a brace, so an `@supports`/`@media` wrapper never matches as a
 * rule and the scan falls through to the rules inside it.
 */
const cssRuleBodies = (selectors: string[]): string[] => {
  const wanted = normalizeSelectorList(selectors)
  const bodies: string[] = []
  const rulePattern = /([^{}]+)\{([^{}]*)\}/g
  let match: RegExpExecArray | null
  while ((match = rulePattern.exec(dataTableCss)) !== null) {
    if (normalizeSelectorList(match[1].split(',')) === wanted) bodies.push(match[2])
  }
  return bodies
}

/**
 * Declaration body of the first (base-cascade) rule matching the selector list.
 * The glass rule is deliberately restated inside `@supports` / `@media`
 * fallbacks, so callers asserting the base material want the first one.
 */
const cssRuleBody = (selectors: string[]): string => {
  const [body] = cssRuleBodies(selectors)
  if (body === undefined) throw new Error(`CSS rule not found for selector: ${selectors.join(', ')}`)
  return body
}

/**
 * Source index of the first rule matching the selector list, in the same scan
 * cssRuleBodies uses. Locks cascade-relevant SOURCE ORDER: at equal specificity
 * the later rule wins, so the pinned-cell cascade ("hover beats selected beats
 * plain") depends on the relative order of these rules in the stylesheet.
 */
const cssRuleIndex = (selectors: string[]): number => {
  const wanted = normalizeSelectorList(selectors)
  const rulePattern = /([^{}]+)\{([^{}]*)\}/g
  let index = 0
  let match: RegExpExecArray | null
  while ((match = rulePattern.exec(dataTableCss)) !== null) {
    if (normalizeSelectorList(match[1].split(',')) === wanted) return index
    index += 1
  }
  throw new Error(`CSS rule not found for selector: ${selectors.join(', ')}`)
}

describe('DataTable', () => {
  beforeEach(() => {
    stubDesktopMatchMedia()
    localStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders paired sort arrows and highlights the active direction', async () => {
    const wrapper = mount(DataTable, {
      props: {
        columns: [
          { key: 'name', label: 'Name', sortable: true },
          { key: 'created_at', label: 'Created', sortable: true }
        ],
        data: [
          { id: 1, name: 'Beta', created_at: '2026-01-02T00:00:00Z' },
          { id: 2, name: 'Alpha', created_at: '2026-01-01T00:00:00Z' }
        ],
        defaultSortKey: 'name',
        defaultSortOrder: 'asc'
      },
      slots: {
        'header-name': '<span data-test="custom-name-header">Name</span>'
      }
    })

    await wrapper.vm.$nextTick()

    const nameHeader = wrapper.findAll('th')[0]
    expect(nameHeader.find('[data-test="custom-name-header"]').exists()).toBe(true)
    expect(nameHeader.attributes('aria-sort')).toBe('ascending')
    expect(nameHeader.findAll('svg')).toHaveLength(2)
    expect(nameHeader.findAll('svg')[0].classes()).toContain('text-primary-600')
    expect(nameHeader.findAll('svg')[1].classes()).toContain('text-gray-300')

    await nameHeader.trigger('click')
    await wrapper.vm.$nextTick()

    expect(nameHeader.attributes('aria-sort')).toBe('descending')
    expect(nameHeader.findAll('svg')[0].classes()).toContain('text-gray-300')
    expect(nameHeader.findAll('svg')[1].classes()).toContain('text-primary-600')
  })

  it('renders every row with no virtual padding spacer for small datasets (virtualization off)', async () => {
    const data = Array.from({ length: 8 }, (_, i) => ({ id: i + 1, name: `Row ${i + 1}` }))
    const wrapper = mount(DataTable, {
      props: {
        columns: [{ key: 'name', label: 'Name' }],
        data
      }
    })

    await wrapper.vm.$nextTick()

    // Virtualization is OFF for a small list…
    expect((wrapper.vm as any).shouldVirtualize).toBe(false)
    // …every row is in the DOM…
    expect(wrapper.findAll('tbody tr[data-index]')).toHaveLength(data.length)
    // …and there are no aria-hidden virtual padding spacer rows.
    expect(wrapper.findAll('tbody tr[aria-hidden="true"]')).toHaveLength(0)
  })

  it('switches to windowed rendering once row count exceeds virtualizeThreshold', async () => {
    const data = Array.from({ length: 12 }, (_, i) => ({ id: i + 1, name: `Row ${i + 1}` }))
    const wrapper = mount(DataTable, {
      props: {
        columns: [{ key: 'name', label: 'Name' }],
        data,
        virtualizeThreshold: 3
      }
    })

    await wrapper.vm.$nextTick()

    // Virtualization is ON: the mode-switch decision flipped…
    expect((wrapper.vm as any).shouldVirtualize).toBe(true)
    // …and the virtualizer drives off the full row count.
    const exposed = (wrapper.vm as any).virtualizer
    const instance = exposed?.value ?? exposed
    expect(instance.options.count).toBe(data.length)
  })

  it('keys the virtualizer size cache by row identity, not index (avoids stale heights on sort/filter)', async () => {
    const data = Array.from({ length: 12 }, (_, i) => ({ id: 100 + i, name: `Row ${i + 1}` }))
    const wrapper = mount(DataTable, {
      props: {
        columns: [{ key: 'name', label: 'Name' }],
        data,
        rowKey: 'id',
        virtualizeThreshold: 3
      }
    })

    await wrapper.vm.$nextTick()

    const exposed = (wrapper.vm as any).virtualizer
    const instance = exposed?.value ?? exposed
    // getItemKey must resolve to the row's stable key (id), not the positional index.
    expect(instance.options.getItemKey(0)).toBe(100)
    expect(instance.options.getItemKey(5)).toBe(105)
  })

  it('clears stale row and element caches when pagination replaces the row ID set', async () => {
    const firstPage = Array.from({ length: 100 }, (_, i) => ({ id: i + 1, name: `First ${i + 1}` }))
    const secondPage = Array.from({ length: 100 }, (_, i) => ({ id: i + 101, name: `Second ${i + 1}` }))
    const wrapper = mount(DataTable, {
      props: {
        columns: [{ key: 'name', label: 'Name' }],
        data: firstPage,
        rowKey: 'id',
        virtualizeThreshold: 1
      }
    })

    await wrapper.vm.$nextTick()

    const exposed = (wrapper.vm as any).virtualizer
    const instance = exposed?.value ?? exposed
    const firstPageIDs = firstPage.map(row => row.id)
    ;(instance as any).itemSizeCache = new Map(firstPageIDs.map(id => [id, 156]))
    instance.elementsCache.clear()
    for (const id of firstPageIDs) {
      instance.elementsCache.set(id, document.createElement('tr'))
    }
    const measureElementSpy = vi.spyOn(instance, 'measureElement')

    await wrapper.setProps({ data: secondPage })
    await wrapper.vm.$nextTick()

    const sizeCache = (instance as any).itemSizeCache as Map<number, number>
    expect(sizeCache.size).toBeLessThanOrEqual(secondPage.length)
    expect(instance.elementsCache.size).toBeLessThanOrEqual(secondPage.length)
    expect(firstPageIDs.some(id => sizeCache.has(id))).toBe(false)
    expect(firstPageIDs.some(id => instance.elementsCache.has(id))).toBe(false)
    expect(measureElementSpy.mock.calls.some(([node]) => node === null)).toBe(true)
  })

  it('clears stale caches when equal-length pages replace rows without stable keys', async () => {
    const firstPage = Array.from({ length: 12 }, (_, i) => ({ name: `First ${i + 1}` }))
    const secondPage = Array.from({ length: 12 }, (_, i) => ({ name: `Second ${i + 1}` }))
    const wrapper = mount(DataTable, {
      props: {
        columns: [{ key: 'name', label: 'Name' }],
        data: firstPage,
        virtualizeThreshold: 1
      }
    })

    await wrapper.vm.$nextTick()

    const exposed = (wrapper.vm as any).virtualizer
    const instance = exposed?.value ?? exposed
    const measureElementSpy = vi.spyOn(instance, 'measureElement')

    await wrapper.setProps({ data: secondPage })
    await wrapper.vm.$nextTick()

    expect(measureElementSpy.mock.calls.some(([node]) => node === null)).toBe(true)
  })

  it('conservatively clears caches when duplicate row-key multiplicity changes', async () => {
    const firstPage = [
      { id: 1, name: 'First A' },
      { id: 1, name: 'First B' },
      { id: 2, name: 'First C' }
    ]
    const secondPage = [
      { id: 1, name: 'Second A' },
      { id: 2, name: 'Second B' },
      { id: 2, name: 'Second C' }
    ]
    const wrapper = mount(DataTable, {
      props: {
        columns: [{ key: 'name', label: 'Name' }],
        data: firstPage,
        rowKey: 'id',
        virtualizeThreshold: 1
      }
    })

    await wrapper.vm.$nextTick()

    const exposed = (wrapper.vm as any).virtualizer
    const instance = exposed?.value ?? exposed
    const measureElementSpy = vi.spyOn(instance, 'measureElement')

    await wrapper.setProps({ data: secondPage })
    await wrapper.vm.$nextTick()

    expect(measureElementSpy.mock.calls.some(([node]) => node === null)).toBe(true)
  })

  it('preserves cache when rows without stable keys only reorder the same objects', async () => {
    const data = Array.from({ length: 12 }, (_, i) => ({ name: `Row ${i + 1}` }))
    const wrapper = mount(DataTable, {
      props: {
        columns: [{ key: 'name', label: 'Name' }],
        data,
        virtualizeThreshold: 1
      }
    })

    await wrapper.vm.$nextTick()

    const exposed = (wrapper.vm as any).virtualizer
    const instance = exposed?.value ?? exposed
    const measureSpy = vi.spyOn(instance, 'measure')

    await wrapper.setProps({ data: [...data].reverse() })
    await wrapper.vm.$nextTick()

    expect(measureSpy).not.toHaveBeenCalled()
  })

  it('preserves stable row height cache when the same row IDs are only reordered', async () => {
    const data = Array.from({ length: 100 }, (_, i) => ({ id: i + 1, name: `Row ${i + 1}` }))
    const wrapper = mount(DataTable, {
      props: {
        columns: [{ key: 'name', label: 'Name' }],
        data,
        rowKey: 'id',
        virtualizeThreshold: 1
      }
    })

    await wrapper.vm.$nextTick()

    const exposed = (wrapper.vm as any).virtualizer
    const instance = exposed?.value ?? exposed
    ;(instance as any).itemSizeCache = new Map(data.map(row => [row.id, 156]))
    const measureSpy = vi.spyOn(instance, 'measure')

    await wrapper.setProps({ data: [...data].reverse() })
    await wrapper.vm.$nextTick()

    const sizeCache = (instance as any).itemSizeCache as Map<number, number>
    expect(measureSpy).not.toHaveBeenCalled()
    expect(sizeCache.size).toBe(100)
  })

  it('emits controlled current-page selection while preserving off-page keys', async () => {
    const wrapper = mount(DataTable, {
      props: {
        columns: [{ key: 'name', label: 'Name' }],
        data: [
          { id: 1, name: 'One' },
          { id: 2, name: 'Two' }
        ],
        rowKey: 'id',
        selectable: true,
        selectedKeys: [99]
      }
    })

    await wrapper.get('[data-test="select-all"]').setValue(true)

    const selectedAll = wrapper.emitted('update:selectedKeys')?.at(-1)?.[0]
    expect(selectedAll).toEqual([99, 1, 2])

    await wrapper.setProps({ selectedKeys: selectedAll as number[] })
    const rowCheckboxes = wrapper.findAll<HTMLInputElement>('[data-test="select-row"]')
    expect(rowCheckboxes.every((checkbox) => checkbox.element.checked)).toBe(true)

    await rowCheckboxes[0].setValue(false)

    expect(wrapper.emitted('update:selectedKeys')?.at(-1)?.[0]).toEqual([99, 2])
    expect(wrapper.emitted('selectionChange')?.at(-1)?.[0]).toEqual([99, 2])
  })

  it('keeps the single usage field shrinkable in a 320px mobile card', () => {
    stubMobileMatchMedia()
    const viewport = document.createElement('div')
    viewport.style.width = '320px'
    document.body.appendChild(viewport)
    const wrapper = mount(DataTable, {
      attachTo: viewport,
      props: {
        columns: [{ key: 'usage', label: 'Usage' }],
        data: [{ id: 1, usage: 'snapshot' }],
        rowKey: 'id'
      },
      slots: {
        'cell-usage': '<div data-test="usage-cell">snapshot</div>'
      }
    })

    expect(viewport.style.width).toBe('320px')
    expect(wrapper.findAll('[data-field="usage"]')).toHaveLength(1)
    expect(wrapper.find('[data-field="ollama_cloud_usage"]').exists()).toBe(false)
    const field = wrapper.get('[data-field="usage"]')
    expect(field.classes()).toContain('min-w-0')
    expect(field.get('div').classes()).toEqual(expect.arrayContaining(['min-w-0', 'max-w-full']))
    expect(wrapper.findAll('[data-test="usage-cell"]')).toHaveLength(1)

    wrapper.unmount()
    viewport.remove()
  })

  it('offers current-page select all in the mobile card layout', async () => {
    stubMobileMatchMedia()
    const wrapper = mount(DataTable, {
      props: {
        columns: [{ key: 'name', label: 'Name' }],
        data: [
          { id: 1, name: 'One' },
          { id: 2, name: 'Two' }
        ],
        rowKey: 'id',
        selectable: true,
        selectedKeys: [99]
      }
    })

    await wrapper.get('[data-test="select-all-mobile"]').setValue(true)

    expect(wrapper.emitted('update:selectedKeys')?.at(-1)?.[0]).toEqual([99, 1, 2])
  })

  // --- 固定列毛玻璃：横向滚动时固定列不得透出下层文字 ---

  it('marks the wrapper scrollable only once the table actually overflows horizontally', async () => {
    const wrapper = mount(DataTable, {
      props: {
        columns: [
          { key: 'name', label: 'Name' },
          { key: 'actions', label: 'Actions' }
        ],
        data: [{ id: 1, name: 'One' }],
        rowKey: 'id'
      },
      attachTo: document.body
    })

    await wrapper.vm.$nextTick()
    const wrapperEl = wrapper.get('.table-wrapper').element as HTMLElement

    // No overflow -> plain opaque pinned cells, no backdrop-filter cost.
    stubWrapperGeometry(wrapperEl, 500, 500)
    await wrapper.setProps({ data: [{ id: 1, name: 'One' }, { id: 2, name: 'Two' }] })
    // The re-measure watcher is post-flush AND awaits a tick of its own before
    // calling checkScrollable, so one tick is not enough to observe the result.
    await flushPromises()
    expect(wrapper.get('.table-wrapper').classes()).not.toContain('is-scrollable')

    // Overflow -> the glass material is gated on this class.
    stubWrapperGeometry(wrapperEl, 1200, 500)
    await wrapper.setProps({ data: [{ id: 1, name: 'One' }] })
    await flushPromises()
    expect(wrapper.get('.table-wrapper').classes()).toContain('is-scrollable')

    wrapper.unmount()
  })

  it('re-checks scrollability when content width changes without a data length change', async () => {
    // jsdom 的全局 ResizeObserver mock 从不回调。这里换成可捕获实例的桩，
    // 手动派发 RO 回调，模拟真实浏览器里 table 元素随内容变宽/变窄的尺寸变化。
    // 场景：同长度数据换宽内容、列宽变化、虚拟滚动窗口换入宽行——data.length 与
    // columnsSignature（只含 key:sortable）都不会变，wrapper 盒子尺寸也不动。
    const roInstances: Array<{ cb: ResizeObserverCallback; targets: Element[] }> = []
    class CapturingResizeObserver implements ResizeObserver {
      cb: ResizeObserverCallback
      targets: Element[] = []
      constructor(cb: ResizeObserverCallback) {
        this.cb = cb
        roInstances.push(this)
      }
      observe(target: Element) {
        this.targets.push(target)
      }
      unobserve() {}
      disconnect() {}
      takeRecords(): ResizeObserverEntry[] {
        return []
      }
    }
    vi.stubGlobal('ResizeObserver', CapturingResizeObserver as unknown as typeof ResizeObserver)

    const wrapper = mount(DataTable, {
      props: {
        columns: [
          { key: 'name', label: 'Name' },
          { key: 'actions', label: 'Actions' }
        ],
        data: [
          { id: 1, name: 'One' },
          { id: 2, name: 'Two' }
        ],
        rowKey: 'id'
      },
      attachTo: document.body
    })
    await wrapper.vm.$nextTick()
    await flushPromises()

    const wrapperEl = wrapper.get('.table-wrapper').element as HTMLElement
    const tableEl = wrapper.get('table').element as HTMLElement

    // 修复接线：wrapper 与内部 table 都被观察。
    const observedTargets = roInstances.flatMap((inst) => inst.targets)
    expect(observedTargets).toContain(wrapperEl)
    expect(observedTargets).toContain(tableEl)
    const tableObservers = roInstances.filter((inst) => inst.targets.includes(tableEl))
    expect(tableObservers.length).toBeGreaterThan(0)

    stubWrapperGeometry(wrapperEl, 500, 500)
    expect(wrapper.get('.table-wrapper').classes()).not.toContain('is-scrollable')

    // 内容变宽（长度不变）：table 元素 RO 回调 → 下一帧翻转成可滚动。
    stubWrapperGeometry(wrapperEl, 1600, 500)
    for (const inst of tableObservers) {
      inst.cb(
        [{ target: tableEl, contentRect: { width: 1600, height: 100 } } as ResizeObserverEntry],
        inst as unknown as ResizeObserver
      )
    }
    await rafFrame()
    await rafFrame()
    expect(wrapper.get('.table-wrapper').classes()).toContain('is-scrollable')

    // 内容缩回（长度不变）：同样通过 table RO 翻回 false，不留残留玻璃态。
    stubWrapperGeometry(wrapperEl, 500, 500)
    for (const inst of tableObservers) {
      inst.cb(
        [{ target: tableEl, contentRect: { width: 500, height: 100 } } as ResizeObserverEntry],
        inst as unknown as ResizeObserver
      )
    }
    await rafFrame()
    await rafFrame()
    expect(wrapper.get('.table-wrapper').classes()).not.toContain('is-scrollable')

    wrapper.unmount()
  })

  it('flags selected rows so pinned cells can layer the selection tint', async () => {
    const wrapper = mount(DataTable, {
      props: {
        columns: [{ key: 'name', label: 'Name' }],
        data: [
          { id: 1, name: 'One' },
          { id: 2, name: 'Two' }
        ],
        rowKey: 'id',
        selectable: true,
        selectedKeys: [1]
      }
    })

    await wrapper.vm.$nextTick()

    const rows = wrapper.findAll('tbody tr[data-index]')
    expect(rows[0].classes()).toContain('is-row-selected')
    expect(rows[1].classes()).not.toContain('is-row-selected')
  })

  it('stylesheet structure: pinned-cell state tints are layered overlays, never a base-color swap', () => {
    // STRUCTURE contract, not a rendering assertion: jsdom never applies stylesheets,
    // so this locks the rule bodies (background-image layering, no background-color
    // swap) plus the source order that makes the cascade come out right. Actual
    // rendering is covered by phase-b-qa/verify.py in a real browser.
    //
    // The original bug: hover swapped the opaque base out for translucent --fill,
    // so horizontally scrolled cells showed through the pinned column.
    const hover = cssRuleBody(['tbody tr:hover .sticky-col'])
    expect(hover).not.toMatch(/background-color\s*:/)
    expect(hover).toMatch(/background-image\s*:\s*linear-gradient\(/)

    // Every state tint must be layered, never a base swap.
    const tintSelectors = [
      'tbody tr.is-row-selected .sticky-col',
      'tbody tr.is-row-selected:hover .sticky-col'
    ]
    for (const selector of tintSelectors) {
      const body = cssRuleBody([selector])
      expect(body).not.toMatch(/background-color\s*:/)
      expect(body).toMatch(/background-image\s*:\s*linear-gradient\(/)
    }

    // Default (non-scrollable) pinned cells stay fully opaque.
    expect(cssRuleBody(['tbody .sticky-col'])).toMatch(/background-color\s*:\s*var\(--bg-elevated\)/)

    // Cascade order lock (jsdom cannot compute cascade; at equal specificity the
    // later source rule wins, so the "selected vs selected+hover" priority is a
    // source-order property): selected must come before selected+hover, and the
    // opaque base before the .is-scrollable glass override.
    const selectedIndex = cssRuleIndex(['tbody tr.is-row-selected .sticky-col'])
    expect(selectedIndex).toBeLessThan(
      cssRuleIndex(['tbody tr.is-row-selected:hover .sticky-col'])
    )
    expect(cssRuleIndex(['tbody .sticky-col'])).toBeLessThan(
      cssRuleIndex([
        '.is-scrollable .sticky-header-cell.sticky-col',
        '.is-scrollable tbody .sticky-col'
      ])
    )
  })

  it('stylesheet structure: glass material is gated on .is-scrollable with token floors and opaque fallbacks', () => {
    // STRUCTURE contract (see previous test): locks the rule bodies and the token
    // floors the design decision pinned down. Whether the blur actually renders
    // (and how it composites) is verified by phase-b-qa/verify.py and the
    // audit_diff Chromium probe, not by this jsdom test.
    const glass = cssRuleBody([
      '.is-scrollable .sticky-header-cell.sticky-col',
      '.is-scrollable tbody .sticky-col'
    ])
    // Both header/body pinned cells get a translucent base plus a strong blur…
    expect(glass).toMatch(/background-color\s*:\s*var\(--sticky-glass-bg\)/)
    // …and Safari needs the -webkit- prefix alongside the standard property.
    expect(glass).toMatch(/(?<!-webkit-)backdrop-filter\s*:\s*var\(--sticky-glass-blur\)/)
    expect(glass).toMatch(/-webkit-backdrop-filter\s*:\s*var\(--sticky-glass-blur\)/)

    // "非常模糊": at or beyond the top bar's blur(20px).
    const blurToken = dataTableSource.match(/--sticky-glass-blur\s*:\s*([^;]+);/)?.[1] ?? ''
    const blurPx = Number(blurToken.match(/blur\((\d+(?:\.\d+)?)px\)/)?.[1] ?? 0)
    expect(blurPx).toBeGreaterThanOrEqual(20)

    // The translucent base must stay opaque enough to keep the cell's own text legible.
    const lightAlpha = Number(
      dataTableSource.match(/--sticky-glass-bg\s*:\s*rgba\([^)]*?,\s*([\d.]+)\)/)?.[1] ?? 0
    )
    expect(lightAlpha).toBeGreaterThanOrEqual(0.72)

    // Unsupported browsers fall back to a fully opaque pinned cell.
    expect(dataTableSource).toMatch(
      /@supports not \(\(backdrop-filter: blur\(1px\)\) or \(-webkit-backdrop-filter: blur\(1px\)\)\)/
    )
  })

  it('highlights slot-managed selection rows via highlightSelectedRows without selectable', async () => {
    // P2 gate fix: AccountsView renders its own select checkboxes through
    // header-select/cell-select slots and manages the selection set itself, so
    // `selectable` stays false. The row-selected tint must still follow
    // `selectedKeys` when the consumer opts in with highlightSelectedRows.
    const columns = [
      { key: 'select', label: '', sortable: false },
      { key: 'name', label: 'Name' }
    ]
    const data = [
      { id: 1, name: 'One' },
      { id: 2, name: 'Two' }
    ]

    const wrapper = mount(DataTable, {
      props: {
        columns,
        data,
        rowKey: 'id',
        highlightSelectedRows: true,
        selectedKeys: [1]
      },
      slots: {
        'header-select': '<input type="checkbox" />',
        'cell-select': '<input type="checkbox" />'
      }
    })

    await wrapper.vm.$nextTick()

    const rows = wrapper.findAll('tbody tr[data-index]')
    expect(rows[0].classes()).toContain('is-row-selected')
    expect(rows[0].classes()).toContain('bg-primary-50/40')
    expect(rows[1].classes()).not.toContain('is-row-selected')

    // Deselecting everything removes the tint (the gate is the membership
    // check, not the presence of the prop).
    await wrapper.setProps({ selectedKeys: [] })
    await wrapper.vm.$nextTick()
    expect(wrapper.findAll('tbody tr[data-index]')[0].classes()).not.toContain('is-row-selected')

    // Without the opt-in flag the old gate applies: no tint at all.
    const baseline = mount(DataTable, {
      props: {
        columns,
        data,
        rowKey: 'id',
        selectedKeys: [1]
      }
    })
    await baseline.vm.$nextTick()
    expect(baseline.findAll('tbody tr[data-index]')[0].classes()).not.toContain('is-row-selected')

    wrapper.unmount()
    baseline.unmount()
  })

  it('highlights slot-managed selection on mobile cards via highlightSelectedRows', async () => {
    stubMobileMatchMedia()
    const wrapper = mount(DataTable, {
      props: {
        columns: [
          { key: 'select', label: '', sortable: false },
          { key: 'name', label: 'Name' }
        ],
        data: [
          { id: 1, name: 'One' },
          { id: 2, name: 'Two' }
        ],
        rowKey: 'id',
        highlightSelectedRows: true,
        selectedKeys: [2]
      }
    })

    await wrapper.vm.$nextTick()

    const cards = wrapper.findAll('.mobile-card')
    expect(cards[0].classes()).not.toContain('bg-primary-50/40')
    expect(cards[1].classes()).toContain('bg-primary-50/40')
    expect(cards[1].classes()).toContain('border-primary-300')

    wrapper.unmount()
  })

  it('makes sortable header cells keyboard focusable and Enter/Space toggles the sort', async () => {
    const wrapper = mount(DataTable, {
      props: {
        columns: [
          { key: 'name', label: 'Name', sortable: true },
          { key: 'created_at', label: 'Created' }
        ],
        data: [
          { id: 1, name: 'Beta', created_at: '2026-01-02T00:00:00Z' },
          { id: 2, name: 'Alpha', created_at: '2026-01-01T00:00:00Z' }
        ],
        defaultSortKey: 'name',
        defaultSortOrder: 'asc'
      }
    })

    await wrapper.vm.$nextTick()

    const ths = wrapper.findAll('th')
    const sortableTh = ths[0]
    const plainTh = ths[1]

    // Only sortable headers enter the tab sequence.
    expect(sortableTh.attributes('tabindex')).toBe('0')
    expect(plainTh.attributes('tabindex')).toBeUndefined()
    expect(sortableTh.attributes('aria-sort')).toBe('ascending')

    // Enter flips ascending -> descending, exactly like a click.
    await sortableTh.trigger('keydown', { key: 'Enter' })
    await wrapper.vm.$nextTick()
    expect(sortableTh.attributes('aria-sort')).toBe('descending')

    // Space flips descending -> ascending.
    await sortableTh.trigger('keydown', { key: ' ' })
    await wrapper.vm.$nextTick()
    expect(sortableTh.attributes('aria-sort')).toBe('ascending')

    // Non-Enter/Space keys never sort.
    await sortableTh.trigger('keydown', { key: 'ArrowDown' })
    await wrapper.vm.$nextTick()
    expect(sortableTh.attributes('aria-sort')).toBe('ascending')

    // Focus-visible affordance classes are present on the sortable header.
    expect(sortableTh.classes()).toEqual(expect.arrayContaining([
      'focus-visible:ring-2',
      'focus-visible:ring-primary-500'
    ]))
    expect(plainTh.classes()).not.toEqual(expect.arrayContaining(['focus-visible:ring-2']))
  })

  it('iron rule 3: flex/grid display classes never land on th, only on the inner wrapper div', () => {
    // The pinned-header cells must keep display:table-cell; any flex/grid
    // display class directly on the th would override it and break table
    // layout. The audit checks this at runtime; here we lock the template
    // structure so a future refactor cannot regress it silently.
    const thOpenTags = [...dataTableSource.matchAll(/<th[^>]*>/g)].map(m => m[0])
    expect(thOpenTags.length).toBeGreaterThan(0)
    for (const tag of thOpenTags) {
      const classes = [...tag.matchAll(/class="([^"]*)"/g)].map(m => m[1].split(/\s+/)).flat()
      const displayClass = classes.find(cls => cls === 'flex' || cls === 'grid' || cls.startsWith('flex-') || cls.startsWith('grid-'))
      expect(displayClass).toBeUndefined()
    }

    // The header content wrapper keeps the flex layout role inside the cell.
    expect(dataTableSource).toMatch(/<div :class="\['flex items-center space-x-1', getHeaderContentAlignmentClass/)
  })

  it('renders an sr-only caption only when tableCaption is provided', async () => {
    const base = {
      columns: [{ key: 'name', label: 'Name' }],
      data: [{ id: 1, name: 'One' }],
      rowKey: 'id'
    }

    const withCaption = mount(DataTable, {
      props: { ...base, tableCaption: 'Account Management' }
    })
    await withCaption.vm.$nextTick()
    const caption = withCaption.get('caption')
    expect(caption.classes()).toContain('sr-only')
    expect(caption.text()).toBe('Account Management')
    withCaption.unmount()

    const withoutCaption = mount(DataTable, { props: base })
    await withoutCaption.vm.$nextTick()
    expect(withoutCaption.find('caption').exists()).toBe(false)
    withoutCaption.unmount()
  })
})
