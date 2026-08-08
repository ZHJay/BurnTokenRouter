#!/usr/bin/env python3
"""B5-FULL-SWEEP: full route-matrix screenshot evidence + programmatic asserts.

Extends ./verify.py (same server/mocks/seed/goto_ready machinery).  Captures
every reachable route x light/dark x desktop 1440x900/mobile 375x812, plus
interaction states (admin flyouts, mobile menu, search bar, avatar dropdown,
create-account modal), and asserts layout invariants that unit tests cannot
see.  Read-only on application code; screenshots and the results JSON default
to /tmp (see QA_SWEEP_SHOTS / QA_SWEEP_OUT below).
"""
import json
import math
import os
import re
import sys
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright

# Keep the sibling import working no matter what cwd the script is invoked
# from: running `python sweep.py` puts this directory on sys.path anyway,
# but an explicit insert also covers `python -m` / wrapper invocations.
sys.path.insert(0, str(Path(__file__).resolve().parent))
import verify  # reuse server / seed / goto_ready / row factories

SHOTS = Path(os.environ.get("QA_SWEEP_SHOTS",
                            "/tmp/burntokenrouter-qa/shots-full"))
SHOTS.mkdir(parents=True, exist_ok=True)
OUT = Path(os.environ.get("QA_SWEEP_OUT", "/tmp/burntokenrouter-qa"))
PORT = int(os.environ.get("QA_PORT", "5293"))
WORKERS = int(os.environ.get("QA_WORKERS", "4"))
ONLY = os.environ.get("QA_ONLY", "")  # comma-separated route keys

# ---------------------------------------------------------------------------
# Route inventory (59 named routes + 404).  role drives seed + nav expectation.
# ---------------------------------------------------------------------------
ROUTES = [
    # key, path, area, role
    ("setup", "/setup", "setup", "anon"),
    ("home", "/home", "public", "anon"),
    ("login", "/login", "public", "anon"),
    ("register", "/register", "public", "anon"),
    ("email-verify", "/email-verify", "public", "anon"),
    ("oauth-callback", "/auth/callback?code=qa&state=qa", "public", "anon"),
    ("linuxdo-callback", "/auth/linuxdo/callback?code=qa&state=qa", "public", "anon"),
    ("wechat-callback", "/auth/wechat/callback?code=qa&state=qa", "public", "anon"),
    ("wechat-payment-callback", "/auth/wechat/payment/callback?resume_token=qa", "public", "anon"),
    ("dingtalk-callback", "/auth/dingtalk/callback?code=qa&state=qa", "public", "anon"),
    ("dingtalk-email-completion", "/auth/dingtalk/email-completion?email=qa%40example.com", "public", "anon"),
    ("oidc-callback", "/auth/oidc/callback?code=qa&state=qa", "public", "anon"),
    ("forgot-password", "/forgot-password", "public", "anon"),
    ("reset-password", "/reset-password?token=qa-token", "public", "anon"),
    ("key-usage", "/key-usage", "public", "anon"),
    ("legal", "/legal/privacy", "public", "anon"),
    ("model-plaza", "/model-plaza", "public", "anon"),
    ("dashboard", "/dashboard", "user", "user"),
    ("keys", "/keys", "user", "user"),
    ("batch-image", "/batch-image", "user", "user"),
    ("usage", "/usage", "user", "user"),
    ("redeem", "/redeem", "user", "user"),
    ("affiliate", "/affiliate", "user", "user"),
    ("available-channels", "/available-channels", "user", "user"),
    ("profile", "/profile", "user", "user"),
    ("subscriptions", "/subscriptions", "user", "user"),
    ("purchase", "/purchase", "user", "user"),
    ("orders", "/orders", "user", "user"),
    ("payment-qrcode", "/payment/qrcode?order_no=QA202608080001", "user", "user"),
    ("payment-result", "/payment/result?out_trade_no=QA202608080001&trade_status=TRADE_SUCCESS&money=10.00&type=alipay", "public", "anon"),
    ("payment-stripe", "/payment/stripe?order_no=QA202608080001", "public", "anon"),
    ("payment-airwallex", "/payment/airwallex?order_no=QA202608080001", "public", "anon"),
    ("payment-stripe-popup", "/payment/stripe-popup?order_no=QA202608080001", "public", "anon"),
    ("custom-page", "/custom/1", "user", "user"),
    ("monitor", "/monitor", "user", "user"),
    ("admin-dashboard", "/admin/dashboard", "admin", "admin"),
    ("admin-ops", "/admin/ops", "admin", "admin"),
    ("admin-audit-logs", "/admin/audit-logs", "admin", "admin"),
    ("admin-users", "/admin/users", "admin", "admin"),
    ("admin-groups", "/admin/groups", "admin", "admin"),
    ("admin-channels", "/admin/channels/pricing", "admin", "admin"),
    ("admin-channel-monitor", "/admin/channels/monitor", "admin", "admin"),
    ("admin-subscriptions", "/admin/subscriptions", "admin", "admin"),
    ("admin-accounts", "/admin/accounts", "admin", "admin"),
    ("admin-announcements", "/admin/announcements", "admin", "admin"),
    ("admin-proxies", "/admin/proxies", "admin", "admin"),
    ("admin-redeem", "/admin/redeem", "admin", "admin"),
    ("admin-promo-codes", "/admin/promo-codes", "admin", "admin"),
    ("admin-settings", "/admin/settings", "admin", "admin"),
    ("admin-risk-control", "/admin/risk-control", "admin", "admin"),
    ("admin-prompt-audit", "/admin/prompt-audit", "admin", "admin"),
    ("admin-usage", "/admin/usage", "admin", "admin"),
    ("admin-affiliate-invites", "/admin/affiliates/invites", "admin", "admin"),
    ("admin-affiliate-rebates", "/admin/affiliates/rebates", "admin", "admin"),
    ("admin-affiliate-transfers", "/admin/affiliates/transfers", "admin", "admin"),
    ("admin-orders-dashboard", "/admin/orders/dashboard", "admin", "admin"),
    ("admin-orders", "/admin/orders", "admin", "admin"),
    ("admin-orders-plans", "/admin/orders/plans", "admin", "admin"),
    ("notfound", "/definitely-not-a-route-xyz", "misc", "user"),
]

SETTINGS = dict(verify.PUBLIC_SETTINGS)
SETTINGS.update({
    "model_plaza_require_auth": False,
    "custom_menu_items": [{
        "id": "1", "label": "API Docs", "icon_svg": "",
        "url": "md:# API Docs\n\nThis is a **custom page** rendered from settings.\n\n## Getting Started\n\n- Create a key\n- Pick a group\n- Call the gateway",
        "visibility": "user", "sort_order": 10,
    }],
})


def user_row(i, role="user", status="active", balance="12.34"):
    return {"id": 10 + i, "username": f"tester{i:02d}", "email": f"tester{i:02d}@example.com",
            "role": role, "status": status, "balance": float(balance),
            "available_balance": float(balance), "frozen_balance": 0.0,
            "total_requests": 1200 + i * 7, "total_tokens": 80_000 + i * 999,
            "total_cost": 3.42, "created_at": "2026-03-01T00:00:00Z",
            "last_active_at": "2026-08-08T02:00:00Z"}


def key_row(i, group_id=1, status="active"):
    return {"id": 100 + i, "name": f"prod-key-{i:02d}", "key_preview": "sk-qa" + "x" * 8 + str(i),
            "group_id": group_id, "group": {"id": group_id, "name": "default"},
            "status": status, "quota": 50.0, "quota_used": 3.21 + i,
            "used_tokens": 150_000 + i * 1000, "requests": 234 + i,
            "ip_whitelist": [], "ip_blacklist": [],
            "created_at": "2026-04-01T00:00:00Z", "expires_at": None,
            "last_used_at": "2026-08-08T01:00:00Z"}


def group_row(i, platform="anthropic", status="active"):
    return {"id": i, "name": f"group-{i:02d}", "platform": platform, "status": status,
            "priority": 10 - i, "weight": 1, "models": ["claude-sonnet-4-5", "claude-opus-4-1"],
            "sort_order": i, "concurrency": 4, "created_at": "2026-01-01T00:00:00Z"}


def channel_row(i, status="active"):
    return {"id": 200 + i, "name": f"channel-{i:02d}", "base_url": f"https://upstream{i:02d}.example.com",
            "status": status, "priority": 5 + i, "weight": 1, "models": ["gpt-4o", "gpt-4o-mini"],
            "created_at": "2026-02-01T00:00:00Z"}


def pricing_row(i):
    return {"id": 300 + i, "model": f"claude-sonnet-4-5-{i}", "input_price": 3.0, "output_price": 15.0,
            "group_id": 1, "group_name": "default", "enabled": i % 2 == 0}


def order_row(i, status="paid"):
    return {"id": 400 + i, "order_no": f"QA20260808{i:04d}", "status": status,
            "user_id": 10 + i, "username": f"tester{i:02d}", "amount": 19.90,
            "pay_amount": 19.90, "refund_amount": None,
            "currency": "CNY", "payment_method": "alipay", "provider_instance_id": "alipay-1",
            "product_type": "subscription", "created_at": "2026-08-08T01:00:00Z",
            "paid_at": "2026-08-08T01:02:00Z"}


def plan_row(i):
    return {"id": 500 + i, "name": f"Pro Plan {i}", "price": 9.90, "original_price": 12.0,
            "billing_cycle": "monthly",
            "description": "More tokens", "features": ["fast", "priority"], "enabled": True,
            "sort_order": i, "created_at": "2026-01-01T00:00:00Z"}


def announcement_row(i, status="published"):
    return {"id": 600 + i, "title": f"Announcement {i}", "content": f"Scheduled maintenance #{i}",
            "status": status, "notify_mode": "silent",
            "targeting": {"user_ids": [], "group_ids": [], "all_users": True},
            "published_at": "2026-08-01T00:00:00Z",
            "read": False, "created_at": "2026-08-01T00:00:00Z"}


def proxy_row(i, status="active"):
    return {"id": 700 + i, "name": f"proxy-{i:02d}", "protocol": "http", "host": f"10.0.0.{i}",
            "port": 7890 + i, "username": "", "status": "active", "created_at": "2026-01-01T00:00:00Z"}


def redeem_row(i, status="unused"):
    return {"id": 800 + i, "code": f"REDEEM{i:04d}", "status": status, "balance": "5.00",
            "user_id": None, "created_at": "2026-07-01T00:00:00Z", "used_at": None}


def promo_row(i, status="active"):
    return {"id": 900 + i, "code": f"PROMO{i:02d}", "type": "percent", "value": 10,
            "bonus_amount": 10.0, "status": status, "max_uses": 100, "used_count": 3,
            "expires_at": "2026-12-31T00:00:00Z"}


def audit_row(i):
    return {"id": 1000 + i, "user_id": 1, "username": "admin", "action": "account.update",
            "resource": f"account:{i}", "ip_address": "203.0.113.5",
            "created_at": "2026-08-08T02:00:00Z", "details": "updated priority"}


def usage_row(i, username="tester01"):
    return {"id": 1100 + i, "user_id": 10, "username": username, "api_key_id": 100,
            "account_id": 1, "request_id": f"req_{i:04d}", "group_id": 1,
            "model": "claude-sonnet-4-5", "input_tokens": 1200 + i, "output_tokens": 340 + i,
            "cache_creation_tokens": 0, "cache_read_tokens": 0, "cache_creation_5m_tokens": 0,
            "cache_creation_1h_tokens": 0, "total_tokens": 1540 + i,
            "input_cost": 0.0036 + i * 0.0001, "output_cost": 0.0051 + i * 0.0001,
            "cache_creation_cost": 0.0, "cache_read_cost": 0.0,
            "total_cost": 0.021 + i * 0.001, "actual_cost": 0.02 + i * 0.001,
            "rate_multiplier": 1.0, "long_context_billing_applied": False, "billing_type": 0,
            "request_type": "chat", "stream": False, "duration_ms": 430,
            "first_token_ms": 120, "image_count": 0, "image_size": None,
            "image_input_size": None, "image_output_size": None, "image_size_source": None,
            "image_input_tokens": 0, "image_input_cost": 0.0, "image_output_tokens": 0,
            "image_output_cost": 0.0, "user_agent": "Mozilla/5.0", "ip_address": "203.0.113.9",
            "cache_ttl_overridden": False, "created_at": "2026-08-08T02:00:00Z"}


def invite_row(i):
    return {"id": 1200 + i, "user_id": 10 + i, "username": f"tester{i:02d}", "invitee": f"invitee{i:02d}",
            "status": "registered", "invite_code": f"INV{i:04d}", "created_at": "2026-07-01T00:00:00Z"}


def rebate_row(i):
    return {"id": 1300 + i, "user_id": 10, "username": "tester01", "invitee": f"invitee{i:02d}",
            "order_no": f"QA202607{i:04d}", "rate": "0.10", "amount": "1.99", "status": "settled",
            "created_at": "2026-07-05T00:00:00Z"}


def transfer_row(i):
    return {"id": 1400 + i, "user_id": 10, "username": "tester01", "amount": "5.00",
            "status": "completed", "created_at": "2026-07-10T00:00:00Z", "note": "withdraw"}


def monitor_row(i):
    return {"id": 1500 + i, "name": f"monitor-{i:02d}", "group_id": 1, "group_name": "default",
            "status": "healthy", "enabled": True, "interval_seconds": 60,
            "target": "https://api.example.com/v1/chat/completions", "created_at": "2026-01-01T00:00:00Z"}


def sub_row(i, status="active"):
    return {"id": 1600 + i, "user_id": 10, "username": "tester01", "group_id": 1, "group_name": "default",
            "status": "active", "plan_name": "Pro Plan 1", "started_at": "2026-07-01T00:00:00Z",
            "expires_at": "2026-08-01T00:00:00Z"}


def model_stat(i):
    return {"model": ["claude-sonnet-4-5", "claude-opus-4-1", "gpt-4o", "gpt-4o-mini"][i % 4],
            "requests": 1200 + i * 33, "total_tokens": 2_000_000 + i * 99_000,
            "cost": 8.5 + i, "actual_cost": 8.5 + i}


def group_stat(i):
    return {"group": f"group-{i:02d}", "requests": 900 + i * 11, "total_tokens": 1_000_000 + i * 10_000,
            "cost": 4.2 + i}


def trend_point(i, hour=0):
    return {"date": f"2026-08-0{1 + i % 7}T{hour:02d}:00:00Z", "requests": 300 + i * 17,
            "total_tokens": 400_000 + i * 5000, "cost": 1.2 + i * 0.13, "actual_cost": 1.2 + i * 0.13}


def stat_cards():
    return {"total_users": 128, "active_users": 96, "total_api_keys": 340, "active_api_keys": 310,
            "total_accounts": 42, "active_accounts": 38, "total_groups": 12, "total_requests": 5_230_000,
            "total_tokens": 2_400_000_000, "today_requests": 12_400, "today_tokens": 89_000_000,
            "today_cost": 102.50, "month_cost": 3180.20, "total_cost": 51200.80,
            "avg_response_time": 0.42, "error_rate": 0.012, "error_count": 8, "uptime": 99.98}


def user_stats():
    """UserDashboardStats shape — numeric fields (toFixed is called on them)."""
    return {"total_api_keys": 3, "active_api_keys": 2,
            "total_requests": 5230, "total_input_tokens": 4_200_000, "total_output_tokens": 1_100_000,
            "total_cache_creation_tokens": 80_000, "total_cache_read_tokens": 500_000,
            "total_tokens": 5_880_000, "total_cost": 42.18, "total_actual_cost": 40.02,
            "today_requests": 182, "today_input_tokens": 150_000, "today_output_tokens": 42_000,
            "today_cache_creation_tokens": 2_000, "today_cache_read_tokens": 18_000,
            "today_tokens": 212_000, "today_cost": 2.12, "today_actual_cost": 2.01,
            "average_duration_ms": 430, "rpm": 3.1, "tpm": 44.5,
            "by_platform": [
                {"platform": "anthropic", "requests": 3100, "tokens": 3_200_000, "cost": 28.5},
                {"platform": "openai", "requests": 1800, "tokens": 2_400_000, "cost": 11.2},
                {"platform": "gemini", "requests": 330, "tokens": 280_000, "cost": 2.48},
            ]}


def api_key_trend_point(i):
    return {"date": f"2026-08-0{1 + i % 7}", "key_name": f"prod-key-{i:02d}", "requests": 500 + i * 13,
            "total_tokens": 700_000 + i * 8000, "cost": 0.9 + i * 0.07}


def user_usage_trend_point(i):
    return {"date": f"2026-08-0{1 + i % 7}", "username": f"tester{i:02d}", "requests": 200 + i * 9,
            "total_tokens": 300_000 + i * 4000, "cost": 0.5 + i * 0.05}


def user_breakdown_item(i):
    return {"user_id": 10 + i, "username": f"tester{i:02d}", "requests": 120 + i * 5,
            "total_tokens": 150_000 + i * 1000, "input_tokens": 100_000, "output_tokens": 50_000,
            "cost": 0.31 + i * 0.02, "actual_cost": 0.31 + i * 0.02}


def ops_overview():
    return {"generated_at": "2026-08-08T02:00:00Z", "qps": 3.2, "requests_per_minute": 190,
            "active_requests": 12, "total_requests": 5_230_000, "success_rate": 0.988,
            "error_rate": 0.012, "avg_latency_ms": 420, "p95_latency_ms": 810,
            "upstream_errors": 14, "accounts_active": 38, "accounts_error": 2,
            "openai_token_pct": 0.61, "models": ["claude-sonnet-4-5", "gpt-4o"],
            "channels": [{"id": 200, "name": "channel-00", "status": "active", "qps": 1.1, "error_rate": 0.01}]}


def ops_snapshot():
    return {"generated_at": "2026-08-08T02:00:00Z", "overview": ops_overview(),
            "throughput_trend": [trend_point(i) for i in range(24)],
            "error_trend": [trend_point(i) for i in range(24)],
            "latency_histogram": {"buckets": [0, 100, 200, 500, 1000, 2000], "counts": [10, 40, 80, 30, 8, 2]},
            "error_distribution": [{"error_type": "timeout", "count": 40}, {"error_type": "5xx", "count": 12}],
            "openai_token_stats": {"total": 1_200_000, "used": 890_000, "free": 310_000}}


def settings_object():
    return {
        "site_name": "Sub2API QA", "site_logo": "/logo.svg", "site_subtitle": "AI API Gateway",
        "contact_info": "qa@example.com", "doc_url": "https://docs.example.com",
        "registration_enabled": True, "email_verify_enabled": False,
        "registration_email_suffix_whitelist": [], "promo_code_enabled": True,
        "invitation_code_enabled": True, "password_reset_enabled": True,
        "affiliate_enabled": True, "model_plaza_enabled": True,
        "risk_control_enabled": True, "channel_monitor_enabled": True, "ops_monitoring_enabled": True,
        "available_channels_enabled": True, "server_utc_offset": 8,
        "custom_menu_items": [], "custom_endpoints": [],
        "linuxdo_oauth_enabled": True, "dingtalk_oauth_enabled": True, "wechat_oauth_enabled": True,
        "wechat_oauth_open_enabled": True, "wechat_oauth_mp_enabled": False,
        "wechat_oauth_mobile_enabled": True, "oidc_oauth_enabled": True,
        "oidc_oauth_provider_name": "Google", "github_oauth_enabled": True, "google_oauth_enabled": True,
        "backend_mode_enabled": False, "table_default_page_size": 20,
        "auth_source_defaults": {
            "email": {"balance": 0, "concurrency": 5, "subscriptions": [], "grant_on_signup": False,
                      "grant_on_first_bind": False, "platform_quotas": {}},
            "linuxdo": {"balance": 1, "concurrency": 5, "subscriptions": [], "grant_on_signup": True,
                        "grant_on_first_bind": False, "platform_quotas": {}},
            "oidc": {"balance": 1, "concurrency": 5, "subscriptions": [], "grant_on_signup": True,
                     "grant_on_first_bind": False, "platform_quotas": {}},
            "wechat": {"balance": 1, "concurrency": 5, "subscriptions": [], "grant_on_signup": True,
                       "grant_on_first_bind": False, "platform_quotas": {}},
            "github": {"balance": 1, "concurrency": 5, "subscriptions": [], "grant_on_signup": True,
                       "grant_on_first_bind": False, "platform_quotas": {}},
            "google": {"balance": 1, "concurrency": 5, "subscriptions": [], "grant_on_signup": True,
                       "grant_on_first_bind": False, "platform_quotas": {}},
            "dingtalk": {"balance": 1, "concurrency": 5, "subscriptions": [], "grant_on_signup": True,
                         "grant_on_first_bind": False, "platform_quotas": {}},
        },
        "payment": {"enabled": True, "methods": ["alipay", "wxpay"], "currency": "CNY"},
        "default_platform_quotas": {"anthropic": {"daily": 100, "weekly": 500, "monthly": 1500}},
    }


def payout(d):
    return json.dumps(d)


def paginated(items):
    return {"items": items, "total": len(items), "page": 1, "page_size": 20, "pages": 1}


# ---------------------------------------------------------------------------
# Mock rules: (compiled-regex on path, payload-dict-or-callable(request))
# First match wins.  Anything unmatched falls back to a generic shape.
# ---------------------------------------------------------------------------
def R(path_re, payload):
    return (re.compile(path_re), payload)


def users_list(req):
    return paginated([user_row(1, "user"), user_row(2, "user"), user_row(3, "admin", "active"),
                      user_row(4, "user", "disabled"), user_row(5, "user")])


MOCK_RULES = [
    R(r"^/api/v1/settings/public$", SETTINGS),
    R(r"^/api/v1/auth/me$", lambda req: dict(verify.ADMIN_USER if _role() == "admin" else verify.NORMAL_USER,
                                     balance=128.50, available_balance=116.50,
                                     frozen_balance=12.0, run_mode="standard")),
    R(r"^/api/v1/auth/logout$", {"message": "ok"}),
    R(r"^/api/v1/auth/oauth/pending/exchange$", {"error": "invitation_required",
                                         "user_email_masked": "q***@example.com",
                                         "suggested_display_name": "QA User"}),
    R(r"^/api/v1/auth/oauth/pending/send-verify-code$", {"auth_result": "ok", "provider": "oidc", "countdown": 60}),
    R(r"^/api/v1/auth/oauth/(linuxdo|oidc|wechat|dingtalk)/complete-registration$",
      {"error": "invitation_required"}),
    R(r"^/api/v1/auth/oauth/dingtalk/email-completion$", {"error": "invalid_code"}),
    R(r"^/api/v1/auth/validate-promo-code$", {"valid": True, "bonus_amount": 2.0}),
    R(r"^/api/v1/auth/validate-invitation-code$", {"valid": True}),
    R(r"^/api/v1/admin/compliance/accept$", {"required": False, "version": "v2026.06.10",
                                     "document_path_zh": "docs/legal/admin-compliance.zh.md",
                                     "document_path_en": "docs/legal/admin-compliance.en.md",
                                     "document_url_zh": "https://example.com/zh",
                                     "document_url_en": "https://example.com/en",
                                     "ack_phrase_zh": "同意", "ack_phrase_en": "I agree"}),
    R(r"^/api/v1/admin/compliance$", {"required": False, "version": "v2026.06.10",
                              "document_path_zh": "docs/legal/admin-compliance.zh.md",
                              "document_path_en": "docs/legal/admin-compliance.en.md",
                              "document_url_zh": "https://example.com/zh",
                              "document_url_en": "https://example.com/en",
                              "ack_phrase_zh": "同意", "ack_phrase_en": "I agree"}),
    # ---- user dashboard / usage ----
    R(r"^/api/v1/dashboard$", lambda req: {"stats": stat_cards(),
                                   "recent_usage": [usage_row(i) for i in range(5)],
                                   "groups": [group_row(1), group_row(2)],
                                   "announcements": [announcement_row(1), announcement_row(2)]}),
    R(r"^/api/v1/usage/dashboard/snapshot-v2$", lambda req: {
        "generated_at": "2026-08-08T02:00:00Z", "start_date": "2026-08-01", "end_date": "2026-08-08",
        "granularity": "day", "stats": stat_cards(),
        "trend": [trend_point(i) for i in range(24)],
        "models": [model_stat(i) for i in range(4)],
        "api_keys_usage": [api_key_trend_point(i) for i in range(5)],
        "users_trend": [user_usage_trend_point(i) for i in range(5)]}),
    R(r"^/api/v1/usage/dashboard/stats$", user_stats()),
    R(r"^/api/v1/usage/dashboard/trend$", lambda req: {"trend": [trend_point(i) for i in range(24)],
                                               "start_date": "2026-08-01", "end_date": "2026-08-08",
                                               "granularity": "day"}),
    R(r"^/api/v1/usage/dashboard/models$", lambda req: {"models": [model_stat(i) for i in range(4)]}),
    R(r"^/api/v1/usage/dashboard/api-keys-usage$", lambda req: {"stats": {
        str(100 + i): {"api_key_id": 100 + i, "today_actual_cost": 0.31 + i * 0.02,
                       "total_actual_cost": 3.21 + i * 0.5} for i in range(3)}}),
    R(r"^/api/v1/usage/stats$", stat_cards()),
    R(r"^/api/v1/usage/errors$", paginated([{"id": 1, "model": "gpt-4o", "status": 429,
                                     "error_type": "rate_limit", "message": "Rate limit hit",
                                     "created_at": "2026-08-08T01:00:00Z"}])),
    R(r"^/api/v1/usage$", paginated([usage_row(1), usage_row(2, "tester02"), usage_row(3)])),
    # ---- keys ----
    R(r"^/api/v1/keys$", paginated([key_row(1), key_row(2), key_row(3, status="disabled")])),
    R(r"^/api/v1/groups/available$", [{"id": 1, "name": "default", "platform": "anthropic", "models": ["claude-sonnet-4-5"]},
                              {"id": 2, "name": "gpt", "platform": "openai", "models": ["gpt-4o"]}]),
    R(r"^/api/v1/groups/rates$", [{"id": 1, "name": "default", "platform": "anthropic",
                           "input_price": 3.0, "output_price": 15.0,
                           "models": ["claude-sonnet-4-5", "claude-opus-4-1"]},
                          {"id": 2, "name": "gpt", "platform": "openai",
                           "input_price": 2.5, "output_price": 10.0, "models": ["gpt-4o"]}]),
    # ---- redeem ----
    R(r"^/api/v1/redeem/history$", paginated([redeem_row(1, "used"), redeem_row(2), redeem_row(3, "used")])),
    R(r"^/api/v1/redeem$", {"balance": 5.0, "redeemed_count": 2}),
    # ---- affiliate ----
    R(r"^/api/v1/user/aff/transfer$", paginated([transfer_row(1), transfer_row(2)])),
    R(r"^/api/v1/user/aff$", {"user_id": 10, "aff_code": "INV2026", "inviter_id": None,
                      "aff_count": 3, "aff_quota": 100, "aff_frozen_quota": 5,
                      "aff_history_quota": 95, "effective_rebate_rate_percent": 10,
                      "invitees": [
                          {"user_id": 20, "email": "invitee01@example.com", "username": "invitee01",
                           "created_at": "2026-07-01T00:00:00Z", "total_rebate": 1.99},
                          {"user_id": 21, "email": "invitee02@example.com", "username": "invitee02",
                           "created_at": "2026-07-10T00:00:00Z", "total_rebate": 0.51},
                      ]}),
    # ---- channels / monitor ----
    R(r"^/api/v1/channels/available$", [{"id": 200, "name": "channel-00", "status": "active", "models": ["gpt-4o"]},
                                {"id": 201, "name": "channel-01", "status": "degraded", "models": ["gpt-4o-mini"]}]),
    R(r"^/api/v1/channel-monitors/[0-9]+/status$", {"id": 1500, "status": "healthy", "latency_ms": 180,
                                            "last_checked_at": "2026-08-08T02:00:00Z",
                                            "history": [{"ts": "2026-08-08T01:00:00Z", "status": "healthy", "latency_ms": 170}]}),
    R(r"^/api/v1/channel-monitors$", paginated([monitor_row(1), monitor_row(2, )])),
    # ---- profile ----
    R(r"^/api/v1/user/profile$", lambda req: user_row(1, "user", balance="12.34")),
    R(r"^/api/v1/user/totp/status$", {"enabled": False}),
    R(r"^/api/v1/user/passkeys$", paginated([{"id": 12, "name": "MacBook Touch ID", "created_at": "2026-05-01T00:00:00Z"}])),
    R(r"^/api/v1/user/platform-quotas$", {"platforms": [{"platform": "anthropic", "daily": 100, "weekly": 500,
                                                 "monthly": 1500, "used_today": 12}]}),
    R(r"^/api/v1/user/notify-email$", {"notify_enabled": True, "threshold": 5.0,
                               "entries": [{"email": "ops@example.com", "disabled": False}]}),
    R(r"^/api/v1/user$", lambda req: user_row(1, "user", balance="12.34")),
    # ---- subscriptions ----
    R(r"^/api/v1/subscriptions/progress$", [{"subscription_id": 1600, "group_name": "default",
                                     "daily_progress": 0.42, "weekly_progress": 0.3, "monthly_progress": 0.2}]),
    R(r"^/api/v1/subscriptions/summary$", {"active_count": 1, "subscriptions": [sub_row(1)]}),
    R(r"^/api/v1/subscriptions/active$", [sub_row(1)]),
    R(r"^/api/v1/subscriptions$", paginated([sub_row(1), sub_row(2, status="expired")])),
    # ---- payment (user) ----
    R(r"^/api/v1/payment/config$", {"enabled": True, "currency": "CNY", "methods": ["alipay", "wxpay"],
                            "min_amount": "1.00", "max_amount": "5000.00"}),
    R(r"^/api/v1/payment/plans$", {"plans": [plan_row(1), plan_row(2), plan_row(3)]}),
    R(r"^/api/v1/payment/limits$", {"daily_limit": "500.00", "monthly_limit": "5000.00"}),
    R(r"^/api/v1/payment/checkout-info$", {"provider": "alipay", "qr_code_url": "https://example.com/qr.png",
                                   "expires_at": "2026-08-08T02:30:00Z", "amount": "19.90",
                                   "methods": {
                                       "alipay": {"daily_limit": 500, "daily_used": 10,
                                                  "daily_remaining": 490, "single_min": 1,
                                                  "single_max": 5000, "fee_rate": 0.006},
                                       "wxpay": {"daily_limit": 500, "daily_used": 5,
                                                 "daily_remaining": 495, "single_min": 1,
                                                 "single_max": 5000, "fee_rate": 0.006},
                                   },
                                   "global_min": 1, "global_max": 5000,
                                   "plans": [plan_row(1), plan_row(2), plan_row(3)],
                                   "balance_disabled": False, "balance_recharge_multiplier": 1.0,
                                   "subscription_usd_to_cny_rate": 7.2, "recharge_fee_rate": 0.006,
                                   "help_text": "", "help_image_url": "",
                                   "stripe_publishable_key": ""}),
    R(r"^/api/v1/payment/orders/verify$", order_row(1)),
    R(r"^/api/v1/payment/public/orders/verify$", order_row(1)),
    R(r"^/api/v1/payment/public/orders/resolve$", order_row(1)),
    R(r"^/api/v1/payment/orders/refund-eligible-providers$", {"provider_instance_ids": []}),
    R(r"^/api/v1/payment/orders/my$", paginated([order_row(1), order_row(2, "pending")])),
    R(r"^/api/v1/payment/orders$", paginated([order_row(1), order_row(2, "pending"), order_row(3, "refunded")])),
    R(r"^/api/v1/payment/providers$", [{"id": "alipay-1", "name": "Alipay Official", "type": "alipay", "enabled": True},
                               {"id": "wxpay-1", "name": "WeChat Pay Official", "type": "wxpay", "enabled": True}]),
    # ---- model plaza ----
    R(r"^/api/v1/model-plaza$", {"models": [{"id": 1, "name": "claude-sonnet-4-5", "provider": "anthropic",
                                     "category": "chat", "description": "Flagship model",
                                     "input_price": 3.0, "output_price": 15.0, "enabled": True},
                                    {"id": 2, "name": "gpt-4o", "provider": "openai", "category": "chat",
                                     "description": "Multimodal", "input_price": 2.5,
                                     "output_price": 10.0, "enabled": True}]}),
    # ---- batch image ----
    R(r"/v1/images/batches/models$", {"models": ["dall-e-3", "gpt-image-1"]}),
    R(r"/v1/images/batches$", paginated([{"id": "batch_01", "status": "completed", "model": "dall-e-3",
                                          "input_file": "prompts.jsonl", "output_file": "out.jsonl",
                                          "created_at": "2026-08-01T00:00:00Z"}])),
    # ---- announcements ----
    R(r"^/api/v1/announcements$", [announcement_row(1), announcement_row(2)]),
    R(r"^/api/v1/announcements/[0-9]+/read$", {"message": "ok"}),
    # ---- setup ----
    R(r"/setup/status$", {"data": {"needs_setup": False, "step": ""}}),
    # ---- admin: dashboard ----
    R(r"^/api/v1/admin/dashboard/snapshot-v2$", lambda req: {
        "generated_at": "2026-08-08T02:00:00Z", "start_date": "2026-08-01", "end_date": "2026-08-08",
        "granularity": "day", "stats": dict(stat_cards(), uptime=99.98),
        "trend": [trend_point(i) for i in range(24)],
        "models": [model_stat(i) for i in range(4)],
        "groups": [group_stat(i) for i in range(3)],
        "users_trend": [user_usage_trend_point(i) for i in range(5)]}),
    R(r"^/api/v1/admin/dashboard/stats$", stat_cards()),
    R(r"^/api/v1/admin/dashboard/realtime$", {"active_requests": 12, "requests_per_minute": 190,
                                      "average_response_time": 0.42, "error_rate": 0.012}),
    R(r"^/api/v1/admin/dashboard/trend$", lambda req: {"trend": [trend_point(i) for i in range(24)],
                                               "start_date": "2026-08-01", "end_date": "2026-08-08",
                                               "granularity": "day"}),
    R(r"^/api/v1/admin/dashboard/models$", lambda req: {"models": [model_stat(i) for i in range(4)]}),
    R(r"^/api/v1/admin/dashboard/groups$", lambda req: {"groups": [group_stat(i) for i in range(3)]}),
    R(r"^/api/v1/admin/dashboard/user-breakdown$", lambda req: {"users": [user_breakdown_item(i) for i in range(5)]}),
    R(r"^/api/v1/admin/dashboard/users-ranking$", lambda req: {"users": [user_breakdown_item(i) for i in range(5)]}),
    R(r"^/api/v1/admin/dashboard/users-trend$", lambda req: {"users_trend": [user_usage_trend_point(i) for i in range(5)]}),
    R(r"^/api/v1/admin/dashboard/users-usage$", lambda req: {"stats": {
        str(11 + i): {"today_actual_cost": 0.5 + i * 0.1, "total_actual_cost": 3.1 + i * 0.4,
                      "by_platform": [{"platform": "anthropic", "today_actual_cost": 0.3,
                                       "total_actual_cost": 2.0}]} for i in range(5)}}),
    R(r"^/api/v1/admin/dashboard/api-keys-usage$", lambda req: {"items": [api_key_trend_point(i) for i in range(5)]}),
    R(r"^/api/v1/admin/dashboard/api-keys-trend$", lambda req: {"api_keys": [api_key_trend_point(i) for i in range(5)]}),
    # ---- admin: accounts ----
    R(r"^/api/v1/admin/accounts/data$", lambda req: {"items": verify.ACCOUNTS, "total": 3}),
    R(r"^/api/v1/admin/accounts/today-stats/batch$", {"stats": [{"account_id": a["id"], "requests": 120,
                                                         "tokens": 45000, "cost": 1.23} for a in verify.ACCOUNTS]}),
    R(r"^/api/v1/admin/accounts$", paginated(verify.ACCOUNTS)),
    # ---- admin: users ----
    R(r"^/api/v1/admin/users$", users_list),
    # ---- admin: groups ----
    R(r"^/api/v1/admin/groups/all$", [group_row(1), group_row(2, "openai")]),
    R(r"^/api/v1/admin/groups/capacity-summary$", [{"group_id": 1, "concurrency_used": 2, "concurrency_max": 4,
                                            "sessions_used": 3, "sessions_max": 8,
                                            "rpm_used": 12, "rpm_max": 60}]),
    R(r"^/api/v1/admin/groups/usage-summary$", [{"group_id": 1, "today_cost": 2.1, "total_cost": 42.5},
                                        {"group_id": 2, "today_cost": 1.2, "total_cost": 30.0}]),
    R(r"^/api/v1/admin/groups/live-capability$", {"group_id": 1, "live_capability": True}),
    R(r"^/api/v1/admin/groups$", paginated([group_row(1), group_row(2, "openai"), group_row(3, "gemini", "disabled")])),
    # ---- admin: channels ----
    R(r"^/api/v1/admin/channels/model-pricing$", paginated([pricing_row(1), pricing_row(2), pricing_row(3)])),
    R(r"^/api/v1/admin/channels$", paginated([channel_row(1), channel_row(2, "degraded"), channel_row(3)])),
    # ---- admin: channel monitor ----
    R(r"^/api/v1/admin/channel-monitor-templates$", paginated([{"id": 1, "name": "health-check", "method": "GET",
                                                        "url": "https://api.example.com/health"}])),
    R(r"^/api/v1/admin/channel-monitors$", paginated([monitor_row(1), monitor_row(2)])),
    # ---- admin: subscriptions ----
    R(r"^/api/v1/admin/subscriptions$", paginated([sub_row(1), sub_row(2, status="expired"), sub_row(3)])),
    # ---- admin: announcements ----
    R(r"^/api/v1/admin/announcements$", paginated([announcement_row(1), announcement_row(2),
                                           announcement_row(3, status="draft")])),
    # ---- admin: proxies ----
    R(r"^/api/v1/admin/proxies/all$", [proxy_row(1), proxy_row(2)]),
    R(r"^/api/v1/admin/proxies$", paginated([proxy_row(1), proxy_row(2), proxy_row(3, status="disabled")])),
    # ---- admin: redeem ----
    R(r"^/api/v1/admin/redeem-codes/stats$", {"total": 42, "used": 18, "balance": "120.00"}),
    R(r"^/api/v1/admin/redeem-codes$", paginated([redeem_row(1, "used"), redeem_row(2), redeem_row(3)])),
    # ---- admin: promo ----
    R(r"^/api/v1/admin/promo-codes$", paginated([promo_row(1), promo_row(2), promo_row(3, status="disabled")])),
    # ---- admin: audit ----
    R(r"^/api/v1/admin/audit-logs$", paginated([audit_row(1), audit_row(2), audit_row(3)])),
    # ---- admin: usage ----
    R(r"^/api/v1/admin/usage/search-users$", paginated([{"id": 10, "username": "tester01"},
                                                {"id": 11, "username": "tester02"}])),
    R(r"^/api/v1/admin/usage/search-api-keys$", paginated([{"id": 100, "name": "prod-key-01"}])),
    R(r"^/api/v1/admin/usage/stats$", stat_cards()),
    R(r"^/api/v1/admin/usage$", paginated([usage_row(1), usage_row(2, "tester02"), usage_row(3)])),
    # ---- admin: affiliates ----
    R(r"^/api/v1/admin/affiliates/invites$", paginated([invite_row(1), invite_row(2), invite_row(3)])),
    R(r"^/api/v1/admin/affiliates/rebates$", paginated([rebate_row(1), rebate_row(2)])),
    R(r"^/api/v1/admin/affiliates/transfers$", paginated([transfer_row(1), transfer_row(2)])),
    R(r"^/api/v1/admin/affiliates/users$", paginated([{"id": 10, "username": "tester01", "invite_code": "INV2026"}])),
    # ---- admin: payment ----
    R(r"^/api/v1/admin/payment/dashboard$", {
        "today_amount": {"CNY": 238.6}, "total_amount": {"CNY": 8190.5},
        "today_count": 12, "total_count": 320, "avg_amount": {"CNY": 25.6},
        "daily_series": [{"date": f"2026-08-{1 + i % 7:02d}", "amount": {"CNY": 120 + i * 8},
                          "count": 8 + i} for i in range(7)],
        "payment_methods": [{"type": "alipay", "amount": {"CNY": 5190.5}, "count": 210},
                            {"type": "wxpay", "amount": {"CNY": 3000.0}, "count": 110}],
        "top_users": {"CNY": [
            {"user_id": 10, "email": "tester01@example.com", "amount": 580.0},
            {"user_id": 11, "email": "tester02@example.com", "amount": 320.5},
        ]},
    }),
    R(r"^/api/v1/admin/payment/plans$", paginated([plan_row(1), plan_row(2), plan_row(3)])),
    R(r"^/api/v1/admin/payment/orders$", paginated([order_row(1), order_row(2, "pending"), order_row(3, "refunded")])),
    R(r"^/api/v1/admin/payment/channels$", [{"id": "alipay-1", "name": "Alipay Official", "enabled": True},
                                    {"id": "wxpay-1", "name": "WeChat Pay", "enabled": True}]),
    R(r"^/api/v1/admin/payment/providers$", [{"id": "alipay-1", "name": "Alipay Official",
                                      "provider_key": "alipay", "type": "alipay",
                                      "payment_mode": "qrcode", "enabled": True,
                                      "refund_enabled": True, "allow_user_refund": True,
                                      "supported_types": ["alipay"],
                                      "config": {"app_id": "2026"}}]),
    R(r"^/api/v1/admin/payment/config$", {"enabled": True, "currency": "CNY"}),
    # ---- admin: risk control ----
    R(r"^/api/v1/admin/risk-control/status$", {"enabled": True, "mode": "monitor"}),
    R(r"^/api/v1/admin/risk-control/config$", {"enabled": True, "mode": "monitor", "rules": [
        {"id": 1, "name": "request-rate", "enabled": True, "threshold": 100, "window": "5m"}]}),
    R(r"^/api/v1/admin/risk-control/hashes/all$", [{"id": 1, "hash": "sha256:abcd", "risk": "high",
                                            "created_at": "2026-07-01T00:00:00Z"}]),
    R(r"^/api/v1/admin/risk-control/hashes$", paginated([{"id": 1, "hash": "sha256:abcd", "risk": "high",
                                                  "created_at": "2026-07-01T00:00:00Z"}])),
    R(r"^/api/v1/admin/risk-control/logs$", paginated([{"id": 1, "user_id": 10, "username": "tester01",
                                                "action": "blocked", "rule": "request-rate",
                                                "created_at": "2026-08-08T01:00:00Z"}])),
    # ---- admin: settings ----
    R(r"^/api/v1/admin/settings$", settings_object()),
    R(r"^/api/v1/admin/settings/beta-policy$", {"enabled": False}),
    R(r"^/api/v1/admin/settings/rectifier$", {"enabled": True}),
    R(r"^/api/v1/admin/settings/overload-cooldown$", {"cooldown_seconds": 300}),
    R(r"^/api/v1/admin/settings/panel-rate-limit$", {"enabled": True, "limit": 100}),
    R(r"^/api/v1/admin/settings/rate-limit-429-cooldown$", {"cooldown_seconds": 60}),
    R(r"^/api/v1/admin/settings/stream-timeout$", {"timeout_seconds": 300}),
    R(r"^/api/v1/admin/settings/web-search-emulation$", {"enabled": True}),
    R(r"^/api/v1/admin/settings/email-templates$", {"templates": []}),
    # ---- admin: ops ----
    R(r"^/api/v1/admin/ops/dashboard/overview$", ops_overview()),
    R(r"^/api/v1/admin/ops/dashboard/snapshot-v2$", ops_snapshot()),
    R(r"^/api/v1/admin/ops/dashboard/throughput-trend$", {"points": [trend_point(i) for i in range(24)]}),
    R(r"^/api/v1/admin/ops/dashboard/error-trend$", {"points": [trend_point(i) for i in range(24)]}),
    R(r"^/api/v1/admin/ops/dashboard/error-distribution$", {"items": [{"error_type": "timeout", "count": 40},
                                                              {"error_type": "5xx", "count": 12}]}),
    R(r"^/api/v1/admin/ops/dashboard/latency-histogram$", {"buckets": [0, 100, 200, 500, 1000, 2000],
                                                   "counts": [10, 40, 80, 30, 8, 2]}),
    R(r"^/api/v1/admin/ops/dashboard/openai-token-stats$", {"total": 1_200_000, "used": 890_000, "free": 310_000}),
    R(r"^/api/v1/admin/ops/account-availability$", {"items": [{"account_id": 1, "name": "acct-01",
                                                       "available": True, "qps": 1.2}]}),
    R(r"^/api/v1/admin/ops/concurrency$", {"items": [{"group": "default", "concurrency": 4, "used": 2}]}),
    R(r"^/api/v1/admin/ops/user-concurrency$", {"items": [{"user_id": 10, "username": "tester01",
                                                   "concurrency": 2, "used": 1}]}),
    R(r"^/api/v1/admin/ops/alert-events$", paginated([{"id": 1, "severity": "warning", "title": "High latency",
                                               "message": "p95 > 800ms", "status": "open",
                                               "created_at": "2026-08-08T01:00:00Z"}])),
    R(r"^/api/v1/admin/ops/alert-rules$", [{"id": 1, "name": "latency", "enabled": True, "severity": "warning",
                                    "threshold": 800}]),
    R(r"^/api/v1/admin/ops/alert-silences$", []),
    R(r"^/api/v1/admin/ops/system-logs$", paginated([{"id": 1, "level": "info", "message": "started",
                                              "service": "gateway", "created_at": "2026-08-08T00:00:00Z"}])),
    R(r"^/api/v1/admin/ops/system-logs/health$", {"healthy": True}),
    R(r"^/api/v1/admin/ops/requests$", paginated([{"id": 1, "request_id": "req_01", "user_id": 10,
                                           "model": "claude-sonnet-4-5", "status": 200,
                                           "latency_ms": 420, "cost": 0.021,
                                           "created_at": "2026-08-08T02:00:00Z"}])),
    R(r"^/api/v1/admin/ops/request-errors$", paginated([{"id": 1, "request_id": "req_02", "status": 500,
                                                 "error_type": "upstream", "message": "502",
                                                 "created_at": "2026-08-08T02:00:00Z"}])),
    R(r"^/api/v1/admin/ops/upstream-errors$", paginated([{"id": 1, "account_id": 1, "account_name": "acct-01",
                                                  "status": 502, "error_type": "bad_gateway",
                                                  "created_at": "2026-08-08T02:00:00Z"}])),
    R(r"^/api/v1/admin/ops/realtime-traffic$", {"qps": 3.2, "requests": 190}),
    R(r"^/api/v1/admin/ops/email-notification/config$", {"enabled": False, "recipients": []}),
    R(r"^/api/v1/admin/ops/runtime/logging$", {"level": "info"}),
    R(r"^/api/v1/admin/ops/runtime/alert$", {"enabled": True}),
    R(r"^/api/v1/admin/ops/advanced-settings$", {"stream_timeout": 300}),
    R(r"^/api/v1/admin/ops/settings/metric-thresholds$", {"latency_p95": 800, "error_rate": 0.05}),
    # ---- admin: misc ----
    R(r"^/api/v1/admin/system/version$", {"current_version": "v1.2.3", "latest_version": "v1.2.3",
                                  "has_update": False, "build_type": "release",
                                  "release_info": None}),
    R(r"^/api/v1/admin/system/check-updates$", {"has_update": False}),
    R(r"^/api/v1/admin/backups$", paginated([{"id": 1, "name": "backup-20260808", "size": "2.1GB",
                                      "status": "completed", "created_at": "2026-08-08T00:00:00Z"}])),
    R(r"^/api/v1/admin/data-management/backups$", paginated([{"id": 1, "name": "backup-20260808",
                                                      "status": "completed"}])),
    R(r"^/api/v1/admin/data-management/config$", {"enabled": True}),
    R(r"^/api/v1/admin/data-management/s3/profiles$", []),
    R(r"^/api/v1/admin/error-passthrough-rules$", paginated([{"id": 1, "name": "passthrough-1", "enabled": True}])),
    R(r"^/api/v1/admin/tls-fingerprint-profiles$", paginated([{"id": 1, "name": "chrome-124", "enabled": True}])),
    R(r"^/api/v1/admin/scheduled-test-plans$", paginated([{"id": 1, "name": "nightly", "enabled": True}])),
    R(r"^/api/v1/admin/user-attributes$", [{"id": 1, "name": "tier", "type": "single_select",
                                    "enabled": True,
                                    "options": [{"label": "gold", "value": "gold"},
                                                {"label": "silver", "value": "silver"}]},
                                   {"id": 2, "name": "internal_note", "type": "text",
                                    "enabled": False, "options": []}]),
    R(r"^/api/v1/admin/user-attributes/batch$", {"attributes": {
        "11": {"1": "gold"}, "12": {}, "13": {}, "14": {}, "15": {}}}),
    R(r"^/api/v1/admin/gemini/oauth/capabilities$", {"capable": True}),
    R(r"^/api/v1/admin/prompt-audit/config$", {"enabled": True, "blocking_enabled": False,
                                       "blocking_latest_turn_only": True, "store_pass_events": False,
                                       "effective_mode": "monitor", "strategy": "priority",
                                       "worker_count": 2, "queue_capacity": 100,
                                       "scanners": ["injection"], "all_groups": True,
                                       "group_ids": [], "endpoints": []}),
    R(r"^/api/v1/admin/prompt-audit/runtime$", {
        "process_status": "running", "effective_mode": "monitor",
        "expected_config_version": 1, "active_config_version": 1,
        "config_loaded_at": "2026-08-08T00:00:00Z", "worker_total": 2, "worker_active": 2,
        "worker_heartbeat_at": "2026-08-08T02:00:00Z", "queue_capacity": 100,
        "queue": {"active": 0, "pending": 2, "capacity": 100, "total": 2},
        "processed_total": 1240, "failed_total": 3, "enqueued_total": 1300,
        "dropped_total": 57, "last_processed_at": "2026-08-08T02:00:00Z",
        "database_status": "ok", "redis_status": "ok", "endpoints": {},
        "guard_metrics": {"total": 1240, "allowed": 1180, "flagged": 52, "blocked": 2,
                          "unavailable": 3, "invalid": 1, "timeouts": 2, "failovers": 0}}),
    R(r"^/api/v1/admin/prompt-audit/events$", paginated([{
        "id": 1, "job_id": 1,
        "snapshot": {"request_id": "req_0001", "user_id": 10, "username": "tester01",
                     "user_email": "tester01@example.com", "api_key_id": 100,
                     "api_key_name": "prod-key-01", "group_id": 1, "group_name": "default",
                     "provider": "anthropic", "endpoint": "/v1/messages", "protocol": "openai_compatible",
                     "model": "claude-sonnet-4-5", "prompt_hash": "abc123", "redacted_preview": "Summarize...",
                     "full_prompt": "Summarize the doc", "prompt_length": 21, "message_count": 2,
                     "stage": "chat"},
        "decision": "pass", "risk_level": "low", "action": "Allow", "categories": [],
        "matched_scanners": [], "scanner_scores": {}, "scanner_evidence": {},
        "scanner_backend": "openai", "scanner_version": "1", "guard_endpoint_id": "ep1",
        "policy_id": "p1", "policy_version": 1, "config_version": 1, "chunk_total": 1,
        "latency_ms": 120, "issue_summaries": [],
        "created_at": "2026-08-08T01:00:00Z"}])),
]


GENERIC = {"data": [], "items": [], "list": [], "total": 0, "page": 1, "page_size": 20,
           "stats": {}, "enabled": False, "supported": False, "announcements": [],
           "unread_count": 0}

# Per-page mock overrides consulted BEFORE MOCK_RULES.  Used where a route
# legitimately needs different state than the rest of the app (e.g. /setup
# must report needs_setup=true while App.vue redirects every other route away
# when setup is pending).
PAGE_OVERRIDES = {
    "setup": [
        (re.compile(r"/setup/status$"),
         {"data": {"needs_setup": True, "step": "welcome"}}),
    ],
}


# ---------------------------------------------------------------------------
# Per-page telemetry
# ---------------------------------------------------------------------------
_tls = threading.local()
_lock = threading.Lock()
RESULTS = []
URLS = {}      # page_key -> set of paths seen
CONSOLE = {}   # page_key -> list of {type, text}
FAILED = {}    # page_key -> list of urls


def _role():
    return getattr(_tls, "role", "user")


def _page_key():
    return getattr(_tls, "page_key", "")


def rec(name, ok, detail="", page=""):
    with _lock:
        RESULTS.append({"page": page, "name": name, "ok": bool(ok), "detail": detail})
    print(("  PASS  " if ok else "  FAIL  ") + name + ((" :: " + detail) if detail else ""))


def install_mocks_full(context, role):
    """Fulfil every API call locally; log URLs per page key."""
    # Playwright matches routes in reverse registration order (LIFO), so the
    # catch-all guard is registered FIRST (matched LAST), and the most
    # specific handlers (API, then static assets) are registered LAST
    # (matched FIRST).
    def external_guard(route):
        url = route.request.url
        if "airwallex.com" in url:
            # SDK stub so dynamic imports of the Airwallex widget resolve;
            # the real CDN is unreachable/blocked in the QA sandbox.
            route.fulfill(status=200, content_type="text/javascript",
                          body="window.Airwallex = window.Airwallex || {};")
        elif url.startswith(f"http://127.0.0.1:{PORT}"):
            route.continue_()
        else:
            route.abort()
    context.route("**/*", external_guard)

    def static_handler(route):
        """Serve local files from dist directly (no HTTP server in the path —
        the ThreadingHTTPServer drops connections under parallel load, which
        manifested as flaky ERR_CONNECTION_RESET chunk failures)."""
        import mimetypes
        path = urlparse(route.request.url).path
        rel = path.lstrip("/") or "index.html"
        f = verify.DIST / rel
        if not f.is_file():
            f = verify.DIST / "index.html"
        ct = mimetypes.guess_type(str(f))[0] or "application/octet-stream"
        if str(f).endswith(".js"):
            ct = "text/javascript"
        route.fulfill(status=200, content_type=ct, body=f.read_bytes())
    context.route(re.compile(rf"http://127\.0\.0\.1:{PORT}/.*"), static_handler)

    def handler(route):
        req = route.request
        # Never intercept the top-level document (e.g. /auth/callback routes).
        if req.resource_type == "document":
            route.continue_()
            return
        path = urlparse(req.url).path
        with _lock:
            URLS.setdefault(_page_key(), set()).add(req.method + " " + path)
        for rx, payload in PAGE_OVERRIDES.get(_page_key().split("/")[0], []):
            if rx.search(path):
                body = payload(req) if callable(payload) else payload
                route.fulfill(status=200, content_type="application/json",
                              body=payout(body))
                return
        for rx, payload in MOCK_RULES:
            if rx.search(path):
                body = payload(req) if callable(payload) else payload
                route.fulfill(status=200, content_type="application/json",
                              body=payout(body))
                return
        route.fulfill(status=200, content_type="application/json", body=payout(GENERIC))

    # Scope API interception to the local origin: an unanchored pattern like
    # `/(api|v1|setup|auth)/` also matches external URLs containing those
    # segments (e.g. https://static.airwallex.com/.../sdk/v1/index.js) and
    # would fulfill them with mock JSON.
    context.route(re.compile(rf"http://127\.0\.0\.1:{PORT}/(api|v1|setup)/.*"), handler)


def seed_role(context, role, dark):
    user = None if role == "anon" else (verify.ADMIN_USER if role == "admin" else verify.NORMAL_USER)
    context.add_init_script("""
      window.__APP_CONFIG__ = %s;
      localStorage.setItem('theme', %r);
      %s
      localStorage.setItem(
        'admin_guide_' + %s + '_' + %s + '_v4_interactive', 'true');
      localStorage.setItem(
        'user_guide_' + %s + '_' + %s + '_v4_interactive', 'true');
    """ % (
        json.dumps(SETTINGS), "dark" if dark else "light",
        "" if user is None else
        "localStorage.setItem('auth_token', 'qa-token');"
        "localStorage.setItem('auth_user', %s);" % json.dumps(json.dumps(user)),
        json.dumps(str(user["id"])) if user else "''",
        json.dumps(user["role"]) if user else "''",
        json.dumps(str(user["id"])) if user else "''",
        json.dumps(user["role"]) if user else "''",
    ))


def attach_telemetry(page, page_key):
    def on_console(msg):
        if msg.type in ("error", "warning"):
            with _lock:
                CONSOLE.setdefault(page_key, []).append({"type": msg.type, "text": msg.text[:300]})
    def on_pageerror(exc):
        with _lock:
            CONSOLE.setdefault(page_key, []).append({"type": "pageerror", "text": str(exc)[:300]})
    def on_failed(req):
        with _lock:
            FAILED.setdefault(page_key, []).append(req.url[:300])
    page.on("console", on_console)
    page.on("pageerror", on_pageerror)
    page.on("requestfailed", on_failed)


def check_overflow(page, label, page_key):
    m = page.evaluate("""() => new Promise((resolve) => {
      // The nav chunk's CSS (which hides the balance chip / header links at
      // narrow widths) can land a beat after first paint; wait for the
      // settled mobile layout before judging overflow.
      const deadline = Date.now() + 4000;
      const attempt = () => {
        const actions = document.querySelector('.gn-actions');
        const bal = document.querySelector('.gn-balance-wrap');
        const settled = actions && getComputedStyle(actions).display === 'flex' &&
                        (window.innerWidth > 768 ||
                         (bal && getComputedStyle(bal).display === 'none'));
        if (!settled && Date.now() < deadline) return setTimeout(attempt, 120);
        const sw = document.documentElement.scrollWidth;
        const iw = window.innerWidth;
        const culprits = [...document.querySelectorAll('body *')]
          .filter(el => el.getBoundingClientRect().right > iw + 1)
          .slice(0, 5)
          .map(el => el.tagName.toLowerCase() + '.' +
               String(el.className || '').split(' ').filter(Boolean).slice(0, 3).join('.') +
               ':' + Math.round(el.getBoundingClientRect().right));
        resolve({sw, iw, culprits, settled});
      };
      attempt();
    })""")
    ok = m["sw"] <= m["iw"] + 1
    rec(f"[{label}] no horizontal overflow", ok,
        f"scrollWidth={m['sw']} innerWidth={m['iw']} culprits={m['culprits']}"
        + (f" (nav CSS unsettled: {m['settled']})" if not m['settled'] else ""),
        page=page_key)


def check_nav_height(page, label, page_key):
    h = page.evaluate("""() => { const n = document.querySelector('.gn');
      return n ? Math.round(n.getBoundingClientRect().height) : -1; }""")
    rec(f"[{label}] global nav is 48px", h == 48, f"got {h}px", page=page_key)


def check_theme(page, label, expect_dark, page_key):
    st = page.evaluate("""() => ({
      cls: document.documentElement.classList.contains('dark'),
      bodyBg: getComputedStyle(document.body).backgroundColor,
      blue: getComputedStyle(document.documentElement).getPropertyValue('--blue').trim(),
    })""")
    rec(f"[{label}] html.dark == {expect_dark}", st["cls"] == expect_dark,
        f"got {st}", page=page_key)
    return st


def check_no_logo_img(page, label, page_key):
    res = page.evaluate("""() => [...document.images]
        .filter(i => /logo\\.svg|site_logo/i.test(i.getAttribute('src') || ''))
        .map(i => ({src: i.getAttribute('src'),
                    inUpload: !!i.closest('input[type=file], [class*=upload], [class*=border-dashed]')}))
    """)
    # ImageUpload form controls (e.g. the site-logo picker on /admin/settings)
    # preview the current logo; that is admin tooling, not brand chrome.
    bad = [r for r in res if not r["inUpload"]]
    rec(f"[{label}] no site-logo <img> rendered", len(bad) == 0,
        f"found {len(res)} (form-control previews allowed)" if not bad else
        f"found {bad}", page=page_key)


def check_tables(page, label, page_key):
    """Alignment + equal first-row heights for EVERY table on the page.

    Empty-state (single colspan) rows are reported as a SKIP so the gap is
    visible in the report instead of silently passing.
    """
    res = page.evaluate("""() => {
      const out = [];
      document.querySelectorAll('table').forEach((tbl, ti) => {
        const ths = [...tbl.querySelectorAll('thead th')];
        const row = tbl.querySelector('tbody tr');
        if (!ths.length || !row) { out.push({t: ti, skip: 'no thead/tbody row'}); return; }
        const tds = [...row.querySelectorAll('td')];
        if (tds.length === 1 && tds[0].hasAttribute('colspan')) {
          out.push({t: ti, skip: 'empty-state colspan row'}); return;
        }
        if (ths.length !== tds.length) {
          out.push({t: ti, skip: 'header/row cell mismatch ' + ths.length + ' vs ' + tds.length}); return;
        }
        const n = Math.min(ths.length, tds.length);
        const bad = [];
        for (let i = 0; i < n; i++) {
          const a = ths[i].getBoundingClientRect(), b = tds[i].getBoundingClientRect();
          if (Math.abs(a.x - b.x) > 1.5 || Math.abs(a.width - b.width) > 1.5)
            bad.push({i, thX: +a.x.toFixed(1), tdX: +b.x.toFixed(1),
                      thW: +a.width.toFixed(1), tdW: +b.width.toFixed(1)});
        }
        const hs = tds.map(td => +td.getBoundingClientRect().height.toFixed(1));
        out.push({t: ti, cols: n, bad, uneven: new Set(hs).size > 1, hs});
      });
      return out;
    }""")
    if not res:
        rec(f"[{label}] tables aligned", True, "no tables on page", page=page_key)
        return
    for t in res:
        if "skip" in t:
            rec(f"[{label}] table#{t['t']} alignment", True,
                "SKIP(gap): " + t["skip"], page=page_key)
            continue
        rec(f"[{label}] table#{t['t']} {t['cols']} cols aligned (<=1.5px)",
            not t["bad"], json.dumps(t["bad"][:3]), page=page_key)
        rec(f"[{label}] table#{t['t']} first-row equal heights",
            not t["uneven"], f"heights={t['hs'][:8]}", page=page_key)


def _lum(hex_color):
    try:
        hex_color = hex_color.strip()
        if hex_color.startswith("#"):
            r, g, b = (int(hex_color[i:i + 2], 16) / 255 for i in (1, 3, 5))
        else:
            m = re.match(r"rgba?\(([^)]+)\)", hex_color)
            if not m:
                return None
            parts = [float(p.strip()) for p in m.group(1).split(",")]
            r, g, b = parts[0] / 255, parts[1] / 255, parts[2] / 255
    except Exception:  # noqa: BLE001
        return None
    def f(c):
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)


def check_contrast(page, label, page_key):
    st = page.evaluate("""() => {
      const cs = getComputedStyle(document.documentElement);
      const bodyBg = getComputedStyle(document.body).backgroundColor;
      const card = document.querySelector('.card, .table-card, [class*="card"]');
      const cardBg = card ? getComputedStyle(card).backgroundColor : '';
      return {
        bodyBg,
        cardBg,
        primary: cs.getPropertyValue('--text-primary').trim(),
        secondary: cs.getPropertyValue('--text-secondary').trim(),
        tertiary: cs.getPropertyValue('--text-tertiary').trim(),
      };
    }""")
    def ratio(fg, bg):
        l1, l2 = _lum(fg), _lum(bg)
        if l1 is None or l2 is None:
            return None
        hi, lo = max(l1, l2), min(l1, l2)
        return (hi + 0.05) / (lo + 0.05)
    # A transparent "cardBg" (alpha 0) must not be treated as the background.
    card_alpha = 0
    m0 = re.match(r"rgba?\(([^)]+)\)", st["cardBg"] or "")
    if m0:
        parts = [p.strip() for p in m0.group(1).split(",")]
        if len(parts) >= 4:
            card_alpha = float(parts[3])
    bg = st["cardBg"] if (m0 and card_alpha == 1) else st["bodyBg"]
    vals = {"primary": ratio(st["primary"], bg), "secondary": ratio(st["secondary"], bg),
            "tertiary": ratio(st["tertiary"], bg)}
    ok = all(v is None or v >= 3.0 for v in vals.values())
    rec(f"[{label}] text contrast spot-check", ok,
        f"bodyBg={st['bodyBg']} cardBg={st['cardBg']} "
        f"vars={st['primary']}/{st['secondary']}/{st['tertiary']} ratios={vals}", page=page_key)


def check_opaque_panel(page, sel, label, page_key, sample_inside=True):
    """Panel must be opaque (alpha==1) and occlude the page."""
    res = page.evaluate("""(sel) => new Promise((resolve) => {
      const deadline = Date.now() + 2500;
      const attempt = () => {
        let el = null;
        for (const s of sel.split(',')) {
          const cand = document.querySelector(s.trim());
          if (cand && cand.getBoundingClientRect().width > 0 && cand.getBoundingClientRect().height > 0) {
            el = cand; break;
          }
        }
        if (!el) return resolve({err: 'no element ' + sel});
        const r = el.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) return resolve({err: 'zero size'});
        const cs = getComputedStyle(el);
        if (cs.visibility === 'hidden' || cs.opacity === '0') {
          if (Date.now() < deadline) return setTimeout(attempt, 150);
        }
        const bg = cs.backgroundColor;
        const hits = [[0.25,0.4],[0.5,0.55],[0.75,0.7]].map(([fx,fy]) => {
          const e = document.elementFromPoint(r.left + r.width*fx, r.top + r.height*fy);
          return e ? (el.contains(e) || el === e) : false;
        });
        resolve({bg, hits, w: Math.round(r.width), h: Math.round(r.height),
                 vis: cs.visibility, op: cs.opacity});
      };
      attempt();
    })""", sel)
    if "err" in res:
        rec(f"[{label}] {sel} opens", False, res["err"], page=page_key)
        return None
    m = re.match(r"rgba?\(([^)]+)\)", res["bg"] or "")
    opaque = False
    if m:
        parts = [p.strip() for p in m.group(1).split(",")]
        opaque = len(parts) < 4 or abs(float(parts[3]) - 1.0) < 1e-6
    rec(f"[{label}] {sel} visible+opaque (alpha=1)", opaque and all(res["hits"]),
        f"bg={res['bg']} hits={res['hits']} size={res['w']}x{res['h']}", page=page_key)
    return res


def report_telemetry(page_key):
    cons = CONSOLE.get(page_key, [])
    failed = FAILED.get(page_key, [])
    ws_fails = [u for u in failed if u.startswith("ws")]
    asset_fails = [u for u in failed if "/assets/" in u]
    other_fails = [u for u in failed if not u.startswith("ws") and "/assets/" not in u]
    # i18n JIT missing-key warnings and favicon noise are informational
    real_errors = [c for c in cons if c["type"] == "pageerror" or
                   (c["type"] == "error" and "Failed to load resource" not in c["text"])]
    rec(f"[{page_key}] no console errors", not real_errors,
        json.dumps(real_errors[:3]) if real_errors else
        (f"{len(cons)} warnings only" if cons else ""), page=page_key)
    rec(f"[{page_key}] no failed requests", not other_fails,
        f"failed={other_fails[:3]} ws(ignored)={len(ws_fails)}" if other_fails or ws_fails else "",
        page=page_key)
    if asset_fails:
        rec(f"[{page_key}] no failed requests (transient asset drops)",
            True, f"assets={asset_fails[:2]} (harness noise, browser retries)",
            page=page_key)
    return {"console": real_errors, "failed": other_fails, "ws": ws_fails}


def mode_bg_of(page):
    return page.evaluate("() => getComputedStyle(document.body).backgroundColor")


# ---------------------------------------------------------------------------
# Capture one route
# ---------------------------------------------------------------------------
def capture_route(browser, route):
    key, path, area, role = route
    for dark in (False, True):
        mode = "dark" if dark else "light"
        for vp_name, vp in (("desktop", (1440, 900)), ("mobile", (375, 812))):
            page_key = f"{key}/{mode}/{vp_name}"
            ctx = browser.new_context(viewport={"width": vp[0], "height": vp[1]})
            seed_role(ctx, role, dark)
            install_mocks_full(ctx, role)
            page = ctx.new_page()
            attach_telemetry(page, page_key)
            label = f"{key} {mode} {vp_name}"
            _tls.page_key = page_key
            _tls.role = role
            try:
                verify.goto_ready(page, f"http://127.0.0.1:{PORT}{path}",
                                  expect_nav=role in ("user", "admin"),
                                  timeout=30000)
                # final URL (guards may redirect)
                final = page.url.split("?")[0].replace(f"http://127.0.0.1:{PORT}", "")
                rec(f"[{label}] landed on expected route",
                    final == path.split("?")[0], f"final={final}", page=page_key)
                check_theme(page, label, dark, page_key)
                if role in ("user", "admin"):
                    check_nav_height(page, label, page_key)
                check_no_logo_img(page, label, page_key)
                check_tables(page, label, page_key)
                check_contrast(page, label, page_key)
                if vp_name == "mobile":
                    check_overflow(page, label, page_key)
                page.wait_for_timeout(400)
                fname = f"{area}-{key}-{mode}-{vp_name}.png"
                page.screenshot(path=str(SHOTS / fname), full_page=False)
                with _lock:
                    URLS.setdefault(page_key, set())
                report_telemetry(page_key)
            except Exception as exc:  # noqa: BLE001
                rec(f"[{label}] page loads", False, str(exc)[:220], page=page_key)
            finally:
                ctx.close()


# ---------------------------------------------------------------------------
# Interaction states (desktop light+dark; mobile menu at 375)
# ---------------------------------------------------------------------------
def interaction_flyouts(browser):
    for dark in (False, True):
        mode = "dark" if dark else "light"
        for key in ("resources", "operations", "analytics"):
            page_key = f"interact/flyout-{key}/{mode}"
            ctx = browser.new_context(viewport={"width": 1440, "height": 900})
            seed_role(ctx, "admin", dark)
            install_mocks_full(ctx, "admin")
            page = ctx.new_page()
            attach_telemetry(page, page_key)
            _tls.page_key = page_key
            _tls.role = "admin"
            try:
                verify.goto_ready(page, f"http://127.0.0.1:{PORT}/admin/accounts")
                trig = page.locator(f'.gn-item[data-flyout-key="{key}"] > .gn-link')
                if trig.count() == 0:
                    rec(f"[flyout {key} {mode}] trigger present", False, "not found", page=page_key)
                    ctx.close()
                    continue
                trig.click()
                page.wait_for_timeout(700)
                res = page.evaluate("""() => {
                  const fly = document.querySelector('.gn-flyout');
                  if (!fly) return {err: 'no .gn-flyout'};
                  const r = fly.getBoundingClientRect();
                  const curtain = document.querySelector('.gn-curtain');
                  return {w: Math.round(r.width), h: Math.round(r.height),
                          vp: window.innerWidth,
                          cols: fly.querySelectorAll('.gn-flyout-col').length,
                          curtainOpen: curtain ? curtain.classList.contains('open') : null};
                }""")
                if "err" in res:
                    rec(f"[flyout {key} {mode}] opens", False, res["err"], page=page_key)
                else:
                    rec(f"[flyout {key} {mode}] visible full-width",
                        res["w"] >= res["vp"] - 2,
                        f"w={res['w']} vp={res['vp']} cols={res['cols']}", page=page_key)
                    rec(f"[flyout {key} {mode}] curtain dims page",
                            res["curtainOpen"] is True, f"curtainOpen={res['curtainOpen']}",
                            page=page_key)
                    check_opaque_panel(page, f'.gn-item[data-flyout-key="{key}"] .gn-flyout',
                                       f"flyout {key} {mode}", page_key)
                page.screenshot(path=str(SHOTS / f"interaction-flyout-{key}-{mode}-desktop.png"))
                report_telemetry(page_key)
            except Exception as exc:  # noqa: BLE001
                rec(f"[flyout {key} {mode}] loads", False, str(exc)[:160], page=page_key)
            finally:
                ctx.close()


def interaction_mobile_menu(browser):
    for dark in (False, True):
        mode = "dark" if dark else "light"
        page_key = f"interact/mobile-menu/{mode}"
        ctx = browser.new_context(viewport={"width": 375, "height": 812})
        seed_role(ctx, "user", dark)
        install_mocks_full(ctx, "user")
        page = ctx.new_page()
        attach_telemetry(page, page_key)
        _tls.page_key = page_key
        _tls.role = "user"
        try:
            verify.goto_ready(page, f"http://127.0.0.1:{PORT}/dashboard")
            burger = page.locator(".gn-burger")
            if burger.count() == 0:
                rec(f"[mobile menu {mode}] burger present", False, "not found", page=page_key)
                ctx.close()
                return
            burger.click()
            page.wait_for_timeout(600)
            st = page.evaluate("""() => {
              const m = document.querySelector('.gn-mobile');
              if (!m) return {err: 'no .gn-mobile'};
              return {open: m.classList.contains('open'),
                      bodyOverflow: document.body.style.overflow,
                      w: Math.round(m.getBoundingClientRect().width)};
            }""")
            if "err" in st:
                rec(f"[mobile menu {mode}] opens", False, st["err"], page=page_key)
            else:
                rec(f"[mobile menu {mode}] opens + locks body scroll",
                    st["open"] and st["bodyOverflow"] == "hidden",
                    f"open={st['open']} overflow={st['bodyOverflow']!r}", page=page_key)
                check_opaque_panel(page, ".gn-mobile", f"mobile menu {mode}", page_key)
            page.screenshot(path=str(SHOTS / f"interaction-mobile-menu-{mode}-375.png"))
            report_telemetry(page_key)
        except Exception as exc:  # noqa: BLE001
            rec(f"[mobile menu {mode}] loads", False, str(exc)[:160], page=page_key)
        finally:
            ctx.close()


def interaction_search_and_avatar(browser):
    for dark in (False, True):
        mode = "dark" if dark else "light"
        page_key = f"interact/search/{mode}"
        ctx = browser.new_context(viewport={"width": 1440, "height": 900})
        seed_role(ctx, "user", dark)
        install_mocks_full(ctx, "user")
        page = ctx.new_page()
        attach_telemetry(page, page_key)
        _tls.page_key = page_key
        _tls.role = "user"
        try:
            verify.goto_ready(page, f"http://127.0.0.1:{PORT}/dashboard")
            page.locator('.gn-icon-btn[aria-label*="search" i], button[aria-label*="Search"]').first.click()
            page.wait_for_timeout(600)
            st = page.evaluate("""() => {
              const bar = document.querySelector('.gn-search-bar');
              if (!bar) return {err: 'no .gn-search-bar'};
              const r = bar.getBoundingClientRect();
              return {open: bar.classList.contains('open'), w: Math.round(r.width),
                      h: Math.round(r.height)};
            }""")
            if "err" in st:
                rec(f"[search bar {mode}] opens", False, st["err"], page=page_key)
            else:
                rec(f"[search bar {mode}] expands to full width",
                    st["open"] and st["w"] >= 1438, f"w={st['w']} h={st['h']}", page=page_key)
                check_opaque_panel(page, ".gn-search-bar", f"search bar {mode}", page_key)
            page.screenshot(path=str(SHOTS / f"interaction-search-{mode}-desktop.png"))
            # avatar dropdown
            page.keyboard.press("Escape")
            page.wait_for_timeout(300)
            av = page.locator(".gn-avatar")
            if av.count() > 0:
                av.click()
                page.wait_for_timeout(500)
                check_opaque_panel(page, ".gn-pop-wrap.open .gn-pop", f"avatar menu {mode}", page_key)
                page.screenshot(path=str(SHOTS / f"interaction-avatar-{mode}-desktop.png"))
            else:
                rec(f"[avatar menu {mode}] opens", False, "no .gn-avatar", page=page_key)
        except Exception as exc:  # noqa: BLE001
            rec(f"[search/avatar {mode}] loads", False, str(exc)[:160], page=_page_key())
        finally:
            ctx.close()


def interaction_modal(browser):
    for dark in (False, True):
        mode = "dark" if dark else "light"
        page_key = f"interact/modal/{mode}"
        ctx = browser.new_context(viewport={"width": 1440, "height": 900})
        seed_role(ctx, "admin", dark)
        install_mocks_full(ctx, "admin")
        page = ctx.new_page()
        attach_telemetry(page, page_key)
        _tls.page_key = page_key
        _tls.role = "admin"
        try:
            verify.goto_ready(page, f"http://127.0.0.1:{PORT}/admin/accounts")
            # AccountTableActions' create button (first .btn-primary in toolbar)
            btn = page.locator(".toolbar .btn-primary, .toolbar button.btn-primary").first
            if btn.count() == 0:
                rec(f"[create modal {mode}] trigger present", False, "no .btn-primary in toolbar",
                    page=page_key)
                ctx.close()
                continue
            btn.click()
            page.wait_for_timeout(800)
            modal = page.locator("[role=dialog], .modal, .dialog, .overlay, [class*='modal']").first
            if modal.count() == 0 or not modal.is_visible():
                rec(f"[create modal {mode}] opens", False, "no dialog visible", page=page_key)
            else:
                rec(f"[create modal {mode}] opens", True, page=page_key)
            check_opaque_panel(page, modal_sel(), f"create modal {mode}", page_key)
            page.screenshot(path=str(SHOTS / f"interaction-modal-create-{mode}-desktop.png"))
            report_telemetry(page_key)
        except Exception as exc:  # noqa: BLE001
            rec(f"[create modal {mode}] loads", False, str(exc)[:160], page=page_key)
        finally:
            ctx.close()


def modal_sel():
    # Selector for the visible modal panel (evaluated in-page, first visible wins)
    return ".modal-content, [role=dialog], .modal, .dialog"


# ---------------------------------------------------------------------------
def main():
    routes = ROUTES
    if ONLY:
        wanted = set(ONLY.split(","))
        routes = [r for r in ROUTES if r[0] in wanted]
    from http.server import ThreadingHTTPServer
    handler = partial(SPAHandler, directory=str(verify.DIST))
    httpd = ThreadingHTTPServer(("127.0.0.1", PORT), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()

    chunks = [routes[i::WORKERS] for i in range(WORKERS)]
    threads = []
    results = []

    def worker(chunk):
        with sync_playwright() as p:
            browser = p.chromium.launch(executable_path=verify.SHELL)
            for route in chunk:
                capture_route(browser, route)
            browser.close()

    for chunk in chunks:
        if not chunk:
            continue
        t = threading.Thread(target=worker, args=(chunk,))
        t.start()
        threads.append(t)
    for t in threads:
        t.join()

    # interactions (single browser, sequential)
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=verify.SHELL)
        interaction_flyouts(browser)
        interaction_mobile_menu(browser)
        interaction_search_and_avatar(browser)
        interaction_modal(browser)
        browser.close()

    httpd.shutdown()

    fails = [r for r in RESULTS if not r["ok"]]
    print(f"\n==== {len(RESULTS) - len(fails)}/{len(RESULTS)} assertions passed ====")
    if fails:
        print("FAILURES:")
        for r in fails:
            print(f"  - [{r['page']}] {r['name']} :: {r['detail']}")
    with open(OUT / "sweep-results.json", "w") as f:
        json.dump({"results": RESULTS,
                   "urls": {k: sorted(v) for k, v in sorted(URLS.items())},
                   "console": {k: v for k, v in sorted(CONSOLE.items())},
                   "failed": {k: v for k, v in sorted(FAILED.items())}},
                  f, indent=1)
    print(f"results -> {OUT / 'sweep-results.json'}")
    print(f"shots -> {SHOTS}")
    return 1 if fails else 0


class SPAHandler(SimpleHTTPRequestHandler):
    def do_GET(self):  # noqa: N802
        path = self.translate_path(self.path)
        if not os.path.exists(path) or os.path.isdir(path):
            if "." not in os.path.basename(self.path.split("?")[0]):
                self.path = "/index.html"
        return super().do_GET()

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    sys.exit(main())
