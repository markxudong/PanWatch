import { useEffect, useRef, useState } from 'react'

export type MinuteBar = { time: string; open: number; close: number; high: number; low: number; volume: number }
const minuteOffset = (time: string) => {
  const [h, m] = time.split(' ')[1].split(':').map(Number)
  const minutes = h * 60 + m
  return Math.max(0, Math.min(240, minutes <= 690 ? minutes - 570 : minutes - 660))
}

export default function IntradayCandles({ bars, label }: { bars: MinuteBar[]; label: string }) {
  const host = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(800)
  const [hover, setHover] = useState<number | null>(null)
  useEffect(() => {
    if (!host.current) return
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(320, entry.contentRect.width)))
    observer.observe(host.current)
    return () => observer.disconnect()
  }, [])
  if (!bars.length) return null
  const left = 12, right = width - 62, top = 22, bottom = 210, volumeTop = 232, volumeBottom = 282
  const min = Math.min(...bars.map(b => b.low)), max = Math.max(...bars.map(b => b.high))
  const padding = Math.max((max - min) * 0.12, max * 0.001)
  const lower = min - padding, upper = max + padding
  const y = (price: number) => bottom - (price - lower) / (upper - lower) * (bottom - top)
  const x = (bar: MinuteBar) => left + minuteOffset(bar.time) / 240 * (right-left)
  const maxVolume = Math.max(1,...bars.map(b => b.volume))
  const selected = bars[Math.min(hover ?? bars.length - 1, bars.length - 1)]
  const candleWidth = Math.max(2, (right-left) / 48 * 0.65)
  return <div ref={host} className="mt-3 rounded-xl border border-border/50 bg-background p-3">
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-mono min-h-10" aria-live="polite">
      <span>{selected.time.split(' ')[1]}</span><span>开 {selected.open.toFixed(2)}</span><span>高 {selected.high.toFixed(2)}</span><span>低 {selected.low.toFixed(2)}</span><span>收 {selected.close.toFixed(2)}</span>
    </div>
    <svg viewBox={`0 0 ${width} 316`} className="block w-full touch-pan-y" role="img" aria-label={label} onPointerLeave={() => setHover(null)} onPointerMove={event => {
      const rect = event.currentTarget.getBoundingClientRect()
      const pointer = (event.clientX - rect.left) / rect.width * width
      let index = 0
      bars.forEach((bar, i) => { if (Math.abs(x(bar)-pointer) < Math.abs(x(bars[index])-pointer)) index = i })
      setHover(index)
    }}>
      {[0,1,2,3,4].map(i => { const price = lower + (upper-lower)*i/4; return <g key={i}>
        <line x1={left} x2={right} y1={y(price)} y2={y(price)} className="stroke-border" strokeDasharray="3 4" />
        <text x={right+8} y={y(price)+4} className="fill-muted-foreground" fontSize="11">{price.toFixed(2)}</text>
      </g> })}
      {[0,60,120,180,240].map((m,i) => <g key={m}>
        <line x1={left+m/240*(right-left)} x2={left+m/240*(right-left)} y1={top} y2={volumeBottom} className="stroke-border" strokeDasharray="3 4" />
        <text x={left+m/240*(right-left)} y="305" textAnchor={i===0?'start':i===4?'end':'middle'} className="fill-muted-foreground" fontSize="10">{['09:30','10:30','午休','14:00','15:00'][i]}</text>
      </g>)}
      <text x={left} y={volumeTop-4} className="fill-muted-foreground" fontSize="10">成交量</text>
      {bars.map(bar => <g key={bar.time} className={bar.close >= bar.open ? 'text-market-up' : 'text-market-down'}>
        <line x1={x(bar)} x2={x(bar)} y1={y(bar.high)} y2={y(bar.low)} stroke="currentColor" />
        <rect x={x(bar)-candleWidth/2} y={Math.min(y(bar.open),y(bar.close))} width={candleWidth} height={Math.max(1,Math.abs(y(bar.open)-y(bar.close)))} fill="currentColor" />
        <rect x={x(bar)-candleWidth/2} y={volumeBottom-bar.volume/maxVolume*(volumeBottom-volumeTop)} width={candleWidth} height={bar.volume/maxVolume*(volumeBottom-volumeTop)} fill="currentColor" opacity="0.45" />
      </g>)}
      {hover !== null && <g><line x1={x(selected)} x2={x(selected)} y1={top} y2={volumeBottom} className="stroke-foreground" strokeDasharray="4 3" /><circle cx={x(selected)} cy={y(selected.close)} r="3" className="fill-foreground" /></g>}
    </svg>
    <p className="text-[11px] text-muted-foreground">移动指针查看每根 K 线 · 午休时段折叠 · 成交量按数据源原始口径展示</p>
  </div>
}
