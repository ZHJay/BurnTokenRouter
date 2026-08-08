# Sub2API 前端视觉重构 · 交接文档（Handoff）

> 面向下一个执行 agent。读本文档 + apple-theme.css 头部注释 + 各 demo 页源码，即可无需提问直接开工 Phase B。
> 最后更新：2026-08-08 · 分支 codex/apple-liquid-glass-v3

---

## 0. 背景与当前状态

Sub2API（本仓库，fork 自 Wei-Shaw/sub2api，remote 名 `upstream`）前端是 Vue 3 + Tailwind CSS 3 的管理面板，正在做彻底视觉重构：功能逻辑零改动，视觉全部替换为「Apple 设计 + iOS Liquid Glass」风格。

工作分两阶段：

- Phase A（已完成）：产出静态 HTML 设计 demo，用户已审批通过视觉方向，并修复了两轮反馈问题
- Phase B（待执行）：把定稿的设计系统推广到 Vue 工程全部页面

分支：codex/apple-liquid-glass-v3（基于 main，刻意忽略两个旧尝试分支 codex/apple-liquid-glass-redesign / codex/apple-liquid-glass-v2，不要参考它们的代码）

Phase A 提交记录：

| Commit | 内容 |
| --- | --- |
| 110e8df12 | 设计系统基座 + 3 个 demo 页 + index 入口 |
| b8cc649de | 修复浮出菜单可读性（第一轮）+ 账号页"今日"列错位 + 移动端滚动锁定 |
| 50c5e1c41 | 浮出层改不透明面板 + 新增纱幕压暗（apple.com curtain） |

---

## 1. Phase A 已锁定决策（用户逐条确认，不要擅自更改）

1. 导航：彻底去掉侧边栏。采用 apple.com globalnav 模式——48px 磨砂顶栏、导航链接居中、分组项悬停展开全宽浮出菜单、移动端汉堡全屏菜单
2. 无 logo：全站不出现任何 logo 图片。品牌 = 纯文字 wordmark（demo 中为 "Sub2API"，生产用站点名文本）。站点 logo 设置项在后端保留，前端仅可用于 favicon，不渲染在导航/页面里
3. 主题色苹果蓝：亮 #0071e3 / 暗 #0a84ff；语义色用 iOS 系统色（绿 #34c759 / 橙 #ff9f0a / 红 #ff3b30 / 紫 #af52de / 青 #30b0c7）
4. 明暗双模式：都必须是成品级。默认跟随系统，手动切换持久化
5. 浮出层不透明 + 纱幕：浮出菜单/下拉卡片/搜索条为不透明面板（用户明确拒绝半透明透出下层文字）；浮出菜单展开时页面用纱幕压暗（亮 18% / 暗 45% 黑）
6. 玻璃质感保留位置：顶栏（0.72 透明 + saturate(180%) blur(20px)）、登录页玻璃卡、ambient 环境渐变
7. 动效：统一 iOS 弹簧曲线 cubic-bezier(0.32, 0.72, 0, 1)；按钮 :active 缩放 0.97；卡片 hover 上浮 2px；尊重 prefers-reduced-motion
8. 语言：UI 中文。i18n 已有 zh/en 两套 locale，Phase B 不得硬编码中文，用 t('nav.*') 等现有 key

---

## 2. Phase A 交付物（demo 源文件清单）

全部在 frontend/design-demo/，双击 index.html 即可离线浏览（相对路径引入 CSS/JS，无构建依赖）。

| 文件 | 作用 | 备注 |
| --- | --- | --- |
| apple-theme.css | 设计系统基座：全部设计 token（亮/暗双套 CSS 变量）+ 20 余种组件类 + 响应式规则，头部注释含使用规范 | Phase B 的单一事实来源 |
| apple-theme.js | 基座脚本：主题应用（防 FOUC）、GlobalNav 注入、顶栏交互（搜索/通知/头像/主题切换）、浮出菜单触屏支持、移动端汉堡菜单 + 滚动锁定 | demo 专用；Phase B 用 Vue 组件重写同等交互 |
| index.html | demo 入口 + 组件画廊 + token 色板 | 评审用 |
| login.html | 登录页 demo（data-nav="none"）：居中玻璃卡 + 漂移光斑背景 + 第三方登录（Google/GitHub/LinuxDO/微信/钉钉） | 认证场景基准 |
| user-dashboard.html | 用户仪表盘 demo（data-nav="user"）：统计卡 + 纯 CSS 柱状图 + 密钥表格 + 订阅卡 | 数据可视化场景基准 |
| admin-accounts.html | 管理端·账号管理 demo（data-nav="admin"）：分组浮出导航 + 筛选工具条 + 批量操作条 + 复杂表格 + 分页 | 最重表格场景基准 |
| qa-screenshot.py | Playwright 截图 QA 脚本（见第 5 节） | 需本机 playwright + chromium |
| HANDOFF.md | 本文档 | |

历史参考（只读，勿恢复进仓库）：上一版静态设计稿在 git 历史，查看命令 git show 023d68573:frontend/design-demo/accounts.html；kiro.rs 的苹果风 admin-ui 在 /Users/zhanghjay/Desktop/kiro.rs/admin-ui（React + Tailwind v4，其 src/index.css 的 token 组织方式可参考）。

### 2.1 设计 token 契约（apple-theme.css 的 :root / html.dark）

- 品牌蓝：--blue / --blue-hover / --blue-ios / --blue-soft（亮 #0071e3，暗 #0a84ff）
- 语义色：--green --orange --red --purple --teal --gray-dot
- 底色：--bg / --bg-elevated（亮 #f5f5f7 / #ffffff；暗 #000000 / #1c1c1e）
- 文字：--text-primary / --text-secondary / --text-tertiary 三档
- 分隔：--separator / --separator-strong（0.5px 发丝线）
- 填充：--fill / --fill-hover（iOS 系统填充灰，搜索框、分段控件底色）
- 材质：--glass-bg（0.72 透明，顶栏用）/ --glass-bg-strong（不透明，浮出层/下拉卡/搜索条用）
- 模糊：--glass-blur = saturate(180%) blur(20px)；高光：--glass-highlight（inset 顶部高光）
- 圆角：--r-sm 8 / --r-md 12 / --r-lg 18 / --r-xl 24 / --r-pill 980
- 阴影：--shadow-card / --shadow-pop / --shadow-blue
- 动效：--ease = cubic-bezier(0.32,0.72,0,1)，--dur = 0.4s；顶栏高 --gn-height = 48px

铁律：组件一律消费 CSS 变量，禁止硬编码颜色，否则暗色模式必坏。

### 2.2 组件类清单（Phase B 移植为 Vue 组件或全局类）

- 导航：.gn .gn-inner .gn-wordmark .gn-links .gn-item[data-flyout] .gn-link(.active) .gn-flyout .gn-flyout-inner .gn-flyout-col .gn-curtain .gn-search-bar .gn-pop-wrap .gn-pop .gn-mobile .gn-burger
- 按钮：.btn .btn-primary .btn-secondary .btn-ghost .btn-danger .btn-sm .btn-block .icon-btn
- 表单：.field .input .search .segmented .checkbox
- 卡片：.card .card-hover .glass-card .stat-row .stat-card .stat-icon + .tint-blue/green/orange/purple/teal/red
- 表格：.table-card .table-scroll .bulk-bar thead th.sortable .pagination .pager
- 状态：.badge（.b-openai/.b-claude/.b-gemini/.b-grok/.b-blue/.b-green/.b-orange/.b-red/.b-purple）、.status + .dot（.dot-active/.dot-cooldown/.dot-error/.dot-limited/.dot-paused）、.switch(.on)、.meter（.fill.warn/.fill.high）、.gpill
- 工具：.mono .muted .strong .row-actions .bars .bar(.dim) .empty .hr .fade-up(-1/-2/-3)
- 骨架：.page .page-head .page-title .page-sub .toolbar（.grow）.filter-chip(.on)

### 2.3 GlobalNav 注入协议（demo JS 契约，Phase B 转为 Vue 配置）

- 挂载约定：body data-nav="user|admin|bare|none" + data-active="key"
- 用户端导航：仪表盘 / API 密钥 / 使用记录 / 我的订阅 / 充值·订阅 / 邀请返利
- 管理端导航：仪表盘｜资源▾（账号管理·分组管理·渠道管理·IP管理｜渠道定价·渠道监控）｜运营▾（用户管理·订阅管理·订单管理·订阅套餐｜兑换码·优惠码·公告·邀请返利）｜分析▾（使用记录·运维监控·支付概览｜内容审核·提示词审计·操作日志）｜系统设置
- 顶栏右侧：搜索（展开全宽搜索条）→ 通知（红点 + 下拉卡）→ 主题切换（太阳/月亮）→ 头像（下拉：个人资料/偏好设置/切换视图/退出登录）
- 主题持久化：demo 用 localStorage["demo-theme"]；Phase B 必须改接到应用现有的主题存储（先找到现有实现再替换，保持老用户偏好不丢）
- 激活态：.gn-link.active = 加粗 + 下方 4px 蓝点；含当前页的浮出分组父项同样高亮

---

## 3. Phase B 任务（把设计系统推广到 Vue 全站）

总原则：功能零改动。所有 API 调用、store、router、表单校验、交互逻辑保持原样；只换模板结构与样式。每个批次完成后 pnpm test（Vitest）与 pnpm build 必须通过。

### 3.1 现状地图（动手前先读这些文件）

| 位置 | 内容 |
| --- | --- |
| frontend/src/components/layout/AppSidebar.vue | 现有侧边栏。导航项数据源在此（约 L680-833），含 featureFlag（功能开关，如 flagPayment/flagAffiliate/flagOpsMonitoring）与 hideInSimpleMode（简洁模式过滤）——新导航必须完整保留这套过滤逻辑，见 applyFeatureFlags 与 utils/featureFlags.ts |
| frontend/src/components/layout/AppHeader.vue | 现有顶栏：公告铃、文档链接、语言切换、余额、用户下拉——功能位迁移到新 GlobalNav 右侧 |
| frontend/src/components/layout/AppLayout.vue / AuthLayout.vue / TablePageLayout.vue | 布局壳。AppLayout 被各 view 直接引用（非 router 嵌套） |
| frontend/src/components/common/ | 公共组件库：DataTable、StatCard、StatusBadge、Toggle、Pagination、SearchInput、Select、Input、TextArea、BaseDialog、ConfirmDialog、EmptyState、Skeleton、Toast、DateRangePicker 等。优先改这些组件的样式，收益最大化 |
| frontend/src/style.css + tailwind.config.js | 现有全局样式与主题（teal #14b8a6，需换成苹果蓝；darkMode: 'class' 机制与 demo 一致，都是 html.dark） |
| frontend/src/i18n/locales/zh 和 en/ | 文案 key 已存在（nav.* 等），禁止硬编码 |
| frontend/src/utils/branding.ts | updateFavicon——logo 仅保留此用途 |

### 3.2 任务拆解（建议按序执行，可 subagent 并行）

B0 · 探查补全（不改代码）：定位现有暗色模式切换的实现位置（grep classList / dark 相关的 store 或 composable，如 stores/app.ts），确认主题持久化 key 与初始化时机；定位 siteName / siteLogo 的来源 store。产出一段确认注释即可。

B1 · Token 与基座：把 2.1 节 token 移植为 src/styles/apple-tokens.css（亮/暗 CSS 变量）+ 重写 tailwind.config.js 主题色（primary → 苹果蓝系；删除 teal glow 等旧 token）+ 精简 style.css（保留 scrollbar/selection，按钮卡片等基础类替换为 demo 版本）。验收：全站不再出现 teal（#14b8a6 / #0d9488）。

B2 · GlobalNav 组件（核心，单独一个 agent）：新建 components/layout/GlobalNav.vue（+ navItems.ts）替换 AppSidebar + AppHeader：

- 导航数据从 AppSidebar 的 items 迁移，逐条保留 featureFlag / hideInSimpleMode / 自定义菜单项（custom/${cm.id}）逻辑；i18n 用现有 nav.* key
- 实现：桌面浮出菜单（hover/focus/点击三态）+ 纱幕 + 移动端汉堡全屏菜单（手风琴分组、展开锁 body 滚动）+ 搜索条 + 公告铃（复用现有 AnnouncementBell）+ 文档链接 + 语言切换（复用 LocaleSwitcher）+ 余额 + 头像下拉 + 主题切换
- 从 AppLayout 移除侧边栏与 logo 渲染；wordmark = siteName 纯文本
- 更新受影响测试：components/layout/__tests__/AppSidebar.spec.ts（重写为 GlobalNav 行为测试）、siteLogoSanitization.spec.ts（logo 清理逻辑若仍服务 favicon 则保留调整）、docUrlSanitization.spec.ts、__tests__/integration/navigation.spec.ts

B3 · 公共组件换肤（可并行）：按 demo 组件类重写 components/common/ 的视觉（结构/props 不动）：StatCard（.stat-card）、StatusBadge（.dot 体系）、Toggle（iOS .switch）、Pagination（.pager）、SearchInput（.search pill）、Input/Select/TextArea（.input 44px 高 + focus 蓝环）、BaseDialog（玻璃卡但不透明）、EmptyState、Skeleton、DataTable（.table-card 容器 + 发丝线 + hover 行底色）。注意第 4.1 条的 td 规则。

B4 · 页面重构（按组并行 subagent，每组完成后截图 QA）：

1. 认证组：views/auth/ 下 LoginView、RegisterView、ForgotPasswordView、ResetPasswordView、EmailVerifyView + 各 OAuth 回调页（loading 态即可）——对标 login.html
2. 用户组：views/user/ 下 DashboardView、KeysView、UsageView、SubscriptionsView、RedeemView、ProfileView、AffiliateView、AvailableChannelsView、ChannelStatusView、UserOrdersView、PaymentView 等——对标 user-dashboard.html
3. 管理组：views/admin/ 下 AccountsView（对标 admin-accounts.html）、DashboardView、GroupsView、ChannelsView、UsersView、SubscriptionsView、UsageView、ProxiesView、RedeemView、PromoCodesView、AnnouncementsView、RiskControlView、SettingsView、AuditLogView、BackupView、ChannelMonitorView、ops/*、orders/*、affiliates/*
4. 杂项组：HomeView（landing）、ModelPlazaView、setup/SetupWizardView、public/LegalDocumentView、NotFoundView

B5 · 收尾：全局搜索 teal/旧 token 残留；pnpm test 全绿；pnpm build 通过；逐页 Playwright 截图（明/暗 × 桌面/移动）人工复核。

### 3.3 Phase B 验收标准

- 无 logo 图片渲染（favicon 除外）；wordmark 为站点名纯文本
- 主色全部替换为苹果蓝，无 teal 残留
- 顶栏导航 + 浮出菜单 + 纱幕 + 移动端汉堡在所有页面生效；featureFlag / hideInSimpleMode 行为与原侧边栏一致（管理端/普通用户/简洁模式三种角色分别验证）
- 明暗模式均为成品级；主题偏好持久化且不丢老用户设置
- 全部既有功能可用（表单、批量操作、弹窗、图表、支付流程抽查）
- pnpm test 与 pnpm build 通过；布局相关测试已重写
- 375px 移动视口无横向溢出（表格走 .table-scroll 横滚）

---

## 4. 血泪教训（Phase A 修过的坑，Phase B 别再踩）

1. display:flex/grid 的类禁止直接挂在 td/th 上——会覆盖 display: table-cell 破坏表格布局（账号页"今日"列曾因此矮 12px、内容偏移 8px）。必须在单元格内包一层 div 再挂类。apple-theme.css 头部有同样注释
2. 浮出层半透明必然透出下层密集文字，不透明度调多高都不够——已定稿为「不透明面板 + 纱幕压暗」，不要在浮出层上回归半透明
3. backdrop-filter 不要嵌套依赖：顶栏（0.72 玻璃）内的浮出层是不透明面板，两层材质各司其职
4. Playwright full_page=True 截图中 position:sticky/fixed 元素会错位/重影（纱幕、顶栏残影是拼接伪影）——验证浮层问题用 full_page=False 视口截图 + elementFromPoint 断言，别被伪影误导
5. 移动端菜单展开要锁 body 滚动（document.body.style.overflow='hidden'），关闭时恢复
6. 主题 class 挂在 html 元素（html.dark），应用时机要早于首屏渲染（防 FOUC）；demo 的做法是 head 内同步脚本，Vue 工程可在 index.html 内联一段小脚本

---

## 5. QA 工具

截图命令（light/dark × 桌面/移动 × 浮出/汉堡态，输出到 /tmp/demo-shots）：

    /opt/miniconda3/bin/python frontend/design-demo/qa-screenshot.py index login user-dashboard admin-accounts

- 依赖：本机 miniconda 的 python + playwright 包；chromium 在 ~/Library/Caches/ms-playwright/（路径在脚本顶部 SHELL 变量；版本目录若失效，先 playwright install chromium 再更新路径，或用 CHROME_HEADLESS_SHELL 环境变量覆盖）
- 表格对齐校验：用 page.evaluate 对比 thead th 与首行 td 的 getBoundingClientRect() 的 x/width（Phase A 曾用此法像素级验证 10 列对齐 + 行内等高）
- 查看截图：agent 用 view_image 工具逐张检查

---

## 6. 未来任务（Phase C 及以后，不在当前承诺范围）

- Phase B 评审迭代：用户审批 B 阶段截图后可能有个性化调整
- Landing 页深化：HomeView 目前是产品首页，可参考 apple.com 产品页做完整营销页（大标题 + 产品截图 + 特性网格）
- Phase C 候选：ModelPlazaView 卡片化重设计；设置页分组列表化（iOS 设置风格）；全局命令面板（⌘K，顶栏搜索入口接入）；空状态/插画统一；邮件模板与公告弹窗视觉同步
- 上游同步：本仓库跟踪 upstream（Wei-Shaw/sub2api）。视觉重构后 merge upstream 会在 layout/样式文件上产生冲突，同步时需人工取舍（建议：功能修复 cherry-pick，样式以本分支为准）
- 文档同步：frontend/src/components/layout/ 下的 EXAMPLES.md、INTEGRATION.md、README.md 随新布局组件更新

---

## 7. 快速上手检查清单（下一个 agent 的第一步）

1. git checkout codex/apple-liquid-glass-v3，确认 HEAD 含第 0 节列出的 commit + 本文件
2. 双击 frontend/design-demo/index.html 过一遍三个 demo（明/暗都切一下，悬停"资源"看浮出 + 纱幕）
3. 通读 apple-theme.css（约 900 行，含全部契约）
4. 读 3.1 节现状地图列的文件，重点 AppSidebar.vue 的导航过滤逻辑
5. 从 B0 开始。祝顺利
