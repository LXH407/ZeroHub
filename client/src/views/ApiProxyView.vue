<template>
  <div class="api-view">
    <div class="page-padding">
      <div class="mb-18">
        <h2 class="page-title">
          <el-icon :size="22" color="#f56c6c"><Connection /></el-icon>
          <span class="ml-2">API 中转站</span>
        </h2>
        <p class="sub-desc mt-6">通过中转服务转发各类大模型 API 请求，国内访问更稳定、速度更快</p>
      </div>

      <el-alert type="success" :closable="false" style="margin-bottom:18px" show-icon>
        <template #title>
          配置说明
        </template>
        <template #default>
          <div style="line-height:1.7">
            在各类客户端（Open WebUI、ComfyUI、LobeChat 等）中将 API Base URL 设置为下方地址，然后填入你自己的 API Key 即可使用。
            <br/>中转服务支持 OpenAI 兼容协议，兼容 ChatGPT、Claude、Gemini、Qwen 等主流模型。
          </div>
        </template>
      </el-alert>

      <div class="grid-2">
        <!-- API 地址卡片 -->
        <div class="zh-card" style="padding:24px">
          <div class="cc-title space-between">
            <h3><el-icon color="#f56c6c"><Link /></el-icon> 中转 API 地址</h3>
          </div>
          <div style="margin-top:16px">
            <div class="label">API Base URL</div>
            <div class="url-row">
              <el-input v-model="apiBase" readonly style="flex:1" />
              <el-button class="zh-btn-primary" @click="copy(apiBase)"><el-icon><CopyDocument /></el-icon> 复制</el-button>
            </div>
            <div style="margin-top:14px">
              <div class="label">支持的协议</div>
              <div style="display:flex;gap:8px;margin-top:6px;flex-wrap:wrap">
                <el-tag type="success" effect="light">OpenAI Compatible</el-tag>
                <el-tag type="warning" effect="light">Anthropic Claude</el-tag>
                <el-tag type="primary" effect="light">Google Gemini</el-tag>
                <el-tag type="info" effect="light">Dify / FastGPT</el-tag>
              </div>
            </div>
          </div>
        </div>

        <!-- 资源类型的API中转站列表 -->
        <div class="zh-card" style="padding:24px">
          <div class="cc-title space-between">
            <h3><el-icon color="#409eff"><Grid /></el-icon> 可用中转资源</h3>
          </div>
          <div v-if="apiList.length" style="margin-top:16px">
            <div
              v-for="item in apiList"
              :key="item.id"
              class="api-row"
              @click="router.push(`/resource/${item.id}`)"
            >
              <el-avatar :size="40" style="background:linear-gradient(135deg,#fef0f0,#fde2e2);color:#f56c6c">
                <el-icon :size="20"><Promotion /></el-icon>
              </el-avatar>
              <div class="api-info ml-12">
                <div class="api-name">{{ item.name }}</div>
                <div class="api-desc ellipsis-2">{{ item.description }}</div>
              </div>
              <el-icon><ArrowRight /></el-icon>
            </div>
          </div>
          <el-empty v-else description="暂无API中转资源，请在后台添加类型为API中转站的资源" />
        </div>
      </div>

      <div class="zh-card" style="padding:24px;margin-top:20px">
        <h3 style="font-size:17px;font-weight:600;color:#1d2129;margin:0 0 16px">
          <el-icon color="#67c23a"><Document /></el-icon> 使用示例
        </h3>
        <el-tabs>
          <el-tab-pane label="Python" name="py">
<pre class="code-block">import openai

client = openai.OpenAI(
    api_key="你的API_KEY",
    base_url="{{ apiBase }}/v1"
)

resp = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[{"role":"user","content":"你好"}]
)
print(resp.choices[0].message.content)</pre>
          </el-tab-pane>
          <el-tab-pane label="cURL" name="curl">
<pre class="code-block">curl {{ apiBase }}/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "model":"gpt-4o-mini",
    "messages":[{"role":"user","content":"你好"}]
  }'</pre>
          </el-tab-pane>
          <el-tab-pane label="JavaScript" name="js">
<pre class="code-block">import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: '你的API_KEY',
  baseURL: '{{ apiBase }}/v1'
});

const resp = await client.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [{ role: 'user', content: '你好' }]
});
console.log(resp.choices[0].message.content);</pre>
          </el-tab-pane>
        </el-tabs>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import {
  Connection, Link, Grid, Promotion, ArrowRight, CopyDocument, Document
} from '@element-plus/icons-vue';
import { getPublicSettings, getResources } from '../api';

const router = useRouter();
const apiBase = ref('https://api.example.com/v1');
const apiList = ref([]);

async function load() {
  try {
    const res = await getPublicSettings();
    if (res.settings?.api_proxy_url) {
      apiBase.value = res.settings.api_proxy_url;
    }
  } catch (e) {}
  try {
    const r = await getResources({ type: 'api', pageSize: 20 });
    apiList.value = r.list;
  } catch (e) {}
}
function copy(v) {
  navigator.clipboard.writeText(v);
  ElMessage.success('已复制');
}
onMounted(load);
</script>

<style scoped>
.api-view { height: 100%; overflow: auto; }
.page-padding { padding: 24px 28px 40px; }
.page-title { font-size: 22px; font-weight: 700; color: #1d2129; display: flex; align-items: center; }
.sub-desc { color: #86909c; font-size: 13px; }
.grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18px;
}
.cc-title h3 {
  font-size: 16px; font-weight: 600; color: #1d2129; margin: 0;
  display: flex; align-items: center; gap: 8px;
}
.label { color: #86909c; font-size: 12px; margin-bottom: 6px; }
.url-row { display: flex; gap: 8px; }
.api-row {
  display: flex; align-items: center; gap: 10px;
  padding: 12px; border-radius: 10px;
  cursor: pointer;
  border: 1px solid #f2f3f5;
  margin-bottom: 10px;
  transition: all 0.2s;
}
.api-row:hover { background: #f8f9fb; border-color: #c6e2ff; }
.api-info { flex: 1; min-width: 0; }
.api-name { font-size: 14px; font-weight: 600; color: #1d2129; }
.api-desc { font-size: 12px; color: #86909c; margin-top: 2px; height: 32px; line-height: 1.4; }

.code-block {
  background: #1e1e1e;
  color: #d4d4d4;
  padding: 18px;
  border-radius: 10px;
  font-family: Consolas, Monaco, 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-all;
}

.mt-6 { margin-top: 6px; }
.ml-2 { margin-left: 8px; }
.ml-12 { margin-left: 12px; }
.mb-18 { margin-bottom: 18px; }
.space-between { display: flex; align-items: center; justify-content: space-between; }
</style>
