import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { onUnmounted } from 'vue'
import { useTableLoader } from '@/composables/useTableLoader'

// Mock Vue 的 onUnmounted（composable 外使用时会报错）
vi.mock('vue', async () => {
  const actual = await vi.importActual('vue')
  return {
    ...actual,
    onUnmounted: vi.fn(),
  }
})

const createMockFetchFn = (items: any[] = [], total = 0, pages = 1) => {
  return vi.fn().mockResolvedValue({ items, total, pages })
}

describe('useTableLoader', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // --- 基础加载 ---

  describe('基础加载', () => {
    it('load 执行 fetchFn 并更新 items', async () => {
      const mockItems = [{ id: 1, name: 'item1' }, { id: 2, name: 'item2' }]
      const fetchFn = createMockFetchFn(mockItems, 2, 1)

      const { items, loading, load, pagination } = useTableLoader({
        fetchFn,
      })

      expect(items.value).toHaveLength(0)

      await load()

      expect(items.value).toEqual(mockItems)
      expect(pagination.total).toBe(2)
      expect(pagination.pages).toBe(1)
      expect(loading.value).toBe(false)
    })

    it('load 期间 loading 为 true', async () => {
      let resolveLoad: (v: any) => void
      const fetchFn = vi.fn(
        () => new Promise((resolve) => { resolveLoad = resolve })
      )

      const { loading, load } = useTableLoader({ fetchFn })

      const p = load()
      expect(loading.value).toBe(true)

      resolveLoad!({ items: [], total: 0, pages: 0 })
      await p

      expect(loading.value).toBe(false)
    })

    it('使用默认 pageSize=20', async () => {
      const fetchFn = createMockFetchFn()
      const { load, pagination } = useTableLoader({ fetchFn })

      await load()

      expect(fetchFn).toHaveBeenCalledWith(
        1,
        20,
        expect.anything(),
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      )
      expect(pagination.page_size).toBe(20)
    })

    it('可自定义 pageSize', async () => {
      const fetchFn = createMockFetchFn()
      const { load } = useTableLoader({ fetchFn, pageSize: 50 })

      await load()

      expect(fetchFn).toHaveBeenCalledWith(
        1,
        50,
        expect.anything(),
        expect.anything()
      )
    })
  })

  // --- 分页 ---

  describe('分页', () => {
    it('handlePageChange 更新页码并加载', async () => {
      const fetchFn = createMockFetchFn([], 100, 5)
      const { handlePageChange, pagination, load } = useTableLoader({ fetchFn })

      await load() // 初始加载
      fetchFn.mockClear()

      handlePageChange(3)

      expect(pagination.page).toBe(3)
      // 等待 load 完成
      await vi.runAllTimersAsync()
      expect(fetchFn).toHaveBeenCalledWith(3, 20, expect.anything(), expect.anything())
    })

    it('handlePageSizeChange 重置到第1页并加载', async () => {
      const fetchFn = createMockFetchFn([], 100, 5)
      const { handlePageSizeChange, pagination, load } = useTableLoader({ fetchFn })

      await load()
      pagination.page = 3
      fetchFn.mockClear()

      handlePageSizeChange(50)

      expect(pagination.page).toBe(1)
      expect(pagination.page_size).toBe(50)
    })

    it('handlePageChange 限制页码范围', async () => {
      const fetchFn = createMockFetchFn([], 100, 5)
      const { handlePageChange, pagination, load } = useTableLoader({ fetchFn })

      await load()

      // 超出范围的页码被限制
      handlePageChange(999)
      expect(pagination.page).toBe(5) // 限制在 pages=5

      handlePageChange(0)
      expect(pagination.page).toBe(1) // 最小为 1
    })
  })

  // --- 搜索防抖 ---

  describe('搜索防抖', () => {
    it('debouncedReload 在 300ms 内多次调用只执行一次', async () => {
      const fetchFn = createMockFetchFn()
      const { debouncedReload } = useTableLoader({ fetchFn })

      // 快速连续调用
      debouncedReload()
      debouncedReload()
      debouncedReload()

      // 还没到 300ms，不应调用 fetchFn
      expect(fetchFn).not.toHaveBeenCalled()

      // 推进 300ms
      vi.advanceTimersByTime(300)

      // 等待异步完成
      await vi.runAllTimersAsync()

      expect(fetchFn).toHaveBeenCalledTimes(1)
    })

    it('reload 重置到第 1 页', async () => {
      const fetchFn = createMockFetchFn([], 100, 5)
      const { reload, pagination, load } = useTableLoader({ fetchFn })

      await load()
      pagination.page = 3

      await reload()

      expect(pagination.page).toBe(1)
    })
  })

  // --- 请求取消 ---

  describe('请求取消', () => {
    it('新请求取消前一个未完成的请求', async () => {
      let callCount = 0
      const fetchFn = vi.fn((_page, _size, _params, options) => {
        callCount++
        const currentCall = callCount
        return new Promise((resolve, reject) => {
          // 模拟监听 abort
          if (options?.signal) {
            options.signal.addEventListener('abort', () => {
              reject({ name: 'CanceledError', code: 'ERR_CANCELED' })
            })
          }
          // 异步解决
          setTimeout(() => {
            resolve({ items: [{ id: currentCall }], total: 1, pages: 1 })
          }, 1000)
        })
      })

      const { load } = useTableLoader({ fetchFn })

      // 第一次加载
      const p1 = load()
      // 第二次加载（应取消第一次）
      const p2 = load()

      // 推进时间让第二次完成
      vi.advanceTimersByTime(1000)
      await vi.runAllTimersAsync()

      // 等待两个 Promise settle
      await Promise.allSettled([p1, p2])

      // 第二次请求的结果生效
      expect(fetchFn).toHaveBeenCalledTimes(2)
    })
  })

  // --- 错误处理 ---

  describe('错误处理', () => {
    it('非取消错误会被抛出', async () => {
      const fetchFn = vi.fn().mockRejectedValue(new Error('Server error'))
      const { load } = useTableLoader({ fetchFn })

      await expect(load()).rejects.toThrow('Server error')
    })

    it('取消错误被静默处理', async () => {
      const fetchFn = vi.fn().mockRejectedValue({ name: 'CanceledError', code: 'ERR_CANCELED' })
      const { load } = useTableLoader({ fetchFn })

      // 不应抛出
      await load()
    })
  })

  // --- 卸载清理 ---

  /**
   * debouncedReload 排的那个延时器原来由 useDebounceFn 持有，句柄封在闭包里、
   * 也不暴露 cancel，卸载时取消不掉。它随后触发会重新走一遍 reload，而那条 Promise
   * 没有任何 handler：mock 在用例之间被 reset 后 fetchFn 返回 undefined，
   * `response.items` 抛 TypeError，就成了整套跑里间歇出现、且没有归属用例的
   * "Unhandled Rejection"。
   *
   * 本文件把 onUnmounted mock 成了 vi.fn()，所以这里直接取出注册的清理回调来模拟卸载。
   */
  describe('卸载清理', () => {
    const triggerUnmount = () => {
      const calls = vi.mocked(onUnmounted).mock.calls
      const handler = calls.at(-1)?.[0]
      expect(handler).toBeTypeOf('function')
      ;(handler as () => void)()
    }

    it('卸载时取消待触发的 debouncedReload 延时器', async () => {
      const fetchFn = createMockFetchFn([{ id: 1 }], 1, 1)
      const { debouncedReload } = useTableLoader({ fetchFn })

      debouncedReload()
      expect(vi.getTimerCount()).toBe(1)

      triggerUnmount()
      expect(vi.getTimerCount()).toBe(0)

      // 延时器已经掐掉：推进时间不得再发请求，也不得抛错。
      await vi.runAllTimersAsync()
      expect(fetchFn).not.toHaveBeenCalled()
    })

    it('卸载后新排的 debouncedReload 不会再排延时器', async () => {
      const fetchFn = createMockFetchFn()
      const { debouncedReload } = useTableLoader({ fetchFn })

      triggerUnmount()
      debouncedReload()

      expect(vi.getTimerCount()).toBe(0)
      await vi.runAllTimersAsync()
      expect(fetchFn).not.toHaveBeenCalled()
    })

    it('卸载后 load 直接返回，不再发请求', async () => {
      // undefined 就是 mock 被 reset 之后的返回形状：原来会在 response.items 上抛。
      const fetchFn = vi.fn().mockResolvedValue(undefined)
      const { load, items } = useTableLoader({ fetchFn })

      triggerUnmount()

      await expect(load()).resolves.toBeUndefined()
      expect(fetchFn).not.toHaveBeenCalled()
      expect(items.value).toEqual([])
    })

    it('飞行中的请求在卸载后 resolve：不写 ref、不抛错', async () => {
      // Promise 的 continuation 取消不掉，只能用世代号在异步边界比对后直接退出。
      let resolveFetch!: (value: unknown) => void
      const fetchFn = vi.fn(() => new Promise((resolve) => { resolveFetch = resolve }))
      const { load, items, loading } = useTableLoader({ fetchFn })

      const pending = load()
      expect(loading.value).toBe(true)

      triggerUnmount()
      resolveFetch(undefined)

      await expect(pending).resolves.toBeUndefined()
      expect(items.value).toEqual([])
    })

    it('飞行中的请求在卸载后失败：错误不再抛给无人接管的调用方', async () => {
      let rejectFetch!: (reason: unknown) => void
      const fetchFn = vi.fn(() => new Promise((_resolve, reject) => { rejectFetch = reject }))
      const { load } = useTableLoader({ fetchFn })

      const pending = load()

      triggerUnmount()
      rejectFetch(new Error('Server error'))

      await expect(pending).resolves.toBeUndefined()
    })
  })
})
