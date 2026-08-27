<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title">用户管理</h2>
    </div>
    <div class="card">
      <div class="filter-bar">
        <el-input v-model="filters.keyword" placeholder="搜索用户名" clearable style="width:200px" :prefix-icon="Search" @keyup.enter="loadList" />
        <el-select v-model="filters.status" placeholder="用户状态" clearable style="width:140px" @change="loadList">
          <el-option label="全部" value="all" />
          <el-option label="待确认" value="pending" />
          <el-option label="活跃" value="active" />
          <el-option label="已封禁" value="banned" />
          <el-option label="已注销" value="cancelled" />
        </el-select>
        <el-select v-model="filters.vipType" placeholder="VIP类型" clearable style="width:140px" @change="loadList">
          <el-option label="全部" value="all" />
          <el-option label="普通用户" value="none" />
          <el-option label="周卡" value="week" />
          <el-option label="月卡" value="month" />
          <el-option label="年卡" value="year" />
          <el-option label="永久VIP" value="permanent" />
        </el-select>
        <el-button type="primary" @click="loadList"><el-icon><Search /></el-icon> 查询</el-button>
      </div>

      <el-table :data="list" stripe border>
        <el-table-column prop="id" label="ID" width="60" align="center" />
        <el-table-column prop="username" label="用户名" width="140" />
        <el-table-column label="VIP" width="100">
          <template #default="{ row }">
            <el-tag :type="vipTagType(row.vip_type)" size="small">{{ vipName(row.vip_type) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="vip_expire_at" label="VIP到期" width="170">
          <template #default="{ row }">{{ row.vip_expire_at ? formatTime(row.vip_expire_at) : '-' }}</template>
        </el-table-column>
        <el-table-column prop="points" label="积分" width="80" align="center" />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <span :class="`status-${row.status}`">{{ statusName(row.status) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="confirmed_at" label="确认时间" width="170">
          <template #default="{ row }">{{ row.confirmed_at ? formatTime(row.confirmed_at) : '-' }}</template>
        </el-table-column>
        <el-table-column prop="created_at" label="注册时间" width="170">
          <template #default="{ row }">{{ formatTime(row.created_at) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="280" fixed="right">
          <template #default="{ row }">
            <el-button v-if="row.status === 'pending'" type="success" size="small" link @click="confirmUser(row)">确认</el-button>
            <el-button v-if="row.status !== 'banned' && row.status !== 'cancelled'" type="danger" size="small" link @click="banUser(row)">封禁</el-button>
            <el-button v-if="row.status === 'banned'" type="success" size="small" link @click="unbanUser(row)">解封</el-button>
            <el-button v-if="row.status !== 'cancelled'" type="warning" size="small" link @click="openVipDialog(row)">VIP/积分</el-button>
            <el-button v-if="row.status !== 'cancelled'" type="info" size="small" link @click="cancelUser(row)">注销</el-button>
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

    <!-- VIP修改弹窗 -->
    <el-dialog v-model="vipVisible" title="修改用户VIP/积分" width="420px">
      <el-form :model="vipForm" label-width="100px">
        <el-form-item label="用户名">
          <el-input :value="vipForm.username" disabled />
        </el-form-item>
        <el-form-item label="VIP类型">
          <el-select v-model="vipForm.vipType" style="width:100%">
            <el-option label="普通用户" value="none" />
            <el-option label="周卡VIP" value="week" />
            <el-option label="月卡VIP" value="month" />
            <el-option label="年卡VIP" value="year" />
            <el-option label="永久VIP" value="permanent" />
          </el-select>
        </el-form-item>
        <el-form-item label="积分">
          <el-input-number v-model="vipForm.points" :min="0" :max="99999" style="width:100%" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="vipVisible = false">取消</el-button>
        <el-button type="primary" :loading="vipLoading" @click="submitVip">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Search } from '@element-plus/icons-vue';
import { getUsers, banUser as banApi, unbanUser as unbanApi, confirmUser as confirmApi, cancelUser as cancelApi, updateUserVip } from '../api';

const list = ref([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const filters = reactive({ keyword: '', status: '', vipType: '' });
const vipVisible = ref(false);
const vipLoading = ref(false);
const vipForm = reactive({ id: null, username: '', vipType: 'none', points: 0 });

function formatTime(t) {
  if (!t) return '';
  return new Date(t).toLocaleString('zh-CN');
}
function vipName(t) {
  return { none: '普通', week: '周卡', month: '月卡', year: '年卡', permanent: '永久' }[t] || '-';
}
function vipTagType(t) {
  return { week: 'warning', month: '', year: 'success', permanent: 'danger' }[t] || 'info';
}
function statusName(s) {
  return { pending: '待确认', active: '活跃', banned: '已封禁', cancelled: '已注销' }[s] || s;
}

async function loadList() {
  const res = await getUsers({
    page: page.value,
    pageSize: pageSize.value,
    keyword: filters.keyword || undefined,
    status: filters.status || undefined,
    vipType: filters.vipType || undefined
  });
  list.value = res.list;
  total.value = res.total;
}

async function banUser(row) {
  await ElMessageBox.confirm(`确定封禁用户 "${row.username}"?`, '提示', { type: 'warning' });
  await banApi(row.id);
  ElMessage.success('已封禁');
  loadList();
}
async function unbanUser(row) {
  await ElMessageBox.confirm(`确定解封用户 "${row.username}"?`, '提示', { type: 'success' });
  await unbanApi(row.id);
  ElMessage.success('已解封');
  loadList();
}
async function confirmUser(row) {
  await confirmApi(row.id);
  ElMessage.success('已确认激活');
  loadList();
}
async function cancelUser(row) {
  await ElMessageBox.confirm(`确定注销用户 "${row.username}"?此操作不可撤销`, '提示', { type: 'warning' });
  await cancelApi(row.id);
  ElMessage.success('已注销');
  loadList();
}
function openVipDialog(row) {
  vipForm.id = row.id;
  vipForm.username = row.username;
  vipForm.vipType = row.vip_type || 'none';
  vipForm.points = row.points || 0;
  vipVisible.value = true;
}
async function submitVip() {
  vipLoading.value = true;
  try {
    await updateUserVip(vipForm.id, { vipType: vipForm.vipType, points: vipForm.points });
    ElMessage.success('修改成功');
    vipVisible.value = false;
    loadList();
  } finally {
    vipLoading.value = false;
  }
}

onMounted(loadList);
</script>
