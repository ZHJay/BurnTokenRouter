import { ref, reactive, onUnmounted, toRaw } from 'vue'
import type { BasePaginationResponse, FetchOptions } from '@/types'
import { getPersistedPageSize, setPersistedPageSize } from './usePersistedPageSize'

interface PaginationState {
  page: number
  page_size: number
  total: number
  pages: number
}

interface TableLoaderOptions<T, P> {
  fetchFn: (page: number, pageSize: number, params: P, options?: FetchOptions) => Promise<BasePaginationResponse<T>>
  initialParams?: P
  pageSize?: number
  debounceMs?: number
}

/**
 * 通用表格数据加载 Composable
 * 统一处理分页、筛选、搜索防抖和请求取消
 */
export function useTableLoader<T, P extends Record<string, any>>(options: TableLoaderOptions<T, P>) {
  const { fetchFn, initialParams, pageSize, debounceMs = 300 } = options

  const items = ref<T[]>([])
  const loading = ref(false)
  const params = reactive<P>({ ...(initialParams || {}) } as P)
  const pagination = reactive<PaginationState>({
    page: 1,
    page_size: pageSize ?? getPersistedPageSize(),
    total: 0,
    pages: 0
  })

  let abortController: AbortController | null = null

  /**
   * 卸载后的取消状态。
   *
   * debouncedReload 排的是一个 debounceMs 延时器，而 useDebounceFn（vueuse 10.11）
   * 不暴露 cancel，句柄封在闭包里谁都取消不掉：组件卸载后它照样触发，重新发一次请求
   * 并往已销毁的 ref 上写。更要紧的是它 resolve 的那个 Promise 没有任何 handler，
   * reload 一旦失败就直接变成 unhandled rejection —— 测试里就表现为延时器在用例之间
   * （或拆环境之后）才触发，此时 mock 已被 reset，fetchFn 返回 undefined，
   * `response.items` 抛 TypeError 且没有归属用例。
   *
   * 所以这里自己持有延时器句柄；请求的 Promise continuation 取消不了，改用 runId
   * 世代号在每个异步边界比对，世代变了就直接退出。
   */
  let loadRunId = 0
  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  let disposed = false

  function dispose() {
    disposed = true
    loadRunId++
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer)
      debounceTimer = null
    }
    abortController?.abort()
    abortController = null
  }

  const isAbortError = (error: any) => {
    return error?.name === 'AbortError' || error?.code === 'ERR_CANCELED' || error?.name === 'CanceledError'
  }

  const load = async () => {
    if (disposed) return
    const runId = loadRunId

    if (abortController) {
      abortController.abort()
    }
    const currentController = new AbortController()
    abortController = currentController
    loading.value = true

    try {
      const response = await fetchFn(
        pagination.page,
        pagination.page_size,
        toRaw(params) as P,
        { signal: currentController.signal }
      )

      // 已卸载：不写 ref，也不把错误再抛出去（没人接）。
      if (runId !== loadRunId) return

      items.value = response.items || []
      pagination.total = response.total || 0
      pagination.pages = response.pages || 0
    } catch (error) {
      if (runId !== loadRunId) return
      if (!isAbortError(error)) {
        console.error('Table load error:', error)
        throw error
      }
    } finally {
      if (abortController === currentController) {
        loading.value = false
      }
    }
  }

  const reload = () => {
    pagination.page = 1
    return load()
  }

  const debouncedReload = () => {
    if (disposed) return
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer)
    }
    debounceTimer = setTimeout(() => {
      debounceTimer = null
      if (disposed) return
      // 延时器里创建的 Promise 没有外部持有者，rejection 必须自己兜住，否则就是
      // unhandled rejection。load 已经在 catch 里打过日志，这里不重复。
      void reload().catch(() => {})
    }, debounceMs)
  }

  const handlePageChange = (page: number) => {
    // 确保页码在有效范围内
    const validPage = Math.max(1, Math.min(page, pagination.pages || 1))
    pagination.page = validPage
    load()
  }

  const handlePageSizeChange = (size: number) => {
    pagination.page_size = size
    pagination.page = 1
    setPersistedPageSize(size)
    load()
  }

  onUnmounted(() => {
    dispose()
  })

  return {
    items,
    loading,
    params,
    pagination,
    load,
    reload,
    debouncedReload,
    handlePageChange,
    handlePageSizeChange
  }
}
