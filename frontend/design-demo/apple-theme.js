/* =========================================================================
   Sub2API · Apple Liquid Glass demo 基座脚本
   职责：
   1. 同步应用主题（localStorage 'demo-theme' > 系统偏好），避免闪烁
   2. 按 <body data-nav="user|admin|none"> 注入 GlobalNav（apple.com 风格）
   3. 顶栏交互：明暗切换 / 搜索展开 / 通知 / 头像下拉 / 移动端汉堡菜单
      / 浮出菜单触屏点按支持
   用法：
     <head> 内同步 <script src="apple-theme.js"></script>
     <body data-nav="admin" data-active="accounts">
   ========================================================================= */

(function () {
  'use strict';

  /* ---------- 1. 立即应用主题（同步执行，防 FOUC） ---------- */
  var stored = null;
  try { stored = localStorage.getItem('demo-theme'); } catch (e) {}
  var prefersDark = window.matchMedia &&
    window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (stored === 'dark' || (!stored && prefersDark)) {
    document.documentElement.classList.add('dark');
  }

  /* ---------- SVG 图标库（SF Symbols 风格，线性） ---------- */
  var I = {
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>',
    sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
    moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/></svg>',
    menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    chev: '<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
    user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5"/></svg>',
    cog: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5h.1a1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1a1.7 1.7 0 0 0 1.5 1h.1a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/></svg>',
    logout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/></svg>',
    card: '<svg class="fl-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18"/></svg>',
    globe: '<svg class="fl-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18Z"/></svg>',
    folder: '<svg class="fl-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/></svg>',
    server: '<svg class="fl-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="7" rx="2"/><rect x="3" y="13" width="18" height="7" rx="2"/><path d="M7 7.5h.01M7 16.5h.01"/></svg>',
    signal: '<svg class="fl-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M2 9a15 15 0 0 1 20 0"/><circle cx="12" cy="19.5" r="1" fill="currentColor"/></svg>',
    tag: '<svg class="fl-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 12 9-9h9v9l-9 9z"/><circle cx="16.5" cy="7.5" r="1.2"/></svg>',
    users: '<svg class="fl-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.2 3.2-5 6.5-5s5.9 1.8 6.5 5"/><circle cx="17" cy="9" r="2.6"/><path d="M17.8 14.4c2.2.4 3.5 1.9 3.9 4.1"/></svg>',
    chart: '<svg class="fl-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/></svg>',
    shield: '<svg class="fl-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 4 6v6c0 5 3.4 8.6 8 10 4.6-1.4 8-5 8-10V6Z"/></svg>',
    ticket: '<svg class="fl-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9V7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a3 3 0 0 0 0 6v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a3 3 0 0 0 0-6Z"/><path d="M13 5v2m0 10v2m0-8v2"/></svg>',
    gift: '<svg class="fl-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7M12 8s-1.5-5-4.5-5S4 6.5 6 8m6 0s1.5-5 4.5-5S20 6.5 18 8"/></svg>',
    bellSm: '<svg class="fl-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>',
    doc: '<svg class="fl-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M9 13h6M9 17h6"/></svg>',
    key: '<svg class="fl-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="15" r="4.5"/><path d="m11 12 9-9m-4 4 3 3"/></svg>',
    home: '<svg class="fl-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 11 9-8 9 8"/><path d="M5 10v10a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V10"/></svg>',
    wallet: '<svg class="fl-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="6" width="18" height="14" rx="3"/><path d="M3 10h18M16 15h2"/></svg>'
  };

  /* ---------- 2. 导航配置 ---------- */
  /* href 为 '#' 表示 demo 未覆盖页面；已实现的 demo 页互链 */
  var NAV = {
    user: [
      { key: 'dashboard', label: '仪表盘', href: 'user-dashboard.html' },
      { key: 'keys', label: 'API 密钥', href: '#' },
      { key: 'usage', label: '使用记录', href: '#' },
      { key: 'subscriptions', label: '我的订阅', href: '#' },
      { key: 'purchase', label: '充值/订阅', href: '#' },
      { key: 'affiliate', label: '邀请返利', href: '#' }
    ],
    admin: [
      { key: 'dashboard', label: '仪表盘', href: '#' },
      {
        key: 'resources', label: '资源', flyout: [
          { title: '资源管理', links: [
            { key: 'accounts', label: '账号管理', href: 'admin-accounts.html', icon: 'globe' },
            { key: 'groups', label: '分组管理', href: '#', icon: 'folder' },
            { key: 'channels', label: '渠道管理', href: '#', icon: 'server' },
            { key: 'proxies', label: 'IP 管理', href: '#', icon: 'shield' }
          ]},
          { title: '渠道', links: [
            { key: 'channelPricing', label: '渠道定价', href: '#', icon: 'tag' },
            { key: 'channelMonitor', label: '渠道监控', href: '#', icon: 'signal' }
          ]}
        ]
      },
      {
        key: 'operation', label: '运营', flyout: [
          { title: '用户与订单', links: [
            { key: 'users', label: '用户管理', href: '#', icon: 'users' },
            { key: 'subscriptions', label: '订阅管理', href: '#', icon: 'card' },
            { key: 'orders', label: '订单管理', href: '#', icon: 'doc' },
            { key: 'plans', label: '订阅套餐', href: '#', icon: 'wallet' }
          ]},
          { title: '营销', links: [
            { key: 'redeem', label: '兑换码', href: '#', icon: 'ticket' },
            { key: 'promo', label: '优惠码', href: '#', icon: 'gift' },
            { key: 'announcements', label: '公告', href: '#', icon: 'bellSm' },
            { key: 'affiliates', label: '邀请返利', href: '#', icon: 'users' }
          ]}
        ]
      },
      {
        key: 'analytics', label: '分析', flyout: [
          { title: '数据', links: [
            { key: 'usage', label: '使用记录', href: '#', icon: 'chart' },
            { key: 'ops', label: '运维监控', href: '#', icon: 'signal' },
            { key: 'paymentDashboard', label: '支付概览', href: '#', icon: 'wallet' }
          ]},
          { title: '安全', links: [
            { key: 'riskControl', label: '内容审核', href: '#', icon: 'shield' },
            { key: 'promptAudit', label: '提示词审计', href: '#', icon: 'doc' },
            { key: 'auditLogs', label: '操作日志', href: '#', icon: 'doc' }
          ]}
        ]
      },
      { key: 'settings', label: '系统设置', href: '#' }
    ]
  };

  /* ---------- 3. 工具 ---------- */
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function buildLinks(items, activeKey) {
    return items.map(function (item) {
      if (item.flyout) {
        var cols = item.flyout.map(function (col) {
          var links = col.links.map(function (l) {
            return '<a href="' + esc(l.href) + '">' + (I[l.icon] || I.doc) +
              esc(l.label) + '</a>';
          }).join('');
          return '<div class="gn-flyout-col"><h4>' + esc(col.title) + '</h4>' + links + '</div>';
        }).join('');
        var containsActive = item.flyout.some(function (col) {
          return col.links.some(function (l) { return l.key === activeKey; });
        });
        return '<div class="gn-item" data-flyout>' +
          '<a class="gn-link' + (containsActive ? ' active' : '') + '" href="#" data-key="' + esc(item.key) + '">' +
          esc(item.label) + I.chev + '</a>' +
          '<div class="gn-flyout"><div class="gn-flyout-inner">' + cols + '</div></div>' +
          '</div>';
      }
      return '<div class="gn-item">' +
        '<a class="gn-link' + (item.key === activeKey ? ' active' : '') + '" href="' + esc(item.href) + '" data-key="' + esc(item.key) + '">' +
        esc(item.label) + '</a></div>';
    }).join('');
  }

  function buildMobileLinks(items, activeKey) {
    return items.map(function (item) {
      if (item.flyout) {
        var links = item.flyout.map(function (col) {
          return col.links.map(function (l) {
            return '<a href="' + esc(l.href) + '"' + (l.key === activeKey ? ' style="color:var(--blue)"' : '') + '>' + esc(l.label) + '</a>';
          }).join('');
        }).join('');
        return '<details><summary>' + esc(item.label) + I.chev + '</summary>' + links + '</details>';
      }
      return '<a class="gn-m-link" href="' + esc(item.href) + '"' +
        (item.key === activeKey ? ' style="color:var(--blue)"' : '') + '>' + esc(item.label) + '</a>';
    }).join('');
  }

  /* ---------- 4. DOMContentLoaded 后注入导航 ---------- */
  document.addEventListener('DOMContentLoaded', function () {
    var body = document.body;
    var navType = body.getAttribute('data-nav') || 'none';
    var activeKey = body.getAttribute('data-active') || '';
    if (navType === 'none') return;

    var items = NAV[navType] || [];
    var isAdmin = navType === 'admin';

    body.insertAdjacentHTML('afterbegin',
      '<nav class="gn' + (items.length ? '' : ' gn-bare') + '" aria-label="全局导航">' +
        '<div class="gn-inner">' +
          '<button class="gn-icon-btn gn-burger" aria-label="菜单">' + I.menu + '</button>' +
          '<a class="gn-wordmark" href="index.html">Sub2API</a>' +
          '<div class="gn-links">' + buildLinks(items, activeKey) + '</div>' +
          '<div class="gn-actions">' +
            '<button class="gn-icon-btn" data-act="search" aria-label="搜索">' + I.search + '</button>' +
            '<div class="gn-pop-wrap" data-pop="bell">' +
              '<button class="gn-icon-btn" aria-label="通知">' + I.bell + '<span class="badge-dot"></span></button>' +
              '<div class="gn-pop">' +
                '<div class="gn-pop-title">通知</div>' +
                '<a class="gn-pop-item" href="#">' + I.bellSm.replace('fl-ico', '') + '<span><span class="strong">系统维护通知</span><br><span class="muted" style="font-size:12px">本周日 02:00-04:00 例行维护</span></span></a>' +
                '<a class="gn-pop-item" href="#">' + I.gift.replace('fl-ico', '') + '<span><span class="strong">新模型上线</span><br><span class="muted" style="font-size:12px">GPT-5.6 已可用</span></span></a>' +
              '</div>' +
            '</div>' +
            '<button class="gn-icon-btn" data-act="theme" aria-label="切换主题">' + I.sun + '</button>' +
            '<div class="gn-pop-wrap" data-pop="avatar">' +
              '<button class="gn-avatar" aria-label="账户">' + (isAdmin ? 'A' : '8') + '</button>' +
              '<div class="gn-pop">' +
                '<div class="gn-pop-title">' + (isAdmin ? 'admin@sub2api.dev' : 'user@sub2api.dev') + '</div>' +
                '<a class="gn-pop-item" href="#">' + I.user + '个人资料</a>' +
                '<a class="gn-pop-item" href="#">' + I.cog + '偏好设置</a>' +
                (isAdmin ? '<a class="gn-pop-item" href="user-dashboard.html">' + I.home + '切换到用户视图</a>'
                         : '<a class="gn-pop-item" href="admin-accounts.html">' + I.shield.replace('fl-ico', '') + '切换到管理视图</a>') +
                '<div class="gn-pop-sep"></div>' +
                '<a class="gn-pop-item danger" href="login.html">' + I.logout + '退出登录</a>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="gn-search-bar">' +
          '<div class="gn-search-inner">' +
            '<div class="search" style="min-width:0;width:100%;height:44px">' + I.search +
              '<input type="search" placeholder="搜索页面、功能、文档…" aria-label="搜索">' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</nav>' +
      '<div class="gn-curtain" aria-hidden="true"></div>' +
      '<div class="gn-mobile">' + buildMobileLinks(items, activeKey) + '</div>'
    );

    wire(body.querySelector('.gn'));
  });

  /* ---------- 5. 交互 ---------- */
  function wire(root) {
    var doc = document;

    /* 明暗切换 */
    var themeBtn = root.querySelector('[data-act="theme"]');
    function syncThemeIcon() {
      themeBtn.innerHTML = doc.documentElement.classList.contains('dark') ? I.sun : I.moon;
    }
    syncThemeIcon();
    themeBtn.addEventListener('click', function () {
      var dark = doc.documentElement.classList.toggle('dark');
      try { localStorage.setItem('demo-theme', dark ? 'dark' : 'light'); } catch (e) {}
      syncThemeIcon();
    });

    /* 搜索展开 */
    var searchBar = root.querySelector('.gn-search-bar');
    root.querySelector('[data-act="search"]').addEventListener('click', function () {
      var open = searchBar.classList.toggle('open');
      if (open) {
        var input = searchBar.querySelector('input');
        setTimeout(function () { input.focus(); }, 120);
      }
    });

    /* 下拉卡片（通知 / 头像） */
    var wraps = root.querySelectorAll('.gn-pop-wrap');
    wraps.forEach(function (w) {
      w.querySelector('button').addEventListener('click', function (e) {
        e.stopPropagation();
        var wasOpen = w.classList.contains('open');
        closeAllPops();
        if (!wasOpen) w.classList.add('open');
      });
    });
    function closeAllPops() {
      wraps.forEach(function (w) { w.classList.remove('open'); });
    }
    doc.addEventListener('click', function (e) {
      if (!e.target.closest('.gn-pop-wrap')) closeAllPops();
      if (!e.target.closest('.gn-search-bar') && !e.target.closest('[data-act="search"]')) {
        searchBar.classList.remove('open');
      }
    });
    doc.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        closeAllPops();
        searchBar.classList.remove('open');
        closeMobile();
      }
    });

    /* 浮出菜单：触屏点按支持（桌面端已由 CSS :hover 覆盖） */
    root.querySelectorAll('.gn-item[data-flyout] > .gn-link').forEach(function (link) {
      link.addEventListener('click', function (e) {
        e.preventDefault();
        var item = link.parentElement;
        var wasOpen = item.classList.contains('open');
        root.querySelectorAll('.gn-item.open').forEach(function (i) { i.classList.remove('open'); });
        if (!wasOpen) item.classList.add('open');
      });
    });
    root.querySelectorAll('.gn-item[data-flyout]').forEach(function (item) {
      item.addEventListener('mouseleave', function () { item.classList.remove('open'); });
    });

    /* 移动端汉堡菜单 */
    var burger = root.querySelector('.gn-burger');
    var mobile = doc.querySelector('.gn-mobile');
    function closeMobile() {
      if (mobile) mobile.classList.remove('open');
      burger.innerHTML = I.menu;
      doc.body.style.overflow = '';
    }
    burger.addEventListener('click', function () {
      var open = mobile.classList.toggle('open');
      burger.innerHTML = open ? I.close : I.menu;
      doc.body.style.overflow = open ? 'hidden' : '';
    });
    if (mobile) {
      mobile.querySelectorAll('a').forEach(function (a) {
        a.addEventListener('click', closeMobile);
      });
    }
  }
})();
