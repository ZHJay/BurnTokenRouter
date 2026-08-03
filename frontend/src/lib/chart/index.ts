/**
 * 图表主题的公共入口。
 *
 * `components/charts/` 与 `views/admin/ops/` 都从这里取色 —— 放在 `lib/` 而不是
 * 任一方的目录下，是为了不让 ops 视图去 import 组件目录里的东西（反过来也一样）。
 */

export * from './theme'
