package main

import (
	"strings"
	"testing"
)

// 展示版本号统一为 "<上游版本号>_burntoken"，
// ldflags 注入与 embedded VERSION 两条路径都必须带上后缀。
func TestResolveVersion(t *testing.T) {
	cases := []struct {
		name     string
		injected string
		embedded string
		want     string
	}{
		{name: "ldflags 注入优先", injected: "0.1.172", embedded: "0.1.171\n", want: "0.1.172_burntoken"},
		{name: "未注入时回落 embedded VERSION", injected: "", embedded: "0.1.172\n", want: "0.1.172_burntoken"},
		{name: "注入空白同样回落", injected: "   ", embedded: "0.1.172", want: "0.1.172_burntoken"},
		{name: "两者都为空回落 dev", injected: "", embedded: "", want: "0.0.0-dev_burntoken"},
		{name: "已带后缀不重复追加", injected: "0.1.172_burntoken", embedded: "", want: "0.1.172_burntoken"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := resolveVersion(tc.injected, tc.embedded); got != tc.want {
				t.Fatalf("resolveVersion(%q, %q) = %q, want %q", tc.injected, tc.embedded, got, tc.want)
			}
		})
	}
}

// VERSION 文件必须保持上游裸版本号：发布 tag、Docker tag 和回滚版本匹配
// 都直接和上游比较，写入 fork 后缀会让它们全部失配。
func TestEmbeddedVersionStaysUpstreamClean(t *testing.T) {
	if strings.Contains(embeddedVersion, forkVersionSuffix) {
		t.Fatalf("cmd/server/VERSION 不能包含 %q，实际为 %q", forkVersionSuffix, strings.TrimSpace(embeddedVersion))
	}
}
