import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { mount } from '@vue/test-utils'

import { useReveal } from '../useReveal'

/**
 * useReveal 的核心契约：**任何降级路径都必须把内容判为已入场**。
 * 若它在某条路径上停留在 false，落地页首屏之下的区块会永久保持 opacity:0——
 * 那是一个用单元测试很难发现、但用户一定会看到的空白页。
 */

type ObserverCallback = (entries: IntersectionObserverEntry[]) => void

function stubObserver() {
  const instances: Array<{
    callback: ObserverCallback
    observe: ReturnType<typeof vi.fn>
    disconnect: ReturnType<typeof vi.fn>
    unobserve: ReturnType<typeof vi.fn>
  }> = []

  class CapturingObserver {
    callback: ObserverCallback
    observe = vi.fn()
    disconnect = vi.fn()
    unobserve = vi.fn()

    constructor(callback: ObserverCallback) {
      this.callback = callback
      instances.push(this)
    }
  }

  globalThis.IntersectionObserver = CapturingObserver as unknown as typeof IntersectionObserver
  return instances
}

function mountProbe() {
  const Probe = defineComponent({
    setup() {
      const { target, revealed } = useReveal()
      return { target, revealed }
    },
    render() {
      return h('div', { ref: 'target' }, 'probe')
    },
  })

  return mount(Probe)
}

/** 让 prefers-reduced-motion 返回指定值（setup.ts 默认对所有 query 返回 true） */
function setReducedMotion(matches: boolean) {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query: string) => ({ matches, media: query }) as MediaQueryList
  )
}

describe('useReveal', () => {
  const originalObserver = globalThis.IntersectionObserver

  beforeEach(() => {
    vi.restoreAllMocks()
    globalThis.IntersectionObserver = originalObserver
  })

  it('reveals immediately when IntersectionObserver is unavailable', async () => {
    setReducedMotion(false)
    // @ts-expect-error 刻意抹掉以模拟老浏览器 / SSR
    delete globalThis.IntersectionObserver

    const wrapper = mountProbe()
    await nextTick()

    expect(wrapper.vm.revealed).toBe(true)
    globalThis.IntersectionObserver = originalObserver
  })

  it('reveals immediately and builds no observer under prefers-reduced-motion', async () => {
    setReducedMotion(true)
    const instances = stubObserver()

    const wrapper = mountProbe()
    await nextTick()

    expect(wrapper.vm.revealed).toBe(true)
    expect(instances).toHaveLength(0)
  })

  it('stays unrevealed until the element intersects', async () => {
    setReducedMotion(false)
    const instances = stubObserver()

    const wrapper = mountProbe()
    await nextTick()

    expect(instances).toHaveLength(1)
    expect(instances[0].observe).toHaveBeenCalledOnce()
    expect(wrapper.vm.revealed).toBe(false)

    instances[0].callback([{ isIntersecting: true } as IntersectionObserverEntry])
    await nextTick()

    expect(wrapper.vm.revealed).toBe(true)
  })

  it('ignores non-intersecting entries', async () => {
    setReducedMotion(false)
    const instances = stubObserver()

    const wrapper = mountProbe()
    await nextTick()

    instances[0].callback([{ isIntersecting: false } as IntersectionObserverEntry])
    await nextTick()

    expect(wrapper.vm.revealed).toBe(false)
  })

  it('stops observing after the first reveal and on unmount', async () => {
    setReducedMotion(false)
    const instances = stubObserver()

    const wrapper = mountProbe()
    await nextTick()

    instances[0].callback([{ isIntersecting: true } as IntersectionObserverEntry])
    await nextTick()
    expect(instances[0].disconnect).toHaveBeenCalled()

    wrapper.unmount()
    expect(instances[0].disconnect).toHaveBeenCalled()
  })

  it('reveals when observe() throws instead of hiding content forever', async () => {
    setReducedMotion(false)

    class ThrowingObserver {
      observe() {
        throw new Error('observe unavailable')
      }
      disconnect = vi.fn()
      unobserve = vi.fn()
    }
    globalThis.IntersectionObserver = ThrowingObserver as unknown as typeof IntersectionObserver

    const wrapper = mountProbe()
    await nextTick()

    expect(wrapper.vm.revealed).toBe(true)
  })
})
