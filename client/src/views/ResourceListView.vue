<template>
  <div class="res-list-view" v-loading="loading">
    <div class="page-padding">
      <div class="space-between mb-18">
        <h2 class="page-title">
          <el-icon :size="22" :color="catColor"><component :is="catIcon" /></el-icon>
          <span class="ml-2">{{ pageTitle }}</span>
          <el-tag style="margin-left:10px" type="info" effect="plain" round>共 {{ total }} 个</el-tag>
        </h2>
      </div>

      <!-- 筛选 -->
      <div class="filter-wrap zh-card mb-18">
        <el-input v-model="keyword" :placeholder="`搜索${pageTitle}`" clearable style="width:280px" :prefix-icon="Search" @keyup.enter="loadList(1)" @change="loadList(1)">
          <template #append>
            <el-button class="zh-btn-primary" @click="loadList(1)"><el-icon><Search /></el-icon> 搜索</el-button>
          </template>
        </el-input>
        <el-radio-group v-model="sort" style="margin-left:16px" @change="loadList(1)">
          <el-radio-button value="new">最新</el-radio-button>
          <el-radio-button value="hot">热门</el-radio-button>
        </el-radio-group>
      </div>

      <!-- 列表 -->
      <div v-if="list.length" class="grid-list">
        <div
          v-for="item in list" :key="item.id"
          class="res-card zh-card"
          @click="router.push(`/resource/${item.id}`)"
        >
          <div class="rc-cover">
            <el-image v-if="item.cover_image" :src="resolveUrl(item.cover_image)" fit="cover" style="width:100%;height:100%" />
            <div class="rc-icon" v-else :style="{ background: catBg }">
              <el-icon :size="40" color="#fff"><component :is="catIcon" /></el-icon>
            </div>
          </div>
          <div class="rc-body">
            <div class="rc-head space-between">
              <div class="rc-title truncate" :title="item.name">{{ item.name }}</div>
            </div>
            <div class="rc-desc ellipsis-2">{{ item.description }}</div>
            <div class="rc-foot space-between" style="margin-top:10px">
              <div>
                <el-tag v-if="isVip || item.points_required === 0" type="success" size="small" effect="light">免费下载</el-tag>
                <el-tag v-else type="warning" size="small" effect="light">{{ item.points_required }} 积分/次</el-tag>
              </div>
              <div class="rc-meta">
                <span v-if="item.file_size" class="rc-size">{{ item.file_size }}</span>
                <span v-if="item.console_download" class="rc-console">
                  <el-icon color="#e6a23c"><Promotion /></el-icon> 控制台
                </span>
              </div>
            </div>
            <div class="rc-tags" v-if="item.tags?.length">
              <el-tag v-for="t in item.tags.slice(0,3)" :key="t" size="small" effect="plain">{{ t }}</el-tag>
            </div>
          </div>
        </div>
      </div>
      <el-empty v-else-if="!loading" description="暂无该分类下的资源" />

      <div class="pagination-wrap mt-28">
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="pageSize"
          :page-sizes="[12, 24, 48]"
          :total="total"
          layout="total, sizes, prev, pager, next, jumper"
          background
          @size-change="loadList(1)"
          @current-change="loadList()"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Search, Monitor, Cpu, Game, Connection, Promotion } from '@element-plus/icons-vue';
import { useUserStore } from '../store/user';
import { getResources, getBaseURL } from '../api';

const route = useRoute();
const router = useRouter();
const userStore = useUserStore();

const type = computed(() => route.meta?.type || route.query?.type || 'software');
const pageTitle = computed(() => ({ software: '软件下载', model: '大模型下载', game: '游戏下载', api: 'API中转站' }[type.value]));
const catIcon = computed(() => ({ software: 'Monitor', model: 'Cpu', game: 'Game', api: 'Connection' }[type.value]));
const catColor = computed(() => ({ software: '#409eff', model: '#67c23a', game: '#e6a23c', api: '#f56c6c' }[type.value]));
const catBg = computed(() => ({
  software: 'linear-gradient(135deg,#9ec9ff,#409eff)',
  model: 'linear-gradient(135deg,#c2e7b0,#67c23a)',
  game: 'linear-gradient(135deg,#f5d5a5,#e6a23c)',
  api: 'linear-gradient(135deg,#f3a4a4,#f56c6c)'
}[type.value]));

const keyword = ref(route.query?.kw || '');
const sort = ref('new');
const page = ref(1);
const pageSize = ref(12);
const total = ref(0);
const list = ref([]);
const loading = ref(false);

const isVip = computed(() => userStore.user?.vipType && userStore.user.vipType !== 'none');

function resolveUrl(u) {
  if (!u) return '';
  if (u.startsWith('http')) return u;
  const base = getBaseURL();
  return u.startsWith('/') ? base + u : base + '/' + u;
}

async function loadList(resetPage) {
  if (resetPage) page.value = 1;
  loading.value = true;
  try {
    const res = await getResources({
      type: type.value === 'api' ? 'api' : type.value,
      keyword: keyword.value || undefined,
      sort: sort.value,
      page: page.value,
      pageSize: pageSize.value
    });
    list.value = res.list;
    total.value = res.total;
  } finally {
    loading.value = false;
  }
}

onMounted(loadList);
watch(() => route.path, () => loadList(true));
</script>

<style scoped>
.res-list-view { height: 100%; overflow: auto; }
.page-padding { padding: 24px 28px 40px; }
.page-title {
  font-size: 22px; font-weight: 700; color: #1d2129;
  display: flex; align-items: center;
}
.filter-wrap {
  padding: 14px 18px;
  display: flex; align-items: center;
}
.grid-list {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}
.res-card {
  overflow: hidden;
  cursor: pointer;
  display: flex;
  flex-direction: column;
}
.rc-cover {
  height: 150px;
  background: linear-gradient(135deg,#c6e2ff,#b4a0ff);
  display: flex; align-items: center; justify-content: center;
  position: relative;
}
.rc-icon {
  width: 80px; height: 80px; border-radius: 20px;
  display: flex; align-items: center; justify-content: center;
  background: rgba(255,255,255,0.2);
}
.rc-body { padding: 14px 16px 16px; }
.rc-title {
  font-size: 15px; font-weight: 600; color: #1d2129;
  max-width: 60%;
}
.rc-desc {
  font-size: 12px; color: #86909c;
  margin-top: 6px;
  height: 34px; line-height: 1.4;
}
.rc-size { font-size: 12px; color: #86909c; }
.rc-console {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 12px; color: #e6a23c; margin-left: 10px;
}
.rc-meta { display: flex; align-items: center; }
.rc-tags { margin-top: 10px; display: flex; gap: 6px; flex-wrap: wrap; }
.pagination-wrap { display: flex; justify-content: center; }

.mb-18 { margin-bottom: 18px; }
.mt-28 { margin-top: 28px; }
.ml-2 { margin-left: 8px; }
</style>
