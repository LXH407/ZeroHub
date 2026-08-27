# ZeroHub GitHub + Render 一键部署包

本文件夹包含部署 ZeroHub 软件商城到 **GitHub 仓库 + Render 免费云端**的完整文件。
> Render 免费额度：每月750小时单实例运行时长，小型团队/个人项目永久够用（SQLite 注意：免费实例重启时磁盘清空，务必定期备份 server/data/zerohub.db）

## 5 步搞定（5分钟）

```
第 1 步：去 https://github.com/new 新建一个空仓库（Private / Public 都行）
         例：https://github.com/your-username/ZeroHub
第 2 步：Windows 下双击运行本目录的 push-github.ps1（右键 → 使用 PowerShell 运行）
         或手动：git init → git add -A → git commit -m "initial" → git remote add origin <你的仓库.git> → git push -u origin main
第 3 步：登录 https://dashboard.render.com → New + → Web Service
         → Connect repository → 选刚才的 ZeroHub 仓库（Render 会自动读 render.yaml 填配置）
            Runtime:        Node
            Build Command:  npm run build:admin
            Start Command:  cd server && npm start
            Plan:           Free（免费）
第 4 步：Environment Variables → Add：
            Key=JWT_SECRET   Value=【点击 Generate 生成随机32位】
第 5 步：Advanced → Health Check Path 填 /api/health → Create Web Service
         等 3-5 分钟，绿色按钮 Open 即上线成功！
```

## 上线后

```
后端API：      https://你的项目.onrender.com
健康检查：      https://你的项目.onrender.com/api/health  → {"success":true}
管理后台：      https://你的项目.onrender.com/admin
                 默认：admin / admin123456（上线第一件事：管理后台→设置→改管理员密码）
客户端服务器地址配置填：https://你的项目.onrender.com
```

## 目录清单

| 文件 | 作用 |
|------|------|
| render.yaml | Render 部署配置（Node版本/Build命令/Start命令，选Web Service会自动读） |
| DEPLOY.md | 完整 8 步部署详细说明（含自定义域名、备份、常见问题） |
| README.md | 本快速指引 |
| .env.example | 本地开发环境变量示例（JWT_SECRET、PORT，Render 直接在控制台 Environment Variables 填） |
| push-github.ps1 | Windows PowerShell 一键初始化 Git + 推送到 GitHub（会引导填用户名/邮箱/仓库地址） |
