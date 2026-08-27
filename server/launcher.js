'use strict';
// ZeroHub 后端 pkg 纯 JS 启动器：
//   - 本身无 native 模块（pkg打包不会触发NAPI崩溃）
//   - 首次运行：将内嵌的 7za.exe + server-full.7z 释放到 exe 同级 cache 目录
//   - 用 7za.exe 解压 server-full.7z 得到便携 Node + 完整后端代码
//   - spawn 子进程：解压后 node.exe server.js，并管道化 stdout/stderr 显示

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const crypto = require('crypto');

const isPackaged = !!process.pkg;
const exeDir = isPackaged ? path.dirname(process.execPath) : __dirname;

// 释放 pkg 内嵌的 asset 到真实文件系统（仅缺失/大小不同时重释放）
function extractAsset(assetPath, destPath) {
  const srcSize = fs.statSync(assetPath).size;
  if (fs.existsSync(destPath) && fs.statSync(destPath).size === srcSize) return false;
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.copyFileSync(assetPath, destPath);
  return true;
}

const cacheDir = path.join(exeDir, 'zerohub-server-cache');
const extractedFlag = path.join(cacheDir, '.extracted-v1');
const archive7z = path.join(cacheDir, 'server-full.7z');
const sevenZip = path.join(cacheDir, '7za.exe');

const startAt = Date.now();

// 1. 首次运行：释放 7za + 7z 包并解压
if (!fs.existsSync(extractedFlag)) {
  process.stdout.write('[1/4] 首次启动准备中...释放资源\r');
  fs.mkdirSync(cacheDir, { recursive: true });
  const pkgAssets = isPackaged ? __dirname : exeDir;
  extractAsset(path.join(pkgAssets, 'sfx-stage', 'server-full.7z'), archive7z);
  extractAsset(path.join(pkgAssets, '7za.exe'), sevenZip);
  process.stdout.write('[2/4] 正在解压后端服务...（45MB）\r');
  const res = spawn(sevenZip, ['x', '-bd', '-y', '-o' + cacheDir, archive7z], { stdio: 'pipe' });
  const errors = [];
  res.stderr.on('data', c => errors.push(c.toString()));
  res.on('close', code => {
    if (code !== 0 && code !== 1) {
      console.error('解压失败:', errors.join(''));
      process.exit(code);
    }
    fs.writeFileSync(extractedFlag, String(Date.now()));
    startApp();
  });
} else {
  startApp();
}

function startApp() {
  process.stdout.write('[3/4] 启动 ZeroHub 后端服务...       \r\n');
  process.stdout.write('═══════════════════════════════════════════\r\n');
  process.stdout.write('  ZeroHub Software Mall Backend (Portable)\r\n');
  process.stdout.write('═══════════════════════════════════════════\r\n\r\n');

  const appDir = cacheDir; // 7z a dir\* 直接将dir下所有内容作为7z根，无需额外层级
  const serverDir = path.join(appDir, 'server');
  const nodeExe = path.join(appDir, 'node.exe');

  if (!fs.existsSync(nodeExe) || !fs.existsSync(path.join(serverDir, 'server.js'))) {
    console.error('[错误] 缓存目录损坏，删除 ' + cacheDir + ' 后重新启动本程序即可自动修复');
    process.exit(2);
  }

  const child = spawn(nodeExe, ['server.js'], {
    cwd: serverDir,
    stdio: 'inherit',
    windowsHide: false
  });

  child.on('exit', (code, signal) => {
    console.log('\r\n[后端进程退出] code=' + code + ' signal=' + signal);
    process.exit(code || 0);
  });
}