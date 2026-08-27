<template>
  <div class="detail-view" v-loading="loading">
    <div class="page-padding" v-if="resource">
      <div class="back-row">
        <el-button link @click="router.back()" :icon="ArrowLeft">返回</el-button>
      </div>

      <div class="detail-card zh-card">
        <div class="dc-left">
          <div class="dc-cover">
            <el-image v-if="resource.cover_image" :src="resolveUrl(resource.cover_image)" fit="cover" style="width:100%;height:100%;border-radius:12px" />
            <div class="rc-icon" v-else>
              <el-icon :size="64" color="#fff"><component :is="typeIcon(resource.type)" /></el-icon>
            </div>
          </div>
          <div class="dc-screens" v-if="resource.screenshots?.length">
            <el-image
              v-for="(s, i) in resource.screenshots"
              :key="i"
              :src="resolveUrl(s)"
              :preview-src-list="resource.screenshots.map(resolveUrl)"
              fit="cover"
              class="dc-shot"
              preview-teleported
            />
          </div>
        </div>
        <div class="dc-right">
          <div class="dc-head">
            <div class="dc-name-row space-between">
              <h1 class="dc-name">{{ resource.name }}</h1>
              <el-tag size="large" :class="`tag-${resource.type}`" effect="light" round>{{ typeName(resource.type) }}</el-tag>
            </div>
            <div class="dc-meta-row">
              <span v-if="resource.version">版本 <b>{{ resource.version }}</b></span>
              <span v-if="resource.file_size" class="ml-14">大小 <b>{{ resource.file_size }}</b></span>
              <span v-if="resource.author" class="ml-14">作者 <b>{{ resource.author }}</b></span>
              <span class="ml-14">下载 <b>{{ downloadCount || 0 }}</b> 次</span>
            </div>
            <div class="dc-tags" v-if="resource.tags?.length">
              <el-tag v-for="t in resource.tags" :key="t" effect="plain">{{ t }}</el-tag>
            </div>
          </div>

          <div class="zh-divider"></div>

          <div class="dc-price-box space-between">
            <div>
              <div class="dpb-label">下载所需</div>
              <div class="dpb-value">
                <template v-if="isVip || resource.points_required === 0">
                  <span style="color:#67c23a;font-weight:700;font-size:22px">免费</span>
                  <span class="ml-6" style="color:#909399;font-size:12px">{{ isVip ? 'VIP免积分下载' : '无需积分' }}</span>
                </template>
                <template v-else>
                  <span style="color:#e6a23c;font-weight:700;font-size:22px">{{ resource.points_required }}</span>
                  <span class="ml-6" style="color:#909399;font-size:12px">积分（可用积分：{{ userStore.user?.points || 0 }}）</span>
                </template>
              </div>
            </div>
            <div class="dpb-actions">
              <el-button size="large" type="default" :icon="Folder" @click="openFolder">打开下载目录</el-button>
              <el-button size="large" class="zh-btn-primary" :icon="Download" :loading="downloading" @click="doDownload">
                {{ downloading ? '下载中...' : '立即下载' }}
              </el-button>
            </div>
          </div>

          <div class="zh-divider"></div>

          <div class="dc-section">
            <h4 class="ds-title">资源介绍</h4>
            <div class="ds-desc">{{ resource.description || '暂无介绍' }}</div>
          </div>

          <div class="dc-section" v-if="downloadInfo?.console_download || resource.console_download">
            <el-alert type="warning" show-icon :closable="false"
              title="该资源需要控制台命令下载（如 huggingface-cli / modelscope），下载器将自动运行命令并监控进度。" />
          </div>

          <!-- 多网盘下载渠道（用户扣完积分/VIP免后直接展示，无需任何下载器） -->
          <div class="dc-section" v-if="displayChannels.length">
            <h4 class="ds-title">
              网盘下载渠道
              <el-tag size="small" type="info" effect="plain" style="margin-left:8px">共 {{ displayChannels.length }} 种方式</el-tag>
            </h4>
            <div class="channels-grid">
              <div v-for="(ch, i) in displayChannels" :key="i" class="channel-card" :style="{borderTopColor: chColor(ch.channel)}">
                <div class="ch-head space-between">
                  <el-tag size="large" :color="chColor(ch.channel)" effect="dark" round style="color:#fff;border:0">
                    {{ chLabel(ch.channel) }}
                  </el-tag>
                  <span v-if="ch.remark" class="ch-remark">{{ ch.remark }}</span>
                </div>
                <div class="ch-url">
                  <span class="ch-label">分享链接：</span>
                  <span class="ch-val">{{ ch.url }}</span>
                </div>
                <div class="ch-code" v-if="ch.code">
                  <span class="ch-label">提取码：</span>
                  <el-tag type="warning" effect="plain" style="font-family:monospace;font-weight:700;letter-spacing:2px">{{ ch.code }}</el-tag>
                </div>
                <div class="ch-actions space-between">
                  <el-button type="primary" :icon="Link" @click="openUrl(ch.url)">打开网盘</el-button>
                  <div style="display:flex;gap:6px">
                    <el-button size="default" :icon="CopyDocument" @click="copyTxt(ch.url, '链接')">复制链接</el-button>
                    <el-button v-if="ch.code" size="default" type="success" :icon="Lock" @click="copyTxt(ch.code, '提取码')">复制提取码</el-button>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { ArrowLeft, Download, Folder, Monitor, Cpu, Game, Connection, Link, CopyDocument, Lock } from '@element-plus/icons-vue';
import { useUserStore } from '../store/user';
import { useDownloadStore } from '../store/download';
import { getResourceDetail, requestDownload, getMirrors, getBaseURL } from '../api';

const route = useRoute();
const router = useRouter();
const userStore = useUserStore();
const downloadStore = useDownloadStore();

const loading = ref(false);
const downloading = ref(false);
const resource = ref(null);
const downloadCount = ref(0);
const downloadInfo = ref(null);
const mirrors = ref([]);

const isVip = computed(() => userStore.user?.vipType && userStore.user.vipType !== 'none');

// 网盘渠道品牌配置（与管理后台一致）
const CHANNEL_OPTS = [
  { label: '百度网盘', value: 'baidu', color: '#2d7dff' },
  { label: '夸克网盘', value: 'quark', color: '#3b82f6' },
  { label: '迅雷网盘', value: 'xunlei', color: '#1faeff' },
  { label: '阿里云盘', value: 'aliyun', color: '#ff5000' },
  { label: '123云盘',   value: '123pan',  color: '#6a5cff' },
  { label: '蓝奏云',   value: 'lanzou',  color: '#00b16a' },
  { label: '腾讯微云', value: 'weiyun',  color: '#1da6fa' },
  { label: '其他网盘', value: 'other',   color: '#909399' }
];
function chColor(v) { return (CHANNEL_OPTS.find(c => c.value === v) || {}).color || '#909399'; }
function chLabel(v) { return (CHANNEL_OPTS.find(c => c.value === v) || {}).label || '其他网盘'; }
// 扣完积分后展示：优先取 downloadInfo（扣完积分拿到的），没有就是详情里带的（都可以，扣完积分是同一后端数据，重复不影响）
const displayChannels = computed(() => {
  const l = downloadInfo.value?.download_channels || resource.value?.download_channels || [];
  return Array.isArray(l) ? l.filter(c => c && c.url) : [];
});
async function copyTxt(v, label) {
  try { await navigator.clipboard.writeText(v); ElMessage.success(label + '已复制'); }
  catch { ElMessage.warning(label + '复制失败，请手动选择复制'); }
}
function openUrl(u) {
  if (!u) return;
  window.zerohub?.openExternal?.(u) || window.open(u, '_blank', 'noopener');
}

function typeName(t) { return { software: '软件', model: '大模型', game: '游戏', api: 'API中转站' }[t] || t; }
function typeIcon(t) { return { software: 'Monitor', model: 'Cpu', game: 'Game', api: 'Connection' }[t] || 'Folder'; }
function resolveUrl(u) {
  if (!u) return '';
  if (u.startsWith('http')) return u;
  const base = getBaseURL();
  return u.startsWith('/') ? base + u : base + '/' + u;
}

async function openFolder(p) {
  await window.zerohub?.openDownloadFolder?.(p);
}

function buildConsoleCommands(url, mirrors, type) {
  // 针对 HuggingFace 自动生成命令 + 多镜像
  const cmds = [];
  const urlOrModel = url;
  const isHF = /huggingface\.co|hf-mirror\.com/.test(url);
  if (isHF) {
    const modelId = url.split('/').slice(-2).join('/').replace(/\.git$/, '');
    cmds.push(`huggingface-cli download ${modelId} --local-dir "./${modelId.replace(/\//g, '_')}"`);
    // 国内镜像版本
    cmds.push(`set HF_ENDPOINT=https://hf-mirror.com && huggingface-cli download ${modelId} --local-dir "./${modelId.replace(/\//g, '_')}"`);
    // aria2c
    cmds.push(`aria2c -x 16 -s 16 "${url}"`);
  }
  if (/modelscope\.cn/.test(url)) {
    const id = url.split('/').slice(-2).join('/');
    cmds.push(`python -m modelscope download --model ${id}`);
  }
  // 默认命令
  if (!cmds.length) {
    cmds.push(`python -c "import urllib.request;urllib.request.urlretrieve('${url}', 'download.bin')"`);
  }
  (mirrors || []).forEach(m => cmds.push(`aria2c -x 16 "${m}"`));
  return cmds;
}

async function doDownload() {
  // 请求下载（校验权限+扣费）
  downloading.value = true;
  try {
    const res = await requestDownload(resource.value.id);
    downloadInfo.value = res.download;
    const dl = res.download;

    const taskId = `task_${resource.value.id}_${Date.now()}`;
    const resourceName = resource.value.name;

    // 获取镜像源（基础url转换）
    let baseMirrors = dl.mirror_urls || [];
    try {
      if (!mirrors.value.length) {
        const m = await getMirrors();
        mirrors.value = m.list || [];
      }
    } catch (e) {}

    if (dl.console_download) {
      // 控制台下载
      const cmds = buildConsoleCommands(dl.download_url, baseMirrors, resource.value.type);
      const filenameGuess = `${resource.value.name.replace(/[^\u4e00-\u9fa5a-zA-Z0-9_.-]/g, '_')}_v${resource.value.version || '1'}`;

      downloadStore.addTask({
        id: taskId, resourceName, status: 'running', progress: 0, speed: 0, downloaded: 0, totalSize: 0,
        filename: filenameGuess
      });

      const result = await window.zerohub?.consoleDownload?.({
        id: taskId,
        command: cmds[0],
        mirrors: cmds.slice(1),
        resourceName
      });
      if (result?.status === 'completed') {
        ElMessage.success(`${resourceName} 下载完成`);
        await window.zerohub?.notify?.({ title: '下载完成', body: resourceName });
      } else {
        ElMessage.error(`下载失败：${result?.error || '未知错误'}`);
      }
    } else {
      // 普通HTTP下载，自动切换镜像
      const mainUrl = dl.download_url;
      const mirrorList = [...baseMirrors];
      // 把镜像源配置自动拼接到资源文件名
      const ext = (mainUrl.split('?')[0].split('.').pop() || 'bin').slice(0, 8);
      const safeName = resource.value.name.replace(/[^\u4e00-\u9fa5a-zA-Z0-9_.-]/g, '_');
      const filename = `${safeName}_v${resource.value.version || '1'}.${ext}`;

      downloadStore.addTask({
        id: taskId, resourceName, status: 'downloading', progress: 0, speed: 0, downloaded: 0, totalSize: 0, filename
      });

      const result = await window.zerohub?.startDownload?.({
        id: taskId, url: mainUrl, mirrors: mirrorList, filename, resourceName
      });
      if (result?.status === 'completed') {
        ElMessage.success({
          message: `${resourceName} 下载完成`,
          duration: 3000,
          onClose: () => window.zerohub?.openDownloadFolder?.(result.savePath)
        });
        await window.zerohub?.notify?.({ title: '下载完成', body: resourceName });
      } else {
        ElMessage.error(`下载失败：${result?.error || '未知错误'}`);
      }
    }

    // 刷新用户积分
    await userStore.refresh();
  } finally {
    downloading.value = false;
  }
}

async function loadDetail() {
  loading.value = true;
  try {
    const id = route.params.id;
    const res = await getResourceDetail(id);
    resource.value = res.resource;
    downloadCount.value = res.resource.download_count || 0;
  } finally {
    loading.value = false;
  }
}

onMounted(loadDetail);
</script>

<style scoped>
.detail-view { height: 100%; overflow: auto; }
.page-padding { padding: 24px 28px 40px; }
.back-row { margin-bottom: 16px; }
.detail-card {
  padding: 24px;
  display: flex;
  gap: 28px;
}
.dc-left { width: 380px; flex-shrink: 0; }
.dc-cover {
  width: 100%; height: 220px;
  background: linear-gradient(135deg,#c6e2ff,#b4a0ff);
  border-radius: 12px;
  display: flex; align-items: center; justify-content: center;
}
.rc-icon {
  width: 120px; height: 120px;
  background: rgba(255,255,255,0.2);
  border-radius: 28px;
  display: flex; align-items: center; justify-content: center;
}
.dc-screens {
  display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap;
}
.dc-shot {
  width: 112px; height: 72px;
  border-radius: 6px;
  border: 1px solid #ebeef5;
  cursor: pointer;
}
.dc-right { flex: 1; min-width: 0; }
.dc-name { font-size: 24px; font-weight: 700; color: #1d2129; margin: 0; }
.dc-meta-row {
  margin-top: 10px;
  color: #86909c; font-size: 13px;
  display: flex; flex-wrap: wrap;
}
.dc-meta-row b { color: #303133; font-weight: 600; }
.dc-tags { margin-top: 12px; display: flex; gap: 8px; flex-wrap: wrap; }

.dc-price-box {
  padding: 18px 20px;
  background: #f8f9fb;
  border-radius: 10px;
}
.dpb-label { color: #86909c; font-size: 12px; }
.dpb-value { margin-top: 4px; }
.dpb-actions { display: flex; gap: 10px; }

.dc-section { margin-top: 8px; }
.ds-title { font-size: 15px; font-weight: 600; color: #1d2129; margin: 0 0 10px; }
.ds-desc { color: #4e5969; font-size: 14px; line-height: 1.7; white-space: pre-wrap; }

.tag-software { background: #ecf5ff; color: #409eff; }
.tag-model { background: #f0f9eb; color: #67c23a; }
.tag-game { background: #fdf6ec; color: #e6a23c; }
.tag-api { background: #fef0f0; color: #f56c6c; }

.ml-6 { margin-left: 6px; }
.ml-14 { margin-left: 14px; }
.space-between { display: flex; align-items: center; justify-content: space-between; }

.channels-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 14px;
  margin-top: 8px;
}
.channel-card {
  border: 1px solid #ebeef5;
  border-radius: 12px;
  border-top: 4px solid #409eff;
  padding: 14px 16px;
  background: #fcfcfe;
  display: flex;
  flex-direction: column;
  gap: 10px;
  box-shadow: 0 2px 6px rgba(30,42,100,0.04);
}
.ch-head { margin-bottom: 2px; }
.ch-remark { color: #86909c; font-size: 12px; }
.ch-url, .ch-code {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}
.ch-label { color: #86909c; flex-shrink: 0; width: 68px; }
.ch-val { color: #1d2129; flex: 1; word-break: break-all; font-family: monospace; background: #f4f5f9; padding: 4px 8px; border-radius: 6px; }
.ch-actions { margin-top: 6px; }
</style>
