/**
 * 模型广场文案 —— 本模块是 `modelPlaza` 顶层 key 的**唯一来源**。
 *
 * 子树原先住在 `./dashboard.ts`，导致同一个顶层 key 由两个模块共同拥有：
 * locale index 用浅层对象展开聚合，两个模块都导出 `modelPlaza` 时后者会
 * 静默替换整棵子树（`modelPlaza.table.*` 会全部渲染成裸 key），只能靠
 * 「index 展开顺序 + 在本文件里手工 re-spread dashboard 的子树」维持正确。
 * 该脆弱结构已通过迁移消除：子树整体搬到本文件，`dashboard.ts` 不再定义
 * `modelPlaza`，因此 index 的展开顺序对本模块不再有任何影响。
 *
 * 新增文案直接加在下面即可，无需再考虑与 dashboard 的合并顺序。
 */
export default {
  modelPlaza: {
    title: '模型广场',
    description: '按分组浏览可用模型与价格',
    loading: '加载中...',
    empty: '暂无可展示的分组',
    loadFailed: '加载模型广场失败',
    noSearchResult: '没有匹配的模型',
    anonymousHint: '登录后可查看你的专属分组与专属倍率',
    filters: {
      platformLabel: '平台',
      groupLabel: '分组',
      rateLabel: '倍率',
      modelLabel: '模型',
      searchPlaceholder: '搜索模型名称',
      all: '全部',
      clearSearch: '清除搜索'
    },
    badges: {
      exclusive: '专属分组',
      subscription: '订阅'
    },
    detail: {
      noModels: '该分组暂未配置模型',
      noPricing: '未配置定价',
      peakNote: '高峰时段 {window} 计费倍率 ×{multiplier}'
    },
    table: {
      model: '模型',
      input: '输入',
      output: '输出',
      cache: '缓存',
      cacheWrite: '写入',
      cacheRead: '读取',
      paidPrice: '实付价格(折后)',
      officialPrice: '官方价格',
      rate: '折扣倍率',
      unitPerMillion: '$ / 1M token',
      perUnitRequest: '/ 次',
      perUnitImage: '/ 张',
      perRequest: '按次计费',
      perImage: '按图片计费'
    },
    nav: {
      login: '登录',
      backToDashboard: '回到后台'
    },
    /** 视图切换（分段控件）。 */
    view: {
      label: '视图',
      cards: '卡片',
      table: '表格'
    },
    /** 卡片视图专有文案。 */
    cards: {
      tiered: '阶梯定价',
      cache: '缓存计费',
      unitPrice: '单价'
    }
  }
}
