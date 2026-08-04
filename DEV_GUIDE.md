# sub2api 项目开发指南

> 本文档记录项目环境配置、常见坑点和注意事项，供 Claude Code 和团队成员参考。

## 一、项目基本信息

| 项目 | 说明 |
|------|------|
| **上游仓库** | Wei-Shaw/sub2api |
| **Fork 仓库** | bayma888/sub2api-bmai |
| **技术栈** | Go 后端 (Ent ORM + Gin) + Vue3 前端 (pnpm) |
| **数据库** | PostgreSQL 16 + Redis |
| **包管理** | 后端: go modules, 前端: **pnpm**（不是 npm） |

## 二、本地环境配置

### PostgreSQL 16 (Windows 服务)

| 配置项 | 值 |
|--------|-----|
| 端口 | 5432 |
| psql 路径 | `C:\Program Files\PostgreSQL\16\bin\psql.exe` |
| pg_hba.conf | `C:\Program Files\PostgreSQL\16\data\pg_hba.conf` |
| 数据库凭据 | user=`sub2api`, password=`sub2api`, dbname=`sub2api` |
| 超级用户 | user=`postgres`, password=`postgres` |

### Redis

| 配置项 | 值 |
|--------|-----|
| 端口 | 6379 |
| 密码 | 无 |

### 开发工具

```bash
# golangci-lint v2.9（与 CI 的 golangci-lint-action 版本一致，本地版本不同结论就会不同）
go install github.com/golangci/golangci-lint/v2/cmd/golangci-lint@v2.9

# pnpm (前端包管理)
npm install -g pnpm
```

## 三、CI/CD 流水线

### GitHub Actions Workflows

| Workflow | 触发条件 | 检查内容 |
|----------|----------|----------|
| **backend-ci.yml** | push, pull_request（**无路径过滤**） | 五个并行 job：`test`（单元 + 集成）、`embed`（`pnpm run build` 出 dist 后跑 `go build -tags embed ./...` + `go test -tags embed ./internal/web/...`）、`golangci-lint` v2.9（**跑两遍：先不带 tag，再带 `--build-tags embed`，两遍互补**）、`frontend`（`make test-frontend`）、`shell`（macos-15 上跑 `deploy/` 脚本自检） |
| **security-scan.yml** | push, pull_request, 每周一 | `backend-security`（govulncheck）+ `frontend-security`（`pnpm audit --prod --audit-level=high`，结果过 `tools/check_pnpm_audit_exceptions.py` 白名单） |
| **release.yml** | tag `v*`、手动 dispatch | `build-frontend`（`pnpm run build`）+ 构建发布（**push / PR 不触发**） |

**前端是被 CI 卡住的**，不是"只有后端有 CI"。`backend-ci.yml` 的 `frontend` job 跑
`pnpm install --frozen-lockfile` 然后 `make test-frontend`（step 名字叫
"Frontend typecheck and critical vitest"，其实比这个名字管得多）。而且触发器上
**没有 paths 过滤**，只动前端的提交照样会把整个 workflow 全跑一遍。

`make test-frontend`（根 `Makefile`）按顺序串三道闸，每行非零就中止：

```
test-frontend:
	@pnpm --dir frontend run lint:check      # eslint，不带 --fix
	@pnpm --dir frontend run typecheck       # vue-tsc --noEmit
	@$(MAKE) test-frontend-critical          # vitest
```

**所以一个 lint 报错会在 typecheck 之前就把 job 判红。** 看到 `frontend` job 失败，
先按这个顺序往下找：日志里没出现 `vue-tsc`，就说明根本没走到类型检查那步，问题在
eslint。本地按同一顺序复现，别只跑 vitest。

**`test-frontend-critical` 只跑一份写死的关键 spec 白名单**，不是全量 vitest：
清单是 `Makefile` 顶部的 `FRONTEND_CRITICAL_VITEST` 变量，逐个文件路径列死，而
`frontend/src` 下有两百多个 `.spec.ts`（清单 15 个 vs 全量 232 个，差一个数量级）。
两个后果要记住：
**CI 绿不代表前端测试全过**；**新写的 spec 不会自动进 CI**，不手动加进
`FRONTEND_CRITICAL_VITEST` 就永远不会在 CI 里执行。改动涉及关键路径时，
顺手把对应 spec 加进这个变量。

**`vite build` 不在 push / PR 上跑。** 它只出现在 `release.yml` 的 `build-frontend`
job，而那个 workflow 只由 `push: tags: ['v*']` 和手动 dispatch 触发。也就是说构建
失败（`build` 脚本是 `vue-tsc -b && vite build`，比 `--noEmit` 的 typecheck 更严）
要到打 tag 那一刻才暴露——这也是第八节里那份本地构建检查值得认真跑的原因。

### CI 要求

- Go 版本必须是 **1.26.5**（`test`、`embed`、`golangci-lint` 三个 job 都有
  `go version | grep -q 'go1.26.5'` 硬校验，版本不对直接失败）
- 前端使用 `pnpm install --frozen-lockfile`，必须提交 `pnpm-lock.yaml`

### 本地测试命令

```bash
# 后端单元测试
cd backend && go test -tags=unit ./...

# 后端集成测试
cd backend && go test -tags=integration ./...

# 代码质量检查
# CI 的 golangci-lint job 跑两遍，本地也要按同样顺序跑两遍：
#   不带 tag  → 看不到 internal/web 那四个 embed 侧文件（详见「坑 12」）
#   带 embed  → embed_off.go（`//go:build !embed`，go run / make test-unit /
#               make test-integration 都编它）反过来被丢掉
# 两遍是互补关系，不是替代关系，任一单跑都覆盖不全 internal/web。
cd backend && golangci-lint run ./...
cd backend && golangci-lint run --build-tags embed ./...

# 前端依赖安装（必须用 pnpm）
cd frontend && pnpm install

# 前端三道闸，与 CI 的 frontend job 完全一致（在仓库根目录跑）
make test-frontend
```

## 四、常见坑点 & 解决方案

### 坑 1：pnpm-lock.yaml 必须同步提交

**问题**：`package.json` 新增依赖后，CI 的 `pnpm install --frozen-lockfile` 失败。

**原因**：上游 CI 使用 pnpm，lock 文件不同步会报错。

**解决**：
```bash
cd frontend
pnpm install  # 更新 pnpm-lock.yaml
git add pnpm-lock.yaml
git commit -m "chore: update pnpm-lock.yaml"
```

---

### 坑 2：npm 和 pnpm 的 node_modules 冲突

**问题**：之前用 npm 装过 `node_modules`，pnpm install 报 `EPERM` 错误。

**解决**：
```bash
cd frontend
rm -rf node_modules  # 或 PowerShell: Remove-Item -Recurse -Force node_modules
pnpm install
```

---

### 坑 3：PowerShell 中 bcrypt hash 的 `$` 被转义

**问题**：bcrypt hash 格式如 `$2a$10$xxx...`，PowerShell 把 `$2a` 当变量解析，导致数据丢失。

**解决**：将 SQL 写入文件，用 `psql -f` 执行：
```bash
# 错误示范（PowerShell 会吃掉 $）
psql -c "INSERT INTO users ... VALUES ('$2a$10$...')"

# 正确做法
echo "INSERT INTO users ... VALUES ('\$2a\$10\$...')" > temp.sql
psql -U sub2api -h 127.0.0.1 -d sub2api -f temp.sql
```

---

### 坑 4：psql 不支持中文路径

**问题**：`psql -f "D:\中文路径\file.sql"` 报错找不到文件。

**解决**：复制到纯英文路径再执行：
```bash
cp "D:\中文路径\file.sql" "C:\temp.sql"
psql -f "C:\temp.sql"
```

---

### 坑 5：PostgreSQL 密码重置流程

**场景**：忘记 PostgreSQL 密码。

**步骤**：
1. 修改 `C:\Program Files\PostgreSQL\16\data\pg_hba.conf`
   ```
   # 将 scram-sha-256 改为 trust
   host    all    all    127.0.0.1/32    trust
   ```
2. 重启 PostgreSQL 服务
   ```powershell
   Restart-Service postgresql-x64-16
   ```
3. 无密码登录并重置
   ```bash
   psql -U postgres -h 127.0.0.1
   ALTER USER sub2api WITH PASSWORD 'sub2api';
   ALTER USER postgres WITH PASSWORD 'postgres';
   ```
4. 改回 `scram-sha-256` 并重启

---

### 坑 6：Go interface 新增方法后 test stub 必须补全

**问题**：给 interface 新增方法后，编译报错 `does not implement interface (missing method XXX)`。

**原因**：所有测试文件中实现该 interface 的 stub/mock 都必须补上新方法。

**解决**：
```bash
# 搜索所有实现该 interface 的 struct
cd backend
grep -r "type.*Stub.*struct" internal/
grep -r "type.*Mock.*struct" internal/

# 逐一补全新方法
```

---

### 坑 7：Windows 上 psql 连 localhost 的 IPv6 问题

**问题**：psql 连 `localhost` 先尝试 IPv6 (::1)，可能报错后再回退 IPv4。

**建议**：直接用 `127.0.0.1` 代替 `localhost`。

---

### 坑 8：Windows 没有 make 命令

**问题**：CI 里用 `make test-unit`，本地 Windows 没有 make。

**解决**：直接用 Makefile 里的原始命令：
```bash
# 代替 make test-unit
go test -tags=unit ./...

# 代替 make test-integration
go test -tags=integration ./...
```

---

### 坑 9：Ent Schema 修改后必须重新生成

**问题**：修改 `ent/schema/*.go` 后，代码不生效。

**解决**：
```bash
cd backend
go generate ./ent  # 重新生成 ent 代码
git add ent/       # 生成的文件也要提交
```

---

### 坑 10：前端测试看似正常，但后端调用失败（模型映射被批量误改）

**典型现象**：
- 前端按钮点测看起来正常；
- 实际通过 API/客户端调用时返回 `Service temporarily unavailable` 或提示无可用账号；
- 常见于 OpenAI 账号（例如 Codex 模型）在批量修改后突然不可用。

**根因**：
- OpenAI 账号编辑页默认不显式展示映射规则，容易让人误以为“没映射也没关系”；
- 但在**批量修改同时选中不同平台账号**（OpenAI + Antigravity/Gemini）时，模型白名单/映射可能被跨平台策略覆盖；
- 结果是 OpenAI 账号的关键模型映射丢失或被改坏，后端选不到可用账号。

**修复方案（按优先级）**：
1. **快速修复（推荐）**：在批量修改中补回正确的透传映射（例如 `gpt-5.3-codex -> gpt-5.3-codex-spark`）。
2. **彻底重建**：删除并重新添加全部相关账号（最稳但成本高）。

**关键经验**：
- 如果某模型已被软件内置默认映射覆盖，通常不需要额外再加透传；
- 但当上游模型更新快于本仓库默认映射时，**手动批量添加透传映射**是最简单、最低风险的临时兜底方案；
- 批量操作前尽量按平台分组，不要混选不同平台账号。

---

### 坑 11：PR 提交前检查清单

提交 PR 前务必本地验证：

- [ ] `go test -tags=unit ./...` 通过
- [ ] `go test -tags=integration ./...` 通过
- [ ] `golangci-lint run ./...` **和** `golangci-lint run --build-tags embed ./...`
      两遍都无新增问题（不带 tag 漏掉 `internal/web` 那四个 embed 侧文件，带 tag 反过来
      漏掉 `embed_off.go`，两遍互补，见「坑 12」）
- [ ] `make test-frontend` 通过（lint:check → typecheck → 关键 spec）
- [ ] `pnpm-lock.yaml` 已同步（如果改了 package.json）
- [ ] 所有 test stub 补全新接口方法（如果改了 interface）
- [ ] Ent 生成的代码已提交（如果改了 schema）

### 坑 12：`internal/web` 要两遍 lint 才覆盖得全，单跑任一遍都有盲区

`internal/web` 有 6 个 `.go` 文件，但**不带 build tag 时 Go 只认其中一个**
（`embed_off.go`）。其余 5 个全部落进 `IgnoredGoFiles`，`.golangci.yml` 里
enable 的所有 linter 一行都看不到：

```bash
cd backend
go list -f 'GoFiles:{{.GoFiles}} Ignored:{{.IgnoredGoFiles}}' ./internal/web/
# GoFiles:[embed_off.go]
# Ignored:[embed_on.go embed_test.go html_cache.go static_cache.go static_cache_test.go]
```

被跳过的正是前端↔后端 serving contract 的实现（nonce 替换、`__APP_CONFIG__`
注入、`<title>`/favicon 改写、SPA fallback、immutable 资源缓存头）。
`static_cache.go` 的约束是 `//go:build embed || unit`，`unit` 那半只影响
`go test -tags=unit`，**这一遍 lint 不带任何 tag，所以它同样不被 lint**——把它捞回来的
是 `embed` 那半，不是 `unit`。

第 5 个 `static_cache_test.go` 是 `//go:build unit`，**两遍都救不回来**：不带 tag 时它在
`IgnoredGoFiles` 里，带 `embed` 时它照旧在 `IgnoredGoFiles` 里（见下方带 tag 的实测输出）。
它属于下面那一段"同类盲区"，不是 embed 这一摊。所以上面 5 个文件里，`--build-tags embed`
只捞回 4 个。

CI 的 `golangci-lint` job 已经补上 `--build-tags embed`，但**它是加了一遍，不是换掉原来那遍**
——workflow 里两个 step 并存，先不带 tag 再带 tag。**本地也要照这个顺序跑两遍**：

```bash
cd backend
golangci-lint run ./...                      # 覆盖 embed_off.go
golangci-lint run --build-tags embed ./...   # 覆盖上面那四个文件
```

只跑不带 tag 的那遍，改这四个文件时本地全绿、CI 才报错。**只跑带 tag 的那遍，方向正好反过来
踩同一个坑**：`embed_off.go` 的约束是 `//go:build !embed`，加上 tag 它就被丢掉了。而带
`embed` 的只有 `Dockerfile`、`.goreleaser.yaml` 和 CI 的 `embed` job 三处，其余一切
——`go run ./cmd/server/`、`make test-unit`、`make test-integration`——编的都是它：

```bash
cd backend
go list -tags embed -f '{{.GoFiles}} TEST:{{.TestGoFiles}} IGN:{{.IgnoredGoFiles}}' ./internal/web/
# [embed_on.go html_cache.go static_cache.go] TEST:[embed_test.go] IGN:[embed_off.go static_cache_test.go]
```

两遍是互补关系，不是替代关系——**任何一遍单跑都覆盖不全 `internal/web`**，
`backend-ci.yml` 里那句注释说的就是这个。

带 tag 跑之前 `backend/internal/web/dist/` 必须有内容：`//go:embed all:dist` 在
type-check 阶段就要解析，dist 为空会直接报 `pattern all:dist: no matching files
found`（typecheck），根本轮不到 linter。CI 里由一个 placeholder step 兜底；本地
要么已经 build 过前端，要么手动塞一个占位文件：

```bash
mkdir -p backend/internal/web/dist
[ -f backend/internal/web/dist/index.html ] \
  || printf '<!doctype html>\n' > backend/internal/web/dist/index.html
```

> 顺带说明 `.gitignore` 第 103 行 `!backend/internal/web/dist/.keep` 的用意就是这个
> ——给 `//go:embed` 留个永久匹配项。但 `.keep` 从来没被创建、也没被跟踪，所以那条
> 例外一直空转。**不要靠 commit `.keep` 来修**：`vite.config.ts` 的
> `emptyOutDir: true` 每次 build 都会把它删掉，git status 里就会长期挂一条幽灵删除。

**同类盲区还在别处**：`unit`（359 个文件）、`integration`（72 个）、`e2e`（3 个）
这些 tag 下的文件目前都不在 lint 范围内——合计 434 个文件两遍 lint 都碰不到。
实测把 tag 加上分别会冒出 217 / 15 / 19 条问题，所以别顺手往 CI 里加——那是独立的一摊活。

## 五、常用命令速查

### 数据库操作

```bash
# 连接数据库
psql -U sub2api -h 127.0.0.1 -d sub2api

# 查看所有用户
psql -U postgres -h 127.0.0.1 -c "\du"

# 查看所有数据库
psql -U postgres -h 127.0.0.1 -c "\l"

# 执行 SQL 文件
psql -U sub2api -h 127.0.0.1 -d sub2api -f migration.sql
```

### Git 操作

```bash
# 同步上游
git fetch upstream
git checkout main
git merge upstream/main
git push origin main

# 创建功能分支
git checkout -b feature/xxx

# Rebase 到最新 main
git fetch upstream
git rebase upstream/main
```

### 前端操作

```bash
# 安装依赖（必须用 pnpm）
cd frontend
pnpm install

# 开发服务器
pnpm dev

# 构建
pnpm build
```

### 后端操作

```bash
# 运行服务器
cd backend
go run ./cmd/server/

# 生成 Ent 代码
go generate ./ent

# 运行测试
go test -tags=unit ./...
go test -tags=integration ./...

# Lint 检查：必须两遍，缺一遍就有覆盖盲区（原因见「坑 12」）
golangci-lint run ./...
golangci-lint run --build-tags embed ./...
```

## 六、项目结构速览

```
sub2api-bmai/
├── backend/
│   ├── cmd/server/          # 主程序入口
│   ├── ent/                 # Ent ORM 生成代码
│   │   └── schema/          # 数据库 Schema 定义
│   ├── internal/
│   │   ├── handler/         # HTTP 处理器
│   │   ├── service/         # 业务逻辑
│   │   ├── repository/      # 数据访问层
│   │   └── server/          # 服务器配置
│   ├── migrations/          # 数据库迁移脚本
│   └── config.yaml          # 配置文件
├── frontend/
│   ├── src/
│   │   ├── api/             # API 调用
│   │   ├── components/      # Vue 组件
│   │   ├── views/           # 页面视图
│   │   ├── types/           # TypeScript 类型
│   │   └── i18n/            # 国际化
│   ├── package.json         # 依赖配置
│   └── pnpm-lock.yaml       # pnpm 锁文件（必须提交）
└── .claude/
    └── CLAUDE.md            # 本文档
```

## 七、参考资源

- [上游仓库](https://github.com/Wei-Shaw/sub2api)
- [Ent 文档](https://entgo.io/docs/getting-started)
- [Vue3 文档](https://vuejs.org/)
- [pnpm 文档](https://pnpm.io/)

## 八、设计验证 / Design verification

前端改样式（`src/style.css`、各 SFC 的 class）之后，用 `frontend/scripts/` 下的四个
验证脚本实测浏览器里的真实结果，而不是靠读 diff 判断。

> **这些是手动检查，CI 不会替你跑。** `frontend/scripts/` 整个目录在 `.gitignore`
> 第 123 行被忽略，不会进仓库，所以 CI 检出的代码里根本没有这些脚本——同样，别人
> 重新 clone 一份也一个都拿不到。**本节的检查没法被别人或 CI 继承**：它只对本机
> 已经有这些文件的人成立，交接时得单独把目录拷过去，否则照着本节做的人第一步就
> `MODULE_NOT_FOUND`。
>
> **CI 也跑不起来。** 脚本依赖 `playwright`（本地 1.61.0 可用），但它既不在
> `frontend/package.json` 也不在 `pnpm-lock.yaml` 里，CI 的
> `pnpm install --frozen-lockfile` 装不出 playwright，更没有浏览器内核。
> 只有本机能跑。

### 1. a11y-runtime-check.mjs —— 无障碍偏好分支

实测 `prefers-reduced-transparency`、`prefers-reduced-motion`、`prefers-contrast`
三个分支，对比度按**合成后**的颜色计算（`--label-secondary` 带 alpha，直接读会算出
一个用户根本看不到的颜色）。

```bash
cd frontend
node scripts/a11y-runtime-check.mjs
```

**必须不带任何参数跑。** 它的结论只由"这次实际量到的东西"算出来：加了
`--only-light` 或 `--routes=…` 就不会去量深色/其它路由，于是即使深色模式有 12 个
CRITICAL 缺陷，退出码依然是 0。带参数的运行只能当调试输出看，**不能当验证证据**。

**怎么读**：先看 `VERDICT` 五行——每个偏好是否真的生效（`NO` 说明该分支没做或没生效，
而不是"没问题"）。再看 `BUGS: N`；控制台只列前 12 条，完整列表在
`/tmp/s2a-a11y-runtime/REPORT.md`，每条都带实测证据和责任文件。
出现 `CRITICAL` / `HIGH` / `HARNESS` 时退出码为 1。

半透明表格里的 `opaque?` 列有两种 `n/a`，都不计入 bug 数：`n/a — display:none`
（看不见的层谈不上半透明），以及 **`n/a — unmatched selector`**。后者是
alpha 0 + `backdrop-filter: none` + CSSOM 里没有任何规则匹配这个选择器——三个条件
同时成立，说明探针注进去的是个**没被任何样式命中的空 `<div>`**，而不是一块被中和
掉的材质：`getComputedStyle` 把这两种情况报成一模一样，而按 alpha 判定的分类器会把
空 div 读成"alpha 0 < 0.999，还是半透明的"，凭空造出 CRITICAL / HIGH / MEDIUM。
所以**看到 `n/a — unmatched selector` 是去修脚本的目标列表，不是去修样式表**：
那个类几乎一定是被改名或删掉了。报告末尾"Unmatched selectors"一节单独列出它们，
让改名这件事可见而不是无声无息。

**"Inline-utility sweep"只报真正在模糊的元素**（`backdrop-filter` 不为 `none`），
不报低 alpha 背景色——**不要"顺手改回去"**。`prefers-reduced-transparency` 针对的是
能透视到页面的**模糊材质**；不透明卡片上的一层扁平色调（badge 的 α0.024、
stat-icon 的 α0.1 之类）对比度是设计定死的，背后什么也透不过来，把它们一并报出来
只会逼着人把整套语义色系压成纯色，那是设计倒退而不是修 bug。放宽成查 alpha 时，
这一项在同样几条路由上报了 103 个元素，全都 `backdrop-filter: none`。
`.modal-overlay` 另外单独豁免：它的半透明**就是它的功能**，遮罩变不透明等于把整页
涂黑。真正的回归照旧会被抓到——模板里随手写个 `backdrop-blur-*` 就会出现在这张表里。

### 2. responsive-check.mjs —— 响应式断点与布局

```bash
cd frontend
node scripts/responsive-check.mjs
```

**怎么读**：每个 check 打印 `PASS` / `FAIL`，末尾汇总 `FAILED checks: …`，
报告在 `/tmp/s2a-responsive/REPORT.md`。有任何 check 失败则退出码为 1。

注意 Check 5 的卡片/表格边界是 **1024px**，两处实现必须一致：
`DataTable.vue` 用 `(min-width: 1024px)`，`TablePageLayout.vue` 用
`innerWidth < 1024`。两者曾经一个 768 一个 1024，导致 768–1023px 区间出现
"移动端容器里套桌面版 `<table>`"，那次分歧本身就是 bug（已在 64a9d6701 修掉）。

Check 6（sticky 列 + 横向滚动）的行标题形如
`non-sticky cell x after 395px scroll (asked 400)`——**两个数不一样是正常的**，
不是缺陷。虚拟化表格滚动时会重新量一遍尺寸，把 `scrollLeft` 从请求值推开几 px
（400 在 407px 的最大值下停在 395）。所以脚本等滚动稳定后取**实际落点**，全部断言
都拿这个落点比，包括"非 sticky 单元格 1:1 跟随滚动"那一条——它要证的是"真正发生
的那次滚动"。这条曾经硬编码请求值 400，于是一个行为正确的应用被那 5px 判成 FAIL。

### 3. purge-check.mjs —— Tailwind purge 是否吃掉了样式

`style.css` 里 `@layer components|utilities` 声明的类，如果没有任何 SFC 用到，
Tailwind 的 content 扫描会把规则整条丢掉，页面上就是"样式凭空消失"。

```bash
cd frontend
# 唯一可信的跑法：先出一份新构建，再拿 --dist= 指过去
npx vite build --outDir=/tmp/btr-purge/dist --emptyOutDir
node scripts/purge-check.mjs --dist=/tmp/btr-purge/dist

# 静态半场：跳过运行时那半，仍然要求 --dist 指向刚构建的产物
node scripts/purge-check.mjs --static-only --dist=/tmp/btr-purge/dist
```

> 构建务必带 `--outDir` 指到 `/tmp`。直接 `pnpm build` 会写进
> `backend/internal/web/dist`（`vite.config.ts` 第 107 行的 `outDir`）。那个目录被
> `.gitignore` 第 102 行忽略，**产物不在仓库里**（`git ls-tree HEAD` 和 `git ls-files`
> 查它都是空的），所以脏的不是仓库，而是**别人本机那份产物**：`emptyOutDir: true`
> 会先把整个目录清空再写，而 `-tags embed` 打包时 `//go:embed all:dist` 嵌的正是这份
> 目录。顺带一提，第 103 行那条 `!backend/internal/web/dist/.keep` 例外是空转的——
> `.keep` 既没被跟踪也不在磁盘上，所以第 98–99 行注释里说的"留个占位让
> `//go:embed all:dist` 在 CI/lint 里总能匹配到"并没有真的生效。

> **`--static-only` 不构建任何东西**，只是不跑运行时那半；它照旧去 `--dist` 指的
> 目录里 grep 已有的 CSS。而 `--dist` 默认是 `/tmp/s2a-purge/dist`，也就是上一次
> 构建剩下的旧产物。拿旧产物比当前源码，等于把这一轮新加或改名的类全数报成
> `LOST`——曾这样刷出 5 条假 `LOST`。其中 3 条是真类名（`.btn-outline-danger`、
> `.input-sm`、`.safe-bottom`），它们在新构建里都好好地在。**只有 `--dist=` 指向
> 一份刚出的 `/tmp` 构建，`LOST` 列表才算证据**；省掉 `--dist` 的运行只能当调试
> 输出看，**不能当验证证据**。
>
> 另外 2 条（`.w3`、`.org`）根本不是类，`style.css` 里没有这两个选择器
> （`rg "^\s*\.(w3|org)\b" frontend/src/style.css` 无匹配），它们曾经是脚本自己的解析
> 噪声：`declaredSemanticClasses()` 对不含 `{` 的行会把整行当选择器扫，而
> `style.css` 第 632/640 行是 `background-image: url("data:image/svg+xml,…")` 里的
> `xmlns='http://www.w3.org/2000/svg'`，于是 `www.w3.org` 被切成 `.w3` 和 `.org`。
> **这是选择器正则的 bug，不是样式表的问题**，别去 `style.css` 里找这两个类。
>
> **这个 bug 本机已经修好了**：`purge-check.mjs` 里加了个 `blankUrls()`，在扫选择器之前
> 把每个 `url(...)` 的内部逐字符涂成空格（保留换行，所以报出来的行号还是真实行号），
> 手扫而非正则——单条 `url\(...\)` 正则会回溯吃掉同行的真选择器。它的 docstring 里点的
> 就是 `style.css:632` / `:640` 这两行。实测拿当前 `style.css` 过一遍
> `declaredSemanticClasses()` 的选择器扫描：接上 `blankUrls()` 之后被去掉的正好只有
> `.w3` 和 `.org` 两个，其余 124 个真类名（含 71 个跨行选择器列表里的）一个没少。
> **但这个修复传不出去**：`frontend/scripts/` 整个目录被 `.gitignore` 第 123 行忽略，
> 不进仓库。别人 clone 或 CI 检出的代码里没有 `blankUrls()`，那两条假 `LOST` 照旧会冒出来
> ——交接时得把脚本目录一起拷过去，否则对方看到的还是修之前的行为。

**怎么读**：`LOST` 表示类在源码里有定义、在产物里没了；`probe failures` 是把类名
注入真实页面后计算样式不符合预期。末尾 `VERDICT`，有问题则退出码为 1。

### 4. visual-check.mjs —— 逐路由截图

```bash
cd frontend
node scripts/visual-check.mjs
```

**怎么读**：脚本只能证明"这个路由渲染出来了、有内容、没有报错"——它验证不了
"好不好看"。`/tmp/s2a-visual/` 下的 PNG **必须人眼过一遍**，脚本 PASS 不等于视觉没问题。
末尾一行汇总 `routes: … | failed: … | screenshots: … | distinct console errors: …`。
默认全量跑当前是 10 条路由、50 张截图（`ROUTES` 10 项，经 `buildVariants` 按
主题 × 玻璃层级 × 视口 展开成 16 个 context，开头 `variants` 那行会先把这两个数打出来）。
**数目以脚本自己打的那两行为准，不要以本节为准**：往 `ROUTES` 加一条路由、或给某条加上
`full` / `mobile` / `scrolled`，截图数就会跟着变，而文档里的数字是死的。要判断有没有
路由被跳过，看开头 `routes` 那行列出的 id 是否齐全、末尾 `failed:` 是否为 0，别拿总数
去对——`--fast`（只跑 default 玻璃层级）、`--only-light`（只跑浅色）、`--routes=`
本来就会让截图数少一截。

`payment` 路由（覆盖 `PaymentView`）有两处反直觉的地方，改这条路由前先看清：

- **路径是 `/purchase`，不是 `/payment`。** `/payment/*` 只挂 qrcode/result/
  stripe/airwallex/stripe-popup 五个子页，填 `/payment` 会落到 404 catch-all；路由
  id 仍叫 `payment`。脚本会比对落地 `pathname` 与 `path`，写错直接 FAIL。
- 它依赖 `GET /payment/checkout-info` 的完整 fixture，其中 **`balance_disabled`
  必须是 `false`**。关掉余额充值后 `tabs` 只剩一项，tab bar 的
  `v-if="tabs.length > 1"` 不成立，这条路由要验的那个控件根本不会渲染。

同目录下的 `visual-check-README.md` 是这个脚本的详细说明（参数表、命名规则、各项
检测的由来）；里面的截图张数是旧的，数目以脚本末尾那行汇总为准。

### 另外两个小工具

```bash
cd frontend
node scripts/probe-sfc-style.mjs --sweep        # 扫 SFC 里 scoped/非 scoped 样式块
node scripts/sweep-scoped-style-leaks.mjs      # 查编译产物里泄漏到祖先选择器的规则
```

`sweep-scoped-style-leaks.mjs` 检查 `html` / `body` / `:root` / `.dark` /
`[data-*]` 这类祖先选择器有没有被组件层重新写一遍——它读的是**编译产物**，
比 grep 源码可靠。

`scripts/style-migration/` 不是工具，是当初那次 Tailwind 类名迁移 codemod 剩下的
库：只有 `lib/`（类名解析、pnpm store 里找 `@vue/compiler-sfc` 的兜底）、
`dictionary.json`（`text-gray-500|dark:text-gray-400` → `text-content-tertiary`
这类映射表），以及一个空的 `__tests__/`（里面一个文件都没有，看到它是空的不是走错
地方）。驱动脚本已经不在了，没有入口可跑。查历史上某个旧类名被换成了什么，
翻 `dictionary.json`。
