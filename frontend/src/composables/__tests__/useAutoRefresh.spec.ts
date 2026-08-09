import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { useAutoRefresh } from '@/composables/useAutoRefresh'

/**
 * 锁住 useAutoRefresh 的页面可见性行为（审计 PF4）：
 *  hidden 时不再触发刷新（定时器停表），visible 时恢复；
 *  onUnmounted 清理 visibilitychange 监听。
 */

let hidden = false
let wrapper: VueWrapper | null = null

function setHidden(value: boolean) {
  hidden = value
  document.dispatchEvent(new Event('visibilitychange'))
}

function makeHost(onRefresh: () => Promise<void> | void, storageKey: string, interval: number) {
  const Host = defineComponent({
    setup() {
      const autoRefresh = useAutoRefresh({
        storageKey,
        defaultInterval: interval,
        onRefresh,
      })
      return { autoRefresh }
    },
    template: '<div />',
  })
  return mount(Host)
}

describe('useAutoRefresh 可见性暂停', () => {
  beforeEach(() => {
    hidden = false
    localStorage.clear()
    vi.useFakeTimers()
    vi.clearAllMocks()
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => hidden,
    })
  })

  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    vi.useRealTimers()
  })

  it('hidden 时停表不再触发刷新，visible 时恢复刷新', async () => {
    const onRefresh = vi.fn()
    wrapper = makeHost(onRefresh, 'vis-test-1', 2)

    const vm = wrapper.vm as { autoRefresh: { setEnabled: (v: boolean) => void } }
    vm.autoRefresh.setEnabled(true)

    // 先隐藏：定时器被停掉，推进时间也不触发
    setHidden(true)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(onRefresh).toHaveBeenCalledTimes(0)

    // 恢复可见：定时器重启，interval=2s（countdown 2→1→0 后触发）
    setHidden(false)
    await vi.advanceTimersByTimeAsync(3_100)
    expect(onRefresh).toHaveBeenCalledTimes(1)

    // 再次隐藏：不再有新触发
    setHidden(true)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(onRefresh).toHaveBeenCalledTimes(1)
  })

  it('调用方未传 shouldPause 时，默认在 hidden 状态下跳过 tick（初始即隐藏的边界）', async () => {
    const onRefresh = vi.fn()
    // 初始即 hidden，不派发 visibilitychange（模拟后台打开的标签页）
    hidden = true
    wrapper = makeHost(onRefresh, 'vis-test-2', 1)

    const vm = wrapper.vm as { autoRefresh: { setEnabled: (v: boolean) => void } }
    vm.autoRefresh.setEnabled(true)

    await vi.advanceTimersByTimeAsync(5_000)
    expect(onRefresh).toHaveBeenCalledTimes(0)

    // 恢复可见（不派发事件，仅靠 tick 内的默认 shouldPause 判断）
    hidden = false
    await vi.advanceTimersByTimeAsync(2_000)
    expect(onRefresh).toHaveBeenCalledTimes(1)
  })

  it('组件卸载后 visibilitychange 监听被清理，不再恢复定时器', async () => {
    const onRefresh = vi.fn()
    wrapper = makeHost(onRefresh, 'vis-test-3', 2)

    const vm = wrapper.vm as { autoRefresh: { setEnabled: (v: boolean) => void } }
    vm.autoRefresh.setEnabled(true)

    // 卸载（onBeforeUnmount → stop → 移除监听 + 清定时器）
    wrapper.unmount()
    wrapper = null

    // 卸载后再派发 visible 事件：不应有残留监听重启定时器
    setHidden(false)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(onRefresh).toHaveBeenCalledTimes(0)
  })

  it('禁用时停止定时器，不触发刷新', async () => {
    const onRefresh = vi.fn()
    wrapper = makeHost(onRefresh, 'vis-test-4', 1)

    const vm = wrapper.vm as { autoRefresh: { setEnabled: (v: boolean) => void } }
    vm.autoRefresh.setEnabled(true)
    await vi.advanceTimersByTimeAsync(2_100)
    expect(onRefresh).toHaveBeenCalledTimes(1)

    vm.autoRefresh.setEnabled(false)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(onRefresh).toHaveBeenCalledTimes(1)
  })
})
