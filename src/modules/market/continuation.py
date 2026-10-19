"""Explainable limit-up watch pool, not an execution signal or win probability."""
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from threading import Lock
import math
import re
import time

from src.platform.marketdata.collectors.market_http import market_get
from src.platform.scheduling.trading_calendar import calendar_known, is_trading_day

_cache = {}
_lock = Lock()


def session_dates(now):
    now = now.astimezone(ZoneInfo('Asia/Shanghai'))
    day = now.date()
    if not calendar_known('CN', day):
        return None, None
    # At the close use today's pool to prepare the next session.
    base = day if is_trading_day('CN', day) and (now.hour, now.minute) >= (15, 0) else day - timedelta(days=1)
    for _ in range(30):
        if not calendar_known('CN', base):
            return None, None
        if is_trading_day('CN', base):
            break
        base -= timedelta(days=1)
    else:
        return None, None
    target = base + timedelta(days=1)
    for _ in range(30):
        if not calendar_known('CN', target):
            return base, None
        if is_trading_day('CN', target):
            return base, target
        target += timedelta(days=1)
    return base, None


def load_pool(day):
    key = day.isoformat()
    with _lock:
        cached = _cache.get(key)
        if cached and time.monotonic() - cached[0] < 60:
            return cached[1]
        payload = market_get('https://push2ex.eastmoney.com/getTopicZTPool', host_key='eastmoney',
            params={'ut': '7eea3edcaed734bea9cbfc24409ed989', 'dpt': 'wz.ztzt', 'Pageindex': '0',
                    'pagesize': '10000', 'sort': 'fbt:asc', 'date': day.strftime('%Y%m%d')},
            parse='json', timeout=5, total_timeout=8, retries=0)
        data = payload.get('data') if isinstance(payload, dict) else None
        valid = (isinstance(data, dict) and str(data.get('qdate')) == day.strftime('%Y%m%d')
                 and isinstance(data.get('pool'), list))
        result = {'rows': data['pool'] if valid else None, 'fetched_at': datetime.now(ZoneInfo('Asia/Shanghai')).isoformat()}
        if len(_cache) > 10:
            _cache.clear()
        _cache[key] = (time.monotonic(), result)
        return result


def number(row, key):
    try:
        value = float(row[key])
        return value if math.isfinite(value) and value >= 0 else None
    except (KeyError, TypeError, ValueError):
        return None


def normalize(row, current=None):
    symbol, name = str(row.get('c', '')), str(row.get('n', ''))
    if not re.fullmatch(r'\d{6}', symbol) or not name or 'ST' in name.upper() or '退' in name:
        return None
    count, breaks = number(row, 'lbc'), number(row, 'zbc')
    if count is None or count < 1:
        return None
    state = '待目标交易日确认'
    if current is not None:
        live = current.get(symbol)
        state = '未在当前涨停池 · 未封板或状态待确认' if live is None else ('回封观察 · 有开板记录' if (number(live, 'zbc') or 0) > 0 else '当前涨停池内 · 一字/换手待盘口确认')
    risks = ['一字封单不代表能成交；开板后需重新确认承接', '次日低开、炸板与跌停均可能造成隔夜损失']
    if count >= 3:
        risks.append('已达三连板及以上，注意高位分歧')
    if breaks is not None and breaks > 0:
        risks.append(f'基准日开板 {int(breaks)} 次，封板稳定性需复核')
    return dict(symbol=symbol, name=name, industry=row.get('hybk') or '行业未知', boards=int(count),
                price=number(row, 'p') / 1000 if number(row, 'p') is not None else None,
                turnover=number(row, 'hs'), breaks=breaks, first_seal=str(row.get('fbt', '')).zfill(6),
                seal_funds=number(row, 'fund'), state=state, risks=risks)


def continuation_watch(now=None):
    now = (now or datetime.now(ZoneInfo('Asia/Shanghai'))).astimezone(ZoneInfo('Asia/Shanghai'))
    base, target = session_dates(now)
    result = dict(base_date=base.isoformat() if base else None, target_date=target.isoformat() if target else None,
                  source='东方财富涨停股池', items=[], availability='unavailable', fetched_at=None, live_available=False)
    if not base or not target:
        return {**result, 'message': '交易日历未确认，暂不生成候选。'}
    pool = load_pool(base)
    result['fetched_at'] = pool['fetched_at']
    if pool['rows'] is None:
        return {**result, 'message': '基准日涨停池暂不可用，未用其他日期或模拟数据替代。'}
    current = None
    if now.astimezone(ZoneInfo('Asia/Shanghai')).date() == target and (now.hour, now.minute) >= (9, 30):
        live = load_pool(target)
        if live['rows'] is not None:
            current = {str(row.get('c')): row for row in live['rows'] if isinstance(row, dict)}
            result['live_available'] = True
            result['live_fetched_at'] = live['fetched_at']
    items = [item for row in pool['rows'] if isinstance(row, dict) and (item := normalize(row, current))]
    items.sort(key=lambda item: (-item['boards'], item['first_seal'], item['symbol']))
    return {**result, 'availability': 'ready', 'items': items,
            'message': '按连板数降序、首次封板时间升序排列；不是胜率排名。已排除名称含 ST 或退的股票。'}
