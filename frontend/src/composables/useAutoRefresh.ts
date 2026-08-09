import { ref, onBeforeUnmount, type Ref } from 'vue'

export interface UseAutoRefreshOptions {
  storageKey: string
  intervals?: readonly number[]
  defaultInterval?: number
  onRefresh: () => Promise<void> | void
  /** Skip tick when this returns true (e.g. modal open, document hidden). */
  shouldPause?: () => boolean
}

export function useAutoRefresh(options: UseAutoRefreshOptions) {
  const {
    storageKey,
    intervals = [5, 10, 15, 30] as const,
    defaultInterval,
    onRefresh,
    shouldPause,
  } = options

  // 调用方未显式提供 shouldPause 时，默认在页面隐藏（后台标签页）时暂停刷新
  const pauseWhenHidden = shouldPause ?? (() => document.hidden)

  const enabled = ref(false)
  const intervalSeconds = ref(defaultInterval ?? intervals[intervals.length - 1])
  const countdown = ref(0)
  const fetching = ref(false)

  let timerId: number | undefined
  let visibilityListenerAttached = false

  function loadFromStorage() {
    try {
      const saved = localStorage.getItem(storageKey)
      if (!saved) return
      const parsed = JSON.parse(saved) as { enabled?: boolean; interval_seconds?: number }
      enabled.value = parsed.enabled === true
      const iv = Number(parsed.interval_seconds)
      if (intervals.includes(iv as any)) intervalSeconds.value = iv
    } catch { /* ignore */ }
  }

  function saveToStorage() {
    try {
      localStorage.setItem(storageKey, JSON.stringify({
        enabled: enabled.value,
        interval_seconds: intervalSeconds.value,
      }))
    } catch { /* ignore */ }
  }

  async function tick() {
    if (!enabled.value) return
    if (pauseWhenHidden()) return
    if (fetching.value) return

    if (countdown.value <= 0) {
      countdown.value = intervalSeconds.value
      fetching.value = true
      try { await onRefresh() } finally { fetching.value = false }
      return
    }
    countdown.value -= 1
  }

  /**
   * 页面可见性变化：hidden 时停表（后台标签页不再空转），visible 时恢复
   */
  function handleVisibilityChange(): void {
    if (typeof document === 'undefined') return
    if (document.hidden) {
      if (timerId !== undefined) {
        clearInterval(timerId)
        timerId = undefined
      }
    } else if (enabled.value) {
      start()
    }
  }

  function attachVisibilityListener(): void {
    if (visibilityListenerAttached || typeof document === 'undefined') return
    visibilityListenerAttached = true
    document.addEventListener('visibilitychange', handleVisibilityChange)
  }

  function detachVisibilityListener(): void {
    if (!visibilityListenerAttached || typeof document === 'undefined') return
    visibilityListenerAttached = false
    document.removeEventListener('visibilitychange', handleVisibilityChange)
  }

  function start() {
    if (timerId !== undefined) return
    attachVisibilityListener()
    timerId = setInterval(tick, 1000) as unknown as number
  }

  function stop() {
    if (timerId !== undefined) {
      clearInterval(timerId)
      timerId = undefined
    }
    detachVisibilityListener()
  }

  function setEnabled(value: boolean) {
    enabled.value = value
    saveToStorage()
    if (value) {
      countdown.value = intervalSeconds.value
      start()
    } else {
      stop()
      countdown.value = 0
    }
  }

  function setInterval_(seconds: number) {
    intervalSeconds.value = seconds
    saveToStorage()
    if (enabled.value) countdown.value = seconds
  }

  function resetCountdown() {
    countdown.value = intervalSeconds.value
  }

  loadFromStorage()

  onBeforeUnmount(stop)

  return {
    enabled: enabled as Ref<boolean>,
    intervalSeconds: intervalSeconds as Ref<number>,
    countdown: countdown as Ref<number>,
    fetching: fetching as Ref<boolean>,
    intervals,
    setEnabled,
    setInterval: setInterval_,
    resetCountdown,
    start,
    stop,
  }
}
