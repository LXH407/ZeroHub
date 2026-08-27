<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title">卡密管理</h2>
      <el-button type="primary" @click="openGenerateDialog"><el-icon><Plus /></el-icon> 生成卡密</el-button>
    </div>
    <div class="card">
      <div class="filter-bar">
        <el-input v-model="filters.keyword" placeholder="搜索卡密号" clearable style="width:220px" :prefix-icon="Search" @keyup.enter="loadList" />
        <el-select v-model="filters.type" placeholder="卡密类型" clearable style="width:140px" @change="loadList">
          <el-option label="积分卡" value="point" />
          <el-option label="VIP周卡" value="week" />
          <el-option label="VIP月卡" value="month" />
          <el-option label="VIP年卡" value="year" />
          <el-option label="永久VIP" value="permanent" />
        </el-select>
        <el-select v-model="filters.status" placeholder="使用状态" clearable style="width:140px" @change="loadList">
          <el-option label="未使用" value="unused" />
          <el-option label="已使用" value="used" />
          <el-option label="已封禁" value="banned" />
        </el-select>
        <el-button type="primary" @click="loadList"><el-icon><Search /></el-icon> 查询</el-button>
      </div>

      <el-table :data="list" stripe border>
        <el-table-column prop="id" label="ID" width="60" align="center" />
        <el-table-column label="卡密号" width="150">
          <template #default="{ row }">
            <span style="font-family:monospace;letter-spacing:1px">{{ row.card_number }}</span>
            <el-button type="primary" link size="small" @click="copyCard(row.card_number)">复制</el-button>
          </template>
        </el-table-column>
        <el-table-column label="类型" width="110">
          <template #default="{ row }">{{ cardTypeName(row.type, row.points) }}</template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <span :class="`status-${row.status}`">{{ statusName(row.status) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="used_by_username" label="使用者" width="120">
          <template #default="{ row }">{{ row.used_by_username || '-' }}</template>
        </el-table-column>
        <el-table-column prop="used_at" label="使用时间" width="170">
          <template #default="{ row }">{{ row.used_at ? formatTime(row.used_at) : '-' }}</template>
        </el-table-column>
        <el-table-column prop="created_at" label="生成时间" width="170">
          <template #default="{ row }">{{ formatTime(row.created_at) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button v-if="row.status === 'unused'" type="danger" size="small" link @click="banCard(row)">封禁</el-button>
            <el-button v-if="row.status === 'banned'" type="success" size="small" link @click="unbanCard(row)">解封</el-button>
            <el-button type="info" size="small" link @click="deleteCard(row)">删除</el-button>
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

    <!-- 生成卡密弹窗 -->
    <el-dialog v-model="genVisible" title="生成卡密" width="480px">
      <el-form :model="genForm" label-width="110px">
        <el-form-item label="卡密类型">
          <el-select v-model="genForm.type" style="width:100%" @change="onTypeChange">
            <el-option label="积分卡（1个资源/积分）" value="point" />
            <el-option label="VIP周卡" value="week" />
            <el-option label="VIP月卡" value="month" />
            <el-option label="VIP年卡" value="year" />
            <el-option label="永久VIP" value="permanent" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="genForm.type === 'point'" label="积分数值">
          <el-input-number v-model="genForm.points" :min="1" :max="999" style="width:100%" />
        </el-form-item>
        <el-form-item label="生成数量">
          <el-input-number v-model="genForm.count" :min="1" :max="500" style="width:100%" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="genVisible = false">取消</el-button>
        <el-button type="primary" :loading="genLoading" @click="submitGenerate">确定生成</el-button>
      </template>
    </el-dialog>

    <!-- 生成结果弹窗 -->
    <el-dialog v-model="resultVisible" :title="`生成成功 (${resultCards.length}张)`" width="520px">
      <div style="margin-bottom:12px">
        <el-button type="primary" size="small" @click="copyAllCards"><el-icon><CopyDocument /></el-icon> 复制全部</el-button>
        <el-button type="success" size="small" @click="downloadCards"><el-icon><Download /></el-icon> 下载txt</el-button>
      </div>
      <el-input type="textarea" :rows="10" :model-value="resultCards.join('\n')" readonly style="font-family:monospace" />
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Search, Plus, CopyDocument, Download } from '@element-plus/icons-vue';
import { getCards, generateCards, banCard as banApi, unbanCard as unbanApi, deleteCard as deleteApi } from '../api';

const list = ref([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const filters = reactive({ keyword: '', type: '', status: '' });
const genVisible = ref(false);
const genLoading = ref(false);
const genForm = reactive({ type: 'point', count: 10, points: 1 });
const resultVisible = ref(false);
const resultCards = ref([]);

function formatTime(t) { if (!t) return ''; return new Date(t).toLocaleString('zh-CN'); }
function cardTypeName(t, p) {
  const map = { point: `积分卡(${p})`, week: 'VIP周卡', month: 'VIP月卡', year: 'VIP年卡', permanent: '永久VIP' };
  return map[t] || t;
}
function statusName(s) { return { unused: '未使用', used: '已使用', banned: '已封禁' }[s] || s; }
function onTypeChange() { if (genForm.type !== 'point') genForm.points = 1; }

async function loadList() {
  const res = await getCards({
    page: page.value, pageSize: pageSize.value,
    keyword: filters.keyword || undefined,
    type: filters.type || undefined,
    status: filters.status || undefined
  });
  list.value = res.list;
  total.value = res.total;
}

function openGenerateDialog() {
  Object.assign(genForm, { type: 'point', count: 10, points: 1 });
  genVisible.value = true;
}

async function submitGenerate() {
  genLoading.value = true;
  try {
    const res = await generateCards({ type: genForm.type, count: genForm.count, points: genForm.points });
    resultCards.value = res.cards;
    genVisible.value = false;
    resultVisible.value = true;
    loadList();
  } finally {
    genLoading.value = false;
  }
}

function copyCard(v) {
  navigator.clipboard.writeText(v);
  ElMessage.success('已复制');
}
function copyAllCards() {
  navigator.clipboard.writeText(resultCards.value.join('\n'));
  ElMessage.success('已复制全部');
}
function downloadCards() {
  const blob = new Blob([resultCards.value.join('\r\n')], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cards_${genForm.type}_${Date.now()}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

async function banCard(row) {
  await ElMessageBox.confirm('确定封禁该卡密?', '提示', { type: 'warning' });
  await banApi(row.id);
  ElMessage.success('已封禁');
  loadList();
}
async function unbanCard(row) {
  await unbanApi(row.id);
  ElMessage.success('已解封');
  loadList();
}
async function deleteCard(row) {
  await ElMessageBox.confirm('确定删除?', '提示', { type: 'warning' });
  await deleteApi(row.id);
  ElMessage.success('已删除');
  loadList();
}

onMounted(loadList);
</script>
