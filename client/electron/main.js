const { app, BrowserWindow, ipcMain, shell, dialog, Notification } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const { exec, spawn } = require('child_process');
const os = require('os');

const isDev = !app.isPackaged;

// 配置文件路径
const configDir = app.getPath('userData');
const configPath = path.join(configDir, 'zerohub-config.json');
const downloadsDir = path.join(app.getPath('downloads'), 'ZeroHub');
if (!fs.existsSync(downloadsDir)) fs.mkdirSync(downloadsDir, { recursive: true });

// 读取/写入配置
function readConfig() {
  try {
    if (fs.existsSync(configPath)) return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  } catch (e) {}
  return {
    serverUrl: 'http://localhost:3000',
    autoLogin: true,
    theme: 'light'
  };
}
function writeConfig(cfg) {
  fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2));
}

let mainWindow = null;
let splashWindow = null;

// 启动屏
function createSplash() {
  splashWindow = new BrowserWindow({
    width: 520,
    height: 520,
    frame: false,
    transparent: false,
    backgroundColor: '#ffffff',
    resizable: false,
    alwaysOnTop: true,
    show: false,
    center: true,
    webPreferences: { nodeIntegration: false, contextIsolation: true }
  });
  splashWindow.loadFile(path.join(__dirname, 'splash.html'));
  splashWindow.once('ready-to-show', () => splashWindow.show());
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 780,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#ffffff',
    show: false,
    frame: false,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#ffffff',
      symbolColor: '#333333',
      height: 36
    },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: false
    }
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5174');
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    setTimeout(() => {
      if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.close();
      }
      mainWindow.show();
    }, 800);
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

// ================== 窗口控制 ==================
ipcMain.handle('window:minimize', () => mainWindow?.minimize());
ipcMain.handle('window:maximize', () => {
  if (!mainWindow) return false;
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
  return mainWindow.isMaximized();
});
ipcMain.handle('window:close', () => mainWindow?.close());
ipcMain.handle('window:isMaximized', () => !!mainWindow?.isMaximized());

// ================== 配置 ==================
ipcMain.handle('config:get', () => readConfig());
ipcMain.handle('config:set', (_e, cfg) => {
  const merged = { ...readConfig(), ...cfg };
  writeConfig(merged);
  return merged;
});

// ================== 外部链接 ==================
ipcMain.handle('shell:openExternal', (_e, url) => shell.openExternal(url));
ipcMain.handle('shell:openPath', (_e, p) => shell.showItemInFolder(p));

// ================== 通知 ==================
ipcMain.handle('notify', (_e, { title, body }) => {
  if (Notification.isSupported()) {
    new Notification({ title, body }).show();
  }
});

// ================== 下载管理 ==================
const downloadTasks = new Map(); // id -> {progress, speed, status, ...}
const speedHistory = new Map(); // id -> [{time, bytes}]

// 计算速度：每任务保存最近10秒的bytes记录
function calcSpeed(taskId, downloadedBytes) {
  const now = Date.now();
  const hist = speedHistory.get(taskId) || [];
  hist.push({ time: now, bytes: downloadedBytes });
  while (hist.length > 1 && now - hist[0].time > 10000) hist.shift();
  speedHistory.set(taskId, hist);
  if (hist.length < 2) return 0;
  const first = hist[0], last = hist[hist.length - 1];
  const sec = (last.time - first.time) / 1000;
  if (sec <= 0) return 0;
  return Math.round((last.bytes - first.bytes) / sec);
}

// 判断是否需要切换镜像：过去10秒平均速度 < 50KB/s 持续15秒以上
const slowStartTimes = new Map();
function shouldSwitchMirror(taskId, speed) {
  const now = Date.now();
  const threshold = 50 * 1024; // 50KB/s
  if (speed < threshold) {
    if (!slowStartTimes.has(taskId)) {
      slowStartTimes.set(taskId, now);
      return false;
    }
    if (now - slowStartTimes.get(taskId) > 15000) {
      slowStartTimes.delete(taskId);
      return true;
    }
  } else {
    slowStartTimes.delete(taskId);
  }
  return false;
}

// 普通HTTP/HTTPS下载（带镜像切换）
ipcMain.handle('download:start', async (event, { id, url, mirrors, filename, resourceName }) => {
  return new Promise((resolve) => {
    const allUrls = [url, ...(mirrors || [])].filter(Boolean);
    let currentMirrorIdx = 0;

    const finalFilename = filename || `${Date.now()}.bin`;
    const savePath = path.join(downloadsDir, finalFilename);
    const tempPath = savePath + '.part';
    let downloaded = fs.existsSync(tempPath) ? fs.statSync(tempPath).size : 0;
    let totalSize = 0;
    let currentReq = null;
    let currentResp = null;
    let fileStream = null;
    let lastNotifySpeed = 0;

    const task = {
      id, url, mirrors, filename: finalFilename, savePath,
      status: 'downloading', progress: 0, speed: 0,
      downloaded, totalSize, resourceName, mirrorIdx: 0, switchedCount: 0
    };
    downloadTasks.set(id, task);

    function cleanupAndResolve(status, errMsg) {
      try { fileStream?.close(); } catch (e) {}
      try { currentReq?.destroy(); } catch (e) {}
      task.status = status;
      if (status === 'completed') task.progress = 100;
      if (errMsg) task.error = errMsg;
      downloadTasks.set(id, task);
      slowStartTimes.delete(id);
      speedHistory.delete(id);
      resolve({ status, savePath, error: errMsg });
    }

    function doDownload() {
      if (currentMirrorIdx >= allUrls.length) {
        cleanupAndResolve('error', '所有镜像源都下载失败');
        return;
      }
      const currentUrl = allUrls[currentMirrorIdx];
      task.mirrorIdx = currentMirrorIdx;

      const isHttps = currentUrl.startsWith('https');
      const client = isHttps ? https : http;

      const parsed = new URL(currentUrl);
      const options = {
        hostname: parsed.hostname,
        port: parsed.port || (isHttps ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method: 'GET',
        headers: downloaded > 0 ? { Range: `bytes=${downloaded}-` } : {}
      };

      currentReq = client.request(options, (resp) => {
        currentResp = resp;
        if (resp.statusCode === 416) {
          // Range not satisfiable - assume file complete
          fs.renameSync(tempPath, savePath);
          cleanupAndResolve('completed');
          return;
        }
        if (resp.statusCode >= 300 && resp.statusCode < 400 && resp.headers.location) {
          allUrls[currentMirrorIdx] = resp.headers.location;
          doDownload();
          return;
        }
        if (resp.statusCode >= 400) {
          // 失败，切换下一个镜像
          currentMirrorIdx++;
          task.switchedCount++;
          doDownload();
          return;
        }

        if (!totalSize) {
          const contentRange = resp.headers['content-range'];
          if (contentRange) {
            const m = contentRange.match(/\/(\d+)$/);
            if (m) totalSize = parseInt(m[1]);
          }
          if (!totalSize) totalSize = parseInt(resp.headers['content-length'] || '0') + downloaded;
          task.totalSize = totalSize;
        }

        fileStream = fs.createWriteStream(tempPath, { flags: downloaded > 0 ? 'a' : 'w' });
        resp.pipe(fileStream);

        resp.on('data', (chunk) => {
          downloaded += chunk.length;
          task.downloaded = downloaded;
          const speed = calcSpeed(id, downloaded);
          task.speed = speed;
          if (totalSize > 0) {
            task.progress = Math.min(100, Math.round((downloaded / totalSize) * 100));
          }

          // 进度事件通知渲染进程
          if (Date.now() - lastNotifySpeed > 300) {
            lastNotifySpeed = Date.now();
            try {
              event.sender.send('download:progress', { id, ...task });
            } catch (e) {}
          }

          // 判断是否要切换镜像
          if (shouldSwitchMirror(id, speed) && (currentMirrorIdx + 1) < allUrls.length) {
            task.switchedCount++;
            currentMirrorIdx++;
            try { currentResp?.destroy(); } catch (e) {}
            try { fileStream?.close(); } catch (e) {}
            // 不destroy已下载数据（append方式），下一个镜像从断点继续，如果不支持range则从头开始
            doDownload();
          }
        });

        resp.on('end', () => {
          fileStream.end(() => {
            try { fs.renameSync(tempPath, savePath); } catch (e) {}
            cleanupAndResolve('completed');
          });
        });

        resp.on('error', () => {
          currentMirrorIdx++;
          task.switchedCount++;
          try { fileStream?.close(); } catch (e) {}
          doDownload();
        });
      });

      currentReq.on('error', () => {
        currentMirrorIdx++;
        task.switchedCount++;
        setTimeout(doDownload, 500);
      });
      currentReq.setTimeout(15000, () => {
        currentMirrorIdx++;
        task.switchedCount++;
        try { currentReq.destroy(); } catch (e) {}
        doDownload();
      });
      currentReq.end();
    }

    doDownload();
  });
});

ipcMain.handle('download:getTasks', () => Array.from(downloadTasks.values()));

ipcMain.handle('download:openFolder', (_e, p) => {
  const filePath = p || downloadsDir;
  if (fs.existsSync(filePath)) shell.showItemInFolder(filePath);
  else shell.openPath(downloadsDir);
});

ipcMain.handle('download:getDir', () => downloadsDir);

// ================== 控制台下载（huggingface-cli / modelscope / aria2） ==================
// 支持：huggingface-cli download, modelscope download, aria2c
ipcMain.handle('download:console', async (event, { id, command, mirrors, resourceName }) => {
  return new Promise((resolve) => {
    const task = {
      id, command, status: 'running', progress: 0, speed: 0,
      downloaded: 0, totalSize: 0, resourceName, logs: [],
      mirrorIdx: 0, switchedCount: 0
    };
    downloadTasks.set(id, task);

    let currentIdx = 0;
    const commands = [command, ...(mirrors || [])].filter(Boolean);
    let currentProc = null;
    let lastProgressTime = 0;

    function killCurrent() {
      try {
        if (process.platform === 'win32') {
          exec(`taskkill /pid ${currentProc.pid} /T /F`);
        } else {
          currentProc.kill('SIGKILL');
        }
      } catch (e) {}
    }

    function runCmd(cmd) {
      task.logs.push(`> ${cmd}`);
      try { event.sender.send('download:progress', { id, ...task }); } catch (e) {}

      // 在windows上使用cmd执行
      const shellOpt = process.platform === 'win32' ? true : '/bin/bash';
      currentProc = spawn(cmd, [], {
        shell: shellOpt,
        cwd: downloadsDir,
        env: { ...process.env, HF_ENDPOINT: mirrors?.[0] || 'https://hf-mirror.com' }
      });

      let speedLastBytes = 0;
      let speedLastTime = Date.now();
      let slowCount = 0;

      currentProc.stdout.on('data', (buf) => {
        const text = buf.toString();
        task.logs.push(text.slice(-500));
        if (task.logs.length > 200) task.logs.splice(0, task.logs.length - 200);

        // huggingface-cli / aria2 进度解析
        const pctMatch = text.match(/(\d{1,3})%/);
        if (pctMatch) task.progress = parseInt(pctMatch[1]);
        const dlMatch = text.match(/([\d.]+)\s*(GB|MB|KB|B)\s*\/\s*([\d.]+)\s*(GB|MB|KB|TB)/i);
        if (dlMatch) {
          const sizeMap = { B: 1, KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3, TB: 1024 ** 4 };
          const curUnit = sizeMap[dlMatch[2].toUpperCase()] || 1;
          const totalUnit = sizeMap[dlMatch[4].toUpperCase()] || 1;
          task.downloaded = parseFloat(dlMatch[1]) * curUnit;
          task.totalSize = parseFloat(dlMatch[3]) * totalUnit;
        }

        // 速度
        const speedMatch = text.match(/([\d.]+)\s*(GB|MB|KB|B)\s*\/\s*s/i);
        if (speedMatch) {
          const sm = { B: 1, KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3 };
          task.speed = parseFloat(speedMatch[1]) * (sm[speedMatch[2].toUpperCase()] || 1);
        } else {
          const now = Date.now();
          const sec = (now - speedLastTime) / 1000;
          if (sec > 1) {
            task.speed = Math.max(0, Math.round((task.downloaded - speedLastBytes) / sec));
            speedLastBytes = task.downloaded;
            speedLastTime = now;
          }
        }

        // 低速检测
        if (task.speed > 0 && task.speed < 50 * 1024) {
          slowCount++;
          if (slowCount > 15 && (currentIdx + 1) < commands.length) {
            slowCount = 0;
            currentIdx++;
            task.mirrorIdx = currentIdx;
            task.switchedCount++;
            task.logs.push(`[系统] 下载速度慢，切换到下一个镜像源...`);
            killCurrent();
            setTimeout(() => runCmd(commands[currentIdx]), 500);
            return;
          }
        } else {
          slowCount = 0;
        }

        const now = Date.now();
        if (now - lastProgressTime > 300) {
          lastProgressTime = now;
          try { event.sender.send('download:progress', { id, ...task }); } catch (e) {}
        }
      });

      currentProc.stderr.on('data', (buf) => {
        const text = buf.toString();
        task.logs.push('[stderr] ' + text.slice(-300));
      });

      currentProc.on('close', (code) => {
        if (code === 0) {
          task.status = 'completed';
          task.progress = 100;
          downloadTasks.set(id, task);
          try { event.sender.send('download:progress', { id, ...task }); } catch (e) {}
          resolve({ status: 'completed' });
        } else {
          if ((currentIdx + 1) < commands.length) {
            currentIdx++;
            task.mirrorIdx = currentIdx;
            task.switchedCount++;
            task.logs.push(`[系统] 命令退出码 ${code}，尝试下一个镜像源...`);
            setTimeout(() => runCmd(commands[currentIdx]), 800);
          } else {
            task.status = 'error';
            task.error = `退出码 ${code}`;
            downloadTasks.set(id, task);
            try { event.sender.send('download:progress', { id, ...task }); } catch (e) {}
            resolve({ status: 'error', error: task.error });
          }
        }
      });

      currentProc.on('error', (err) => {
        task.logs.push('[error] ' + err.message);
        if ((currentIdx + 1) < commands.length) {
          currentIdx++;
          setTimeout(() => runCmd(commands[currentIdx]), 800);
        } else {
          task.status = 'error';
          task.error = err.message;
          downloadTasks.set(id, task);
          resolve({ status: 'error', error: err.message });
        }
      });
    }

    runCmd(commands[0]);
  });
});

// ================== 应用生命周期 ==================
app.whenReady().then(() => {
  createSplash();
  setTimeout(createWindow, 100);
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
