<template>
  <div class="login-wrap center">
    <div class="login-box" style="width:500px">
      <div class="center" style="flex-direction:column;gap:10px;margin-bottom:28px">
        <img class="logo-s" src="../assets/icon.svg" alt="ZeroHub">
        <h2>服务器地址配置</h2>
        <p class="sub">配置后端服务地址，支持本地或云端服务器</p>
      </div>

      <el-form label-position="top">
        <el-form-item label="服务器地址">
          <el-input v-model="serverUrl" placeholder="例如 http://localhost:3000 或 https://your-server.com" />
        </el-form-item>
        <el-form-item label="连接测试">
          <div style="display:flex;gap:10px;align-items:center">
            <el-button type="primary" @click="testConnection" :loading="testing">{{ testing ? '测试中' : '测试连接' }}</el-button>
            <el-tag v-if="status === 'online'" type="success" round>✓ 连接成功</el-tag>
            <el-tag v-else-if="status === 'offline'" type="danger" round>✗ 连接失败</el-tag>
            <el-tag v-else-if="status === 'checking'" type="warning" round>检查中</el-tag>
          </div>
          <div v-if="lastMsg" style="margin-top:8px;color:#86909c;font-size:12px">{{ lastMsg }}</div>
        </el-form-item>
        <el-divider />
        <el-form-item label="快速选择">
          <div style="display:flex;flex-wrap:wrap;gap:8px">
            <el-button size="small" @click="serverUrl = 'http://localhost:3000'">本地服务器 (localhost:3000)</el-button>
            <el-button size="small" @click="serverUrl = 'http://127.0.0.1:3000'">本地回环 (127.0.0.1:3000)</el-button>
          </div>
        </el-form-item>
        <el-form-item>
          <el-button class="zh-btn-primary" style="width:100%;height:44px" @click="saveAndBack">保存并返回登录</el-button>
        </el-form-item>
      </el-form>

      <el-alert type="info" :closable="false" show-icon title="部署提示">
        <template #default>
          <div style="font-size:12px;line-height:1.6">
            推荐将后端部署到云端（如 Render、Railway、Vercel、阿里云等），这样即使主机关闭也能访问。<br/>
            本地部署仅用于测试环境，关机后客户端无法连接。
          </div>
        </template>
      </el-alert>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { healthCheck, setBaseURL } from '../api';

const router = useRouter();
const serverUrl = ref('http://localhost:3000');
const testing = ref(false);
const status = ref('idle'); // idle, checking, online, offline
const lastMsg = ref('');

onMounted(async () => {
  const cfg = await window.zerohub?.getConfig?.();
  if (cfg?.serverUrl) serverUrl.value = cfg.serverUrl;
});

async function testConnection() {
  if (!serverUrl.value) return ElMessage.error('请输入服务器地址');
  testing.value = true;
  status.value = 'checking';
  lastMsg.value = '';
  try {
    const start = Date.now();
    const res = await healthCheck(serverUrl.value);
    const elapsed = Date.now() - start;
    status.value = 'online';
    lastMsg.value = `服务器版本 v${res.data?.version || '1.0.0'}，延迟 ${elapsed}ms`;
  } catch (e) {
    status.value = 'offline';
    lastMsg.value = e.message || '无法连接，请检查地址或服务器是否启动';
  } finally {
    testing.value = false;
  }
}

async function saveAndBack() {
  if (!serverUrl.value) return ElMessage.error('请输入服务器地址');
  if (status.value !== 'online') {
    try {
      await testConnection();
    } catch (e) {}
    if (status.value !== 'online') {
      ElMessage.warning('连接未验证成功，仍会保存该地址');
    }
  }
  await window.zerohub?.setConfig?.({ serverUrl: serverUrl.value.replace(/\/+$/, '') });
  setBaseURL(serverUrl.value.replace(/\/+$/, ''));
  ElMessage.success('已保存');
  router.push('/login');
}
</script>

<style scoped>
.login-wrap {
  height: calc(100vh - 36px);
  background: linear-gradient(135deg,#f5f7ff 0%,#fdfcff 100%);
  padding: 20px; overflow: auto;
}
.login-box {
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(102,126,234,0.12);
  padding: 40px 44px;
  max-width: 100%;
}
.logo-s {
  width: 54px; height: 54px;
  border-radius: 14px;
  object-fit: contain;
  box-shadow: 0 6px 20px rgba(102,126,234,0.28);
}
h2 { font-size: 22px; color: #1d2129; font-weight: 700; margin: 0; }
.sub { color: #86909c; font-size: 13px; margin: 0; }
</style>
