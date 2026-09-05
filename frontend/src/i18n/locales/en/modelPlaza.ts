/**
 * Model Plaza copy — this module is the **single source** of the `modelPlaza`
 * top-level key.
 *
 * The subtree used to live in `./dashboard.ts`, which meant one top-level key
 * was co-owned by two modules: the locale index aggregates via shallow object
 * spread, so whichever module came last silently replaced the whole subtree
 * (every `modelPlaza.table.*` lookup would render as a raw key). Correctness
 * depended on the index spread order plus a hand-maintained re-spread of
 * dashboard's subtree inside this file. That fragile structure has been removed
 * by migration: the subtree now lives here, `dashboard.ts` no longer defines
 * `modelPlaza`, and the index spread order no longer affects this module.
 *
 * Add new copy directly below; no merge-order reasoning required.
 */
export default {
  modelPlaza: {
    title: 'Model Plaza',
    description: 'Browse available models and pricing by group',
    loading: 'Loading...',
    empty: 'No groups to display',
    loadFailed: 'Failed to load model plaza',
    noSearchResult: 'No matching models',
    anonymousHint: 'Sign in to see your exclusive groups and personal rates',
    filters: {
      platformLabel: 'Platform',
      groupLabel: 'Group',
      rateLabel: 'Rate',
      modelLabel: 'Model',
      searchPlaceholder: 'Search models',
      all: 'All',
      clearSearch: 'Clear search'
    },
    badges: {
      exclusive: 'Exclusive',
      subscription: 'Subscription'
    },
    detail: {
      noModels: 'No models configured for this group',
      noPricing: 'Pricing not configured',
      peakNote: 'Peak hours {window}: billing rate ×{multiplier}',
      longContextDisabledNote: 'Long-context tier pricing is disabled for this group: requests above the threshold are billed at the base tier; official tiers are for reference only'
    },
    table: {
      model: 'Model',
      input: 'Input',
      output: 'Output',
      cache: 'Cache',
      cacheWrite: 'Write',
      cacheRead: 'Read',
      cacheWriteShort: 'W',
      cacheReadShort: 'R',
      tierHint: 'The whole request is billed at the tier matching its total context (input + cache write + cache read)',
      tierHintMarginal: 'Only the portion above the threshold is billed at this tier; output is unaffected',
      marginalBadge: 'excess-only tiers',
      timePricingRowHint: 'Requests made within this period ({timezone} time) are billed at the prices in this row',
      timePricingRowHintWeekdays: 'On weekdays (Mon–Fri) only, requests made within this period ({timezone} time) are billed at the prices in this row; weekends use the standard prices',
      timePricingRowHintPeak: '; prices in this row exclude the peak-hour rate — where this period overlaps the peak hours {window}, the overlapping portion is additionally multiplied by ×{multiplier}',
      timePricingWeekdays: 'Weekdays',
      timePricingRateHint: 'Effective rate {rate} × period multiplier {multiplier}',
      paidPrice: 'Your Price (Discounted)',
      officialPrice: 'Official Price',
      rate: 'Rate',
      unitPerMillion: '$ / 1M tokens',
      perUnitRequest: '/ request',
      perUnitImage: '/ image',
      perRequest: 'Per request',
      perImage: 'Per image'
    },
    nav: {
      login: 'Sign In',
      backToDashboard: 'Back to Console'
    },
    /** View switcher (segmented control). */
    view: {
      label: 'View',
      cards: 'Cards',
      table: 'Table'
    },
    /** Card-view-only copy. */
    cards: {
      tiered: 'Tiered pricing',
      cache: 'Cache pricing',
      unitPrice: 'Unit price'
    }
  }
}
