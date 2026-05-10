/**
 * 全局数据状态管理
 * 使用 Pinia 管理内存中的数据缓存与加载状态
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { RawDataRow, UploadBatch } from '@/types'
import { getAllData, getAllBatches, getDataCount } from '@/utils/db'

export const useDataStore = defineStore('data', () => {
  // 缓存的全量数据
  const cachedData = ref<RawDataRow[]>([])
  const batches = ref<UploadBatch[]>([])
  const totalCount = ref(0)
  const loading = ref(false)
  const initialized = ref(false)

  /**
   * 初始化：从 IndexedDB 加载数据
   */
  async function init() {
    if (initialized.value) return
    loading.value = true
    try {
      const [result, batchList, count] = await Promise.all([
        getAllData(),
        getAllBatches(),
        getDataCount(),
      ])
      cachedData.value = result.data
      batches.value = batchList
      totalCount.value = count
      initialized.value = true
    } finally {
      loading.value = false
    }
  }

  /**
   * 强制刷新数据
   */
  async function refresh() {
    loading.value = true
    initialized.value = false
    try {
      const [result, batchList, count] = await Promise.all([
        getAllData(),
        getAllBatches(),
        getDataCount(),
      ])
      cachedData.value = result.data
      batches.value = batchList
      totalCount.value = count
      initialized.value = true
    } finally {
      loading.value = false
    }
  }

  // 计算属性：有无数据
  const hasData = computed(() => totalCount.value > 0)

  // 获取唯一审核员列表
  const auditorList = computed(() => {
    const names = [...new Set(cachedData.value.map((r) => r.审核人员).filter(Boolean))]
    return names
  })

  // 获取唯一质检人列表
  const qcPersonList = computed(() => {
    const names = [...new Set(cachedData.value.map((r) => r.质检人).filter(Boolean))]
    return names
  })

  return {
    cachedData,
    batches,
    totalCount,
    loading,
    initialized,
    hasData,
    auditorList,
    qcPersonList,
    init,
    refresh,
  }
})
