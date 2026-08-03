/**
 * Characterization spec for the create-proxy mode tablist (ProxiesView ~383).
 *
 * Written BEFORE that tablist was migrated onto the shared `Segmented`
 * component, and required to pass identically after. There was no coverage of
 * this control at all, and it gates which form the dialog renders — the wrong
 * tab means the wrong submit button and the wrong create call, so a silent
 * regression here is a functional bug rather than a cosmetic one.
 *
 * What is pinned:
 *  - the ARIA state matrix (tablist / tab / aria-selected), not class strings,
 *  - that activating a segment swaps the rendered form AND the footer's submit
 *    control, which is the behaviour a user actually depends on,
 *  - that a single `click` is enough to switch (the suite dispatches click only,
 *    and `Segmented` also listens on pointerdown, so a double-activation would
 *    show up as a mode that flips back or a duplicated emit),
 *  - that the track keeps `shrink-0` so the row does not squash the segments.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent } from 'vue'

const { list, getAllWithCount } = vi.hoisted(() => ({
  list: vi.fn(),
  getAllWithCount: vi.fn(),
}))

// Partial mock: `@/stores/app` imports `@/i18n`, which calls the real
// `createI18n` at module scope, so a bare object mock would break the store.
vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return {
    ...actual,
    useI18n: () => ({ t: (key: string) => key, locale: { value: 'en' } }),
  }
})

vi.mock('@/api/admin', () => ({
  adminAPI: {
    proxies: {
      list,
      getAllWithCount,
      create: vi.fn(),
      batchCreate: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      batchDelete: vi.fn(),
      testProxy: vi.fn(),
      checkProxyQuality: vi.fn(),
      exportData: vi.fn(),
      getProxyAccounts: vi.fn(),
    },
  },
}))

import ProxiesView from '../ProxiesView.vue'

/** Renders every slot so the dialog body and footer are both reachable. */
const BaseDialogStub = defineComponent({
  props: { show: { type: Boolean, default: false } },
  template: '<div v-if="show"><slot /><slot name="footer" /></div>',
})

const PassthroughStub = defineComponent({
  template: '<div><slot /><slot name="pagination" /></div>',
})

async function mountView() {
  const wrapper = mount(ProxiesView, {
    global: {
      stubs: {
        AppLayout: PassthroughStub,
        TablePageLayout: PassthroughStub,
        DataTable: true,
        Pagination: true,
        BaseDialog: BaseDialogStub,
        ConfirmDialog: true,
        EmptyState: true,
        ImportDataModal: true,
        Select: true,
        ProxyAdBanner: true,
        PlatformTypeBadge: true,
        Icon: true,
      },
    },
    attachTo: document.body,
  })
  await flushPromises()

  // The tablist only exists inside the create dialog.
  ;(wrapper.vm as unknown as { showCreateModal: boolean }).showCreateModal = true
  await flushPromises()
  return wrapper
}

function modeTabs(wrapper: Awaited<ReturnType<typeof mountView>>) {
  return wrapper.get('[role="tablist"]').findAll('[role="tab"]')
}

describe('ProxiesView create-mode tablist', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    list.mockReset().mockResolvedValue({ proxies: [], total: 0, page: 1, page_size: 20 })
    getAllWithCount.mockReset().mockResolvedValue([])
  })

  it('exposes standard/batch as a two-tab tablist with the standard tab selected', async () => {
    const wrapper = await mountView()

    const tabs = modeTabs(wrapper)
    expect(tabs).toHaveLength(2)
    expect(tabs[0].attributes('aria-selected')).toBe('true')
    expect(tabs[1].attributes('aria-selected')).toBe('false')
    // Panel-switching semantics, so aria-checked would be a contradiction here.
    expect(tabs[0].attributes('aria-checked')).toBeUndefined()
    expect(tabs[0].text()).toContain('admin.proxies.standardAdd')
    expect(tabs[1].text()).toContain('admin.proxies.batchAdd')

    wrapper.unmount()
  })

  it('switches the rendered form and the footer submit control on a single click', async () => {
    const wrapper = await mountView()

    // Standard mode: a real <form> the footer submits by id.
    expect(wrapper.find('form#create-proxy-form').exists()).toBe(true)
    expect(wrapper.find('button[form="create-proxy-form"]').exists()).toBe(true)

    await modeTabs(wrapper)[1].trigger('click')
    await flushPromises()

    // One click, one switch. Landing back on 'standard' would mean the control
    // fired twice (pointerdown + click) and toggled itself back.
    expect((wrapper.vm as unknown as { createMode: string }).createMode).toBe('batch')
    expect(wrapper.find('form#create-proxy-form').exists()).toBe(false)
    expect(wrapper.find('button[form="create-proxy-form"]').exists()).toBe(false)

    const tabsAfter = modeTabs(wrapper)
    expect(tabsAfter[0].attributes('aria-selected')).toBe('false')
    expect(tabsAfter[1].attributes('aria-selected')).toBe('true')

    await tabsAfter[0].trigger('click')
    await flushPromises()

    expect((wrapper.vm as unknown as { createMode: string }).createMode).toBe('standard')
    expect(wrapper.find('form#create-proxy-form').exists()).toBe(true)

    wrapper.unmount()
  })

  it('re-clicking the active tab leaves the mode and the form alone', async () => {
    const wrapper = await mountView()

    await modeTabs(wrapper)[0].trigger('click')
    await flushPromises()

    expect((wrapper.vm as unknown as { createMode: string }).createMode).toBe('standard')
    expect(wrapper.find('form#create-proxy-form').exists()).toBe(true)

    wrapper.unmount()
  })

  it('keeps the track from shrinking so the segments do not wrap in the dialog header row', async () => {
    const wrapper = await mountView()

    // `min-w-0 shrink-0` next to ProxyAdBanner: the banner may grow, the
    // segmented track may not be squashed by it.
    expect(wrapper.get('[role="tablist"]').classes()).toContain('shrink-0')

    wrapper.unmount()
  })
})
