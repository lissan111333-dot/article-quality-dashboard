<template>
  <div class="metric-card" :class="card.type">
    <div class="card-label">{{ card.label }}</div>
    <div class="card-value">
      <span class="value-num">{{ card.value.toFixed(2) }}</span>
      <span class="value-unit">{{ card.unit }}</span>
    </div>
    <div class="card-trend" v-if="card.prevValue !== undefined">
      <span
        class="trend-value"
        :class="trendClass"
      >
        <el-icon size="12"><component :is="trendIcon" /></el-icon>
        {{ Math.abs(diff).toFixed(2) }}{{ card.unit }}
      </span>
      <span class="trend-label">vs 上期</span>
    </div>
    <div v-if="card.description" class="card-desc">{{ card.description }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { MetricCard } from '@/types'

const props = defineProps<{ card: MetricCard }>()

const diff = computed(() =>
  props.card.prevValue !== undefined ? props.card.value - props.card.prevValue : 0,
)

// 对于正向指标：上升=好=绿，下降=差=红
// 对于负向指标：上升=差=红，下降=好=绿
const trendClass = computed(() => {
  if (diff.value === 0) return 'trend-neutral'
  if (props.card.type === 'positive') {
    return diff.value > 0 ? 'trend-good' : 'trend-bad'
  } else {
    return diff.value > 0 ? 'trend-bad' : 'trend-good'
  }
})

const trendIcon = computed(() => {
  if (diff.value === 0) return 'Minus'
  return diff.value > 0 ? 'ArrowUp' : 'ArrowDown'
})
</script>

<style scoped>
.metric-card {
  background: var(--color-bg-card);
  border-radius: var(--border-radius-md);
  padding: 20px;
  box-shadow: var(--shadow-sm);
  border: 1px solid rgba(0,0,0,0.04);
  transition: all 0.2s ease;
  cursor: default;
}
.metric-card:hover {
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
}
.metric-card.positive {
  border-left: 3px solid var(--color-success);
}
.metric-card.negative {
  border-left: 3px solid var(--color-danger);
}

.card-label {
  font-size: 13px;
  color: var(--color-text-secondary);
  font-weight: 500;
  margin-bottom: 8px;
}

.card-value {
  display: flex;
  align-items: baseline;
  gap: 4px;
  margin-bottom: 8px;
}
.value-num {
  font-size: 30px;
  font-weight: 700;
  color: var(--color-text-primary);
  line-height: 1;
}
.value-unit {
  font-size: 14px;
  color: var(--color-text-secondary);
  font-weight: 500;
}

.card-trend {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}
.trend-value {
  display: flex;
  align-items: center;
  gap: 2px;
  font-size: 12px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 4px;
}
.trend-good {
  color: var(--color-success);
  background: var(--color-success-light);
}
.trend-bad {
  color: var(--color-danger);
  background: var(--color-danger-light);
}
.trend-neutral {
  color: var(--color-text-secondary);
  background: #f5f5f5;
}
.trend-label {
  font-size: 11px;
  color: var(--color-text-disabled);
}

.card-desc {
  font-size: 11px;
  color: var(--color-text-disabled);
  line-height: 1.4;
}
</style>
