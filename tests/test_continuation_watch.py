import unittest
from datetime import datetime
from zoneinfo import ZoneInfo
from unittest.mock import patch
from src.modules.market.continuation import session_dates, normalize, continuation_watch, load_pool, _cache

class ContinuationTests(unittest.TestCase):
    def dt(self, value):
        return datetime.fromisoformat(value).replace(tzinfo=ZoneInfo('Asia/Shanghai'))

    def test_dates_skip_weekend_and_switch_at_close(self):
        for stamp, expected in [('2026-10-19T09:20', ('2026-10-16', '2026-10-19')), ('2026-10-19T15:00', ('2026-10-19', '2026-10-20')), ('2026-10-18T12:00', ('2026-10-16', '2026-10-19'))]:
            self.assertEqual(tuple(d.isoformat() for d in session_dates(self.dt(stamp))), expected)

    def test_unknown_calendar(self):
        self.assertEqual(session_dates(self.dt('2099-10-19T12:00')), (None, None))

    def test_states_do_not_invent_one_price_or_broken_board(self):
        row = dict(c='600001', n='测试', lbc=2, zbc=0)
        self.assertIn('待盘口确认', normalize(row, {'600001': row})['state'])
        self.assertIn('状态待确认', normalize(row, {})['state'])
        self.assertIn('回封观察', normalize(row, {'600001': {**row, 'zbc': 2}})['state'])
        self.assertIsNone(normalize({**row, 'n': '*ST测试'}))

    def test_wrong_source_date_is_rejected(self):
        _cache.clear()
        with patch('src.modules.market.continuation.market_get', return_value={'data': {'qdate': 20261016, 'pool': []}}):
            self.assertIsNone(load_pool(self.dt('2026-10-19T16:00').date())['rows'])
        _cache.clear()

    def test_outage_not_empty_success(self):
        with patch('src.modules.market.continuation.load_pool', return_value={'rows': None, 'fetched_at': 'now'}):
            result = continuation_watch(self.dt('2026-10-19T16:00'))
            self.assertEqual(result['availability'], 'unavailable')
            self.assertEqual(result['items'], [])

if __name__ == '__main__':
    unittest.main()
