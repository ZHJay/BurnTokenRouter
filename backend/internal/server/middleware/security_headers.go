package middleware

import (
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"log"
	"strings"
	"sync"

	"github.com/Wei-Shaw/sub2api/internal/config"
	"github.com/gin-gonic/gin"
)

const (
	// CSPNonceKey is the context key for storing the CSP nonce
	CSPNonceKey = "csp_nonce"
	// NonceTemplate is the placeholder in CSP policy for nonce
	NonceTemplate = "__CSP_NONCE__"
	// CloudflareInsightsDomain is the domain for Cloudflare Web Analytics
	CloudflareInsightsDomain = "https://static.cloudflareinsights.com"
	// StripeDomain is the domain for Stripe.js SDK
	StripeDomain = "https://*.stripe.com"
	// AirwallexStaticDomain 是 Airwallex 生产环境 SDK 脚本域名。
	AirwallexStaticDomain = "https://static.airwallex.com"
	// AirwallexCheckoutDomain 是 Airwallex 生产环境收银台元素和 iframe 域名。
	AirwallexCheckoutDomain = "https://checkout.airwallex.com"
	// AirwallexDemoStaticDomain 是 Airwallex 沙箱环境 SDK 脚本域名。
	AirwallexDemoStaticDomain = "https://static-demo.airwallex.com"
	// AirwallexDemoCheckoutDomain 是 Airwallex 沙箱环境收银台元素和 iframe 域名。
	AirwallexDemoCheckoutDomain = "https://checkout-demo.airwallex.com"
	// UnsafeInlineSource 是允许内联样式所需的 CSP 关键字。
	UnsafeInlineSource = "'unsafe-inline'"
)

var cspPolicyWarningOnce sync.Once

// nonceGenerator 是 GenerateNonce 的可注入接口，仅供测试覆盖
// crypto/rand 失败时的降级分支（真实路径无法稳定触发）。
var nonceGenerator = GenerateNonce

// requiredCSPDirectiveValues 中的值都是"必须存在"的来源。
//
// 关于 nonce 的非对称性（有意为之，勿"顺手统一"）：
//   - script-src 使用每请求 nonce，工作良好：内联脚本是 <script> 元素，nonce 对元素生效。
//   - style-src 不能使用 nonce/hash。前端约 120 处 Vue :style 绑定渲染为 style="..."
//     **属性**，而 nonce 只能授权 <style>/<link> 元素，无法授权 style 属性；
//     并且 CSP2/CSP3 规定：同一指令内出现 nonce 或 hash 时，'unsafe-inline' 会被忽略。
//     因此往 style-src 加 nonce/hash 会连带废掉 index.html 的防闪烁内联 <style>，
//     结果是白闪 + 完全无样式的界面。style-src 只能靠 'unsafe-inline'。
var requiredCSPDirectiveValues = []struct {
	directive string
	value     string
}{
	// 内嵌前端结构性依赖内联样式：index.html 的防闪烁 <style>，以及约 120 处
	// Vue :style 绑定。详见上方关于 nonce 非对称性的说明。
	// 缺少它整个面板会完全失去样式，故与支付域名同等强制保证。
	{"style-src", UnsafeInlineSource},
	{"script-src", CloudflareInsightsDomain},
	{"script-src", StripeDomain},
	{"frame-src", StripeDomain},
	{"script-src", AirwallexStaticDomain},
	{"script-src", AirwallexCheckoutDomain},
	{"style-src", AirwallexStaticDomain},
	{"style-src", AirwallexCheckoutDomain},
	{"frame-src", AirwallexCheckoutDomain},
	{"script-src", AirwallexDemoStaticDomain},
	{"script-src", AirwallexDemoCheckoutDomain},
	{"style-src", AirwallexDemoStaticDomain},
	{"style-src", AirwallexDemoCheckoutDomain},
	{"frame-src", AirwallexDemoCheckoutDomain},
}

// GenerateNonce generates a cryptographically secure random nonce.
// 返回 error 以确保调用方在 crypto/rand 失败时能正确降级。
func GenerateNonce() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("generate CSP nonce: %w", err)
	}
	return base64.StdEncoding.EncodeToString(b), nil
}

// GetNonceFromContext retrieves the CSP nonce from gin context
func GetNonceFromContext(c *gin.Context) string {
	if nonce, exists := c.Get(CSPNonceKey); exists {
		if s, ok := nonce.(string); ok {
			return s
		}
	}
	return ""
}

// SecurityHeaders sets baseline security headers for all responses.
// getFrameSrcOrigins is an optional function that returns extra origins to inject into frame-src;
// pass nil to disable dynamic frame-src injection.
func SecurityHeaders(cfg config.CSPConfig, getFrameSrcOrigins func() []string) gin.HandlerFunc {
	policy := strings.TrimSpace(cfg.Policy)
	if policy == "" {
		policy = config.DefaultCSPPolicy
	}

	// 强制补全前会先就 operator 策略与内嵌前端的兼容性给出告警，
	// 避免"静默放宽"或"静默失去样式"两种都很糟糕的结局。
	if cfg.Enabled {
		if warnings := cspFrontendCompatWarnings(policy); len(warnings) > 0 {
			cspPolicyWarningOnce.Do(func() {
				for _, warning := range warnings {
					log.Printf("[SecurityHeaders] %s", warning)
				}
			})
		}
	}

	// Enhance policy with required directives (nonce placeholder and Cloudflare Insights)
	policy = enhanceCSPPolicy(policy)

	return func(c *gin.Context) {
		finalPolicy := policy
		if getFrameSrcOrigins != nil {
			for _, origin := range getFrameSrcOrigins() {
				if origin != "" {
					finalPolicy = addToDirective(finalPolicy, "frame-src", origin)
				}
			}
		}

		c.Header("X-Content-Type-Options", "nosniff")
		c.Header("X-Frame-Options", "DENY")
		c.Header("Referrer-Policy", "strict-origin-when-cross-origin")
		if isAPIRoutePath(c) {
			c.Next()
			return
		}

		if cfg.Enabled {
			// Generate nonce for this request
			nonce, err := nonceGenerator()
			if err != nil {
				// crypto/rand 失败时降级为无 nonce 的 CSP 策略
				log.Printf("[SecurityHeaders] %v — 降级为无 nonce 的 CSP", err)
				c.Header("Content-Security-Policy", strings.ReplaceAll(finalPolicy, NonceTemplate, "'unsafe-inline'"))
			} else {
				c.Set(CSPNonceKey, nonce)
				c.Header("Content-Security-Policy", strings.ReplaceAll(finalPolicy, NonceTemplate, "'nonce-"+nonce+"'"))
			}
		}
		c.Next()
	}
}

func isAPIRoutePath(c *gin.Context) bool {
	if c == nil || c.Request == nil || c.Request.URL == nil {
		return false
	}
	path := c.Request.URL.Path
	return strings.HasPrefix(path, "/v1/") ||
		strings.HasPrefix(path, "/v1beta/") ||
		strings.HasPrefix(path, "/antigravity/") ||
		strings.HasPrefix(path, "/responses") ||
		strings.HasPrefix(path, "/images")
}

// enhanceCSPPolicy 确保 CSP 策略包含 nonce 支持和支付 SDK 必需域名。
// 这样旧配置文件没有及时补域名时，前端支付组件仍能正常加载。
func enhanceCSPPolicy(policy string) string {
	// Add nonce placeholder to script-src if not present
	if !strings.Contains(policy, NonceTemplate) && !strings.Contains(policy, "'nonce-") {
		policy = addToDirective(policy, "script-src", NonceTemplate)
	}

	for _, required := range requiredCSPDirectiveValues {
		if !directiveHasValue(policy, required.directive, required.value) {
			policy = addToDirective(policy, required.directive, required.value)
		}
	}

	return policy
}

func directiveHasValue(policy, directive, value string) bool {
	for _, rawDirective := range strings.Split(policy, ";") {
		fields := strings.Fields(strings.TrimSpace(rawDirective))
		if len(fields) == 0 || !strings.EqualFold(fields[0], directive) {
			continue
		}
		for _, field := range fields[1:] {
			// CSP 指令名与关键字来源是 ASCII 大小写无关的，因此 operator 写成
			// 'UNSAFE-INLINE' 时不应再重复注入一个小写副本。
			// 注意：此比较不用于 nonce/hash（它们大小写敏感），只用于关键字与域名。
			if strings.EqualFold(field, value) {
				return true
			}
		}
		return false
	}
	return false
}

// directiveFields 返回指定指令的来源列表；第二个返回值表示该指令是否显式存在。
// 只取第一次出现，与浏览器"重复指令后者被忽略"的行为一致。
func directiveFields(policy, directive string) ([]string, bool) {
	for _, rawDirective := range strings.Split(policy, ";") {
		fields := strings.Fields(strings.TrimSpace(rawDirective))
		if len(fields) == 0 || !strings.EqualFold(fields[0], directive) {
			continue
		}
		return fields[1:], true
	}
	return nil, false
}

// effectiveDirectiveFields 按 CSP 回退语义取生效来源：指令缺失时回退到 default-src。
func effectiveDirectiveFields(policy, directive string) []string {
	if fields, ok := directiveFields(policy, directive); ok {
		return fields
	}
	fields, _ := directiveFields(policy, "default-src")
	return fields
}

func containsSourceFold(fields []string, value string) bool {
	for _, field := range fields {
		if strings.EqualFold(field, value) {
			return true
		}
	}
	return false
}

// hasNonceOrHashSource 判断来源列表中是否含 nonce-source 或 hash-source。
// CSP2/CSP3 规定：同一指令中只要出现 nonce 或 hash，'unsafe-inline' 就会被忽略。
func hasNonceOrHashSource(fields []string) bool {
	for _, field := range fields {
		lowered := strings.ToLower(field)
		if strings.HasPrefix(lowered, "'nonce-") ||
			strings.HasPrefix(lowered, "'sha256-") ||
			strings.HasPrefix(lowered, "'sha384-") ||
			strings.HasPrefix(lowered, "'sha512-") ||
			strings.Contains(field, NonceTemplate) {
			return true
		}
	}
	return false
}

// cspFrontendCompatWarnings 检查 operator 自定义策略与内嵌前端的兼容性。
// 返回的告警在启动时打印一次：既让"被强制放宽"可见，也让强制补全无法修复的
// 情况（style-src 同时含 nonce/hash）不会静默变成一个没有样式的面板。
func cspFrontendCompatWarnings(policy string) []string {
	var warnings []string

	styleFields := effectiveDirectiveFields(policy, "style-src")
	switch {
	case hasNonceOrHashSource(styleFields):
		// 强制补全在这里是无效的：浏览器会忽略 'unsafe-inline'。
		warnings = append(warnings,
			"security.csp.policy style-src contains a nonce/hash source; per CSP2/CSP3 browsers will IGNORE 'unsafe-inline' there, "+
				"which blocks the bundled panel's inline <style> and ~120 :style attribute bindings and renders the UI completely unstyled. "+
				"Remove the nonce/hash from style-src (the panel needs 'unsafe-inline'; a nonce cannot authorize style=\"...\" attributes).")
	case !containsSourceFold(styleFields, UnsafeInlineSource):
		warnings = append(warnings,
			"security.csp.policy style-src lacks 'unsafe-inline'; it is being added automatically because the bundled panel requires inline styles "+
				"(anti-flash inline <style> plus ~120 Vue :style attribute bindings, which nonces cannot authorize). "+
				"Serve the panel from a separate origin if you need a strict style-src.")
	}

	imgFields := effectiveDirectiveFields(policy, "img-src")
	var missingImgSources []string
	if !containsSourceFold(imgFields, "data:") {
		missingImgSources = append(missingImgSources, "data:")
	}
	if !containsSourceFold(imgFields, "blob:") {
		missingImgSources = append(missingImgSources, "blob:")
	}
	if len(missingImgSources) > 0 {
		warnings = append(warnings,
			"security.csp.policy img-src is missing "+strings.Join(missingImgSources, " and ")+
				"; the panel uses data: URI select chevrons and blob: image previews, which will be blocked. "+
				"Recommended: img-src 'self' data: blob: https:")
	}

	return warnings
}

// directiveEndOffset 返回策略中指定指令**最后一个来源之后**的字节偏移，
// 第二个返回值表示该指令是否存在。指令名按 CSP 规范做 ASCII 大小写无关匹配，
// 与 directiveHasValue/directiveFields 保持一致：operator 写成 `STYLE-SRC` 时
// 必须命中他那一条，否则会另外注入一条重复指令，而浏览器只认首次出现的那条、
// 忽略其余重复 —— 结果必然是 operator 配置或后端强制保证之一被静默丢弃。
// 只匹配第一次出现，与浏览器行为一致。
func directiveEndOffset(policy, directive string) (int, bool) {
	offset := 0
	for _, rawDirective := range strings.Split(policy, ";") {
		segmentStart := offset
		offset += len(rawDirective) + 1 // +1 跳过分隔用的 ';'

		trimmed := strings.TrimSpace(rawDirective)
		fields := strings.Fields(trimmed)
		if len(fields) == 0 || !strings.EqualFold(fields[0], directive) {
			continue
		}
		// 落到最后一个非空白字符之后，这样插入的来源不会跑到尾部空白之后。
		return segmentStart + strings.Index(rawDirective, trimmed) + len(trimmed), true
	}
	return 0, false
}

// addToDirective adds a value to a specific CSP directive.
// If the directive doesn't exist, it will be added after default-src.
func addToDirective(policy, directive, value string) string {
	// 追加进 operator 已有的那条指令，保留他原本的大小写（不做规范化改写）。
	if insertPos, ok := directiveEndOffset(policy, directive); ok {
		return policy[:insertPos] + " " + value + policy[insertPos:]
	}

	// 指令不存在：插到 default-src 之后（同样大小写无关匹配），
	// 避免抢到 operator 首条指令之前。
	if insertPos, ok := directiveEndOffset(policy, "default-src"); ok {
		return policy[:insertPos] + "; " + directive + " 'self' " + value + policy[insertPos:]
	}

	// Fallback: prepend the directive
	return directive + " 'self' " + value + "; " + policy
}
