package middleware

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/Wei-Shaw/sub2api/internal/config"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// 前端 SPA 结构性依赖 style-src 'unsafe-inline'：
//   - frontend/index.html 的防闪烁内联 <style>
//   - 约 120 处 Vue :style 绑定（渲染为 style="..." 属性）
//
// style 属性无法用 nonce 放行（nonce 只对 <style> 元素生效），因此 'unsafe-inline'
// 是唯一可行的放行方式。参照 Airwallex 支付域名的既有做法，后端必须为自身内嵌的
// 前端强制保证该值，否则 operator 收紧 CSP 后整个面板会完全失去样式。
func TestStyleSrcUnsafeInlineIsGuaranteed(t *testing.T) {
	tests := []struct {
		name           string
		operatorPolicy string
		// mustKeep 是 operator 自己配置的来源，增强后不能被覆盖或丢失。
		mustKeep []string
	}{
		{
			name:           "operator_tightened_style_src_to_self_only",
			operatorPolicy: "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:",
			mustKeep:       []string{"'self'"},
		},
		{
			name:           "operator_policy_omits_style_src_entirely",
			operatorPolicy: "default-src 'self'; script-src 'self'; img-src 'self' data: blob:",
		},
		{
			name:           "operator_style_src_with_custom_cdn_but_no_unsafe_inline",
			operatorPolicy: "default-src 'self'; style-src 'self' https://cdn.example.com; img-src 'self'",
			mustKeep:       []string{"'self'", "https://cdn.example.com"},
		},
		{
			name:           "operator_already_supplied_unsafe_inline",
			operatorPolicy: "default-src 'self'; style-src 'self' 'unsafe-inline' https://cdn.example.com",
			mustKeep:       []string{"'self'", "https://cdn.example.com"},
		},
		{
			name:           "compiled_default_policy",
			operatorPolicy: config.DefaultCSPPolicy,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			enhanced := enhanceCSPPolicy(tc.operatorPolicy)

			assert.True(t,
				directiveHasValue(enhanced, "style-src", "'unsafe-inline'"),
				"style-src must be guaranteed 'unsafe-inline' or the bundled SPA renders unstyled; got policy: %s",
				enhanced,
			)

			// 幂等：不能重复注入同一个 token。
			assert.Equal(t, 1, countDirectiveValue(enhanced, "style-src", "'unsafe-inline'"),
				"'unsafe-inline' must appear exactly once in style-src; got policy: %s", enhanced)

			// 不能覆盖 operator 自己声明的其他来源。
			for _, keep := range tc.mustKeep {
				assert.True(t, directiveHasValue(enhanced, "style-src", keep),
					"operator-supplied style-src source %q must be preserved; got policy: %s", keep, enhanced)
			}

			// 既有的 Airwallex 保证不能被破坏。
			assert.True(t, directiveHasValue(enhanced, "style-src", AirwallexStaticDomain),
				"existing Airwallex style-src guarantee must still hold; got policy: %s", enhanced)
		})
	}
}

// 端到端验证 operator 收紧策略后，实际下发的响应头仍然包含 'unsafe-inline'。
func TestSecurityHeadersEmitsStyleSrcUnsafeInline(t *testing.T) {
	for _, policy := range []string{
		"default-src 'self'; script-src 'self'; style-src 'self'",
		"default-src 'self'; script-src 'self'",
	} {
		t.Run(policy, func(t *testing.T) {
			mw := SecurityHeaders(config.CSPConfig{Enabled: true, Policy: policy}, nil)

			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)
			c.Request = httptest.NewRequest(http.MethodGet, "/", nil)
			mw(c)

			csp := w.Header().Get("Content-Security-Policy")
			require.NotEmpty(t, csp)
			assert.True(t, directiveHasValue(csp, "style-src", "'unsafe-inline'"),
				"served CSP header must allow inline styles; got: %s", csp)
		})
	}
}

// 强制补全会放宽 operator 显式收紧过的指令，因此必须同时给出启动告警；
// 并且在强制补全无效的场景（style-src 含 nonce/hash）必须明确报警而不是静默失效。
func TestCSPFrontendCompatWarnings(t *testing.T) {
	tests := []struct {
		name        string
		policy      string
		wantWarning []string
		wantQuiet   bool
	}{
		{
			name:        "warns_when_style_src_lacks_unsafe_inline",
			policy:      "default-src 'self'; style-src 'self'; img-src 'self' data: blob:",
			wantWarning: []string{"style-src lacks 'unsafe-inline'", "added automatically"},
		},
		{
			name:        "warns_when_style_src_absent_and_default_src_is_strict",
			policy:      "default-src 'self'; img-src 'self' data: blob:",
			wantWarning: []string{"style-src lacks 'unsafe-inline'"},
		},
		{
			name:   "warns_loudly_when_style_src_has_nonce_because_force_add_cannot_help",
			policy: "default-src 'self'; style-src 'self' __CSP_NONCE__; img-src 'self' data: blob:",
			// 这是强制补全无法修复的情况：浏览器会忽略 'unsafe-inline'。
			wantWarning: []string{"will IGNORE 'unsafe-inline'", "completely unstyled"},
		},
		{
			name:        "warns_when_style_src_has_hash_source",
			policy:      "default-src 'self'; style-src 'self' 'sha256-abc123'; img-src 'self' data: blob:",
			wantWarning: []string{"will IGNORE 'unsafe-inline'"},
		},
		{
			name:        "warns_when_img_src_missing_blob",
			policy:      "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:",
			wantWarning: []string{"img-src is missing blob:"},
		},
		{
			name:        "warns_when_img_src_missing_data_and_blob",
			policy:      "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self'",
			wantWarning: []string{"img-src is missing data: and blob:"},
		},
		{
			name:      "quiet_for_uppercase_unsafe_inline_because_csp_keywords_are_case_insensitive",
			policy:    "default-src 'self'; style-src 'self' 'UNSAFE-INLINE'; img-src 'self' DATA: BLOB:",
			wantQuiet: true,
		},
		{
			name:      "quiet_for_compiled_default_policy",
			policy:    config.DefaultCSPPolicy,
			wantQuiet: true,
		},
		{
			name:      "quiet_when_img_src_falls_back_to_permissive_default_src",
			policy:    "default-src 'self' data: blob:; style-src 'self' 'unsafe-inline'",
			wantQuiet: true,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			warnings := cspFrontendCompatWarnings(tc.policy)

			if tc.wantQuiet {
				assert.Empty(t, warnings, "policy should not warn: %s", tc.policy)
				return
			}

			joined := strings.Join(warnings, "\n")
			for _, want := range tc.wantWarning {
				assert.Contains(t, joined, want, "missing expected warning for policy: %s", tc.policy)
			}
		})
	}
}

// 默认策略必须保持"零告警"，否则每次启动都会给 operator 噪音。
func TestDefaultPolicySatisfiesFrontendRequirements(t *testing.T) {
	assert.True(t, directiveHasValue(config.DefaultCSPPolicy, "style-src", "'unsafe-inline'"))
	assert.True(t, directiveHasValue(config.DefaultCSPPolicy, "img-src", "data:"))
	assert.True(t, directiveHasValue(config.DefaultCSPPolicy, "img-src", "blob:"))
	assert.Empty(t, cspFrontendCompatWarnings(config.DefaultCSPPolicy))
}

// ---------------------------------------------------------------------------
// 回归护栏：style-src 永远不得出现 nonce/hash。
//
// CSP2/CSP3：同一指令内出现 nonce 或 hash 时，'unsafe-inline' 会被忽略。
// 前端约 120 处 :style 属性绑定根本无法携带 nonce（nonce 只授权 <style> 元素），
// 因此一旦有人"顺手加固" style-src，index.html 的防闪烁内联 <style> 与全部
// :style 绑定会同时失效 —— 白闪 + 完全无样式，正是本次修复要防止的 P0。
// 这个测试的存在就是为了让那种改动必然失败。
// ---------------------------------------------------------------------------

// styleSrcNonceOrHashTokens 返回 style-src 中所有 nonce/hash token（应恒为空）。
func styleSrcNonceOrHashTokens(t *testing.T, policy string) []string {
	t.Helper()

	fields, _ := directiveFields(policy, "style-src")
	var found []string
	for _, field := range fields {
		lowered := strings.ToLower(field)
		if strings.HasPrefix(lowered, "'nonce-") ||
			strings.HasPrefix(lowered, "'sha256-") ||
			strings.HasPrefix(lowered, "'sha384-") ||
			strings.HasPrefix(lowered, "'sha512-") ||
			strings.Contains(field, NonceTemplate) {
			found = append(found, field)
		}
	}
	return found
}

func TestStyleSrcNeverCarriesNonceOrHash(t *testing.T) {
	policies := []struct {
		name   string
		policy string
	}{
		{"compiled_default", config.DefaultCSPPolicy},
		{"operator_strict_style_src", "default-src 'self'; script-src 'self'; style-src 'self'"},
		{"operator_omits_style_src", "default-src 'self'; script-src 'self'"},
		{"operator_only_default_src", "default-src 'self'"},
		{"operator_with_cdn", "default-src 'self'; style-src 'self' https://cdn.example.com"},
	}

	for _, tc := range policies {
		t.Run(tc.name, func(t *testing.T) {
			// 1) 静态增强后的策略模板不得把 nonce 占位符放进 style-src。
			enhanced := enhanceCSPPolicy(tc.policy)
			assert.Empty(t, styleSrcNonceOrHashTokens(t, enhanced),
				"enhanceCSPPolicy must not add nonce/hash to style-src; got: %s", enhanced)

			// 2) 实际下发的响应头（nonce 已替换为真实值）同样不得出现。
			mw := SecurityHeaders(config.CSPConfig{Enabled: true, Policy: tc.policy}, nil)
			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)
			c.Request = httptest.NewRequest(http.MethodGet, "/", nil)
			mw(c)

			csp := w.Header().Get("Content-Security-Policy")
			require.NotEmpty(t, csp)
			assert.Empty(t, styleSrcNonceOrHashTokens(t, csp),
				"served style-src must not carry nonce/hash; got: %s", csp)

			// 3) 与此同时 'unsafe-inline' 必须真实生效（没有被 nonce 抵消）。
			assert.True(t, directiveHasValue(csp, "style-src", "'unsafe-inline'"),
				"style-src must retain an effective 'unsafe-inline'; got: %s", csp)

			// 4) script-src 的 nonce 机制不受影响：非对称是有意设计。
			nonce := GetNonceFromContext(c)
			require.NotEmpty(t, nonce)
			assert.True(t, directiveHasValue(csp, "script-src", "'nonce-"+nonce+"'"),
				"script-src must still use a per-request nonce; got: %s", csp)
			assert.NotContains(t, csp, NonceTemplate, "no unreplaced placeholder may leak into the header")
		})
	}
}

// 结构性断言：required 值里不允许出现任何 style-src 的 nonce/hash 条目。
func TestRequiredCSPDirectiveValuesNeverAddNonceToStyleSrc(t *testing.T) {
	styleSrcRequired := 0
	for _, required := range requiredCSPDirectiveValues {
		if !strings.EqualFold(required.directive, "style-src") {
			continue
		}
		styleSrcRequired++
		lowered := strings.ToLower(required.value)
		assert.False(t,
			strings.HasPrefix(lowered, "'nonce-") ||
				strings.HasPrefix(lowered, "'sha256-") ||
				strings.HasPrefix(lowered, "'sha384-") ||
				strings.HasPrefix(lowered, "'sha512-") ||
				strings.Contains(required.value, NonceTemplate),
			"style-src must never be force-fed a nonce/hash source, found %q", required.value,
		)
	}
	assert.Positive(t, styleSrcRequired, "style-src must have at least one guaranteed value")

	// nonce 占位符只能注入 script-src。
	assert.True(t, directiveHasValue(enhanceCSPPolicy("default-src 'self'"), "script-src", NonceTemplate))
}

// crypto/rand 失败降级路径：占位符被替换为 'unsafe-inline' 后，
// style-src 仍然只有 'unsafe-inline'、且不含 nonce/hash，界面不会失去样式。
func TestNonceGenerationFailureFallbackKeepsStylesWorking(t *testing.T) {
	original := nonceGenerator
	nonceGenerator = func() (string, error) {
		return "", errors.New("simulated crypto/rand failure")
	}
	defer func() { nonceGenerator = original }()

	for _, policy := range []string{
		config.DefaultCSPPolicy,
		"default-src 'self'; script-src 'self'; style-src 'self'",
	} {
		t.Run(policy[:min(len(policy), 48)], func(t *testing.T) {
			mw := SecurityHeaders(config.CSPConfig{Enabled: true, Policy: policy}, nil)
			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)
			c.Request = httptest.NewRequest(http.MethodGet, "/", nil)
			mw(c)

			csp := w.Header().Get("Content-Security-Policy")
			require.NotEmpty(t, csp, "fallback must still emit a CSP header")

			// 占位符必须被消费掉，不能泄漏到响应头。
			assert.NotContains(t, csp, NonceTemplate)
			// 降级后 script-src 退化为 'unsafe-inline'（既有行为，未被本次改动影响）。
			assert.True(t, directiveHasValue(csp, "script-src", "'unsafe-inline'"),
				"fallback should degrade script-src to 'unsafe-inline'; got: %s", csp)
			// style-src 依旧可用且干净。
			assert.True(t, directiveHasValue(csp, "style-src", "'unsafe-inline'"),
				"style-src must remain functional in the fallback path; got: %s", csp)
			assert.Empty(t, styleSrcNonceOrHashTokens(t, csp),
				"fallback must not leave nonce/hash in style-src; got: %s", csp)
			assert.Equal(t, 1, countDirectiveValue(csp, "style-src", "'unsafe-inline'"),
				"fallback must not duplicate 'unsafe-inline' in style-src; got: %s", csp)
			// 降级时不设置 context nonce，避免模板渲染出无效 nonce 属性。
			assert.Empty(t, GetNonceFromContext(c))
		})
	}
}

// ---------------------------------------------------------------------------
// CSP 指令名按规范是 ASCII 大小写无关的：`STYLE-SRC 'self'` 与 `style-src 'self'`
// 是同一条指令。directiveHasValue 已用 EqualFold 处理，但 addToDirective 曾用
// strings.Index 做**大小写敏感**定位，于是混合大小写策略下强制补全不会追加进
// operator 那条指令，而是另外注入一条小写重复指令。浏览器只认首次出现的指令、
// 忽略后续重复，所以结果必然是两者之一：operator 的配置被静默忽略，或后端的
// 强制保证被静默忽略。两种都是本模块要防的 P0（面板完全失去样式 /
// window.__APP_CONFIG__ 引导脚本被拦掉）。
// ---------------------------------------------------------------------------

// countDirectivesFold 统计某指令在策略中出现的次数（大小写无关）。
// 期望恒为 1：出现 2 次就意味着有一份配置正在被浏览器静默忽略。
func countDirectivesFold(policy, directive string) int {
	count := 0
	for _, rawDirective := range strings.Split(policy, ";") {
		fields := strings.Fields(strings.TrimSpace(rawDirective))
		if len(fields) > 0 && strings.EqualFold(fields[0], directive) {
			count++
		}
	}
	return count
}

// firstDirectiveName 返回策略中第一条指令的名字。
func firstDirectiveName(policy string) string {
	for _, rawDirective := range strings.Split(policy, ";") {
		fields := strings.Fields(strings.TrimSpace(rawDirective))
		if len(fields) > 0 {
			return fields[0]
		}
	}
	return ""
}

func TestMixedCaseOperatorDirectivesKeepGuaranteesAndOperatorSources(t *testing.T) {
	type source struct {
		directive string
		value     string
	}

	tests := []struct {
		name           string
		operatorPolicy string
		// wantFirstDirective 是 operator 策略原本的首条指令。强制补全不得在它之前
		// 插入合成指令，否则"首次出现生效"会让 operator 的首条指令被浏览器忽略。
		wantFirstDirective string
		// wantVerbatim 断言 operator 的原始大小写被原样保留，没有被改写成小写。
		wantVerbatim []string
		// wantEffective 是必须在**首次出现**的那条指令里真正生效的来源：
		// 既包含后端的强制保证，也包含 operator 自己声明的来源。
		wantEffective []source
	}{
		{
			name:               "uppercase_style_src_keeps_guarantee_and_operator_cdn",
			operatorPolicy:     "default-src 'self'; script-src 'self' __CSP_NONCE__; STYLE-SRC 'self' https://cdn.example.com; img-src 'self' data: blob:",
			wantFirstDirective: "default-src",
			wantVerbatim:       []string{"STYLE-SRC 'self' https://cdn.example.com"},
			wantEffective: []source{
				{"style-src", UnsafeInlineSource},
				{"style-src", "'self'"},
				{"style-src", "https://cdn.example.com"},
				{"style-src", AirwallexStaticDomain},
			},
		},
		{
			name:               "titlecase_style_src_keeps_guarantee",
			operatorPolicy:     "default-src 'self'; script-src 'self' __CSP_NONCE__; Style-Src 'self'; img-src 'self' data: blob:",
			wantFirstDirective: "default-src",
			wantVerbatim:       []string{"Style-Src 'self'"},
			wantEffective: []source{
				{"style-src", UnsafeInlineSource},
				{"style-src", "'self'"},
			},
		},
		{
			// operator 的 STYLE-SRC 排在 default-src 之前：这一条决定了重复注入
			// 到底是哪一份被忽略，因此必须单独覆盖。
			name:               "uppercase_style_src_ahead_of_default_src",
			operatorPolicy:     "STYLE-SRC 'self'; default-src 'self'; script-src 'self' __CSP_NONCE__; img-src 'self' data: blob:",
			wantFirstDirective: "STYLE-SRC",
			wantVerbatim:       []string{"STYLE-SRC 'self'"},
			wantEffective: []source{
				{"style-src", UnsafeInlineSource},
				{"style-src", "'self'"},
			},
		},
		{
			// 同一个缺陷也会打掉 script-src：nonce 与支付域名被注入到一条重复指令上，
			// operator 自己的 CDN 则整条失效。
			name:               "uppercase_script_src_keeps_operator_cdn_and_payment_domains",
			operatorPolicy:     "default-src 'self'; SCRIPT-SRC 'self' https://cdn.example.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:",
			wantFirstDirective: "default-src",
			wantVerbatim:       []string{"SCRIPT-SRC 'self' https://cdn.example.com"},
			wantEffective: []source{
				{"script-src", "'self'"},
				{"script-src", "https://cdn.example.com"},
				{"script-src", CloudflareInsightsDomain},
				{"script-src", AirwallexStaticDomain},
			},
		},
		{
			// default-src 回退路径：缺失的指令必须插到 operator 的 DEFAULT-SRC 之后，
			// 而不是抢到它前面把它挤成被忽略的重复项。
			name:               "mixed_case_default_src_fallback_for_missing_style_src",
			operatorPolicy:     "DEFAULT-SRC 'self'; script-src 'self' __CSP_NONCE__; img-src 'self' data: blob:",
			wantFirstDirective: "DEFAULT-SRC",
			wantVerbatim:       []string{"DEFAULT-SRC 'self'"},
			wantEffective: []source{
				{"style-src", UnsafeInlineSource},
			},
		},
		{
			// 最严重的形态：operator 的 SCRIPT-SRC 排在 default-src 之前时，
			// 重复注入的那条 script-src 连 nonce 一起被浏览器忽略，
			// embed_on.go 注入的 window.__APP_CONFIG__ 引导脚本直接被拦掉，面板起不来。
			name:               "uppercase_script_src_ahead_of_default_src_keeps_nonce_effective",
			operatorPolicy:     "SCRIPT-SRC 'self'; default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:",
			wantFirstDirective: "SCRIPT-SRC",
			wantVerbatim:       []string{"SCRIPT-SRC 'self'"},
			wantEffective: []source{
				{"script-src", "'self'"},
				{"script-src", CloudflareInsightsDomain},
			},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			mw := SecurityHeaders(config.CSPConfig{Enabled: true, Policy: tc.operatorPolicy}, nil)

			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)
			c.Request = httptest.NewRequest(http.MethodGet, "/", nil)
			mw(c)

			csp := w.Header().Get("Content-Security-Policy")
			require.NotEmpty(t, csp)

			// 每条指令只能出现一次：重复出现说明有一份配置正在被浏览器静默忽略。
			for _, directive := range []string{"style-src", "script-src", "frame-src", "default-src"} {
				assert.Equal(t, 1, countDirectivesFold(csp, directive),
					"%s must appear exactly once (browsers ignore duplicates, silently dropping one side); got: %s",
					directive, csp)
			}

			assert.Equal(t, tc.wantFirstDirective, firstDirectiveName(csp),
				"must not inject a directive ahead of the operator's first one; got: %s", csp)

			for _, verbatim := range tc.wantVerbatim {
				assert.Contains(t, csp, verbatim,
					"operator directive casing must be preserved verbatim, not rewritten; got: %s", csp)
			}

			for _, want := range tc.wantEffective {
				assert.True(t, directiveHasValue(csp, want.directive, want.value),
					"%s must be effective in %s; got: %s", want.value, want.directive, csp)
			}

			// script-src 的 per-request nonce 必须落在真正生效的那条指令上，
			// 否则 embed_on.go 注入的 window.__APP_CONFIG__ 引导脚本会被拦掉，
			// 面板直接起不来。
			nonce := GetNonceFromContext(c)
			require.NotEmpty(t, nonce)
			assert.True(t, directiveHasValue(csp, "script-src", "'nonce-"+nonce+"'"),
				"per-request nonce must be effective in script-src; got: %s", csp)
		})
	}
}
