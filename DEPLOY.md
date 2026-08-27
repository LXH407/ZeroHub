# ZeroHub 软件商城 - 快速启动与部署指南

## 📁 项目结构
```
d:\ZeroHub\
├── package.json                 # 根目录：统一安装/构建脚本
├── server/                      # 后端服务（Node.js + Express + SQLite）
│   ├── package.json
│   ├── server.js                # 入口：API + 管理后台静态页 + 上传
│   ├── db/database.js           # SQLite 数据库初始化（9张表）
│   ├── middleware/auth.js       # JWT 认证中间件
│   ├── routes/
│   │   ├── auth.js              # 用户注册/登录/自动登录 + 24h队列处理
│   │   ├── cards.js             # 卡密生成/验证/封禁/解封
│   │   ├── resources.js         # 资源CRUD + 下载权限/扣费
│   │   └── admin.js             # 管理员：用户、统计、设置、镜像源、待注册处理
│   └── uploads/                 # 上传的图片（运行时生成）
│
├── admin-web/                   # 管理后台（Vue3 + Element Plus + Vite）
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   └── src/
│       ├── main.js / App.vue / router / store / api / styles
│       ├── layouts/MainLayout.vue
│       └── views/
│           ├── Login.vue        # 登录
│           ├── Dashboard.vue    # 仪表盘（统计图表）
│           ├── Users.vue        # 用户管理
│           ├── Cards.vue        # 卡密管理（批量生成/复制/TXT下载）
│           ├── Resources.vue    # 资源管理（上传图片/多镜像/标签）
│           ├── Mirrors.vue      # 镜像源配置（HF / ModelScope / 自定义）
│           ├── Pending.vue      # 待注册队列处理
│           └── Settings.vue     # 系统设置（站点名/图标/更新/API中转）
│
└── client/                      # 客户端（Electron + Vue3 + 白色简约风）
    ├── package.json
    ├── vite.config.js
    ├── index.html
    ├── electron/
    │   ├── main.js              # Electron主进程：窗口控制 + 下载管理器
    │   ├── preload.js           # contextBridge 暴露安全 API
    │   └── splash.html          # 启动加载屏（确认页面加载到位）
    └── src/
        ├── main.js / App.vue / router / store / api / styles
        ├── layouts/MainLayout.vue
        └── views/
            ├── LoginView.vue           # 登录页
            ├── RegisterView.vue        # 10位数字卡密注册
            ├── ServerConfigView.vue    # 服务器地址配置 + 连接测试
            ├── HomeView.vue            # 首页横幅/分类/搜索/推荐
            ├── ResourceListView.vue    # 分类列表（软件/大模型/游戏）
            ├── ResourceDetailView.vue  # 详情 + 发起下载（自动镜像切换）
            ├── DownloadsView.vue       # 下载中心（进度/速度/切换次数）
            ├── ApiProxyView.vue        # API中转站
            └── SettingsView.vue        # 设置
```

## 🚀 本地开发（3步启动）

### 0. 一键安装所有依赖（推荐！包含 server + admin-web + client）
```powershell
cd d:\ZeroHub
npm run install:all
```
这会分别对 server、admin-web、client 三个子目录执行 `npm install`，省去手动 cd 三次的麻烦。
> 💡 国内镜像加速：首次安装前先设置 `npm config set registry https://registry.npmmirror.com`

### 1. 启动后端（默认端口 3000）
```powershell
# 方式A（根目录）：
cd d:\ZeroHub
npm run start:server

# 方式B（进入server目录）：
cd d:\ZeroHub\server
npm run dev        # 开发模式（nodemon 热重启）
# 或 npm run start  # 生产模式（纯node）
```
打开浏览器验证：
- 后端健康检查：http://localhost:3000/api/health  → 返回 `{"success":true,"status":"ok"}`
- 生产模式管理后台（需先 `npm run build:admin`）：http://localhost:3000/admin
- 默认管理员账号：`admin / admin123456`   （⚠️ 登录后立即到 设置 → 修改管理员密码！）

### 2. 启动管理后台（开发模式，热更新，可选）
```powershell
# 方式A：根目录
cd d:\ZeroHub && npm run dev:admin
# 方式B：
cd d:\ZeroHub\admin-web && npm run dev
```
访问 http://localhost:5173 （Vite 自动代理 /api 到 3000 端口）

### 3. 启动客户端（Electron 桌面软件，开发模式）
```powershell
# 方式A：根目录
cd d:\ZeroHub && npm run dev:client
# 方式B：
cd d:\ZeroHub\client && npm run dev
```
启动后流程：
1. **加载屏**：520×520 白色窗口 + 莫比乌斯环 MP4 循环播放（你的视频素材） + 品牌文字 + 进度滑条
2. **800ms 后**：主窗口自动显示，加载屏关闭，进入登录/注册/服务器地址配置页
3. 首次使用点击"服务器地址配置" → 填 `http://localhost:3000` → 测试连接 → 保存并返回登录

---

## 📦 打包发布

### 后端 → exe 或云端部署
#### 方案A：打包为 Windows exe（本机/内网服务器用）
```powershell
cd d:\ZeroHub\server
npm install
npm run build
# 生成：dist/zero-hub-server.exe
```
双击运行即可，数据库自动创建在程序旁的 `data/` 目录，端口默认 3000。

#### 方案B：部署到 Render 免费云平台（推荐！关机也能用）

**为什么选 Render？** 类似 GitHub 的托管平台，提供免费 Web Service（Node.js）+ 免费 Postgres 数据库，支持 Git 推送自动部署。部署后后端 24 小时在云端运行，主机关机时客户端也能正常连接注册/下载，完美满足"本机关机软件仍可运行"的需求。

##### 🌐 Render 部署完整 8 步法
```
前置条件：已有 GitHub 账号，且把整个 ZeroHub 项目（含 server/、admin-web/、render.yaml）
         推送到你自己的 GitHub 仓库（public 或 private 均可）
```

| 步骤 | 操作 | 说明 |
|:----:|------|------|
| 1 | 打开 https://render.com 并注册/登录 | 支持 GitHub 直接登录 |
| 2 | 点击右上角 **New +** → 选 **Web Service** | 新建一个云端 Web 服务 |
| 3 | 在 "Connect a repository" 页面 | 两种方式：<br/>① **Public Git repository**：粘贴你的 GitHub 仓库 HTTPS 地址（推荐新手）<br/>② **Connect GitHub**：授权并选中你的 ZeroHub 仓库 |
| 4 | 填写服务基础信息 | - **Name**: `zerohub-server`（会体现在分配的域名中）<br/>- **Runtime**: `Node`<br/>- **Branch**: `main`（或你的主分支名）<br/>- **Plan**: `Free`（免费，每月750小时，闲置5分钟自动休眠→访问自动唤醒） |
| 5 | 高级配置（Advanced）里填 Build/Start 命令 | 推荐直接用仓库里的 `render.yaml`，会自动读取。<br/>如果不使用 yaml 就手动填：<br/>- **Root Directory**: 留空（`.`，项目根目录）<br/>- **Build Command**:<br/>`cd server && npm install --omit=dev && cd ../admin-web && npm install --omit=dev && npm run build`<br/>- **Start Command**: `cd server && node server.js` |
| 6 | **Environment Variables**（核心安全！） | 点击 **Add Environment Variable** 添加：<br/>① `PORT` = `10000`（Render 规定必须监听此端口）<br/>② `NODE_ENV` = `production`<br/>③ `JWT_SECRET` → **点击右侧 Generate 按钮** 生成随机强密钥（⚠️绝对不要用默认的）<br/>④（可选持久化磁盘）挂载磁盘后再加 `DB_PATH` = `/var/data/zerohub.db` |
| 7 | 点击 **Create Web Service** 开始部署 | 等待 3~8 分钟，日志滚动显示：<br/>`>>> 1/3 安装后端依赖 → 2/3 安装管理后台依赖 → 3/3 构建管理后台 dist → ✅构建完成`<br/>最后看到绿色 **Live** 即部署成功 |
| 8 | 部署成功验证 & 客户端连接 | - 打开分配的域名（形如 `https://zerohub-server-abc123.onrender.com`）<br/>- 访问 `https://你的域名/api/health` → 返回 `{"success":true,"status":"ok"}`<br/>- 访问 `https://你的域名/admin` → 管理后台登录页 → 默认 `admin / admin123456` **登录后立即改密码！**<br/>- 打开 ZeroHub 客户端 → 服务器地址配置 → 填入 `https://你的域名`（无尾斜杠） → 保存并返回登录 |

##### ⚠️ Render 免费方案的重要注意事项
1. **磁盘临时**：免费 Web Service 不提供持久化磁盘，**每次重启/重新部署后 SQLite 数据库（用户/卡密/资源）会清空**。解决：
   - 挂载 Render 付费磁盘（$1/月起，10GB 足够）→ 在服务后台 Disks 选项卡添加，设置挂载路径如 `/var/data`，再加环境变量 `DB_PATH=/var/data/zerohub.db`
   - 或改用 Render 免费 Postgres 实例（需要后端切换数据库驱动，可联系作者扩展）
2. **闲置休眠**：免费实例闲置 5 分钟会进入休眠；用户首次访问（客户端请求/浏览器访问）会自动唤醒，通常 5~30 秒；首次请求超时请重试。
3. **域名可选**：Render 分配的 `onrender.com` 子域名免费永久可用；如需绑自定义域名，在服务 Settings → Custom Domains 添加并解析 CNAME。

---

**Render 方案优势**：云端 24 小时运行，客户端任何时候都能连接，满足"主机关机软件仍可运行"的需求；首次注册提交后即使你本地关机，云端也能 24 小时内审核处理。

### 管理后台 → 自动构建进后端
```powershell
cd d:\ZeroHub\admin-web
npm install
npm run build
# 产物：admin-web/dist/
# 后端 server.js 自动把 dist 挂载到 /admin 路径
```

### 客户端 → Windows exe（安装包 + 便携版）
```powershell
cd d:\ZeroHub\client
npm install
npm run build:win
# 产物：client/release/ZeroHub Setup 1.0.0.exe（安装版）
#       client/release/ZeroHub 1.0.0.exe（便携版）
```

#### ⚠️ 客户端图标准备
将 256×256 ICO 图标放入：
```
d:\ZeroHub\client\build\icon.ico
```
如未准备，electron-builder 会使用默认图标。

---

## 🔐 卡密系统说明

| 卡密类型 | 格式 | 权益 |
|---------|------|------|
| 积分卡 | `point` | 1积分=1次软件/大模型/游戏下载；可自定义积分数量 |
| VIP周卡 | `week` | 7天内无限下载所有资源 |
| VIP月卡 | `month` | 30天内无限下载 |
| VIP年卡 | `year` | 365天内无限下载 |
| 永久VIP | `permanent` | 永久无限下载 |

10位纯数字卡密（例：`3721948605`）。注册时输入卡密绑定账户；后端定时5分钟处理注册队列，关机期间客户端提交的注册请求也会保存到后端，后端恢复后自动处理。24小时内未确认的账户自动注销。VIP过期自动降级。

## ⚡ 下载加速与镜像切换
客户端下载管理器（Electron主进程）实现：
- **速度计算**：保存最近10秒下载字节数，计算实时速度
- **自动切换**：速度 `< 50KB/s` 持续超过15秒 → 自动切换下一个镜像源
- **断点续传**：HTTP下载带 `Range` 头，支持切换镜像后继续下载
- **控制台下载**：HuggingFace/ModelScope 大模型自动生成 `huggingface-cli` / `modelscope` / `aria2c` 命令
- **国内加速**：默认优先级 1.HF-Mirror → 2.ModelScope → 3.官方 → 4.自定义

## 🧩 所有按钮与功能对应关系
| 模块 | 按钮 | 实际功能 |
|------|------|----------|
| 客户端登录 | 登录 | 调用 `/api/auth/login` 保存token |
| 客户端注册 | 验证卡密 | 调用 `/api/cards/verify/:no` |
| 客户端注册 | 注册 | 调用 `/api/auth/register` 写入待处理队列 |
| 资源卡片 | 点击 | 跳转详情页 |
| 资源详情 | 立即下载 | 调用 `/api/resources/:id/download` 扣费后启动下载器 |
| 资源详情 | 打开下载目录 | `shell.showItemInFolder` |
| 下载中心 | 清除已完成 | 删除已完成/失败任务 |
| 管理后台 | 生成卡密 | 批量生成10位数字卡密，复制/下载txt |
| 管理后台 | 用户封禁 | 更新status=banned，客户端下次登录返回403 |
| 管理后台 | 资源更新 | 更新download_url/图片/积分等，客户端立即生效 |

## 📡 环境变量
| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | 3000 | 后端监听端口（Render 强制为 `10000`） |
| `JWT_SECRET` | `zerohub-secret-key-2026` | **生产环境务必修改！** 建议：<br/>- Windows exe：`set JWT_SECRET=<随机32位>` 后启动<br/>- Render：点击 **Generate** 自动生成随机值 |
| `DB_PATH` | `data/zerohub.db` | （可选）自定义 SQLite 数据库文件路径，<br/>Render 挂载持久化磁盘后必填，例：`/var/data/zerohub.db` |
| `NODE_ENV` | - | 生产环境建议设为 `production` |

### ✅ 部署/启动后必做检查清单（1分钟）
```
□ 1. 浏览器访问 https://<你的域名或localhost:3000>/api/health
     返回 {"success":true,"status":"ok"}

□ 2. 浏览器访问 https://<你的域名或localhost:3000>/admin
     显示管理后台登录页，且 <title> 中包含 ZeroHub

□ 3. 使用默认账号 admin / admin123456 登录管理后台 → 进入 【设置】
     页面右上角头像 → 修改管理员密码（填写旧密码+新密码后保存）

□ 4. 回到管理后台【卡密】→ 生成一批积分卡/周卡VIP → 复制1张
     打开 ZeroHub 客户端 → 【注册】→ 粘贴卡密 → 验证卡密成功
     → 填写用户名密码 → 注册成功
     
□ 5. 客户端【服务器地址配置】→ 测试连接 → 提示"连接成功"
     → 保存并返回登录 → 用刚才注册的账号登录 → 进入首页
     
□ 6. 管理后台【资源】→ 新增 2~3 个测试资源（软件/大模型/游戏）
     → 客户端对应分类页可以看到卡片 → 点击能进入详情
     → 点击"立即下载"可以触发下载器工作（进度条开始走）
```

完成以上 6 步说明 ZeroHub 系统已 100% 可用。
