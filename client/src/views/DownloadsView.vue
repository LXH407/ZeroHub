<template>
  <div class="dl-view">
    <div class="page-padding">
      <div class="space-between mb-18">
        <h2 class="page-title">
          <el-icon :size="22" color="#667eea"><Download /></el-icon>
          <span class="ml-2">下载中心</span>
          <el-tag type="primary" effect="plain" round style="margin-left:10px">
            进行中 {{ activeCount }} / 总计 {{ tasks.length }}
          </el-tag>
        </h2>
        <div>
          <el-button :icon="Folder" @click="openFolder">打开下载目录</el-button>
          <el-button type="danger" plain :icon="Delete" style="margin-left:8px" @click="clearCompleted">清除已完成</el-button>
        </div>
      </div>

      <div class="zh-card" v-if="tasks.length">
        <div
          v-for="task in tasks"
          :key="task.id"
          class="task-row"
          :class="{ done: task.status === 'completed', err: task.status === 'error' }"
        >
          <div class="tr-left">
            <div class="tr-icon">
              <el-icon v-if="task.status === 'completed'" color="#67c23a" :size="22"><CircleCheckFilled /></el-icon>
              <el-icon v-else-if="task.status === 'error'" color="#f56c6c" :size="22"><CircleCloseFilled /></el-icon>
              <el-icon v-else color="#409eff" :size="22" class="spin"><Loading /></el-icon>
            </div>
            <div class="tr-info">
              <div class="tr-name truncate">{{ task.resourceName || task.filename || '未命名任务' }}</div>
              <div class="tr-sub">
                <span v-if="task.totalSize > 0">
                  {{ formatSize(task.downloaded) }} / {{ formatSize(task.totalSize) }}
                </span>
                <span v-else>{{ formatSize(task.downloaded) || '-' }}</span>
                <span class="ml-10" v-if="task.speed > 0">{{ formatSize(task.speed) }}/s</span>
                <span class="ml-10" v-if="task.switchedCount">切换镜像 {{ task.switchedCount }} 次</span>
                <span class="ml-10">
                  <el-tag size="small" effect="plain" v-if="task.status === 'downloading' || task.status === 'running'" type="primary">下载中</el-tag>
                  <el-tag size="small" effect="plain" v-else-if="task.status === 'completed'" type="success">已完成</el-tag>
                  <el-tag size="small" effect="plain" v-else-if="task.status === 'error'" type="danger">失败</el-tag>
                  <el-tag size="small" effect="plain" v-else>{{ task.status }}</el-tag>
                </span>
              </div>
              <el-progress
                v-if="task.status !== 'completed' && task.status !== 'error'"
                :percentage="Math.max(0, Math.min(100, task.progress || 0))"
                :stroke-width="6"
                :show-text="true"
                style="margin-top:8px"
              />
            </div>
          </div>
          <div class="tr-right">
            <el-button size="small" type="primary" link v-if="task.status === 'completed'" @click="openFolder(task.savePath)">
              <el-icon><FolderOpened /></el-icon> 打开位置
            </el-button>
            <el-button size="small" type="danger" link @click="removeTask(task.id)">删除</el-button>
          </div>
        </div>
      </div>

      <el-empty v-else description="暂无下载任务" />
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue';
import { Download, Folder, Delete, Loading, CircleCheckFilled, CircleCloseFilled, FolderOpened } from '@element-plus/icons-vue';
import { useDownloadStore } from '../store/download';

const dlStore = useDownloadStore();

const tasks = computed(() => dlStore.taskList);
const activeCount = computed(() => dlStore.activeCount);

async function openFolder(p) {
  await window.zerohub?.openDownloadFolder?.(p);
}
function formatSize(b) {
  if (!b) return '0B';
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0, n = b;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(n >= 100 ? 0 : (n >= 10 ? 1 : 2))}${u[i]}`;
}
function removeTask(id) { dlStore.removeTask(id); }
function clearCompleted() { dlStore.clearCompleted(); }

onMounted(async () => {
  try {
    const init = await window.zerohub?.getDownloadTasks?.();
    if (init) init.forEach(t => dlStore.updateTask(t.id, t));
  } catch (e) {}
});
</script>

<style scoped>
.dl-view { height: 100%; overflow: auto; }
.page-padding { padding: 24px 28px 40px; }
.page-title { font-size: 22px; font-weight: 700; color: #1d2129; display: flex; align-items: center; }
.task-row {
  padding: 16px 18px;
  border-bottom: 1px solid #f2f3f5;
  display: flex;
  align-items: center;
  gap: 14px;
}
.task-row:last-child { border-bottom: none; }
.task-row.done { background: #fafbfc; }
.task-row.err { background: #fff6f6; }
.tr-left { display: flex; align-items: center; gap: 14px; flex: 1; min-width: 0; }
.tr-icon {
  width: 46px; height: 46px;
  border-radius: 12px;
  background: #f2f6ff;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.spin { animation: spin 1s linear infinite; }
@keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }
.tr-info { flex: 1; min-width: 0; }
.tr-name { font-size: 15px; font-weight: 600; color: #1d2129; }
.tr-sub {
  margin-top: 4px;
  color: #86909c; font-size: 12px;
  display: flex; align-items: center; flex-wrap: wrap;
}
.tr-right { flex-shrink: 0; display: flex; gap: 6px; }

.mb-18 { margin-bottom: 18px; }
.ml-2 { margin-left: 8px; }
.ml-10 { margin-left: 10px; }
</style>
