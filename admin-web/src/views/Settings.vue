<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title">系统设置</h2>
    </div>
    <div class="card" style="max-width:720px">
      <el-form :model="form" label-width="160px">
        <el-divider content-position="left">站点设置</el-divider>
        <el-form-item label="软件/站点名称">
          <el-input v-model="form.site_name" placeholder="显示在客户端标题上的名称" />
        </el-form-item>
        <el-form-item label="软件/站点图标URL">
          <el-input v-model="form.site_icon" placeholder="可选，图标图片URL" />
          <div v-if="form.site_icon" style="margin-top:8px">
            <el-image :src="resolveUrl(form.site_icon)" style="width:64px;height:64px;border:1px solid #eee;border-radius:8px" fit="cover" />
          </div>
        </el-form-item>
        <el-divider content-position="left">功能配置</el-divider>
        <el-form-item label="API中转站地址">
          <el-input v-model="form.api_proxy_url" type="textarea" :rows="2" placeholder="客户端显示的API中转站地址或说明" />
        </el-form-item>
        <el-form-item label="账户确认超时时间(小时)">
          <el-input-number v-model="confirmHours" :min="1" :max="168" />
          <span style="margin-left:8px;color:#909399">超过该时间未确认的账户将自动注销</span>
        </el-form-item>
        <el-divider content-position="left">版本与更新</el-divider>
        <el-form-item label="客户端最新版本号">
          <el-input v-model="form.client_version" placeholder="如 1.0.0" />
        </el-form-item>
        <el-form-item label="客户端更新地址">
          <el-input v-model="form.client_update_url" placeholder="新版本exe下载地址" />
        </el-form-item>
        <el-form-item label="更新日志">
          <el-input v-model="form.client_changelog" type="textarea" :rows="4" placeholder="版本更新内容说明" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="saving" @click="save"><el-icon><Check /></el-icon> 保存设置</el-button>
        </el-form-item>
      </el-form>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue';
import { ElMessage } from 'element-plus';
import { Check } from '@element-plus/icons-vue';
import { getSettings, updateSettings } from '../api';

const form = reactive({});
const saving = ref(false);
const confirmHours = ref(24);

function resolveUrl(u) {
  if (!u) return '';
  if (u.startsWith('http')) return u;
  return u.startsWith('/') ? u : `/${u}`;
}

async function load() {
  const res = await getSettings();
  Object.assign(form, res.settings);
  if (form.confirm_timeout_hours) {
    confirmHours.value = parseInt(form.confirm_timeout_hours);
  }
}

async function save() {
  saving.value = true;
  try {
    const payload = { ...form, confirm_timeout_hours: String(confirmHours.value) };
    await updateSettings({ settings: payload });
    ElMessage.success('保存成功');
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>
