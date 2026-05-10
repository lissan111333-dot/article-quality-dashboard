<template>
  <div class="page-container">
    <div class="flex justify-between items-center mb-20">
      <div>
        <div class="page-title">质量数据总览看板</div>
        <div class="page-subtitle">基于质检日期的核心质量指标全览，支持多维度筛选</div>
      </div>
      <div class="flex gap-12">
        <el-button :icon="Upload" @click="$router.push('/upload')">上传新数据</el-button>
        <el-button type="primary" :icon="Download" @click="exportDashboard">导出看板明细</el-button>
      </div>
    </div>

    <!-- 筛选栏 -->
    <div class="filter-bar">
      <el-row :gutter="16" align="middle">
        <el-col :span="8">
          <div class="filter-label">时间范围（质检日期）</div>
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
            style="width: 100%"
            @change="onFilterChange"
          />
        </el-col>
        <el-col :span="4">
          <div class="filter-label">质检结论</div>
          <el-select v-model="filterQcConclusion" multiple clearable placeholder="全部" style="width:100%" @change="onFilterChange">
            <el-option label="正确" value="正确" />
            <el-option label="错审" value="错审" />
            <el-option label="漏审" value="漏审" />
            <el-option label="归类错误" value="归类错误" />
          </el-select>
        </el-col>
        <el-col :span="4">
          <div class="filter-label">审核结果</div>
          <el-select v-model="filterAuditResult" multiple clearable placeholder="全部" style="width:100%" @change="onFilterChange">
            <el-option v-for="r in auditResultOptions" :key="r" :label="r" :value="r" />
          </el-select>
        </el-col>
        <el-col :span="4">
          <div class="filter-label">质检结果</div>
          <el-select v-model="filterQcResult" multiple clearable placeholder="全部" style="width:100%" @change="onFilterChange">
            <el-option v-for="r in auditResultOptions" :key="r" :label="r" :value="r" />
          </el-select>
        </el-col>
        <el-col :span="4" style="display:flex;align-items:flex-end;padding-top:20px;gap:8px">
          <el-button @click="resetFilter">重置</el-button>
        </el-col>
      </el-row>
    </div>

    <!-- 空状态 -->
    <div v-if="!dataStore.hasData" class="empty-state card">
      <el-icon size="64" class="empty-icon"><DataAnalysis /></el-icon>
      <p>暂无质量数据</p>
      <p style="font-size:13px; color: var(--color-text-disabled)">请先上传数据文件</p>
      <el-button type="primary" @click="$router.push('/upload')">去上传数据</el-button>
    </div>

    <template v-else>
      <!-- 核心指标卡 -->
      <div v-loading="loading">
        <div class="metrics-section">
          <div class="metrics-group-title positive-group">
            <el-icon color="#00b96b"><TrendCharts /></el-icon>
            正向达标指标
            <span class="group-hint">数值越高质量越好</span>
          </div>
          <div class="metrics-grid-3">
            <MetricCard v-for="card in positiveCards" :key="card.label" :card="card" />
          </div>
        </div>

        <div class="metrics-section">
          <div class="metrics-group-title negative-group">
            <el-icon color="#ff4d4f"><Warning /></el-icon>
            负向风险指标
            <span class="group-hint">数值越低风险越小</span>
          </div>
          <div class="metrics-grid-3">
            <MetricCard v-for="card in negativeCards" :key="card.label" :card="card" />
          </div>
        </div>

        <!-- 统计摘要 -->
        <div class="summary-bar card mb-20">
          <div class="summary-item">
            <span class="summary-num">{{ filteredData.length.toLocaleString() }}</span>
            <span class="summary-label">有效质检总样本</span>
          </div>
          <div class="summary-divider"></div>
          <div class="summary-item">
            <span class="summary-num">{{ correctCount.toLocaleString() }}</span>
            <span class="summary-label">审核正确</span>
          </div>
          <div class="summary-divider"></div>
          <div class="summary-item" style="color: var(--color-danger)">
            <span class="summary-num">{{ wrongCount.toLocaleString() }}</span>
            <span class="summary-label">错审</span>
          </div>
          <div class="summary-divider"></div>
          <div class="summary-item" style="color: var(--color-warning)">
            <span class="summary-num">{{ missCount.toLocaleString() }}</span>
            <span class="summary-label">漏审</span>
          </div>
          <div class="summary-divider"></div>
          <div class="summary-item" style="color: #722ed1">
            <span class="summary-num">{{ categoryErrorCount.toLocaleString() }}</span>
            <span class="summary-label">归类错误</span>
          </div>
        </div>

        <!-- 图表区域 -->
        <div class="charts-grid">
          <!-- 趋势图 -->
          <div class="card chart-card">
            <div class="chart-header">
              <div class="chart-title">准确率趋势</div>
              <div class="chart-actions">
                <el-radio-group v-model="trendGranularity" size="small" @change="buildCharts">
                  <el-radio-button value="day">按日</el-radio-button>
                  <el-radio-button value="week">按周</el-radio-button>
                  <el-radio-button value="month">按月</el-radio-button>
                </el-radio-group>
                <el-button size="small" :icon="Download" text @click="exportTrendData">导出</el-button>
              </div>
            </div>
            <div ref="trendChartRef" class="chart-container"></div>
          </div>

          <!-- 分布饼图 -->
          <div class="card chart-card">
            <div class="chart-header">
              <div class="chart-title">质检结论分布</div>
              <el-button size="small" :icon="Download" text @click="exportPieData">导出</el-button>
            </div>
            <div ref="pieChartRef" class="chart-container"></div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { Upload, Download, Warning, TrendCharts, DataAnalysis } from '@element-plus/icons-vue'
import * as echarts from 'echarts'
import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'
dayjs.extend(customParseFormat)
import MetricCard from '@/components/MetricCard.vue'
import { useDataStore } from '@/stores/dataStore'
import { filterData, calcMetrics, buildMetricCards, buildTrendData, exportToExcel } from '@/utils/metrics'
import type { RawDataRow } from '@/types'

const dataStore = useDataStore()
const loading = ref(false)
const dateRange = ref<[string, string] | null>(null)
const filterQcConclusion = ref<string[]>([])
const filterAuditResult = ref<string[]>([])
const filterQcResult = ref<string[]>([])
const trendGranularity = ref<'day' | 'week' | 'month'>('day')

const auditResultOptions = ['低质/删除', '普通', '低价值', '高价值']

const trendChartRef = ref<HTMLDivElement>()
const pieChartRef = ref<HTMLDivElement>()
let trendChart: echarts.ECharts | null = null
let pieChart: echarts.ECharts | null = null

// 从数据中自动推断日期范围（兼容多种日期字符串格式）
function inferDateRange(data: RawDataRow[]): [string, string] | null {
  const FORMATS = [
    'YYYY年M月D日', 'YYYY年MM月DD日',
    'YYYY/M/D H:mm', 'YYYY/M/D HH:mm', 'YYYY/MM/DD HH:mm:ss',
    'YYYY/MM/DD HH:mm', 'YYYY/M/D HH:mm:ss', 'YYYY/M/D', 'YYYY/MM/DD',
    'YYYY-MM-DD HH:mm:ss', 'YYYY-MM-DD', 'YYYY-M-D',
  ]
  const parseFlex = (s: string) => {
    if (!s) return null
    for (const fmt of FORMATS) {
      const d = dayjs(s, fmt, true)
      if (d.isValid()) return d
    }
    const d = dayjs(s)
    return d.isValid() ? d : null
  }
  const dates = data
    .map((r) => parseFlex(String(r.质检日期 || '')))
    .filter((d): d is dayjs.Dayjs => d !== null)
  if (dates.length === 0) return null
  const min = dates.reduce((a, b) => (a.isBefore(b) ? a : b))
  const max = dates.reduce((a, b) => (a.isAfter(b) ? a : b))
  return [min.format('YYYY-MM-DD'), max.format('YYYY-MM-DD')]
}

// 过滤后的数据
const filteredData = computed<RawDataRow[]>(() => {
  return filterData(dataStore.cachedData, {
    dateRange: dateRange.value ?? undefined,
    qcConclusion: filterQcConclusion.value.length ? filterQcConclusion.value as any : undefined,
    auditResult: filterAuditResult.value.length ? filterAuditResult.value : undefined,
    qcResult: filterQcResult.value.length ? filterQcResult.value : undefined,
  })
})

// 上一期数据（同等时间长度）
const prevData = computed<RawDataRow[]>(() => {
  if (!dateRange.value?.[0] || !dateRange.value?.[1]) return []
  const start = dayjs(dateRange.value[0])
  const end = dayjs(dateRange.value[1])
  const days = end.diff(start, 'day') + 1
  const prevEnd = start.subtract(1, 'day').format('YYYY-MM-DD')
  const prevStart = start.subtract(days, 'day').format('YYYY-MM-DD')
  return filterData(dataStore.cachedData, { dateRange: [prevStart, prevEnd] })
})

const metrics = computed(() => calcMetrics(filteredData.value))

const correctCount = computed(() => metrics.value.correctCount || 0)
const wrongCount = computed(() => metrics.value.wrongCount || 0)
const missCount = computed(() => metrics.value.missCount || 0)
const categoryErrorCount = computed(() => metrics.value.categoryErrorCount || 0)

const metricCards = computed(() => buildMetricCards(filteredData.value, prevData.value))
const positiveCards = computed(() => metricCards.value.filter((c) => c.type === 'positive'))
const negativeCards = computed(() => metricCards.value.filter((c) => c.type === 'negative'))

function onFilterChange() {
  nextTick(() => buildCharts())
}

function resetFilter() {
  dateRange.value = inferDateRange(dataStore.cachedData)
  filterQcConclusion.value = []
  filterAuditResult.value = []
  filterQcResult.value = []
  nextTick(() => buildCharts())
}

function buildCharts() {
  buildTrendChart()
  buildPieChart()
}

function buildTrendChart() {
  if (!trendChartRef.value) return
  if (!trendChart) {
    trendChart = echarts.init(trendChartRef.value)
  }

  const trendData = buildTrendData(filteredData.value, trendGranularity.value)

  trendChart.setOption({
    tooltip: {
      trigger: 'axis',
      formatter: (params: any[]) =>
        `${params[0].axisValue}<br/>${params.map((p: any) => `${p.seriesName}: <b>${p.value}%</b>`).join('<br/>')}`,
    },
    legend: {
      data: ['准确率', '文章分级准确率', '深度分级准确率'],
      bottom: 0,
    },
    grid: { top: 20, right: 20, bottom: 50, left: 50 },
    xAxis: {
      type: 'category',
      data: trendData.dates,
      axisLabel: { fontSize: 11 },
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
        type: 'line',
        data: trendData.accuracy,
        smooth: true,
        symbol: 'circle',
        symbolSize: 5,
        lineStyle: { color: '#1677ff', width: 2.5 },
        itemStyle: { color: '#1677ff' },
        areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(22,119,255,0.15)' }, { offset: 1, color: 'rgba(22,119,255,0)' }] } },
      },
      {
        name: '文章分级准确率',
        type: 'line',
        data: trendData.articleGradingAccuracy,
        smooth: true,
        symbol: 'circle',
        symbolSize: 5,
        lineStyle: { color: '#00b96b', width: 2, type: 'dashed' },
        itemStyle: { color: '#00b96b' },
      },
      {
        name: '深度分级准确率',
        type: 'line',
        data: trendData.deepGradingAccuracy,
        smooth: true,
        symbol: 'circle',
        symbolSize: 5,
        lineStyle: { color: '#722ed1', width: 2, type: 'dotted' },
        itemStyle: { color: '#722ed1' },
      },
    ],
  })
}

function buildPieChart() {
  if (!pieChartRef.value) return
  if (!pieChart) {
    pieChart = echarts.init(pieChartRef.value)
  }

  const m = metrics.value
  const pieData = [
    { name: '正确', value: m.correctCount || 0, itemStyle: { color: '#00b96b' } },
    { name: '错审', value: m.wrongCount || 0, itemStyle: { color: '#ff4d4f' } },
    { name: '漏审', value: m.missCount || 0, itemStyle: { color: '#fa8c16' } },
    { name: '归类错误', value: m.categoryErrorCount || 0, itemStyle: { color: '#722ed1' } },
  ].filter((d) => d.value > 0)

  pieChart.setOption({
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c} ({d}%)',
    },
    legend: {
      bottom: 0,
      data: pieData.map((d) => d.name),
    },
    series: [
      {
        name: '质检结论',
        type: 'pie',
        radius: ['40%', '70%'],
        center: ['50%', '45%'],
        data: pieData,
        label: {
          formatter: '{b}\n{d}%',
          fontSize: 12,
        },
        emphasis: {
          itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0,0,0,0.2)' },
        },
      },
    ],
  })
}

function exportDashboard() {
  const exportData = filteredData.value.map((r) => ({
    质检日期: r.质检日期,
    审核时间: r.审核时间,
    文章标题: r.文章标题 || '',
    审核人员: r.审核人员,
    审核结果: r.审核结果,
    审核总分: r.审核总分,
    质检结果: r.质检结果,
    质检总分: r.质检总分,
    qc_conclusion: r.qc_conclusion,
    质检人: r.质检人,
  }))
  exportToExcel(exportData, `质量看板明细_${dayjs().format('YYYYMMDD')}`)
}

function exportTrendData() {
  const trendData = buildTrendData(filteredData.value, trendGranularity.value)
  const exportData = trendData.dates.map((date, i) => ({
    日期: date,
    准确率: trendData.accuracy[i],
    文章分级准确率: trendData.articleGradingAccuracy[i],
    深度分级准确率: trendData.deepGradingAccuracy[i],
  }))
  exportToExcel(exportData, `准确率趋势_${dayjs().format('YYYYMMDD')}`)
}

function exportPieData() {
  const m = metrics.value
  const data = [
    { 质检结论: '正确', 数量: m.correctCount || 0, 占比: `${((m.correctCount || 0) / (m.total || 1) * 100).toFixed(2)}%` },
    { 质检结论: '错审', 数量: m.wrongCount || 0, 占比: `${((m.wrongCount || 0) / (m.total || 1) * 100).toFixed(2)}%` },
    { 质检结论: '漏审', 数量: m.missCount || 0, 占比: `${((m.missCount || 0) / (m.total || 1) * 100).toFixed(2)}%` },
    { 质检结论: '归类错误', 数量: m.categoryErrorCount || 0, 占比: `${((m.categoryErrorCount || 0) / (m.total || 1) * 100).toFixed(2)}%` },
  ]
  exportToExcel(data, `质检结论分布_${dayjs().format('YYYYMMDD')}`)
}

function handleResize() {
  trendChart?.resize()
  pieChart?.resize()
}

onMounted(async () => {
  await dataStore.init()
  if (dataStore.hasData) {
    // 自动设置为数据实际日期范围，确保默认能看到所有数据
    if (!dateRange.value) {
      dateRange.value = inferDateRange(dataStore.cachedData)
    }
    await nextTick()
    setTimeout(buildCharts, 100)
  }
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  trendChart?.dispose()
  pieChart?.dispose()
  window.removeEventListener('resize', handleResize)
})

watch(() => dataStore.cachedData, () => {
  nextTick(() => buildCharts())
}, { deep: false })

watch(filteredData, () => {
  nextTick(() => buildCharts())
})
</script>

<style scoped>
.filter-label {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-bottom: 4px;
  font-weight: 500;
}

.metrics-section {
  margin-bottom: 20px;
}
.metrics-group-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 12px;
}
.positive-group { color: var(--color-success); }
.negative-group { color: var(--color-danger); }
.group-hint {
  font-size: 12px;
  font-weight: 400;
  color: var(--color-text-disabled);
  margin-left: 4px;
}

.metrics-grid-3 {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.summary-bar {
  display: flex;
  align-items: center;
  gap: 0;
  padding: 16px 24px;
}
.summary-item {
  flex: 1;
  text-align: center;
}
.summary-num {
  display: block;
  font-size: 22px;
  font-weight: 700;
  color: var(--color-text-primary);
}
.summary-label {
  display: block;
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-top: 4px;
}
.summary-divider {
  width: 1px;
  height: 40px;
  background: var(--color-border);
  margin: 0 16px;
}

.chart-card {
  padding: 20px;
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
  color: var(--color-text-primary);
}
.chart-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}
.chart-container {
  height: 280px;
}
</style>
