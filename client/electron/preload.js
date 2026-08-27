const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('zerohub', {
  // 窗口控制
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized'),

  // 配置
  getConfig: () => ipcRenderer.invoke('config:get'),
  setConfig: (cfg) => ipcRenderer.invoke('config:set', cfg),

  // 外部链接
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
  openPath: (p) => ipcRenderer.invoke('shell:openPath', p),

  // 通知
  notify: (opts) => ipcRenderer.invoke('notify', opts),

  // 下载
  startDownload: (params) => ipcRenderer.invoke('download:start', params),
  consoleDownload: (params) => ipcRenderer.invoke('download:console', params),
  getDownloadTasks: () => ipcRenderer.invoke('download:getTasks'),
  openDownloadFolder: (p) => ipcRenderer.invoke('download:openFolder', p),
  getDownloadDir: () => ipcRenderer.invoke('download:getDir'),
  onDownloadProgress: (callback) => {
    const listener = (_e, data) => callback(data);
    ipcRenderer.on('download:progress', listener);
    return () => ipcRenderer.removeListener('download:progress', listener);
  }
});
