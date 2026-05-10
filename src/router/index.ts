import { createRouter, createWebHashHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: '/dashboard',
  },
  {
    path: '/upload',
    name: 'Upload',
    component: () => import('@/views/UploadView.vue'),
    meta: { title: '数据上传', icon: 'Upload' },
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: () => import('@/views/DashboardView.vue'),
    meta: { title: '质量总览', icon: 'DataAnalysis' },
  },
  {
    path: '/auditor',
    name: 'Auditor',
    component: () => import('@/views/AuditorView.vue'),
    meta: { title: '审核员分析', icon: 'User' },
  },
  {
    path: '/label',
    name: 'Label',
    component: () => import('@/views/LabelView.vue'),
    meta: { title: '标签归因', icon: 'PriceTag' },
  },
  {
    path: '/detail',
    name: 'Detail',
    component: () => import('@/views/DetailView.vue'),
    meta: { title: '数据明细', icon: 'List' },
  },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

export default router
export { routes }
