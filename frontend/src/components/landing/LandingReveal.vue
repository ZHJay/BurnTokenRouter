<template>
  <component :is="as" ref="target" class="lp-reveal" :class="{ 'is-in': revealed }" :style="delayStyle">
    <slot />
  </component>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useReveal } from './useReveal'

const props = withDefaults(defineProps<{
  /** 交错入场延迟（毫秒）。非颜色值，可安全内联 */
  delay?: number
  /**
   * 渲染成什么标签。默认 div；在 <ul>/<ol> 里必须传 "li"。
   * 原因：ul/ol 的合法子元素只有 li/script/template，中间夹一层 div
   * 会切断无障碍树里 list → listitem 的归属关系，读屏可能报「空列表」
   * 或丢失条目数。视觉上完全看不出来（div 变成了 grid item），所以极易漏。
   */
  as?: string
}>(), { delay: 0, as: 'div' })

const { target, revealed } = useReveal()

const delayStyle = computed(() =>
  props.delay > 0 ? { transitionDelay: `${props.delay}ms` } : undefined
)
</script>

<style scoped>
.lp-reveal {
  opacity: 0;
  transform: translateY(14px);
  transition: opacity 0.55s var(--ease), transform 0.55s var(--ease);
}

.lp-reveal.is-in {
  opacity: 1;
  transform: none;
}

/* 减少动效：直接呈现终态，不依赖 JS，也不留隐藏内容 */
@media (prefers-reduced-motion: reduce) {
  .lp-reveal {
    opacity: 1;
    transform: none;
    transition: none;
    transition-delay: 0ms !important;
  }
}
</style>
