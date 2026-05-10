<template>
  <el-config-provider :locale="zhCn">
    <div class="app-layout">
      <!-- 侧边栏 -->
      <aside class="sidebar" :class="{ collapsed: sidebarCollapsed }">
        <div class="sidebar-logo">
          <div class="logo-icon">
            <el-icon size="22"><DataAnalysis /></el-icon>
          </div>
          <transition name="fade">
            <span v-if="!sidebarCollapsed" class="logo-text">质量分析后台</span>
          </transition>
        </div>

        <nav class="sidebar-nav">
          <router-link
            v-for="route in navRoutes"
            :key="route.path"
            :to="route.path"
            class="nav-item"
            :class="{ active: currentPath === route.path }"
          >
            <el-icon size="18">
              <component :is="route.meta?.icon" />
            </el-icon>
            <transition name="fade">
              <span v-if="!sidebarCollapsed" class="nav-label">{{ route.meta?.title }}</span>
            </transition>
          </router-link>
        </nav>

        <div class="sidebar-footer">
          <div class="data-count" v-if="!sidebarCollapsed">
            <span class="count-label">已存储数据</span>
            <span class="count-num">{{ totalCount.toLocaleString() }} 条</span>
          </div>
          <button class="collapse-btn" @click="sidebarCollapsed = !sidebarCollapsed">
            <el-icon size="16">
              <component :is="sidebarCollapsed ? 'Expand' : 'Fold'" />
            </el-icon>
          </button>
        </div>
      </aside>

      <!-- 主内容区 -->
      <main class="main-content">
        <!-- 顶部栏 -->
        <header class="top-bar">
          <div class="breadcrumb">
            <span class="breadcrumb-title">{{ currentTitle }}</span>
          </div>
          <div class="top-bar-actions">
            <el-badge :value="totalCount > 0 ? undefined : '无数据'" type="warning" :hidden="totalCount > 0">
              <el-button
                type="primary"
                size="small"
                :icon="Upload"
                @click="$router.push('/upload')"
              >
                上传数据
              </el-button>
            </el-badge>
          </div>
        </header>

        <!-- 路由视图 -->
        <div class="view-container">
          <router-view v-slot="{ Component }">
            <transition name="slide-fade" mode="out-in">
              <component :is="Component" />
            </transition>
          </router-view>
        </div>
      </main>
    </div>
  </el-config-provider>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { Upload } from '@element-plus/icons-vue'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import { routes } from './router'
import { useDataStore } from './stores/dataStore'

const route = useRoute()
const dataStore = useDataStore()
const sidebarCollapsed = ref(false)

const navRoutes = routes.filter((r) => r.path !== '/')
const currentPath = computed(() => route.path)
const currentTitle = computed(() => {
  const r = navRoutes.find((nr) => nr.path === route.path)
  return r?.meta?.title || '质量分析后台'
})
const totalCount = computed(() => dataStore.totalCount)

onMounted(async () => {
  await dataStore.init()
})
</script>

<style scoped>
.app-layout {
  display: flex;
  height: 100vh;
  overflow: hidden;
  background: var(--color-bg);
}

/* 侧边栏 */
.sidebar {
  width: 220px;
  height: 100vh;
  background: #ffffff;
  border-right: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  transition: width 0.25s ease;
  flex-shrink: 0;
  z-index: 100;
}
.sidebar.collapsed {
  width: 60px;
}

.sidebar-logo {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 20px 16px;
  border-bottom: 1px solid var(--color-border);
  overflow: hidden;
}
.logo-icon {
  width: 36px;
  height: 36px;
  background: var(--color-primary);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  flex-shrink: 0;
}
.logo-text {
  font-size: 15px;
  font-weight: 700;
  color: var(--color-text-primary);
  white-space: nowrap;
}

.sidebar-nav {
  flex: 1;
  padding: 12px 8px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: var(--border-radius-sm);
  color: var(--color-text-secondary);
  text-decoration: none;
  transition: all 0.15s ease;
  white-space: nowrap;
  overflow: hidden;
}
.nav-item:hover {
  background: var(--color-primary-light);
  color: var(--color-primary);
}
.nav-item.active {
  background: var(--color-primary-light);
  color: var(--color-primary);
  font-weight: 600;
}
.nav-label {
  font-size: 14px;
}

.sidebar-footer {
  padding: 12px 8px;
  border-top: 1px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.data-count {
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow: hidden;
}
.count-label {
  font-size: 11px;
  color: var(--color-text-disabled);
  white-space: nowrap;
}
.count-num {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-primary);
  white-space: nowrap;
}
.collapse-btn {
  width: 32px;
  height: 32px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-secondary);
  transition: all 0.15s;
  flex-shrink: 0;
}
.collapse-btn:hover {
  background: var(--color-primary-light);
  color: var(--color-primary);
  border-color: var(--color-primary);
}

/* 主内容 */
.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.top-bar {
  height: 56px;
  background: #ffffff;
  border-bottom: 1px solid var(--color-border);
  padding: 0 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}
.breadcrumb-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.view-container {
  flex: 1;
  overflow-y: auto;
}

/* 过渡动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-fade-enter-active {
  transition: all 0.2s ease;
}
.slide-fade-leave-active {
  transition: all 0.15s ease;
}
.slide-fade-enter-from {
  opacity: 0;
  transform: translateY(8px);
}
.slide-fade-leave-to {
  opacity: 0;
}
</style>
