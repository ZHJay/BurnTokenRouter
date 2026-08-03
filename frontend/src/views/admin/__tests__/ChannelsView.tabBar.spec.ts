/**
 * Behaviour spec for the channel dialog's tab bar (ChannelsView ~154).
 *
 * Started life as a characterization spec written BEFORE this control was
 * migrated to the shared `Segmented`, which is why it is this thorough: the bar
 * is the riskiest one in the set because its segment set is DYNAMIC — "basic"
 * plus one tab per ENABLED platform — and disabling the active platform has to
 * walk the selection back to "basic".
 *
 * Everything below survived the migration untouched except the last test. The
 * bar used to carry a bespoke `channel-tab` + `channel-tab-active` /
 * `channel-tab-inactive` pair backed by scoped CSS drawing a `border-b-2`
 * UNDERLINE, so "the unselected segment gets a class too" was load bearing and
 * was asserted here. `Segmented` marks selection with a moving thumb instead and
 * those three classes are gone (their CSS with them), so that test now asserts
 * the contract that actually holds: the shared `segmented-item` class on every
 * segment, `aria-selected` on both the selected and the unselected ones, and a
 * real thumb element.
 *
 * The assertions are otherwise about semantics and behaviour: roles,
 * aria-selected, which panel is visible, what happens when the set shrinks.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent } from 'vue'

const { channelsList, groupsGetAll, accountsList, getWebSearchEmulationConfig } = vi.hoisted(() => ({
  channelsList: vi.fn(),
  groupsGetAll: vi.fn(),
  accountsList: vi.fn(),
  getWebSearchEmulationConfig: vi.fn(),
}))

vi.mock('@/api/admin', () => ({
  adminAPI: {
    channels: {
      list: channelsList,
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      syncPricingModels: vi.fn(),
    },
    groups: { getAll: groupsGetAll },
    accounts: { list: accountsList },
    settings: { getWebSearchEmulationConfig },
  },
}))

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>()
  return {
    ...actual,
    useI18n: () => ({ t: (key: string, fallback?: unknown) => (typeof fallback === 'string' ? fallback : key) }),
  }
})

import ChannelsView from '../ChannelsView.vue'

const BaseDialogStub = defineComponent({
  props: { show: { type: Boolean, default: false } },
  template: '<div v-if="show"><slot /><slot name="footer" /></div>',
})

const PassthroughStub = defineComponent({
  template: '<div><slot /><slot name="pagination" /></div>',
})

interface ChannelsVm {
  showDialog: boolean
  activeTab: string
  form: { platforms: { platform: string; enabled: boolean }[] }
  togglePlatform: (platform: string) => void
}

async function mountWithDialog() {
  const wrapper = mount(ChannelsView, {
    global: {
      stubs: {
        AppLayout: PassthroughStub,
        TablePageLayout: PassthroughStub,
        DataTable: true,
        Pagination: true,
        BaseDialog: BaseDialogStub,
        ConfirmDialog: true,
        EmptyState: true,
        Select: true,
        Icon: true,
        PlatformIcon: true,
        Toggle: true,
        PricingEntryCard: true,
      },
    },
    attachTo: document.body,
  })
  await flushPromises()

  const vm = wrapper.vm as unknown as ChannelsVm
  vm.showDialog = true
  // Two enabled platforms so the bar has three segments: basic + anthropic + openai.
  vm.togglePlatform('anthropic')
  vm.togglePlatform('openai')
  await flushPromises()
  return wrapper
}

function tabBar(wrapper: Awaited<ReturnType<typeof mountWithDialog>>) {
  return wrapper.get('[role="tablist"]')
}

function tabs(wrapper: Awaited<ReturnType<typeof mountWithDialog>>) {
  return tabBar(wrapper).findAll('[role="tab"]')
}

describe('ChannelsView dialog tab bar', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    channelsList.mockReset().mockResolvedValue({ channels: [], total: 0, page: 1, page_size: 20 })
    groupsGetAll.mockReset().mockResolvedValue([])
    accountsList.mockReset().mockResolvedValue({ accounts: [], total: 0 })
    getWebSearchEmulationConfig.mockReset().mockResolvedValue({})
  })

  it('renders one tab per enabled platform plus basic, with basic selected', async () => {
    const wrapper = await mountWithDialog()

    const rendered = tabs(wrapper)
    expect(rendered).toHaveLength(3)
    expect(rendered[0].attributes('aria-selected')).toBe('true')
    expect(rendered[1].attributes('aria-selected')).toBe('false')
    expect(rendered[2].attributes('aria-selected')).toBe('false')
    // Panel switching, so aria-checked must not appear.
    expect(rendered.every((tab) => tab.attributes('aria-checked') === undefined)).toBe(true)
    expect(tabBar(wrapper).attributes('aria-label')).toBeTruthy()

    wrapper.unmount()
  })

  it('switches the visible panel on a single click and back again', async () => {
    const wrapper = await mountWithDialog()
    const vm = wrapper.vm as unknown as ChannelsVm

    await tabs(wrapper)[1].trigger('click')
    await flushPromises()

    // One click, one switch: a control firing on pointerdown AND click would
    // land back where it started.
    expect(vm.activeTab).toBe('anthropic')
    expect(tabs(wrapper)[1].attributes('aria-selected')).toBe('true')
    expect(tabs(wrapper)[0].attributes('aria-selected')).toBe('false')

    await tabs(wrapper)[0].trigger('click')
    await flushPromises()

    expect(vm.activeTab).toBe('basic')

    wrapper.unmount()
  })

  it('re-clicking the active tab is a no-op', async () => {
    const wrapper = await mountWithDialog()
    const vm = wrapper.vm as unknown as ChannelsVm

    await tabs(wrapper)[0].trigger('click')
    await flushPromises()

    expect(vm.activeTab).toBe('basic')
    expect(tabs(wrapper)[0].attributes('aria-selected')).toBe('true')

    wrapper.unmount()
  })

  it('walks the selection back to basic when the active platform is disabled', async () => {
    const wrapper = await mountWithDialog()
    const vm = wrapper.vm as unknown as ChannelsVm

    await tabs(wrapper)[2].trigger('click')
    await flushPromises()
    expect(vm.activeTab).toBe('openai')

    // Disabling the platform removes its tab; leaving activeTab pointing at a
    // segment that no longer exists would render a dialog with no visible panel.
    vm.togglePlatform('openai')
    await flushPromises()

    expect(vm.activeTab).toBe('basic')
    expect(tabs(wrapper)).toHaveLength(2)
    expect(tabs(wrapper)[0].attributes('aria-selected')).toBe('true')

    wrapper.unmount()
  })

  it('marks every segment as a Segmented item, both states via aria-selected, and renders the thumb', async () => {
    const wrapper = await mountWithDialog()

    const rendered = tabs(wrapper)
    // The shared class is what makes the thumb's stacking and the z-index/colour
    // rules apply; a segment rendered without it would be painted over.
    expect(rendered.every((tab) => tab.classes().includes('segmented-item'))).toBe(true)
    // Both states are explicit. Selection is no longer "one class present, one
    // absent" — it is an attribute that every segment carries with a value, so
    // assistive tech announces unselected tabs as unselected rather than as
    // stateless.
    expect(rendered[0].attributes('aria-selected')).toBe('true')
    expect(rendered[1].attributes('aria-selected')).toBe('false')

    // The thumb replaces the old active/inactive class pair: selection is now
    // painted by a real element that travels, so its existence IS the state
    // indicator. `v-show`, so being present and not display:none also proves
    // activeTab resolved to a segment that exists (a typo'd default would hide
    // it and leave the dialog with no visible selection).
    const thumb = tabBar(wrapper).get('.segmented-thumb')
    expect((thumb.element as HTMLElement).style.display).not.toBe('none')

    // NOT asserted here: the thumb's inline transform/width. jsdom has no
    // layout, so those come out 0 unless Segmented's `measure` seam is injected,
    // and that seam is not reachable from this mount — ChannelsView does not
    // forward it, and by design should not: the prop's doc comment rejects
    // pushing layout measurement onto all 19 call sites for the test suite's
    // benefit. Geometry is pinned where the seam is wired, in
    // components/common/__tests__/Segmented.spec.ts ("thumb geometry").

    wrapper.unmount()
  })
})
