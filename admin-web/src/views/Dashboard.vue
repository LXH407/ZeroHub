<template>
  <div class="page-container">
    <!-- 统计卡片 -->
    <el-row :gutter="16" style="margin-bottom:20px">
      <el-col :span="6" v-for="stat in statCards" :key="stat.label">
        <el-card shadow="hover" class="stat-card" :body-style="{ padding: '20px' }">
          <div class="stat-item" :style="{ color: stat.color }">
            <el-icon :size="36"><component :is="stat.icon" /></el-icon>
            <div class="stat-info">
              <div class="stat-value">{{ stat.value }}</div>
              <div class="stat-label">{{ stat.label }}</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="16">
      <el-col :span="16">
        <el-card shadow="hover">
          <template #header>
            <span style="font-weight:600">用户与资源统计</span>
          </template>
          <div ref="chartRef" style="height:320px"></div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card shadow="hover">
          <template #header>
            <span style="font-weight:600">资源类型分布</span>
          </template>
          <div ref="pieChartRef" style="height:320px"></div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="16" style="margin-top:20px">
      <el-col :span="12">
        <el-card shadow="hover">
          <template #header>
            <div style="display:flex;justify-content:space-between;align-items:center">
              <span style="font-weight:600">待处理注册请求</span>
              <el-button type="primary" link @click="refreshPending">
                <el-icon><Refresh /></el-icon> 刷新
              </el-button>
            </div>
          </template>
          <el-table :data="pendingList.slice(0, 5)" stripe size="small" empty-text="暂无待处理">
            <el-table-column prop="username" label="用户名" width="120" />
            <el-table-column prop="card_number" label="卡密" width="130" />
            <el-table-column prop="received_at" label="提交时间" min-width="170">
              <template #default="{ row }">{{ formatTime(row.received_at) }}</template>
            </el-table-column>
            <el-table-column label="状态" width="80">
              <template #default="{ row }">
                <el-tag v-if="row.processed" type="info">已处理</el-tag>
                <el-tag v-else type="warning">待处理</el-tag>
              </template>
            </el-table-column>
          </el-table>
          <div style="margin-top:12px;text-align:right">
            <el-button type="primary" size="small" @click="goPending">查看全部 →</el-button>
          </div>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card shadow="hover">
          <template #header>
            <span style="font-weight:600">快捷操作</span>
          </template>
          <el-row :gutter="12">
            <el-col :span="8" style="margin-bottom:12px">
              <el-button type="primary" style="width:100%;height:72px" @click="router.push('/cards')">
                <div style="display:flex;flex-direction:column;align-items:center">
                  <el-icon :size="24"><CreditCard /></el-icon>
                  <span style="margin-top:6px">生成卡密</span>
                </div>
              </el-button>
            </el-col>
            <el-col :span="8" style="margin-bottom:12px">
              <el-button type="success" style="width:100%;height:72px" @click="router.push('/resources')">
                <div style="display:flex;flex-direction:column;align-items:center">
                  <el-icon :size="24"><Plus /></el-icon>
                  <span style="margin-top:6px">添加资源</span>
                </div>
              </el-button>
            </el-col>
            <el-col :span="8" style="margin-bottom:12px">
              <el-button type="warning" style="width:100%;height:72px" @click="router.push('/users')">
                <div style="display:flex;flex-direction:column;align-items:center">
                  <el-icon :size="24"><User /></el-icon>
                  <span style="margin-top:6px">用户管理</span>
                </div>
              </el-button>
            </el-col>
            <el-col :span="8">
              <el-button type="info" style="width:100%;height:72px" @click="router.push('/settings')">
                <div style="display:flex;flex-direction:column;align-items:center">
                  <el-icon :size="24"><Setting /></el-icon>
                  <span style="margin-top:6px">系统设置</span>
                </div>
              </el-button>
            </el-col>
            <el-col :span="8">
              <el-button type="danger" style="width:100%;height:72px" @click="handleProcessPending">
                <div style="display:flex;flex-direction:column;align-items:center">
                  <el-icon :size="24"><VideoPlay /></el-icon>
                  <span style="margin-top:6px">处理待注册</span>
                </div>
              </el-button>
            </el-col>
            <el-col :span="8">
              <el-button style="width:100%;height:72px" @click="router.push('/mirrors')">
                <div style="display:flex;flex-direction:column;align-items:center">
                  <el-icon :size="24"><Connection /></el-icon>
                  <span style="margin-top:6px">镜像源配置</span>
                </div>
              </el-button>
            </el-col>
          </el-row>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import {
  DataAnalysis, UserFilled, CreditCard, Folder, Download,
  Refresh, Plus, Setting, VideoPlay, Connection, CreditCard as CC
} from '@element-plus/icons-vue';
import * as echarts from 'echarts';
import { getStats, getPendingRegistrations, processPending } from '../api';

const router = useRouter();
const chartRef = ref();
const pieChartRef = ref();
const stats = ref({});
const pendingList = ref([]);

const statCards = computed(() => [
  { label: '总用户数', value: stats.value.totalUsers || 0, icon: 'UserFilled', color: '#409eff' },
  { label: 'VIP用户数', value: stats.value.vipUsers || 0, icon: 'CreditCard', color: '#e6a23c' },
  { label: '卡密总数', value: stats.value.totalCards || 0, icon: 'Key', color: '#67c23a' },
  { label: '资源总数', value: stats.value.totalResources || 0, icon: 'Folder', color: '#f56c6c' }
]);

function formatTime(t) {
  if (!t) return '';
  return new Date(t).toLocaleString('zh-CN');
}

async function loadStats() {
  const res = await getStats();
  stats.value = res.stats;
  renderCharts();
}

async function refreshPending() {
  const res = await getPendingRegistrations();
  pendingList.value = res.list;
}

async function handleProcessPending() {
  await processPending();
  ElMessage.success('已触发处理');
  await refreshPending();
  await loadStats();
}

function goPending() {
  router.push('/pending');
}

function renderCharts() {
  const s = stats.value;
  if (chartRef.value) {
    const chart = echarts.init(chartRef.value);
    chart.setOption({
      tooltip: { trigger: 'axis' },
      legend: { data: ['用户数', '下载量'] },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: { type: 'category', data: ['用户', '活跃', '卡密使用', '资源', '下载', '待注册', 'VIP'] },
      yAxis: { type: 'value' },
      series: [
        {
          name: '用户数',
          type: 'bar',
          data: [s.totalUsers, s.activeUsers, s.usedCards, 0, 0, s.pendingRegistrations, s.vipUsers],
          itemStyle: { color: '#409eff' }
        },
        {
          name: '下载量',
          type: 'bar',
          data: [0, 0, 0, s.totalResources, s.totalDownloads, 0, 0],
          itemStyle: { color: '#67c23a' }
        }
      ]
    });
  }
  if (pieChartRef.value) {
    const pie = echarts.init(pieChartRef.value);
    pie.setOption({
      tooltip: { trigger: 'item' },
      legend: { bottom: 0 },
      series: [{
        type: 'pie',
        radius: ['40%', '70%'],
        avoidLabelOverlap: false,
        itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
        label: { show: true, formatter: '{b}: {c}' },
        data: [
          { value: s.totalResources || 0, name: '资源', itemStyle: { color: '#909399' } }
        ]
      }]
    });
  }
}

onMounted(() => {
  loadStats();
  refreshPending();
  window.addEventListener('resize', () => {
    echarts.getInstanceByDom(chartRef.value)?.resize();
    echarts.getInstanceByDom(pieChartRef.value)?.resize();
  });
});
</script>

<style scoped>
.stat-card {
  border-radius: 8px;
}
.stat-item {
  display: flex;
  align-items: center;
  gap: 16px;
}
.stat-info {
  flex: 1;
}
.stat-value {
  font-size: 28px;
  font-weight: 700;
}
.stat-label {
  color: #909399;
  font-size: 14px;
  margin-top: 4px;
}
</style>
