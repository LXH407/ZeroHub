<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title">待注册处理</h2>
      <div>
        <el-button @click="loadList" style="margin-right:8px"><el-icon><Refresh /></el-icon> 刷新</el-button>
        <el-button type="primary" @click="processNow"><el-icon><VideoPlay /></el-icon> 立即处理待注册</el-button>
      </div>
    </div>
    <div class="card">
      <el-alert type="warning" :closable="false" style="margin-bottom:16px">
        <template #title>
          系统每5分钟自动处理待注册请求；超过24小时未处理的注册将自动作废。客户端在关机期间提交的注册会存入队列，后端启动后自动处理。
        </template>
      </el-alert>
      <div class="filter-bar">
        <el-radio-group v-model="filterProcessed" @change="loadList">
          <el-radio-button :label="undefined">全部</el-radio-button>
          <el-radio-button :label="0">待处理</el-radio-button>
          <el-radio-button :label="1">已处理</el-radio-button>
        </el-radio-group>
      </div>
      <el-table :data="list" stripe border>
        <el-table-column prop="id" label="ID" width="70" align="center" />
        <el-table-column prop="username" label="请求用户名" width="160" />
        <el-table-column prop="card_number" label="提交卡密" width="150">
          <template #default="{ row }">
            <span style="font-family:monospace">{{ row.card_number }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="received_at" label="提交时间" width="180">
          <template #default="{ row }">{{ formatTime(row.received_at) }}</template>
        </el-table-column>
        <el-table-column label="设备信息" min-width="200">
          <template #default="{ row }">
            <span v-if="row.device_info">{{ JSON.stringify(JSON.parse(row.device_info || '{}')).slice(0, 100) }}</span>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <el-tag v-if="row.processed" type="info" size="small">已处理</el-tag>
            <el-tag v-else type="warning" size="small">待处理</el-tag>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { Refresh, VideoPlay } from '@element-plus/icons-vue';
import { getPendingRegistrations, processPending } from '../api';

const list = ref([]);
const filterProcessed = ref(undefined);

function formatTime(t) { if (!t) return ''; return new Date(t).toLocaleString('zh-CN'); }

async function loadList() {
  const res = await getPendingRegistrations({ processed: filterProcessed.value });
  list.value = res.list;
}

async function processNow() {
  await processPending();
  ElMessage.success('已触发处理');
  loadList();
}

onMounted(loadList);
</script>
