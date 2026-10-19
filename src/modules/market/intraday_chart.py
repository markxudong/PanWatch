"""Read-only A-share intraday chart; never substitute daily bars for minutes."""
from datetime import datetime
from zoneinfo import ZoneInfo
import json
import math
import re
import time

_CACHE = {}
from src.platform.marketdata.collectors.market_http import market_get
from src.platform.scheduling.trading_calendar import market_status


def parse_minute_bars(rows, today):
    result = {}
    for row in rows or []:
        try:
            parts = row.split(',')
            stamp = datetime.strptime(parts[0], '%Y-%m-%d %H:%M')
            if stamp.date().isoformat() != today:
                continue
            values = [float(x) for x in parts[1:6]]
            if not all(math.isfinite(x) for x in values) or min(values[:4]) <= 0:
                continue
            result[parts[0]] = dict(time=parts[0], open=values[0], close=values[1], high=values[2], low=values[3], volume=values[4])
        except (ValueError, TypeError, IndexError):
            continue
    return [result[key] for key in sorted(result)]


def intraday_chart(symbol, market='CN'):
    zone = {'CN': 'Asia/Shanghai', 'HK': 'Asia/Hong_Kong', 'US': 'America/New_York'}.get(market, 'UTC')
    now = datetime.now(ZoneInfo(zone))
    today = now.date().isoformat()
    status = market_status(market, now)
    phase = {'pre_market': 'premarket_outlook', 'trading': 'intraday_monitor', 'break': 'intraday_monitor', 'after_hours': 'daily_report'}.get(status)
    result = dict(symbol=symbol, market=market, date=today, status=status, phase=phase, bars=[], source='东方财富', interval='5min', fetched_at=now.isoformat())
    if market != 'CN' or not re.fullmatch(r'\d{6}', symbol):
        return {**result, 'availability': 'unsupported'}
    key = (symbol, today)
    cached = _CACHE.get(key)
    if cached and time.monotonic() - cached[0] < 45:
        return {**result, 'bars': cached[1], 'source': cached[2], 'availability': 'ready'}
    payload = market_get('https://push2his.eastmoney.com/api/qt/stock/kline/get', host_key='eastmoney',
        params={'fields1': 'f1,f2,f3,f4,f5,f6', 'fields2': 'f51,f52,f53,f54,f55,f56', 'klt': '5', 'fqt': '0',
                'secid': f'{1 if symbol.startswith("6") else 0}.{symbol}', 'beg': today.replace('-', ''), 'end': today.replace('-', ''), 'lmt': '320'},
        parse='json', timeout=5, total_timeout=8, retries=1)
    rows = ((payload or {}).get('data') or {}).get('klines') or []
    bars = parse_minute_bars(rows, today)
    if not bars:
        prefix = 'sh' if symbol.startswith('6') else ('bj' if symbol.startswith(('4', '8', '9')) else 'sz')
        text = market_get('https://quotes.sina.cn/cn/api/jsonp_v2.php/=/CN_MarketDataService.getKLineData', host_key='sina',
            params={'symbol': prefix + symbol, 'scale': '5', 'ma': 'no', 'datalen': '240'}, parse='text', timeout=5, total_timeout=8, retries=0)
        try:
            items = json.loads(text.split('=(', 1)[1].rsplit(');', 1)[0]) if text else []
            rows = [','.join([str(r['day'])[:16], str(r['open']), str(r['close']), str(r['high']), str(r['low']), str(r['volume'])]) for r in items]
            bars = parse_minute_bars(rows, today)
            if bars:
                result['source'] = '新浪财经'
        except (ValueError, TypeError, KeyError, IndexError):
            pass
    if bars:
        if len(_CACHE) > 512:
            _CACHE.clear()
        _CACHE[key] = (time.monotonic(), bars, result['source'])
    return {**result, 'bars': bars, 'availability': 'ready' if bars else 'unavailable'}
