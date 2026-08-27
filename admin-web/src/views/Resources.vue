<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title">资源管理</h2>
      <el-button type="primary" @click="openEditDialog"><el-icon><Plus /></el-icon> 添加资源</el-button>
    </div>
    <div class="card">
      <div class="filter-bar">
        <el-input v-model="filters.keyword" placeholder="搜索资源名称" clearable style="width:220px" :prefix-icon="Search" @keyup.enter="loadList" />
        <el-select v-model="filters.type" placeholder="资源类型" clearable style="width:140px" @change="loadList">
          <el-option label="全部" value="all" />
          <el-option label="软件" value="software" />
          <el-option label="大模型" value="model" />
          <el-option label="游戏" value="game" />
          <el-option label="API中转站" value="api" />
        </el-select>
        <el-select v-model="filters.status" placeholder="状态" clearable style="width:140px" @change="loadList">
          <el-option label="全部" value="all" />
          <el-option label="上架中" value="active" />
          <el-option label="已下架" value="inactive" />
        </el-select>
        <el-button type="primary" @click="loadList"><el-icon><Search /></el-icon> 查询</el-button>
      </div>

      <el-table :data="list" stripe border>
        <el-table-column label="图标" width="80" align="center">
          <template #default="{ row }">
            <el-image v-if="row.icon" :src="resolveUrl(row.icon)" style="width:48px;height:48px;border-radius:8px" fit="cover" />
            <el-icon v-else :size="40" color="#c0c4cc"><Picture /></el-icon>
          </template>
        </el-table-column>
        <el-table-column prop="name" label="名称" min-width="160" show-overflow-tooltip />
        <el-table-column label="类型" width="110">
          <template #default="{ row }">
            <el-tag size="small" :class="`tag-${row.type}`">{{ typeName(row.type) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="points_required" label="积分" width="70" align="center" />
        <el-table-column prop="version" label="版本" width="90" />
        <el-table-column prop="file_size" label="大小" width="100" />
        <el-table-column label="控制台下载" width="100" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.console_download" type="warning" size="small">是</el-tag>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="80">
          <template #default="{ row }">
            <el-tag v-if="row.status === 'active'" type="success" size="small">上架</el-tag>
            <el-tag v-else type="info" size="small">下架</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="updated_at" label="更新时间" width="170">
          <template #default="{ row }">{{ formatTime(row.updated_at) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" size="small" link @click="openEditDialog(row)">编辑</el-button>
            <el-button type="danger" size="small" link @click="deleteResource(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-wrap">
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="total"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="loadList"
          @current-change="loadList"
        />
      </div>
    </div>

    <!-- 编辑弹窗 -->
    <el-dialog v-model="editVisible" :title="form.id ? '编辑资源' : '添加资源'" width="760px" top="4vh">
      <el-form :model="form" label-width="110px">
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="资源名称" required>
              <el-input v-model="form.name" placeholder="软件/模型/游戏/API名称" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="资源类型" required>
              <el-select v-model="form.type" style="width:100%">
                <el-option label="软件" value="software" />
                <el-option label="大模型" value="model" />
                <el-option label="游戏" value="game" />
                <el-option label="API中转站" value="api" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="图标">
              <div style="display:flex;gap:12px;align-items:center">
                <el-upload :action="uploadUrl" :headers="uploadHeaders" :show-file-list="false" :on-success="onIconUpload" accept="image/*">
                  <el-avatar :size="56" :src="resolveUrl(form.icon)">
                    <el-icon :size="28"><Plus /></el-icon>
                  </el-avatar>
                </el-upload>
                <el-input v-model="form.icon" placeholder="URL或上传" style="flex:1" />
              </div>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="封面图">
              <div style="display:flex;gap:12px;align-items:center">
                <el-upload :action="uploadUrl" :headers="uploadHeaders" :show-file-list="false" :on-success="(r)=>onCoverUpload(r)" accept="image/*">
                  <el-button size="small" type="primary">上传</el-button>
                </el-upload>
                <el-input v-model="form.cover_image" placeholder="图片URL" style="flex:1" />
              </div>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="所需积分">
              <el-input-number v-model="form.points_required" :min="0" :max="999" style="width:100%" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="版本号">
              <el-input v-model="form.version" placeholder="v1.0.0" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="文件大小">
              <el-input v-model="form.file_size" placeholder="如 2.3GB" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="作者/开发者">
              <el-input v-model="form.author" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="排序（小在前）">
              <el-input-number v-model="form.sort_order" :min="0" :max="9999" style="width:100%" />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="描述">
              <el-input v-model="form.description" type="textarea" :rows="3" placeholder="详细介绍" />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="主下载链接">
              <el-input v-model="form.download_url" placeholder="https://..." />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="镜像下载链接">
              <div style="width:100%">
                <div v-for="(u, i) in form.mirror_urls" :key="i" style="display:flex;gap:8px;margin-bottom:8px">
                  <el-input v-model="form.mirror_urls[i]" placeholder="镜像URL（直链，支持低速自动切换）" />
                  <el-button type="danger" size="small" @click="form.mirror_urls.splice(i,1)"><el-icon><Delete /></el-icon></el-button>
                </div>
                <el-button size="small" @click="form.mirror_urls.push('')"><el-icon><Plus /></el-icon> 添加镜像</el-button>
              </div>
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="网盘下载渠道">
              <div style="width:100%">
                <div v-for="(ch, i) in form.download_channels" :key="i"
                  style="display:grid;grid-template-columns:130px 1fr 1fr 120px 40px;gap:8px;margin-bottom:10px;padding:10px;background:#fafbfc;border-radius:8px;border:1px solid #ebeef5">
                  <el-select v-model="ch.channel" placeholder="网盘类型" @change="ch.name=ch.name||''">
                    <el-option v-for="c in DEFAULT_CHANNELS_OPTS" :key="c.value" :label="c.label" :value="c.value" />
                  </el-select>
                  <el-input v-model="ch.url" placeholder="网盘分享链接（如 https://pan.baidu.com/s/xxxxx）" />
                  <el-input v-model="ch.code" placeholder="提取码（如：3abc，没有留空）" maxlength="16" />
                  <el-input v-model="ch.remark" placeholder="备注（可选，如2026版）" maxlength="30" />
                  <el-button type="danger" size="small" style="height:100%" @click="form.download_channels.splice(i,1)"><el-icon><Delete /></el-icon></el-button>
                </div>
                <el-button size="small" @click="form.download_channels.push({channel:'baidu',name:'',url:'',code:'',remark:''})">
                  <el-icon><Plus /></el-icon> 添加网盘渠道（百度/夸克/迅雷/阿里等，支持多个）
                </el-button>
              </div>
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="截图展示">
              <div style="width:100%">
                <div v-for="(u, i) in form.screenshots" :key="i" style="display:flex;gap:8px;margin-bottom:8px;align-items:center">
                  <el-image v-if="u" :src="resolveUrl(u)" style="width:60px;height:60px;border:1px solid #eee;border-radius:4px" fit="cover" />
                  <el-input v-model="form.screenshots[i]" placeholder="截图URL" style="flex:1" />
                  <el-upload :action="uploadUrl" :headers="uploadHeaders" :show-file-list="false" :on-success="(r)=>onShotUpload(r,i)" accept="image/*">
                    <el-button size="small">上传</el-button>
                  </el-upload>
                  <el-button type="danger" size="small" @click="form.screenshots.splice(i,1)"><el-icon><Delete /></el-icon></el-button>
                </div>
                <el-button size="small" @click="form.screenshots.push('')"><el-icon><Plus /></el-icon> 添加截图</el-button>
              </div>
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="标签">
              <el-select v-model="form.tags" multiple filterable allow-create default-first-option style="width:100%" placeholder="输入后回车添加标签">
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="控制台下载">
              <el-switch v-model="form.console_download" />
              <span style="margin-left:8px;color:#909399;font-size:12px">如huggingface-cli等</span>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="状态">
              <el-select v-model="form.status" style="width:100%">
                <el-option label="上架" value="active" />
                <el-option label="下架" value="inactive" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submitForm">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Search, Plus, Picture, Delete } from '@element-plus/icons-vue';
import { useAdminStore } from '../store/admin';
import { getResources, createResource, updateResource, deleteResource as deleteApi, uploadFile } from '../api';

const store = useAdminStore();
const API_BASE = '/';
const uploadUrl = computed(() => `${API_BASE}api/upload`);
const uploadHeaders = computed(() => ({ Authorization: `Bearer ${store.token}` }));

const list = ref([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const filters = reactive({ keyword: '', type: '', status: '' });
const editVisible = ref(false);
const saving = ref(false);

const DEFAULT_CHANNELS_OPTS = [
  { label: '百度网盘', value: 'baidu', color: '#2d7dff' },
  { label: '夸克网盘', value: 'quark', color: '#3b82f6' },
  { label: '迅雷网盘', value: 'xunlei', color: '#1faeff' },
  { label: '阿里云盘', value: 'aliyun', color: '#ff5000' },
  { label: '123云盘', value: '123pan', color: '#6a5cff' },
  { label: '蓝奏云', value: 'lanzou', color: '#00b16a' },
  { label: '腾讯微云', value: 'weiyun', color: '#1da6fa' },
  { label: '其他网盘', value: 'other', color: '#909399' }
];
const channelColor = v => (DEFAULT_CHANNELS_OPTS.find(c => c.value === v) || {}).color || '#909399';
const channelLabel = v => (DEFAULT_CHANNELS_OPTS.find(c => c.value === v) || {}).label || '其他';

const defaultForm = () => ({
  id: null, name: '', type: 'software', description: '', icon: '', cover_image: '',
  screenshots: [], points_required: 0, download_url: '', mirror_urls: [],
  download_channels: [],
  file_size: '', version: '', author: '', tags: [], sort_order: 0,
  console_download: false, status: 'active'
});
const form = reactive(defaultForm());

function formatTime(t) { if (!t) return ''; return new Date(t).toLocaleString('zh-CN'); }
function typeName(t) { return { software: '软件', model: '大模型', game: '游戏', api: 'API中转站' }[t] || t; }
function resolveUrl(u) { if (!u) return ''; if (u.startsWith('http')) return u; return u.startsWith('/') ? u : `/${u}`; }

function resetForm() { Object.assign(form, defaultForm()); }

async function loadList() {
  const res = await getResources({
    page: page.value, pageSize: pageSize.value,
    keyword: filters.keyword || undefined,
    type: filters.type || undefined,
    status: filters.status || undefined
  });
  list.value = res.list;
  total.value = res.total;
}

function openEditDialog(row) {
  resetForm();
  if (row) {
    Object.assign(form, JSON.parse(JSON.stringify(row)));
    if (!Array.isArray(form.mirror_urls)) form.mirror_urls = [];
    if (!Array.isArray(form.screenshots)) form.screenshots = [];
    if (!Array.isArray(form.tags)) form.tags = [];
    if (!Array.isArray(form.download_channels)) form.download_channels = [];
  }
  editVisible.value = true;
}

async function submitForm() {
  if (!form.name) return ElMessage.error('请填写资源名称');
  saving.value = true;
  try {
    if (form.id) {
      await updateResource(form.id, { ...form });
      ElMessage.success('更新成功');
    } else {
      await createResource({ ...form });
      ElMessage.success('创建成功');
    }
    editVisible.value = false;
    loadList();
  } finally {
    saving.value = false;
  }
}

async function deleteResource(row) {
  await ElMessageBox.confirm(`确定删除 "${row.name}"? 下载记录也会被删除`, '提示', { type: 'warning' });
  await deleteApi(row.id);
  ElMessage.success('已删除');
  loadList();
}

function onIconUpload(r) { if (r?.success) form.icon = r.url; }
function onCoverUpload(r) { if (r?.success) form.cover_image = r.url; }
function onShotUpload(r, i) { if (r?.success) form.screenshots[i] = r.url; }

onMounted(loadList);
</script>
