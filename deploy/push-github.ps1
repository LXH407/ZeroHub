#Requires -Version 5
# ZeroHub 一键推送到 GitHub 脚本 (Windows PowerShell 5.1+)
# 修复: UTF-8 BOM 保存避免中文乱码 + 自动切换到项目根 push 全部88项
$ErrorActionPreference = 'Stop'

# ---- 自动定位项目根：脚本在 deploy/ 目录，上级就是 d:\ZeroHub ----
$deployDir   = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Resolve-Path (Join-Path $deployDir '..')
Set-Location $projectRoot

Write-Host ''
Write-Host 'ZeroHub -> GitHub 一键推送（UTF-8 BOM 版本，无乱码）' -ForegroundColor Cyan
Write-Host '============================================================' -ForegroundColor Cyan
Write-Host ("   项目根目录: " + $projectRoot) -ForegroundColor Gray
Write-Host ''
Write-Host ' [1/4] 请先去 https://github.com/new 创建一个空仓库（默认 Public 即可）'
Write-Host '       示例: https://github.com/your-username/ZeroHub.git'
Write-Host ''
$repoUrl = Read-Host ' [2/4] 请粘贴新建仓库的 HTTPS 地址'
if ([string]::IsNullOrWhiteSpace($repoUrl)) { Write-Host '   X 仓库地址为空，退出' -ForegroundColor Red; exit 1 }
$name  = Read-Host ' [3/4] Git 提交用户名（提交历史显示，可随便填）'
$email = Read-Host ' [4/4] Git 提交邮箱（可随便填）'
if ($name)  { git config user.name  $name  2>&1 | Out-Null }
if ($email) { git config user.email $email 2>&1 | Out-Null }
Write-Host ''
if (-not (Test-Path (Join-Path $projectRoot '.git'))) {
    git init -q -b main
    Write-Host '   OK git init 完成（main 分支）' -ForegroundColor Green
}
git add -A 2>&1 | Out-Null
$count = (git status --short | Measure-Object -Line).Lines
git commit -m 'feat: ZeroHub v1.0.0 initial deploy to GitHub & Render (88 items)' --allow-empty -q 2>&1 | Out-Null
Write-Host ("   OK git commit 完成：共 " + $count + " 项源码文件入仓") -ForegroundColor Green
git remote remove origin 2>&1 | Out-Null
git remote add origin $repoUrl
git branch -M main 2>&1 | Out-Null
Write-Host ''
Write-Host '   -> 推送 main 分支到 GitHub （首次 HTTPS 要输入 GitHub 用户名 + PAT Token）' -ForegroundColor Yellow
Write-Host '      Token 怎么拿: GitHub -> 右上角 Settings -> Developer settings -> Personal access tokens -> Tokens (classic)' -ForegroundColor DarkYellow
Write-Host '      勾上 repo 权限 → Generate → 复制粘到 PowerShell 的密码框' -ForegroundColor DarkYellow
git push -u origin main
if ($LASTEXITCODE -eq 0) {
    Write-Host ''
    Write-Host '✔ 推送完成！' -ForegroundColor Green
    Write-Host '    1. 刷新 GitHub 仓库页面：应该能看到 88 项源码（根目录 render.yaml + admin-web/client/server 三大目录 + deploy）' -ForegroundColor Green
    Write-Host '    2. 上 Render.com：Dashboard → New → Blueprints → 选中你的 ZeroHub 仓库（render.yaml 自动读取，一键上线）' -ForegroundColor Green
    Write-Host '    3. 若要上传安装包/EXE/7z：GitHub 仓库 → Releases → Draft a new release，把 build-output 下的 3 个 EXE + 完整交付包拖进去即可' -ForegroundColor Green
    exit 0
} else {
    Write-Host ''
    Write-Host ("X 推送失败 exit code=" + $LASTEXITCODE) -ForegroundColor Red
    Write-Host '   常见原因:' -ForegroundColor Yellow
    Write-Host '   (1) 仓库地址填错了（去 https://github.com/you/ZeroHub → Clone → HTTPS → 复制，再重跑脚本）' -ForegroundColor Yellow
    Write-Host '   (2) Token 没勾 repo 权限或过期 → 重新生成 Token' -ForegroundColor Yellow
    Write-Host '   (3) 网络/代理：在 PowerShell 先运行 $env:HTTPS_PROXY="http://127.0.0.1:7890"（你的代理端口），再 .\push-github.ps1' -ForegroundColor Yellow
    Write-Host '   可手动：' -ForegroundColor Yellow
    Write-Host ("      cd " + $projectRoot)
    Write-Host '      git remote set-url origin 正确的HTTPS地址'
    Write-Host '      git push -u origin main'
    exit $LASTEXITCODE
}
