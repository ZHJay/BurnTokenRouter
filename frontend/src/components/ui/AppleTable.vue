<template>
  <div class="table-container">
    <table class="table">
      <thead v-if="$slots.head">
        <tr>
          <slot name="head" />
        </tr>
      </thead>
      <tbody>
        <slot />
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
// 苹果风表格外壳：仅提供 token 化容器/表头样式，列/行由使用方通过 head/default 插槽填充。
</script>
