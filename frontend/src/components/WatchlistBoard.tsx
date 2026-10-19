import { useEffect, useState } from 'react'
import { dashboardApi, type DashboardWatchStock, type DashboardQuoteResponse, type DashboardMarketStatus } from '@panwatch/api'
import { Button } from '@panwatch/base-ui/components/ui/button'
import { marketSignTextClass } from '@/lib/market-colors'

export const phaseLabel = (status?: string) => ({ pre_market: '盘前计划', trading: '盘中监测', break: '午间休市 · 盘中监测', after_hours: '盘后复盘', closed: '休市', unknown: '交易日历待确认' }[status || 'unknown'] || '状态待确认')

export default function WatchlistBoard({ onOpen }: { onOpen: (symbol: string, market: string, name: string) => void }) {
  const [stocks, setStocks] = useState<DashboardWatchStock[]>([])
  const [quotes, setQuotes] = useState<DashboardQuoteResponse[]>([])
  const [markets, setMarkets] = useState<DashboardMarketStatus[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let alive = true
    let busy = false
    const load = async () => {
      if (busy) return
      busy = true
      try {
        const rows = await dashboardApi.watchlist()
        if (!alive) return
        setStocks(rows); setError('')
        const [q, m] = await Promise.allSettled([dashboardApi.batchQuotes(rows), dashboardApi.marketStatus()])
        if (!alive) return
        setQuotes(q.status === 'fulfilled' ? q.value : [])
        setMarkets(m.status === 'fulfilled' ? m.value : [])
      } catch { if (alive) setError('关注列表加载失败，请刷新重试') }
      finally { busy = false; if (alive) setLoading(false) }
    }
    void load()
    const timer = window.setInterval(load, 60000)
    return () => { alive = false; window.clearInterval(timer) }
  }, [])
  return <section className="card p-4 mb-4" aria-label="我的关注">
    <div className="flex items-center justify-between mb-3"><h2 className="font-semibold">我的关注 · {stocks.length}</h2><span className="text-xs text-muted-foreground">按市场时段切换 · 每分钟刷新</span></div>
    {error && <p role="alert">{error}</p>}
    {loading && !stocks.length && <p>正在加载关注列表…</p>}
    {!loading && !stocks.length && !error && <p>暂无关注股票，请在持仓页添加股票。</p>}
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {stocks.map(s => {
        const q = quotes.find(q => q.symbol === s.symbol && q.market === s.market)
        const status = markets.find(m => m.code === s.market)
        return <Button key={`${s.market}:${s.symbol}`} variant="outline" className="h-auto p-3 block text-left whitespace-normal" onClick={() => onOpen(s.symbol, s.market, s.name)}>
          <div className="flex justify-between gap-2"><strong>{s.name}</strong><span className="text-xs text-muted-foreground">{s.market} · {s.symbol}</span></div>
          <div className={`mt-2 font-mono ${marketSignTextClass(q?.change_pct)}`}>{q?.current_price?.toFixed(2) ?? '--'}　{q?.change_pct != null ? `${q.change_pct > 0 ? '+' : ''}${q.change_pct.toFixed(2)}%` : '行情暂无数据'}</div>
          <div className="mt-2 text-xs text-muted-foreground">{phaseLabel(status?.status)} · 点击查看当日走势与建议</div>
        </Button>
      })}
    </div>
  </section>
}
