<template>
  <el-container class="layout-container">
    <el-aside :width="collapsed ? '64px' : '220px'" class="aside">
      <div class="logo">
        <el-icon :size="28" color="#fff"><Platform /></el-icon>
        <span v-show="!collapsed" class="logo-text">ZeroHub</span>
      </div>
      <el-menu
        :default-active="route.path"
        :collapse="collapsed"
        background-color="#001529"
        text-color="#b7bdc6"
        active-text-color="#fff"
        router
      >
        <template v-for="item in menuList" :key="item.path">
          <el-menu-item :index="item.path">
            <el-icon><component :is="item.icon" /></el-icon>
            <template #title>{{ item.title }}</template>
          </el-menu-item>
        </template>
      </el-menu>
    </el-aside>
    <el-container>
      <el-header class="header">
        <div class="header-left">
          <el-icon class="toggle-btn" :size="20" @click="collapsed = !collapsed">
            <Fold v-if="!collapsed" /><Expand v-else />
          </el-icon>
          <el-breadcrumb separator="/">
            <el-breadcrumb-item :to="{ path: '/dashboard' }">首页</el-breadcrumb-item>
            <el-breadcrumb-item v-if="route.meta.title">{{ route.meta.title }}</el-breadcrumb-item>
          </el-breadcrumb>
        </div>
        <div class="header-right">
          <el-dropdown @command="handleCommand">
            <span class="user-info">
              <el-avatar :size="32" style="background:#409eff">{{ admin?.username?.[0]?.toUpperCase() }}</el-avatar>
              <span style="margin-left:8px">{{ admin?.username }}</span>
              <el-icon><ArrowDown /></el-icon>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="password"><el-icon><Key /></el-icon> 修改密码</el-dropdown-item>
                <el-dropdown-item command="logout" divided><el-icon><SwitchButton /></el-icon> 退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </el-header>
      <el-main class="main-content">
        <router-view />
      </el-main>
    </el-container>
  </el-container>

  <!-- 修改密码弹窗 -->
  <el-dialog v-model="pwdVisible" title="修改密码" width="420px">
    <el-form ref="pwdFormRef" :model="pwdForm" :rules="pwdRules" label-width="100px">
      <el-form-item label="原密码" prop="oldPassword">
        <el-input v-model="pwdForm.oldPassword" type="password" show-password />
      </el-form-item>
      <el-form-item label="新密码" prop="newPassword">
        <el-input v-model="pwdForm.newPassword" type="password" show-password />
      </el-form-item>
      <el-form-item label="确认密码" prop="confirmPassword">
        <el-input v-model="pwdForm.confirmPassword" type="password" show-password />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="pwdVisible = false">取消</el-button>
      <el-button type="primary" :loading="pwdLoading" @click="submitPwd">确定</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, computed, reactive } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Platform, Fold, Expand, ArrowDown, Key, SwitchButton } from '@element-plus/icons-vue';
import { useAdminStore } from '../store/admin';
import { changeAdminPassword } from '../api';

const route = useRoute();
const router = useRouter();
const store = useAdminStore();
const admin = computed(() => store.admin);
const collapsed = ref(false);
const pwdVisible = ref(false);
const pwdFormRef = ref();
const pwdLoading = ref(false);

const menuList = [
  { path: '/dashboard', title: '仪表盘', icon: 'DataAnalysis' },
  { path: '/users', title: '用户管理', icon: 'User' },
  { path: '/cards', title: '卡密管理', icon: 'CreditCard' },
  { path: '/resources', title: '资源管理', icon: 'Folder' },
  { path: '/mirrors', title: '镜像源配置', icon: 'Connection' },
  { path: '/pending', title: '待注册处理', icon: 'Clock' },
  { path: '/settings', title: '系统设置', icon: 'Setting' }
];

const pwdForm = reactive({
  oldPassword: '',
  newPassword: '',
  confirmPassword: ''
});

const pwdRules = {
  oldPassword: [{ required: true, message: '请输入原密码', trigger: 'blur' }],
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, message: '至少6位', trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, message: '请再次输入新密码', trigger: 'blur' },
    {
      validator: (r, v, cb) => {
        if (v !== pwdForm.newPassword) cb(new Error('两次密码不一致'));
        else cb();
      },
      trigger: 'blur'
    }
  ]
};

function handleCommand(cmd) {
  if (cmd === 'logout') {
    ElMessageBox.confirm('确认退出登录？', '提示', { type: 'warning' }).then(() => {
      store.logout();
      router.push('/login');
    }).catch(() => {});
  } else if (cmd === 'password') {
    pwdVisible.value = true;
    Object.assign(pwdForm, { oldPassword: '', newPassword: '', confirmPassword: '' });
  }
}

async function submitPwd() {
  await pwdFormRef.value.validate();
  pwdLoading.value = true;
  try {
    await changeAdminPassword({
      oldPassword: pwdForm.oldPassword,
      newPassword: pwdForm.newPassword
    });
    ElMessage.success('密码修改成功');
    pwdVisible.value = false;
  } finally {
    pwdLoading.value = false;
  }
}
</script>

<style scoped>
.layout-container {
  height: 100vh;
}
.aside {
  background: #001529;
  transition: width 0.2s;
  overflow: hidden;
}
.logo {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: #fff;
  border-bottom: 1px solid #1f2d3d;
}
.logo-text {
  font-size: 18px;
  font-weight: 600;
}
:deep(.el-menu) {
  border-right: none;
}
.header {
  background: #fff;
  border-bottom: 1px solid #e6e8eb;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  height: 60px;
}
.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}
.toggle-btn {
  cursor: pointer;
  color: #606266;
}
.user-info {
  display: flex;
  align-items: center;
  cursor: pointer;
  color: #606266;
}
.main-content {
  padding: 0;
  overflow: auto;
  background: #f5f7fa;
}
</style>
