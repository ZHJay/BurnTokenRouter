<script setup lang="ts">
interface Props {
  fullscreen?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  fullscreen: false
})
</script>

<template>
  <div class="space-y-6">
    <!-- Header (matches OpsDashboardHeader + overview blocks) -->
    <div :class="['card', props.fullscreen ? 'p-8' : 'p-6']">
      <div class="flex flex-wrap items-center justify-between gap-4 pb-4 shadow-[inset_0_-0.5px_0_var(--separator)]">
        <div class="space-y-2">
          <div class="skeleton h-6 w-44"></div>
          <div class="skeleton h-3 w-80 max-w-full opacity-60"></div>
        </div>
        <div v-if="!props.fullscreen" class="flex flex-wrap items-center gap-3">
          <div class="skeleton h-9 w-[140px] rounded-lg"></div>
          <div class="skeleton h-9 w-[160px] rounded-lg"></div>
          <div class="skeleton h-9 w-[150px] rounded-lg"></div>
          <!-- 圆形骨架对应工具栏的图标按钮（rounded-full） -->
          <div class="skeleton h-9 w-9 rounded-full"></div>
          <div class="skeleton h-9 w-28 rounded-full"></div>
          <div class="skeleton h-9 w-28 rounded-full"></div>
          <div class="skeleton h-9 w-9 rounded-full"></div>
        </div>
      </div>

      <div class="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div class="card-inset p-4 lg:col-span-5">
          <div class="grid h-full grid-cols-1 gap-6 md:grid-cols-[200px_1fr] md:items-center">
            <div class="skeleton h-28 rounded-lg opacity-60"></div>
            <div class="space-y-4">
              <div class="skeleton h-4 w-32"></div>
              <div class="grid grid-cols-2 gap-3">
                <div v-for="i in 4" :key="i" class="skeleton h-14 rounded-lg opacity-60"></div>
              </div>
            </div>
          </div>
        </div>

        <div class="lg:col-span-7">
          <div class="grid h-full grid-cols-1 content-center gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div v-for="i in 6" :key="i" class="skeleton h-20 rounded-xl opacity-60"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Row: Concurrency + Throughput (matches OpsDashboard.vue) -->
    <div class="grid grid-cols-1 gap-6 lg:grid-cols-4">
      <div :class="['card min-h-[360px] lg:col-span-1', props.fullscreen ? 'p-8' : 'p-6']">
        <div class="skeleton h-4 w-44"></div>
        <div class="skeleton mt-6 h-72 rounded-xl opacity-60"></div>
      </div>
      <div :class="['card min-h-[360px] lg:col-span-1', props.fullscreen ? 'p-8' : 'p-6']">
        <div class="skeleton h-4 w-44"></div>
        <div class="skeleton mt-6 h-72 rounded-xl opacity-60"></div>
      </div>
      <div :class="['card min-h-[360px] lg:col-span-2', props.fullscreen ? 'p-8' : 'p-6']">
        <div class="skeleton h-4 w-56"></div>
        <div class="skeleton mt-6 h-72 rounded-xl opacity-60"></div>
      </div>
    </div>

    <!-- Row: Visual Analysis (baseline 3-up grid) -->
    <div class="grid grid-cols-1 gap-6 md:grid-cols-3">
      <div
        v-for="i in 3"
        :key="i"
        :class="['card', props.fullscreen ? 'p-8' : 'p-6']"
      >
        <div class="skeleton h-4 w-44"></div>
        <div class="skeleton mt-6 h-56 rounded-xl opacity-60"></div>
      </div>
    </div>

    <!-- Alert Events -->
    <div :class="['card', props.fullscreen ? 'p-8' : 'p-6']">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div class="skeleton h-4 w-48"></div>
        <div v-if="!props.fullscreen" class="flex flex-wrap items-center gap-2">
          <div class="skeleton h-9 w-[140px] rounded-lg"></div>
          <div class="skeleton h-9 w-[120px] rounded-lg"></div>
          <div class="skeleton h-9 w-[120px] rounded-lg"></div>
        </div>
      </div>

      <div class="mt-6 space-y-3">
        <div v-for="i in 6" :key="i" class="card-inset flex items-center justify-between gap-4 rounded-xl p-4">
          <div class="flex-1 space-y-2">
            <div class="skeleton h-3 w-56"></div>
            <div class="skeleton h-3 w-80 max-w-full opacity-60"></div>
          </div>
          <div class="skeleton h-7 w-20 rounded-full"></div>
        </div>
      </div>
    </div>
  </div>
</template>
