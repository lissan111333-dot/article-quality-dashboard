<template>
  <div class="page-container">
    <div class="page-title">数据上传管理</div>
    <div class="page-subtitle">支持 Excel (.xlsx) 和 CSV (.csv) 格式，单文件最大 100MB，最多 10 万行数据</div>

    <el-row :gutter="20">
      <!-- 左：上传区域 -->
      <el-col :span="14">
        <div class="card">
          <!-- 上传模式选择 -->
          <div class="mode-select">
            <div class="section-label">上传模式</div>
            <el-radio-group v-model="uploadMode">
              <el-radio value="append">
                <span>追加数据</span>
                <span class="mode-desc">将新数据追加至已有数据中</span>
              </el-radio>
              <el-radio value="overwrite">
                <span>覆盖全部数据</span>
                <span class="mode-desc danger">⚠️ 将清空所有原有数据并替换</span>
              </el-radio>
            </el-radio-group>
          </div>

          <!-- 上传区域 -->
          <div
            class="upload-zone"
            :class="{ 'drag-over': isDragging, 'has-file': selectedFile, 'upload-error': uploadStatus === 'error' }"
            @dragenter.prevent="isDragging = true"
            @dragover.prevent="isDragging = true"
            @dragleave.prevent="isDragging = false"
            @drop.prevent="handleDrop"
            @click="triggerFileInput"
          >
            <input ref="fileInput" type="file" accept=".xlsx,.csv" style="display:none" @change="handleFileChange" />

            <template v-if="!selectedFile">
              <el-icon size="48" class="upload-icon"><UploadFilled /></el-icon>
              <p class="upload-hint">拖拽文件到此处，或 <em>点击选择文件</em></p>
              <p class="upload-formats">支持 .xlsx / .csv 格式，最大 100MB</p>
            </template>

            <template v-else>
              <div class="file-info">
                <el-icon size="36" class="file-icon"><Document /></el-icon>
                <div class="file-meta">
                  <div class="file-name">{{ selectedFile.name }}</div>
                  <div class="file-size">{{ formatFileSize(selectedFile.size) }}</div>
                </div>
                <el-button
                  circle
                  size="small"
                  type="danger"
                  plain
                  :icon="Close"
                  @click.stop="clearFile"
                />
              </div>
            </template>
          </div>

          <!-- 进度条 -->
          <div v-if="uploadStatus === 'parsing'" class="upload-progress">
            <div class="progress-info">
              <span>{{ progressMsg }}</span>
              <span>{{ parseProgress }}%</span>
            </div>
            <el-progress :percentage="parseProgress" :show-text="false" status="active" />
          </div>

          <!-- 上传状态提示 -->
          <div v-if="uploadStatus !== 'idle'" class="status-bar" :class="uploadStatus">
            <el-icon size="16">
              <component :is="statusIcon" />
            </el-icon>
            <span>{{ statusMsg }}</span>
          </div>

          <!-- 操作按钮 -->
          <div class="action-bar">
            <el-button
              type="primary"
              size="large"
              :disabled="!selectedFile || uploadStatus === 'parsing'"
              :loading="uploadStatus === 'parsing'"
              @click="startUpload"
            >
              <el-icon><Upload /></el-icon>
              开始上传解析
            </el-button>
            <el-button size="large" @click="clearFile" :disabled="!selectedFile">重新选择</el-button>
          </div>
        </div>

        <!-- 数据预览 -->
        <div v-if="previewData" class="card mt-20">
          <div class="section-header">
            <div class="section-label">数据预览（前 10 行）</div>
            <div class="preview-stats">
              <el-tag type="info">总行数：{{ previewData.totalRows }}</el-tag>
              <el-tag type="success">有效行：{{ previewData.validRows }}</el-tag>
              <el-tag v-if="previewData.errors.length > 0" type="danger">
                异常行：{{ new Set(previewData.errors.map(e => e.row)).size }}
              </el-tag>
            </div>
          </div>

          <el-table
            :data="previewData.rows"
            size="small"
            max-height="300"
            border
            style="width: 100%"
            :scroll-x="true"
          >
            <el-table-column
              v-for="h in previewData.headers"
              :key="h"
              :prop="h"
              :label="h"
              min-width="130"
              show-overflow-tooltip
            />
          </el-table>

          <!-- 错误明细 -->
          <div v-if="previewData.errors.length > 0" class="error-list">
            <div class="error-list-title">
              <el-icon color="#ff4d4f"><Warning /></el-icon>
              校验错误明细（共 {{ previewData.errors.length }} 处）
            </div>
            <el-table :data="previewData.errors.slice(0, 20)" size="small" max-height="200" border>
              <el-table-column prop="row" label="行号" width="70" />
              <el-table-column prop="field" label="字段" width="180" />
              <el-table-column prop="message" label="错误原因" show-overflow-tooltip />
            </el-table>
            <p v-if="previewData.errors.length > 20" class="error-more">
              还有 {{ previewData.errors.length - 20 }} 处错误，请修正数据后重新上传
            </p>
          </div>

          <!-- 确认上传按钮（预览后确认） -->
          <div class="confirm-bar">
            <el-button
              type="success"
              size="large"
              :loading="uploading"
              :disabled="uploading"
              @click="confirmUpload"
            >
              <el-icon><Check /></el-icon>
              确认导入数据（{{ previewData.totalRows }} 行）
            </el-button>
            <span class="confirm-hint">{{ previewData.errors.length > 0 ? '⚠️ 存在校验错误，仍可导入，错误行数据不影响正常数据' : '✅ 数据校验通过，可直接导入' }}</span>
          </div>
        </div>
      </el-col>

      <!-- 右：上传历史 & 数据管理 -->
      <el-col :span="10">
        <div class="card">
          <div class="section-header">
            <div class="section-label">上传历史记录</div>
            <el-button type="danger" plain size="small" @click="clearAllConfirm">
              <el-icon><Delete /></el-icon>
              清空所有数据
            </el-button>
          </div>

          <div v-if="batches.length === 0" class="empty-state">
            <el-icon size="40" class="empty-icon"><FolderOpened /></el-icon>
            <p>暂无上传记录</p>
            <p style="font-size:12px">上传数据后记录将显示在此处</p>
          </div>

          <div v-else class="batch-list">
            <div v-for="batch in batches" :key="batch.id" class="batch-item">
              <div class="batch-header">
                <div class="batch-name">
                  <el-icon size="14"><Document /></el-icon>
                  {{ batch.fileName }}
                </div>
                <el-tag :type="batch.status === 'success' ? 'success' : 'danger'" size="small">
                  {{ batch.status === 'success' ? '成功' : '失败' }}
                </el-tag>
              </div>
              <div class="batch-meta">
                <span>{{ batch.uploadTime }}</span>
                <span>{{ batch.dataCount.toLocaleString() }} 行</span>
                <span>{{ batch.mode === 'append' ? '追加' : '覆盖' }}</span>
              </div>
              <div class="batch-actions">
                <el-button
                  type="danger"
                  plain
                  size="small"
                  @click="deleteBatchConfirm(batch)"
                >
                  <el-icon><Delete /></el-icon>
                  删除此批数据
                </el-button>
              </div>
            </div>
          </div>
        </div>

        <!-- 存储状态 -->
        <div class="card mt-20">
          <div class="section-label mb-12">本地存储状态</div>
          <div class="storage-stats">
            <div class="stat-item">
              <div class="stat-value">{{ dataStore.totalCount.toLocaleString() }}</div>
              <div class="stat-label">总数据行数</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">{{ batches.length }}</div>
              <div class="stat-label">上传批次数</div>
            </div>
          </div>
          <el-alert
            title="数据安全提示"
            type="info"
            description="所有数据仅存储在您浏览器本地的 IndexedDB 中，不会上传至任何服务器。清除浏览器数据可能导致本地数据丢失。"
            show-icon
            :closable="false"
            style="margin-top: 12px;"
          />
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessageBox, ElMessage } from 'element-plus'
import {
  UploadFilled, Document, Close, Upload, Warning, Check, Delete, FolderOpened,
} from '@element-plus/icons-vue'
import { parseFile } from '@/utils/parser'
import { appendData, overwriteData, addBatch, deleteBatch, deleteDataByBatch, clearAllData, getAllBatches } from '@/utils/db'
import type { ParsePreview, UploadMode, UploadBatch } from '@/types'
import { useDataStore } from '@/stores/dataStore'
import dayjs from 'dayjs'

const dataStore = useDataStore()

const fileInput = ref<HTMLInputElement>()
const selectedFile = ref<File | null>(null)
const isDragging = ref(false)
const uploadMode = ref<UploadMode>('append')
const uploadStatus = ref<'idle' | 'parsing' | 'success' | 'error' | 'confirming'>('idle')
const parseProgress = ref(0)
const progressMsg = ref('解析中...')
const statusMsg = ref('')
const previewData = ref<ParsePreview | null>(null)
const uploading = ref(false)
const batches = ref<UploadBatch[]>([])
let parsedRows: any[] = []
let currentBatchId = ''

onMounted(async () => {
  batches.value = await getAllBatches()
})

const statusIcon = computed(() => {
  const map: Record<string, string> = {
    parsing: 'Loading',
    success: 'CircleCheck',
    error: 'CircleClose',
    confirming: 'WarningFilled',
    idle: 'InfoFilled',
  }
  return map[uploadStatus.value] || 'InfoFilled'
})

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

function triggerFileInput() {
  if (uploadStatus.value === 'parsing') return
  fileInput.value?.click()
}

function handleDrop(e: DragEvent) {
  isDragging.value = false
  const file = e.dataTransfer?.files[0]
  if (file) selectFile(file)
}

function handleFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (file) selectFile(file)
}

function selectFile(file: File) {
  if (!file.name.match(/\.(xlsx|csv)$/i)) {
    ElMessage.error('仅支持 .xlsx 和 .csv 格式文件')
    return
  }
  if (file.size > 100 * 1024 * 1024) {
    ElMessage.error('文件大小不能超过 100MB')
    return
  }
  selectedFile.value = file
  uploadStatus.value = 'idle'
  previewData.value = null
  statusMsg.value = ''
}

function clearFile() {
  selectedFile.value = null
  uploadStatus.value = 'idle'
  previewData.value = null
  statusMsg.value = ''
  parsedRows = []
  if (fileInput.value) fileInput.value.value = ''
}

async function startUpload() {
  if (!selectedFile.value) return

  // 覆盖模式二次确认
  if (uploadMode.value === 'overwrite') {
    try {
      await ElMessageBox.confirm(
        '覆盖模式将清空所有本地已存储数据并替换为新上传的数据，此操作不可恢复！',
        '⚠️ 危险操作确认',
        {
          confirmButtonText: '确认覆盖',
          cancelButtonText: '取消',
          type: 'warning',
          confirmButtonClass: 'el-button--danger',
        },
      )
    } catch {
      return
    }
  }

  uploadStatus.value = 'parsing'
  parseProgress.value = 0
  progressMsg.value = '正在读取文件...'
  previewData.value = null

  currentBatchId = `batch_${Date.now()}_${Math.random().toString(36).slice(2)}`

  try {
    const buffer = await selectedFile.value.arrayBuffer()
    progressMsg.value = '正在解析数据...'

    const result = await parseFile(buffer, currentBatchId, (p) => {
      parseProgress.value = p
    })

    parsedRows = result.rows
    previewData.value = result.preview
    parseProgress.value = 100
    uploadStatus.value = 'confirming'
    statusMsg.value = `解析完成：共 ${result.preview.totalRows} 行，${result.preview.errors.length} 处校验问题`
  } catch (err: any) {
    uploadStatus.value = 'error'
    statusMsg.value = `解析失败：${err.message || '未知错误'}`
    ElMessage.error(`文件解析失败：${err.message || '请检查文件格式'}`)
  }
}

async function confirmUpload() {
  if (uploading.value) return
  uploading.value = true
  statusMsg.value = '正在写入本地数据库...'

  try {
    if (uploadMode.value === 'overwrite') {
      await overwriteData(parsedRows)
    } else {
      await appendData(parsedRows)
    }

    // 记录批次
    const batch: UploadBatch = {
      id: currentBatchId,
      fileName: selectedFile.value!.name,
      uploadTime: dayjs().format('YYYY-MM-DD HH:mm:ss'),
      dataCount: parsedRows.length,
      mode: uploadMode.value,
      status: 'success',
    }
    await addBatch(batch)

    uploadStatus.value = 'success'
    statusMsg.value = `✅ 导入成功！共写入 ${parsedRows.length.toLocaleString()} 行数据`
    ElMessage.success(`数据导入成功，共 ${parsedRows.length.toLocaleString()} 行`)

    // 刷新状态
    batches.value = await getAllBatches()
    await dataStore.refresh()

    // 重置
    previewData.value = null
    parsedRows = []
  } catch (err: any) {
    uploadStatus.value = 'error'
    statusMsg.value = `写入失败：${err.message}`
    ElMessage.error(`数据写入失败：${err.message}`)
  } finally {
    uploading.value = false
  }
}

async function deleteBatchConfirm(batch: UploadBatch) {
  try {
    await ElMessageBox.confirm(
      `确认删除批次「${batch.fileName}」的 ${batch.dataCount} 行数据？此操作不可恢复。`,
      '删除确认',
      { confirmButtonText: '确认删除', cancelButtonText: '取消', type: 'warning' },
    )
    await deleteDataByBatch(batch.id)
    await deleteBatch(batch.id)
    batches.value = await getAllBatches()
    await dataStore.refresh()
    ElMessage.success('批次数据已删除')
  } catch {
    // 取消
  }
}

async function clearAllConfirm() {
  try {
    await ElMessageBox.confirm(
      '此操作将清空所有本地存储的质量数据和上传记录，数据无法恢复！请谨慎操作。',
      '⚠️ 清空所有数据',
      {
        confirmButtonText: '确认清空',
        cancelButtonText: '取消',
        type: 'error',
        confirmButtonClass: 'el-button--danger',
      },
    )
    await clearAllData()
    batches.value = []
    await dataStore.refresh()
    ElMessage.success('所有数据已清空')
  } catch {
    // 取消
  }
}
</script>

<style scoped>
.mt-20 { margin-top: 20px; }
.mb-12 { margin-bottom: 12px; }

.section-label {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin-bottom: 12px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}
.section-header .section-label { margin-bottom: 0; }

.mode-select {
  margin-bottom: 20px;
}
.mode-select :deep(.el-radio) {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
}
.mode-desc {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-left: 4px;
}
.mode-desc.danger { color: var(--color-danger); }

.upload-zone {
  border: 2px dashed var(--color-border);
  border-radius: var(--border-radius-md);
  padding: 40px 20px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  background: #fafafa;
  min-height: 180px;
  justify-content: center;
}
.upload-zone:hover,
.upload-zone.drag-over {
  border-color: var(--color-primary);
  background: var(--color-primary-light);
}
.upload-zone.has-file {
  border-color: var(--color-success);
  background: var(--color-success-light);
}
.upload-zone.upload-error {
  border-color: var(--color-danger);
  background: var(--color-danger-light);
}

.upload-icon { color: var(--color-primary); }
.upload-hint {
  font-size: 15px;
  color: var(--color-text-secondary);
}
.upload-hint em {
  color: var(--color-primary);
  font-style: normal;
  font-weight: 500;
  cursor: pointer;
}
.upload-formats {
  font-size: 12px;
  color: var(--color-text-disabled);
}

.file-info {
  display: flex;
  align-items: center;
  gap: 12px;
}
.file-icon { color: var(--color-success); }
.file-meta { text-align: left; }
.file-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
}
.file-size {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-top: 2px;
}

.upload-progress { margin-top: 16px; }
.progress-info {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  color: var(--color-text-secondary);
  margin-bottom: 6px;
}

.status-bar {
  margin-top: 12px;
  padding: 10px 14px;
  border-radius: var(--border-radius-sm);
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}
.status-bar.parsing { background: #e6f0ff; color: var(--color-primary); }
.status-bar.success { background: var(--color-success-light); color: var(--color-success); }
.status-bar.error { background: var(--color-danger-light); color: var(--color-danger); }
.status-bar.confirming { background: var(--color-warning-light); color: var(--color-warning); }

.action-bar {
  margin-top: 16px;
  display: flex;
  gap: 10px;
}

.preview-stats {
  display: flex;
  gap: 8px;
}

.error-list {
  margin-top: 16px;
  border: 1px solid var(--color-danger-light);
  border-radius: var(--border-radius-sm);
  overflow: hidden;
}
.error-list-title {
  background: var(--color-danger-light);
  padding: 8px 12px;
  font-size: 13px;
  font-weight: 500;
  color: var(--color-danger);
  display: flex;
  align-items: center;
  gap: 6px;
}
.error-more {
  padding: 8px 12px;
  font-size: 12px;
  color: var(--color-text-secondary);
  background: #fafafa;
}

.confirm-bar {
  margin-top: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
}
.confirm-hint {
  font-size: 12px;
  color: var(--color-text-secondary);
}

/* 批次列表 */
.batch-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 400px;
  overflow-y: auto;
}
.batch-item {
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius-sm);
  padding: 12px;
  background: #fafafa;
}
.batch-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}
.batch-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-primary);
  display: flex;
  align-items: center;
  gap: 6px;
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.batch-meta {
  font-size: 12px;
  color: var(--color-text-secondary);
  display: flex;
  gap: 12px;
  margin-bottom: 8px;
}
.batch-actions { display: flex; gap: 8px; }

/* 存储状态 */
.storage-stats {
  display: flex;
  gap: 24px;
}
.stat-item { text-align: center; }
.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: var(--color-primary);
}
.stat-label {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-top: 4px;
}
</style>
