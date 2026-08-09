import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import ProxySelector from '../ProxySelector.vue'

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return {
    ...actual,
    useI18n: () => ({ t: (key: string) => key }),
  }
})

const proxies = [
  { id: 1, name: 'Proxy 1', protocol: 'http', host: 'h1.example.com', port: 8080 },
  { id: 2, name: 'Proxy 2', protocol: 'socks5', host: 'h2.example.com', port: 1080 },
]

let unmountWrapper: (() => void) | undefined

const mountSelector = (props: Record<string, unknown> = {}) => {
  const wrapper = mount(ProxySelector, {
    props: { modelValue: null, proxies, ...props },
    attachTo: document.body,
  })
  unmountWrapper = () => wrapper.unmount()
  return wrapper
}

/** Let the 0.2s leave transition finish removing the panel (jsdom never fires transitionend). */
const settle = () => new Promise((resolve) => setTimeout(resolve, 300))

afterEach(() => {
  unmountWrapper?.()
  unmountWrapper = undefined
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('ProxySelector keyboard (WAI-ARIA combobox)', () => {
  const dropdown = () => document.body.querySelector<HTMLElement>('.select-dropdown')
  const options = () => [...(dropdown()?.querySelectorAll('[role="option"]') ?? [])]
  const focusedOption = () =>
    document.body.querySelector<HTMLElement>('.select-option-focused')

  it('触发钮暴露 aria-expanded + aria-haspopup，ArrowDown 打开 listbox', async () => {
    const wrapper = mountSelector()
    const trigger = wrapper.get('button')

    expect(trigger.attributes('aria-haspopup')).toBe('true')
    expect(trigger.attributes('aria-expanded')).toBe('false')
    expect(trigger.attributes('aria-controls')).toMatch(/-listbox$/)

    trigger.element.focus()
    await trigger.trigger('keydown', { key: 'ArrowDown' })
    await nextTick()
    await nextTick()

    expect(trigger.attributes('aria-expanded')).toBe('true')
    expect(dropdown()?.getAttribute('role')).toBe('listbox')
    expect(trigger.attributes('aria-controls')).toBe(dropdown()?.id)
    expect(options().length).toBe(3) // No Proxy + 2 proxies
    expect(options()[0]?.getAttribute('aria-selected')).toBe('true')
    // 焦点进入搜索框（editable combobox）
    const input = document.body.querySelector<HTMLInputElement>('.select-search-input')
    expect(document.activeElement).toBe(input)
    expect(input?.getAttribute('role')).toBe('combobox')
    expect(input?.getAttribute('aria-controls')).toBe(dropdown()?.id)
    expect(input?.getAttribute('aria-activedescendant')).toBe(options()[0]?.id)
  })

  it('ArrowDown 移动高亮、Enter 选中并关闭、焦点还给触发钮', async () => {
    const wrapper = mountSelector()
    const trigger = wrapper.get('button')
    trigger.element.focus()
    await trigger.trigger('keydown', { key: 'ArrowDown' })
    await nextTick()
    await nextTick()

    const input = document.body.querySelector<HTMLInputElement>('.select-search-input')!
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true })
    )
    await nextTick()
    expect(focusedOption()?.textContent).toContain('Proxy 1')

    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
    )
    await nextTick()
    await settle()
    expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toBe(1)
    expect(dropdown()).toBeNull()
    expect(document.activeElement).toBe(trigger.element)
  })

  it('Home/End 与首尾回绕', async () => {
    const wrapper = mountSelector()
    const trigger = wrapper.get('button')
    trigger.element.focus()
    await trigger.trigger('keydown', { key: 'ArrowDown' })
    await nextTick()
    await nextTick()

    const input = document.body.querySelector<HTMLInputElement>('.select-search-input')!
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true })
    )
    await nextTick()
    expect(focusedOption()?.textContent).toContain('Proxy 2')

    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true })
    )
    await nextTick()
    // 回绕到 "No Proxy"
    expect(focusedOption()?.textContent).toContain('noProxy')

    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true })
    )
    await nextTick()
    expect(focusedOption()?.textContent).toContain('noProxy')
  })

  it('Escape 关闭并还原焦点到触发钮', async () => {
    const wrapper = mountSelector()
    const trigger = wrapper.get('button')
    trigger.element.focus()
    await trigger.trigger('keydown', { key: 'ArrowDown' })
    await nextTick()
    await nextTick()

    const input = document.body.querySelector<HTMLInputElement>('.select-search-input')!
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    )
    await nextTick()
    await settle()

    expect(dropdown()).toBeNull()
    expect(trigger.attributes('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(trigger.element)
  })

  it('Tab 关闭下拉', async () => {
    const wrapper = mountSelector()
    const trigger = wrapper.get('button')
    trigger.element.focus()
    await trigger.trigger('keydown', { key: 'ArrowDown' })
    await nextTick()
    await nextTick()

    const input = document.body.querySelector<HTMLInputElement>('.select-search-input')!
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
    )
    await nextTick()
    await settle()
    expect(dropdown()).toBeNull()
  })

  it('选中态选项带 aria-selected 与匹配的 option id', async () => {
    const wrapper = mountSelector({ modelValue: 2 })
    const trigger = wrapper.get('button')
    trigger.element.focus()
    await trigger.trigger('keydown', { key: 'ArrowDown' })
    await nextTick()
    await nextTick()

    const input = document.body.querySelector<HTMLInputElement>('.select-search-input')!
    expect(input?.getAttribute('aria-activedescendant')).toBe(options()[2]?.id)
    expect(options()[2]?.getAttribute('aria-selected')).toBe('true')
    expect(options()[0]?.getAttribute('aria-selected')).toBe('false')

    const ids = options().map((el) => el.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
