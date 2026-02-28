import { contextBridge, ipcRenderer } from 'electron'

// 暴露给渲染进程的 API
contextBridge.exposeInMainWorld('electronAPI', {
  // 窗口控制
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window:maximize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized'),

  // 文件系统
  readDir: (dirPath: string) => ipcRenderer.invoke('fs:readDir', dirPath),
  readFile: (filePath: string) => ipcRenderer.invoke('fs:readFile', filePath),
  readText: (filePath: string) => ipcRenderer.invoke('fs:readText', filePath),
  writeFile: (filePath: string, content: string) => ipcRenderer.invoke('fs:writeFile', filePath, content),
  createDir: (dirPath: string) => ipcRenderer.invoke('fs:createDir', dirPath),
  deletePath: (targetPath: string) => ipcRenderer.invoke('fs:delete', targetPath),
  exists: (targetPath: string) => ipcRenderer.invoke('fs:exists', targetPath),

  // 对话框
  selectDirectory: () => ipcRenderer.invoke('dialog:selectDirectory'),
  selectFile: (filters?: { name: string; extensions: string[] }[]) =>
    ipcRenderer.invoke('dialog:selectFile', filters),

  // 外部链接
  openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),

  // 应用路径
  getPath: (name: 'home' | 'appData' | 'userData' | 'temp' | 'desktop' | 'documents') =>
    ipcRenderer.invoke('app:getPath', name),

  // 退出应用
  quitApp: () => ipcRenderer.invoke('app:quit'),

  // Claude 路径
  getClaudePath: () => ipcRenderer.invoke('claude:getPath'),
  getClaudeConfig: () => ipcRenderer.invoke('claude:getConfig'),

  // 监听事件
  onMaximizeChange: (callback: (isMaximized: boolean) => void) => {
    ipcRenderer.on('window:maximizeChange', (_, isMaximized) => callback(isMaximized))
  },

  // 终端功能
  createTerminal: () => ipcRenderer.invoke('term:create'),
  sendTerminalData: (data: string) => ipcRenderer.send('term:data', data),
  onTerminalData: (callback: (data: string) => void) => {
    ipcRenderer.on('term:data', (_, data) => callback(data))
  },

  // API 代理（绕开 CORS）
  apiFetch: (url: string, options: { method: string; headers: Record<string, string>; body: string }) =>
    ipcRenderer.invoke('api:fetch', url, options),

  // 完整的聊天 API — 支持流式输出
  apiChat: (messages: Array<{ role: string; content: string }>, settings?: { apiKey?: string; baseUrl?: string; model?: string; stream?: boolean }) =>
    ipcRenderer.invoke('api:chat', messages, settings),

  // 流式输出事件监听
  onChatChunk: (callback: (chunk: { text?: string; full?: string; done?: boolean; usage?: any }) => void) => {
    const handler = (_: any, chunk: any) => callback(chunk)
    ipcRenderer.on('api:chatChunk', handler)
    return () => ipcRenderer.removeListener('api:chatChunk', handler)
  },

  // 扫描本地 Skills
  scanLocalSkills: () => ipcRenderer.invoke('skill:scanLocal'),

  // 打开本地路径（供 Skills 打开目录使用）
  systemOpenPath: (targetPath: string) => ipcRenderer.invoke('system:openPath', targetPath),

  // Agent 工具调用循环
  startAgent: (
    messages: Array<{ role: string; content: any }>,
    settings?: { apiKey?: string; baseUrl?: string; model?: string; workingDirectory?: string }
  ) => ipcRenderer.invoke('api:agent', messages, settings),

  stopAgent: () => ipcRenderer.invoke('api:agent-stop'),

  resolveAgentPermission: (requestId: string, payload: { behavior: 'allow' | 'deny'; message?: string }) =>
    ipcRenderer.invoke('api:agent-permission', requestId, payload),

  onAgentChunk: (callback: (chunk: any) => void) => {
    const handler = (_: any, chunk: any) => callback(chunk)
    ipcRenderer.on('agent:chunk', handler)
    return () => ipcRenderer.removeListener('agent:chunk', handler)
  },

  onAgentPermissionRequest: (callback: (req: { requestId: string; toolName: string; toolInput: Record<string, string>; toolUseID?: string }) => void) => {
    const handler = (_: any, req: any) => callback(req)
    ipcRenderer.on('agent:permissionRequest', handler)
    return () => ipcRenderer.removeListener('agent:permissionRequest', handler)
  },
})

// 类型声明
export interface ElectronAPI {
  minimizeWindow: () => Promise<void>
  maximizeWindow: () => Promise<void>
  closeWindow: () => Promise<void>
  isMaximized: () => Promise<boolean>
  readDir: (dirPath: string) => Promise<{ name: string; isDirectory: boolean; path: string }[]>
  readFile: (filePath: string) => Promise<{ success: boolean; content?: string; path?: string; error?: string }>
  writeFile: (filePath: string, content: string) => Promise<{ success: boolean; error?: string }>
  createDir: (dirPath: string) => Promise<{ success: boolean; error?: string }>
  deletePath: (targetPath: string) => Promise<{ success: boolean; error?: string }>
  exists: (targetPath: string) => Promise<boolean>
  selectDirectory: () => Promise<string | null>
  selectFile: (filters?: { name: string; extensions: string[] }[]) => Promise<string | null>
  openExternal: (url: string) => Promise<void>
  getPath: (name: 'home' | 'appData' | 'userData' | 'temp' | 'desktop' | 'documents') => Promise<string>
  quitApp: () => Promise<void>
  getClaudePath: () => Promise<string | null>
  getClaudeConfig: () => Promise<{ exists: boolean; path: string | null; env: Record<string, string> | null }>
  onMaximizeChange: (callback: (isMaximized: boolean) => void) => void
  createTerminal: () => Promise<void>
  sendTerminalData: (data: string) => void
  onTerminalData: (callback: (data: string) => void) => void
  apiFetch: (url: string, options: { method: string; headers: Record<string, string>; body: string }) => Promise<{ status: number; body: string; headers: Record<string, string> }>
  apiChat: (messages: Array<{ role: string; content: string }>, settings?: { apiKey?: string; baseUrl?: string; model?: string; stream?: boolean }) => Promise<{ success?: boolean; content?: string; model?: string; usage?: any; error?: string; streamed?: boolean }>
  onChatChunk: (callback: (chunk: { text?: string; full?: string; done?: boolean; usage?: any }) => void) => (() => void)
  scanLocalSkills: () => Promise<Array<{ id: string; name: string; description: string; path: string; enabled: boolean }>>
  systemOpenPath: (targetPath: string) => Promise<string>
  startAgent: (
    messages: Array<{ role: string; content: any }>,
    settings?: { apiKey?: string; baseUrl?: string; model?: string; workingDirectory?: string },
    streamId?: string
  ) => Promise<{ success?: boolean; error?: string }>
  stopAgent: () => Promise<{ success: boolean; message?: string }>
  resolveAgentPermission: (requestId: string, approved: boolean) => Promise<void>
  onAgentChunk: (callback: (chunk: any) => void) => (() => void)
  onAgentPermissionRequest: (callback: (req: { requestId: string; toolName: string; toolInput: Record<string, string> }) => void) => (() => void)
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
