<template>
  <button
    type="button"
    @click="toggle"
    class="switch"
    :class="{ on: modelValue }"
    role="switch"
    :aria-checked="modelValue"
  >
    <span class="knob" aria-hidden="true" />
  </button>
</template>

<script setup lang="ts">
const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

function toggle() {
  emit('update:modelValue', !props.modelValue)
}
</script>

<style scoped>
/* 契约镜像：apple-theme.css 的 iOS .switch */
.switch {
  width: 40px;
  height: 24px;
  border-radius: var(--r-pill);
  background: var(--fill-hover);
  position: relative;
  cursor: pointer;
  transition: background 0.28s var(--ease);
  border: none;
  flex-shrink: 0;
  padding: 0;
  display: inline-block;
}

.switch.on {
  background: var(--green);
}

.switch .knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  transition: transform 0.28s var(--ease);
}

.switch.on .knob {
  transform: translateX(16px);
}

/* 无障碍：键盘焦点使用房子风格 4px 蓝环 */
.switch:focus-visible {
  outline: none;
  box-shadow: 0 0 0 4px var(--blue-soft);
}

@media (prefers-reduced-motion: reduce) {
  .switch,
  .switch .knob {
    transition-duration: 0.01ms;
  }
}
</style>
