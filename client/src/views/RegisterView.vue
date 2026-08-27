<template>
  <div class="login-wrap center">
    <div class="login-box register-box" style="width:520px">
      <div class="center" style="flex-direction:column;gap:10px;margin-bottom:28px">
        <img class="logo-s" src="../assets/icon.svg" alt="ZeroHub">
        <h2>使用卡密注册 ZeroHub</h2>
        <p class="sub">请输入10位数字卡密完成注册，卡密绑定账户</p>
      </div>

      <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
        <el-form-item label="卡密（10位数字）" prop="cardNumber">
          <div style="display:flex;gap:8px">
            <el-input
              v-model="form.cardNumber"
              placeholder="请输入或粘贴10位数字卡密（自动去空格）"
              maxlength="10"
              inputmode="numeric"
              style="flex:1"
              :prefix-icon="CreditCard"
              @input="onCardInput"
              @blur="verifyCardNow"
            />
            <el-button :type="verifyBtnType" @click="verifyCardNow" :disabled="!canVerify">
              {{ verifying ? '验证中' : '验证卡密' }}
            </el-button>
          </div>
          <div v-if="cardInfo" style="margin-top:8px">
            <el-tag :type="cardInfoTagType" size="large" effect="light" round>✓ {{ cardInfo }}</el-tag>
          </div>
        </el-form-item>
        <el-form-item label="用户名（3-20位）" prop="username">
          <el-input v-model="form.username" placeholder="请设置登录用户名" :prefix-icon="User" />
        </el-form-item>
        <el-form-item label="密码（至少6位）" prop="password">
          <el-input v-model="form.password" type="password" placeholder="请设置登录密码" :prefix-icon="Lock" show-password />
        </el-form-item>
        <el-form-item label="确认密码" prop="confirmPassword">
          <el-input v-model="form.confirmPassword" type="password" placeholder="再次输入密码" :prefix-icon="Lock" show-password />
        </el-form-item>
        <el-form-item>
          <el-button class="zh-btn-primary" style="width:100%;height:44px" :loading="loading" @click="submit">注 册</el-button>
        </el-form-item>
      </el-form>

      <div class="links center" style="margin-top:8px">
        <span>已有账户？</span>
        <el-button type="primary" link @click="router.push('/login')">立即登录 →</el-button>
      </div>
      <div class="links center" style="margin-top:4px">
        <el-button type="info" link @click="router.push('/server-config')"><el-icon><Setting /></el-icon> 服务器地址配置</el-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { User, Lock, CreditCard, Setting } from '@element-plus/icons-vue';
import { useUserStore } from '../store/user';
import { verifyCard } from '../api';

const router = useRouter();
const userStore = useUserStore();
const formRef = ref();
const loading = ref(false);
const verifying = ref(false);
const cardInfo = ref('');
const cardInfoTagType = ref('success');

const form = reactive({
  cardNumber: '',
  username: '',
  password: '',
  confirmPassword: ''
});

const canVerify = computed(() => /^\d{10}$/.test(form.cardNumber));
const verifyBtnType = computed(() => cardInfo.value ? 'success' : 'primary');

const rules = {
  cardNumber: [
    { required: true, message: '请输入卡密', trigger: 'blur' },
    { pattern: /^\d{10}$/, message: '卡密必须是10位数字', trigger: 'blur' }
  ],
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 3, max: 20, message: '3-20个字符', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '至少6位', trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, message: '请确认密码', trigger: 'blur' },
    {
      validator: (_r, v, cb) => v === form.password ? cb() : cb(new Error('两次密码不一致')),
      trigger: 'blur'
    }
  ]
};

// 用户输入时实时去空格（兼容粘贴时带换行/空格/中文输入法全角空格）
function onCardInput(v) {
  if (v !== undefined && v !== null) {
    const cleaned = String(v).replace(/\s/g, '').replace(/[^\d]/g, '').slice(0, 10);
    if (cleaned !== form.cardNumber) form.cardNumber = cleaned;
  }
}

async function verifyCardNow() {
  onCardInput(form.cardNumber);
  if (!canVerify.value) {
    cardInfo.value = '';
    return;
  }
  verifying.value = true;
  try {
    const res = await verifyCard(form.cardNumber.trim());
    cardInfo.value = res.card.typeName;
    cardInfoTagType.value = 'success';
  } catch (e) {
    cardInfo.value = e.message || '卡密无效';
    cardInfoTagType.value = 'danger';
  } finally {
    verifying.value = false;
  }
}

async function submit() {
  await formRef.value.validate();
  if (!cardInfo.value || cardInfoTagType.value !== 'success') {
    await verifyCardNow();
    if (cardInfoTagType.value !== 'success') return ElMessage.error('卡密无效，请检查');
  }
  loading.value = true;
  onCardInput(form.cardNumber);
  try {
    const res = await userStore.register({
      username: form.username.trim(),
      password: form.password,
      cardNumber: form.cardNumber.trim(),
      deviceInfo: { platform: navigator.platform, userAgent: navigator.userAgent.slice(0, 200) }
    });
    if (res.status === 'active') {
      ElMessage.success('注册成功，请登录');
    } else {
      ElMessage.success('注册请求已提交，后端将在24小时内确认，确认后可登录');
    }
    router.push('/login');
  } finally {
    loading.value = false;
  }
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
}
.register-box { max-width: 100%; }
.logo-s {
  width: 54px; height: 54px;
  border-radius: 14px;
  object-fit: contain;
  box-shadow: 0 6px 20px rgba(102,126,234,0.28);
}
h2 { font-size: 22px; color: #1d2129; font-weight: 700; margin: 0; }
.sub { color: #86909c; font-size: 13px; margin: 0; }
.links { font-size: 13px; color: #606266; }
</style>
