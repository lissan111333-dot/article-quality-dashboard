<template>
  <div class="page-container">
    <div class="page-title">审核员维度分析</div>
    <div class="page-subtitle">按审核员追踪质量指标，识别质量薄弱环节</div>

    <!-- 筛选栏 -->
    <div class="filter-bar">
      <el-row :gutter="16" align="middle">
        <el-col :span="8">
          <div class="filter-label">质检时间范围</div>
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
            style="width: 100%"
          />
        </el-col>
        <el-col :span="6">
          <div class="filter-label">审核员姓名</div>
          <el-select
            v-model="filterAuditorName"
            clearable
            filterable
            placeholder="全部审核员"
            style="width: 100%"
          >
            <el-option v-for="n in dataStore.auditorList" :key="n" :label="n" :value="n" />
          </el-select>
        </el-col>
        <el-col :span="6" style="display:flex;align-items:flex-end;padding-top:20px;gap:8px">
          <el-button type="primary" @click="onQuery">查询</el-button>
          <el-button @click="resetFilter">重置</el-button>
          <el-button :icon="Download" @click="exportTable">导出</el-button>
        </el-col>
      </el-row>
    </div>

    <!-- 空状态 -->
    <div v-if="!dataStore.hasData" class="empty-state card">
      <el-icon size="64" class="empty-icon"><User /></el-icon>
      <p>暂无数据，请先上传数据文件</p>
      <el-button type="primary" @click="$router.push('/upload')">去上传数据</el-button>
    </div>

    <template v-else>
      <!-- 汇总指标 -->
      <el-row :gutter="16" class="mb-20">
        <el-col :span="6">
          <div class="mini-stat-card">
            <div class="mini-stat-num">{{ totalAuditors }}</div>
            <div class="mini-stat-label">参与质检审核员数</div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="mini-stat-card">
            <div class="mini-stat-num">{{ totalQcCount.toLocaleString() }}</div>
            <div class="mini-stat-label">总质检量</div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="mini-stat-card" style="border-left-color: var(--color-success)">
            <div class="mini-stat-num" style="color: var(--color-success)">{{ avgAccuracy }}%</div>
            <div class="mini-stat-label">平均准确率</div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="mini-stat-card" style="border-left-color: var(--color-danger)">
            <div class="mini-stat-num" style="color: var(--color-danger)">{{ maxErrorAuditor }}</div>
            <div class="mini-stat-label">最高错误率审核员</div>
          </div>
        </el-col>
      </el-row>

      <!-- 数据表格 -->
      <div class="card">
        <div class="table-header">
          <div class="table-title">审核员质量排名</div>
          <div class="table-info">共 {{ tableData.length }} 条记录</div>
        </div>

        <el-table
          :data="tableData"
          border
          style="width: 100%"
          v-loading="loading"
          :default-sort="{ prop: '准确率', order: 'descending' }"
          @sort-change="handleSortChange"
          :header-cell-style="headerCellStyle"
          :cell-style="cellStyleFn"
        >
          <!-- 基础信息列 -->
          <el-table-column prop="质检日期" label="质检日期范围" min-width="200" show-overflow-tooltip />
          <el-table-column prop="审核员RTX" label="审核员RTX" min-width="170" show-overflow-tooltip>
            <template #default="{ row }">
              <span class="rtx-link">{{ row.审核员RTX }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="审核员姓名" label="审核员姓名" width="100" />

          <!-- 数量列（浅橙背景） -->
          <el-table-column prop="审核量" label="审核量" width="85" sortable="custom" align="center" class-name="col-count" />
          <el-table-column prop="qc量" label="qc量" width="85" sortable="custom" align="center" class-name="col-count col-qc" />

          <el-table-column prop="错审量" label="错审量" width="85" sortable="custom" align="center" class-name="col-error">
            <template #default="{ row }">
              <span :class="row.错审量 > 0 ? 'num-error' : 'num-zero'">{{ row.错审量 }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="漏审量" label="漏审量" width="85" sortable="custom" align="center" class-name="col-error">
            <template #default="{ row }">
              <span :class="row.漏审量 > 0 ? 'num-error' : 'num-zero'">{{ row.漏审量 }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="归类错误量" label="归类错误量" width="100" sortable="custom" align="center" class-name="col-error">
            <template #default="{ row }">
              <span :class="row.归类错误量 > 0 ? 'num-error' : 'num-zero'">{{ row.归类错误量 }}</span>
            </template>
          </el-table-column>

          <el-table-column prop="总错误数" label="总错误数" width="95" sortable="custom" align="center" class-name="col-error">
            <template #default="{ row }">
              <span class="total-error-badge" :class="row.总错误数 === 0 ? 'badge-zero' : row.总错误数 >= 3 ? 'badge-high' : 'badge-mid'">
                {{ row.总错误数 }}
              </span>
            </template>
          </el-table-column>

          <el-table-column prop="审核正确量" label="审核正确量" width="100" sortable="custom" align="center" class-name="col-count" />

          <!-- 各项率列（粉红背景，与错误量一致） -->
          <el-table-column prop="错审率" label="错审率" width="90" sortable="custom" align="center" class-name="col-error">
            <template #default="{ row }">
              <span :class="row.错审率 > 0 ? 'num-error' : 'num-zero'">{{ row.错审率.toFixed(2) }}%</span>
            </template>
          </el-table-column>
          <el-table-column prop="漏审率" label="漏审率" width="90" sortable="custom" align="center" class-name="col-error">
            <template #default="{ row }">
              <span :class="row.漏审率 > 0 ? 'num-error' : 'num-zero'">{{ row.漏审率.toFixed(2) }}%</span>
            </template>
          </el-table-column>
          <el-table-column prop="归类错误率" label="归类错误率" width="100" sortable="custom" align="center" class-name="col-error">
            <template #default="{ row }">
              <span :class="row.归类错误率 > 0 ? 'num-error' : 'num-zero'">{{ row.归类错误率.toFixed(2) }}%</span>
            </template>
          </el-table-column>

          <!-- 正向准确率列（绿色背景） -->
          <el-table-column prop="文章分级准确率" label="文章分级准确率" width="120" sortable="custom" align="center">
            <template #default="{ row }">
              <span class="accuracy-text" :style="{ color: getAccuracyColor(row.文章分级准确率) }">{{ row.文章分级准确率.toFixed(2) }}%</span>
            </template>
          </el-table-column>
          <el-table-column prop="深度分级准确率" label="深度分级准确率" width="120" sortable="custom" align="center">
            <template #default="{ row }">
              <span class="accuracy-text" :style="{ color: getAccuracyColor(row.深度分级准确率) }">{{ row.深度分级准确率.toFixed(2) }}%</span>
            </template>
          </el-table-column>

          <el-table-column prop="准确率" label="准确率" width="110" sortable="custom" align="center" fixed="right" class-name="col-accuracy">
            <template #default="{ row }">
              <span class="accuracy-text" :style="{ color: getAccuracyColor(row.准确率) }">
                {{ row.准确率.toFixed(2) }}%
              </span>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <!-- 审核员准确率柱图 -->
      <div class="card mt-20">
        <div class="chart-header">
          <div class="chart-title">审核员准确率对比</div>
        </div>
        <div ref="barChartRef" class="chart-container-bar"></div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { Download, User } from '@element-plus/icons-vue'
import * as echarts from 'echarts'
import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'
dayjs.extend(customParseFormat)
import { useDataStore } from '@/stores/dataStore'
import { filterData, buildAuditorStats, exportToExcel } from '@/utils/metrics'
import type { AuditorStat } from '@/types'

const dataStore = useDataStore()
const loading = ref(false)
const dateRange = ref<[string, string] | null>(null)
const filterAuditorName = ref('')
const tableData = ref<AuditorStat[]>([])
const barChartRef = ref<HTMLDivElement>()
let barChart: echarts.ECharts | null = null

// 需要加彩色背景的列的 prop 集合
const COUNT_COLS = new Set(['审核量', 'qc量', '审核正确量'])
const ERROR_COLS = new Set(['错审量', '漏审量', '归类错误量', '总错误数', '错审率', '漏审率', '归类错误率'])
const POS_RATE_COLS = new Set(['文章分级准确率', '深度分级准确率'])
const ACCURACY_COL = '准确率'

// 表头样式：数量列橙色，错误列粉红，准确率列蓝色
function headerCellStyle({ column }: { column: { property: string } }) {
  if (COUNT_COLS.has(column.property)) {
    return { background: '#fff7e6', color: '#d46b08', fontWeight: 600, borderBottom: '2px solid #ffd591' }
  }
  if (ERROR_COLS.has(column.property)) {
    return { background: '#fff1f0', color: '#cf1322', fontWeight: 600, borderBottom: '2px solid #ffa39e' }
  }
  if (POS_RATE_COLS.has(column.property)) {
    return { background: '#f6ffed', color: '#389e0d', fontWeight: 600, borderBottom: '2px solid #b7eb8f' }
  }
  if (column.property === ACCURACY_COL) {
    return { background: '#e6f4ff', color: '#0958d9', fontWeight: 600, borderBottom: '2px solid #91caff' }
  }
  return {}
}

// 单元格背景：与表头对应
function cellStyleFn({ column }: { column: { property: string } }) {
  if (COUNT_COLS.has(column.property)) return { background: '#fffbe6' }
  if (ERROR_COLS.has(column.property)) return { background: '#fff5f5' }
  if (POS_RATE_COLS.has(column.property)) return { background: '#f9fff6' }
  if (column.property === ACCURACY_COL) return { background: '#f0f7ff' }
  return {}
}

// 汇总统计
const totalAuditors = computed(() => new Set(tableData.value.map((r) => r.审核员RTX)).size)
const totalQcCount = computed(() => tableData.value.reduce((s, r) => s + r.qc量, 0))
const avgAccuracy = computed(() => {
  if (!tableData.value.length) return '0.00'
  const avg = tableData.value.reduce((s, r) => s + r.准确率, 0) / tableData.value.length
  return avg.toFixed(2)
})
const maxErrorAuditor = computed(() => {
  if (!tableData.value.length) return '-'
  const sorted = [...tableData.value].sort((a, b) => b.总错误数 - a.总错误数)
  return sorted[0]?.审核员姓名 || '-'
})

function getAccuracyColor(val: number): string {
  if (val >= 90) return '#389e0d'
  if (val >= 80) return '#d46b08'
  return '#cf1322'
}

function onQuery() {
  loading.value = true
  try {
    let filtered = filterData(dataStore.cachedData, {
      dateRange: dateRange.value ?? undefined,
    })
    if (filterAuditorName.value) {
      filtered = filtered.filter((r) => r.审核人员 === filterAuditorName.value)
    }
    tableData.value = buildAuditorStats(filtered)
    nextTick(() => buildBarChart())
  } finally {
    loading.value = false
  }
}

function resetFilter() {
  const FORMATS = ['YYYY年M月D日','YYYY年MM月DD日','YYYY/M/D H:mm','YYYY/M/D HH:mm','YYYY/MM/DD HH:mm:ss','YYYY/MM/DD HH:mm','YYYY/M/D HH:mm:ss','YYYY/M/D','YYYY/MM/DD','YYYY-MM-DD HH:mm:ss','YYYY-MM-DD','YYYY-M-D']
  const parseFlex = (s: string) => { for (const f of FORMATS) { const d = dayjs(s, f, true); if (d.isValid()) return d } return dayjs(s).isValid() ? dayjs(s) : null }
  const dates = dataStore.cachedData.map(r => parseFlex(String(r.质检日期||''))).filter((d): d is dayjs.Dayjs => d !== null)
  if (dates.length > 0) {
    const min = dates.reduce((a,b)=>a.isBefore(b)?a:b)
    const max = dates.reduce((a,b)=>a.isAfter(b)?a:b)
    dateRange.value = [min.format('YYYY-MM-DD'), max.format('YYYY-MM-DD')]
  }
  filterAuditorName.value = ''
  onQuery()
}

function handleSortChange({ prop, order }: { prop: string; order: string | null }) {
  if (!prop) return
  tableData.value = [...tableData.value].sort((a: any, b: any) => {
    if (order === 'ascending') return a[prop] > b[prop] ? 1 : -1
    return a[prop] < b[prop] ? 1 : -1
  })
}

function buildBarChart() {
  if (!barChartRef.value) return
  if (!barChart) barChart = echarts.init(barChartRef.value)

  const topData = [...tableData.value].sort((a, b) => b.准确率 - a.准确率).slice(0, 20)
  const names = topData.map((r) => r.审核员姓名 || r.审核员RTX)
  const accuracies = topData.map((r) => r.准确率)

  barChart.setOption({
    tooltip: {
      trigger: 'axis',
      formatter: (params: any[]) =>
        `${params[0].name}<br/>准确率: <b>${params[0].value}%</b><br/>QC量: ${topData[params[0].dataIndex].qc量}`,
    },
    grid: { top: 20, right: 20, bottom: 60, left: 60 },
    xAxis: {
      type: 'category',
      data: names,
      axisLabel: { rotate: 30, fontSize: 11 },
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: 100,
      axisLabel: { formatter: '{value}%', fontSize: 11 },
      splitLine: { lineStyle: { color: '#f0f0f0' } },
    },
    series: [
      {
        name: '准确率',
        type: 'bar',
        data: accuracies,
        barMaxWidth: 40,
        itemStyle: {
          color: (params: any) => {
            const v = params.value
            if (v >= 90) return '#52c41a'
            if (v >= 80) return '#fa8c16'
            return '#ff4d4f'
          },
          borderRadius: [4, 4, 0, 0],
        },
        markLine: {
          data: [{ type: 'average', name: '平均' }],
          lineStyle: { color: '#1677ff', type: 'dashed' },
          label: { formatter: '平均: {c}%', color: '#1677ff' },
        },
      },
    ],
  })
}

function exportTable() {
  exportToExcel(
    tableData.value.map((r) => ({
      质检日期范围: r.质检日期,
      审核员RTX: r.审核员RTX,
      审核员姓名: r.审核员姓名,
      审核量: r.审核量,
      QC量: r.qc量,
      错审量: r.错审量,
      漏审量: r.漏审量,
      归类错误量: r.归类错误量,
      总错误数: r.总错误数,
      审核正确量: r.审核正确量,
      错审率: `${r.错审率.toFixed(2)}%`,
      漏审率: `${r.漏审率.toFixed(2)}%`,
      归类错误率: `${r.归类错误率.toFixed(2)}%`,
      文章分级准确率: `${r.文章分级准确率.toFixed(2)}%`,
      深度分级准确率: `${r.深度分级准确率.toFixed(2)}%`,
      准确率: `${r.准确率.toFixed(2)}%`,
    })),
    `审核员分析_${dayjs().format('YYYYMMDD')}`,
  )
}

function handleResize() { barChart?.resize() }

onMounted(async () => {
  await dataStore.init()
  if (dataStore.hasData) {
    const FORMATS = ['YYYY年M月D日','YYYY年MM月DD日','YYYY/M/D H:mm','YYYY/M/D HH:mm','YYYY/MM/DD HH:mm:ss','YYYY/MM/DD HH:mm','YYYY/M/D HH:mm:ss','YYYY/M/D','YYYY/MM/DD','YYYY-MM-DD HH:mm:ss','YYYY-MM-DD','YYYY-M-D']
    const parseFlex = (s: string) => { for (const f of FORMATS) { const d = dayjs(s, f, true); if (d.isValid()) return d } return dayjs(s).isValid() ? dayjs(s) : null }
    const dates = dataStore.cachedData.map(r => parseFlex(String(r.质检日期||''))).filter((d): d is dayjs.Dayjs => d !== null)
    if (dates.length > 0) {
      const min = dates.reduce((a,b)=>a.isBefore(b)?a:b)
      const max = dates.reduce((a,b)=>a.isAfter(b)?a:b)
      dateRange.value = [min.format('YYYY-MM-DD'), max.format('YYYY-MM-DD')]
    }
    onQuery()
  }
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  barChart?.dispose()
  window.removeEventListener('resize', handleResize)
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
.mini-stat-card {
  background: var(--color-bg-card);
  border-radius: var(--border-radius-md);
  padding: 16px 20px;
  border-left: 3px solid var(--color-primary);
  box-shadow: var(--shadow-sm);
}
.mini-stat-num {
  font-size: 26px;
  font-weight: 700;
  color: var(--color-primary);
}
.mini-stat-label {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-top: 4px;
}

.table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.table-title {
  font-size: 15px;
  font-weight: 600;
}
.table-info {
  font-size: 13px;
  color: var(--color-text-secondary);
}

/* RTX 链接样式（蓝色超链接感） */
.rtx-link {
  color: #1677ff;
  font-size: 13px;
}

/* 错误数字：红色加粗 */
.num-error {
  color: #cf1322;
  font-weight: 700;
  font-size: 14px;
}
.num-zero {
  color: #8c8c8c;
  font-size: 14px;
}

/* 总错误数 badge */
.total-error-badge {
  display: inline-block;
  min-width: 24px;
  height: 24px;
  line-height: 24px;
  text-align: center;
  border-radius: 12px;
  font-weight: 700;
  font-size: 13px;
  padding: 0 6px;
}
.badge-zero {
  background: #f6ffed;
  color: #389e0d;
  border: 1px solid #b7eb8f;
}
.badge-mid {
  background: #fff7e6;
  color: #d46b08;
  border: 1px solid #ffd591;
}
.badge-high {
  background: #fff1f0;
  color: #cf1322;
  border: 1px solid #ffa39e;
}

/* 准确率文字 */
.accuracy-text {
  font-weight: 700;
  font-size: 14px;
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.chart-title {
  font-size: 15px;
  font-weight: 600;
}
.chart-container-bar { height: 300px; }
.mt-20 { margin-top: 20px; }
</style>
