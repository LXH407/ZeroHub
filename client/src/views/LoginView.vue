<template>
  <div class="login-wrap center">
    <div class="login-box">
      <div class="login-left">
        <div class="brand">
          <img class="logo" src="../assets/icon.svg" alt="ZeroHub">
          <div class="brand-text">
            <h1>ZeroHub</h1>
            <p>软件 · 大模型 · 游戏 · API中转站</p>
          </div>
        </div>
        <div class="feature-list">
          <div class="feat"><el-icon color="#667eea"><Check /></el-icon> 多镜像源智能切换，国内加速下载</div>
          <div class="feat"><el-icon color="#67c23a"><Check /></el-icon> 10位数字卡密，安全便捷</div>
          <div class="feat"><el-icon color="#e6a23c"><Check /></el-icon> 丰富的软件、模型、游戏资源</div>
          <div class="feat"><el-icon color="#f56c6c"><Check /></el-icon> 关机也能注册，自动队列处理</div>
        </div>
      </div>
      <div class="login-right">
        <h2 class="rh">欢迎回来</h2>
        <p class="rs">请登录您的账户</p>

        <el-form ref="formRef" :model="form" :rules="rules" label-position="top" size="large">
          <el-form-item label="用户名" prop="username">
            <el-input v-model="form.username" placeholder="请输入用户名" :prefix-icon="User" />
          </el-form-item>
          <el-form-item label="密码" prop="password">
            <el-input v-model="form.password" type="password" placeholder="请输入密码" :prefix-icon="Lock" show-password @keyup.enter="submit" />
          </el-form-item>
          <el-form-item>
            <el-checkbox v-model="form.remember">记住登录状态（登录过无需再次登录）</el-checkbox>
          </el-form-item>
          <el-form-item>
            <el-button class="zh-btn-primary" style="width:100%;height:44px" :loading="loading" @click="submit">登 录</el-button>
          </el-form-item>
        </el-form>

        <div class="links">
          <span>还没有账户？</span>
          <el-button type="primary" link @click="router.push('/register')">使用卡密注册 →</el-button>
        </div>
        <div class="links" style="margin-top:6px">
          <el-button type="info" link @click="router.push('/server-config')"><el-icon><Setting /></el-icon> 服务器地址配置</el-button>
        </div>

        <div class="tips">
          <el-alert v-if="serverStatus === 'offline'" type="error" :closable="false" size="small" show-icon title="无法连接到服务器，请检查地址或联系管理员" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { User, Lock, Setting, Check } from '@element-plus/icons-vue';
import { useUserStore } from '../store/user';
import { healthCheck, getBaseURL } from '../api';

const router = useRouter();
const userStore = useUserStore();
const formRef = ref();
const loading = ref(false);
const serverStatus = ref('checking');

const form = reactive({
  username: '',
  password: '',
  remember: true
});
const rules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
};

async function submit() {
  await formRef.value.validate();
  loading.value = true;
  try {
    await userStore.login(form.username, form.password, form.remember);
    ElMessage.success('登录成功');
    router.push('/home');
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  try {
    await healthCheck(getBaseURL());
    serverStatus.value = 'online';
  } catch (e) {
    serverStatus.value = 'offline';
  }
});
</script>

<style scoped>
.login-wrap {
  height: calc(100vh - 36px);
  background: linear-gradient(135deg,#f5f7ff 0%,#fdfcff 100%);
  padding: 20px;
}
.login-box {
  width: 820px; max-width: 100%;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(102,126,234,0.12);
  overflow: hidden;
  display: flex;
}
.login-left {
  width: 48%;
  background: linear-gradient(135deg,#667eea 0%, #764ba2 100%);
  padding: 40px 36px;
  color: #fff;
  display: flex; flex-direction: column; justify-content: space-between;
}
.brand { display: flex; align-items: center; gap: 14px; }
.logo {
  width: 56px; height: 56px;
  border-radius: 16px;
  object-fit: contain;
  background: rgba(255,255,255,0.12);
  box-shadow: 0 4px 12px rgba(0,0,0,0.12);
}
.brand-text h1 { font-size: 26px; margin-bottom: 4px; font-weight: 700; }
.brand-text p { opacity: 0.85; font-size: 13px; }

.feature-list { display: flex; flex-direction: column; gap: 14px; }
.feat {
  display: flex; align-items: center; gap: 10px;
  background: rgba(255,255,255,0.12);
  padding: 10px 14px; border-radius: 10px;
  font-size: 13px; backdrop-filter: blur(6px);
}

.login-right {
  flex: 1; padding: 48px 44px;
  display: flex; flex-direction: column;
}
.rh { font-size: 26px; color: #1d2129; font-weight: 700; margin-bottom: 6px; }
.rs { color: #86909c; margin-bottom: 28px; font-size: 14px; }

.links {
  display: flex; align-items: center; justify-content: space-between;
  font-size: 13px; color: #606266;
}
.tips { margin-top: 16px; }
</style>
