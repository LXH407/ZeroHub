<template>
  <div class="set-view">
    <div class="page-padding">
      <h2 class="page-title mb-18">
        <el-icon :size="22" color="#909399"><Setting /></el-icon>
        <span class="ml-2">设置</span>
      </h2>

      <div class="set-grid">
        <!-- 账户信息 -->
        <div class="zh-card set-card">
          <h3 class="sc-title"><el-icon><UserFilled /></el-icon> 账户信息</h3>
          <div class="sc-rows">
            <div class="sc-row space-between">
              <span class="k">用户名</span>
              <span class="v font-bold">{{ user.username }}</span>
            </div>
            <div class="sc-row space-between">
              <span class="k">账户类型</span>
              <el-tag :type="vipTagType">{{ vipName }}</el-tag>
            </div>
            <div class="sc-row space-between" v-if="user.vipExpireAt">
              <span class="k">到期时间</span>
              <span class="v">{{ formatTime(user.vipExpireAt) }}</span>
            </div>
            <div class="sc-row space-between">
              <span class="k">剩余积分</span>
              <span class="v"><b style="color:#e6a23c">{{ user.points || 0 }}</b> 分</span>
            </div>
            <div class="sc-actions mt-10">
              <el-button @click="refresh"><el-icon><Refresh /></el-icon> 刷新账户</el-button>
              <el-button type="danger" plain @click="logout" style="margin-left:10px"><el-icon><SwitchButton /></el-icon> 退出登录</el-button>
            </div>
          </div>
        </div>

        <!-- 服务器配置 -->
        <div class="zh-card set-card">
          <h3 class="sc-title"><el-icon><Setting /></el-icon> 服务器配置</h3>
          <div class="sc-rows">
            <div class="sc-row">
              <span class="k">后端地址</span>
              <div style="flex:1;display:flex;gap:8px;margin-left:16px">
                <el-input v-model="serverUrl" />
                <el-button type="primary" :loading="testing" @click="testConnection">
                  {{ testing ? '测试中' : '测试并保存' }}
                </el-button>
              </div>
            </div>
            <el-alert
              v-if="connStatus === 'online'"
              type="success" show-icon :closable="false"
              title="连接成功"
            />
            <el-alert
              v-else-if="connStatus === 'offline'"
              type="error" show-icon :closable="false"
              title="无法连接到该地址，请检查服务器是否启动"
            />
          </div>
        </div>

        <!-- 下载配置 -->
        <div class="zh-card set-card">
          <h3 class="sc-title"><el-icon><Download /></el-icon> 下载配置</h3>
          <div class="sc-rows">
            <div class="sc-row space-between">
              <span class="k">下载目录</span>
              <span class="v" style="max-width:50%;word-break:break-all">{{ downloadDir }}</span>
            </div>
            <div class="sc-row space-between">
              <span class="k">低速切换阈值</span>
              <span class="v">50 KB/s 持续 15s 自动切换镜像源</span>
            </div>
            <div class="sc-row space-between">
              <span class="k">镜像源优先级</span>
              <span class="v">国内镜像 → HF-Mirror → 官方源</span>
            </div>
            <div class="sc-actions mt-10">
              <el-button @click="openFolder"><el-icon><Folder /></el-icon> 打开下载目录</el-button>
            </div>
          </div>
        </div>

        <!-- 关于 -->
        <div class="zh-card set-card">
          <h3 class="sc-title"><el-icon><InfoFilled /></el-icon> 关于 ZeroHub</h3>
          <div class="sc-rows">
            <div class="sc-row space-between">
              <span class="k">客户端版本</span>
              <span class="v">v1.0.0</span>
            </div>
            <div class="sc-row space-between">
              <span class="k">技术栈</span>
              <span class="v">Electron + Vue3 + Node.js</span>
            </div>
            <div class="sc-row space-between">
              <span class="k">官方仓库</span>
              <el-button link type="primary" @click="openExternal('https://github.com')">GitHub</el-button>
            </div>
            <div class="sc-actions mt-10">
              <el-button @click="checkUpdate"><el-icon><UploadFilled /></el-icon> 检查更新</el-button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  Setting, UserFilled, Refresh, SwitchButton, Download, Folder, InfoFilled, UploadFilled
} from '@element-plus/icons-vue';
import { useUserStore } from '../store/user';
import { healthCheck, setBaseURL } from '../api';

const router = useRouter();
const userStore = useUserStore();
const user = computed(() => userStore.user || {});
const vipName = computed(() => ({
  none: '普通用户', week: 'VIP周卡', month: 'VIP月卡',
  year: 'VIP年卡', permanent: '永久VIP'
}[user.value.vipType] || '普通用户'));
const vipTagType = computed(() => ({
  week: 'warning', month: '', year: 'success', permanent: 'danger'
}[user.value.vipType] || 'info'));

const serverUrl = ref('');
const testing = ref(false);
const connStatus = ref('idle');
const downloadDir = ref('');

function formatTime(t) { if (!t) return ''; return new Date(t).toLocaleString('zh-CN'); }
async function refresh() {
  await userStore.refresh();
  ElMessage.success('已刷新');
}
async function logout() {
  try {
    await ElMessageBox.confirm('确定退出登录?', '提示', { type: 'warning' });
    userStore.logout();
    router.push('/login');
  } catch (e) {}
}
async function testConnection() {
  if (!serverUrl.value) return ElMessage.error('请输入服务器地址');
  testing.value = true;
  connStatus.value = 'idle';
  try {
    await healthCheck(serverUrl.value);
    connStatus.value = 'online';
    await window.zerohub?.setConfig?.({ serverUrl: serverUrl.value.replace(/\/+$/, '') });
    setBaseURL(serverUrl.value.replace(/\/+$/, ''));
    ElMessage.success('已保存并连接成功');
  } catch (e) {
    connStatus.value = 'offline';
  } finally {
    testing.value = false;
  }
}
async function openFolder() {
  await window.zerohub?.openDownloadFolder?.();
}
async function openExternal(url) {
  await window.zerohub?.openExternal?.(url);
}
function checkUpdate() {
  ElMessage.info('当前已是最新版本 v1.0.0');
}

onMounted(async () => {
  const cfg = await window.zerohub?.getConfig?.();
  if (cfg?.serverUrl) serverUrl.value = cfg.serverUrl;
  try {
    downloadDir.value = await window.zerohub?.getDownloadDir?.() || '';
  } catch (e) {}
});
</script>

<style scoped>
.set-view { height: 100%; overflow: auto; }
.page-padding { padding: 24px 28px 40px; }
.page-title { font-size: 22px; font-weight: 700; color: #1d2129; display: flex; align-items: center; }
.set-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 18px;
}
.set-card { padding: 22px 24px; }
.sc-title {
  font-size: 16px; font-weight: 600; color: #1d2129;
  margin: 0 0 16px; padding-bottom: 12px;
  border-bottom: 1px solid #f2f3f5;
  display: flex; align-items: center; gap: 8px;
}
.sc-rows { display: flex; flex-direction: column; gap: 12px; }
.sc-row { display: flex; align-items: center; }
.sc-row .k { color: #86909c; font-size: 13px; flex-shrink: 0; width: 90px; }
.sc-row .v { color: #303133; font-size: 14px; }
.font-bold { font-weight: 600; }
.sc-actions { display: flex; }

.mt-10 { margin-top: 10px; }
.ml-2 { margin-left: 8px; }
.mb-18 { margin-bottom: 18px; }
.space-between { display: flex; align-items: center; justify-content: space-between; }
</style>
