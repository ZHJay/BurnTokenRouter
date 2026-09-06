/**
 * useReveal —— 首屏之下区块的入场观察器。
 *
 * 设计约束（Phase C）：
 * 1. 只输出一个布尔量，由调用方决定挂 CSS 类；**绝不用于 v-if 控制渲染**。
 *    原因：`src/__tests__/setup.ts` 把 IntersectionObserver mock 成 observe() 空实现，
 *    回调永不触发。若用 v-if 门控，全部文案断言都会查不到节点。
 * 2. 三条降级路径一律直接置为已入场，保证内容在任何环境下都可见：
 *    无 window / 无 IntersectionObserver（SSR、jsdom）、用户要求减少动效、observe() 抛错。
 * 3. 尊重 prefers-reduced-motion：命中时不建观察器，直接可见。
 */
import { onBeforeUnmount, onMounted, ref } from 'vue'

export interface UseRevealOptions {
  /** 提前/延后触发的边距，默认让区块露出一点再入场 */
  rootMargin?: string
  /** 触发所需的可见比例 */
  threshold?: number
  /** 入场后是否停止观察（默认 true，只播一次） */
  once?: boolean
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

export function useReveal(options: UseRevealOptions = {}) {
  const { rootMargin = '0px 0px -8% 0px', threshold = 0.08, once = true } = options

  const target = ref<HTMLElement | null>(null)
  const revealed = ref(false)
  let observer: IntersectionObserver | null = null

  function stop() {
    observer?.disconnect()
    observer = null
  }

  onMounted(() => {
    if (
      typeof window === 'undefined' ||
      typeof IntersectionObserver === 'undefined' ||
      prefersReducedMotion()
    ) {
      revealed.value = true
      return
    }

    const el = target.value
    if (!el) {
      revealed.value = true
      return
    }

    try {
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              revealed.value = true
              if (once) stop()
            } else if (!once) {
              revealed.value = false
            }
          }
        },
        { rootMargin, threshold }
      )
      observer.observe(el)
    } catch {
      // 观察器不可用时保持内容可见，宁可不播动画也不能藏内容
      stop()
      revealed.value = true
    }
  })

  onBeforeUnmount(stop)

  return { target, revealed }
}
