/**
 * IndexedDB 封装工具
 * 负责数据的本地持久化存储、读取、删除
 */
import type { RawDataRow, UploadBatch } from '@/types'

const DB_NAME = 'ArticleQualityDB'
const DB_VERSION = 1
const STORE_DATA = 'qualityData'
const STORE_BATCH = 'uploadBatches'

let dbInstance: IDBDatabase | null = null

/**
 * 初始化并获取数据库连接
 */
export function openDB(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance)

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result

      // 质量数据存储
      if (!db.objectStoreNames.contains(STORE_DATA)) {
        const store = db.createObjectStore(STORE_DATA, {
          keyPath: '_rowIndex',
          autoIncrement: true,
        })
        store.createIndex('_batchId', '_batchId', { unique: false })
        store.createIndex('质检日期', '质检日期', { unique: false })
        store.createIndex('审核人员', '审核人员', { unique: false })
        store.createIndex('qc_conclusion', 'qc_conclusion', { unique: false })
      }

      // 上传批次记录存储
      if (!db.objectStoreNames.contains(STORE_BATCH)) {
        db.createObjectStore(STORE_BATCH, { keyPath: 'id' })
      }
    }

    request.onsuccess = (event) => {
      dbInstance = (event.target as IDBOpenDBRequest).result
      resolve(dbInstance)
    }

    request.onerror = (event) => {
      reject((event.target as IDBOpenDBRequest).error)
    }
  })
}

/**
 * 追加数据（不清空原有）
 */
export async function appendData(rows: RawDataRow[]): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_DATA, 'readwrite')
    const store = tx.objectStore(STORE_DATA)

    rows.forEach((row) => {
      store.add(row)
    })

    tx.oncomplete = () => resolve()
    tx.onerror = (e) => reject((e.target as IDBRequest).error)
  })
}

/**
 * 覆盖数据（先清空，再写入）
 */
export async function overwriteData(rows: RawDataRow[]): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_DATA, STORE_BATCH], 'readwrite')
    const dataStore = tx.objectStore(STORE_DATA)
    const batchStore = tx.objectStore(STORE_BATCH)

    dataStore.clear()
    batchStore.clear()

    rows.forEach((row) => {
      dataStore.add(row)
    })

    tx.oncomplete = () => resolve()
    tx.onerror = (e) => reject((e.target as IDBRequest).error)
  })
}

/**
 * 查询所有数据（支持分页）
 */
export async function getAllData(page?: number, pageSize?: number): Promise<{ data: RawDataRow[]; total: number }> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_DATA, 'readonly')
    const store = tx.objectStore(STORE_DATA)
    const countReq = store.count()

    countReq.onsuccess = () => {
      const total = countReq.result

      if (page === undefined || pageSize === undefined) {
        // 全量获取
        const allReq = store.getAll()
        allReq.onsuccess = () => resolve({ data: allReq.result, total })
        allReq.onerror = (e) => reject((e.target as IDBRequest).error)
      } else {
        // 分页获取
        const data: RawDataRow[] = []
        let skipped = 0
        const skip = (page - 1) * pageSize
        const cursorReq = store.openCursor()

        cursorReq.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result
          if (!cursor) {
            resolve({ data, total })
            return
          }

          if (skipped < skip) {
            skipped++
            cursor.continue()
            return
          }

          if (data.length < pageSize) {
            data.push(cursor.value)
            cursor.continue()
          } else {
            resolve({ data, total })
          }
        }
        cursorReq.onerror = (e) => reject((e.target as IDBRequest).error)
      }
    }

    countReq.onerror = (e) => reject((e.target as IDBRequest).error)
  })
}

/**
 * 根据批次ID删除数据
 */
export async function deleteDataByBatch(batchId: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_DATA, 'readwrite')
    const store = tx.objectStore(STORE_DATA)
    const index = store.index('_batchId')
    const req = index.getAllKeys(batchId)

    req.onsuccess = () => {
      const keys = req.result
      keys.forEach((key) => store.delete(key))
      tx.oncomplete = () => resolve()
    }

    req.onerror = (e) => reject((e.target as IDBRequest).error)
    tx.onerror = (e) => reject((e.target as IDBRequest).error)
  })
}

/**
 * 清空所有数据
 */
export async function clearAllData(): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_DATA, STORE_BATCH], 'readwrite')
    tx.objectStore(STORE_DATA).clear()
    tx.objectStore(STORE_BATCH).clear()
    tx.oncomplete = () => resolve()
    tx.onerror = (e) => reject((e.target as IDBRequest).error)
  })
}

/**
 * 添加上传批次记录
 */
export async function addBatch(batch: UploadBatch): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_BATCH, 'readwrite')
    tx.objectStore(STORE_BATCH).put(batch)
    tx.oncomplete = () => resolve()
    tx.onerror = (e) => reject((e.target as IDBRequest).error)
  })
}

/**
 * 获取所有批次记录
 */
export async function getAllBatches(): Promise<UploadBatch[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_BATCH, 'readonly')
    const req = tx.objectStore(STORE_BATCH).getAll()
    req.onsuccess = () =>
      resolve(
        (req.result as UploadBatch[]).sort(
          (a, b) => new Date(b.uploadTime).getTime() - new Date(a.uploadTime).getTime(),
        ),
      )
    req.onerror = (e) => reject((e.target as IDBRequest).error)
  })
}

/**
 * 删除批次记录
 */
export async function deleteBatch(batchId: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_BATCH, 'readwrite')
    tx.objectStore(STORE_BATCH).delete(batchId)
    tx.oncomplete = () => resolve()
    tx.onerror = (e) => reject((e.target as IDBRequest).error)
  })
}

/**
 * 获取数据总量
 */
export async function getDataCount(): Promise<number> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_DATA, 'readonly')
    const req = tx.objectStore(STORE_DATA).count()
    req.onsuccess = () => resolve(req.result)
    req.onerror = (e) => reject((e.target as IDBRequest).error)
  })
}
