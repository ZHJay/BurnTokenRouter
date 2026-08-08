<template>
  <!--
    控制台预览：纯 CSS 绘制的产品视觉区（不是真实数据，也不是截图文件）。
    走 CSS 而非图片的理由：站点名可配、明暗双模式都要成品级、且不能引入 logo/截图资源。
    整块视觉对读屏隐藏，另给一条 caption 文本承担语义。
  -->
  <figure class="lp-preview">
    <div class="lp-window" aria-hidden="true">
      <!-- 窗口标题栏 -->
      <div class="lp-window-bar">
        <div class="lp-dots">
          <span class="lp-dot-red"></span>
          <span class="lp-dot-amber"></span>
          <span class="lp-dot-green"></span>
        </div>
        <div class="lp-window-title">{{ t('home.preview.windowTitle') }}</div>
      </div>

      <!-- 48px 顶栏的缩略呼应：纯文字 wordmark + 导航胶囊 -->
      <div class="lp-gn">
        <span class="lp-gn-wordmark">{{ siteName }}</span>
        <nav class="lp-gn-links">
          <span class="lp-gn-link is-active">{{ t('home.preview.nav.overview') }}</span>
          <span class="lp-gn-link">{{ t('home.preview.nav.keys') }}</span>
          <span class="lp-gn-link">{{ t('home.preview.nav.usage') }}</span>
        </nav>
      </div>

      <div class="lp-window-body">
        <!-- 统计卡 -->
        <div class="lp-stats">
          <div v-for="stat in stats" :key="stat.key" class="lp-stat">
            <span class="lp-stat-label">{{ t(`home.preview.stats.${stat.key}`) }}</span>
            <span class="lp-stat-value">{{ stat.value }}</span>
            <span class="lp-stat-trend" :class="stat.tone">{{ stat.delta }}</span>
          </div>
        </div>

        <div class="lp-panels">
          <!-- 柱状图 -->
          <div class="lp-panel">
            <p class="lp-panel-title">{{ t('home.preview.chartTitle') }}</p>
            <div class="lp-bars">
              <span
                v-for="(h, i) in bars"
                :key="i"
                class="lp-bar"
                :class="{ 'is-peak': i === bars.length - 1 }"
                :style="{ height: `${h}%` }"
              ></span>
            </div>
          </div>

          <!-- 模型明细表 -->
          <div class="lp-panel">
            <p class="lp-panel-title">{{ t('home.preview.tableTitle') }}</p>
            <div class="lp-table-scroll">
              <table class="lp-table">
                <thead>
                  <tr>
                    <th scope="col">{{ t('home.preview.tableHeaders.model') }}</th>
                    <th scope="col" class="is-num">{{ t('home.preview.tableHeaders.requests') }}</th>
                    <th scope="col" class="is-num">{{ t('home.preview.tableHeaders.cost') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in rows" :key="row.model">
                    <td>
                      <!-- flex 挂在单元格内层 div 上，绝不挂 td（会破坏 table-cell） -->
                      <div class="lp-model">
                        <span class="lp-model-dot" :class="row.tint"></span>
                        <span class="lp-model-name">{{ row.model }}</span>
                      </div>
                    </td>
                    <td class="is-num">{{ row.requests }}</td>
                    <td class="is-num">{{ row.cost }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>

    <figcaption class="lp-preview-caption">{{ t('home.preview.caption') }}</figcaption>
  </figure>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

defineProps<{ siteName: string }>()

const { t } = useI18n()

/**
 * 示意数值：刻意写成常量而非取真实接口——落地页在未登录状态渲染，
 * 且这是"控制台长什么样"的示意，不是运营数据承诺。
 * 模型名是产品专有名词，不进 i18n。
 */
const stats = [
  { key: 'requests', value: '12,480', delta: '+8.2%', tone: 'is-up' },
  { key: 'tokens', value: '48.6M', delta: '+12.4%', tone: 'is-up' },
  { key: 'cost', value: '$36.20', delta: '−3.1%', tone: 'is-down' },
  { key: 'success', value: '99.2%', delta: '+0.3%', tone: 'is-up' },
] as const

const bars = [42, 58, 51, 74, 63, 88, 96]

const rows = [
  { model: 'Claude Sonnet 4.5', requests: '6,240', cost: '$18.40', tint: 'is-claude' },
  { model: 'GPT-5.1', requests: '3,910', cost: '$11.60', tint: 'is-gpt' },
  { model: 'Gemini 3 Pro', requests: '2,330', cost: '$6.20', tint: 'is-gemini' },
] as const
</script>

<style scoped>
.lp-preview {
  margin: 0;
  width: 100%;
}

.lp-window {
  width: 100%;
  max-width: 100%;
  overflow: hidden;
  border-radius: var(--r-xl);
  background: var(--bg-elevated);
  border: 0.5px solid var(--separator-strong);
  box-shadow: var(--shadow-pop);
}

/* 窗口标题栏 */
.lp-window-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 38px;
  padding: 0 14px;
  background: var(--fill);
  border-bottom: 0.5px solid var(--separator);
}

.lp-dots {
  display: flex;
  gap: 7px;
  flex: none;
}

.lp-dots span {
  width: 11px;
  height: 11px;
  border-radius: 50%;
}

.lp-dot-red { background: var(--red); }
.lp-dot-amber { background: var(--orange); }
.lp-dot-green { background: var(--green); }

.lp-window-title {
  flex: 1;
  min-width: 0;
  text-align: center;
  font-size: 12px;
  color: var(--text-tertiary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-right: 46px;
}

/* 顶栏缩略 */
.lp-gn {
  display: flex;
  align-items: center;
  gap: 16px;
  height: 40px;
  padding: 0 16px;
  border-bottom: 0.5px solid var(--separator);
  /*
    这里用 --fill 而不是 --glass-bg：--glass-bg 是 72% 白，叠在
    --bg-elevated（纯白）上等于白，暗色同理，等于没上色。
    且本组件不该出现玻璃材质（玻璃只保留顶栏/登录卡/ambient 三处）。
  */
  background: var(--fill);
}

.lp-gn-wordmark {
  /* 品牌名不可被压缩成单字符：不参与收缩，超长才截断 */
  flex: 0 1 auto;
  min-width: 0;
  max-width: 45%;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: -0.02em;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lp-gn-links {
  display: flex;
  gap: 6px;
  min-width: 0;
  overflow: hidden;
}

.lp-gn-link {
  padding: 3px 10px;
  border-radius: var(--r-pill);
  font-size: 11.5px;
  color: var(--text-secondary);
  white-space: nowrap;
}

.lp-gn-link.is-active {
  background: var(--blue-soft);
  color: var(--blue);
  font-weight: 600;
}

.lp-window-body {
  padding: 16px;
  display: grid;
  gap: 14px;
}

/* 统计卡 */
.lp-stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.lp-stat {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
  padding: 11px 12px;
  border-radius: var(--r-md);
  background: var(--fill);
  border: 0.5px solid var(--separator);
}

.lp-stat-label {
  font-size: 11px;
  color: var(--text-tertiary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lp-stat-value {
  font-size: 17px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--text-primary);
}

.lp-stat-trend {
  font-size: 11px;
  font-weight: 600;
}

.lp-stat-trend.is-up { color: var(--green); }
.lp-stat-trend.is-down { color: var(--blue); }

.lp-panels {
  display: grid;
  grid-template-columns: 1fr;
  gap: 14px;
}

.lp-panel {
  min-width: 0;
  padding: 13px 14px;
  border-radius: var(--r-md);
  background: var(--fill);
  border: 0.5px solid var(--separator);
}

.lp-panel-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 12px;
}

/* 柱状图 */
.lp-bars {
  display: flex;
  align-items: flex-end;
  gap: 7px;
  height: 88px;
}

.lp-bar {
  flex: 1;
  min-width: 0;
  border-radius: 4px 4px 2px 2px;
  background: var(--blue-soft);
  border-top: 2px solid var(--blue);
}

.lp-bar.is-peak {
  background: var(--blue);
  border-top-color: var(--blue);
}

/* 明细表 */
.lp-table-scroll {
  width: 100%;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.lp-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.lp-table th,
.lp-table td {
  padding: 7px 8px;
  text-align: left;
  white-space: nowrap;
  border-bottom: 0.5px solid var(--separator);
}

.lp-table th {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-tertiary);
}

.lp-table td {
  color: var(--text-primary);
}

.lp-table tbody tr:last-child td {
  border-bottom: none;
}

.lp-table .is-num {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.lp-model {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
}

.lp-model-dot {
  width: 7px;
  height: 7px;
  flex: none;
  border-radius: 50%;
}

.lp-model-dot.is-claude { background: var(--orange); }
.lp-model-dot.is-gpt { background: var(--green); }
.lp-model-dot.is-gemini { background: var(--blue); }

.lp-model-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.lp-preview-caption {
  margin-top: 14px;
  font-size: 12.5px;
  line-height: 1.55;
  color: var(--text-tertiary);
  text-align: center;
}

@media (min-width: 768px) {
  .lp-stats {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .lp-panels {
    grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
  }

  .lp-window-body {
    padding: 18px;
  }
}
</style>
