<template>
  <div class="page-container">
    <div class="page-title">数据明细查询</div>
    <div class="page-subtitle">支持多条件组合筛选、全量原始数据查询与导出</div>

    <!-- 高级筛选面板 -->
    <div class="filter-bar">
      <el-row :gutter="16">
        <el-col :span="6">
          <div class="filter-label">质检日期</div>
          <el-date-picker
            v-model="filter.dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
            style="width: 100%"
          />
        </el-col>
        <el-col :span="4">
          <div class="filter-label">质检结论</div>
          <el-select v-model="filter.qcConclusion" multiple clearable placeholder="全部" style="width:100%">
            <el-option label="正确" value="正确" />
            <el-option label="错审" value="错审" />
            <el-option label="漏审" value="漏审" />
            <el-option label="归类错误" value="归类错误" />
          </el-select>
        </el-col>
        <el-col :span="4">
          <div class="filter-label">审核结果</div>
          <el-select v-model="filter.auditResult" multiple clearable placeholder="全部" style="width:100%">
            <el-option v-for="r in resultOptions" :key="r" :label="r" :value="r" />
          </el-select>
        </el-col>
        <el-col :span="4">
          <div class="filter-label">质检结果</div>
          <el-select v-model="filter.qcResult" multiple clearable placeholder="全部" style="width:100%">
            <el-option v-for="r in resultOptions" :key="r" :label="r" :value="r" />
          </el-select>
        </el-col>
        <el-col :span="4">
          <div class="filter-label">审核员</div>
          <el-select v-model="filter.auditorName" clearable filterable placeholder="全部" style="width:100%">
            <el-option v-for="n in dataStore.auditorList" :key="n" :label="n" :value="n" />
          </el-select>
        </el-col>
      </el-row>
      <el-row :gutter="16" style="margin-top: 12px">
        <el-col :span="5">
          <div class="filter-label">文章标题（模糊搜索）</div>
          <el-input v-model="filter.titleKeyword" placeholder="输入关键词" clearable />
        </el-col>
        <el-col :span="5">
          <div class="filter-label">文章链接（模糊搜索）</div>
          <el-input v-model="filter.linkKeyword" placeholder="输入URL关键词" clearable />
        </el-col>
        <el-col :span="4">
          <div class="filter-label">是否申诉</div>
          <el-select v-model="filter.isAppeal" clearable placeholder="全部" style="width:100%">
            <el-option label="是" value="是" />
            <el-option label="否" value="否" />
            <el-option label="未填写" value="__empty__" />
          </el-select>
        </el-col>
        <el-col :span="4">
          <div class="filter-label">audit_id（精准）</div>
          <el-input v-model="filter.auditId" placeholder="输入ID" clearable />
        </el-col>
        <el-col :span="6" style="display:flex;align-items:flex-end;padding-top:20px;gap:8px;flex-wrap:wrap">
          <el-button type="primary" :icon="Search" @click="onQuery">查询</el-button>
          <el-button :icon="RefreshLeft" @click="resetFilter">重置</el-button>
          <el-button :icon="Download" @click="exportSelected" :disabled="!selectedRows.length">
            导出选中 ({{ selectedRows.length }})
          </el-button>
          <el-button :icon="Download" type="success" @click="exportAll">导出全部</el-button>
        </el-col>
      </el-row>
    </div>

    <!-- 空状态 -->
    <div v-if="!dataStore.hasData" class="empty-state card">
      <el-icon size="64" class="empty-icon"><List /></el-icon>
      <p>暂无数据，请先上传数据文件</p>
      <el-button type="primary" @click="$router.push('/upload')">去上传数据</el-button>
    </div>

    <template v-else>
      <!-- 列设置 & 统计 -->
      <div class="table-toolbar card mb-16">
        <div class="toolbar-left">
          <span class="result-info">
            查询结果：<b>{{ filteredTotal }}</b> 条 / 共 {{ dataStore.totalCount.toLocaleString() }} 条
          </span>
          <el-tag v-if="selectedRows.length > 0" type="primary" style="margin-left: 10px">
            已选 {{ selectedRows.length }} 条
          </el-tag>
        </div>
        <!-- 汇总统计区块（两行卡片式） -->
        <div class="summary-block">
          <!-- 第一行：质检结论 -->
          <div class="summary-row">
            <span class="row-title">质检结论</span>
            <div class="stat-pill total">
              <span class="pill-label">总质检</span>
              <span class="pill-num">{{ filteredTotal }}</span>
              <span class="pill-unit">条</span>
            </div>
            <div class="stat-pill correct">
              <span class="pill-label">正确</span>
              <span class="pill-num">{{ conclusionStats.correct }}</span>
              <span class="pill-unit">条</span>
            </div>
            <div class="stat-pill wrong">
              <span class="pill-label">错审</span>
              <span class="pill-num">{{ conclusionStats.wrong }}</span>
              <span class="pill-unit">条</span>
            </div>
            <div class="stat-pill miss">
              <span class="pill-label">漏审</span>
              <span class="pill-num">{{ conclusionStats.miss }}</span>
              <span class="pill-unit">条</span>
            </div>
            <div class="stat-pill category">
              <span class="pill-label">归类错误</span>
              <span class="pill-num">{{ conclusionStats.categoryError }}</span>
              <span class="pill-unit">条</span>
            </div>
          </div>
          <!-- 第二行：质检结果分布 -->
          <div class="summary-row">
            <span class="row-title">质检结果</span>
            <div v-for="item in qcResultStats" :key="item.label" :class="['stat-pill', 'qc-' + item.color]">
              <span class="pill-label">{{ item.label }}</span>
              <span class="pill-num">{{ item.count }}</span>
              <span class="pill-unit">条</span>
              <span class="pill-pct">{{ item.pct }}%</span>
            </div>
          </div>
        </div>
        <div class="toolbar-right">
          <el-popover placement="bottom" :width="300" trigger="click">
            <template #reference>
              <el-button size="small" :icon="Setting">列设置</el-button>
            </template>
            <div class="col-settings">
              <el-checkbox
                v-for="col in allColumns"
                :key="col.key"
                v-model="visibleCols[col.key]"
                style="display: block; margin-bottom: 6px"
              >
                {{ col.label }}
              </el-checkbox>
            </div>
          </el-popover>
        </div>
      </div>

      <!-- 主数据表 -->
      <div class="card">
        <el-table
          ref="tableRef"
          :data="pagedData"
          border
          stripe
          style="width: 100%"
          v-loading="loading"
          height="500"
          @selection-change="handleSelectionChange"
          @sort-change="handleSortChange"
        >
          <el-table-column type="selection" width="50" fixed="left" />
          <el-table-column type="index" label="序号" width="60" fixed="left" :index="(i: number) => (currentPage - 1) * pageSize + i + 1" />

          <template v-for="col in visibleColumns" :key="col.key">
            <el-table-column
              :prop="col.key"
              :label="col.label"
              :min-width="col.width || 120"
              :sortable="col.sortable ? 'custom' : false"
              show-overflow-tooltip
              :fixed="col.fixed"
            >
              <template v-if="col.key === 'qc_conclusion'" #default="{ row }">
                <el-tag
                  :type="conclusionTagType(row.qc_conclusion)"
                  size="small"
                >
                  {{ row.qc_conclusion }}
                </el-tag>
              </template>
              <template v-else-if="col.key === '是否申诉'" #default="{ row }">
                <el-tag v-if="row.是否申诉" :type="row.是否申诉 === '是' ? 'warning' : 'info'" size="small">
                  {{ row.是否申诉 }}
                </el-tag>
                <span v-else style="color:#bbb;font-size:12px">-</span>
              </template>
              <template v-else-if="col.key === '文章链接'" #default="{ row }">
                <a :href="row.文章链接" target="_blank" class="link" @click.stop>查看</a>
              </template>
              <template v-else-if="col.key === '审核总分' || col.key === '质检总分'" #default="{ row }">
                <el-tag type="primary" size="small">{{ row[col.key] }}</el-tag>
              </template>
            </el-table-column>
          </template>
        </el-table>

        <!-- 分页 -->
        <div class="pagination-bar">
          <el-pagination
            v-model:current-page="currentPage"
            v-model:page-size="pageSize"
            :page-sizes="[20, 50, 100, 200]"
            :total="filteredTotal"
            layout="total, sizes, prev, pager, next, jumper"
            background
            @current-change="onPageChange"
            @size-change="onSizeChange"
          />
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted, watch } from 'vue'
import { Download, Search, RefreshLeft, Setting, List } from '@element-plus/icons-vue'
import type { ElTable } from 'element-plus'
import dayjs from 'dayjs'
import { useDataStore } from '@/stores/dataStore'
import { filterData, exportToExcel } from '@/utils/metrics'
import type { RawDataRow } from '@/types'

const dataStore = useDataStore()
const loading = ref(false)
const tableRef = ref<InstanceType<typeof ElTable>>()
const currentPage = ref(1)
const pageSize = ref(50)
const selectedRows = ref<RawDataRow[]>([])
const allFilteredData = ref<RawDataRow[]>([])

const resultOptions = ['低质/删除', '普通', '低价值', '高价值']

// 筛选条件
const filter = reactive({
  dateRange: null as [string, string] | null,
  qcConclusion: [] as string[],
  auditResult: [] as string[],
  qcResult: [] as string[],
  auditorName: '',
  titleKeyword: '',
  linkKeyword: '',
  isAppeal: '',
  auditId: '',
})

// 所有列定义
const allColumns = [
  { key: '质检日期', label: '质检日期', width: 110, sortable: true },
  { key: '审核时间', label: '审核时间', width: 130, sortable: true },
  { key: 'audit_id', label: 'audit_id', width: 120 },
  { key: '文章标题', label: '文章标题', width: 180 },
  { key: '文章链接', label: '文章链接', width: 80 },
  { key: '审核人员', label: '审核人员', width: 90 },
  { key: '审核RTX', label: '审核RTX', width: 160 },
  { key: '审核结果', label: '审核结果', width: 100 },
  { key: '审核总分', label: '审核总分', width: 85, sortable: true },
  // 审核标签
  { key: 'audit_label_1', label: '审核标签1（原始）', width: 200 },
  { key: 'audit_label_2', label: '审核标签2（原始）', width: 200 },
  { key: '质检人', label: '质检人', width: 90 },
  { key: '质检结果', label: '质检结果', width: 100 },
  { key: '质检总分', label: '质检总分', width: 85, sortable: true },
  // 质检标签1子列
  { key: '质检标签 1 子列 - 主旨清晰', label: '质检标签1-主旨清晰', width: 120 },
  { key: '质检标签 1 子列 - 表达流畅', label: '质检标签1-表达流畅', width: 120 },
  { key: '质检标签 1 子列 - 排版优美', label: '质检标签1-排版优美', width: 120 },
  { key: '质检标签 1 子列 - 观点独特', label: '质检标签1-观点独特', width: 120 },
  { key: '质检标签 1 子列 - 内容独特', label: '质检标签1-内容独特', width: 120 },
  { key: '质检标签 1 子列 - 专业性强', label: '质检标签1-专业性强', width: 120 },
  // 质检标签2子列
  { key: '质检标签 2 子列 - 信息价值', label: '质检标签2-信息价值', width: 120 },
  { key: '质检标签 2 子列 - 决策价值', label: '质检标签2-决策价值', width: 120 },
  { key: '质检标签 2 子列 - 情感归属价值', label: '质检标签2-情感归属价值', width: 140 },
  { key: '质检标签 2 子列 - 审美价值', label: '质检标签2-审美价值', width: 120 },
  { key: '质检标签 2 子列 - 求知价值', label: '质检标签2-求知价值', width: 120 },
  { key: 'qc_conclusion', label: '质检结论', width: 100, fixed: 'right' as const },
  { key: '是否申诉', label: '是否申诉', width: 90 },
  { key: '申诉理由', label: '申诉理由', width: 150 },
  { key: '申诉是否通过', label: '申诉是否通过', width: 110 },
  { key: '理由', label: '申诉回复理由', width: 150 },
]

// 默认隐藏的列（标签列默认收起，需要时通过列设置勾选）
const DEFAULT_HIDDEN = new Set([
  '申诉理由', '申诉是否通过', '理由', 'audit_id', '审核RTX',
  'audit_label_1', 'audit_label_2',
  '质检标签 1 子列 - 主旨清晰', '质检标签 1 子列 - 表达流畅',
  '质检标签 1 子列 - 排版优美', '质检标签 1 子列 - 观点独特',
  '质检标签 1 子列 - 内容独特', '质检标签 1 子列 - 专业性强',
  '质检标签 2 子列 - 信息价值', '质检标签 2 子列 - 决策价值',
  '质检标签 2 子列 - 情感归属价值', '质检标签 2 子列 - 审美价值',
  '质检标签 2 子列 - 求知价值',
])

// 列显示控制
const visibleCols = reactive<Record<string, boolean>>(
  Object.fromEntries(allColumns.map((c) => [c.key, !DEFAULT_HIDDEN.has(c.key)])),
)

const visibleColumns = computed(() => allColumns.filter((c) => visibleCols[c.key]))

// 计算过滤后总数
const filteredTotal = computed(() => allFilteredData.value.length)

// 质检结论汇总统计（随筛选结果实时更新）
const conclusionStats = computed(() => {
  const data = allFilteredData.value
  return {
    correct: data.filter((r) => r.qc_conclusion === '正确').length,
    wrong: data.filter((r) => r.qc_conclusion === '错审').length,
    miss: data.filter((r) => r.qc_conclusion === '漏审').length,
    categoryError: data.filter((r) => r.qc_conclusion === '归类错误').length,
  }
})

// 质检结果分布统计（低质/删除 / 低价值 / 普通 / 高价值）
const qcResultStats = computed(() => {
  const data = allFilteredData.value
  const total = data.length
  const count = (key: string) => data.filter((r) => r.质检结果 === key).length
  const pct = (n: number) => total > 0 ? ((n / total) * 100).toFixed(1) : '0.0'
  const low = count('低质/删除')
  const lowVal = count('低价值')
  const normal = count('普通')
  const high = count('高价值')
  return [
    { label: '低质/删除', count: low,    pct: pct(low),    color: 'danger'  },
    { label: '低价值',    count: lowVal, pct: pct(lowVal), color: 'warning' },
    { label: '普通',      count: normal, pct: pct(normal), color: 'info'    },
    { label: '高价值',    count: high,   pct: pct(high),   color: 'success' },
  ]
})

// 当前页数据
const pagedData = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return allFilteredData.value.slice(start, start + pageSize.value)
})

function conclusionTagType(v: string): 'success' | 'danger' | 'warning' | 'info' {
  const map: Record<string, 'success' | 'danger' | 'warning' | 'info'> = {
    '正确': 'success', '错审': 'danger', '漏审': 'warning', '归类错误': 'info',
  }
  return map[v] || 'info'
}

function onQuery() {
  loading.value = true
  currentPage.value = 1

  try {
    let result = filterData(dataStore.cachedData, {
      dateRange: filter.dateRange || undefined,
      qcConclusion: filter.qcConclusion.length ? filter.qcConclusion as any : undefined,
      auditResult: filter.auditResult.length ? filter.auditResult : undefined,
      qcResult: filter.qcResult.length ? filter.qcResult : undefined,
      auditorName: filter.auditorName || undefined,
    })

    // 附加模糊搜索
    if (filter.titleKeyword) {
      result = result.filter((r) => r.文章标题?.includes(filter.titleKeyword))
    }
    if (filter.linkKeyword) {
      result = result.filter((r) => r.文章链接?.includes(filter.linkKeyword))
    }
    if (filter.isAppeal) {
      if (filter.isAppeal === '__empty__') {
        result = result.filter((r) => !r.是否申诉 || r.是否申诉.trim() === '')
      } else {
        result = result.filter((r) => r.是否申诉 === filter.isAppeal)
      }
    }
    if (filter.auditId) {
      result = result.filter((r) => r.audit_id === filter.auditId)
    }

    allFilteredData.value = result
  } finally {
    loading.value = false
  }
}

function resetFilter() {
  filter.dateRange = null
  filter.qcConclusion = []
  filter.auditResult = []
  filter.qcResult = []
  filter.auditorName = ''
  filter.titleKeyword = ''
  filter.linkKeyword = ''
  filter.isAppeal = ''
  filter.auditId = ''
  onQuery()
}

function onPageChange(page: number) {
  currentPage.value = page
}

function onSizeChange(size: number) {
  pageSize.value = size
  currentPage.value = 1
}

let sortKey = ''
let sortOrder = ''

function handleSortChange({ prop, order }: { prop: string; order: string | null }) {
  sortKey = prop
  sortOrder = order || ''

  if (!prop) {
    onQuery()
    return
  }

  allFilteredData.value = [...allFilteredData.value].sort((a: any, b: any) => {
    const av = a[prop]
    const bv = b[prop]
    if (order === 'ascending') {
      return av > bv ? 1 : av < bv ? -1 : 0
    } else {
      return av < bv ? 1 : av > bv ? -1 : 0
    }
  })
}

function handleSelectionChange(rows: RawDataRow[]) {
  selectedRows.value = rows
}

function rowToExportObj(r: RawDataRow) {
  return {
    质检日期: r.质检日期,
    审核时间: r.审核时间,
    audit_id: r.audit_id,
    文章标题: r.文章标题 || '',
    文章链接: r.文章链接,
    审核人员: r.审核人员,
    审核RTX: r.审核RTX,
    审核结果: r.审核结果,
    审核总分: r.审核总分,
    审核标签1: r.audit_label_1,
    审核标签2: r.audit_label_2,
    质检人: r.质检人,
    质检结果: r.质检结果,
    质检总分: r.质检总分,
    '质检标签1-主旨清晰': r['质检标签 1 子列 - 主旨清晰'],
    '质检标签1-表达流畅': r['质检标签 1 子列 - 表达流畅'],
    '质检标签1-排版优美': r['质检标签 1 子列 - 排版优美'],
    '质检标签1-观点独特': r['质检标签 1 子列 - 观点独特'],
    '质检标签1-内容独特': r['质检标签 1 子列 - 内容独特'],
    '质检标签1-专业性强': r['质检标签 1 子列 - 专业性强'],
    '质检标签2-信息价值': r['质检标签 2 子列 - 信息价值'],
    '质检标签2-决策价值': r['质检标签 2 子列 - 决策价值'],
    '质检标签2-情感归属价值': r['质检标签 2 子列 - 情感归属价值'],
    '质检标签2-审美价值': r['质检标签 2 子列 - 审美价值'],
    '质检标签2-求知价值': r['质检标签 2 子列 - 求知价值'],
    qc_conclusion: r.qc_conclusion,
    是否申诉: r.是否申诉,
    申诉理由: r.申诉理由 || '',
    申诉是否通过: r.申诉是否通过 || '',
    理由: r.理由 || '',
  }
}

function exportSelected() {
  if (!selectedRows.value.length) return
  exportToExcel(selectedRows.value.map(rowToExportObj), `数据明细_选中_${dayjs().format('YYYYMMDD')}`)
}

function exportAll() {
  exportToExcel(allFilteredData.value.map(rowToExportObj), `数据明细_全部_${dayjs().format('YYYYMMDD')}`)
}

onMounted(async () => {
  await dataStore.init()
  if (dataStore.hasData) onQuery()
})

watch(() => dataStore.cachedData, () => {
  if (dataStore.hasData) onQuery()
}, { deep: false })
</script>

<style scoped>
.filter-label {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-bottom: 4px;
  font-weight: 500;
}

.table-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 14px 16px;
  flex-wrap: wrap;
  gap: 10px;
}

/* ── 汇总统计块 ── */
.summary-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.summary-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: nowrap;
}

.row-title {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-secondary);
  white-space: nowrap;
  min-width: 48px;
  letter-spacing: 0.5px;
}

/* ── 统计 pill 基础样式 ── */
.stat-pill {
  display: inline-flex;
  align-items: baseline;
  gap: 2px;
  padding: 3px 10px;
  border-radius: 20px;
  white-space: nowrap;
  border-left: 3px solid transparent;
  background: #f5f7fa;
  line-height: 1.4;
}

.pill-label {
  font-size: 12px;
  color: #888;
  margin-right: 3px;
}
.pill-num {
  font-size: 15px;
  font-weight: 700;
}
.pill-unit {
  font-size: 11px;
  color: #aaa;
}
.pill-pct {
  font-size: 11px;
  font-weight: 500;
  margin-left: 3px;
  opacity: 0.75;
}

/* 质检结论各色 */
.stat-pill.total    { border-left-color: #1677ff; background: #e6f4ff; }
.stat-pill.total    .pill-num { color: #1677ff; }
.stat-pill.correct  { border-left-color: #389e0d; background: #f6ffed; }
.stat-pill.correct  .pill-num { color: #389e0d; }
.stat-pill.wrong    { border-left-color: #cf1322; background: #fff1f0; }
.stat-pill.wrong    .pill-num { color: #cf1322; }
.stat-pill.miss     { border-left-color: #d46b08; background: #fff7e6; }
.stat-pill.miss     .pill-num { color: #d46b08; }
.stat-pill.category { border-left-color: #531dab; background: #f9f0ff; }
.stat-pill.category .pill-num { color: #531dab; }

/* 质检结果各色 */
.stat-pill.qc-danger  { border-left-color: #cf1322; background: #fff1f0; }
.stat-pill.qc-danger  .pill-num, .stat-pill.qc-danger  .pill-pct { color: #cf1322; }
.stat-pill.qc-warning { border-left-color: #d46b08; background: #fff7e6; }
.stat-pill.qc-warning .pill-num, .stat-pill.qc-warning .pill-pct { color: #d46b08; }
.stat-pill.qc-info    { border-left-color: #0958d9; background: #e6f4ff; }
.stat-pill.qc-info    .pill-num, .stat-pill.qc-info    .pill-pct { color: #0958d9; }
.stat-pill.qc-success { border-left-color: #389e0d; background: #f6ffed; }
.stat-pill.qc-success .pill-num, .stat-pill.qc-success .pill-pct { color: #389e0d; }

.toolbar-right {
  display: flex;
  align-items: flex-start;
  padding-top: 2px;
}
.toolbar-left {
  display: flex;
  align-items: center;
  gap: 8px;
}
.result-info {
  font-size: 13px;
  color: var(--color-text-secondary);
}
.result-info b {
  color: var(--color-primary);
  font-size: 15px;
}

.pagination-bar {
  padding: 16px 0 4px;
  display: flex;
  justify-content: flex-end;
}

.link {
  color: var(--color-primary);
  text-decoration: none;
  font-size: 12px;
}
.link:hover { text-decoration: underline; }

.col-settings {
  padding: 8px 0;
  max-height: 300px;
  overflow-y: auto;
}

.mb-16 { margin-bottom: 16px; }
</style>
