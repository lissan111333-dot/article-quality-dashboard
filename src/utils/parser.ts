/**
 * 文件解析工具 - Excel/CSV 解析、字段校验
 */
import * as XLSX from 'xlsx'
import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import type { RawDataRow, ValidationError, ParsePreview } from '@/types'
import { REQUIRED_FIELDS } from '@/types'

dayjs.extend(customParseFormat)

// 有效审核结果枚举
const VALID_AUDIT_RESULTS = ['低质/删除', '普通', '低价值', '高价值']
const VALID_QC_CONCLUSIONS = ['正确', '错审', '漏审', '归类错误']
const VALID_YES_NO = ['是', '否']

/**
 * 解析日期字段——仅用于「格式合法性校验」
 * 能解析出合法日期就返回非 null，否则返回 null。
 * 注意：不再对存储值做格式化，展示值以 Excel 原始字符串（cell.w）为准。
 */
function parseDate(val: unknown): string | null {
  if (val === undefined || val === null || String(val).trim() === '') return null

  // cellDates:true 时，XLSX 把日期单元格转为 JS Date
  if (val instanceof Date) {
    const d = dayjs(val)
    return d.isValid() ? d.format('YYYY-MM-DD') : null
  }

  const str = String(val).trim()

  // 如果仍是数字序列号（应对 xlsx 不转 cellDates 的场景）
  if (/^\d+(\.\d+)?$/.test(str)) {
    const num = Number(str)
    if (num > 40000) {
      try {
        const excelDate = XLSX.SSF.parse_date_code(num)
        if (excelDate && excelDate.y > 2000) {
          return `${excelDate.y}-${String(excelDate.m).padStart(2, '0')}-${String(excelDate.d).padStart(2, '0')}`
        }
      } catch { /* 继续尝试其他格式 */ }
    }
  }

  const formats = [
    'YYYY-MM-DD',
    'YYYY/MM/DD',
    'YYYY-MM-DD HH:mm:ss',
    'YYYY/MM/DD HH:mm:ss',
    'YYYY/M/D HH:mm:ss',
    'YYYY/M/D H:mm',
    'YYYY-M-D',
    'YYYY/M/D',
    'YYYY年M月D日',
    'YYYY年MM月DD日',
  ]

  for (const fmt of formats) {
    const d = dayjs(str, fmt)
    if (d.isValid()) return d.format('YYYY-MM-DD')
  }

  // 尝试直接解析
  const d = dayjs(str)
  if (d.isValid()) return d.format('YYYY-MM-DD')

  return null
}

/**
 * 合并多行表头（处理合并单元格场景）
 */
function mergeHeaders(sheet: XLSX.WorkSheet): string[] {
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1')
  const merges = sheet['!merges'] || []

  // 读取第1、2行内容
  const row1: string[] = []
  const row2: string[] = []

  for (let c = range.s.c; c <= range.e.c; c++) {
    const cell1 = sheet[XLSX.utils.encode_cell({ r: 0, c })]
    const cell2 = sheet[XLSX.utils.encode_cell({ r: 1, c })]
    row1[c] = cell1 ? String(cell1.v || '').trim() : ''
    row2[c] = cell2 ? String(cell2.v || '').trim() : ''
  }

  // 处理合并单元格：向右填充
  merges.forEach((merge) => {
    if (merge.s.r === 0) {
      for (let c = merge.s.c + 1; c <= merge.e.c; c++) {
        row1[c] = row1[merge.s.c]
      }
    }
    if (merge.s.r === 1) {
      for (let c = merge.s.c + 1; c <= merge.e.c; c++) {
        row2[c] = row2[merge.s.c]
      }
    }
  })

  // 合并表头：若第2行有内容且与第1行不同，使用 "父列 - 子列" 格式
  const headers: string[] = []
  for (let c = range.s.c; c <= range.e.c; c++) {
    const h1 = row1[c] || ''
    const h2 = row2[c] || ''
    if (h2 && h2 !== h1) {
      headers.push(`${h1} - ${h2}`)
    } else {
      headers.push(h1)
    }
  }

  // 标准化表头：将各种空格/格式差异归一到系统标准字段名
  return headers.map(normalizeHeaderName)
}

/**
 * 表头标准化：模糊匹配，兼容 Excel 中各种写法
 *
 * Excel 实际写法示例（第一张截图）：
 *   父行："质检标签1"  子行："主旨清晰"  → 合并后："质检标签1 - 主旨清晰"
 *   父行："质检标签 1 子列"  子行："主旨清晰"  → 合并后："质检标签 1 子列 - 主旨清晰"
 * 统一映射到系统标准字段名："质检标签 1 子列 - 主旨清晰"
 */
function normalizeHeaderName(raw: string): string {
  const trimmed = raw.trim()

  // 标签子列映射：key = [父列关键词, 子列名]，value = 标准字段名
  const LABEL_MAP: Array<{ group: 1 | 2; sub: string; standard: string }> = [
    { group: 1, sub: '主旨清晰',    standard: '质检标签 1 子列 - 主旨清晰' },
    { group: 1, sub: '表达流畅',    standard: '质检标签 1 子列 - 表达流畅' },
    { group: 1, sub: '排版优美',    standard: '质检标签 1 子列 - 排版优美' },
    { group: 1, sub: '观点独特',    standard: '质检标签 1 子列 - 观点独特' },
    { group: 1, sub: '内容独特',    standard: '质检标签 1 子列 - 内容独特' },
    { group: 1, sub: '专业性强',    standard: '质检标签 1 子列 - 专业性强' },
    { group: 2, sub: '信息价值',    standard: '质检标签 2 子列 - 信息价值' },
    { group: 2, sub: '决策价值',    standard: '质检标签 2 子列 - 决策价值' },
    { group: 2, sub: '情感归属价值', standard: '质检标签 2 子列 - 情感归属价值' },
    { group: 2, sub: '审美价值',    standard: '质检标签 2 子列 - 审美价值' },
    { group: 2, sub: '求知价值',    standard: '质检标签 2 子列 - 求知价值' },
  ]

  for (const item of LABEL_MAP) {
    // 条件1：包含对应子列名
    if (!trimmed.includes(item.sub)) continue
    // 条件2：包含 "质检标签" + 对应序号（1 或 2）
    // 用正则匹配 "质检标签" 后跟任意字符中包含数字 group
    const groupRegex = new RegExp(`质检标签\\s*${item.group}`)
    if (groupRegex.test(trimmed)) {
      return item.standard
    }
  }

  return trimmed
}

// 质检标签字段列表（值为 0/1 的字段，0=未命中 也是合法值）
const LABEL_BINARY_01_FIELDS = [
  '质检标签 1 子列 - 主旨清晰', '质检标签 1 子列 - 表达流畅', '质检标签 1 子列 - 排版优美',
  '质检标签 1 子列 - 观点独特', '质检标签 1 子列 - 内容独特', '质检标签 1 子列 - 专业性强',
  '质检标签 2 子列 - 信息价值', '质检标签 2 子列 - 决策价值', '质检标签 2 子列 - 情感归属价值',
  '质检标签 2 子列 - 审美价值',
]
// 求知价值：0/2
const LABEL_BINARY_02_FIELDS = ['质检标签 2 子列 - 求知价值']

/**
 * 判断一个字段值是否"为空"
 * 注意：数字 0 不是空值！只有 undefined / null / 空字符串 才算空
 */
function isEmptyValue(val: unknown): boolean {
  if (val === undefined || val === null) return true
  const str = String(val).trim()
  return str === ''
}

/**
 * 校验单行数据
 */
function validateRow(row: Record<string, unknown>, rowIndex: number): ValidationError[] {
  const errors: ValidationError[] = []

  // 必填校验
  // 关键规则：质检标签字段值为 0 代表"未命中"，是合法值，不能报必填错误
  for (const field of REQUIRED_FIELDS) {
    const val = row[field]

    // 质检标签字段：值为 0 也是合法的（0=未命中），不报空值错误
    const isLabelField = LABEL_BINARY_01_FIELDS.includes(field) || LABEL_BINARY_02_FIELDS.includes(field)
    if (isLabelField) {
      // 只有真正的空单元格才报错，0 不报错
      if (val === undefined || val === null || String(val).trim() === '') {
        errors.push({ row: rowIndex, field, message: `必填字段【${field}】不可为空（0=未命中，1=命中，均为合法值）` })
      }
      continue
    }

    // 其他字段：空值报错
    if (isEmptyValue(val)) {
      errors.push({ row: rowIndex, field, message: `必填字段【${field}】不可为空` })
    }
  }

  // 日期格式校验
  for (const dateField of ['质检日期', '审核时间']) {
    const val = row[dateField]
    if (!isEmptyValue(val)) {
      const parsed = parseDate(val)
      if (!parsed) {
        errors.push({ row: rowIndex, field: dateField, message: `【${dateField}】日期格式不合法`, value: val })
      }
    }
  }

  // 数字字段校验（审核总分、质检总分：0-12）
  const numFields0_12 = ['审核总分', '质检总分']
  for (const f of numFields0_12) {
    const v = row[f]
    if (!isEmptyValue(v)) {
      const n = Number(v)
      if (!Number.isInteger(n) || n < 0 || n > 12) {
        errors.push({ row: rowIndex, field: f, message: `【${f}】取值范围应为0-12整数`, value: v })
      }
    }
  }

  // 质检标签 0/1 字段校验：只校验非空的值，且 0 是合法的
  for (const f of LABEL_BINARY_01_FIELDS) {
    const v = row[f]
    if (!isEmptyValue(v)) {
      const n = Number(v)
      if (n !== 0 && n !== 1) {
        errors.push({ row: rowIndex, field: f, message: `【${f}】取值只能为0（未命中）或1（命中）`, value: v })
      }
    }
  }

  // 求知价值：0/2（0=未命中，2=命中）
  const zhizhiVal = row['质检标签 2 子列 - 求知价值']
  if (!isEmptyValue(zhizhiVal)) {
    const n = Number(zhizhiVal)
    if (n !== 0 && n !== 2) {
      errors.push({ row: rowIndex, field: '质检标签 2 子列 - 求知价值', message: '【求知价值】取值只能为0（未命中）或2（命中）', value: zhizhiVal })
    }
  }

  // 枚举字段校验
  const auditResult = row['审核结果']
  if (auditResult && !VALID_AUDIT_RESULTS.includes(String(auditResult))) {
    errors.push({ row: rowIndex, field: '审核结果', message: `【审核结果】枚举值不合法：${auditResult}` })
  }
  const qcResult = row['质检结果']
  if (qcResult && !VALID_AUDIT_RESULTS.includes(String(qcResult))) {
    errors.push({ row: rowIndex, field: '质检结果', message: `【质检结果】枚举值不合法：${qcResult}` })
  }
  const qcConclusion = row['qc_conclusion']
  if (qcConclusion && !VALID_QC_CONCLUSIONS.includes(String(qcConclusion))) {
    errors.push({ row: rowIndex, field: 'qc_conclusion', message: `【qc_conclusion】枚举值不合法：${qcConclusion}` })
  }
  const isAppeal = row['是否申诉']
  if (isAppeal && !VALID_YES_NO.includes(String(isAppeal))) {
    errors.push({ row: rowIndex, field: '是否申诉', message: `【是否申诉】枚举值不合法：${isAppeal}` })
  }

  return errors
}

/**
 * 安全解析质检标签数值
 * 规则：0 = 未命中（合法），1 或 2 = 命中（合法），空单元格返回 -1（标记为缺失）
 * 使用 -1 而非 NaN，避免后续计算误判
 */
function parseLabelValue(val: unknown): number {
  if (val === undefined || val === null || String(val).trim() === '') return -1
  const n = Number(val)
  return isNaN(n) ? -1 : n
}

/**
 * 将原始行对象转换为标准 RawDataRow
 */
function normalizeRow(row: Record<string, unknown>, batchId: string): RawDataRow {
  return {
    // 日期字段直接保留 Excel 原始显示字符串（cell.w 已在读取时赋值），不做格式转换
    质检日期: row['质检日期'] !== undefined && row['质检日期'] !== null ? String(row['质检日期']) : '',
    审核时间: row['审核时间'] !== undefined && row['审核时间'] !== null ? String(row['审核时间']) : '',
    文章标题: row['文章标题'] ? String(row['文章标题']).substring(0, 500) : undefined,
    文章链接: String(row['文章链接'] || ''),
    audit_id: String(row['audit_id'] || ''),
    audit_label_1: String(row['audit_label_1'] || ''),
    audit_label_2: String(row['audit_label_2'] || ''),
    审核总分: Number(row['审核总分']),
    审核结果: String(row['审核结果'] || ''),
    审核RTX: String(row['审核RTX'] || ''),
    审核人员: String(row['审核人员'] || '').substring(0, 50),
    质检总分: Number(row['质检总分']),
    质检结果: String(row['质检结果'] || ''),
    '质检标签 1 子列 - 主旨清晰': parseLabelValue(row['质检标签 1 子列 - 主旨清晰']),
    '质检标签 1 子列 - 表达流畅': parseLabelValue(row['质检标签 1 子列 - 表达流畅']),
    '质检标签 1 子列 - 排版优美': parseLabelValue(row['质检标签 1 子列 - 排版优美']),
    '质检标签 1 子列 - 观点独特': parseLabelValue(row['质检标签 1 子列 - 观点独特']),
    '质检标签 1 子列 - 内容独特': parseLabelValue(row['质检标签 1 子列 - 内容独特']),
    '质检标签 1 子列 - 专业性强': parseLabelValue(row['质检标签 1 子列 - 专业性强']),
    '质检标签 2 子列 - 信息价值': parseLabelValue(row['质检标签 2 子列 - 信息价值']),
    '质检标签 2 子列 - 决策价值': parseLabelValue(row['质检标签 2 子列 - 决策价值']),
    '质检标签 2 子列 - 情感归属价值': parseLabelValue(row['质检标签 2 子列 - 情感归属价值']),
    '质检标签 2 子列 - 审美价值': parseLabelValue(row['质检标签 2 子列 - 审美价值']),
    '质检标签 2 子列 - 求知价值': parseLabelValue(row['质检标签 2 子列 - 求知价值']),
    qc_conclusion: row['qc_conclusion'] as any,
    质检人: String(row['质检人'] || '').substring(0, 50),
    是否申诉: row['是否申诉'] as any,
    申诉理由: row['申诉理由'] ? String(row['申诉理由']).substring(0, 2000) : undefined,
    申诉是否通过: row['申诉是否通过'] as any,
    理由: row['理由'] ? String(row['理由']).substring(0, 2000) : undefined,
    _batchId: batchId,
  } as RawDataRow
}

/**
 * 主解析函数：读取 ArrayBuffer，解析 Excel/CSV 数据
 * @param buffer 文件二进制内容
 * @param batchId 批次ID
 * @param onProgress 进度回调 (0-100)
 */
export async function parseFile(
  buffer: ArrayBuffer,
  batchId: string,
  onProgress?: (progress: number) => void,
): Promise<{ rows: RawDataRow[]; preview: ParsePreview; allErrors: ValidationError[] }> {
  return new Promise((resolve, reject) => {
    try {
      onProgress?.(10)

      // cellDates: true 让 XLSX 把日期单元格直接转成 JS Date，避免拿到原始序列号（如 46148）
      const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
      const sheetName = workbook.SheetNames[0]
      const sheet = workbook.Sheets[sheetName]

      onProgress?.(30)

      // 获取合并后的表头
      const headers = mergeHeaders(sheet)

      // 读取数据行（从第3行开始，跳过前2行表头）
      const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1')
      const allErrors: ValidationError[] = []
      const rows: RawDataRow[] = []
      const previewRows: Record<string, unknown>[] = []

      const totalRows = Math.max(0, range.e.r - 1) // 第2行(index=1)以后的数据行

      onProgress?.(40)

      for (let r = 2; r <= range.e.r; r++) {
        const rowObj: Record<string, unknown> = {}

        for (let c = range.s.c; c <= range.e.c; c++) {
          const cellAddr = XLSX.utils.encode_cell({ r, c })
          const cell = sheet[cellAddr]
          const header = headers[c] || `col_${c}`
          if (!cell) {
            rowObj[header] = undefined
          } else if (cell.t === 'd' && cell.v instanceof Date) {
            // 日期类型单元格：优先使用 cell.w（Excel 格式化后的显示文本，如"2026年5月6日"、"2026/5/5 13:39"）
            // 这样与用户在 Excel 里看到的完全一致
            rowObj[header] = cell.w ? String(cell.w).trim() : cell.v
          } else {
            rowObj[header] = cell.v
          }
        }

        // 收集前10行预览
        if (previewRows.length < 10) {
          previewRows.push({ ...rowObj })
        }

        // 校验
        const rowErrors = validateRow(rowObj, r + 1)
        if (rowErrors.length > 0) {
          allErrors.push(...rowErrors)
        }

        // 标准化
        rows.push(normalizeRow(rowObj, batchId))

        if (r % 1000 === 0) {
          onProgress?.(40 + Math.floor((r / range.e.r) * 50))
        }
      }

      onProgress?.(95)

      resolve({
        rows,
        preview: {
          headers,
          rows: previewRows,
          totalRows,
          validRows: totalRows - new Set(allErrors.map((e) => e.row)).size,
          errors: allErrors,
        },
        allErrors,
      })
    } catch (err) {
      reject(err)
    }
  })
}
