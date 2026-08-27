<template>
  <div class="app-wrap zh-page">
    <!-- 顶部拖拽栏 + 窗口控制 -->
    <div class="drag-bar flex items-center justify-between px-3 bg-white border-b">
      <div class="flex items-center">
        <img class="logo-mini" src="./assets/icon.svg" alt="ZeroHub">
        <span class="ml-2 font-semibold text-gray-700">{{ siteName || 'ZeroHub 软件商城' }}</span>
      </div>
      <div class="no-drag flex items-center gap-1">
        <el-tooltip content="最小化" placement="bottom">
          <div class="win-btn" @click="minimize"><el-icon><Minus /></el-icon></div>
        </el-tooltip>
        <el-tooltip :content="maximized ? '还原' : '最大化'" placement="bottom">
          <div class="win-btn" @click="toggleMax"><el-icon><component :is="maximized ? 'CopyDocument' : 'FullScreen'" /></el-icon></div>
        </el-tooltip>
        <el-tooltip content="关闭" placement="bottom">
          <div class="win-btn close" @click="close"><el-icon><Close /></el-icon></div>
        </el-tooltip>
      </div>
    </div>

    <!-- 路由视图 + 过渡 -->
    <router-view v-slot="{ Component }">
      <transition name="fade" mode="out-in">
        <component :is="Component" />
      </transition>
    </router-view>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { getPublicSettings } from './api';

const siteName = ref('');
const maximized = ref(false);

async function minimize() { await window.zerohub?.minimize?.(); }
async function toggleMax() {
  maximized.value = await window.zerohub?.maximize?.();
}
async function close() { await window.zerohub?.close?.(); }

let unlistenMax = null;

onMounted(async () => {
  if (window.zerohub) {
    maximized.value = await window.zerohub.isMaximized();
  }
  try {
    const res = await getPublicSettings();
    siteName.value = res.settings?.site_name || 'ZeroHub 软件商城';
  } catch (e) {}
});
onUnmounted(() => { if (unlistenMax) unlistenMax(); });
</script>

<style scoped>
.app-wrap {
  display: flex;
  flex-direction: column;
}
.logo-mini {
  width: 22px; height: 22px;
  border-radius: 6px;
  object-fit: contain;
}
.win-btn {
  width: 34px; height: 30px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 4px; color: #606266;
  cursor: pointer;
  transition: background 0.15s;
}
.win-btn:hover { background: #f2f3f5; }
.win-btn.close:hover { background: #f56c6c; color: #fff; }
.ml-2 { margin-left: 8px; }
.px-3 { padding: 0 12px; }
.flex { display: flex; }
.items-center { align-items: center; }
.justify-between { justify-content: space-between; }
.font-semibold { font-weight: 600; }
.text-gray-700 { color: #333; }
.gap-1 { gap: 4px; }
.bg-white { background: #fff; }
.border-b { border-bottom: 1px solid #f0f1f3; }
</style>
