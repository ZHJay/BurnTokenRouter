/**
 * Toast 组件单元测试
 *
 * 关于"合成探针"这个坑:此前的可访问性巡检在四条被审路由上都找不到活的
 * `.toast` 实例,于是退化成往页面里塞一个 `<div class="toast">` 去量样式 ——
 * 那个 div 命中了 style.css 的规则,巡检因此全绿,而真正发货的组件从来没有
 * `.toast` 这个类。所以本文件的断言一律取 **真实挂载后渲染出来的元素**,
 * 不构造任何替身节点。
 *
 * 关于 matchMedia:src/__tests__/setup.ts 把 matchMedia 打桩成对**任何** query
 * 都返回 matches: true,所以 prefers-reduced-motion 在所有 spec 里都读作"开"。
 * 本组件的减弱动效修复是纯 CSS,不读 matchMedia,所以不受这个桩影响;而 jsdom
 * 不注入 scoped 样式,getComputedStyle 也量不到。因此减弱动效那条改用
 * "从 SFC 源码里取出真实写下的选择器,再让真实元素去 matches() 它"来验证 ——
 * 选择器和元素两头都是真的,合成探针那个缺口就补不回去了。
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import Toast from '../Toast.vue'
import { useAppStore } from '@/stores/app'

const dir = dirname(fileURLToPath(import.meta.url))
const toastSource = readFileSync(resolve(dir, '../Toast.vue'), 'utf8')

/** 按花括号配平取出 @media (prefers-reduced-motion: reduce) 的块内容。 */
function extractReducedMotionBlock(source: string): string | null {
  const css = source.replace(/\/\*[\s\S]*?\*\//g, '')
  const opening = /@media[^{]*prefers-reduced-motion:\s*reduce[^{]*\{/.exec(css)
  if (!opening) return null

  const bodyStart = opening.index + opening[0].length
  let cursor = bodyStart
  let depth = 1
  while (cursor < css.length && depth > 0) {
    if (css[cursor] === '{') depth++
    else if (css[cursor] === '}') depth--
    cursor++
  }
  return depth === 0 ? css.slice(bodyStart, cursor - 1) : null
}

/** 取出一个 CSS 块里声明的所有选择器(逗号分组拆开)。 */
function extractSelectors(block: string): string[] {
  return Array.from(block.matchAll(/([^{}]+)\{[^{}]*\}/g))
    .flatMap(([, selectorList]) => selectorList.split(','))
    .map((selector) => selector.trim())
    .filter(Boolean)
}

let wrapper: VueWrapper | undefined

const mountToast = () => {
  wrapper = mount(Toast)
  return wrapper
}

const region = (channel: 'polite' | 'assertive') =>
  document.body.querySelector<HTMLElement>(`[data-toast-region="${channel}"]`)

const toastElements = () => Array.from(document.body.querySelectorAll<HTMLElement>('.toast-item'))

beforeEach(() => {
  setActivePinia(createPinia())
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
  vi.useRealTimers()
})

describe('Toast live region', () => {
  it('两个 live region 在没有任何 toast 时就已挂载', () => {
    mountToast()

    // 始终挂载是关键:辅助技术只播报它已经在观察的区域内发生的变化,
    // 跟第一条消息一起插入 DOM 的 region 通常整块被漏掉。
    expect(region('polite')).not.toBeNull()
    expect(region('assertive')).not.toBeNull()
    expect(region('polite')?.getAttribute('aria-live')).toBe('polite')
    expect(toastElements()).toHaveLength(0)
  })

  it('aria-atomic 落在单条 toast 上,而不是容器上', async () => {
    const store = useAppStore()
    mountToast()

    store.showSuccess('操作成功')
    store.showInfo('提示信息')
    await nextTick()

    // 容器上带 aria-atomic="true" 会让每条新 toast 连带把当前所有 toast
    // 重新播报一遍。role="alert" 隐含 atomic=true,所以这里必须显式关掉。
    expect(region('polite')?.getAttribute('aria-atomic')).toBe('false')
    expect(region('assertive')?.getAttribute('aria-atomic')).toBe('false')

    const toasts = toastElements()
    expect(toasts).toHaveLength(2)
    for (const toast of toasts) {
      expect(toast.getAttribute('aria-atomic')).toBe('true')
    }
  })

  it('error toast 进 assertive 区域,其余进 polite 区域', async () => {
    const store = useAppStore()
    mountToast()

    store.showSuccess('保存成功')
    store.showError('保存失败')
    store.showWarning('注意')
    await nextTick()

    const assertive = region('assertive')
    const polite = region('polite')

    // WCAG 4.1.3:失败提示不应排在正在朗读的成功提示后面。
    expect(assertive?.getAttribute('role')).toBe('alert')
    expect(assertive?.getAttribute('aria-live')).toBe('assertive')
    expect(assertive?.textContent).toContain('保存失败')
    expect(assertive?.textContent).not.toContain('保存成功')

    expect(polite?.textContent).toContain('保存成功')
    expect(polite?.textContent).toContain('注意')
    expect(polite?.textContent).not.toContain('保存失败')
  })

  it('error toast 被关掉后,assertive 区域还是原来那个节点', async () => {
    const store = useAppStore()
    mountToast()

    // 取节点身份而不是数量:region 若被卸载再挂回来,辅助技术会重新开始观察,
    // 下一条消息就有可能被漏掉。这里要钉住的是"同一个节点一直在"。
    const before = region('assertive')
    expect(before).not.toBeNull()

    const id = store.showError('保存失败')
    await nextTick()
    expect(toastElements()).toHaveLength(1)

    store.hideToast(id)
    await nextTick()

    expect(region('assertive')).toBe(before)
    expect(store.toasts).toHaveLength(0)
    // 注:离场元素此刻仍在 DOM 里 —— jsdom 不派发 transitionend,
    // TransitionGroup 的 leave 收不到尾,所以不断言 DOM 数量。
  })
})

describe('Toast 减弱动效归属', () => {
  it('SFC 里写下的减弱动效覆盖,命中的是真实渲染出来的那个元素', async () => {
    const store = useAppStore()
    mountToast()

    store.showSuccess('操作成功')
    await nextTick()

    const [toast] = toastElements()
    expect(toast).toBeDefined()

    const block = extractReducedMotionBlock(toastSource)
    expect(block).not.toBeNull()

    const selectors = extractSelectors(block!)
    expect(selectors.length).toBeGreaterThan(0)

    // 真实元素 × 真实选择器。任何一头改了名字对不上,这里就红。
    const hits = selectors.filter((selector) => toast.matches(selector))
    expect(hits.length).toBeGreaterThan(0)

    // 整宽横移必须被去掉 —— toast 是唯一无需用户触发就出现的组件。
    expect(block!.replace(/\s+/g, ' ')).toContain('transform: none !important')
  })

  it('承载横移过渡的元素与承载覆盖的元素是同一个', async () => {
    const store = useAppStore()
    mountToast()

    // 入场过渡只在挂载之后新增才会跑(TransitionGroup 默认不做 appear)。
    store.showSuccess('操作成功')
    await nextTick()

    const [toast] = toastElements()
    expect(toast).toBeDefined()

    // enter-from 还没被 rAF 摘掉:位移类和 .toast-item 在同一个 class 列表里,
    // 说明动效只有一个归属方,覆盖不会落到隔壁元素上。
    expect(toast.classList.contains('toast-item')).toBe(true)
    expect(toast.classList.contains('translate-x-full')).toBe(true)
    expect(toast.parentElement?.hasAttribute('data-toast-region')).toBe(true)
  })
})

describe('Toast 材质', () => {
  it('表面是不透明的,不再叠一层 thin 玻璃', async () => {
    const store = useAppStore()
    mountToast()

    store.showSuccess('操作成功')
    await nextTick()

    const [toast] = toastElements()

    // toast teleport 到 body 且 z-[9999],逃出了 modal 的 backdrop root,
    // thin 叠 thin 会把下面那层材质真的再模糊一次。
    expect(toast.classList.contains('glass-thin')).toBe(false)
    // 四层玻璃边缘与阴影保留。
    expect(toast.classList.contains('shadow-glass-edge')).toBe(true)

    const flattened = toastSource.replace(/\s+/g, ' ')
    expect(flattened).toContain('.toast-item { background: var(--surface); backdrop-filter: none;')
  })

  it('按类型给出左边框变体', async () => {
    const store = useAppStore()
    mountToast()

    store.showError('保存失败')
    await nextTick()

    const [toast] = toastElements()
    expect(toast.classList.contains('toast-error')).toBe(true)
    expect(toast.classList.contains('border-l-[3px]')).toBe(true)
  })

  it('不透明化没有顺带丢掉高对比描边', () => {
    // 描边此前是靠 .glass-thin 命中 style.css 的 prefers-contrast 清单拿到的。
    // 既然那个类被移除,同一分支必须在本组件里显式写回,否则高对比用户只剩
    // 0.5px 玻璃发丝边。
    const flattened = toastSource.replace(/\s+/g, ' ')
    expect(flattened).toContain('@media (prefers-contrast: more) { .toast-item')
    expect(flattened).toContain('inset 0 0 0 1px var(--label)')
  })
})

describe('Toast 自动消失可暂停', () => {
  it('悬停时暂停倒计时,移开后按剩余时间继续', async () => {
    vi.useFakeTimers()
    const store = useAppStore()
    mountToast()

    store.showSuccess('操作成功', 3000)
    await nextTick()

    const [toast] = toastElements()
    expect(toast).toBeDefined()

    vi.advanceTimersByTime(1000)
    toast.dispatchEvent(new MouseEvent('mouseenter'))

    // 暂停期间无论过多久都不该消失(WCAG 2.2.1)。
    vi.advanceTimersByTime(10_000)
    expect(store.toasts).toHaveLength(1)

    toast.dispatchEvent(new MouseEvent('mouseleave'))
    vi.advanceTimersByTime(1999)
    expect(store.toasts).toHaveLength(1)

    vi.advanceTimersByTime(1)
    expect(store.toasts).toHaveLength(0)
  })

  it('聚焦时暂停,焦点离开后继续', async () => {
    vi.useFakeTimers()
    const store = useAppStore()
    mountToast()

    store.showError('保存失败', 5000)
    await nextTick()

    const [toast] = toastElements()
    toast.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))

    vi.advanceTimersByTime(10_000)
    expect(store.toasts).toHaveLength(1)

    toast.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
    vi.advanceTimersByTime(5000)
    expect(store.toasts).toHaveLength(0)
  })

  it('手动关闭会连带清掉倒计时,不会事后再对已消失的 toast 触发一次', async () => {
    vi.useFakeTimers()
    const store = useAppStore()
    mountToast()

    store.showSuccess('第一条', 3000)
    await nextTick()

    const closeButton = document.body.querySelector<HTMLButtonElement>('.toast-item button')
    expect(closeButton).not.toBeNull()
    closeButton!.click()
    await nextTick()
    expect(store.toasts).toHaveLength(0)

    // 旧 timer 若还活着,它到点时会去删“当前第一条”,把这条新的误删。
    store.showSuccess('第二条', 10_000)
    await nextTick()
    vi.advanceTimersByTime(3000)

    expect(store.toasts).toHaveLength(1)
    expect(store.toasts[0].message).toBe('第二条')
  })
})
