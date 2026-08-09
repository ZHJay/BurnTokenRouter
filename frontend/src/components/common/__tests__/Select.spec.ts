import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import Select from '../Select.vue'

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return {
    ...actual,
    useI18n: () => ({ t: (key: string) => key }),
  }
})

const originalInnerWidth = window.innerWidth
let unmountWrapper: (() => void) | undefined

const setViewportWidth = (width: number) => {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    value: width,
  })
}

const mockTriggerRect = (left: number, width: number) => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    x: left,
    y: 20,
    top: 20,
    right: left + width,
    bottom: 60,
    left,
    width,
    height: 40,
    toJSON: () => ({}),
  })
}

const openSelect = async () => {
  const wrapper = mount(Select, {
    props: {
      modelValue: null,
      options: [
        {
          value: 'example',
          label: 'very-long-unbroken-option-value-that-must-not-overflow',
        },
      ],
    },
  })
  unmountWrapper = () => wrapper.unmount()

  await wrapper.get('button').trigger('click')
  await nextTick()

  return document.body.querySelector<HTMLElement>('.select-dropdown-portal')
}

/** Let the 0.2s leave transition finish removing the teleported panel (jsdom never fires transitionend). */
const settle = () => new Promise((resolve) => setTimeout(resolve, 300))

afterEach(() => {
  unmountWrapper?.()
  unmountWrapper = undefined
  document.body.innerHTML = ''
  setViewportWidth(originalInnerWidth)
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('Select dropdown viewport constraints', () => {
  it('preserves the existing 200px minimum width when space is available', async () => {
    setViewportWidth(1024)
    mockTriggerRect(20, 80)

    const dropdown = await openSelect()

    expect(dropdown).not.toBeNull()
    expect(dropdown?.style.left).toBe('20px')
    expect(dropdown?.style.minWidth).toBe('200px')
    expect(dropdown?.style.maxWidth).toBe('996px')
  })

  it('shrinks the minimum width to fit near the right viewport edge', async () => {
    setViewportWidth(320)
    mockTriggerRect(220, 80)

    const dropdown = await openSelect()

    expect(dropdown).not.toBeNull()
    expect(dropdown?.style.left).toBe('220px')
    expect(dropdown?.style.minWidth).toBe('92px')
    expect(dropdown?.style.maxWidth).toBe('92px')
  })

  it('clamps a trigger left of the viewport to the safe padding', async () => {
    setViewportWidth(320)
    mockTriggerRect(-20, 80)

    const dropdown = await openSelect()

    expect(dropdown).not.toBeNull()
    expect(dropdown?.style.left).toBe('8px')
    expect(dropdown?.style.minWidth).toBe('200px')
    expect(dropdown?.style.maxWidth).toBe('304px')
  })

  it('clamps an offscreen-right trigger position to the viewport boundary', async () => {
    setViewportWidth(320)
    mockTriggerRect(400, 80)

    const dropdown = await openSelect()

    expect(dropdown).not.toBeNull()
    expect(dropdown?.style.left).toBe('312px')
    expect(dropdown?.style.minWidth).toBe('0px')
    expect(dropdown?.style.maxWidth).toBe('0px')
  })
})

describe('Select remote search', () => {
  const mountRemoteSelect = (props: Record<string, unknown> = {}) => {
    const wrapper = mount(Select, {
      props: {
        modelValue: null,
        remote: true,
        options: [
          { value: 'alpha', label: 'Alpha account' },
          { value: 'beta', label: 'Beta account' },
        ],
        ...props,
      },
    })
    unmountWrapper = () => wrapper.unmount()
    return wrapper
  }

  const openDropdown = async () => {
    const dropdown = document.body.querySelector<HTMLElement>('.select-dropdown-portal')
    expect(dropdown).not.toBeNull()
    return dropdown as HTMLElement
  }

  const typeSearchQuery = async (query: string) => {
    const dropdown = await openDropdown()
    const input = dropdown.querySelector<HTMLInputElement>('.select-search-input')
    expect(input).not.toBeNull()
    input!.value = query
    input!.dispatchEvent(new Event('input'))
    await nextTick()
  }

  it('emits debounced search events and skips local filtering in remote mode', async () => {
    vi.useFakeTimers()
    const wrapper = mountRemoteSelect()
    await wrapper.get('button').trigger('click')
    await nextTick()

    await typeSearchQuery('zzz')

    // 防抖窗口内不触发。
    expect(wrapper.emitted('search')).toBeUndefined()
    await vi.advanceTimersByTimeAsync(300)

    expect(wrapper.emitted('search')).toEqual([['zzz']])
    // 远程模式不做本地过滤：无命中的 query 下选项仍完整展示（由父组件更新 options）。
    const dropdown = await openDropdown()
    const labels = [...dropdown.querySelectorAll('.select-option-label')].map((el) => el.textContent)
    expect(labels).toContain('Alpha account')
    expect(labels).toContain('Beta account')
  })

  it('does not emit search when the dropdown closes and the query resets', async () => {
    vi.useFakeTimers()
    const wrapper = mountRemoteSelect()
    await wrapper.get('button').trigger('click')
    await nextTick()

    await typeSearchQuery('hidden')

    // 关闭下拉：排队中的防抖定时器应被取消，也不应因 query 重置而尾随 emit。
    await wrapper.get('button').trigger('click')
    await nextTick()
    await vi.advanceTimersByTimeAsync(300)

    expect(wrapper.emitted('search')).toBeUndefined()
  })

  it('shows the loading text instead of empty text while loading with no options', async () => {
    const wrapper = mountRemoteSelect({ options: [], loading: true })
    await wrapper.get('button').trigger('click')
    await nextTick()

    const dropdown = await openDropdown()
    expect(dropdown.querySelector('.select-empty')?.textContent).toContain('common.loading')
  })

  it('keeps local filtering and emits nothing when remote is not set', async () => {
    vi.useFakeTimers()
    const wrapper = mount(Select, {
      props: {
        modelValue: null,
        searchable: true,
        options: [
          { value: 'alpha', label: 'Alpha account' },
          { value: 'beta', label: 'Beta account' },
        ],
      },
    })
    unmountWrapper = () => wrapper.unmount()
    await wrapper.get('button').trigger('click')
    await nextTick()

    await typeSearchQuery('alpha')
    await vi.advanceTimersByTimeAsync(300)

    expect(wrapper.emitted('search')).toBeUndefined()
    const dropdown = await openDropdown()
    const labels = [...dropdown.querySelectorAll('.select-option-label')].map((el) => el.textContent)
    expect(labels).toEqual(['Alpha account'])
  })
})

describe('Select trigger variant', () => {
  const mountSelect = (props: Record<string, unknown> = {}) => {
    const wrapper = mount(Select, {
      props: {
        modelValue: null,
        options: [{ value: 'a', label: 'A' }],
        ...props,
      },
    })
    unmountWrapper = () => wrapper.unmount()
    return wrapper
  }

  it('默认变体不带筛选栏类（表单内保持 44px + 发丝线）', () => {
    const trigger = mountSelect().get('button')

    expect(trigger.classes()).toContain('select-trigger')
    expect(trigger.classes()).not.toContain('select-trigger-filter')
  })

  it('variant="filter" 带上筛选栏类（与同排 SearchInput 同一控件族）', () => {
    const trigger = mountSelect({ variant: 'filter' }).get('button')

    expect(trigger.classes()).toContain('select-trigger')
    expect(trigger.classes()).toContain('select-trigger-filter')
  })

  it('筛选栏变体仍然保留错误态类', () => {
    const trigger = mountSelect({ variant: 'filter', error: true }).get('button')

    expect(trigger.classes()).toContain('select-trigger-filter')
    expect(trigger.classes()).toContain('select-trigger-error')
  })
})

describe('Select keyboard interaction (WAI-ARIA combobox)', () => {
  const smallOptions = [
    { value: 'a', label: 'A' },
    { value: 'b', label: 'B' },
    { value: 'c', label: 'C' },
    { value: 'd', label: 'D' },
    { value: 'e', label: 'E' }
  ]

  const mountSelect = (props: Record<string, unknown> = {}) => {
    const wrapper = mount(Select, {
      props: {
        modelValue: null,
        options: smallOptions,
        ...props
      },
      attachTo: document.body
    })
    unmountWrapper = () => wrapper.unmount()
    return wrapper
  }

  const openWithKeyboard = async (wrapper: ReturnType<typeof mountSelect>) => {
    const trigger = wrapper.get('button')
    trigger.element.focus()
    await trigger.trigger('keydown', { key: 'ArrowDown' })
    await nextTick()
    return trigger
  }

  const dropdown = () =>
    document.body.querySelector<HTMLElement>('.select-dropdown-portal')

  const focusedOption = () =>
    document.body.querySelector<HTMLElement>('.select-option-focused')

  it('非 searchable（≤5 选项）：触发钮是 combobox 宿主，方向键在触发钮上移动高亮', async () => {
    const wrapper = mountSelect()
    const trigger = await openWithKeyboard(wrapper)

    expect(trigger.attributes('role')).toBe('combobox')
    expect(trigger.attributes('aria-expanded')).toBe('true')
    expect(dropdown()?.getAttribute('role')).toBe('listbox')
    // 焦点留在触发钮（select-only combobox 模式）
    expect(document.activeElement).toBe(trigger.element)
    expect(trigger.attributes('aria-controls')).toBe(dropdown()?.id)
    expect(trigger.attributes('aria-activedescendant')).toBe(
      dropdown()?.querySelectorAll('[role="option"]')[0]?.id
    )

    expect(focusedOption()?.textContent).toContain('A')
    await trigger.trigger('keydown', { key: 'ArrowDown' })
    await nextTick()
    expect(focusedOption()?.textContent).toContain('B')
    expect(trigger.attributes('aria-activedescendant')).toBe(
      dropdown()?.querySelectorAll('[role="option"]')[1]?.id
    )
  })

  it('非 searchable：ArrowUp 也能移动，且高亮在首尾循环', async () => {
    const wrapper = mountSelect()
    const trigger = await openWithKeyboard(wrapper)

    // 从首项 ArrowUp 回绕到末项
    await trigger.trigger('keydown', { key: 'ArrowUp' })
    await nextTick()
    expect(focusedOption()?.textContent).toContain('E')

    // 从末项 ArrowDown 回绕回首项
    await trigger.trigger('keydown', { key: 'ArrowDown' })
    await nextTick()
    expect(focusedOption()?.textContent).toContain('A')
  })

  it('Home/End 跳到首/末选项', async () => {
    const wrapper = mountSelect()
    const trigger = await openWithKeyboard(wrapper)

    await trigger.trigger('keydown', { key: 'End' })
    await nextTick()
    expect(focusedOption()?.textContent).toContain('E')

    await trigger.trigger('keydown', { key: 'Home' })
    await nextTick()
    expect(focusedOption()?.textContent).toContain('A')
  })

  it('Enter 选中高亮项并关闭，焦点还给触发钮', async () => {
    const wrapper = mountSelect()
    const trigger = await openWithKeyboard(wrapper)

    await trigger.trigger('keydown', { key: 'ArrowDown' })
    await nextTick()
    await trigger.trigger('keydown', { key: 'Enter' })
    await nextTick()
    await settle()

    expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toBe('b')
    expect(wrapper.emitted('change')?.at(-1)?.[0]).toBe('b')
    expect(dropdown()).toBeNull()
    expect(document.activeElement).toBe(trigger.element)
  })

  it('Space 选中高亮项并关闭（select-only combobox）', async () => {
    const wrapper = mountSelect()
    const trigger = await openWithKeyboard(wrapper)

    await trigger.trigger('keydown', { key: ' ' })
    await nextTick()
    await settle()

    expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toBe('a')
    expect(dropdown()).toBeNull()
  })

  it('Escape 关闭并把焦点还给触发钮', async () => {
    const wrapper = mountSelect()
    const trigger = await openWithKeyboard(wrapper)

    await trigger.trigger('keydown', { key: 'Escape' })
    await nextTick()
    await settle()

    expect(dropdown()).toBeNull()
    expect(trigger.attributes('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(trigger.element)
  })

  it('searchable（>5 选项）：焦点进搜索框，搜索框是 combobox，activedescendant 跟随高亮', async () => {
    const wrapper = mountSelect({
      options: [
        ...smallOptions,
        { value: 'f', label: 'F' },
        { value: 'g', label: 'G' }
      ]
    })
    const trigger = wrapper.get('button')
    trigger.element.focus()
    await trigger.trigger('keydown', { key: 'ArrowDown' })
    await nextTick()
    await nextTick()

    const input = document.body.querySelector<HTMLInputElement>('.select-search-input')
    expect(input).not.toBeNull()
    expect(document.activeElement).toBe(input)
    expect(input?.getAttribute('role')).toBe('combobox')
    expect(input?.getAttribute('aria-controls')).toBe(dropdown()?.id)
    expect(input?.getAttribute('aria-activedescendant')).toBe(
      dropdown()?.querySelectorAll('[role="option"]')[0]?.id
    )
    // 触发钮不再是 activedescendant 宿主
    expect(trigger.attributes('aria-activedescendant')).toBeUndefined()

    input?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true })
    )
    await nextTick()
    expect(input?.getAttribute('aria-activedescendant')).toBe(
      dropdown()?.querySelectorAll('[role="option"]')[1]?.id
    )

    input?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
    )
    await nextTick()
    await settle()
    expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toBe('b')
    expect(dropdown()).toBeNull()
  })

  it('searchable：Space 在搜索框里输入字符而不是选中', async () => {
    const wrapper = mountSelect({
      options: [...smallOptions, { value: 'f', label: 'F' }]
    })
    const trigger = wrapper.get('button')
    trigger.element.focus()
    await trigger.trigger('keydown', { key: 'ArrowDown' })
    await nextTick()
    await nextTick()

    const input = document.body.querySelector<HTMLInputElement>('.select-search-input')!
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true })
    )
    await nextTick()
    // 不关闭、不选中，且查询框可以输入空格
    expect(dropdown()).not.toBeNull()
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    // 查询框仍然可以正常输入过滤
    input.value = 'b'
    input.dispatchEvent(new Event('input'))
    await nextTick()
    expect(
      document.body.querySelectorAll('.select-dropdown-portal [role="option"]').length
    ).toBe(1)
  })

  it('选项带稳定唯一 id；组头不渲染成 option', async () => {
    const wrapper = mountSelect({
      options: [
        { value: 'g', label: 'Group', kind: 'group', disabled: true },
        { value: 'a', label: 'A' }
      ]
    })
    await openWithKeyboard(wrapper)

    const options = [...(dropdown()?.querySelectorAll('[role="option"]') ?? [])]
    expect(options.length).toBe(1)
    expect(options[0]?.textContent).toContain('A')

    const groupHeader = dropdown()?.querySelector('.select-option-group')
    expect(groupHeader?.getAttribute('role')).toBe('presentation')

    const ids = [...(dropdown()?.querySelectorAll('[id]') ?? [])].map((el) => el.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('clearable 清空按钮进 Tab 序，Enter/Space 可清空', async () => {
    const wrapper = mountSelect({ modelValue: 'a', clearable: true })
    const clear = wrapper.get('.select-clear')

    expect(clear.attributes('tabindex')).toBe('0')
    clear.element.focus()
    await clear.trigger('keydown', { key: 'Enter' })
    await nextTick()
    expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toBeNull()

    wrapper.setProps({ modelValue: 'b' })
    await nextTick()
    clear.element.focus()
    await clear.trigger('keydown', { key: ' ' })
    await nextTick()
    expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toBeNull()
  })
})
