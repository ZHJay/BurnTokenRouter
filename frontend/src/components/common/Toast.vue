<template>
  <Teleport to="body">
    <div class="pointer-events-none fixed right-4 top-4 z-[9999]">
      <!-- 两个 live region,都始终挂载。

           始终挂载是必须的:辅助技术只播报它*已经在观察*的区域内发生的变化,
           跟着第一条消息一起插入 DOM 的 region 通常整块被漏掉。

           为什么分两个:error 走 assertive(role="alert"),其余走 polite。
           politeness 无法在已存在的 region 上可靠切换,所以按通道分区域 ——
           失败提示不必排在正在朗读的成功提示后面(WCAG 4.1.3)。

           aria-atomic 显式为 false:role="alert" 隐含 aria-atomic="true",
           留着会让每条新 toast 连带把当前所有 toast 重新播报一遍。原子边界
           下移到单条 toast 上。 -->
      <div
        v-for="region in regions"
        :key="region.key"
        :data-toast-region="region.key"
        :role="region.role"
        :aria-live="region.live"
        aria-atomic="false"
      >
        <TransitionGroup
          enter-active-class="transition ease-spring duration-base"
          enter-from-class="opacity-0 translate-x-full"
          enter-to-class="opacity-100 translate-x-0"
          leave-active-class="transition ease-apple-out duration-fast"
          leave-from-class="opacity-100 translate-x-0"
          leave-to-class="opacity-0 translate-x-full"
        >
          <div
            v-for="toast in region.toasts"
            :key="toast.id"
            :class="[
              'toast-item pointer-events-auto mb-3 min-w-[320px] max-w-md overflow-hidden rounded-xl',
              'shadow-glass-edge',
              'border-l-[3px] border-solid',
              getBorderColor(toast.type)
            ]"
            aria-atomic="true"
            @mouseenter="appStore.pauseToast(toast.id)"
            @mouseleave="appStore.resumeToast(toast.id)"
            @focusin="appStore.pauseToast(toast.id)"
            @focusout="handleFocusOut(toast.id, $event)"
          >
            <div class="p-4">
              <div class="flex items-start gap-3">
                <!-- Icon -->
                <div class="mt-0.5 flex-shrink-0">
                  <Icon
                    :name="getToastIconName(toast.type)"
                    size="md"
                    :class="getIconColor(toast.type)"
                    aria-hidden="true"
                  />
                </div>

                <!-- Content -->
                <div class="min-w-0 flex-1">
                  <p v-if="toast.title" class="text-sm font-semibold text-gray-900 dark:text-white">
                    {{ toast.title }}
                  </p>
                  <p
                    :class="[
                      'text-sm leading-relaxed',
                      toast.title
                        ? 'mt-1 text-gray-600 dark:text-gray-300'
                        : 'text-gray-900 dark:text-white'
                    ]"
                  >
                    {{ toast.message }}
                  </p>
                </div>

                <!-- Close button -->
                <button
                  @click="removeToast(toast.id)"
                  class="btn btn-ghost btn-icon -m-1 flex-shrink-0 p-1"
                  aria-label="Close notification"
                >
                  <Icon name="x" size="sm" />
                </button>
              </div>
            </div>

            <!-- Progress bar -->
            <div v-if="toast.duration" class="h-1 bg-gray-200 dark:bg-dark-700">
              <div
                :class="['h-full toast-progress', getProgressBarColor(toast.type)]"
                :style="{ animationDuration: `${toast.duration}ms` }"
              ></div>
            </div>
          </div>
        </TransitionGroup>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import Icon from '@/components/icons/Icon.vue'
import { useAppStore } from '@/stores/app'
import type { Toast as ToastMessage } from '@/types'

/** 一个播报通道。role 只出现在 assertive 通道上,polite 通道保持裸 aria-live。 */
interface ToastRegion {
  key: 'assertive' | 'polite'
  role?: 'alert'
  live: 'assertive' | 'polite'
  toasts: ToastMessage[]
}

const appStore = useAppStore()

const toasts = computed(() => appStore.toasts)

/* error 排在前面,所以它挨着右上角的锚点。代价是混合栈不再严格按时间排序 ——
   这是分通道的必然结果,两个 region 无法交错。 */
const regions = computed<ToastRegion[]>(() => [
  {
    key: 'assertive',
    role: 'alert',
    live: 'assertive',
    toasts: toasts.value.filter((toast) => toast.type === 'error')
  },
  {
    key: 'polite',
    live: 'polite',
    toasts: toasts.value.filter((toast) => toast.type !== 'error')
  }
])

const getToastIconName = (type: string): 'checkCircle' | 'xCircle' | 'exclamationTriangle' | 'infoCircle' => {
  switch (type) {
    case 'success':
      return 'checkCircle'
    case 'error':
      return 'xCircle'
    case 'warning':
      return 'exclamationTriangle'
    case 'info':
    default:
      return 'infoCircle'
  }
}

const getIconColor = (type: string): string => {
  const colors: Record<string, string> = {
    success: 'text-green-500',
    error: 'text-red-500',
    warning: 'text-orange-500',
    info: 'text-blue-500'
  }
  return colors[type] || colors.info
}

const getBorderColor = (type: string): string => {
  const colors: Record<string, string> = {
    success: 'toast-success',
    error: 'toast-error',
    warning: 'toast-warning',
    info: 'toast-info'
  }
  return colors[type] || colors.info
}

const getProgressBarColor = (type: string): string => {
  const colors: Record<string, string> = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    warning: 'bg-orange-500',
    info: 'bg-blue-500'
  }
  return colors[type] || colors.info
}

const removeToast = (id: string) => {
  appStore.hideToast(id)
}

/**
 * 焦点在同一条 toast 内部移动时不算离开,不恢复倒计时。
 * 目前每条 toast 只有一个可聚焦元素,这条判断是防御性的。
 */
const handleFocusOut = (id: string, event: FocusEvent) => {
  const next = event.relatedTarget
  const current = event.currentTarget
  if (next instanceof Node && current instanceof HTMLElement && current.contains(next)) return
  appStore.resumeToast(id)
}
</script>

<style scoped>
/* 面板本体:不透明填充 + shadow-glass-edge 的四层玻璃边缘。

   为什么不用 thin 材质:toast teleport 到 body 且 z-[9999],逃出了 modal 的
   backdrop root,所以它会把下面那层 modal 材质真的再模糊一次。实测单层 thin
   均值 218.5,thin 叠 thin 是 248.6 —— 比纯白填充还亮,因为 --mat-diffuse 里的
   brightness(1.06) 生效了两次,表面不再读作材质。Toast 是全局挂载的
   (App.vue),任何从 modal 保存回调里弹出的 toast 都落在这个状态,调用点无法
   预先排除。

   与 Select.vue 弹层同一判断:每条 toast 都叠在别的 chrome 上,答案永远相同,
   所以判断放在这一处。只换填充与模糊,保留四层边缘与 --shadow-3。
   backdrop-filter: none 显式写出 —— scoped 选择器特异性更高,能挡住 .glass-thin
   或 .toast 日后被加回来时重新带进的模糊。 */
.toast-item {
  background: var(--surface);
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

/* 高对比:明确描边。

   这条不是新增能力,是补回被 Task 5 顺带拿走的东西:原先元素上带 .glass-thin,
   而 style.css 的 prefers-contrast 分支把 .glass-thin 列在清单里,所以 toast
   当时是靠那个类拿到 1px 描边的。既然改成不透明填充、不再需要 .glass-thin,
   描边就得在这里显式写回,否则高对比用户会只剩 0.5px 的玻璃发丝边。

   与 style.css 同分支同值(inset 0 0 0 1px var(--label)),不新造颜色。
   scoped 选择器 (0,2,0) 本已胜过 .shadow-glass-edge (0,1,0),!important 只是
   与 style.css 同分支的写法对齐,并保证这是可访问性分支必赢。 */
@media (prefers-contrast: more) {
  .toast-item {
    box-shadow: inset 0 0 0 1px var(--label) !important;
  }
}

.toast-progress {
  width: 100%;
  animation-name: toast-progress-shrink;
  animation-timing-function: linear;
  animation-fill-mode: forwards;
}

/* 倒计时暂停时进度条同步停住,否则进度条会谎报剩余时间。
   与 store 的 pauseToast / resumeToast 由同一组交互触发。 */
.toast-item:hover .toast-progress,
.toast-item:focus-within .toast-progress {
  animation-play-state: paused;
}

@keyframes toast-progress-shrink {
  from {
    width: 100%;
  }
  to {
    width: 0%;
  }
}

/* toast 动效的唯一归属方。

   为什么覆盖写在这里,而不是给元素加 .toast 类去命中 style.css 里既有的
   reduced-motion 规则:.toast 自带 position: fixed / right / top / z-[100]
   与 animate-slide-in-right。容器已经负责定位与堆叠,fixed 会把多条 toast
   叠到同一坐标;那条 keyframes 入场动画又会与本组件的 TransitionGroup 构成
   两套并行动效。把覆盖放在 TransitionGroup 实际动画的那个元素上,动效只有
   一个归属方。

   toast 是唯一无需用户触发就出现的组件,对前庭敏感用户是最坏情况:整宽横移
   (translate-x-full)必须去掉。淡入保留 —— 减弱动效不等于没有反馈,与
   style.css 的 rm-fade-in 取向一致。

   进度条不在此处停:它不位移,只收窄宽度,且剩余时间是信息而非装饰
   (与保留 animate-spin 同一取向)。 */
@media (prefers-reduced-motion: reduce) {
  .toast-item {
    transform: none !important;
    transition-duration: 120ms !important;
    transition-timing-function: var(--ease-out) !important;
  }
}
</style>
