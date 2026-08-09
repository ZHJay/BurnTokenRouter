export default {
  batchImageGuide: {
    title: '图片批量生成',
    description: '一次提交多条提示词，任务完成后可统一下载图片结果'
  },
  // Home Page
  home: {
    viewDocs: '查看文档',
    docs: '文档',
    switchToLight: '切换到浅色模式',
    switchToDark: '切换到深色模式',
    dashboard: '控制台',
    login: '登录',
    getStarted: '立即开始',
    goToDashboard: '进入控制台',
    // Hero 区（apple.com 产品页式：品牌名 + 大号价值主张 + 双层 CTA）
    hero: {
      eyebrow: '统一 AI 网关',
      note: '注册即可获得试用额度，无需绑定信用卡',
      secondaryCta: '了解详情',
      visualCaption: '一次请求经网关调度到上游账号的示意',
      terminalComment: '正在调度上游账号…',
    },
    // 能力条：陈述平台能力，不使用未经核实的运营数据
    capabilities: {
      models: { value: '4 大', label: '模型家族', desc: 'Claude · GPT · Gemini · Antigravity' },
      protocol: { value: '原生', label: '协议兼容', desc: '沿用官方 SDK 与请求格式' },
      billing: { value: '按量', label: '实时计费', desc: 'Token 级别用量与费用明细' },
      selfHosted: { value: '自托管', label: '数据自主', desc: '部署在你自己的服务器上' },
    },
    // 控制台预览（纯 CSS 绘制的产品视觉区，非真实数据）
    preview: {
      title: '一个控制台，看清全部用量',
      subtitle: '实时请求量、费用、模型分布与密钥状态，集中在同一个视图里。',
      caption: '控制台示意图：统计卡、近 7 日用量趋势与模型明细表',
      windowTitle: '控制台',
      nav: { overview: '概览', keys: '密钥', usage: '用量' },
      stats: { requests: '今日请求', tokens: '今日 Tokens', cost: '今日费用', success: '成功率' },
      chartTitle: '近 7 日用量',
      tableTitle: '模型明细',
      tableHeaders: { model: '模型', requests: '请求', cost: '费用' },
    },
    // 三步接入
    steps: {
      stepLabel: '第 {index} 步',
      codeCaption: '把请求地址指向本平台，其余代码保持不变',
      items: {
        register: { title: '注册账号', desc: '邮箱注册即可开始，无需绑定信用卡。' },
        key: { title: '创建密钥', desc: '在控制台生成 API 密钥，按需设置额度上限与有效期。' },
        call: { title: '替换请求地址', desc: '把官方 Base URL 换成本平台地址，沿用原有 SDK 调用方式。' },
      },
    },
    // 常见问题
    faq: {
      title: '常见问题',
      subtitle: '开始之前，你可能想确认这些',
      items: {
        compat: {
          q: '需要改动现有代码吗？',
          a: '不需要重写业务逻辑。把 SDK 的 Base URL 指向本平台、把密钥换成平台签发的密钥即可，请求与返回格式沿用官方协议。',
        },
        billing: {
          q: '费用怎么计算？',
          a: '按实际消耗的 Token 计费，输入、输出与缓存分别计价。控制台可按密钥、模型与日期查看明细，也可以为每个密钥设置额度上限。',
        },
        limit: {
          q: '会触发上游限流吗？',
          a: '平台维护由多个上游账号组成的池子，触发限流或异常时自动切换到可用账号，并保持同一会话固定在同一上游，避免上下文缓存失效。',
        },
        privacy: {
          q: '请求内容会被保存吗？',
          a: '平台默认只记录调用元数据（时间、模型、Token 数与费用）用于计费与用量统计。是否保留更详细的内容，由部署方在后台自行配置。',
        },
        models: {
          q: '支持哪些模型？',
          a: '当前已接入 Claude、GPT、Gemini 与 Antigravity 系列，后续会继续扩展。实际可用模型取决于管理员在后台配置的上游账号。',
        },
      },
    },
    // 各区块小标签（eyebrow）
    sections: {
      preview: '控制台',
      painPoints: '现状',
      solutions: '快速开始',
      features: '核心能力',
      comparison: '对比',
      providers: '已接入模型',
      faq: '答疑',
    },
    // 新增：面向用户的价值主张
    heroDescription: '无需管理多个订阅账号，一站式接入 Claude、GPT、Gemini 等主流 AI 服务',
    tags: {
      subscriptionToApi: '订阅转 API',
      stickySession: '会话保持',
      realtimeBilling: '按量计费'
    },
    // 用户痛点区块
    painPoints: {
      title: '你是否也遇到这些问题？',
      items: {
        expensive: {
          title: '订阅费用高',
          desc: '每个 AI 服务都要单独订阅，每月支出越来越多'
        },
        complex: {
          title: '多账号难管理',
          desc: '不同平台的账号、密钥分散各处，管理起来很麻烦'
        },
        unstable: {
          title: '服务不稳定',
          desc: '单一账号容易触发限制，影响正常使用'
        },
        noControl: {
          title: '用量无法控制',
          desc: '不知道钱花在哪了，也无法限制团队成员的使用'
        }
      }
    },
    // 解决方案区块
    solutions: {
      title: '我们帮你解决',
      subtitle: '简单三步，开始省心使用 AI'
    },
    features: {
      unifiedGateway: '一键接入',
      unifiedGatewayDesc: '获取一个 API 密钥，即可调用所有已接入的 AI 模型，无需分别申请。',
      multiAccount: '稳定可靠',
      multiAccountDesc: '智能调度多个上游账号，自动切换和负载均衡，告别频繁报错。',
      balanceQuota: '用多少付多少',
      balanceQuotaDesc: '按实际使用量计费，支持设置配额上限，团队用量一目了然。',
      observability: '用量看得见',
      observabilityDesc: '按密钥、模型与日期查看请求数、Token 与费用明细，可导出留档。',
      session: '会话保持',
      sessionDesc: '同一会话固定到同一上游账号，上下文缓存不中断。',
      security: '密钥可控',
      securityDesc: '每个密钥独立设置额度、有效期与模型范围，随时停用不影响其他调用。'
    },
    // 优势对比
    comparison: {
      title: '为什么选择我们？',
      headers: {
        feature: '对比项',
        official: '官方订阅',
        us: '本平台'
      },
      items: {
        pricing: {
          feature: '付费方式',
          official: '固定月费，用不完也付',
          us: '按量付费，用多少付多少'
        },
        models: {
          feature: '模型选择',
          official: '单一服务商',
          us: '多模型随意切换'
        },
        management: {
          feature: '账号管理',
          official: '每个服务单独管理',
          us: '统一密钥，一站管理'
        },
        stability: {
          feature: '服务稳定性',
          official: '单账号易触发限制',
          us: '多账号池，自动切换'
        },
        control: {
          feature: '用量控制',
          official: '无法限制',
          us: '可设配额、查明细'
        }
      }
    },
    providers: {
      title: '已支持的 AI 模型',
      description: '一个 API，多种选择',
      supported: '已支持',
      soon: '即将推出',
      claude: 'Claude',
      gemini: 'Gemini',
      antigravity: 'Antigravity',
      more: '更多'
    },
    // CTA 区块
    cta: {
      title: '准备好开始了吗？',
      description: '注册即可获得免费试用额度，体验一站式 AI 服务',
      button: '免费注册',
      secondary: '先看文档'
    },
    footer: {
      allRightsReserved: '保留所有权利。'
    }
  },

  // Key Usage Query Page
  keyUsage: {
    title: 'API Key 用量查询',
    subtitle: '输入您的 API Key 以查看实时消费金额与使用状态',
    placeholder: 'sk-ant-mirror-xxxxxxxxxxxx',
    query: '查询',
    querying: '查询中...',
    showKey: '显示密钥',
    hideKey: '隐藏密钥',
    privacyNote: '您的 Key 仅在浏览器本地处理，不会被存储',
    dateRange: '统计范围:',
    dateRangeToday: '今日',
    dateRange7d: '7 天',
    dateRange30d: '30 天',
    dateRange90d: '90 天',
    dateRangeCustom: '自定义',
    apply: '应用',
    used: '已使用',
    detailInfo: '详细信息',
    tokenStats: 'Token 统计',
    dailyDetail: '按日明细',
    modelStats: '模型用量统计',
    // Table headers
    date: '日期',
    model: '模型',
    requests: '请求数',
    inputTokens: '输入 Tokens',
    outputTokens: '输出 Tokens',
    cacheCreationTokens: '缓存创建',
    cacheReadTokens: '缓存读取',
    cacheWriteTokens: '缓存写入',
    totalTokens: '总 Tokens',
    cost: '费用',
    // Status
    quotaMode: 'Key 限额模式',
    walletBalance: '钱包余额',
    // Ring card titles
    totalQuota: '总额度',
    limit5h: '5 小时限额',
    limitDaily: '日限额',
    limit7d: '7 天限额',
    limitWeekly: '周限额',
    limitMonthly: '月限额',
    // Detail rows
    remainingQuota: '剩余额度',
    expiresAt: '过期时间',
    todayExpires: '(今日到期)',
    daysLeft: '({days} 天)',
    usedQuota: '已用额度',
    resetNow: '即将重置',
    subscriptionType: '订阅类型',
    subscriptionExpires: '订阅到期',
    // Usage stat cells
    todayRequests: '今日请求',
    todayInputTokens: '今日输入',
    todayOutputTokens: '今日输出',
    todayTokens: '今日 Tokens',
    todayCacheCreation: '今日缓存创建',
    todayCacheRead: '今日缓存读取',
    todayCost: '今日费用',
    rpmTpm: 'RPM / TPM',
    totalRequests: '累计请求',
    totalInputTokens: '累计输入',
    totalOutputTokens: '累计输出',
    totalTokensLabel: '累计 Tokens',
    totalCacheCreation: '累计缓存创建',
    totalCacheRead: '累计缓存读取',
    totalCost: '累计费用',
    avgDuration: '平均耗时',
    // Messages
    enterApiKey: '请输入 API Key',
    querySuccess: '查询成功',
    queryFailed: '查询失败',
    queryFailedRetry: '查询失败，请稍后重试',
    noDailyUsage: '暂无按日用量数据',
  },

  // Setup Wizard
  setup: {
    title: 'Sub2API 安装向导',
    description: '配置您的 Sub2API 实例',
    database: {
      title: '数据库配置',
      description: '连接到您的 PostgreSQL 数据库',
      host: '主机',
      port: '端口',
      username: '用户名',
      password: '密码',
      databaseName: '数据库名称',
      sslMode: 'SSL 模式',
      passwordPlaceholder: '密码',
      ssl: {
        disable: '禁用',
        require: '要求',
        verifyCa: '验证 CA',
        verifyFull: '完全验证'
      }
    },
    redis: {
      title: 'Redis 配置',
      description: '连接到您的 Redis 服务器',
      host: '主机',
      port: '端口',
      username: '用户名（可选）',
      password: '密码（可选）',
      database: '数据库',
      usernamePlaceholder: '默认用户留空',
      passwordPlaceholder: '密码',
      enableTls: '启用 TLS',
      enableTlsHint: '连接 Redis 时使用 TLS（公共 CA 证书）'
    },
    admin: {
      title: '管理员账户',
      description: '创建您的管理员账户',
      email: '邮箱',
      password: '密码',
      confirmPassword: '确认密码',
      passwordPlaceholder: '至少 8 个字符',
      confirmPasswordPlaceholder: '确认密码',
      passwordMismatch: '密码不匹配'
    },
    ready: {
      title: '准备安装',
      description: '检查您的配置并完成安装',
      database: '数据库',
      redis: 'Redis',
      adminEmail: '管理员邮箱'
    },
    status: {
      testing: '测试中...',
      success: '连接成功',
      testConnection: '测试连接',
      installing: '安装中...',
      completeInstallation: '完成安装',
      completed: '安装完成！',
      redirecting: '正在跳转到登录页面...',
      restarting: '服务正在重启，请稍候...',
      timeout: '服务重启时间超出预期，请手动刷新页面。'
    }
  },

  // Common
}
