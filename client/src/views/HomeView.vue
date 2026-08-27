<template>
  <div class="home-view" v-loading="loading">
    <div class="page-padding">
      <!-- 欢迎横幅 -->
      <div class="banner">
        <div class="b-left">
          <div class="b-tag">🎉 欢迎回来</div>
          <h1 class="b-title">{{ userStore.user?.username }}，发现精选资源</h1>
          <p class="b-desc">海量软件、大模型、游戏资源，高速多镜像下载</p>
          <div class="b-stats">
            <div class="bsi">
              <div class="bs-n">{{ statData.totalResources }}</div>
              <div class="bs-l">资源总数</div>
            </div>
            <el-divider direction="vertical" />
            <div class="bsi">
              <div class="bs-n">{{ vipName }}</div>
              <div class="bs-l">当前身份</div>
            </div>
            <el-divider direction="vertical" />
            <div class="bsi">
              <div class="bs-n">{{ userStore.user?.points || 0 }}</div>
              <div class="bs-l">可用积分</div>
            </div>
          </div>
        </div>
        <div class="b-right">
          <div class="br-icon"><el-icon :size="64" color="#fff"><Platform /></el-icon></div>
        </div>
      </div>

      <!-- 分类入口 -->
      <div class="cat-row">
        <div class="cat-item zh-card" v-for="cat in categories" :key="cat.path" @click="router.push(cat.path)">
          <div class="ci-icon" :style="{ background: cat.bg }">
            <el-icon :size="26" :color="cat.color"><component :is="cat.icon" /></el-icon>
          </div>
          <div class="ci-text">
            <div class="ci-name">{{ cat.name }}</div>
            <div class="ci-count">{{ cat.count }} 个可用</div>
          </div>
          <el-icon class="ci-arrow"><ArrowRight /></el-icon>
        </div>
      </div>

      <!-- 搜索 -->
      <div class="search-bar">
        <el-input v-model="keyword" placeholder="搜索软件、大模型、游戏..." size="large" clearable @keyup.enter="search" :prefix-icon="Search">
          <template #append>
            <el-button class="zh-btn-primary" @click="search"><el-icon><Search /></el-icon> 搜索</el-button>
          </template>
        </el-input>
      </div>

      <!-- 热门推荐 -->
      <div class="section-header space-between">
        <h3><el-icon color="#667eea"><Star /></el-icon> 热门推荐</h3>
        <el-button type="primary" link @click="router.push('/software')">查看全部 →</el-button>
      </div>
      <div class="grid-list">
        <div
          v-for="item in hotList" :key="item.id"
          class="res-card zh-card"
          @click="openDetail(item.id)"
        >
          <div class="rc-cover">
            <el-image v-if="item.cover_image" :src="resolveUrl(item.cover_image)" fit="cover" style="width:100%;height:100%" />
            <div class="rc-icon" v-else>
              <el-icon :size="40" color="#fff"><component :is="typeIcon(item.type)" /></el-icon>
            </div>
            <div :class="['rc-tag', `tag-${item.type}`]">{{ typeName(item.type) }}</div>
          </div>
          <div class="rc-body">
            <div class="rc-title truncate">{{ item.name }}</div>
            <div class="rc-desc ellipsis-2">{{ item.description }}</div>
            <div class="rc-foot space-between">
              <div class="rc-price" v-if="item.points_required > 0">
                <el-tag type="warning" size="small" effect="light">{{ item.points_required }} 积分</el-tag>
              </div>
              <div class="rc-price" v-else>
                <el-tag type="success" size="small" effect="light">免费/VIP</el-tag>
              </div>
              <div class="rc-size" v-if="item.file_size">{{ item.file_size }}</div>
            </div>
          </div>
        </div>
        <el-empty v-if="!hotList.length && !loading" description="暂无资源" />
      </div>

      <!-- 最新更新 -->
      <div class="section-header space-between" style="margin-top:32px">
        <h3><el-icon color="#67c23a"><Clock /></el-icon> 最新上架</h3>
      </div>
      <div class="grid-list">
        <div
          v-for="item in newList" :key="item.id"
          class="res-card zh-card"
          @click="openDetail(item.id)"
        >
          <div class="rc-cover">
            <el-image v-if="item.cover_image" :src="resolveUrl(item.cover_image)" fit="cover" style="width:100%;height:100%" />
            <div class="rc-icon" v-else>
              <el-icon :size="40" color="#fff"><component :is="typeIcon(item.type)" /></el-icon>
            </div>
            <div :class="['rc-tag', `tag-${item.type}`]">{{ typeName(item.type) }}</div>
          </div>
          <div class="rc-body">
            <div class="rc-title truncate">{{ item.name }}</div>
            <div class="rc-desc ellipsis-2">{{ item.description }}</div>
            <div class="rc-foot space-between">
              <div class="rc-price" v-if="item.points_required > 0">
                <el-tag type="warning" size="small" effect="light">{{ item.points_required }} 积分</el-tag>
              </div>
              <div class="rc-price" v-else>
                <el-tag type="success" size="small" effect="light">免费/VIP</el-tag>
              </div>
              <div class="rc-size" v-if="item.file_size">{{ item.file_size }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { Search, ArrowRight, Platform, Star, Clock, Monitor, Cpu, Game, Connection } from '@element-plus/icons-vue';
import { useUserStore } from '../store/user';
import { getResources, getBaseURL } from '../api';

const router = useRouter();
const userStore = useUserStore();
const loading = ref(false);
const keyword = ref('');
const hotList = ref([]);
const newList = ref([]);
const statData = ref({ totalResources: 0 });

const vipName = computed(() => ({
  none: '普通用户', week: '周卡VIP', month: '月卡VIP',
  year: '年卡VIP', permanent: '永久VIP'
}[userStore.user?.vipType] || '普通用户'));

const categories = ref([
  { name: '软件下载', path: '/software', icon: 'Monitor', bg: 'linear-gradient(135deg,#ecf5ff,#d9ecff)', color: '#409eff', count: 0 },
  { name: '大模型下载', path: '/models', icon: 'Cpu', bg: 'linear-gradient(135deg,#f0f9eb,#e1f3d8)', color: '#67c23a', count: 0 },
  { name: '游戏下载', path: '/games', icon: 'Game', bg: 'linear-gradient(135deg,#fdf6ec,#faecd8)', color: '#e6a23c', count: 0 },
  { name: 'API中转站', path: '/api-proxy', icon: 'Connection', bg: 'linear-gradient(135deg,#fef0f0,#fde2e2)', color: '#f56c6c', count: 0 }
]);

function typeName(t) { return { software: '软件', model: '大模型', game: '游戏', api: 'API' }[t] || t; }
function typeIcon(t) { return { software: 'Monitor', model: 'Cpu', game: 'Game', api: 'Connection' }[t] || 'Folder'; }
function resolveUrl(u) {
  if (!u) return '';
  if (u.startsWith('http')) return u;
  const base = getBaseURL();
  return (u.startsWith('/') ? base + u : base + '/' + u);
}

async function loadAll() {
  loading.value = true;
  try {
    const hot = await getResources({ pageSize: 8, sort: 'hot' });
    hotList.value = hot.list;
    const latest = await getResources({ pageSize: 8, sort: 'new' });
    newList.value = latest.list;
    // 统计各类数量
    const types = ['software', 'model', 'game', 'api'];
    const totals = await Promise.all(types.map(t => getResources({ type: t, pageSize: 1 }).then(r => r.total)));
    categories.value.forEach((c, i) => c.count = totals[i]);
    statData.value.totalResources = totals.reduce((a, b) => a + b, 0);
  } finally {
    loading.value = false;
  }
}

function openDetail(id) { router.push(`/resource/${id}`); }
function search() {
  router.push({ path: '/software', query: { kw: keyword.value } });
}

onMounted(loadAll);
</script>

<style scoped>
.home-view { height: 100%; overflow: auto; }
.page-padding { padding: 24px 28px 40px; }

.banner {
  background: linear-gradient(135deg,#667eea 0%, #764ba2 100%);
  border-radius: 16px;
  padding: 28px 32px;
  color: #fff;
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  overflow: hidden;
  position: relative;
  box-shadow: 0 10px 30px rgba(102,126,234,0.25);
}
.b-tag {
  display: inline-block;
  background: rgba(255,255,255,0.2);
  padding: 4px 12px;
  border-radius: 999px;
  font-size: 12px;
  margin-bottom: 10px;
  backdrop-filter: blur(6px);
}
.b-title { font-size: 26px; font-weight: 700; margin: 0 0 8px; }
.b-desc { opacity: 0.9; font-size: 14px; margin: 0 0 20px; }
.b-stats { display: flex; align-items: center; gap: 16px; }
.bsi { text-align: left; }
.bs-n { font-size: 22px; font-weight: 700; }
.bs-l { font-size: 12px; opacity: 0.85; margin-top: 2px; }
.br-icon {
  width: 120px; height: 120px;
  background: rgba(255,255,255,0.15);
  border-radius: 28px;
  display: flex; align-items: center; justify-content: center;
  backdrop-filter: blur(10px);
}

.cat-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 28px;
}
.cat-item {
  padding: 18px;
  display: flex;
  align-items: center;
  gap: 14px;
  cursor: pointer;
}
.ci-icon {
  width: 52px; height: 52px;
  border-radius: 14px;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.ci-text { flex: 1; min-width: 0; }
.ci-name { font-size: 15px; font-weight: 600; color: #1d2129; }
.ci-count { font-size: 12px; color: #86909c; margin-top: 4px; }
.ci-arrow { color: #c0c4cc; }

.search-bar {
  margin-bottom: 24px;
}

.section-header { margin-bottom: 16px; }
.section-header h3 {
  font-size: 17px; font-weight: 600; color: #1d2129;
  display: flex; align-items: center; gap: 8px;
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
  height: 140px;
  background: linear-gradient(135deg,#c6e2ff,#b4a0ff);
  position: relative;
  display: flex; align-items: center; justify-content: center;
}
.rc-icon {
  width: 80px; height: 80px;
  background: rgba(255,255,255,0.2);
  border-radius: 20px;
  display: flex; align-items: center; justify-content: center;
}
.rc-tag {
  position: absolute;
  top: 10px; left: 10px;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 12px;
  background: rgba(255,255,255,0.9);
  backdrop-filter: blur(6px);
}
.rc-tag.tag-software { color: #409eff; }
.rc-tag.tag-model { color: #67c23a; }
.rc-tag.tag-game { color: #e6a23c; }
.rc-tag.tag-api { color: #f56c6c; }
.rc-body { padding: 14px 16px 16px; }
.rc-title {
  font-size: 15px; font-weight: 600; color: #1d2129;
  margin-bottom: 6px;
}
.rc-desc {
  font-size: 12px; color: #86909c;
  height: 34px;
  line-height: 1.4;
  margin-bottom: 10px;
}
.rc-size {
  font-size: 12px; color: #86909c;
}
</style>
