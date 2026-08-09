import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useSubscriptionStore } from '@/stores/subscriptions'

/**
 * 锁住 subscriptionsStore 5min 轮询的页面可见性行为（审计 PF4）。
 *
 * 与 auth.polling.visibility.spec.ts 同一套契约：hidden（后台标签页）时停表、
 * visible 时恢复、stopPolling 后监听被摘掉不会再自行重启。
 * 两个 store 行为必须一致 —— 分叉过的实现是本轮审计发现的问题本体。
 */

const mockGetActiveSubscriptions = vi.fn()

vi.mock('@/api/subscriptions', () => ({
  default: {
    getActiveSubscriptions: (...args: any[]) => mockGetActiveSubscriptions(...args)
  }
}))

const POLL_INTERVAL_MS = 5 * 60 * 1000

let hidden = false
let store: ReturnType<typeof useSubscriptionStore> | null = null

function setHidden(value: boolean) {
  hidden = value
  document.dispatchEvent(new Event('visibilitychange'))
}

describe('useSubscriptionStore 轮询可见性暂停', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
    vi.clearAllMocks()
    mockGetActiveSubscriptions.mockResolvedValue([])
    hidden = false
    // jsdom 的 document.hidden 默认 false 且不可直接赋值，必须用 getter 覆盖
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => hidden
    })
    store = useSubscriptionStore()
  })

  afterEach(() => {
    // 每个用例结束都摘掉 visibilitychange 监听，不泄漏进下一个用例
    store?.stopPolling()
    store = null
    vi.useRealTimers()
  })

  it('页面可见时按 5min 间隔轮询', async () => {
    store!.startPolling()
    expect(mockGetActiveSubscriptions).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS)
    expect(mockGetActiveSubscriptions).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS)
    expect(mockGetActiveSubscriptions).toHaveBeenCalledTimes(2)
  })

  it('切到后台标签页后不再打接口，回到前台恢复', async () => {
    store!.startPolling()
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS)
    expect(mockGetActiveSubscriptions).toHaveBeenCalledTimes(1)

    setHidden(true)
    // 后台停表：再过两个周期也不应有新请求
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 2)
    expect(mockGetActiveSubscriptions).toHaveBeenCalledTimes(1)

    setHidden(false)
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS)
    expect(mockGetActiveSubscriptions).toHaveBeenCalledTimes(2)
  })

  it('页面已在后台时调用 startPolling 不起表，转前台才开始', async () => {
    setHidden(true)
    store!.startPolling()

    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 2)
    expect(mockGetActiveSubscriptions).not.toHaveBeenCalled()

    setHidden(false)
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS)
    expect(mockGetActiveSubscriptions).toHaveBeenCalledTimes(1)
  })

  it('stopPolling 摘掉监听：此后可见性切换不会自行重启轮询', async () => {
    store!.startPolling()
    store!.stopPolling()

    // 监听已摘除，hidden→visible 不应把表重新起起来
    setHidden(true)
    setHidden(false)
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 2)
    expect(mockGetActiveSubscriptions).not.toHaveBeenCalled()
  })

  it('重复 startPolling 不产生第二个定时器（每周期仍只打一次）', async () => {
    store!.startPolling()
    store!.startPolling()
    store!.startPolling()

    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS)
    expect(mockGetActiveSubscriptions).toHaveBeenCalledTimes(1)
  })
})
