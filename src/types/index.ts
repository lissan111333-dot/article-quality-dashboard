/**
 * 核心数据类型定义
 */

// ===================== 原始数据行 =====================
export interface RawDataRow {
  // 审核基础类
  质检日期: string
  审核时间: string
  文章标题?: string
  文章链接: string
  audit_id: string
  audit_label_1: string
  audit_label_2: string
  审核总分: number
  审核结果: string
  审核RTX: string
  审核人员: string

  // 质检基础类
  质检总分: number
  质检结果: string
  '质检标签 1 子列 - 主旨清晰': number
  '质检标签 1 子列 - 表达流畅': number
  '质检标签 1 子列 - 排版优美': number
  '质检标签 1 子列 - 观点独特': number
  '质检标签 1 子列 - 内容独特': number
  '质检标签 1 子列 - 专业性强': number
  '质检标签 2 子列 - 信息价值': number
  '质检标签 2 子列 - 决策价值': number
  '质检标签 2 子列 - 情感归属价值': number
  '质检标签 2 子列 - 审美价值': number
  '质检标签 2 子列 - 求知价值': number
  qc_conclusion: QcConclusion
  质检人: string
  是否申诉: YesNo
  申诉理由?: string
  申诉是否通过?: YesNo
  理由?: string

  // 内部行号（解析后附加）
  _rowIndex?: number
  // 批次ID
  _batchId?: string
}

// ===================== 枚举类型 =====================
export type QcConclusion = '正确' | '错审' | '漏审' | '归类错误'
export type YesNo = '是' | '否'
export type AuditResult = '低质/删除' | '普通' | '低价值' | '高价值'
export type UploadMode = 'append' | 'overwrite'

// ===================== 上传批次记录 =====================
export interface UploadBatch {
  id: string
  fileName: string
  uploadTime: string
  dataCount: number
  mode: UploadMode
  status: 'success' | 'failed'
  operator?: string
}

// ===================== 指标卡数据 =====================
export interface MetricCard {
  label: string
  value: number
  prevValue?: number
  unit: string
  type: 'positive' | 'negative'
  description?: string
}

// ===================== 审核员统计 =====================
export interface AuditorStat {
  质检日期: string
  对应审核日期: string
  审核员RTX: string
  审核员姓名: string
  审核量: number
  qc量: number
  错审量: number
  漏审量: number
  归类错误量: number
  总错误数: number
  审核正确量: number
  准确率: number
  错审率: number
  漏审率: number
  归类错误率: number
  文章分级准确率: number
  深度分级准确率: number
}

// ===================== 标签 Diff 分析 =====================
export interface LabelDiffItem {
  labelGroup: '标签1' | '标签2'
  labelName: string
  totalCount: number    // 总归类错误样本中含该标签的数量
  overJudge: number     // 误判（多给了）
  missJudge: number     // 漏判（少给了）
  overRate: number
  missRate: number
}

// ===================== 筛选条件 =====================
export interface FilterCondition {
  dateRange?: [string, string]
  qcConclusion?: QcConclusion[]
  auditResult?: string[]
  qcResult?: string[]
  auditorName?: string
  auditorRtx?: string
  labelName?: string
}

// ===================== 校验错误 =====================
export interface ValidationError {
  row: number
  field: string
  message: string
  value?: unknown
}

// ===================== 解析预览 =====================
export interface ParsePreview {
  headers: string[]
  rows: Record<string, unknown>[]
  totalRows: number
  validRows: number
  errors: ValidationError[]
}

// ===================== 标签定义 =====================
export const LABEL_1_FIELDS = [
  '质检标签 1 子列 - 主旨清晰',
  '质检标签 1 子列 - 表达流畅',
  '质检标签 1 子列 - 排版优美',
  '质检标签 1 子列 - 观点独特',
  '质检标签 1 子列 - 内容独特',
  '质检标签 1 子列 - 专业性强',
] as const

export const LABEL_2_FIELDS = [
  '质检标签 2 子列 - 信息价值',
  '质检标签 2 子列 - 决策价值',
  '质检标签 2 子列 - 情感归属价值',
  '质检标签 2 子列 - 审美价值',
  '质检标签 2 子列 - 求知价值',
] as const

export const LABEL_1_NAMES = ['主旨清晰', '表达流畅', '排版优美', '观点独特', '内容独特', '专业性强'] as const
export const LABEL_2_NAMES = ['信息价值', '决策价值', '情感归属价值', '审美价值', '求知价值'] as const

// audit_label JSON结构
export interface AuditLabelJson {
  list: string[]
}

// 必填字段列表
export const REQUIRED_FIELDS = [
  '质检日期', '审核时间', '文章链接', 'audit_id',
  'audit_label_1', 'audit_label_2', '审核总分', '审核结果',
  '审核RTX', '审核人员', '质检总分', '质检结果',
  '质检标签 1 子列 - 主旨清晰', '质检标签 1 子列 - 表达流畅',
  '质检标签 1 子列 - 排版优美', '质检标签 1 子列 - 观点独特',
  '质检标签 1 子列 - 内容独特', '质检标签 1 子列 - 专业性强',
  '质检标签 2 子列 - 信息价值', '质检标签 2 子列 - 决策价值',
  '质检标签 2 子列 - 情感归属价值', '质检标签 2 子列 - 审美价值',
  '质检标签 2 子列 - 求知价值', 'qc_conclusion', '质检人',
  // 是否申诉 / 申诉理由 / 申诉是否通过 / 理由 均为选填，不做必填校验
]
