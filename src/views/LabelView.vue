<template>
  <div class="page-container">
    <div class="page-title">标签归因分析</div>
    <div class="page-subtitle">针对「归类错误」数据，分析各标签的误判和漏判分布</div>

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
        <el-col :span="5">
          <div class="filter-label">标签筛选</div>
          <el-select v-model="filterLabel" clearable placeholder="全部标签" style="width: 100%">
            <el-option-group label="标签1（质量维度）">
              <el-option v-for="n in label1Names" :key="n" :label="n" :value="n" />
            </el-option-group>
            <el-option-group label="标签2（价值维度）">
              <el-option v-for="n in label2Names" :key="n" :label="n" :value="n" />
            </el-option-group>
          </el-select>
        </el-col>
        <el-col :span="5" style="display:flex;align-items:flex-end;padding-top:20px;gap:8px">
          <el-button type="primary" @click="onQuery">查询</el-button>
          <el-button @click="resetFilter">重置</el-button>
          <el-button :icon="Download" @click="exportTable">导出</el-button>
        </el-col>
      </el-row>
    </div>

    <!-- 空状态 -->
    <div v-if="!dataStore.hasData" class="empty-state card">
      <el-icon size="64" class="empty-icon"><PriceTag /></el-icon>
      <p>暂无数据，请先上传数据文件</p>
      <el-button type="primary" @click="$router.push('/upload')">去上传数据</el-button>
    </div>

    <template v-else>
      <!-- 归类错误总量 -->
      <el-row :gutter="16" class="mb-20">
        <el-col :span="6">
          <div class="mini-stat-card">
            <div class="mini-stat-num">{{ categoryErrorTotal.toLocaleString() }}</div>
            <div class="mini-stat-label">归类错误总量</div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="mini-stat-card danger">
            <div class="mini-stat-num danger">{{ topOverJudgeLabel }}</div>
            <div class="mini-stat-label">误判最多标签</div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="mini-stat-card warning">
            <div class="mini-stat-num warning">{{ topMissJudgeLabel }}</div>
            <div class="mini-stat-label">漏判最多标签</div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="mini-stat-card info">
            <div class="mini-stat-num info">{{ totalLabelDiffCount.toLocaleString() }}</div>
            <div class="mini-stat-label">标签差异总数</div>
          </div>
        </el-col>
      </el-row>

      <!-- 图表区域 -->
      <div class="charts-grid mb-20">
        <div class="card chart-card">
          <div class="chart-title mb-12">误判率分布（多给了标签）</div>
          <div ref="overJudgeChartRef" class="chart-container-h"></div>
        </div>
        <div class="card chart-card">
          <div class="chart-title mb-12">漏判率分布（少给了标签）</div>
          <div ref="missJudgeChartRef" class="chart-container-h"></div>
        </div>
      </div>

      <!-- 明细表格 -->
      <div class="card">
        <div class="table-header">
          <div class="table-title">标签 Diff 明细</div>
          <div class="hint-text">
            <el-tag type="danger" size="small">误判</el-tag> 审核命中 但质检未命中 &nbsp;
            <el-tag type="warning" size="small">漏判</el-tag> 审核未命中 但质检命中
          </div>
        </div>

        <el-table :data="displayData" border stripe style="width: 100%" v-loading="loading">
          <el-table-column prop="labelGroup" label="标签组" width="120">
            <template #default="{ row }">
              <el-tag :type="row.labelGroup === '标签1' ? 'primary' : 'success'" size="small">
                {{ row.labelGroup }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="labelName" label="标签名称" width="130" />
          <el-table-column prop="totalCount" label="归类错误总量" width="120" align="right" />
          <el-table-column prop="overJudge" label="误判数（多给）" width="130" align="right" sortable>
            <template #default="{ row }">
              <span :style="{ color: row.overJudge > 0 ? 'var(--color-danger)' : 'inherit', fontWeight: row.overJudge > 0 ? 600 : 400 }">
                {{ row.overJudge }}
              </span>
            </template>
          </el-table-column>
          <el-table-column prop="overRate" label="误判率" width="120" sortable>
            <template #default="{ row }">
              <div class="rate-cell">
                <el-progress
                  :percentage="row.overRate"
                  :color="row.overRate > 20 ? '#ff4d4f' : row.overRate > 10 ? '#fa8c16' : '#00b96b'"
                  :show-text="false"
                  style="width: 60px"
                />
                <span style="margin-left: 6px; font-size: 12px; font-weight: 600;">{{ row.overRate }}%</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="missJudge" label="漏判数（少给）" width="130" align="right" sortable>
            <template #default="{ row }">
              <span :style="{ color: row.missJudge > 0 ? 'var(--color-warning)' : 'inherit', fontWeight: row.missJudge > 0 ? 600 : 400 }">
                {{ row.missJudge }}
              </span>
            </template>
          </el-table-column>
          <el-table-column prop="missRate" label="漏判率" sortable>
            <template #default="{ row }">
              <div class="rate-cell">
                <el-progress
                  :percentage="row.missRate"
                  :color="row.missRate > 20 ? '#fa8c16' : row.missRate > 10 ? '#faad14' : '#00b96b'"
                  :show-text="false"
                  style="width: 60px"
                />
                <span style="margin-left: 6px; font-size: 12px; font-weight: 600;">{{ row.missRate }}%</span>
              </div>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { Download, PriceTag } from '@element-plus/icons-vue'
import * as echarts from 'echarts'
import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'
dayjs.extend(customParseFormat)
import { useDataStore } from '@/stores/dataStore'
import { filterData, buildLabelDiff, exportToExcel } from '@/utils/metrics'
import type { LabelDiffItem } from '@/types'
import { LABEL_1_NAMES, LABEL_2_NAMES } from '@/types'

const dataStore = useDataStore()
const loading = ref(false)
const dateRange = ref<[string, string] | null>(null)
const filterLabel = ref('')
const labelDiffData = ref<LabelDiffItem[]>([])

const label1Names = [...LABEL_1_NAMES]
const label2Names = [...LABEL_2_NAMES]

const overJudgeChartRef = ref<HTMLDivElement>()
const missJudgeChartRef = ref<HTMLDivElement>()
let overJudgeChart: echarts.ECharts | null = null
let missJudgeChart: echarts.ECharts | null = null

// 过滤后的展示数据
const displayData = computed(() => {
  if (!filterLabel.value) return labelDiffData.value
  return labelDiffData.value.filter((r) => r.labelName === filterLabel.value)
})

const categoryErrorTotal = computed(() =>
  labelDiffData.value.length > 0 ? labelDiffData.value[0].totalCount : 0,
)

// 误判最多标签：只在 overJudge > 0 时才显示，否则显示「无」
const topOverJudgeLabel = computed(() => {
  if (!labelDiffData.value.length) return '-'
  const top = [...labelDiffData.value].sort((a, b) => b.overJudge - a.overJudge)[0]
  return top && top.overJudge > 0 ? top.labelName : '无'
})

// 漏判最多标签：只在 missJudge > 0 时才显示，否则显示「无」
const topMissJudgeLabel = computed(() => {
  if (!labelDiffData.value.length) return '-'
  const top = [...labelDiffData.value].sort((a, b) => b.missJudge - a.missJudge)[0]
  return top && top.missJudge > 0 ? top.labelName : '无'
})

const totalLabelDiffCount = computed(() =>
  labelDiffData.value.reduce((s, r) => s + r.overJudge + r.missJudge, 0),
)

function onQuery() {
  loading.value = true
  try {
    const filtered = filterData(dataStore.cachedData, { dateRange: dateRange.value ?? undefined })
    labelDiffData.value = buildLabelDiff(filtered)
    nextTick(() => buildCharts())
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
  filterLabel.value = ''
  onQuery()
}

function buildCharts() {
  buildOverJudgeChart()
  buildMissJudgeChart()
}

function buildOverJudgeChart() {
  if (!overJudgeChartRef.value) return
  if (!overJudgeChart) overJudgeChart = echarts.init(overJudgeChartRef.value)

  const data = [...labelDiffData.value].sort((a, b) => b.overRate - a.overRate)
  overJudgeChart.setOption({
    tooltip: {
      trigger: 'axis',
      formatter: (params: any[]) => `${params[0].name}<br/>误判率: <b>${params[0].value}%</b><br/>误判数: ${data[params[0].dataIndex]?.overJudge || 0}`,
    },
    grid: { top: 10, right: 60, bottom: 20, left: 120 },
    xAxis: { type: 'value', axisLabel: { formatter: '{value}%' }, max: 100 },
    yAxis: {
      type: 'category',
      data: data.map((d) => d.labelName),
      axisLabel: { fontSize: 12 },
    },
    series: [{
      type: 'bar',
      data: data.map((d) => d.overRate),
      barMaxWidth: 20,
      itemStyle: {
        color: (params: any) => {
          const v = params.value
          if (v > 20) return '#ff4d4f'
          if (v > 10) return '#fa8c16'
          return '#1677ff'
        },
        borderRadius: [0, 4, 4, 0],
      },
      label: { show: true, position: 'right', formatter: '{c}%', fontSize: 11 },
    }],
  })
}

function buildMissJudgeChart() {
  if (!missJudgeChartRef.value) return
  if (!missJudgeChart) missJudgeChart = echarts.init(missJudgeChartRef.value)

  const data = [...labelDiffData.value].sort((a, b) => b.missRate - a.missRate)
  missJudgeChart.setOption({
    tooltip: {
      trigger: 'axis',
      formatter: (params: any[]) => `${params[0].name}<br/>漏判率: <b>${params[0].value}%</b><br/>漏判数: ${data[params[0].dataIndex]?.missJudge || 0}`,
    },
    grid: { top: 10, right: 60, bottom: 20, left: 120 },
    xAxis: { type: 'value', axisLabel: { formatter: '{value}%' }, max: 100 },
    yAxis: {
      type: 'category',
      data: data.map((d) => d.labelName),
      axisLabel: { fontSize: 12 },
    },
    series: [{
      type: 'bar',
      data: data.map((d) => d.missRate),
      barMaxWidth: 20,
      itemStyle: {
        color: (params: any) => {
          const v = params.value
          if (v > 20) return '#fa8c16'
          if (v > 10) return '#faad14'
          return '#00b96b'
        },
        borderRadius: [0, 4, 4, 0],
      },
      label: { show: true, position: 'right', formatter: '{c}%', fontSize: 11 },
    }],
  })
}

function exportTable() {
  exportToExcel(
    displayData.value.map((r) => ({
      标签组: r.labelGroup,
      标签名称: r.labelName,
      归类错误总量: r.totalCount,
      误判数: r.overJudge,
      误判率: `${r.overRate}%`,
      漏判数: r.missJudge,
      漏判率: `${r.missRate}%`,
    })),
    `标签归因分析_${dayjs().format('YYYYMMDD')}`,
  )
}

function handleResize() {
  overJudgeChart?.resize()
  missJudgeChart?.resize()
}

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
  overJudgeChart?.dispose()
  missJudgeChart?.dispose()
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
.mini-stat-card.danger { border-left-color: var(--color-danger); }
.mini-stat-card.warning { border-left-color: var(--color-warning); }
.mini-stat-card.info { border-left-color: #1677ff; }

.mini-stat-num { font-size: 22px; font-weight: 700; color: var(--color-primary); }
.mini-stat-num.danger { color: var(--color-danger); }
.mini-stat-num.warning { color: var(--color-warning); }
.mini-stat-num.info { color: var(--color-primary); }
.mini-stat-label { font-size: 12px; color: var(--color-text-secondary); margin-top: 4px; }

.chart-card { padding: 20px; }
.chart-title { font-size: 15px; font-weight: 600; }
.chart-container-h { height: 320px; }

.table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.table-title { font-size: 15px; font-weight: 600; }
.hint-text { font-size: 12px; color: var(--color-text-secondary); display: flex; align-items: center; gap: 8px; }

.rate-cell { display: flex; align-items: center; }

.mb-12 { margin-bottom: 12px; }
.mb-20 { margin-bottom: 20px; }
</style>
