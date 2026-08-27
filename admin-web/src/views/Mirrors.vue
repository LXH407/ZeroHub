<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title">镜像源配置</h2>
      <el-button type="primary" @click="addMirror"><el-icon><Plus /></el-icon> 添加镜像源</el-button>
    </div>
    <div class="card">
      <el-alert type="info" :closable="false" style="margin-bottom:16px">
        <template #title>
          客户端会按优先级（从小到大）依次尝试下载，速度慢时自动切换到下一个镜像源。支持 HuggingFace、ModelScope、自定义镜像。
        </template>
      </el-alert>
      <el-table :data="mirrors" border stripe>
        <el-table-column prop="name" label="名称" width="180">
          <template #default="{ row }">
            <el-input v-model="row.name" size="small" />
          </template>
        </el-table-column>
        <el-table-column prop="base_url" label="基础URL">
          <template #default="{ row }">
            <el-input v-model="row.base_url" size="small" placeholder="https://..." />
          </template>
        </el-table-column>
        <el-table-column label="类型" width="150">
          <template #default="{ row }">
            <el-select v-model="row.type" size="small" style="width:100%">
              <el-option label="HuggingFace" value="huggingface" />
              <el-option label="ModelScope魔搭" value="modelscope" />
              <el-option label="自定义" value="custom" />
            </el-select>
          </template>
        </el-table-column>
        <el-table-column label="优先级" width="120">
          <template #default="{ row }">
            <el-input-number v-model="row.priority" size="small" :min="0" :max="999" style="width:100%" />
          </template>
        </el-table-column>
        <el-table-column label="启用" width="80" align="center">
          <template #default="{ row }">
            <el-switch v-model="row.enabled" :active-value="1" :inactive-value="0" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100" align="center">
          <template #default="{ $index }">
            <el-button type="danger" size="small" link @click="mirrors.splice($index, 1)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div style="margin-top:20px">
        <el-button type="primary" :loading="saving" @click="saveMirrors"><el-icon><Check /></el-icon> 保存配置</el-button>
        <el-button @click="loadMirrors">重置</el-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { Plus, Check } from '@element-plus/icons-vue';
import { getMirrors, updateMirrors } from '../api';

const mirrors = ref([]);
const saving = ref(false);

async function loadMirrors() {
  const res = await getMirrors();
  mirrors.value = res.list.map(m => ({ ...m, enabled: m.enabled ?? 1 }));
}

function addMirror() {
  mirrors.value.push({ name: '新镜像源', base_url: '', type: 'custom', priority: 100, enabled: 1 });
}

async function saveMirrors() {
  for (const m of mirrors.value) {
    if (!m.name || !m.base_url) {
      return ElMessage.error('名称和URL不能为空');
    }
  }
  saving.value = true;
  try {
    await updateMirrors(mirrors.value);
    ElMessage.success('保存成功');
  } finally {
    saving.value = false;
  }
}

onMounted(loadMirrors);
</script>
