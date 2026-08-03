import { mount, type DOMWrapper } from '@vue/test-utils'
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

type SelectProps = InstanceType<typeof Select>['$props']

/* 3 个选项：searchable 默认 'auto'，阈值是 > 5，所以这组走不可搜索分支 —— 
   正是键盘全哑的那条路径。 */
const THREE_OPTIONS = [
  { value: 'alpha', label: 'Alpha' },
  { value: 'beta', label: 'Beta' },
  { value: 'gamma', label: 'Gamma' },
]

/* 7 个选项：越过 'auto' 阈值，自动开启搜索框，用于回归保护可搜索分支。 */
const SEVEN_OPTIONS = Array.from({ length: 7 }, (_, index) => ({
  value: `value-${index}`,
  label: `Option ${index}`,
}))

/* attachTo 是必需的：本组件把焦点留在 trigger 上，而 jsdom 只对已入文档的元素
   更新 document.activeElement。不挂载进 body 就无法断言焦点归位。 */
/* transition 桩同样是必需的：弹层包在 <Transition> 里，离场要等 rAF 才真正从 DOM
   摘掉，不桩掉就断言不了「已关闭」。桩掉后 v-if 的移除是同步的。 */
const mountSelect = (props: SelectProps) => {
  const wrapper = mount(Select, {
    props,
    attachTo: document.body,
    global: { stubs: { transition: true } },
  })
  unmountWrapper = () => wrapper.unmount()
  return wrapper
}

const portalEl = () => document.body.querySelector<HTMLElement>('.select-dropdown-portal')
const optionsEl = () => document.body.querySelector<HTMLElement>('.select-options')
const optionEls = () => Array.from(document.body.querySelectorAll<HTMLElement>('.select-option'))

/* 高亮位置从 DOM 读，而不是去掏组件内部的 focusedIndex —— 断言的是用户能看到的
   那一行，而不是实现细节。 */
const highlightedIndex = () =>
  optionEls().findIndex((el) => el.classList.contains('select-option-focused'))

const pressKey = async (target: DOMWrapper<Element>, key: string) => {
  await target.trigger('keydown', { key })
  await nextTick()
}

afterEach(() => {
  unmountWrapper?.()
  unmountWrapper = undefined
  document.body.innerHTML = ''
  setViewportWidth(originalInnerWidth)
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

/* 弹层 teleport 到 body，不是 trigger 的 DOM 祖先，所以 trigger 上的 keydown
   永远冒泡不到弹层。不可搜索时焦点留在 trigger，这整条键盘路径此前是死的：
   方向键不动高亮、Escape 不关弹层。以下断言全部走 trigger 派发。 */
describe('Select keyboard operation with focus on the trigger (not searchable)', () => {
  const mountThreeOptions = (extra: Partial<SelectProps> = {}) => {
    setViewportWidth(1024)
    mockTriggerRect(20, 160)
    return mountSelect({ modelValue: null, options: THREE_OPTIONS, ...extra } as SelectProps)
  }

  it('does not render a search input below the auto threshold', async () => {
    const wrapper = mountThreeOptions()
    const trigger = wrapper.get('button')

    /* 真实浏览器里点按钮会原生把焦点给它；jsdom 的 dispatchEvent 不会，
       所以这里显式模拟「焦点在 trigger 上」这个前提。 */
    trigger.element.focus()
    await trigger.trigger('click')
    await nextTick()

    expect(portalEl()).not.toBeNull()
    expect(document.body.querySelector('.select-search-input')).toBeNull()
    /* 关键点：不可搜索时组件不把焦点搬进弹层，键盘事件因此只会落在 trigger 上。 */
    expect(document.activeElement).toBe(trigger.element)
  })

  it('moves the highlight down on ArrowDown', async () => {
    const wrapper = mountThreeOptions()
    const trigger = wrapper.get('button')

    await trigger.trigger('click')
    await nextTick()
    expect(highlightedIndex()).toBe(0)

    await pressKey(trigger, 'ArrowDown')
    expect(highlightedIndex()).toBe(1)

    await pressKey(trigger, 'ArrowDown')
    expect(highlightedIndex()).toBe(2)
  })

  it('moves the highlight up on ArrowUp and wraps to the last option', async () => {
    const wrapper = mountThreeOptions()
    const trigger = wrapper.get('button')

    await trigger.trigger('click')
    await nextTick()
    expect(highlightedIndex()).toBe(0)

    await pressKey(trigger, 'ArrowUp')
    expect(highlightedIndex()).toBe(2)

    await pressKey(trigger, 'ArrowUp')
    expect(highlightedIndex()).toBe(1)
  })

  /* 这条守住 task 1 的实现陷阱：trigger 原先已有 keydown.down → 打开，
     再加一处绑定时若不把「打开」与「移动」互斥，一次 ArrowDown 会同时做两件事。 */
  it('opens on a single ArrowDown from the closed state without also advancing the highlight', async () => {
    const wrapper = mountThreeOptions()
    const trigger = wrapper.get('button')

    expect(portalEl()).toBeNull()

    await pressKey(trigger, 'ArrowDown')

    expect(portalEl()).not.toBeNull()
    expect(highlightedIndex()).toBe(0)
  })

  it('opens on ArrowUp from the closed state without advancing the highlight', async () => {
    const wrapper = mountThreeOptions()
    const trigger = wrapper.get('button')

    await pressKey(trigger, 'ArrowUp')

    expect(portalEl()).not.toBeNull()
    expect(highlightedIndex()).toBe(0)
  })

  it('opens with the highlight on the selected option', async () => {
    const wrapper = mountThreeOptions({ modelValue: 'gamma' })

    await pressKey(wrapper.get('button'), 'ArrowDown')

    expect(highlightedIndex()).toBe(2)
  })

  it('commits the highlighted option on Enter', async () => {
    const wrapper = mountThreeOptions()
    const trigger = wrapper.get('button')

    await trigger.trigger('click')
    await nextTick()
    await pressKey(trigger, 'ArrowDown')
    expect(highlightedIndex()).toBe(1)

    await pressKey(trigger, 'Enter')

    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['beta'])
    expect(wrapper.emitted('change')?.at(-1)?.[0]).toBe('beta')
    expect(portalEl()).toBeNull()
    expect(document.activeElement).toBe(trigger.element)
  })

  it('closes on Escape and returns focus to the trigger', async () => {
    const wrapper = mountThreeOptions()
    const trigger = wrapper.get('button')

    await trigger.trigger('click')
    await nextTick()
    expect(portalEl()).not.toBeNull()

    await pressKey(trigger, 'Escape')

    expect(portalEl()).toBeNull()
    expect(document.activeElement).toBe(trigger.element)
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('closes on Tab so focus can leave the control', async () => {
    const wrapper = mountThreeOptions()
    const trigger = wrapper.get('button')

    await trigger.trigger('click')
    await nextTick()

    await pressKey(trigger, 'Tab')

    expect(portalEl()).toBeNull()
  })

  it('skips disabled options when moving the highlight', async () => {
    setViewportWidth(1024)
    mockTriggerRect(20, 160)
    const wrapper = mountSelect({
      modelValue: null,
      options: [
        { value: 'a', label: 'A' },
        { value: 'b', label: 'B', disabled: true },
        { value: 'c', label: 'C' },
      ],
    } as SelectProps)
    const trigger = wrapper.get('button')

    await trigger.trigger('click')
    await nextTick()
    expect(highlightedIndex()).toBe(0)

    await pressKey(trigger, 'ArrowDown')
    expect(highlightedIndex()).toBe(2)
  })

  it('leaves the popup closed for keys it does not own', async () => {
    const wrapper = mountThreeOptions()

    await pressKey(wrapper.get('button'), 'a')

    expect(portalEl()).toBeNull()
  })
})

describe('Select screen-reader wiring', () => {
  const openThreeOptions = async () => {
    setViewportWidth(1024)
    mockTriggerRect(20, 160)
    const wrapper = mountSelect({ modelValue: null, options: THREE_OPTIONS } as SelectProps)
    const trigger = wrapper.get('button')
    await trigger.trigger('click')
    await nextTick()
    return { wrapper, trigger }
  }

  it('exposes the combobox pattern on the trigger', async () => {
    const { trigger } = await openThreeOptions()

    expect(trigger.attributes('role')).toBe('combobox')
    expect(trigger.attributes('aria-haspopup')).toBe('listbox')
    expect(trigger.attributes('aria-expanded')).toBe('true')
    expect(trigger.attributes('aria-controls')).toBe(optionsEl()?.id)
  })

  /* role=listbox 此前落在包住搜索框的那个 div 上 —— 一个 listbox 里塞了 textbox，
     是无效嵌套。它必须落在真正装 option 的容器上。 */
  it('puts role=listbox on the options container, not on the search wrapper or the portal root', async () => {
    await openThreeOptions()

    expect(optionsEl()?.getAttribute('role')).toBe('listbox')
    expect(portalEl()?.getAttribute('role')).toBeNull()
    expect(document.body.querySelector('.select-search[role="listbox"]')).toBeNull()
  })

  it('gives every option a unique id', async () => {
    await openThreeOptions()

    const ids = optionEls().map((el) => el.id)
    expect(ids).toHaveLength(3)
    expect(ids.every((id) => id.length > 0)).toBe(true)
    expect(new Set(ids).size).toBe(3)
  })

  it('tracks aria-activedescendant against a real highlighted element', async () => {
    const { trigger } = await openThreeOptions()

    const initial = trigger.attributes('aria-activedescendant')
    expect(initial).toBe(optionEls()[0].id)
    expect(document.getElementById(initial as string)).not.toBeNull()

    await pressKey(trigger, 'ArrowDown')

    const moved = trigger.attributes('aria-activedescendant')
    expect(moved).toBe(optionEls()[1].id)
    const activeEl = document.getElementById(moved as string)
    expect(activeEl).not.toBeNull()
    expect(activeEl?.classList.contains('select-option-focused')).toBe(true)
  })

  it('drops aria-activedescendant and aria-controls once closed', async () => {
    const { trigger } = await openThreeOptions()
    expect(trigger.attributes('aria-activedescendant')).toBeDefined()

    await pressKey(trigger, 'Escape')

    expect(trigger.attributes('aria-activedescendant')).toBeUndefined()
    expect(trigger.attributes('aria-controls')).toBeUndefined()
    expect(trigger.attributes('aria-expanded')).toBe('false')
  })

  it('keeps the empty state out of the listbox children roles', async () => {
    setViewportWidth(1024)
    mockTriggerRect(20, 160)
    const wrapper = mountSelect({ modelValue: null, options: [] } as SelectProps)

    await wrapper.get('button').trigger('click')
    await nextTick()

    const empty = document.body.querySelector('.select-empty')
    expect(empty?.getAttribute('role')).toBe('presentation')
    expect(wrapper.get('button').attributes('aria-activedescendant')).toBeUndefined()
  })
})

/* 可搜索分支此前是唯一能用键盘的路径（弹层内的搜索框拿到焦点，事件正常冒泡）。
   这组是回归保护：改动不能把它弄坏。 */
describe('Select searchable path stays intact', () => {
  const openSearchable = async () => {
    setViewportWidth(1024)
    mockTriggerRect(20, 160)
    const wrapper = mountSelect({ modelValue: null, options: SEVEN_OPTIONS } as SelectProps)
    await wrapper.get('button').trigger('click')
    await nextTick()
    await nextTick()
    const search = wrapper.getComponent(Select).find('.select-search-input')
    return { wrapper, search: document.body.querySelector<HTMLInputElement>('.select-search-input'), searchWrapper: search }
  }

  it('auto-enables the search input above the threshold and focuses it', async () => {
    const { search } = await openSearchable()

    expect(search).not.toBeNull()
    expect(document.activeElement).toBe(search)
  })

  it('moves the highlight with arrows dispatched from the search input', async () => {
    await openSearchable()
    const search = document.body.querySelector<HTMLInputElement>('.select-search-input') as HTMLInputElement

    expect(highlightedIndex()).toBe(0)

    search.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }))
    await nextTick()
    expect(highlightedIndex()).toBe(1)

    search.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true }))
    await nextTick()
    expect(highlightedIndex()).toBe(0)
  })

  it('filters options and commits the highlighted match on Enter', async () => {
    const { wrapper } = await openSearchable()
    const search = document.body.querySelector<HTMLInputElement>('.select-search-input') as HTMLInputElement

    search.value = 'Option 5'
    search.dispatchEvent(new Event('input'))
    await nextTick()

    expect(optionEls()).toHaveLength(1)

    search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
    await nextTick()

    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['value-5'])
  })

  it('mirrors aria-activedescendant onto the search input, which holds DOM focus', async () => {
    await openSearchable()
    const search = document.body.querySelector<HTMLInputElement>('.select-search-input') as HTMLInputElement

    expect(search.getAttribute('aria-activedescendant')).toBe(optionEls()[0].id)

    search.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }))
    await nextTick()

    expect(search.getAttribute('aria-activedescendant')).toBe(optionEls()[1].id)
  })

  it('closes on Escape from the search input and returns focus to the trigger', async () => {
    const { wrapper } = await openSearchable()
    const search = document.body.querySelector<HTMLInputElement>('.select-search-input') as HTMLInputElement

    search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
    await nextTick()

    expect(portalEl()).toBeNull()
    expect(document.activeElement).toBe(wrapper.get('button').element)
  })
})
