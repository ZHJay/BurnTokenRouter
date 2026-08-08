<template>
  <div class="plaza-card-grid">
    <PlazaModelCard
      v-for="m in sortedModels"
      :key="m.name"
      :model="m"
      :platform="platform"
      :rate-multiplier="rateMultiplier"
      :user-rate-multiplier="userRateMultiplier ?? null"
      :image-rate-independent="imageRateIndependent"
      :image-rate-multiplier="imageRateMultiplier"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import PlazaModelCard from './PlazaModelCard.vue'
import { sortPlazaModels } from './pricing'
import type { PlazaModel } from '@/api/modelPlaza'

const props = defineProps<{
  models: PlazaModel[]
  platform?: string
  rateMultiplier: number
  userRateMultiplier?: number | null
  imageRateIndependent?: boolean
  imageRateMultiplier?: number | null
}>()

/** 与表格视图共用排序，两个视图的模型顺序必须一致。 */
const sortedModels = computed(() => sortPlazaModels(props.models))
</script>

<style scoped>
/*
 * auto-fill + minmax：375px 单列、768px 双列、1440px 三～四列，无需断点媒体查询。
 * 轨道下限 240px 是「模型名 + 价格行」不挤压的最小可读宽度；
 * 375px 视口去掉 .page 的 16px 左右内边距后仍有 ~311px，单列成立。
 */
.plaza-card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 12px;
  padding: 16px;
  min-width: 0;
}
</style>
