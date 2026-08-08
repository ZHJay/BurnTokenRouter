# Sub2API 前端视觉重构 · Phase B 完工交接（Handoff → Phase C）

> 面向下一个执行 agent。读本文档 + Phase A 的 `HANDOFF.md` + `apple-theme.css` 头部注释，即可无需提问直接接手。
> 最后更新：2026-08-08 · 分支 `codex/apple-liquid-glass-v3`

---

## 0. 一句话现状

**Phase A（静态设计稿）与 Phase B（推广到 Vue 全站）均已完成。** 侧边栏已删除，全站改为 48px 磨砂顶栏 + 全宽浮出菜单 + 纱幕。功能零改动。

**⚠️ Phase B 的 178 个文件改动尚未提交**，全部在工作区。接手第一件事是审阅并提交（见第 6 节）。

| 指标 | 数值 |
| --- | --- |
| 改动规模 | 178 文件，+8060 / −5193 |
| 测试 | **1508 / 1510 通过**（套件从 1459 → 1510，新增 51 个用例） |
| 唯一失败 | `src/api/__tests__/admin.system.rollback.spec.ts` 的 2 个用例 —— **本次工作前就是红的**，与视觉无关，别去修 |
| 构建 | `pnpm build` 通过（vite ~14s） |
| 验收断言 | 自建 Playwright harness **150 / 150** |
| 截图证据 | 58/60 路由 × 明暗 × 桌面/移动 = 232 张 + 14 个交互态 = **246 张** |

---

## 1. Phase A 交付物清单（`frontend/design-demo/`，全部未被改动，是唯一设计事实来源）

这些是**定稿的设计基准**。Phase B 的所有视觉都对标它们，Phase C 也必须继续对标。双击 `index.html` 即可离线浏览，无构建依赖。

| 文件 | 行数/大小 | 作用 |
| --- | --- | --- |
| `apple-theme.css` | 30 KB | **设计系统单一事实来源**：全部设计 token（亮/暗双套 CSS 变量）+ 20 余种组件类 + 响应式规则。头部注释含使用规范与血泪教训 |
| `apple-theme.js` | 19 KB | demo 基座脚本：主题应用（防 FOUC）、GlobalNav 注入、顶栏交互、浮出菜单触屏支持、移动端汉堡 + 滚动锁定。**仅供参考**，Phase B 已用 Vue 重写等价交互 |
| `index.html` | 7.5 KB | demo 入口 + 组件画廊 + token 色板（评审用） |
| `login.html` | 10 KB | 登录页基准：居中玻璃卡 + 漂移光斑背景 + 第三方登录 |
| `user-dashboard.html` | 20 KB | 用户仪表盘基准：统计卡 + 纯 CSS 柱状图 + 密钥表格 + 订阅卡 |
| `admin-accounts.html` | 37 KB | **最重表格场景基准**：分组浮出导航 + 筛选工具条 + 批量操作条 + 10 列复杂表格 + 分页 |
| `qa-screenshot.py` | 3.4 KB | Phase A 的静态 HTML 截图脚本（打 `file://`）。Phase B 的真实应用截图工具见第 5 节 |
| `HANDOFF.md` | 16 KB | **Phase A 交接文档，务必通读**。第 1 节是用户逐条确认的锁定决策，第 4 节是血泪教训，第 6 节是 Phase C 候选清单 |
| `HANDOFF-PHASE-C.md` | 本文件 | Phase B 完工交接 |

**铁律：`design-demo/` 只读。** 它是设计基准与历史证据，任何 Phase C 改动都不应落在这里。校验：`git status --short frontend/design-demo/` 必须只显示本文件为新增。

---

## 2. 用户已锁定的决策（Phase A 逐条确认，Phase C 不得擅自更改）

完整版见 `HANDOFF.md` 第 1 节。最容易被误改的几条：

1. **全站禁止渲染 logo 图片**。品牌 = 站点名纯文本 wordmark。favicon 是唯一例外（`utils/branding.ts#updateFavicon`）。规范写法：`appStore.cachedPublicSettings?.site_name || appStore.siteName || 'Sub2API'`
2. **浮出层/下拉/弹窗必须不透明**（`var(--glass-bg-strong)`）+ 纱幕压暗（亮 18% / 暗 45% 黑）。用户明确否决过半透明——密集文字会透出来，调多高不透明度都不够
3. **玻璃质感只保留三处**：顶栏（0.72 + `saturate(180%) blur(20px)`）、登录页玻璃卡、ambient 环境渐变
4. **主题色苹果蓝**：亮 `#0071e3` / 暗 `#0a84ff`；语义色用 iOS 系统色
5. **明暗双模式都必须是成品级**，默认跟随系统，手动切换持久化
6. **i18n 禁止硬编码中文**，走现有 key

---

## 3. Phase B 实际落地了什么

### 3.1 新增文件（9 个，均为未跟踪状态）

| 文件 | 作用 |
| --- | --- |
| `src/styles/apple-tokens.css` | 从 `apple-theme.css` 逐字移植的 token 层（`:root` / `html.dark` + body 基底 + 环境渐变 + 动效降级） |
| `src/styles/global-nav.css` | 全部 `.gn-*` 顶栏样式（531 行），只消费 CSS 变量 |
| `src/components/layout/GlobalNav.vue` | 顶栏本体，替代 AppSidebar + AppHeader |
| `src/components/layout/navItems.ts` | 类型化导航数据模型 + 过滤逻辑 |
| `src/components/layout/__tests__/GlobalNav.spec.ts` | **36 个测试**，替代已删除的 AppSidebar.spec.ts |
| `src/composables/useTheme.ts` | 主题唯一事实来源 |
| `src/components/charts/chartTheme.ts` | 图表主题模块（12 色 iOS 分类色板 × 明暗两档） |
| `src/components/charts/__tests__/chartTheme.spec.ts` | 图表主题切换重绘验证 |
| `src/components/common/__tests__/b3-smoke.spec.ts` | 公共组件冒烟测试（覆盖原本无 spec 的组件） |

### 3.2 删除文件（3 个）

`AppSidebar.vue`（1085 行）、`AppHeader.vue`（395 行）、`AppSidebar.spec.ts`。已用 `rg` 确认无残留引用。

### 3.3 最高杠杆的一步（务必理解，否则会做无用功）

`tailwind.config.js` 里的调色板被整体重映射：

- `primary` 全站引用 **1719 次** → 改这一处，全站换成苹果蓝
- 自定义 `dark` 引用 **2922 次**（全部在 `dark:` 变体内）→ 改成 iOS 中性表面
- 语义色覆盖为 iOS 系统色：`emerald`/`green` → `#34c759`、`red` → `#ff3b30`、`orange`/`amber` → `#ff9f0a`、`purple`/`violet` → `#af52de`、`teal` → `#30b0c7`、`blue` → `#0071e3`
- `gray`/`slate`/`zinc` **故意保留 Tailwind 默认**（gray 是亮色模式中性主力，重映射会波及上万处引用）

**推论：现有的 `primary-*` / `dark-*` / `emerald-*` 等 class 已经自动是苹果配色。不要为了换色去批量替换这些 class**——那是无意义的 churn，还会制造 review 噪音。

### 3.4 关键契约（Phase C 直接复用）

```ts
// 主题：localStorage key 固定为 `theme`，值只有 'dark' / 'light'，key 不存在 = 跟随系统
// 铁律：改这个存储契约会丢掉老用户偏好
import { useTheme } from '@/composables/useTheme'
const { isDark, toggleTheme, setTheme } = useTheme()
// 组件内禁止调用 initTheme()——那是 main.ts 专用（只挂一次 matchMedia 监听）

// 图表：canvas 无法消费 CSS 变量，故色板集中在此模块，且响应式感知主题
import { useChartTheme, withAlpha } from '@/components/charts/chartTheme'
```

防 FOUC 内联脚本已在 `frontend/index.html` 的 `<head>` 内，早于首屏渲染应用 `html.dark`。

---

## 4. Phase B 修掉的 8 个真缺陷（附成因，避免重复踩坑）

前 5 个来自子 agent 产出，**后 3 个是修复过程中自己引入的回归**——诚实记录，因为它们揭示了通用陷阱。

| # | 缺陷 | 根因 |
| --- | --- | --- |
| 1 | 浮出菜单塌成 64px 竖条 | `.gn-item` 多了 `position: relative`，成了 `left:0;right:0` 的包含块。demo 里没有这条 |
| 2 | 右侧操作簇竖向堆叠、溢出顶栏 | `.gn-actions` **全局根本没定义**，保持 `display: block` |
| 3 | 触屏无法展开浮出菜单 | hover / focus / click 争抢同一个 ref。浏览器固定顺序 `pointerenter → pointerdown → focusin → pointerup → click`，naive toggle 会自我抵消 |
| 4 | 导航出现重复项 | `/admin/channels`、`/admin/affiliates` 是纯重定向路由，与其子项同列渲染两次 |
| 5 | MonitorActionsCell 丢失进度反馈 | 行操作图标化后删掉了可见文字，只剩 50% 透明度 |
| 6 | 375/768px 横向溢出 | 我修 #2 时把 8 个操作项排成一行 |
| 7 | wordmark 被压成单个字符 "S" | 我加的 `flex-shrink: 1` 让品牌名成了 flex 唯一可压缩项 |
| 8 | 图表卡页头溢出 | 三个图表共用**不换行**的 flex 页头，标题 + 分段控件需 358px 却只有 309px |

### 4.1 从 #8 学到的通用方法（Phase C 排查溢出必读）

我为 #8 连续两次凭推测下手都失败了。**只报"哪些元素突出去了"永远找不到原因——突出去的通常是受害者，不是元凶。** 最后写了一个**祖先链诊断**才看清真正的约束盒：

```
div.mb-4.flex.items-center     w=309  sw=358  (flex row, 不换行)
  div.flex.flex-wrap           w=269  r=391  minW=auto   <== 突出
    div.segmented              w=269  r=391  ox=auto  maxW=100%
      button.transition-colors w=81   r=389  flex=0/0/auto
```

做法：把每个越界元素**向上遍历到 `<body>`**，打印每层祖先的 `getBoundingClientRect` + `display` / `overflow-x` / `flex` / `min-width` / `max-width`。工具已保留（第 5 节）。

### 4.2 新增的 6 个防回归测试

`GlobalNav.spec.ts` 里的 `flyout interaction contract` 块，按浏览器真实事件顺序回放手势，锁定：触屏点按能展开、二次点按收起、hover 后点击保持展开（而非收起）、纯 hover 移开即收、键盘聚焦展开 + Escape 收起、`aria-expanded` 正确反映状态。

---

## 5. QA 工具与证据（Phase C 直接复用）

> 两个 harness 已从临时目录迁进仓库 **`frontend/design-demo/phase-b-qa/`**，以该目录的 `README.md` 为准。
>
> **为什么不放 `frontend/scripts/`**（这是个真陷阱，见 8.12）：`.gitignore` 第 123 行是一条裸 `scripts` 规则，git 会用它匹配**任意层级**下名为 `scripts` 的目录。验证：`git ls-files frontend/scripts/ | wc -l` 返回 **0**——那里现存的 23 个 `.mjs` QA 脚本全部未被跟踪。放进去等于对下一个 agent 隐形。`design-demo/` 已验证可跟踪，且 Phase A 的 `qa-screenshot.py` 就在那里，属于既有惯例。

| 工具 | 作用 |
| --- | --- |
| `verify.py` | 验收 harness，**当前 150/150**。静态服务生产构建（SPA fallback）+ 全量 mock API + 种入 localStorage，断言：375/768px 零横向溢出、顶栏 48px、**顶栏子元素不越界**、表格 `thead th` 与首行 `td` 对齐、浮出层不透明 + 遮挡 + 纱幕、明暗正确、零 logo 图片 |
| `sweep.py` | 全路由扫描，产出 246 张截图（58/60 路由 × 明暗 × 1440/375） |
| 侦查笔记 | `/tmp/phaseb-notes/*.md`（**临时目录，很可能已丢失**）：`00-` 主题/branding/tailwind、`01-` 导航/路由全表、`02-` 组件与基线清单、`03-`/`04-` 两轮视觉 QA 报告。内容已浓缩进本文档，丢了不阻塞接手 |

截图输出默认落在临时目录，**不写进仓库**。

### 5.1 三个会浪费你几小时的陷阱

1. **driver.js 引导教程会渲染全视口遮罩，拦截所有 pointer 事件**，导航完全点不动。Playwright 会重试 58 次然后超时。必须先种入 `${storageKey}_${userId}_${role}_v4_interactive = 'true'`（`admin_guide` / `user_guide`）把它标记为已看过
2. **`networkidle` 在本应用不可用**：仪表盘有轮询，永远等不到 idle；冷启动时它又会在 Vue mount 之前就返回。必须等真实的挂载信号（`#app` 有子节点 + `.gn` 出现）
3. **`full_page=True` 截图会让 `position: sticky/fixed` 元素拖影/重影**——顶栏和纱幕的"错位"是拼接伪影，不是 bug。判断浮层/导航一律用视口截图

### 5.2 环境

- Python：`/opt/miniconda3/bin/python`（已装 playwright）
- Chromium：`~/Library/Caches/ms-playwright/chromium_headless_shell-1234/...`（可用 `CHROME_HEADLESS_SHELL` 覆盖）
- **不要启动 `backend/bin/server`**：它会连真实数据库。截图/验收一律 mock
- 后端 `:8080` 未运行时，dev server 代理会失败——所以 harness 走"静态服务 dist + 拦截所有请求"的路子

---

## 6. 交给 Phase C 的任务（按优先级）

### P0 · 必须先处理

**1. 提交 Phase B 的 178 个文件改动。** 全部在工作区未提交。建议按阶段拆成若干 commit（token 基座 / GlobalNav / 公共组件 / 各页面组 / QA 工具），而非一个巨型 commit。

**2. `frontend/pnpm-lock.yaml` 有安全回退，需要用户决策。**

这是**既有的仓库配置问题，与本次重构无关**，但会被误当成本次改动带进提交：

- 本机 pnpm 是 **11.16.0**，已不再读取 `package.json` 的 `pnpm.overrides`（每次运行都会 warn）
- 仓库**没有 `packageManager` 字段**钉住 pnpm 版本
- 结果：任何写锁文件的命令都会重写它并**丢掉 `overrides` 块**
- HEAD 有三条安全钉版：`js-cookie: 3.0.7`、`form-data@<4.0.6: '>=4.0.6'`、`postcss@<8.5.18: '>=8.5.18'`。工作区已全部消失，且 postcss 从 `>=8.5.18` 退回 `^8.4.32`（**允许降级到有漏洞的版本**）

建议提交前恢复（我没有擅自执行，因为这是破坏性操作且该文件非我创建）：

```
git checkout -- frontend/pnpm-lock.yaml
```

**根治建议**：给 `package.json` 加 `packageManager` 字段钉住 pnpm 版本，或把 `overrides` 迁到 pnpm 新配置位置。这是独立的一次改动，不要混进视觉重构。

**期间纪律**：不要跑 `pnpm install` / `pnpm add`，只用 `pnpm exec`。

### P1 · 未能验证的部分（诚实缺口）

**支付流程未对真实后端跑通。** 本机 `:8080` 未启动，我判断让截图任务连真实数据库风险过高。支付逻辑本身零改动（`git diff` 逐文件复核过：无 Stripe/Airwallex SDK 接线、轮询/恢复、订单状态机、金额格式化/舍入、货币处理的改动），21 个文件 138 个支付测试全绿。**但端到端真机支付仍需在有后端的环境复核一次。**

### P2 · 只上报、未修改的既有问题

`src/components/user/dashboard/UserDashboardStats.vue:370` 的 `formatCost` 用 `toFixed(4)`，金额显示成 `$0.0000` / `$51200.8000`，与 demo 的两位小数不一致。

**为什么没改**：它在本次 diff 之外（我们只移动了调用它的行，函数本身未动），且改精度属于**金额显示逻辑变更**，超出"视觉零功能改动"的边界。另外 4 位小数对 API 计费的亚分单位可能是**有意为之**——改成 2 位会把 `$0.0012` 显示成 `$0.00`。需要产品决策。

### P3 · 已证伪的报告（不要浪费时间追）

全路由扫描报了两条低危项，我逐一核查后**均不成立**：

1. **"全部Privacy" 中英混排标签截断**：`rg "Privacy" src/i18n/locales/zh/` 只命中 `landing.ts` 的 `privacyNote`；`AccountsView.vue` 里没有任何 privacy 筛选器标签。不可复现
2. **`ProviderCard` 的 `t(undefined)`**：源码是 `t(PROVIDER_KEY_LABELS[key] || props.provider.provider_key)`——有兜底，`t()` 永远收到字符串，绝不会是 `undefined`。最坏情况是渲染原始 key，属于降级显示而非崩溃

### P4 · Phase C 候选（来自 Phase A `HANDOFF.md` 第 6 节，尚未开工）

- **Landing 页深化**：`HomeView` 可参考 apple.com 产品页做完整营销页（大标题 + 产品截图 + 特性网格）
- **`ModelPlazaView` 卡片化重设计**
- **设置页分组列表化**（iOS 设置风格）。注意 `SettingsView.vue` 有 **12621 行**，Phase B 只做了外壳收口（净 −21 行），刻意没有重写——那是不可控的回归源
- **全局命令面板（⌘K）**：顶栏搜索入口已就位，可接入
- **空状态/插画统一**
- **邮件模板与公告弹窗视觉同步**
- **上游同步**：本仓库跟踪 upstream（`Wei-Shaw/sub2api`）。视觉重构后 merge upstream 会在 layout/样式文件上冲突。建议：功能修复 cherry-pick，样式以本分支为准

---

## 7. 接手检查清单

1. `git status` 确认 178 个改动仍在工作区；**先处理第 6 节 P0 的锁文件问题**
2. 通读 Phase A `HANDOFF.md`（尤其第 1 节锁定决策、第 4 节血泪教训）
3. 双击 `frontend/design-demo/index.html`，明暗各切一遍，悬停"资源"看浮出 + 纱幕，建立视觉基准
4. 通读 `apple-theme.css`（约 930 行，含全部契约）
5. 跑一遍闸门确认接手时是绿的：
   ```
   cd frontend && pnpm test:run        # 应为 1508/1510，仅 rollback 那 2 个红
   cd frontend && pnpm build          # 应通过
   ```
6. 跑 `frontend/design-demo/phase-b-qa/verify.py` 确认仍是 150/150（命令见该目录 `README.md`）
7. 动手前先读第 4 节的 8 个缺陷成因和第 5.1 节的 3 个陷阱——它们各自花了我实打实的时间

---

## 8. 血泪教训汇总（Phase A + Phase B 合并版）

1. **`display:flex` / `display:grid` 的类绝不能直接挂在 `<td>` / `<th>` 上**——会覆盖 `display: table-cell` 破坏表格布局（Phase A 曾致某列矮 12px、内容偏移 8px）。必须在单元格内包一层 `<div>` 再挂类
2. **浮出层半透明必然透出下层密集文字**，已定稿"不透明面板 + 纱幕压暗"
3. **`backdrop-filter` 不要嵌套依赖**：顶栏是 0.72 玻璃，其内浮出层是不透明面板，两层材质各司其职
4. **Playwright `full_page=True` 会让 sticky/fixed 元素拖影**——验证浮层用视口截图
5. **移动端菜单展开必须锁 body 滚动**，关闭时恢复
6. **主题 class 挂在 `html`**，应用时机早于首屏渲染
7. **i18n 禁止硬编码中文**
8. **顶栏高度断言 ≠ 子元素不越界**：`.gn` 算出 48px 的同时，其子元素完全可以溢出到栏外。必须**分别断言容器高度与子元素包含关系**——这正是 `.gn-actions` 缺失能通过绿色断言的原因
9. **排查溢出要走祖先链**，不要只看突出去的元素（见 4.1）
10. **对 CSS 文件跑 eslint 会报假错**：`Parsing error: Declaration or statement expected`。本仓库 eslint 未配 CSS 解析器，未改动的 `announcement-markdown.css` 也报同样的错。CSS 的真实闸门是 `pnpm exec tailwindcss` 编译与 `pnpm build`
11. **`site_name` 是管理员可配的**，长度不可预期。任何依赖它宽度的布局都要考虑截断，且**它是全站唯一品牌标识，不能让它成为 flex 的牺牲品**
12. **`.gitignore` 里的裸目录名会匹配任意层级**：第 123 行的 `scripts` 让 `frontend/scripts/` 整个不被跟踪（23 个 `.mjs` 全部未入库）。往仓库里放新工具前，先跑 `git check-ignore -v <路径>` 确认它真的能被跟踪，否则"放进仓库"只是错觉
