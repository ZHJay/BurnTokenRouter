<template>
  <div class="card">
    <div
      class="et-head flex flex-col gap-3 px-6 py-4 lg:flex-row lg:items-start lg:justify-between"
    >
      <div>
        <h2 class="et-title">
          {{ t("admin.settings.emailTemplates.title") }}
        </h2>
        <p class="et-sub">
          {{ t("admin.settings.emailTemplates.description") }}
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <button
          type="button"
          class="btn btn-secondary btn-sm"
          :disabled="loadingTemplate || previewing || !canPreview"
          @click="refreshPreview"
        >
          {{ previewing ? t("admin.settings.emailTemplates.previewing") : t("admin.settings.emailTemplates.preview") }}
        </button>
        <button
          type="button"
          class="btn btn-secondary btn-sm"
          data-testid="email-template-insert-baseline"
          :disabled="loadingTemplate || !selectedEvent || !selectedLocale"
          @click="insertAppleBaseline"
        >
          {{ t("admin.settings.emailTemplates.insertBaseline") }}
        </button>
        <button
          type="button"
          class="btn btn-secondary btn-sm"
          :disabled="loadingTemplate || restoring || !selectedEvent || !selectedLocale"
          @click="restoreOfficial"
        >
          {{ restoring ? t("admin.settings.emailTemplates.restoring") : t("admin.settings.emailTemplates.restoreOfficial") }}
        </button>
        <button
          type="button"
          class="btn btn-primary btn-sm"
          :disabled="loadingTemplate || saving || !canSave"
          @click="saveTemplate"
        >
          {{ saving ? t("admin.settings.emailTemplates.saving") : t("admin.settings.emailTemplates.save") }}
        </button>
      </div>
    </div>

    <div class="space-y-6 p-6">
      <div
        v-if="loadingList"
        class="et-loading flex items-center gap-2"
      >
        <span class="et-spinner"></span>
        {{ t("common.loading") }}
      </div>

      <template v-else>
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label class="input-label" for="email-template-event">
              {{ t("admin.settings.emailTemplates.event") }}
            </label>
            <select
              id="email-template-event"
              v-model="selectedEvent"
              class="input"
              :disabled="loadingTemplate || eventOptions.length === 0"
            >
              <option
                v-for="option in eventOptions"
                :key="option.value"
                :value="option.value"
              >
                {{ formatEventOptionLabel(option) }}
              </option>
            </select>
          </div>
          <div>
            <label class="input-label" for="email-template-locale">
              {{ t("admin.settings.emailTemplates.locale") }}
            </label>
            <select
              id="email-template-locale"
              v-model="selectedLocale"
              class="input"
              :disabled="loadingTemplate || localeOptions.length === 0"
            >
              <option
                v-for="localeOption in localeOptions"
                :key="localeOption"
                :value="localeOption"
              >
                {{ formatLocale(localeOption) }}
              </option>
            </select>
          </div>
        </div>

        <div
          v-if="selectedEventMeta"
          class="et-meta-box"
        >
          <div class="flex flex-wrap items-center gap-2">
            <div class="et-meta-title">
              {{ selectedEventMeta.label }}
            </div>
            <span
              class="badge badge-gray"
            >
              {{ selectedEventMeta.categoryLabel }}
            </span>
            <span
              class="badge"
              :class="
                selectedEventMeta.optional
                  ? 'badge-warning'
                  : 'badge-success'
              "
            >
              {{ selectedEventMeta.optional ? localText("可退订通知", "Optional") : localText("事务邮件", "Transactional") }}
            </span>
          </div>
          <p class="et-meta-timing">
            {{ selectedEventMeta.timing }}
          </p>
          <p
            v-if="selectedEventDescription"
            class="et-meta-desc"
          >
            {{ selectedEventDescription }}
          </p>
        </div>

        <div
          v-if="!eventOptions.length || !localeOptions.length"
          class="et-notice"
        >
          {{ t("admin.settings.emailTemplates.empty") }}
        </div>

        <div v-else class="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <div class="space-y-4">
            <div>
              <label class="input-label" for="email-template-subject">
                {{ t("admin.settings.emailTemplates.subject") }}
              </label>
              <input
                id="email-template-subject"
                v-model="subject"
                type="text"
                class="input"
                :disabled="loadingTemplate"
                :placeholder="t('admin.settings.emailTemplates.subjectPlaceholder')"
              />
            </div>

            <div>
              <label class="input-label" for="email-template-html">
                {{ t("admin.settings.emailTemplates.html") }}
              </label>
              <textarea
                id="email-template-html"
                v-model="html"
                rows="18"
                class="input min-h-[28rem] resize-y font-mono text-sm leading-6"
                :disabled="loadingTemplate"
                :placeholder="t('admin.settings.emailTemplates.htmlPlaceholder')"
              ></textarea>
            </div>

            <div
              class="et-panel"
            >
              <div class="et-panel-title">
                {{ t("admin.settings.emailTemplates.placeholders") }}
              </div>
              <p class="et-panel-sub">
                {{ t("admin.settings.emailTemplates.placeholdersHelp") }}
              </p>
              <div class="mt-3 flex flex-wrap gap-2">
                <button
                  v-for="placeholder in placeholderList"
                  :key="placeholder"
                  type="button"
                  class="et-chip"
                  @click="copyPlaceholder(placeholder)"
                >
                  {{ placeholder }}
                </button>
              </div>
            </div>
          </div>

          <div class="space-y-4">
            <div
              class="et-preview-card"
            >
              <div
                class="et-preview-head flex items-center justify-between px-4 py-3"
              >
                <div>
                  <div class="et-panel-title">
                    {{ t("admin.settings.emailTemplates.livePreview") }}
                  </div>
                  <div class="et-preview-subject">
                    {{ previewSubject || t("admin.settings.emailTemplates.noPreview") }}
                  </div>
                </div>
                <span
                  v-if="isCustomTemplate"
                  class="badge badge-primary"
                >
                  {{ t("admin.settings.emailTemplates.customized") }}
                </span>
              </div>
              <!-- 预览槽：外壳走变量；iframe 内是真实邮件 HTML，一律不注入外壳样式 -->
              <div class="et-preview-slot">
                <iframe
                  class="et-preview-frame"
                  sandbox=""
                  :srcdoc="previewHtml"
                  :title="t('admin.settings.emailTemplates.livePreview')"
                ></iframe>
              </div>
            </div>

            <p class="et-hint">
              {{ t("admin.settings.emailTemplates.previewSecurityHint") }}
            </p>
            <p class="et-hint">
              {{ t("admin.settings.emailTemplates.baselineHint") }}
            </p>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { adminAPI } from "@/api";
import type {
  EmailTemplateEventOption,
  EmailTemplateOption,
} from "@/api/admin/settings";
import { useAppStore } from "@/stores";
import { extractApiErrorMessage } from "@/utils/apiError";

const { t, locale } = useI18n();
const appStore = useAppStore();

/* =========================================================================
   邮件正文基准模板（Apple 设计对齐）

   ⚠️ 这里是全站唯一允许硬编码颜色的地方，且必须内联。
   原因：收件端（Gmail / Outlook / Apple Mail）不支持 CSS 变量、不支持
   backdrop-filter，对 <style> 块与现代 CSS 支持极差。所以邮件正文一律
   内联 style + 字面色值 + <table> 布局。

   编辑器 UI 外壳照常走 CSS 变量 —— 这两层不要搞混。

   色值与设计 token 的对应（取亮色一档，邮件不做暗色反转）：
     #0071e3 = --blue（苹果蓝亮色）      #f5f5f7 = --bg
     #ffffff = --bg-elevated             #1d1d1f = --text-primary
     #6e6e73 = --text-secondary          #86868b = --text-tertiary
     #d2d2d7 = --separator 的邮件安全实色（邮件端 rgba 支持不稳）
     18px = --r-lg   12px = --r-md   980px = --r-pill

   品牌：无 logo 图片，站点名纯文本 wordmark（{{site_name}}）。
   ========================================================================= */
function buildAppleBaselineEmail(zh: boolean): string {
  const txt = zh
    ? {
        lang: "zh-CN",
        eyebrow: "通知",
        heading: "标题写在这里",
        greeting: "你好 {{recipient_name}}，",
        body: "这里是正文。把这段替换成本事件要传达的内容，保持一到两段、每段不超过三行。",
        cta: "查看详情",
        metaTitle: "详情",
        metaKey1: "站点",
        metaKey2: "时间",
        footerNote: "这封邮件由 {{site_name}} 自动发送，请勿直接回复。",
        unsub: "退订此类通知",
      }
    : {
        lang: "en",
        eyebrow: "NOTIFICATION",
        heading: "Your headline goes here",
        greeting: "Hi {{recipient_name}},",
        body: "This is the body copy. Replace it with what this event needs to say — keep it to one or two short paragraphs.",
        cta: "View details",
        metaTitle: "Details",
        metaKey1: "Site",
        metaKey2: "Time",
        footerNote: "This email was sent automatically by {{site_name}}. Please do not reply directly.",
        unsub: "Unsubscribe from these notifications",
      };

  return `<!DOCTYPE html>
<html lang="${txt.lang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>{{site_name}}</title>
</head>
<body style="margin:0; padding:24px 12px; background:#f5f5f7; color:#1d1d1f; font-family:-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif; -webkit-font-smoothing:antialiased;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
<tr><td align="center">

<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:600px; max-width:600px; border-collapse:separate; border-spacing:0; background:#ffffff; border:1px solid #d2d2d7; border-radius:18px;">

  <!-- 品牌：站点名纯文本 wordmark，无 logo 图片 -->
  <tr><td style="padding:22px 32px 0 32px;">
    <p style="margin:0; font-size:15px; font-weight:600; letter-spacing:-0.02em; color:#1d1d1f;">{{site_name}}</p>
  </td></tr>

  <tr><td style="padding:20px 32px 0 32px;">
    <p style="margin:0 0 8px 0; font-size:12px; font-weight:600; letter-spacing:0.04em; text-transform:uppercase; color:#86868b;">${txt.eyebrow}</p>
    <h1 style="margin:0; font-size:26px; font-weight:700; line-height:1.25; letter-spacing:-0.03em; color:#1d1d1f;">${txt.heading}</h1>
  </td></tr>

  <tr><td style="padding:20px 32px 0 32px;">
    <p style="margin:0 0 14px 0; font-size:15px; line-height:1.6; color:#1d1d1f;">${txt.greeting}</p>
    <p style="margin:0; font-size:15px; line-height:1.6; color:#6e6e73;">${txt.body}</p>
  </td></tr>

  <!-- CTA：table 包裹的药丸按钮（Outlook 不支持 a 上的 padding） -->
  <tr><td style="padding:24px 32px 0 32px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;">
      <tr><td align="center" bgcolor="#0071e3" style="border-radius:980px;">
        <a href="{{reset_url}}" style="display:inline-block; padding:12px 26px; font-size:15px; font-weight:500; color:#ffffff; text-decoration:none; border-radius:980px;">${txt.cta}</a>
      </td></tr>
    </table>
  </td></tr>

  <!-- 详情表：发丝线分隔 -->
  <tr><td style="padding:28px 32px 0 32px;">
    <p style="margin:0 0 10px 0; font-size:12px; font-weight:600; letter-spacing:0.04em; text-transform:uppercase; color:#86868b;">${txt.metaTitle}</p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%; border-collapse:separate; border-spacing:0; border:1px solid #d2d2d7; border-radius:12px; overflow:hidden;">
      <tr>
        <td style="padding:11px 14px; font-size:13px; color:#6e6e73; border-bottom:1px solid #d2d2d7; width:120px;">${txt.metaKey1}</td>
        <td style="padding:11px 14px; font-size:13px; color:#1d1d1f; border-bottom:1px solid #d2d2d7;">{{site_name}}</td>
      </tr>
      <tr>
        <td style="padding:11px 14px; font-size:13px; color:#6e6e73;">${txt.metaKey2}</td>
        <td style="padding:11px 14px; font-size:13px; color:#1d1d1f;">{{triggered_at}}</td>
      </tr>
    </table>
  </td></tr>

  <tr><td style="padding:28px 32px 0 32px;">
    <div style="height:1px; background:#d2d2d7; line-height:1px; font-size:0;">&nbsp;</div>
  </td></tr>

  <tr><td style="padding:16px 32px 26px 32px;">
    <p style="margin:0 0 6px 0; font-size:12px; line-height:1.6; color:#86868b;">${txt.footerNote}</p>
    <p style="margin:0; font-size:12px; line-height:1.6;">
      <a href="{{unsubscribe_url}}" style="color:#0071e3; text-decoration:underline;">${txt.unsub}</a>
    </p>
  </td></tr>

</table>

</td></tr>
</table>
</body>
</html>`;
}

const fallbackPlaceholders = [
  "{{site_name}}",
  "{{recipient_name}}",
  "{{recipient_email}}",
  "{{verification_code}}",
  "{{expires_in_minutes}}",
  "{{reset_url}}",
  "{{subscription_group}}",
  "{{subscription_days}}",
  "{{expiry_time}}",
  "{{days_remaining}}",
  "{{current_balance}}",
  "{{threshold}}",
  "{{recharge_url}}",
  "{{recharge_amount}}",
  "{{order_id}}",
  "{{unsubscribe_url}}",
  "{{account_id}}",
  "{{account_name}}",
  "{{platform}}",
  "{{quota_dimension}}",
  "{{quota_used}}",
  "{{quota_limit}}",
  "{{quota_remaining}}",
  "{{quota_threshold}}",
  "{{triggered_at}}",
  "{{group_name}}",
  "{{moderation_category}}",
  "{{moderation_score}}",
  "{{violation_count}}",
  "{{ban_threshold}}",
  "{{rule_name}}",
  "{{severity}}",
  "{{alert_status}}",
  "{{metric_type}}",
  "{{operator}}",
  "{{metric_value}}",
  "{{threshold_value}}",
  "{{alert_description}}",
  "{{report_name}}",
  "{{report_type}}",
  "{{report_start_time}}",
  "{{report_end_time}}",
  "{{report_summary_display}}",
  "{{report_detail_display}}",
  "{{report_total_requests}}",
  "{{report_success_count}}",
  "{{report_sla_error_count}}",
  "{{report_business_limited_count}}",
  "{{report_sla}}",
  "{{report_error_rate}}",
  "{{report_upstream_error_rate}}",
  "{{report_upstream_error_count_excl_429_529}}",
  "{{report_upstream_429_count}}",
  "{{report_upstream_529_count}}",
  "{{report_latency_p50}}",
  "{{report_latency_p99}}",
  "{{report_ttft_p50}}",
  "{{report_ttft_p99}}",
  "{{report_tokens}}",
  "{{report_qps_current}}",
  "{{report_qps_peak}}",
  "{{report_qps_avg}}",
  "{{report_tps_current}}",
  "{{report_tps_peak}}",
  "{{report_tps_avg}}",
  "{{report_html}}",
];

const loadingList = ref(true);
const loadingTemplate = ref(false);
const saving = ref(false);
const previewing = ref(false);
const restoring = ref(false);
const eventOptions = ref<EmailTemplateOption[]>([]);
const localeOptions = ref<string[]>([]);
const selectedEvent = ref("");
const selectedLocale = ref("");
const subject = ref("");
const html = ref("");
const isCustomTemplate = ref(false);
const placeholders = ref<string[]>([]);
const previewSubject = ref("");
const previewHtml = ref("");
const initializingSelection = ref(false);

interface EventDisplayMeta {
  label: string;
  timing: string;
  categoryLabel: string;
}

function localText(zh: string, en: string): string {
  return locale.value.toLowerCase().startsWith("zh") ? zh : en;
}

const eventDisplayMeta: Record<string, EventDisplayMeta> = {
  "auth.verify_code": {
    label: "邮箱验证码",
    timing: "注册、绑定邮箱、OAuth 补全邮箱或 TOTP 邮箱校验时发送。",
    categoryLabel: "认证安全",
  },
  "auth.password_reset": {
    label: "密码重置",
    timing: "用户请求密码重置链接时发送。",
    categoryLabel: "认证安全",
  },
  "notification_email.verify_code": {
    label: "通知邮箱验证码",
    timing: "用户添加并验证额外通知邮箱时发送。",
    categoryLabel: "认证安全",
  },
  "subscription.purchase_success": {
    label: "订阅开通成功",
    timing: "订阅订单完成支付并成功开通或续期后发送。",
    categoryLabel: "订阅",
  },
  "subscription.expiry_reminder": {
    label: "订阅到期提醒",
    timing: "后台任务在订阅仍有效且距离到期剩余 7 天、3 天、1 天时各发送一次，可通过邮件设置中的开关关闭。",
    categoryLabel: "订阅",
  },
  "balance.low": {
    label: "余额不足提醒",
    timing: "用户余额低于全局或个人配置的提醒阈值时发送。",
    categoryLabel: "计费",
  },
  "balance.recharge_success": {
    label: "余额充值成功",
    timing: "余额充值订单支付完成并入账后发送。",
    categoryLabel: "计费",
  },
  "account.quota_alert": {
    label: "账号限额告警",
    timing: "上游账号的用量达到配置的额度告警阈值时发送给管理员通知邮箱。",
    categoryLabel: "管理告警",
  },
  "content_moderation.violation_notice": {
    label: "内容审计违规提醒",
    timing: "用户请求命中内容审计或风控规则、但尚未被禁用时发送。",
    categoryLabel: "风控",
  },
  "content_moderation.account_disabled": {
    label: "内容审计禁用账号",
    timing: "内容审计违规次数达到封禁阈值并自动禁用用户账号时发送。",
    categoryLabel: "风控",
  },
  "ops.alert": {
    label: "运维告警",
    timing: "运维监控规则触发告警并满足邮件通知配置时发送给运维收件人。",
    categoryLabel: "运维",
  },
  "ops.scheduled_report": {
    label: "运维定时报表",
    timing: "运维日报、周报、错误摘要或账号健康报表到达配置的发送时间时发送；日报和周报的完整指标均可在模板中编辑。",
    categoryLabel: "运维",
  },
};

const eventDisplayMetaEn: Record<string, EventDisplayMeta> = {
  "auth.verify_code": {
    label: "Email Verification Code",
    timing: "Sent for registration, email binding, OAuth pending email completion, or TOTP email verification.",
    categoryLabel: "Auth",
  },
  "auth.password_reset": {
    label: "Password Reset",
    timing: "Sent when a user requests a password reset link.",
    categoryLabel: "Auth",
  },
  "notification_email.verify_code": {
    label: "Notification Email Verification",
    timing: "Sent when a user adds and verifies an extra notification email address.",
    categoryLabel: "Auth",
  },
  "subscription.purchase_success": {
    label: "Subscription Activated",
    timing: "Sent after a subscription order is paid and the subscription is activated or extended.",
    categoryLabel: "Subscription",
  },
  "subscription.expiry_reminder": {
    label: "Subscription Expiry Reminder",
    timing: "Sent by the background job when an active subscription has 7, 3, or 1 day remaining. It can be disabled in Email settings.",
    categoryLabel: "Subscription",
  },
  "balance.low": {
    label: "Low Balance Alert",
    timing: "Sent when a user's balance drops below the global or personal reminder threshold.",
    categoryLabel: "Billing",
  },
  "balance.recharge_success": {
    label: "Balance Recharge Success",
    timing: "Sent after a balance recharge order is paid and credited.",
    categoryLabel: "Billing",
  },
  "account.quota_alert": {
    label: "Account Quota Alert",
    timing: "Sent to admin notification emails when an upstream account reaches the configured quota alert threshold.",
    categoryLabel: "Admin",
  },
  "content_moderation.violation_notice": {
    label: "Risk Control Violation Notice",
    timing: "Sent when a user request triggers content moderation or risk-control rules but the account is not disabled yet.",
    categoryLabel: "Risk Control",
  },
  "content_moderation.account_disabled": {
    label: "Risk Control Account Disabled",
    timing: "Sent when content moderation reaches the ban threshold and automatically disables the user account.",
    categoryLabel: "Risk Control",
  },
  "ops.alert": {
    label: "Ops Alert",
    timing: "Sent to ops recipients when an ops monitoring rule fires and email notification settings allow it.",
    categoryLabel: "Ops",
  },
  "ops.scheduled_report": {
    label: "Ops Scheduled Report",
    timing: "Sent when a configured daily, weekly, error digest, or account health report reaches its scheduled send time. Every daily and weekly summary metric is editable in this template.",
    categoryLabel: "Ops",
  },
};

function normalizeEventOption(option: EmailTemplateEventOption): EmailTemplateOption {
  if (typeof option === "string") {
    return { value: option };
  }
  return option;
}

function eventMetaFor(option?: EmailTemplateOption | null) {
  if (!option) return null;
  const displayMeta = (
    locale.value.toLowerCase().startsWith("zh")
      ? eventDisplayMeta
      : eventDisplayMetaEn
  )[option.value];
  const label = displayMeta?.label || option.label || option.value;
  const timing = displayMeta?.timing || option.description || "";
  const categoryLabel =
    displayMeta?.categoryLabel || formatCategory(option.category || "");
  return {
    label,
    timing,
    categoryLabel,
    optional: option.optional === true,
  };
}

function formatEventOptionLabel(option: EmailTemplateOption): string {
  const meta = eventMetaFor(option);
  if (!meta) return option.label || option.value;
  return meta.label;
}

function formatCategory(category: string): string {
  const normalized = category.trim().toLowerCase();
  if (!normalized) return localText("通知", "Notification");
  const labels: Record<string, { zh: string; en: string }> = {
    auth: { zh: "认证安全", en: "Auth" },
    subscription: { zh: "订阅", en: "Subscription" },
    billing: { zh: "计费", en: "Billing" },
    admin: { zh: "管理告警", en: "Admin" },
    risk_control: { zh: "风控", en: "Risk Control" },
    ops: { zh: "运维", en: "Ops" },
  };
  const item = labels[normalized];
  return item ? localText(item.zh, item.en) : category;
}

const selectedEventOption = computed(() => {
  return (
    eventOptions.value.find((option) => option.value === selectedEvent.value) ||
    null
  );
});

const selectedEventMeta = computed(() => eventMetaFor(selectedEventOption.value));

const selectedEventDescription = computed(() => {
  return (
    selectedEventOption.value?.description || ""
  );
});

const placeholderList = computed(() => {
  const combined = placeholders.value.length
    ? placeholders.value
    : fallbackPlaceholders;
  return Array.from(
    new Set(
      combined
        .map((item) => formatPlaceholder(item))
        .filter((item) => item.length > 0),
    ),
  );
});

function formatPlaceholder(placeholder: string): string {
  const trimmed = placeholder.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("{{") && trimmed.endsWith("}}")) return trimmed;
  return `{{${trimmed}}}`;
}

const canSave = computed(
  () =>
    Boolean(selectedEvent.value && selectedLocale.value) &&
    subject.value.trim().length > 0 &&
    html.value.trim().length > 0,
);

const canPreview = computed(
  () => Boolean(selectedEvent.value && selectedLocale.value) && html.value.trim().length > 0,
);

function formatLocale(locale: string): string {
  const lower = locale.toLowerCase();
  if (lower === "zh" || lower.startsWith("zh-")) {
    return t("admin.settings.emailTemplates.localeZh");
  }
  if (lower === "en" || lower.startsWith("en-")) {
    return t("admin.settings.emailTemplates.localeEn");
  }
  return locale;
}

function selectInitialLocale(locales: string[]): string {
  const currentLocale = locale.value.toLowerCase();
  const exactMatch = locales.find(
    (availableLocale) => availableLocale.toLowerCase() === currentLocale,
  );
  if (exactMatch) return exactMatch;

  const currentLanguage = currentLocale.split("-")[0];
  const languageMatch = locales.find(
    (availableLocale) => availableLocale.toLowerCase().split("-")[0] === currentLanguage,
  );
  if (languageMatch) return languageMatch;

  return locales[0] || "";
}

function applyTemplate(template: {
  subject: string;
  html: string;
  is_custom?: boolean;
  placeholders?: string[];
}) {
  subject.value = template.subject;
  html.value = template.html;
  isCustomTemplate.value = template.is_custom === true;
  placeholders.value = template.placeholders || [];
}

async function loadTemplate() {
  if (!selectedEvent.value || !selectedLocale.value) return;
  loadingTemplate.value = true;
  try {
    const template = await adminAPI.settings.getEmailTemplate(
      selectedEvent.value,
      selectedLocale.value,
    );
    applyTemplate(template);
    await refreshPreview();
  } catch (err: unknown) {
    appStore.showError(extractApiErrorMessage(err, t("common.error")));
  } finally {
    loadingTemplate.value = false;
  }
}

async function loadTemplateList() {
  loadingList.value = true;
  try {
    const response = await adminAPI.settings.getEmailTemplates();
    eventOptions.value = response.events.map(normalizeEventOption);
    localeOptions.value = response.locales;
    placeholders.value = response.placeholders || [];
    initializingSelection.value = true;
    selectedEvent.value = eventOptions.value[0]?.value || "";
    selectedLocale.value = selectInitialLocale(response.locales);
    await loadTemplate();
    initializingSelection.value = false;
  } catch (err: unknown) {
    initializingSelection.value = false;
    appStore.showError(extractApiErrorMessage(err, t("common.error")));
  } finally {
    loadingList.value = false;
  }
}

async function saveTemplate() {
  if (!canSave.value) {
    appStore.showError(t("admin.settings.emailTemplates.validationRequired"));
    return;
  }
  saving.value = true;
  try {
    const template = await adminAPI.settings.updateEmailTemplate(
      selectedEvent.value,
      selectedLocale.value,
      {
        subject: subject.value,
        html: html.value,
      },
    );
    applyTemplate(template);
    await refreshPreview();
    appStore.showSuccess(t("admin.settings.emailTemplates.saveSuccess"));
  } catch (err: unknown) {
    appStore.showError(extractApiErrorMessage(err, t("common.error")));
  } finally {
    saving.value = false;
  }
}

async function refreshPreview() {
  if (!canPreview.value) {
    previewSubject.value = "";
    previewHtml.value = "";
    return;
  }
  previewing.value = true;
  try {
    const preview = await adminAPI.settings.previewEmailTemplate({
      event: selectedEvent.value,
      locale: selectedLocale.value,
      subject: subject.value,
      html: html.value,
    });
    previewSubject.value = preview.subject;
    previewHtml.value = preview.html;
  } catch (err: unknown) {
    appStore.showError(extractApiErrorMessage(err, t("common.error")));
  } finally {
    previewing.value = false;
  }
}

async function restoreOfficial() {
  if (!selectedEvent.value || !selectedLocale.value) return;
  if (!window.confirm(t("admin.settings.emailTemplates.restoreConfirm"))) return;

  restoring.value = true;
  try {
    const template = await adminAPI.settings.restoreOfficialEmailTemplate(
      selectedEvent.value,
      selectedLocale.value,
    );
    applyTemplate(template);
    await refreshPreview();
    appStore.showSuccess(t("admin.settings.emailTemplates.restoreSuccess"));
  } catch (err: unknown) {
    appStore.showError(extractApiErrorMessage(err, t("common.error")));
  } finally {
    restoring.value = false;
  }
}

/**
 * 把 Apple 设计基准的邮件正文写入编辑器（不自动保存 —— 保存逻辑零改动，
 * 仍由管理员点「保存模板」触发）。语言按当前所选模板 locale 决定，而非 UI 语言。
 */
function insertAppleBaseline() {
  if (!selectedEvent.value || !selectedLocale.value) return;
  if (
    html.value.trim().length > 0 &&
    !window.confirm(t("admin.settings.emailTemplates.insertBaselineConfirm"))
  ) {
    return;
  }
  const zh = selectedLocale.value.toLowerCase().startsWith("zh");
  html.value = buildAppleBaselineEmail(zh);
  appStore.showSuccess(t("admin.settings.emailTemplates.insertBaselineSuccess"));
}

async function copyPlaceholder(placeholder: string) {
  try {
    await navigator.clipboard.writeText(placeholder);
    appStore.showSuccess(t("admin.settings.emailTemplates.placeholderCopied"));
  } catch {
    appStore.showError(t("common.error"));
  }
}

watch([selectedEvent, selectedLocale], ([eventValue, localeValue], [oldEvent, oldLocale]) => {
  if (initializingSelection.value) return;
  if (!eventValue || !localeValue) return;
  if (eventValue === oldEvent && localeValue === oldLocale) return;
  void loadTemplate();
});

onMounted(() => {
  void loadTemplateList();
});
</script>

<style scoped>
/* =========================================================================
   编辑器 UI 外壳 —— 只消费 CSS 变量，禁止硬编码颜色。
   （邮件正文的字面色值在 <script> 的 buildAppleBaselineEmail 里，两层不混用）
   ========================================================================= */
.et-head {
  border-bottom: 0.5px solid var(--separator);
}

.et-title {
  font-size: 17px;
  font-weight: 600;
  letter-spacing: -0.02em;
  color: var(--text-primary);
}

.et-sub {
  margin-top: 4px;
  font-size: 13px;
  color: var(--text-secondary);
}

.et-loading {
  font-size: 13px;
  color: var(--text-secondary);
}

.et-spinner {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 2px solid var(--fill-hover);
  border-top-color: var(--blue);
  animation: et-spin 0.7s linear infinite;
}

@keyframes et-spin {
  to {
    transform: rotate(360deg);
  }
}

/* 事件说明块：极淡蓝底 + 发丝线 */
.et-meta-box {
  padding: 16px;
  border: 0.5px solid var(--separator);
  border-radius: var(--r-md);
  background: var(--blue-soft);
}

.et-meta-title {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--text-primary);
}

.et-meta-timing {
  margin-top: 8px;
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-secondary);
}

.et-meta-desc {
  margin-top: 4px;
  font-size: 12px;
  color: var(--text-tertiary);
}

/* 空状态提示：橙色语义（iOS --orange） */
.et-notice {
  padding: 16px;
  border: 0.5px solid rgba(255, 159, 10, 0.35);
  border-radius: var(--r-md);
  background: rgba(255, 159, 10, 0.12);
  font-size: 13px;
  color: var(--orange);
}

.et-panel {
  padding: 16px;
  border: 0.5px solid var(--separator);
  border-radius: var(--r-md);
  background: var(--fill);
}

.et-panel-title {
  font-size: 13.5px;
  font-weight: 500;
  color: var(--text-primary);
}

.et-panel-sub {
  margin-top: 4px;
  font-size: 12px;
  color: var(--text-tertiary);
}

/* 占位符药丸 */
.et-chip {
  padding: 5px 12px;
  border: 0.5px solid var(--separator-strong);
  border-radius: var(--r-pill);
  background: var(--bg-elevated);
  font-family: 'SF Mono', ui-monospace, Menlo, monospace;
  font-size: 12px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: background 0.18s var(--ease), color 0.18s var(--ease),
    border-color 0.18s var(--ease), transform 0.12s var(--ease);
}

.et-chip:hover {
  border-color: var(--blue);
  color: var(--blue);
  background: var(--blue-soft);
}

.et-chip:active {
  transform: scale(0.97);
}

.et-chip:focus-visible {
  outline: none;
  box-shadow: 0 0 0 4px var(--blue-soft);
}

/* 预览卡 */
.et-preview-card {
  border: 0.5px solid var(--separator);
  border-radius: var(--r-md);
  background: var(--bg-elevated);
  overflow: hidden;
}

.et-preview-head {
  border-bottom: 0.5px solid var(--separator);
}

.et-preview-subject {
  margin-top: 2px;
  font-size: 12px;
  color: var(--text-tertiary);
}

/* 预览槽底色用 --fill，让白底邮件在暗色模式下也有边界感 */
.et-preview-slot {
  padding: 12px;
  background: var(--fill);
}

.et-preview-frame {
  width: 100%;
  height: 36rem;
  border: 0.5px solid var(--separator);
  border-radius: var(--r-sm);
  /* 邮件正文自带 #f5f5f7 底色，此处白底仅作 srcdoc 为空时的兜底 */
  background: #ffffff;
}

.et-hint {
  font-size: 12px;
  line-height: 1.6;
  color: var(--text-tertiary);
}
</style>
