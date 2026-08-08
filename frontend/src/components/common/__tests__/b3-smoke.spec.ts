import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'

import Input from '../Input.vue'
import TextArea from '../TextArea.vue'
import Toggle from '../Toggle.vue'
import Pagination from '../Pagination.vue'
import BaseDialog from '../BaseDialog.vue'
import ConfirmDialog from '../ConfirmDialog.vue'
import EmptyState from '../EmptyState.vue'
import StatCard from '../StatCard.vue'
import GroupBadge from '../GroupBadge.vue'
import StatusBadge from '../StatusBadge.vue'
import Skeleton from '../Skeleton.vue'
import Toast from '../Toast.vue'
import SearchInput from '../SearchInput.vue'
import ExportProgressDialog from '../ExportProgressDialog.vue'

const appStoreMock = vi.hoisted(() => ({
  toasts: [] as Array<Record<string, unknown>>,
  hideToast: vi.fn(),
}))

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return {
    ...actual,
    useI18n: () => ({ t: (key: string) => key }),
  }
})

vi.mock('@/stores/app', () => ({
  useAppStore: () => appStoreMock,
}))

vi.mock('@/utils/tablePreferences', () => ({
  getConfiguredTablePageSizeOptions: () => [10, 20, 50],
  normalizeTablePageSize: (n: number) => n,
}))

vi.mock('@/composables/usePersistedPageSize', () => ({
  setPersistedPageSize: vi.fn(),
}))

describe('B3 smoke', () => {
  it('Input keeps label, error state and exposed focus/select', async () => {
    const wrapper = mount(Input, {
      props: { modelValue: 'abc', label: 'Name', required: true, error: 'bad' },
      global: { stubs: { Icon: true } },
    })
    expect(wrapper.text()).toContain('Name')
    expect(wrapper.text()).toContain('bad')
    expect(wrapper.find('input').classes()).toContain('input-error')
    expect(typeof (wrapper.vm as any).focus).toBe('function')
    expect(typeof (wrapper.vm as any).select).toBe('function')
    await wrapper.find('input').setValue('xyz')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['xyz'])
  })

  it('TextArea exposes focus/select and emits update', async () => {
    const wrapper = mount(TextArea, {
      props: { modelValue: 'hi', label: 'Bio' },
      global: { stubs: { Icon: true } },
    })
    expect(typeof (wrapper.vm as any).focus).toBe('function')
    await wrapper.find('textarea').setValue('yo')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['yo'])
  })

  it('Toggle is a real switch button that toggles on click', async () => {
    const wrapper = mount(Toggle, { props: { modelValue: false } })
    const btn = wrapper.get('button')
    expect(btn.attributes('role')).toBe('switch')
    expect(btn.attributes('aria-checked')).toBe('false')
    await btn.trigger('click')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([true])
    await wrapper.setProps({ modelValue: true })
    expect(wrapper.get('button').classes()).toContain('on')
  })

  it('Pagination emits page updates and renders pager buttons', async () => {
    const wrapper = mount(Pagination, {
      props: { total: 100, page: 2, pageSize: 10 },
      global: { stubs: { Select: true, Icon: true } },
    })
    expect(wrapper.findAll('.pager-btn').length).toBeGreaterThan(2)
    await wrapper.findAll('.pager-btn')[1].trigger('click')
    await nextTick()
    expect(wrapper.emitted('update:page')).toBeDefined()
  })

  it('BaseDialog renders panel, locks scroll, closes on Escape', async () => {
    const wrapper = mount(BaseDialog, {
      props: { show: true, title: 'Hello' },
      slots: { default: '<p>body</p>' },
      attachTo: document.body,
      global: { stubs: { Icon: true } },
    })
    await nextTick()
    expect(document.body.textContent).toContain('Hello')
    expect(document.body.textContent).toContain('body')
    expect(document.body.classList.contains('modal-open')).toBe(true)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(wrapper.emitted('close')).toHaveLength(1)
    await wrapper.setProps({ show: false })
    expect(document.body.classList.contains('modal-open')).toBe(false)
    wrapper.unmount()
    document.body.innerHTML = ''
  })

  it('ConfirmDialog wires confirm/cancel buttons', async () => {
    const wrapper = mount(ConfirmDialog, {
      props: { show: true, title: 'Sure?', message: 'really', danger: true },
      global: { stubs: { BaseDialog: false, Icon: true } },
    })
    await nextTick()
    expect(document.body.textContent).toContain('really')
    const buttons = document.body.querySelectorAll('button')
    buttons[buttons.length - 1].click()
    expect(wrapper.emitted('confirm')).toHaveLength(1)
    wrapper.unmount()
    document.body.innerHTML = ''
  })

  it('EmptyState renders title/description/action and emits action', async () => {
    const wrapper = mount(EmptyState, {
      props: { title: 'Nothing', description: 'Empty here', actionText: 'Go' },
      global: { stubs: { Icon: true } },
    })
    expect(wrapper.text()).toContain('Nothing')
    expect(wrapper.text()).toContain('Empty here')
    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('action')).toHaveLength(1)
  })

  it('StatCard renders value, trend and tint classes', () => {
    const wrapper = mount(StatCard, {
      props: { title: 'Keys', value: 4, change: 12, changeType: 'up', iconVariant: 'success' },
      global: { stubs: { Icon: true } },
    })
    expect(wrapper.text()).toContain('Keys')
    expect(wrapper.text()).toContain('4')
    expect(wrapper.find('.stat-icon').classes()).toContain('tint-green')
    expect(wrapper.find('.stat-trend').classes()).toContain('stat-trend-up')
  })

  it('GroupBadge renders platform badge + rate label', () => {
    const wrapper = mount(GroupBadge, {
      props: { name: 'g1', platform: 'openai', rateMultiplier: 2 },
      global: { stubs: { PlatformIcon: true } },
    })
    expect(wrapper.text()).toContain('g1')
    expect(wrapper.text()).toContain('2x')
    expect(wrapper.find('.badge').classes()).toContain('b-openai')
  })

  it('StatusBadge maps statuses to dot classes', () => {
    const wrapper = mount(StatusBadge, { props: { status: 'active', label: '正常' } })
    expect(wrapper.find('.dot').classes()).toContain('dot-active')
  })

  it('Skeleton accepts width/height and variant', () => {
    const wrapper = mount(Skeleton, { props: { variant: 'circle', width: 40, height: 40 } })
    const el = wrapper.element as HTMLElement
    expect(el.style.width).toBe('40px')
    expect(el.style.height).toBe('40px')
    expect(el.className).toContain('rounded-full')
  })

  it('Toast renders store toasts with semantic type', async () => {
    appStoreMock.toasts = [{ id: '1', type: 'success', title: 'OK', message: 'done', duration: 0 }]
    mount(Toast, { global: { stubs: { Icon: true } }, attachTo: document.body })
    await nextTick()
    const toast = document.body.querySelector('.toast')
    expect(toast?.textContent).toContain('OK')
    expect(toast?.classList.contains('toast-success')).toBe(true)
    document.body.innerHTML = ''
  })

  it('SearchInput debounces search emit', async () => {
    vi.useFakeTimers()
    const wrapper = mount(SearchInput, {
      props: { modelValue: '' },
      global: { stubs: { Icon: true } },
    })
    await wrapper.find('input').setValue('a')
    vi.advanceTimersByTime(400)
    expect(wrapper.emitted('search')?.[0]).toEqual(['a'])
    vi.useRealTimers()
  })

  it('ExportProgressDialog shows normalized progress', () => {
    mount(ExportProgressDialog, {
      props: { show: true, progress: 45.6, current: 4, total: 10, estimatedTime: '5s' },
      global: { stubs: { BaseDialog: false, Icon: true } },
      attachTo: document.body,
    })
    expect(document.body.textContent).toContain('46%')
    document.body.innerHTML = ''
  })
})
