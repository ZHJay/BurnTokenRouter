# Sub2API 前端视觉重构 · Phase C 完工交接（Handoff → Phase D）

> 面向下一个执行 agent。读本文档 + `HANDOFF-PHASE-C.md` + `HANDOFF.md` 第 1 节，即可无需提问直接接手。
> 最后更新：2026-08-08 · 分支 `codex/apple-liquid-glass-v3`

---

## 0. 一句话现状

**Phase A（静态设计稿）、Phase B（推广到 Vue 全站）、Phase C（深化 + 收口）均已完成并提交。** 工作区干净，无未提交改动。

与 Phase C 接手时最大的不同：**这次没有"178 个文件等着你提交"的负债。** 你接手的是一个已提交、闸门全绿的树。

| 闸门 | 数值 | 备注 |
| --- | --- | --- |
| `vitest run` 全量 | **1947 通过 / 2 失败 / 1 todo** | 2 红是 `src/api/__tests__/admin.system.rollback.spec.ts` 的**既有失败**，Phase B 之前就是红的，与视觉无关，**别去修** |
| `vue-tsc --noEmit` | **exit 0，零输出** | |
| `vite build` | **exit 0** | |
| `phase-b-qa/verify.py` | **150/150** | |
| `phase-c-qa/phase-c-landing-qa.py` | **81/81** | |

`1 todo` 是 `badgeDarkMode.spec.ts` 里刻意留的 `it.todo`，标注一条需产品决策的对比度项（见第 3 节 D5）。

---

## 1. 提交记录

### Phase B（8 个提交，`e4ffbeed1` → `666acbfd0`）
Phase C 接手时这 178 个文件全在工作区未提交，已按阶段拆分落地：token 基座 → i18n → GlobalNav → 图表主题 → 公共组件 → 业务组件 → 全站页面 → QA harness 与文档。

### Phase C（6 个提交，`666acbfd0` → `be0f79ae1`）
**72 文件，+9949 / −1230，新增/改动 17 个 spec 文件。**

| Commit | 内容 |
| --- | --- |
| `b59cdc87b` | Landing 页深化为完整营销页（13 个组件 + useReveal） |
| `f3e42f17a` | 全局命令面板（⌘K），替换顶栏展开式搜索条 |
| `3ddcb98f6` | ModelPlaza 卡片化，密集定价表保留为可切换视图 |
| `cdc0fdb11` | 公告弹窗与邮件模板视觉同步 |
| `92ea78986` | 徽标暗色达标并消除 `.b-*` 双份事实来源 |
| `be0f79ae1` | Phase C QA harness 入库 |

---

## 2. 工程纪律（**这一节是本文档最高价值的部分，违反会浪费你数小时**）

### 2.1 绝对不要碰 pnpm CLI —— 包括 `pnpm exec`

本机 pnpm **11.16.0** 在**任何子命令之前**都会跑一次 install 校验，顺手重写 `frontend/pnpm-lock.yaml` 并**丢掉三条安全钉版**（`js-cookie: 3.0.7` / `form-data@<4.0.6: '>=4.0.6'` / `postcss@<8.5.18: '>=8.5.18'`）。

这个坑今天踩了**三次**，包括我以为安全的 `pnpm exec`。正确姿势（在 `frontend/` 下）：

```bash
./node_modules/.bin/vitest run <路径>     # 已实测锁文件零改动
./node_modules/.bin/vue-tsc --noEmit
./node_modules/.bin/vite build --outDir /tmp/<你的目录>/dist
```

每次改动后顺手 `git status --short frontend/pnpm-lock.yaml`，非空就是被污染了。

**根治方案已实测验证，但未执行**（需用户决策，见 D1）。

### 2.2 `backend/internal/web/dist/` 是共享可变产物

`verify.py` / `sweep.py` / 各 harness 都靠它。协议：

- **重建 = 独占。** 多个 agent 同时 `vite build` 到同一目录会互相踩烂，跑出的分数毫无意义
- **读取 = 可并发**，只要各自用不同 `QA_PORT`（harness 只是静态服务这个目录 + mock 所有 API）
- **最佳实践：`vite build --outDir /tmp/<自己的目录>/dist` + `QA_DIST` 指过去。** 完全不参与争抢，也不需要档期。Phase C 的 plaza / badge / landing 三个 agent 都用这招，零冲突

端口已用过：5287（verify 默认）、5293（sweep 默认）、5311、5391、5397、5399、5401、5403。

### 2.3 迁移脚本时必须改 `parents[]` 索引

`REPO_ROOT` 靠相对深度推导。Phase C 迁移 harness 时三个脚本都需要从 `parents[2]` 改成 `parents[3]`，否则会去找 `frontend/backend/internal/web/dist` 然后当场死掉。

顺带一条**已被证伪的指控**（别再重查）：有报告称 `phase-b-qa/verify.py` 有同样的 bug。**不成立。** 它取的是**目录**的 `parents[2]`（`_HERE = Path(__file__).resolve().parent` 之后再 `.parents[2]`），phase-c 取的是**文件**的 `parents[3]`，两者算术等价，都落在仓库根。实跑反证：`verify.py` 未传 `QA_DIST` 时跑出 144/146。只有它第 31 行的**注释**是过期的（仍写着 `frontend/scripts/` 旧家）。

### 2.4 `.gitignore` 第 125 行的裸 `scripts` 规则匹配任意层级

`frontend/scripts/` 整个目录不被跟踪（现存 23 个 `.mjs` + Phase C 一度落在那里的 8 个 QA 脚本，全部未入库）。往仓库放新工具前先 `git check-ignore -v <路径>` 自证，**别只靠"我移动了文件"就宣布完成**。

`design-demo/` 已验证可跟踪，是既有惯例。

---

## 3. Phase C 期间挖出的真知识（按会不会再咬人排序）

### 3.1 Tailwind 3 的 `@layer` 在产物里不存在，胜负由特异性算术决定

编译产物里 `@layer` 出现 **0 次** —— `@layer components` 是编译期指令，会被摊平成无层级普通规则。所以：

| 规则 | 特异性 | 结果 |
| --- | --- | --- |
| 全局亮 `.b-openai` | (0,1,0) | 被 scoped 压过 |
| scoped 亮 `.b-openai[data-v-x]` | (0,2,0) | **赢亮色** |
| 全局暗 `html.dark .b-openai` | (0,2,1) | **赢暗色**（`html` 类型选择器多一分） |
| scoped 暗 `:global(html.dark) .b-x[data-v-y]` | (0,3,1) | **压过全局暗色** |

**推论：scoped 样式里写 `:global(html.dark)` 会静默遮蔽全局暗色覆盖。** 这是"改了全局 token 但暗色没生效"的头号成因。Phase C 用哨兵色在 Chromium 实跑四种组合验证了这张表——**不要凭推理判断层叠胜负，写个哨兵实测**。

### 3.2 `.gn-search-bar` 是一张豁免票，危险在滥用而非改名

`verify.py:278` 的 `if (el.closest('.gn-flyout, .gn-search-bar, .gn-pop')) continue;` 在**豁免**这些容器内的元素免受"顶栏子元素不越界"断言。

所以：改名会让断言**当场变红**（响亮失败，不是静默）。真正的隐患在反面——**以后任何人往顶栏加悬挂元素、顺手套上这个 class，就静默继承豁免**，那个元素里真实的溢出 bug 会完全逃过 150 条断言。

行动指引：改名可以（同步更新 `verify.py:278` + `sweep.py:1267,1278` 三处即可）；**给新元素套这个 class 才是需要论证的决定。**

### 3.3 `verify.py` 的断言计数法（对账用，别靠削弱断言凑分）

正常组合记 **3** 条断言（零溢出 / 顶栏子元素不越界 / 零 logo 图片），`page loads` **只在失败时**才记 1 条。所以**一个组合挂掉 = 净 −2**。

实例：我接手时跑出 144/146（两个组合挂），Phase C 收尾跑出 150/150。差值精确对账：`146 − 2 + 6 = 150`。harness 文件全程未改。

那两次失败（`/admin/users light 768`、`/usage dark 768`）都是 `wait_for_function` 挂载超时，发生在 4 个 xhigh agent 并发跑 vitest/playwright 时。**真视觉回归不会表现成挂载超时**——机器安静后自然全绿。

### 3.4 i18n 浅层展开会静默替换整棵子树

`locales/{zh,en}/index.ts` 用 `{ ...landing, ...common, ...dashboard, ... }`。新增一个导出同名顶层 key 的模块，会**整棵替换**而非合并，那棵树下所有 key 变裸串。

Phase C 遇到过一次（`modelPlaza` 同时存在于 `dashboard.ts` 与新建的 `modelPlaza.ts`），最终解法是**收成单一来源**：把子树整体迁走，而不是用 `import dashboard` + `...base` 手工 re-spread 维持正确，也不是给防碰撞 spec 加白名单豁免。

防线：`i18n/__tests__/localesNoKeyCollision.spec.ts` 的 `roots` 表。**新增根模块必须注册进去**，否则该模块的碰撞风险零覆盖。

迁移无损的正确证明方式：**在两份副本并存的窗口里跑临时 spec 断言逐字 `toEqual`**，绿了再删原件。这比事后反推"key 还在不在"强得多——它证明的是转录逐字无误。

### 3.5 多浮层各自直写 `body.style.overflow` 是一类缺陷

现在全仓库只有 `composables/useCommandPalette.ts` 直写，其余一律走它导出的引用计数锁：

```ts
import { lockBodyScroll, unlockBodyScroll, resetBodyScrollLock } from '@/composables/useCommandPalette'
```

**契约：成对调用 + 每个浮层配一个本地布尔防重复计数 + `onBeforeUnmount` 释放。** 本地布尔是承重的——没有它，二次打开会双重计数，页面永远解不开锁。

计数器是模块级共享状态，所以测试里 `resetBodyScrollLock()` 要放 `beforeEach`，否则挂载了不卸载的浮层会把锁泄漏进下一个用例。

**这条不是洁癖。** Phase C 三个浮层（移动端菜单 / ⌘K 面板 / 公告弹窗）并行开发时，直写与计数混用会产生**永久锁死页面**：铃铛写 `hidden` → 面板把 `hidden` 存为"原值" → 铃铛写 `''` → 面板"恢复"成 `hidden`，无人打开却滚不动。

### 3.6 Playwright 的同步 route handler 会阻塞驱动浏览器的线程

想模拟"接口迟到"时，在同步 route handler 里 sleep 会**卡住导航本身**，于是你采到的"pending 状态"其实是已 settled 的状态，断言变得毫无意义（且看起来是通过的）。正解：让请求落到 `ThreadingHTTPServer`，由它在独立线程上延迟。

### 3.7 `omit_background` 下的 alpha=35 截图伪影

Landing 页暗色全页截图读出浅灰，一度被判为"暗色模式坏了"。真相：暗色绘制的**颜色是正确的** `(0.1,0.1,0.1)`，但覆盖率只有 **35/255**，Playwright 合成到白底得 220。full Chromium 与 SwiftShader 同样复现，`/key-usage` 亦然。

**机制未查清**（两个假设已被证伪：拼接伪影、`backdrop-filter`/SwiftShader）。复现工具保留在 `phase-c-qa/phase-c-dark-probe.py`。碰到同样现象先跑它，别急着改代码。

### 3.8 排查溢出走祖先链（Phase B 教训，Phase C 复用有效）

只报"哪些元素突出去了"永远找不到原因——突出去的通常是受害者。把越界元素**向上遍历到 `<body>`**，打印每层祖先的 `getBoundingClientRect` + `display` / `overflow-x` / `flex` / `min-width` / `max-width`。

---

## 4. 多 agent 并行的可复用经验

Phase C 用 5 个 agent（各自又拉了子 agent）并行改前端，**零文件冲突**。关键是三条：

1. **按文件所有权互斥划分，i18n 按模块分家。** 每个 agent 独占自己的 locale 文件；需要别人文件里的 key 时，把 key 名 + zh/en 文案发给 root 集中加。这是最容易冲突的点，分家后彻底消失
2. **共享可变产物要有协议**（dist 见 2.2）。最好的解法是各自输出到 `/tmp`，根本不共享
3. **越界发现只上报、不动手。** Phase C 有多条真缺陷是这样捞到的：`.b-*` 暗色不达标、`GroupBadge` 重复块、i18n 碰撞、`filters.modelLabel` 死 key、`CustomPageView` 的 `iframe` 放行

**provider 502 会打断 agent 的回合，但盘上的产出会留下。** 重试时要明确告诉它"你的文件还在，接着验证别重写"，否则它会从头再做一遍。

### 4.1 Phase C 实际用的分区表（可直接照抄改造）

这是产生零冲突的那张表。**注意 i18n 一列** —— 那是唯一真正会打起来的地方。

| agent | 独占文件 | 独占 i18n |
| --- | --- | --- |
| `phase_c_landing`（Mill） | `views/HomeView.vue`、新建 `components/landing/**` | `locales/{zh,en}/landing.ts` |
| `phase_c_plaza`（Einstein） | `views/ModelPlazaView.vue`、`components/modelPlaza/**` | 新建 `locales/{zh,en}/modelPlaza.ts` + **独占 `index.ts`** |
| `phase_c_cmdk`（Carson） | 新建 `components/command/**`、`composables/useCommandPalette.ts`、`components/layout/{GlobalNav.vue,navItems.ts}`、`styles/global-nav.css` | **独占 `locales/{zh,en}/common.ts`** |
| `phase_c_notify`（Faraday） | `components/common/{AnnouncementBell,AnnouncementPopup}.vue`、`components/admin/announcements/**`、`views/admin/AnnouncementsView.vue`、`views/admin/settings/EmailTemplateEditor.vue`、`styles/announcement-markdown.css` | `locales/{zh,en}/admin/settings.ts`、`misc.ts` |
| `phase_c_badge`（Socrates） | `style.css`、`components/common/GroupBadge.vue`、`i18n/__tests__/localesNoKeyCollision.spec.ts` | 无（只改 spec，不碰 locale 本体） |

三条支撑它的规则：

- **`index.ts` 只能有一个 owner。** 它是所有 locale 模块的汇合点，两个 agent 同时加一行必冲突
- **`common.ts` 只能有一个 owner。** 它是 key 最密集的公共文件。其余 agent 需要 key 时把「key 名 + zh/en 文案」发给 root，由 root 转给 owner
- **`components/common/` 不整体划给任何人。** Phase C 只把其中两个具名文件（两个 Announcement 组件）划给 notify、一个（GroupBadge）划给 badge，其余保持无主 —— 大家都能用，谁都不能改

### 4.2 拉起 agent 的参数

```
model            burndario/claude-opus-5
reasoning_effort xhigh
fork_turns       none          # 设了 model/reasoning_effort 就必须是 none
```

`fork_turns=none` 意味着 **agent 拿不到任何上下文**，所以任务消息必须自包含。Phase C 每条派活消息都包含：仓库绝对路径 + 分支、必读文档清单（本文档 + `HANDOFF.md` 第 1 节锁定决策 + `HANDOFF-PHASE-C.md`）、任务本体、独占文件清单 + 明确的「碰别人文件会冲突」、第 8 节铁律、验收标准与实测基线数字。

**给基线数字这件事被证明特别值钱。** 例如告诉 cmdk「`src/components/layout` 当前 51/51，这个数字只能增不能减」，它交付时报的是「51 → 67」并逐项说明增量来源；如果只说「别搞坏测试」，就没有可对账的东西。

### 4.3 一个会误导你的故障形态

**agent 的回合有时会退化成一个裸 "OK"，但盘上的工作其实已经做完了。** Phase C 有三个 agent（notify、cmdk、render_verify）各自遇到过一到两次，都是在下一回合自己说明「上一条是故障，不是任务状态」然后补交完整报告。

所以收到裸 "OK" 时：**先 `git status` / `git diff` 看盘上有没有产出，再决定是要它重新汇报还是真的重做。** 直接判定失败并让它重做，会白扔掉一轮完整工作。

---

## 5. 交给 Phase D 的待决策项（**全部需要用户拍板，我没擅自动**）

### D1 · pnpm 锁文件回退的根治（优先级最高，因为它每天都在咬人）

根因已定位：pnpm 11 不再读 `package.json` 的 `pnpm.overrides`（每次运行都 warn），而仓库**没有 `packageManager` 字段**钉住版本。

**根治方案已在隔离沙盒实测验证**：把 `overrides` 搬到 `frontend/pnpm-workspace.yaml`：

```yaml
overrides:
  js-cookie: 3.0.7
  form-data@<4.0.6: '>=4.0.6'
  postcss@<8.5.18: '>=8.5.18'
```

实测结果：pnpm 11.16 **正常读取**，生成的锁文件保住 `overrides:` 块，且把 `^2.2.1` 的 js-cookie 真实解析成 `3.0.7`。

**我没执行**，因为它需要跑 `pnpm install` 重写锁文件才生效，而交接文档明确说这是独立改动、不该混进视觉重构。建议单独一次提交，并同时加 `packageManager` 字段钉住 pnpm 版本。

### D2 · `formatCost` 的 `toFixed(4)`（Phase C 交接文档的 P2，我把它从"两难"变成了"不两难"）

原判断是需要产品决策，因为 2 位小数会把 `$0.0012` 显示成 `$0.00`。

**但仓库里已经有做对了的函数**：`src/utils/formatters.ts` 的 `formatMultiplier()` —— 至多 4 位小数、去掉末尾多余的 0、**但至少保留 2 位**。于是 `$0.0000 → $0.00`、`$51200.8000 → $51200.80`、`$0.0012 → $0.0012`。**三个目标同时成立，取舍消失了。**

涉及 8 处 `toFixed(4)`：`UserDashboardStats.vue:370`、`PlatformUsageBreakdown.vue`(×4)、`PlatformCostCell.vue`(×2)、`KeysView.vue`(×3)。仍需用户点头，因为这是**金额显示逻辑变更**。

### D3 · 支付流程端到端（Phase B 遗留，Phase C 未推进）

本机 `:8080` 未启动，全程 mock。支付逻辑零改动（21 个文件 138 个支付测试全绿），但**真机支付仍需在有后端的环境复核一次**。

### D4 · `.b-blue` / `.b-red` / `.b-purple` 暗色低于 AA

实测卡片底 **3.86 / 4.26 / 3.54:1**。它们直接消费 `--blue` / `--red` / `--purple`，是**用户锁定的 iOS 系统色**，所以没动。`badgeDarkMode.spec.ts` 已设地板防止继续劣化。改它等于改锁定决策第 3 条。

### D5 · `.b-claude` / `.b-green` / `.b-orange` 在"自嵌套 + 行 hover"叠加下 3.6–3.8:1

根因是 `GroupBadge` 把同一个 `.b-*` 套在外层徽标里让 tint 叠两次。彻底解要改模板结构。这是 `.b-*` 体系既有特性（`.b-claude` 是 Phase A 定稿基准），非本轮引入。spec 里留了 `it.todo` 标注。

### D6 · 邮件在真实客户端的表现

**Outlook 的 Word 引擎忽略 `border-radius`，所以邮件卡片在那里会渲染成方框** —— Chromium 与 Outlook 不会一致。另外"明暗字节相同"只证明 Chromium 不强制反转，Gmail 与 Apple Mail 各有自己的重映射。本机无法验证。

### D7 · 公告 blockquote 的层级语义变了

修对比度时把它从"弱化的旁注"变成了"蓝底上的全强度提示块"。对警告类内容是改善；如果有公告用引用块放**从属信息**（引文、题外话、小字），那些会开始与正文抢注意力。

### D8 · `--text-secondary` on `--fill` 的 AA 余量只有 0.11

亮色 4.61 对 4.5 的地板。这是**token 对的系统性属性**，不是单个组件的问题（`th`、`.gpill`、行内 code 都用这个组合）。未来任何加深 `--fill` 或提亮 `--text-secondary` 的动作都会吃掉它。

### D9 · 其余低优先级（细节见各 commit message 与 Phase C agent 报告）

- ModelPlaza 分组按**生效倍率升序**而非管理员配置顺序——若配置顺序本意是权威的，这是在静默覆盖
- `filters.modelLabel` 已成死 key（卡片化把模型搜索移进 `.toolbar`）
- ⌘K **不支持拼音**（`yhgl` 匹配不到"用户管理"，匹配是字符子序列）
- `CustomPageView.vue:244` 的 `DOMPurify` 放行 `ADD_TAGS: ['iframe']` + `ADD_ATTR: ['src']`。路由是 `requiresAuth: true` / `requiresAdmin: false`，**任何登录用户可看**；写入权限未追到后端。这是全仓唯一放宽消毒的地方（公告路径是默认 config，已审计干净）
- `/` **不在** `BACKEND_MODE_ALLOWED_PATHS`（`router/index.ts:741`），所以开启 backend mode 时未登录访问首页会跳 `/login`，整个 Landing 页不可见
- 混计费卡片等高留白（按图卡与 token 卡等高，`Per image` 与单价间有空隙）；零模型分组仍渲染成可点 chip
- 死代码：`useReveal` 的 `once:false` 分支、`LandingSection` 的 `align` prop

---

## 6. Phase D 候选（尚未开工）

来自 `HANDOFF.md` 第 6 节，Phase C 未覆盖的部分：

- **设置页分组列表化**（iOS 设置风格）。⚠️ `SettingsView.vue` 有 **12621 行**，Phase B/C 都只做了外壳收口、刻意没重写——那是不可控的回归源。真要动，先拆分再重构，并且必须有逐 tab 的截图基线
- **空状态/插画统一**。`EmptyState.vue` 有 31 个消费者（含 9 个 spec），跨文件面很大；另有 12 处内联空状态没走共享组件。**天然跨越所有 agent 的文件边界，需要单独一波、不要与别的任务并行**
- **上游同步**：本仓库跟踪 `Wei-Shaw/sub2api`。视觉重构后 merge upstream 会在 layout/样式文件上冲突。建议功能修复 cherry-pick，样式以本分支为准

---

## 7. 接手检查清单

1. `git status` 应为**干净**（Phase C 已全部提交）
2. 通读 `HANDOFF.md` 第 1 节锁定决策 —— 那 8 条是用户逐条确认的，不得擅自更改
3. 通读本文档第 2 节（工程纪律）与第 3 节（真知识）。它们各自花了实打实的时间
4. 跑闸门确认接手时是绿的（**注意用 `./node_modules/.bin/`，不要用 pnpm**）：
   ```bash
   cd frontend
   ./node_modules/.bin/vitest run          # 应 1947 通过 / 2 红（rollback 既有失败）
   ./node_modules/.bin/vue-tsc --noEmit    # 应 exit 0
   ./node_modules/.bin/vite build          # 应 exit 0
   ```
5. 跑视觉闸门：
   ```bash
   PYTHONDONTWRITEBYTECODE=1 QA_PORT=5411 /opt/miniconda3/bin/python \
     frontend/design-demo/phase-b-qa/verify.py        # 应 150/150
   ```
   分数不对就报精确差值并按 3.3 节对账，**不要靠削弱断言凑分**
6. 双击 `frontend/design-demo/index.html` 建立视觉基准（明暗各切一遍，悬停"资源"看浮出 + 纱幕）

---

## 8. 铁律速查（Phase A + B + C 合并版）

1. **`design-demo/` 只读**，它是设计基准与历史证据（本文档与 `phase-c-qa/` 是本轮新增的例外）
2. **绝不碰 pnpm CLI**，含 `pnpm exec`。用 `./node_modules/.bin/*`（见 2.1）
3. **`display:flex` / `display:grid` 的类绝不能直接挂在 `<td>` / `<th>` 上** —— 会覆盖 `display: table-cell` 破坏表格布局。必须在单元格内包一层 `<div>`
4. **浮出层/下拉/弹窗必须不透明**（`var(--glass-bg-strong)`）+ 纱幕压暗（亮 18% / 暗 45% 黑）。用户明确否决过半透明
5. **玻璃质感只保留四处**：顶栏、登录页玻璃卡、ambient 环境渐变、**DataTable 固定列**（第 4 处于 2026-08-09 经用户确认加入，实现细节与已接受的性能代价见 `HANDOFF.md` §8.1；那里的三层减害措施不要拆）。`backdrop-filter` 不要嵌套依赖，也不要再擅自增加第 5 处
6. **全站禁止渲染 logo 图片**。品牌 = 站点名纯文本 wordmark，favicon 是唯一例外。`site_name` 管理员可配、长度不可预期，**别让它成为 flex 唯一可压缩项**（Phase B 曾被压成单个字符 "S"）
7. **禁止硬编码颜色**，一律消费 CSS 变量。唯一例外是**邮件 HTML 正文**（收件端不支持变量），但色值要对应设计 token
8. **禁止硬编码中文**，走 i18n key，zh/en 同步
9. **不要批量替换 `primary-*` / `dark-*` / `emerald-*` 等 class**。`tailwind.config.js` 已整体重映射（primary 全站 1719 处引用），现有 class 已经自动是苹果配色。批量替换是无意义 churn + review 噪音
10. **主题走 `useTheme()`**，localStorage key 固定为 `theme`（值只有 `'dark'`/`'light'`，key 不存在 = 跟随系统）。组件内禁止调 `initTheme()`，那是 `main.ts` 专用
11. **滚动锁走引用计数锁**，禁止直写 `body.style.overflow`（见 3.5）
12. **顶栏高度断言 ≠ 子元素不越界**，必须分别断言
13. **对 CSS 文件跑 eslint 会报假错**（`Parsing error: Declaration or statement expected`），本仓库 eslint 未配 CSS 解析器。CSS 的真实闸门是 `vue-tsc` 与构建
14. **Playwright**：`networkidle` 在本应用不可用（轮询页永不 idle，冷启动又会在 Vue mount 前返回）；`full_page=True` 让 sticky/fixed 元素拖影，判断浮层一律用视口截图；driver.js 引导教程渲染全视口遮罩拦截所有 pointer 事件，必须先种入 `admin_guide_<userId>_<role>_v4_interactive` / `user_guide_...`
15. **不要启动 `backend/bin/server`**，它连真实数据库。截图/验收一律 mock
