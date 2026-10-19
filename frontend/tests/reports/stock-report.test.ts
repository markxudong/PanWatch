import { describe, it, expect } from 'vitest'
import { stockReportContent } from '../../src/lib/stock-report'

describe('individual stock reports', () => {
  const batch = { stock_symbol: '*', content: '# 盘后复盘\n\n## 大盘概览\n指数上涨\n\n## 苏垦农发（601952）\n仅本股分析\n### 技术面\n等待企稳\n\n## 川能动力（000155）\n其他股票内容\n\n## 明日计划\n组合建议' }
  it('keeps the complete target section and its subheadings only', () => {
    const result = stockReportContent(batch, '601952')
    expect(result).toContain('仅本股分析')
    expect(result).toContain('等待企稳')
    expect(result).not.toMatch(/大盘概览|川能动力|明日计划|其他股票/)
  })
  it('uses only a matching structured suggestion when prose cannot be split', () => {
    const result = stockReportContent({ content: '多股混合正文', suggestions: { '601952': { action_label: '观望', reason: '等待企稳' }, '000155': { reason: '其他股票' } } }, '601952')
    expect(result).toContain('等待企稳')
    expect(result).not.toMatch(/多股混合|其他股票/)
  })
  it('does not use a mention in another stock heading as a symbol prefix match', () => {
    expect(stockReportContent({ content: '## 1601952\n其他股票' }, '601952')).not.toContain('其他股票')
  })
  it('never returns the whole batch when the target cannot be extracted', () => {
    expect(stockReportContent(batch, '002891')).not.toContain('仅本股分析')
  })
  it('keeps explicitly single-stock prose and removes machine JSON', () => {
    expect(stockReportContent({ stock_symbol: '601952', content: '本股结论\n<!--PANWATCH_JSON-->其他股票<!--/PANWATCH_JSON-->' }, '601952')).toBe('本股结论')
  })
})
