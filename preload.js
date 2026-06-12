const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  captureScreen: () => ipcRenderer.invoke('capture-screen'),
  getActiveBrowserData: () => ipcRenderer.invoke('get-active-browser-data'),
  readScreenshotFile: (filePath) => ipcRenderer.invoke('read-screenshot-file', filePath),
  getAppPaths: () => ipcRenderer.invoke('get-app-paths'),
  fetchUrl: (url) => ipcRenderer.invoke('fetch-url', url)
});
