import { formatFullDateTime } from '@/lib/utils'
import { useEffect, useState } from 'react'
import { fetchAPI } from '@panwatch/api'
import { Button } from '@panwatch/base-ui/components/ui/button'
import { Input } from '@panwatch/base-ui/components/ui/input'

type Candidate = { symbol: string; name: string; industry: string; boards: number; price: number | null; turnover: number | null; breaks: number | null; first_seal: string; seal_funds: number | null; state: string; risks: string[] }
type Watch = { base_date: string | null; target_date: string | null; source: string; availability: string; fetched_at: string | null; live_available: boolean; live_fetched_at?: string; message: string; items: Candidate[] }
const sealTime = (value: string) => /^\d{6}$/.test(value) ? `${value.slice(0, 2)}:${value.slice(2, 4)}:${value.slice(4)}` : '未知'

export default function ContinuationWatch({ onOpen }: { onOpen: (symbol: string, name: string) => void }) {
  const [data, setData] = useState<Watch | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState(false)
  useEffect(() => {
    let alive = true
    let busy = false
    const load = async () => {
      if (busy) return
      busy = true
      setLoading(true)
      try {
        const result = await fetchAPI<Watch>('/klines/boards/continuation/watch')
        if (alive) { setData(result); setError('') }
      } catch { if (alive) { setError('涨停观察池加载失败，请重试。'); setData(null) } }
      finally { busy = false; if (alive) setLoading(false) }
    }
    void load()
    const timer = window.setInterval(load, 60000)
    return () => { alive = false; window.clearInterval(timer) }
  }, [revision])
  const items = (data?.items || []).filter(item => (filter === 'all' || (filter === 'first' ? item.boards === 1 : item.boards > 1)) && `${item.name}${item.symbol}${item.industry}`.includes(query.trim()))
  return <section className="card mb-6 overflow-hidden" aria-label="连板观察">
    <div className="p-4 md:p-5 border-b border-border bg-primary/5">
      <div className="flex items-start justify-between gap-3">
        <div><div className="text-xs text-primary font-medium mb-1">A 股 · 下一交易日预案</div><h2 className="text-xl font-semibold">连板观察</h2><p className="mt-2 text-sm text-muted-foreground">从前一交易日涨停股中找观察对象，等待换手、承接与回封确认。</p></div>
        <Button size="sm" variant="outline" disabled={loading} onClick={() => setRevision(value => value + 1)}>{loading ? '加载中…' : '刷新股池'}</Button>
      </div>
      <div className="mt-3 text-sm">涨停基准日 <strong>{data?.base_date || '待确认'}</strong> → 计划交易日 <strong>{data?.target_date || '待确认'}</strong></div>
    </div>
    <div className="p-4 md:p-5 space-y-4">
      <div className="grid md:grid-cols-3 gap-3 text-sm">
        <div className="rounded-lg border border-border p-3"><strong>盘前 · 选观察对象</strong><p className="mt-1 text-muted-foreground">核对公告、板块强度和竞价承接。首板看一进二，连板股看分歧；高开或一字不直接视为买点。</p></div>
        <div className="rounded-lg border border-border p-3"><strong>盘中 · 等条件确认</strong><p className="mt-1 text-muted-foreground">换手上板看量价与承接，炸板后看能否重新封住；反复开板、板块转弱则放弃。用实时盘口确认成交机会。</p></div>
        <div className="rounded-lg border border-border p-3"><strong>盘后 · 更新次日池</strong><p className="mt-1 text-muted-foreground">收盘后切换到当天涨停池，为下一交易日准备。候选不等于推荐买入，排序不代表连板概率。</p></div>
      </div>
      <p className="text-xs text-muted-foreground">{data?.message || '正在读取涨停股池…'} 数据源：{data?.source || '东方财富'}。每分钟刷新；不是逐笔行情，封单与回封持续性需在交易终端核验。</p>
      {data?.fetched_at && <p className="text-xs text-muted-foreground">基准池采集：{formatFullDateTime(data.fetched_at)}{data.live_fetched_at ? ` · 目标日池采集：${formatFullDateTime(data.live_fetched_at)}` : ' · 目标交易日盘口尚未确认'}</p>}
      {error && <p role="alert">{error}</p>}
      <div className="flex flex-wrap items-center gap-2">
        {([['all', '全部'], ['first', '首板 → 二板'], ['multi', '连板接力']] as const).map(([key, label]) => <Button key={key} size="sm" variant={filter === key ? 'default' : 'outline'} onClick={() => { setFilter(key); setExpanded(false) }}>{label}</Button>)}
        <Input className="w-full sm:w-56" aria-label="搜索连板候选" placeholder="股票、代码或行业" value={query} onChange={event => setQuery(event.target.value)} />
        <span className="text-xs text-muted-foreground">{items.length} 只</span>
      </div>
      {!loading && data?.availability === 'ready' && items.length === 0 && <p className="text-sm text-muted-foreground">没有符合当前筛选的股票。</p>}
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
        {(expanded ? items : items.slice(0, 6)).map(item => <article key={item.symbol} className="rounded-xl border border-border p-4 space-y-3">
          <div className="flex justify-between gap-2"><div><strong>{item.name}</strong><div className="text-xs text-muted-foreground mt-1">{item.symbol} · {item.industry}</div></div><span className="text-primary font-semibold">{item.boards} 连板</span></div>
          <dl className="grid grid-cols-2 gap-2 text-xs">
            <div><dt className="text-muted-foreground">基准日收盘</dt><dd>{item.price?.toFixed(2) ?? '--'}</dd></div>
            <div><dt className="text-muted-foreground">首次封板</dt><dd>{sealTime(item.first_seal)}</dd></div>
            <div><dt className="text-muted-foreground">换手率 / 开板次数</dt><dd>{item.turnover?.toFixed(2) ?? '--'}% / {item.breaks ?? '--'}</dd></div>
            <div><dt className="text-muted-foreground">基准日封板资金</dt><dd>{item.seal_funds == null ? '--' : `${(item.seal_funds / 1e8).toFixed(2)} 亿`}</dd></div>
          </dl>
          <p className="text-xs font-medium">{item.state}</p>
          <p className="text-xs text-muted-foreground">{item.risks.join('；')}。</p>
          <Button variant="outline" size="sm" className="w-full" onClick={() => onOpen(item.symbol, item.name)}>查看当日走势与个股分析</Button>
        </article>)}
      </div>
      {items.length > 6 && <Button variant="outline" onClick={() => setExpanded(value => !value)}>{expanded ? '收起候选' : `展开全部 ${items.length} 只`}</Button>}
    </div>
  </section>
}
