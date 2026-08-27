<template>
  <div class="layout">
    <aside class="sidebar">
      <div class="sider-top">
        <div class="sider-logo">
          <img class="logo-box" src="../assets/icon.svg" alt="ZeroHub">
          <div class="logo-title">
            <div class="t1">ZeroHub</div>
            <div class="t2">软件商城</div>
          </div>
        </div>
        <div class="menu-list">
          <div
            v-for="item in menuList"
            :key="item.path"
            class="menu-item"
            :class="{ active: route.path === item.path }"
            @click="router.push(item.path)"
          >
            <el-icon :size="18"><component :is="item.icon" /></el-icon>
            <span class="mi-text">{{ item.title }}</span>
          </div>
        </div>
      </div>

      <!-- 底部用户卡片 -->
      <div class="sider-bottom">
        <div class="user-card" v-if="userStore.user">
          <el-avatar :size="40" style="background:linear-gradient(135deg,#667eea,#764ba2)">
            {{ userStore.user.username?.[0]?.toUpperCase() }}
          </el-avatar>
          <div class="u-info ml-3">
            <div class="u-name truncate">{{ userStore.user.username }}</div>
            <el-tag :type="vipTagType" size="small" effect="light" round>{{ vipName }}</el-tag>
          </div>
          <el-dropdown trigger="click" @command="onCmd">
            <el-icon class="more"><MoreFilled /></el-icon>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="refresh"><el-icon><Refresh /></el-icon> 刷新信息</el-dropdown-item>
                <el-dropdown-item command="logout" divided><el-icon><SwitchButton /></el-icon> 退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
        <div class="points-row" v-if="userStore.user">
          <div class="point-item">
            <span class="p-label">积分</span>
            <span class="p-value">{{ userStore.user.points || 0 }}</span>
          </div>
          <div class="point-item" v-if="vipExpire">
            <span class="p-label">到期</span>
            <span class="p-value">{{ vipExpireShort }}</span>
          </div>
        </div>
      </div>
    </aside>

    <main class="main-area">
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </main>
  </div>
</template>

<script setup>
import { computed, onMounted, onBeforeUnmount, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessageBox } from 'element-plus';
import {
  HomeFilled, Monitor, Cpu, Game, Connection, Download, Setting, MoreFilled, Refresh, SwitchButton
} from '@element-plus/icons-vue';
import { useUserStore } from '../store/user';
import { useDownloadStore } from '../store/download';

const route = useRoute();
const router = useRouter();
const userStore = useUserStore();
const downloadStore = useDownloadStore();

const menuList = [
  { path: '/home', title: '首页', icon: 'HomeFilled' },
  { path: '/software', title: '软件下载', icon: 'Monitor' },
  { path: '/models', title: '大模型下载', icon: 'Cpu' },
  { path: '/games', title: '游戏下载', icon: 'Game' },
  { path: '/api-proxy', title: 'API中转站', icon: 'Connection' },
  { path: '/downloads', title: '下载中心', icon: 'Download' },
  { path: '/settings', title: '设置', icon: 'Setting' }
];

const vipName = computed(() => ({
  none: '普通用户', week: 'VIP周卡', month: 'VIP月卡',
  year: 'VIP年卡', permanent: '永久VIP'
}[userStore.user?.vipType] || '普通用户'));
const vipTagType = computed(() => ({
  week: 'warning', month: '', year: 'success', permanent: 'danger'
}[userStore.user?.vipType] || 'info'));
const vipExpire = computed(() => userStore.user?.vipExpireAt);
const vipExpireShort = computed(() => {
  if (!vipExpire.value) return '';
  const d = new Date(vipExpire.value);
  return `${d.getMonth()+1}/${d.getDate()}`;
});

async function onCmd(cmd) {
  if (cmd === 'refresh') {
    await userStore.refresh();
  } else if (cmd === 'logout') {
    try {
      await ElMessageBox.confirm('确定退出登录?', '提示', { type: 'warning' });
      userStore.logout();
      router.push('/login');
    } catch (e) {}
  }
}

// 监听下载进度
let unsubDownload = null;
onMounted(async () => {
  if (!userStore.firstLoadDone) await userStore.tryAutoLogin();
  else await userStore.refresh();
  // 订阅下载进度
  if (window.zerohub?.onDownloadProgress) {
    unsubDownload = window.zerohub.onDownloadProgress((p) => {
      downloadStore.updateTask(p.id, p);
    });
  }
});
onBeforeUnmount(() => { if (unsubDownload) unsubDownload(); });
watch(() => userStore.token, (t) => { if (!t) router.push('/login'); });
</script>

<style scoped>
.layout {
  display: flex;
  height: calc(100vh - 36px);
  background: #fafbfc;
}
.sidebar {
  width: 220px;
  flex-shrink: 0;
  background: #ffffff;
  border-right: 1px solid #f0f1f3;
  display: flex;
  flex-direction: column;
  padding: 16px 12px;
}
.sider-top { flex: 1; min-height: 0; overflow: auto; }
.sider-logo {
  display: flex; align-items: center; gap: 12px; padding: 6px 8px 20px;
}
.logo-box {
  width: 40px; height: 40px;
  border-radius: 12px;
  object-fit: contain;
  box-shadow: 0 4px 12px rgba(102,126,234,0.28);
}
.logo-title .t1 { font-size: 17px; font-weight: 700; color: #1d2129; }
.logo-title .t2 { font-size: 11px; color: #909399; margin-top: 1px; }

.menu-list { display: flex; flex-direction: column; gap: 4px; }
.menu-item {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  color: #606266;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.18s;
}
.menu-item:hover { background: #f5f7fa; color: #303133; }
.menu-item.active {
  background: linear-gradient(135deg, rgba(102,126,234,0.12), rgba(118,75,162,0.12));
  color: #667eea;
  font-weight: 600;
}
.mi-text { flex: 1; }

.sider-bottom {
  border-top: 1px solid #f2f3f5;
  padding-top: 12px;
  margin-top: 12px;
}
.user-card {
  display: flex; align-items: center;
  padding: 8px; border-radius: 10px; background: #fafbfc;
}
.u-info { flex: 1; min-width: 0; }
.u-name { font-size: 14px; font-weight: 600; color: #303133; margin-bottom: 4px; }
.more { color: #909399; cursor: pointer; padding: 4px; }
.more:hover { color: #606266; }

.points-row {
  display: flex; gap: 10px; margin-top: 10px; padding: 0 8px;
}
.point-item {
  flex: 1; background: #f8f9fb; border-radius: 8px; padding: 8px 10px;
}
.p-label { display: block; font-size: 11px; color: #909399; }
.p-value { display: block; font-size: 15px; font-weight: 700; color: #303133; margin-top: 2px; }

.main-area {
  flex: 1; min-width: 0; overflow: auto;
}
.ml-3 { margin-left: 12px; }
</style>
