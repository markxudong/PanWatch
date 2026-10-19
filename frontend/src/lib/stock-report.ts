export interface StockReport {
  stock_symbol?: string
  content: string
  title?: string
  suggestions?: Record<string, any> | null
}

/** Never render another stock's prose from a batch report in a stock detail. */
export function stockReportContent(report: StockReport, symbol: string, name = ''): string {
  const text = report.content.replace(/<!--PANWATCH_JSON-->[\s\S]*?(?:<!--\/PANWATCH_JSON-->|$)/g, '').trim()
  const escaped = symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const matchesSymbol = new RegExp(`(^|[^A-Z0-9])${escaped}([^A-Z0-9]|$)`, 'i')
  const lines = text.split('\n')
  const headings = lines.map((line, index) => {
    const match = line.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/)
    return match ? { index, level: match[1].length, label: match[2] } : null
  }).filter((h): h is { index: number; level: number; label: string } => !!h)
  const target = headings.find(h => matchesSymbol.test(h.label) || (!!name && h.label.includes(name)))
  if (target) {
    const end = headings.find(h => h.index > target.index && h.level <= target.level)?.index ?? lines.length
    return lines.slice(target.index, end).join('\n').trim()
  }
  const suggestion = report.suggestions?.[symbol]
  if (suggestion && typeof suggestion === 'object') {
    const fields = [['action_label', '建议'], ['signal', '信号'], ['reason', '依据'], ['triggers', '触发条件'], ['invalidations', '失效条件'], ['risks', '风险']] as const
    return [`### ${name || symbol}（${symbol}）`, ...fields.flatMap(([key, label]) => {
      const value = suggestion[key]
      return value ? [`**${label}**：${Array.isArray(value) ? value.join('；') : String(value)}`] : []
    })].join('\n\n')
  }
  // Only a record explicitly scoped to this stock may use unstructured prose.
  if (report.stock_symbol === symbol && !headings.some(h => /\b\d{6}\b/.test(h.label) && !matchesSymbol.test(h.label))) return text
  return '本报告未提供可独立提取的该股分析，请重新生成该股票的报告。'
}
