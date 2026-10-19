import unittest
from unittest.mock import patch
from datetime import datetime
from zoneinfo import ZoneInfo
from src.modules.market.intraday_chart import parse_minute_bars, intraday_chart
from src.platform.scheduling.trading_calendar import market_status

class IntradayChartTest(unittest.TestCase):
    def setUp(self):
        from src.modules.market.intraday_chart import _CACHE
        _CACHE.clear()

    @patch('src.modules.market.intraday_chart.market_get')
    def test_sina_fallback_and_cache(self, get):
        import json
        today = datetime.now(ZoneInfo('Asia/Shanghai')).date().isoformat()
        data = [{'day': today + ' 09:35:00', 'open': '10', 'close': '11', 'high': '12', 'low': '9', 'volume': '100'}]
        get.side_effect = [None, '=(' + json.dumps(data) + ');']
        first = intraday_chart('601952')
        second = intraday_chart('601952')
        self.assertEqual(first['source'], '新浪财经')
        self.assertEqual(len(first['bars']), 1)
        self.assertEqual(second['source'], '新浪财经')
        self.assertEqual(get.call_count, 2)

    def test_only_today_valid_sorted_unique_bars(self):
        rows = ['2026-10-16 15:00,10,11,12,9,100', '2026-10-19 09:40,10,11,12,9,100', 'bad', '2026-10-19 09:35,10,nan,12,9,100', '2026-10-19 09:40,10,11,12,9,100']
        bars = parse_minute_bars(rows, '2026-10-19')
        self.assertEqual(len(bars), 1)
        self.assertEqual(bars[0]['time'], '2026-10-19 09:40')
    @patch('src.modules.market.intraday_chart.market_get', return_value=None)
    def test_missing_source_never_invents_bars(self, get):
        result = intraday_chart('601952')
        self.assertEqual(result['bars'], [])
        self.assertEqual(result['availability'], 'unavailable')
    @patch('src.modules.market.intraday_chart.market_get')
    def test_unsupported_market_does_not_request_china_data(self, get):
        self.assertEqual(intraday_chart('AAPL', 'US')['availability'], 'unsupported')
        get.assert_not_called()
    def test_calendar_sessions(self):
        for stamp, expected in [('2026-10-19T09:00','pre_market'),('2026-10-19T10:00','trading'),('2026-10-19T12:00','break'),('2026-10-19T16:00','after_hours'),('2026-10-18T10:00','closed')]:
            self.assertEqual(market_status('CN', datetime.fromisoformat(stamp).replace(tzinfo=ZoneInfo('Asia/Shanghai'))), expected)

if __name__ == '__main__': unittest.main()
