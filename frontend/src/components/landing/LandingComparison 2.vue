<template>
  <LandingReveal>
    <div class="lp-cmp">
      <!-- 横滚容器：375px 下三列中文表格必然超宽，走横滚而不是压字 -->
      <div class="lp-cmp-scroll">
        <table class="lp-cmp-table">
          <thead>
            <tr>
              <th scope="col" class="lp-col-feature">
                {{ t('home.comparison.headers.feature') }}
              </th>
              <th scope="col">{{ t('home.comparison.headers.official') }}</th>
              <th scope="col" class="lp-col-us">
                <!-- flex 挂在单元格内层 div 上，绝不挂 th -->
                <div class="lp-us-head">
                  <span class="lp-us-dot"></span>
                  <span>{{ t('home.comparison.headers.us') }}</span>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row">
              <th scope="row" class="lp-col-feature">
                {{ t(`home.comparison.items.${row}.feature`) }}
              </th>
              <td class="lp-cell-official">
                {{ t(`home.comparison.items.${row}.official`) }}
              </td>
              <td class="lp-col-us">
                <div class="lp-us-cell">
                  <Icon name="checkCircle" size="sm" class="lp-us-icon" />
                  <span>{{ t(`home.comparison.items.${row}.us`) }}</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </LandingReveal>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'
import LandingReveal from './LandingReveal.vue'

const { t } = useI18n()

const rows = ['pricing', 'models', 'management', 'stability', 'control'] as const
</script>

<style scoped>
.lp-cmp {
  border-radius: var(--r-lg);
  background: var(--bg-elevated);
  border: 0.5px solid var(--separator);
  box-shadow: var(--shadow-card);
  overflow: hidden;
}

.lp-cmp-scroll {
  width: 100%;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.lp-cmp-table {
  width: 100%;
  /* 三列中文在窄屏必然超宽：给下限并交给容器横滚 */
  min-width: 560px;
  border-collapse: collapse;
  font-size: 14px;
}

.lp-cmp-table th,
.lp-cmp-table td {
  padding: 15px 16px;
  text-align: left;
  vertical-align: top;
  border-bottom: 0.5px solid var(--separator);
}

.lp-cmp-table thead th {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  background: var(--fill);
  white-space: nowrap;
}

.lp-cmp-table tbody tr:last-child th,
.lp-cmp-table tbody tr:last-child td {
  border-bottom: none;
}

.lp-col-feature {
  width: 22%;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.lp-cell-official {
  color: var(--text-secondary);
}

/* "本平台"列：淡蓝底强调 */
.lp-col-us {
  background: var(--blue-soft);
  color: var(--text-primary);
}

.lp-us-head {
  display: flex;
  align-items: center;
  gap: 7px;
  color: var(--blue);
  font-weight: 700;
}

.lp-us-dot {
  width: 7px;
  height: 7px;
  flex: none;
  border-radius: 50%;
  background: var(--blue);
}

.lp-us-cell {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  min-width: 0;
}

.lp-us-icon {
  flex: none;
  margin-top: 2px;
  color: var(--blue);
}

@media (max-width: 768px) {
  .lp-cmp-table th,
  .lp-cmp-table td {
    padding: 13px 14px;
  }
}
</style>
