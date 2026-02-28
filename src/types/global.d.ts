export interface ElectronAPI {
  minimizeWindow: () => Promise<void>
  maximizeWindow: () => Promise<void>
  closeWindow: () => Promise<void>
  isMaximized: () => Promise<boolean>
  readDir: (dirPath: string) => Promise<{ name: string; isDirectory: boolean; path: string }[]>
  readFile: (filePath: string) => Promise<{ success: boolean; content?: string; path?: string; error?: string }>
  readText: (filePath: string) => Promise<{ success: boolean; content?: string; path?: string; error?: string }>
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
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}
