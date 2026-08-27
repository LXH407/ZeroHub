# ZeroHub 软件商城 - AI 产品级提示语 Prompt

## 🎯 使用场景
将以下 Prompt 复制给 AI 编程助手（如 GPT-4o/Claude 3.5 Opus/DeepSeek V3/Trae 等），即可从零生成同等功能级别的软件商城。也可作为功能验收对照清单。

---

## 📜 完整 Prompt（直接复制）

```
请为我开发一套完整的"软件商城"系统，整体交付3个可运行产物：
  1) Node.js 后端服务（可以部署到 Render/Railway 免费云平台实现24h在线，也能本地打包为exe）
  2) 管理后台网页（Vue3 + Element Plus，集成进后端的 /admin 路径）
  3) Windows 桌面客户端 exe（Electron + Vue3，白色简约风格，带启动加载屏）

一、【后端（Node.js + Express + SQLite）】
数据库9张表：
1) admins 管理员：id/username/password bcrypt哈希/创建时间。默认 admin/admin123456
2) users 用户：id/username/password/卡密外键/vip类型(week/month/year/permanent/none)/VIP到期时间/剩余积分/状态(pending待确认/active活跃/banned封禁/cancelled注销)/确认时间/创建时间
3) cards 卡密：id/10位纯数字卡密号唯一/类型(point积分/week周/month月/year年/permanent永久)/积分值/状态(unused未用/used已用/banned封禁)/使用者外键/使用时间/创建时间
4) resources 资源：id/名称/类型(software软件/model大模型/game游戏/api中转站)/描述/图标URL/封面图/截图JSON数组/所需积分/主下载链接/镜像链接JSON数组/文件大小/版本/作者/标签JSON数组/排序/状态(active上架/inactive下架)/是否控制台下载1或0/创建/更新时间
5) download_records 下载记录：id/用户外键/资源外键/消耗积分/下载时间
6) settings 系统设置：id/键唯一/值/更新时间。预置站点名称、站点图标、API中转站地址、确认超时小时数(默认24)
7) mirror_sources 镜像源：id/名称/基础URL/类型(huggingface/modelscope/custom)/优先级/是否启用/创建时间。预置HF官方、HF-Mirror国内镜像、ModelScope魔搭、自定义
8) pending_registrations 待注册队列：id/用户名/明文密码/卡密号/设备信息JSON/接收时间/是否处理0或1
   作用：客户端提交注册先入此表（即便后端关机，客户端也会重试提交，后端上线后通过定时任务每5分钟扫一次），24小时未处理自动作废
9) 系统启动时自动建表 + 初始化默认管理员 + 默认设置 + 默认4个镜像源

核心业务逻辑：
- 用户注册：卡密必须10位数字；先写入pending_registrations；立即触发处理；若卡密有效且用户名不重复则创建用户status=pending→active，绑定卡密状态改为used；VIP按卡类型设置到期时间（永久不设到期）；积分卡直接给积分
- 24小时确认机制：后端启动时 + 每5分钟处理 pending_registrations：已达到超时设置(默认24h)未处理则标记processed=1并放弃；否则按卡密有效性创建活跃用户；管理员也可手动确认/取消用户
- VIP过期：用户请求接口时中间件自动检查，过期立即改vip_type=none清到期时间
- 卡密积分下载：VIP用户全免不扣积分；非VIP用户所需积分>0时扣除积分写入下载记录；重复下载同一资源不重复扣费（查download_records是否已存在）
- 慢下载自动切换：客户端 Electron 主进程自己实现下载器（不用内置session），统计10秒窗口速度，<50KB/s持续15秒就切换下一个镜像源，普通下载支持Range断点续传，控制台下载自动生成huggingface-cli/modelscope/aria2c多镜像命令并监控stderr/stdout解析进度

API路由：
  /api/health  健康检查
  /api/auth/register  用户注册（卡密+用户名+密码+设备信息）
  /api/auth/login  用户登录（返回JWT 7天或30天 rememberMe）
  /api/auth/auto-login  token自动登录
  /api/auth/info  用户信息
  /api/cards/verify/:cardNumber  公开：注册页验证卡密
  /api/cards/generate  管理员：批量生成1-1000张
  /api/cards/list  管理员：分页+筛选
  /api/cards/ban|unban/:id  管理员：封解封
  /api/cards/:id  管理员：删除
  /api/resources/list  公开：分页搜索排序分类
  /api/resources/:id  公开：详情
  /api/resources/:id/download  用户：请求下载（鉴权+扣费+返回链接/镜像/是否控制台）
  /api/resources/admin/list|create|update|delete  管理员CRUD
  /api/admin/login|info|change-password|users|users/:id/ban|unban|confirm|cancel|vip  管理员用户管理
  /api/admin/stats  仪表盘统计（总用户/活跃/VIP/卡密/资源/下载/待注册等8项）
  /api/admin/settings  GET/POST 系统设置
  /api/admin/settings/public  公开：站点名图标中转地址（客户端标题栏用）
  /api/admin/mirrors  管理员镜像源CRUD
  /api/admin/mirrors/public  公开：启用的镜像源
  /api/admin/pending-registrations  管理员查待注册
  /api/admin/process-pending  管理员手动触发处理
  /api/upload  管理员上传图片（multer 10MB 限图片），返回/uploads/xxx路径
静态挂载：
  /uploads  → 上传目录
  /admin    → admin-web/dist（管理后台SPA，所有子路径回退到index.html）
CORS全部放开；JSON body 50MB；启动打印管理后台地址+默认账号

二、【管理后台网页（Vue3 + Element Plus + Vite，base:/admin/）】
  登录/仪表盘/用户管理/卡密管理/资源管理/镜像源配置/待注册处理/系统设置 共8页
  要求：
  - 仪表盘：8个统计数字卡片+柱状图饼图echarts展示+待注册预览表+6个快捷操作按钮
  - 用户管理：按状态/VIP/关键词筛选，封禁/解封/确认/注销/弹窗改VIP类型与积分
  - 卡密管理：弹窗批量生成，生成后可一键复制全部、下载TXT；卡密列表支持封禁/解封/删除；每条卡密可一键复制
  - 资源管理：表格+弹窗编辑，可上传封面/图标/截图（调/api/upload），支持多镜像链接数组，标签用el-select可输入创建，控制台下载开关，上下架切换
  - 镜像源：可编辑行（名称/URL/类型/优先级/启用开关），保存后生效
  - 待注册：按已处理/未处理筛选，显示提交时间/卡密/设备信息，立即处理按钮
  - 系统设置：站点名/图标URL/中转地址文本域/确认超时小时数/客户端版本号更新地址变更日志
  - 所有表格带分页/筛选；所有操作有loading+ElMessage成功失败提示；登录7天记住token在localStorage

三、【Electron 客户端 exe（白色简约风格）】
3.1 启动加载屏（splash.html 无边框半透明）：
  居中logo + ZeroHub标题 + "正在加载，请稍候..." + 滑动动画进度条。确认主窗口资源加载完毕（ready-to-show后延迟800ms）再关闭splash并显示主窗口

3.2 主窗口外观：
  - 白色#ffffff背景；整体极简风；无默认frame，自定义顶部36px拖拽条 + 最小化/最大化/关闭按钮（悬停红色）
  - 左侧220px纯白侧边栏：logo+菜单项；高亮渐变淡紫色背景；底部用户卡片（头像+VIP标签+积分/到期信息）+ 更多操作下拉（刷新/退出登录）
  - 右侧主区域白色；所有卡片1px浅灰边框+圆角10px，悬停淡蓝边框阴影

3.3 页面与功能（全部按钮都可点击，无虚按钮）：
  (1) 登录页（左渐变紫介绍栏 + 右表单）：
      - 用户名/密码/记住登录（勾选后rememberMe=30天JWT）
      - 注册/服务器配置跳转链接；底部黄色alert提示离线情况
  (2) 注册页：
      - 10位卡密输入框 + "验证卡密"按钮（调/api/cards/verify，有效显示绿色tag，无效红色）
      - 用户名3-20位，密码≥6位两次确认
      - 提交后，若status=active提示"注册成功请登录"，否则提示"24小时内确认后可登录"
  (3) 服务器配置页：
      - 服务器地址输入框 + 连接测试按钮（延迟显示/在线绿tag/离线红tag）
      - 本地/127.0.0.1快捷按钮
      - 保存时写入Electron userData配置文件（zerohub-config.json），下次启动默认使用
  (4) 首页：
      - 紫蓝渐变横幅：欢迎回来 + 3项统计（资源总数/VIP类型/积分）
      - 4个分类大卡片（软件/大模型/游戏/API中转站）各显示数量，点击跳转分类
      - 搜索框 + 最新/热门筛选
      - 热门推荐8个卡片（封面、名称、描述、积分或免费tag、文件大小），点击进详情
      - 最新上架8个卡片
  (5) 资源列表分类页（软件/大模型/游戏，共用一个路由组件meta传type）：
      - 顶部搜索框+最新/热门排序
      - 4列网格卡片，每个卡片有封面，hover高亮，点击详情
      - 分页组件
  (6) 资源详情页：
      - 左：大封面 + 多截图（el-image可预览放大）
      - 右：名称+大类型tag+版本+大小+作者+下载次数+标签组
      - 下载价格区：VIP用户显示绿色免费/普通用户显示橙色所需积分
      - 操作按钮："打开下载目录"（shell打开downloads/ZeroHub）/ "立即下载"
      - 点击立即下载 → 先调/api/resources/:id/download鉴权扣费，然后：
        * 若资源为控制台下载 → 生成 huggingface-cli / modelscope / aria2c 多个命令，用 spawn 子进程执行，stdout解析进度百分比、速度、已下载/总大小，低速自动切下一条命令；整个过程IPC推送到渲染层显示进度条
        * 若普通下载 → Electron主进程用http/https模块手写下载器：
            · 循环所有镜像源，失败/4xx/超时15s就切下一个
            · Range断点续传，临时文件.part
            · 10秒窗口滑动平均速度；<50KB/s持续>15s自动切换镜像源（不删.part，下一个镜像支持Range就续传，不支持就从头）
            · 每300ms通过IPC把{id,进度,速度,已下,总大小,镜像索引,切换次数}推给渲染进程
            · 完成→rename .part为正式名→发系统通知
      - 下载完成后自动刷新用户积分（vip/点数）
  (7) 下载中心页：
      - 按状态排序（进行中→已完成→失败）
      - 每行任务：转圈loading图标/完成绿色图标/失败红色图标 + 任务名 + 已下/总大小 + 速度 + 镜像切换次数 tag + 状态tag + 进度条
      - 行尾：完成的可点"打开位置"、任意可点删除
      - 顶部：打开总下载目录、清除已完成
      - 订阅下载进度IPC（zerohub.onDownloadProgress）实时更新
  (8) API中转站页：
      - 左卡片：API Base URL（从settings.api_proxy_url取，可一键复制）+ 支持协议tag（OpenAI/Claude/Gemini/Dify）
      - 右卡片：列出所有类型=api的资源，点击跳转详情下载
      - 下半部：Python/cURL/JavaScript三种调用示例Tabs（用<code>黑底高亮代码块）
  (9) 设置页：
      - 账户信息卡（用户名/VIP/到期/积分/刷新/退出）
      - 服务器配置卡（地址输入框+测试并保存，和服务器配置页共用逻辑）
      - 下载配置卡（下载目录路径+低速阈值说明+镜像优先级说明+打开下载目录）
      - 关于卡（版本v1.0.0/技术栈/检查更新）

3.4 所有页面严格要求：
  - 整体背景#ffffff（纯白），视觉简约干净，禁用花哨装饰
  - 加载状态全部使用 v-loading
  - 文字全部UTF-8中文，无任何乱码
  - 使用 flex / grid 布局，el-card el-table el-pagination固定像素宽度，窗口 resize 不发生错位
  - 所有按钮（包括图标按钮、el-button link）均绑定实际函数，禁用"假按钮"
  - 各路由切换添加 fade 过渡动画（250ms透明度）

四、【打包与交付】
  1) 后端：用 pkg 打包为 zero-hub-server.exe（目标 node18-win-x64，include better-sqlite3.node 和 uploads）
     同时提供 render.yaml 部署到 Render 免费云（rootDir: server，build 安装 admin-web 依赖并构建，start 启动 server.js）
  2) 管理后台：vite build 输出 admin-web/dist，后端 server.js 自动作为 /admin 静态资源服务
  3) 客户端：electron-builder 打包
     - win x64 nsis 安装版（允许改路径/桌面快捷方式）+ portable 便携版
     - 配置 productName=ZeroHub，appId=com.zerohub.client
     - 产物输出 client/release/

五、【验收标准】
  1. 后端 node server.js 启动无报错，/api/health 返回 ok，默认管理员能登录管理后台
  2. 管理后台8个页面全部打开无布局错乱，生成1000张卡密不重复，创建资源上传图片成功，封禁用户后客户端立即返回403
  3. 客户端双击 exe 打开看到启动加载屏，然后看到登录页；输入本地服务器地址测试连接显示成功；
     使用生成的积分卡注册成功后立即能登录；下载一个软件能看到 < 1% 步进的进度条、实时速度和文件大小；
     VIP用户下载不再扣积分；退出客户端再打开自动登录无需输入账号密码；
     所有按钮点击都有实际效果（弹窗/跳转/网络请求/文件打开/Toast反馈）；
     无任何乱码、无任何白屏、无页面元素溢出或错位。
```

---

## ✅ 功能验收清单（Checklist）
### 🔐 用户/卡密系统
- [ ] 10位纯数字卡密批量生成（1-1000张），不重复
- [ ] 5种卡密：积分卡/周卡/月卡/年卡/永久VIP，积分数量可配置
- [ ] 卡密验证接口（用于注册前端即时提示）
- [ ] 卡密封禁/解封（未使用的卡才能封）
- [ ] 注册 → pending_registrations → 24小时内处理 → 活跃用户
- [ ] 24小时未确认 → 自动注销 status=cancelled
- [ ] 管理员手动确认/封禁/解封/注销/手动改VIP与积分
- [ ] VIP到期自动降级（middleware每次请求检查）
- [ ] 记住登录（30天JWT），下次打开免登录（除被注销外）
- [ ] 后端关机期间客户端也能提交注册，开机后自动处理（pending队列+5分钟定时+启动时立即处理）

### 📦 资源系统
- [ ] 4种类型：软件/大模型/游戏/API中转站，后台可增删改查
- [ ] 每项资源：封面/截图/图标/描述/标签/版本/大小/作者/积分/主链接/多镜像/是否控制台下载/上下架/排序
- [ ] 前台列表支持关键词/类型/最新/热门筛选分页
- [ ] 详情页展示下载次数，发起下载后VIP免积分，非VIP按积分扣费，重复下载同资源不重复扣
- [ ] 管理后台能改任何字段，即时生效

### ⚡ 下载器（Electron 主进程）
- [ ] 启动屏400ms~1200ms延迟显示主窗口，确保页面加载完成
- [ ] HTTP下载带Range断点续传（.part文件）
- [ ] 10秒滑窗速度统计
- [ ] 速度<50KB/s持续>15s 自动切换下一个镜像源
- [ ] 镜像源失败/超时15s/4xx自动切
- [ ] 控制台下载：自动生成 huggingface-cli、modelscope、aria2c 多条命令；spawn执行；stdout解析%/大小/速度；低速自动切下一条
- [ ] 每300ms IPC推送进度 → 下载中心实时刷新
- [ ] 完成时系统通知 + 下载中心状态变绿色

### 🎨 UI/UX
- [ ] 整体白色简约，主色渐变 #667eea → #764ba2
- [ ] 无乱码、无布局错乱、窗口缩放不会溢出
- [ ] 所有按钮（含el-button link、图标按钮）全部有实际功能
- [ ] 路由切换fade过渡动画
- [ ] 下载中/完成/失败 图标状态明确区分

### 📦 最终产物
- [ ] 后端 exe 文件（pkg打包单文件）
- [ ] 后端 Render/Railway 部署配置（yaml + 环境变量说明）
- [ ] 客户端 ZeroHub Setup 1.0.0.exe 安装版
- [ ] 客户端 ZeroHub 1.0.0.exe 便携版
- [ ] 管理后台 自动集成进后端 /admin，打包后不用单独部署
