import IntradayCandles from './IntradayCandles'
import { stockReportContent } from '@/lib/stock-report'
import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { fetchAPI, insightApi } from '@panwatch/api'
import { Button } from '@panwatch/base-ui/components/ui/button'
import { phaseLabel } from './WatchlistBoard'

type Phase = 'premarket_outlook' | 'intraday_monitor' | 'daily_report'
type Bar = { time: string; open: number; close: number; high: number; low: number; volume: number }
type Session = { date: string; status: string; phase: Phase | null; bars: Bar[]; availability: string; source: string }
type Report = { stock_symbol?: string; id: number; agent_name: string; analysis_date: string; content: string; created_at: string; suggestions?: Record<string, any> }
const phases: { key: Phase; label: string }[] = [{ key: 'premarket_outlook', label: '盘前' }, { key: 'intraday_monitor', label: '盘中' }, { key: 'daily_report', label: '盘后' }]

export default function TradingDayPanel({ symbol, market }: { symbol: string; market: string }) {
  const [session, setSession] = useState<Session | null>(null)
  const [reports, setReports] = useState<Report[]>([])
  const [selected, setSelected] = useState<Phase>('daily_report')
  const [automatic, setAutomatic] = useState(true)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const automaticRef = useRef(automatic)
  automaticRef.current = automatic
  useEffect(() => {
    let alive = true
    let busy = false
    setSession(null); setReports([]); setLoading(true); setAutomatic(true)
    const load = async () => {
      if (busy) return
      busy = true
      try {
        const [day, history] = await Promise.all([
          fetchAPI<Session>(`/klines/${encodeURIComponent(symbol)}/intraday?market=${encodeURIComponent(market)}`),
          Promise.all(phases.map(async p => {
            const direct = await insightApi.history<Report[]>({ agent_name: p.key, stock_symbol: symbol, limit: 5 })
            const global = await insightApi.history<Report[]>({ agent_name: p.key, stock_symbol: '*', limit: 20 })
            return [...direct, ...global.filter(r => Object.prototype.hasOwnProperty.call(r.suggestions || {}, symbol))]
          })),
        ])
        if (!alive) return
        setSession(day); setReports(history.flat()); setError('')
        if (automaticRef.current && day.phase) setSelected(day.phase)
      } catch { if (alive) { setError('当日走势或报告加载失败，请稍后重试'); setSession(null); setReports([]) } }
      finally { busy = false; if (alive) setLoading(false) }
    }
    void load()
    const timer = window.setInterval(load, 60000)
    return () => { alive = false; window.clearInterval(timer) }
  }, [symbol, market])
  const report = reports.filter(r => r.agent_name === selected && r.analysis_date === session?.date).sort((a,b) => b.created_at.localeCompare(a.created_at))[0]
  const bars = session?.bars || []
  return <section className="card p-4 mb-4 space-y-3" aria-label="当日交易计划">
    <div className="flex flex-wrap justify-between gap-2"><h3 className="font-semibold">当日走势与交易计划</h3><span className="text-xs text-muted-foreground">{session?.date} · {phaseLabel(session?.status)}</span></div>
    {loading && <p>正在加载当天行情与报告…</p>}
    {error && <p role="alert">{error}</p>}
    {bars.length > 0 ? <div>
      <div className="flex justify-between text-xs text-muted-foreground"><span>当日 5 分钟 K 线 · {session?.source} · 未复权</span><span>数据截至 {bars[bars.length - 1].time}</span></div>
      <IntradayCandles bars={bars} label={`${symbol} ${session?.date} 当日5分钟K线`} />
    </div> : !loading && <p className="text-sm text-muted-foreground">{market !== 'CN' ? '当日分钟图目前支持 A 股；港美股可在 K 线页查看日线。' : '暂无当天分钟数据（未开盘、休市或数据源不可用）。不会用历史日线冒充今天走势；历史日 K 可在 K 线页查看。'}</p>}
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant={automatic ? 'default' : 'outline'} onClick={() => { setAutomatic(true); if (session?.phase) setSelected(session.phase) }}>自动跟随时段</Button>
      {phases.map(p => <Button size="sm" key={p.key} variant={selected === p.key ? 'default' : 'outline'} onClick={() => { setAutomatic(false); setSelected(p.key) }}>{p.label}</Button>)}
    </div>
    {report ? <div><div className="text-xs text-muted-foreground mb-2">{report.analysis_date} · {phases.find(p => p.key === selected)?.label}报告</div><div className="prose prose-sm dark:prose-invert max-w-none"><ReactMarkdown>{stockReportContent(report, symbol)}</ReactMarkdown></div></div> : !loading && <p className="text-sm text-muted-foreground">当天{phases.find(p => p.key === selected)?.label}报告尚未生成。请在 Agent 中绑定本股票、选择模型并启用计划，或手动运行一次。切换页面不会自动调用模型。</p>}
  </section>
}
