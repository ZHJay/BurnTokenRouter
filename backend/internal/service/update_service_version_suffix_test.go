//go:build unit

package service

import "testing"

// 本 fork 的展示版本号带 "_burntoken" 后缀（见 cmd/server/main.go）。
// 后缀必须对版本比较完全透明，否则：
//   - compareVersions("0.1.172_burntoken", "0.1.172") < 0 → 管理面板永远提示有新版本；
//   - ListRollbackVersions 里 compareVersions(候选, 当前) >= 0 会把所有真实历史版本
//     都判成"不比当前旧"，回滚列表被清空。
func TestParseVersionIgnoresBuildSuffix(t *testing.T) {
	cases := []struct {
		name string
		in   string
		want [3]int
	}{
		{name: "裸版本号", in: "0.1.172", want: [3]int{0, 1, 172}},
		{name: "带 v 前缀", in: "v0.1.172", want: [3]int{0, 1, 172}},
		{name: "fork 后缀", in: "0.1.172_burntoken", want: [3]int{0, 1, 172}},
		{name: "v 前缀 + fork 后缀", in: "v0.1.172_burntoken", want: [3]int{0, 1, 172}},
		{name: "预发布后缀", in: "0.1.172-rc.1", want: [3]int{0, 1, 172}},
		{name: "构建元数据后缀", in: "0.1.172+build.5", want: [3]int{0, 1, 172}},
		{name: "两位版本号", in: "0.2", want: [3]int{0, 2, 0}},
		{name: "首尾空白", in: "  0.1.172_burntoken  ", want: [3]int{0, 1, 172}},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := parseVersion(tc.in); got != tc.want {
				t.Fatalf("parseVersion(%q) = %v, want %v", tc.in, got, tc.want)
			}
		})
	}
}

// 带后缀的当前版本与上游裸 tag 必须比较相等 —— 这是"已是最新"判定的前提。
func TestCompareVersionsTreatsForkSuffixAsEqual(t *testing.T) {
	if got := compareVersions("0.1.172_burntoken", "0.1.172"); got != 0 {
		t.Fatalf(`compareVersions("0.1.172_burntoken", "0.1.172") = %d, want 0`, got)
	}
	if got := compareVersions("0.1.172_burntoken", "0.1.173"); got != -1 {
		t.Fatalf(`compareVersions("0.1.172_burntoken", "0.1.173") = %d, want -1`, got)
	}
	if got := compareVersions("0.1.172_burntoken", "0.1.171"); got != 1 {
		t.Fatalf(`compareVersions("0.1.172_burntoken", "0.1.171") = %d, want 1`, got)
	}
}
