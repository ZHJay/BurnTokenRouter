/**
 * 错误请求/用量明细共享的徽章配色与列映射。
 *
 * 配色返回设计系统的语义徽章修饰类(.badge-*),浅/深两套取值由 style.css 统一定义,
 * 调用点只需 `class="badge"` + 本函数的返回值。
 *
 * 为什么不再返回 bg-X-100/text-X-800 这类成对工具类:那套写法把浅色与深色的取值
 * 写死在 TS 里,而它同时喂给用户端错误表与运维错误日志表——两处模板都已按 Apple
 * Design 改造过,却因为共享的这个 helper 没改,继续渲染旧配色。改在这里,两张表
 * 一次修好,且以后新增调用点不会再把旧配色带回来。
 */

import type { UsageRequestType } from '@/types'

export type UsageRequestKind = UsageRequestType

/** 状态码徽章:≥500 红、429 紫、≥400 琥珀、其余灰 */
export function statusCodeBadgeClass(code: number): string {
  if (code >= 500) return 'badge-danger'
  if (code === 429) return 'badge-purple'
  if (code >= 400) return 'badge-warning'
  return 'badge-gray'
}

/** 请求类型徽章配色(cyber 红、live 绿、ws 紫、stream 蓝、sync 灰、未知琥珀) */
export function requestTypeBadgeClass(kind: UsageRequestKind): string {
  if (kind === 'cyber') return 'badge-danger'
  if (kind === 'live') return 'badge-success'
  if (kind === 'ws_v2') return 'badge-purple'
  if (kind === 'stream') return 'badge-primary'
  if (kind === 'sync') return 'badge-gray'
  return 'badge-warning'
}

/** 请求类型 i18n 键(展示方自行 t()) */
export function requestTypeLabelKey(kind: UsageRequestKind): string {
  if (kind === 'cyber') return 'usage.cyber'
  if (kind === 'live') return 'usage.live'
  if (kind === 'ws_v2') return 'usage.ws'
  if (kind === 'stream') return 'usage.stream'
  if (kind === 'sync') return 'usage.sync'
  return 'usage.unknown'
}

/**
 * 数字 request_type(1 同步/2 流式/3 WS)→ kind;
 * 缺失时按 stream 布尔回退,两者都缺返回 null(展示为 -)。
 */
export function numericRequestTypeKind(
  requestType?: number | null,
  stream?: boolean | null
): UsageRequestKind | null {
  const rt = requestType ?? (stream == null ? 0 : stream ? 2 : 1)
  if (rt === 3) return 'ws_v2'
  if (rt === 5) return 'live'
  if (rt === 2) return 'stream'
  if (rt === 1) return 'sync'
  return null
}

/** 错误表列 key → 后端 sort_by(status 列实际按 status_code 排序) */
export function mapErrorSortKey(key: string): string {
  return key === 'status' ? 'status_code' : key
}

/**
 * 错误请求筛选的常用状态码固定候选(管理端 + 用户端共用)。
 * 用固定列表而非「当前页出现过的码」派生,避免目标状态码只在后续页/筛选外时无法选中
 * ——后端 status_code 过滤对全量数据生效,选项不应被当前页数据限制。
 */
export const COMMON_ERROR_STATUS_CODES = [400, 401, 403, 404, 408, 413, 429, 499, 500, 502, 503, 504, 529]
