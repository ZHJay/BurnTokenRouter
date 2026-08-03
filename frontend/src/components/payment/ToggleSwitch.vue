<template>
  <label class="flex flex-col items-center gap-0.5 cursor-pointer">
    <span class="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{{ label }}</span>
    <button
      type="button"
      role="switch"
      :aria-checked="checked"
      @click="emit('toggle')"
      :class="[
        'relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors duration-fast ease-apple-out',
        'focus-visible:outline-none focus-visible:ring-[3.5px] focus-visible:ring-[color:var(--accent-tint-strong)]',
        checked ? 'bg-green-500' : 'bg-gray-300 dark:bg-dark-600',
      ]"
    >
      <!-- 位移必须走 .switch-thumb：prefers-reduced-motion 下的
           `transform: none !important` 清单只放行这个类，裸 translate-x-4 会被
           清掉，开/关退化成仅颜色差异（违反 1.4.1）。该类只中和过渡时长。
           尺寸比标准 switch 小一档，故覆盖 h/w；.switch-active .switch-thumb
           是双类选择器 (0,2,0)，单类工具类压不过，ON 态位移用 ! 提权。
           轨道去掉了 border-2 border-transparent —— .switch-thumb 是绝对定位，
           left/top 相对 padding box，留边框会让滑块偏移 2px 并溢出轨道高度。 -->
      <span :class="[
        'switch-thumb pointer-events-none h-4 w-4',
        checked ? '!translate-x-4' : 'translate-x-0',
      ]" />
    </button>
  </label>
</template>

<script setup lang="ts">
defineProps<{ label: string; checked: boolean }>()
const emit = defineEmits<{ toggle: [] }>()
</script>
