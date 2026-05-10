/**
 * 指标计算工具函数
 */
import * as XLSX from 'xlsx'
import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'
dayjs.extend(customParseFormat)
import type { RawDataRow, MetricCard, AuditorStat, LabelDiffItem } from '@/types'
import { LABEL_1_FIELDS, LABEL_2_FIELDS, LABEL_1_NAMES, LABEL_2_NAMES } from '@/types'

/**
 * 灵活解析日期字符串，支持多种 Excel 导出格式
 * 返回 dayjs 对象，解析失败返回 null
 */
function parseFlexDate(str: string): dayjs.Dayjs | null {
  if (!str || str.trim() === '') return null
  const s = str.trim()
  const formats = [
    'YYYY年M月D日',
    'YYYY年MM月DD日',
    'YYYY/M/D H:mm',
    'YYYY/M/D HH:mm',
    'YYYY/MM/DD HH:mm:ss',
    'YYYY/MM/DD HH:mm',
    'YYYY/M/D HH:mm:ss',
    'YYYY/M/D',
    'YYYY/MM/DD',
    'YYYY-MM-DD HH:mm:ss',
    'YYYY-MM-DD',
    'YYYY-M-D',
  ]
  for (const fmt of formats) {
    const d = dayjs(s, fmt, true)  // strict=true 精确匹配
    if (d.isValid()) return d
  }
  // 兜底：非严格模式
  const d = dayjs(s)
  return d.isValid() ? d : null
}

/**
 * 按时间范围过滤数据
 */
export function filterByDateRange(
  data: RawDataRow[],
  dateRange?: [string, string],
  dateField: '质检日期' | '审核时间' = '质检日期',
): RawDataRow[] {
  if (!dateRange || !dateRange[0] || !dateRange[1]) return data

  const start = dayjs(dateRange[0]).startOf('day')
  const end = dayjs(dateRange[1]).endOf('day')

  return data.filter((row) => {
    const d = parseFlexDate(String(row[dateField] || ''))
    return d !== null && !d.isBefore(start) && !d.isAfter(end)
  })
}

/**
 * 多条件过滤数据
 */
export function filterData(
  data: RawDataRow[],
  options: {
    dateRange?: [string, string]
    qcConclusion?: string[]
    auditResult?: string[]
    qcResult?: string[]
    auditorName?: string
    auditorRtx?: string
  },
): RawDataRow[] {
  let result = data

  if (options.dateRange?.[0] && options.dateRange?.[1]) {
    result = filterByDateRange(result, options.dateRange)
  }
  if (options.qcConclusion?.length) {
    result = result.filter((r) => options.qcConclusion!.includes(r.qc_conclusion))
  }
  if (options.auditResult?.length) {
    result = result.filter((r) => options.auditResult!.includes(r.审核结果))
  }
  if (options.qcResult?.length) {
    result = result.filter((r) => options.qcResult!.includes(r.质检结果))
  }
  if (options.auditorName) {
    result = result.filter((r) => r.审核人员?.includes(options.auditorName!))
  }
  if (options.auditorRtx) {
    result = result.filter((r) => r.审核RTX?.includes(options.auditorRtx!))
  }

  return result
}

/**
 * 计算核心指标
 */
export function calcMetrics(data: RawDataRow[]) {
  const total = data.length
  if (total === 0) {
    return {
      accuracy: 0,
      articleGradingAccuracy: 0,
      deepGradingAccuracy: 0,
      wrongRate: 0,
      missRate: 0,
      categoryErrorRate: 0,
      total: 0,
    }
  }

  const correctCount = data.filter((r) => r.qc_conclusion === '正确').length
  const wrongCount = data.filter((r) => r.qc_conclusion === '错审').length
  const missCount = data.filter((r) => r.qc_conclusion === '漏审').length
  const categoryErrorCount = data.filter((r) => r.qc_conclusion === '归类错误').length

  return {
    accuracy: (correctCount / total) * 100,
    articleGradingAccuracy: (1 - (wrongCount + missCount) / total) * 100,
    deepGradingAccuracy: (1 - categoryErrorCount / total) * 100,
    wrongRate: (wrongCount / total) * 100,
    missRate: (missCount / total) * 100,
    categoryErrorRate: (categoryErrorCount / total) * 100,
    total,
    correctCount,
    wrongCount,
    missCount,
    categoryErrorCount,
  }
}

/**
 * 生成指标卡数据（含环比）
 */
export function buildMetricCards(currentData: RawDataRow[], prevData: RawDataRow[]): MetricCard[] {
  const curr = calcMetrics(currentData)
  const prev = calcMetrics(prevData)

  const fmt = (v: number) => v.toFixed(2)

  return [
    {
      label: '准确率',
      value: Number(fmt(curr.accuracy)),
      prevValue: Number(fmt(prev.accuracy)),
      unit: '%',
      type: 'positive',
      description: '审核整体准确率（qc_conclusion=正确）',
    },
    {
      label: '文章分级准确率',
      value: Number(fmt(curr.articleGradingAccuracy)),
      prevValue: Number(fmt(prev.articleGradingAccuracy)),
      unit: '%',
      type: 'positive',
      description: '排除漏审和错审后的准确率',
    },
    {
      label: '深度分级准确率',
      value: Number(fmt(curr.deepGradingAccuracy)),
      prevValue: Number(fmt(prev.deepGradingAccuracy)),
      unit: '%',
      type: 'positive',
      description: '排除归类错误后的准确率',
    },
    {
      label: '错审率',
      value: Number(fmt(curr.wrongRate)),
      prevValue: Number(fmt(prev.wrongRate)),
      unit: '%',
      type: 'negative',
      description: 'qc_conclusion=错审占比',
    },
    {
      label: '漏审率',
      value: Number(fmt(curr.missRate)),
      prevValue: Number(fmt(prev.missRate)),
      unit: '%',
      type: 'negative',
      description: 'qc_conclusion=漏审占比',
    },
    {
      label: '归类错误率',
      value: Number(fmt(curr.categoryErrorRate)),
      prevValue: Number(fmt(prev.categoryErrorRate)),
      unit: '%',
      type: 'negative',
      description: 'qc_conclusion=归类错误占比',
    },
  ]
}

/**
 * 生成时间趋势数据
 */
export function buildTrendData(
  data: RawDataRow[],
  granularity: 'day' | 'week' | 'month' = 'day',
): {
  dates: string[]
  accuracy: number[]
  articleGradingAccuracy: number[]
  deepGradingAccuracy: number[]
} {
  if (data.length === 0) {
    return { dates: [], accuracy: [], articleGradingAccuracy: [], deepGradingAccuracy: [] }
  }

  // 按时间分组
  const groups = new Map<string, RawDataRow[]>()

  data.forEach((row) => {
    const d = parseFlexDate(String(row.质检日期 || ''))
    if (!d) return

    let key: string
    if (granularity === 'day') key = d.format('YYYY-MM-DD')
    else if (granularity === 'week') key = d.startOf('week').format('YYYY-MM-DD')
    else key = d.format('YYYY-MM')

    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(row)
  })

  const sortedKeys = Array.from(groups.keys()).sort()

  return {
    dates: sortedKeys,
    accuracy: sortedKeys.map((k) => {
      const m = calcMetrics(groups.get(k)!)
      return Number(m.accuracy.toFixed(2))
    }),
    articleGradingAccuracy: sortedKeys.map((k) => {
      const m = calcMetrics(groups.get(k)!)
      return Number(m.articleGradingAccuracy.toFixed(2))
    }),
    deepGradingAccuracy: sortedKeys.map((k) => {
      const m = calcMetrics(groups.get(k)!)
      return Number(m.deepGradingAccuracy.toFixed(2))
    }),
  }
}

/**
 * 计算审核员统计（按审核员汇总，一人一行）
 */
export function buildAuditorStats(data: RawDataRow[]): AuditorStat[] {
  // 只按审核员RTX分组，整个筛选时间范围内汇总成一行
  const groups = new Map<string, RawDataRow[]>()

  data.forEach((row) => {
    const key = row.审核RTX || row.审核人员 || '未知'
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(row)
  })

  const stats: AuditorStat[] = []

  groups.forEach((rows, rtx) => {
    const auditorName = rows[0]?.审核人员 || ''

    // 质检日期范围
    const qcDates = rows
      .map((r) => parseFlexDate(String(r.质检日期 || '')))
      .filter((d): d is dayjs.Dayjs => d !== null)
    const minDate = qcDates.length ? qcDates.reduce((a, b) => a.isBefore(b) ? a : b).format('YYYY-MM-DD') : ''
    const maxDate = qcDates.length ? qcDates.reduce((a, b) => a.isAfter(b) ? a : b).format('YYYY-MM-DD') : ''
    const dateRange = minDate === maxDate ? minDate : `${minDate} ~ ${maxDate}`

    const wrongCount = rows.filter((r) => r.qc_conclusion === '错审').length
    const missCount = rows.filter((r) => r.qc_conclusion === '漏审').length
    const categoryErrorCount = rows.filter((r) => r.qc_conclusion === '归类错误').length
    const totalError = wrongCount + missCount + categoryErrorCount
    const correctCount = rows.filter((r) => r.qc_conclusion === '正确').length
    const qcCount = rows.length

    stats.push({
      质检日期: dateRange,
      对应审核日期: '',
      审核员RTX: rtx,
      审核员姓名: auditorName,
      审核量: qcCount,
      qc量: qcCount,
      错审量: wrongCount,
      漏审量: missCount,
      归类错误量: categoryErrorCount,
      总错误数: totalError,
      审核正确量: correctCount,
      准确率: qcCount > 0 ? Number(((correctCount / qcCount) * 100).toFixed(2)) : 0,
      错审率: qcCount > 0 ? Number(((wrongCount / qcCount) * 100).toFixed(2)) : 0,
      漏审率: qcCount > 0 ? Number(((missCount / qcCount) * 100).toFixed(2)) : 0,
      归类错误率: qcCount > 0 ? Number(((categoryErrorCount / qcCount) * 100).toFixed(2)) : 0,
      文章分级准确率: qcCount > 0 ? Number(((1 - (wrongCount + missCount) / qcCount) * 100).toFixed(2)) : 0,
      深度分级准确率: qcCount > 0 ? Number(((1 - categoryErrorCount / qcCount) * 100).toFixed(2)) : 0,
    })
  })

  return stats.sort((a, b) => b.准确率 - a.准确率)
}

/**
 * 解析 audit_label JSON，获取命中标签名称列表
 * 过滤掉占位符 `"\"\""` 后，剩余字符串即为命中标签
 */
export function parseAuditLabel(labelJson: string): string[] {
  try {
    const obj = JSON.parse(labelJson)
    const list: unknown[] = obj?.list || []
    return list
      .map((item) => String(item))
      .filter((item) => {
        // 过滤占位符：空字符串、`""`、`\"\"` 等各种形态
        const trimmed = item.trim()
        return trimmed !== '' && trimmed !== '""' && trimmed !== '\\"\\\"' && trimmed !== '\"\"'
      })
  } catch {
    return []
  }
}

/**
 * 判断质检标签是否命中
 * 规则：值为 1 或 2 = 命中；值为 0 = 未命中；值为 -1（空单元格）= 未命中
 */
function isQcLabelHit(val: number): boolean {
  return val === 1 || val === 2
}

/**
 * 计算标签归因分析
 */
export function buildLabelDiff(data: RawDataRow[]): LabelDiffItem[] {
  // 只分析归类错误的数据
  const categoryErrorData = data.filter((r) => r.qc_conclusion === '归类错误')
  const total = categoryErrorData.length

  if (total === 0) return []

  const results: LabelDiffItem[] = []

  // 标签1分析（质检字段值：0=未命中，1=命中）
  LABEL_1_FIELDS.forEach((field, idx) => {
    const labelName = LABEL_1_NAMES[idx]
    let overJudge = 0   // 误判：审核命中，但质检=0（多给了）
    let missJudge = 0   // 漏判：审核未命中，但质检=1或2（少给了）

    categoryErrorData.forEach((row) => {
      // 质检命中判断：1 = 命中，0 = 未命中
      const qcHit = isQcLabelHit(Number(row[field]))
      // 审核命中判断：JSON list 中包含该标签名 = 命中
      const auditHitList = parseAuditLabel(row.audit_label_1)
      const auditHit = auditHitList.includes(labelName)

      if (auditHit && !qcHit) overJudge++      // 审核给了，质检没给 → 误判
      else if (!auditHit && qcHit) missJudge++ // 审核没给，质检给了 → 漏判
    })

    results.push({
      labelGroup: '标签1',
      labelName,
      totalCount: total,
      overJudge,
      missJudge,
      overRate: total > 0 ? Number(((overJudge / total) * 100).toFixed(2)) : 0,
      missRate: total > 0 ? Number(((missJudge / total) * 100).toFixed(2)) : 0,
    })
  })

  // 标签2分析（质检字段值：0=未命中，1=命中，求知价值 2=命中）
  LABEL_2_FIELDS.forEach((field, idx) => {
    const labelName = LABEL_2_NAMES[idx]
    let overJudge = 0
    let missJudge = 0

    categoryErrorData.forEach((row) => {
      // 质检命中判断：1 或 2 均视为命中，0 = 未命中
      const qcHit = isQcLabelHit(Number(row[field]))
      // 审核命中判断：JSON list 中包含该标签名 = 命中
      const auditHitList = parseAuditLabel(row.audit_label_2)
      const auditHit = auditHitList.includes(labelName)

      if (auditHit && !qcHit) overJudge++      // 审核给了，质检没给 → 误判
      else if (!auditHit && qcHit) missJudge++ // 审核没给，质检给了 → 漏判
    })

    results.push({
      labelGroup: '标签2',
      labelName,
      totalCount: total,
      overJudge,
      missJudge,
      overRate: total > 0 ? Number(((overJudge / total) * 100).toFixed(2)) : 0,
      missRate: total > 0 ? Number(((missJudge / total) * 100).toFixed(2)) : 0,
    })
  })

  return results
}

/**
 * 导出数据为 Excel
 */
export function exportToExcel(data: Record<string, unknown>[], filename: string): void {
  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
  XLSX.writeFile(wb, `${filename}.xlsx`)
}
