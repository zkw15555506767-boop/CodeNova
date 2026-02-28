import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, shell, dialog, globalShortcut } from 'electron'
import * as path from 'path'
import * as fs from 'fs/promises'
import * as os from 'os'

// 处理 macOS 打包后 PATH 环境变量丢失导致找不到 node 命令的问题
if (process.platform === 'darwin') {
  process.env.PATH = `${process.env.PATH}:/usr/local/bin:/opt/homebrew/bin:/opt/homebrew/sbin`
}

// 禁用 GPU 加速，避免某些问题
app.disableHardwareAcceleration()

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let ptyProcess: any = null

// 开发环境判断
const isDev = !app.isPackaged

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 15, y: 15 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    backgroundColor: '#ffffff',
    show: false,
  })

  // 窗口准备就绪后显示
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  // 放行所有 API 请求的 CORS，让渲染进程可以直接咤第三方 API
  mainWindow.webContents.session.webRequest.onHeadersReceived(
    { urls: ['https://*/*'] },
    (details, callback) => {
      const headers = { ...details.responseHeaders }
      headers['access-control-allow-origin'] = ['*']
      headers['access-control-allow-methods'] = ['GET, POST, PUT, DELETE, OPTIONS']
      headers['access-control-allow-headers'] = ['Content-Type, Authorization, x-api-key, anthropic-version']
      callback({ responseHeaders: headers })
    }
  )

  // 加载应用
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000')
    mainWindow.webContents.openDevTools()
  } else {
    // 生产环境：加载静态导出的 HTML
    mainWindow.loadFile(path.join(__dirname, '../out/index.html'))
  }

  // 窗口关闭时最小化到托盘
  mainWindow.on('close', (event) => {
    if (tray) {
      event.preventDefault()
      mainWindow?.hide()
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function createTray() {
  // 创建 16x16 的托盘图标
  const icon = nativeImage.createEmpty()
  tray = new Tray(icon.resize({ width: 16, height: 16 }))

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示 CodeNova',
      click: () => {
        mainWindow?.show()
        mainWindow?.focus()
      },
    },
    {
      label: '隐藏',
      click: () => mainWindow?.hide(),
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        tray?.destroy()
        tray = null
        app.quit()
      },
    },
  ])

  tray.setToolTip('CodeNova')
  tray.setContextMenu(contextMenu)

  tray.on('click', () => {
    if (mainWindow?.isVisible()) {
      mainWindow.hide()
    } else {
      mainWindow?.show()
      mainWindow?.focus()
    }
  })
}

function registerGlobalShortcuts() {
  // CommandOrControl + Shift + Space 呼出窗口
  globalShortcut.register('CommandOrControl+Shift+Space', () => {
    if (mainWindow?.isVisible()) {
      mainWindow.hide()
    } else {
      mainWindow?.show()
      mainWindow?.focus()
    }
  })
}

// IPC 处理器
function registerIpcHandlers() {
  // 窗口控制
  ipcMain.handle('window:minimize', () => mainWindow?.minimize())
  ipcMain.handle('window:maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow?.maximize()
    }
  })
  ipcMain.handle('window:close', () => mainWindow?.hide())
  ipcMain.handle('app:quit', () => {
    tray?.destroy()
    tray = null
    app.quit()
  })
  ipcMain.handle('window:isMaximized', () => mainWindow?.isMaximized())

  // 文件操作
  ipcMain.handle('fs:readDir', async (_, dirPath: string) => {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true })
      return entries.map((entry) => ({
        name: entry.name,
        isDirectory: entry.isDirectory(),
        path: path.join(dirPath, entry.name),
      }))
    } catch (error) {
      console.error('Error reading directory:', error)
      return []
    }
  })

  ipcMain.handle('fs:readFile', async (_, filePath: string) => {
    try {
      const content = await fs.readFile(filePath)
      return { success: true, content: content.toString('base64'), path: filePath }
    } catch (error) {
      console.error('Error reading file:', error)
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('fs:readText', async (_, filePath: string) => {
    try {
      const content = await fs.readFile(filePath)

      if (filePath.toLowerCase().endsWith('.pdf')) {
        try {
          const pdfParse = require('pdf-parse')
          const data = await pdfParse(content)
          return { success: true, content: data.text, path: filePath }
        } catch (pdfErr) {
          console.error('Error parsing PDF:', pdfErr)
          return { success: false, error: '解析 PDF 失败: ' + String(pdfErr) }
        }
      }

      return { success: true, content: content.toString('utf-8'), path: filePath }
    } catch (error) {
      console.error('Error reading text file:', error)
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('fs:writeFile', async (_, filePath: string, content: string) => {
    try {
      await fs.writeFile(filePath, content, 'utf-8')
      return { success: true }
    } catch (error) {
      console.error('Error writing file:', error)
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('fs:createDir', async (_, dirPath: string) => {
    try {
      await fs.mkdir(dirPath, { recursive: true })
      return { success: true }
    } catch (error) {
      console.error('Error creating directory:', error)
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('fs:delete', async (_, targetPath: string) => {
    try {
      await fs.rm(targetPath, { recursive: true })
      return { success: true }
    } catch (error) {
      console.error('Error deleting:', error)
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('fs:exists', async (_, targetPath: string) => {
    try {
      await fs.access(targetPath)
      return true
    } catch {
      return false
    }
  })

  // 对话框
  ipcMain.handle('dialog:selectDirectory', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openDirectory'],
    })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle('dialog:selectFile', async (_, filters?: { name: string; extensions: string[] }[]) => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openFile'],
      filters: filters || [
        { name: 'All Files', extensions: ['*'] },
      ],
    })
    return result.canceled ? null : result.filePaths[0]
  })

  // 外部链接
  ipcMain.handle('shell:openExternal', async (_, url: string) => {
    await shell.openExternal(url)
  })

  // 获取应用路径
  ipcMain.handle('app:getPath', (_, name: 'home' | 'appData' | 'userData' | 'temp' | 'desktop' | 'documents') => {
    return app.getPath(name)
  })

  // 获取 claude 命令路径
  ipcMain.handle('claude:getPath', async () => {
    try {
      const { execSync } = require('child_process')
      const result = execSync('which claude', { encoding: 'utf-8' }).trim()
      return result
    } catch {
      return null
    }
  })

  // 读取本地 Claude Code 配置
  ipcMain.handle('claude:getConfig', async () => {
    try {
      const home = app.getPath('home')
      const localPath = path.join(home, '.claude', 'settings.local.json')
      const defaultPath = path.join(home, '.claude', 'settings.json')

      let configPath: string | null = null
      try {
        await fs.access(localPath)
        configPath = localPath
      } catch {
        try {
          await fs.access(defaultPath)
          configPath = defaultPath
        } catch {
          configPath = null
        }
      }

      if (!configPath) {
        return { exists: false, path: null, env: null }
      }

      const raw = await fs.readFile(configPath, 'utf-8')
      const parsed = JSON.parse(raw)
      return { exists: true, path: configPath, env: parsed?.env || null }
    } catch (error) {
      console.error('Failed to read Claude Code config:', error)
      return { exists: false, path: null, env: null }
    }
  })

  // 终端 PTY
  ipcMain.handle('term:create', () => {
    if (ptyProcess) return

    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const nodePty = require('node-pty')
      const shell = process.env[os.platform() === 'win32' ? 'COMSPEC' : 'SHELL'] as string || '/bin/sh'
      ptyProcess = nodePty.spawn(shell, [], {
        name: 'xterm-color',
        cols: 80,
        rows: 24,
        cwd: app.getPath('home'),
        env: process.env as any,
      })
      ptyProcess.onData((data: string) => {
        mainWindow?.webContents.send('term:data', data)
      })
    } catch (e) {
      console.warn('node-pty not available, terminal will use echo mode:', e)
    }
  })

  ipcMain.on('term:data', (_, data: string) => {
    ptyProcess?.write(data)
  })

  // 完整的 API 聊天代理 — 支持流式输出
  ipcMain.handle('api:chat', async (event, messages: Array<{ role: string; content: string }>, overrideSettings?: { apiKey?: string; baseUrl?: string; model?: string; stream?: boolean }) => {
    const https = require('https')
    const { URL } = require('url')
    const fsSync = require('fs')

    // 1. 读取配置
    let apiKey = overrideSettings?.apiKey || ''
    let baseUrl = overrideSettings?.baseUrl || ''
    let model = overrideSettings?.model || ''
    const useStream = overrideSettings?.stream !== false // 默认启用流式

    if (!apiKey || !baseUrl) {
      try {
        const configPath = path.join(app.getPath('home'), '.claude', 'settings.json')
        const configRaw = fsSync.readFileSync(configPath, 'utf-8')
        const config = JSON.parse(configRaw)
        const env = config.env || {}
        if (!apiKey) apiKey = env.ANTHROPIC_AUTH_TOKEN || env.ANTHROPIC_API_KEY || ''
        if (!baseUrl) baseUrl = env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com'
        if (!model) model = env.ANTHROPIC_MODEL || env.ANTHROPIC_DEFAULT_SONNET_MODEL || 'MiniMax-M2.5'
      } catch (e) {
        console.error('Failed to read claude config:', e)
        return { error: '无法读取 ~/.claude/settings.json 配置文件' }
      }
    }
    if (!model) model = 'MiniMax-M2.5'

    console.log('[api:chat] Using:', { baseUrl, model, apiKeyLen: apiKey.length, stream: useStream })

    const endpoint = `${baseUrl}/v1/messages`
    const requestBody = JSON.stringify({
      model,
      max_tokens: 4096,
      stream: useStream,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    })

    const parsed = new URL(endpoint)
    const sender = event.sender
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: requestBody
      })

      if (!useStream || !response.ok) {
        // 非流式或错误处理
        if (!response.ok) {
          console.error('[api:chat] Error response status:', response.status)
        } else {
          console.log('[api:chat] Response status:', response.status)
        }

        const data = await response.text()
        if (!response.ok) {
          console.error('[api:chat] Error response data:', data)
        }

        try {
          const json = JSON.parse(data)
          if (response.ok) {
            const textContent = json.content?.find((c: any) => c.type === 'text')?.text || ''
            return { success: true, content: textContent, model: json.model, usage: json.usage }
          } else {
            return { error: json.error?.message || `API 请求失败: ${response.status} - ${data}` }
          }
        } catch {
          return { error: `无法解析 API 响应: ${response.status} - ${data}` }
        }
      } else {
        // 流式输出处理
        const reader = response.body?.getReader()
        if (!reader) throw new Error('流式读取失败')

        let buffer = ''
        let fullText = ''
        let usage: any = null
        const decoder = new TextDecoder('utf-8')

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || '' // 保留不完整的行

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const data = line.slice(6).trim()
            if (data === '[DONE]') continue

            try {
              const event = JSON.parse(data)

              if (event.type === 'content_block_delta' && event.delta?.text) {
                fullText += event.delta.text
                // 发送流式 chunk 给渲染进程
                sender.send('api:chatChunk', { text: event.delta.text, full: fullText })
              }

              if (event.type === 'message_delta' && event.usage) {
                usage = event.usage
              }

              if (event.type === 'message_start' && event.message?.usage) {
                usage = { ...usage, input_tokens: event.message.usage.input_tokens }
              }
            } catch {
              // 忽略解析错误
            }
          }
        }

        console.log('[api:chat] Stream complete, length:', fullText.length)
        sender.send('api:chatChunk', { done: true, usage })
        return { success: true, content: fullText, model, usage, streamed: true }
      }
    } catch (err: any) {
      console.error('[api:chat] Request error:', err.message)
      return { error: `网络错误: ${err.message}` }
    }
  })

  // ============================================================
  // Agent Loop — Claude Agent SDK (spawns local claude CLI)
  // ============================================================

  // Main-process-level map to support concurrent agent sessions across conversations
  const activeAgents = new Map<string, AbortController>()

  type PermissionResultPayload = {
    behavior: 'allow' | 'deny'
    toolUseID?: string
    message?: string
  }

  const pendingPermissions = new Map<string, { resolve: (result: PermissionResultPayload) => void }>()

  ipcMain.handle('api:agent-permission', (_, requestId: string, payload: PermissionResultPayload) => {
    console.log('[api:agent-permission] Received response for REQ:', requestId, 'Payload:', payload)
    const pending = pendingPermissions.get(requestId)
    if (pending) {
      console.log('[api:agent-permission] Resolving pending Promise for REQ:', requestId)
      pendingPermissions.delete(requestId)
      pending.resolve(payload)
    } else {
      console.log('[api:agent-permission] WARNING: No pending Promise found for REQ:', requestId)
    }
  })

  ipcMain.handle('api:agent-stop', (_, streamId: string) => {
    const controller = activeAgents.get(streamId)
    if (controller) {
      console.log(`[api:agent-stop] Aborting active agent session for stream: ${streamId}...`)
      controller.abort()
      activeAgents.delete(streamId)
      return { success: true }
    }
    return { success: false, message: 'No active agent session' }
  })

  ipcMain.handle('api:agent', async (event, messages: Array<{ role: string; content: string }>, settings: {
    workingDirectory?: string; model?: string; systemPrompt?: string
  } | undefined, streamId: string) => {
    if (!streamId) {
      streamId = `agent-${Date.now()}`
    }

    // Main-process lock: reject concurrent session for the SAME stream
    if (activeAgents.has(streamId)) {
      console.warn(`[api:agent] Session already running for stream ${streamId}, ignoring duplicate`)
      return { error: 'Agent already running' }
    }

    const agentAbortController = new AbortController()
    activeAgents.set(streamId, agentAbortController)

    const sender = event.sender
    const workingDir = settings?.workingDirectory || app.getPath('home')

    console.log('[api:agent] Starting Claude Agent SDK session, cwd:', workingDir)

    try {
      // Dynamic import required because the SDK is pure ESM (.mjs)
      const sdkPath = require.resolve('@anthropic-ai/claude-agent-sdk')
      const sdkDir = require('path').dirname(sdkPath)
      const cliJsPath = require('path').join(sdkDir, 'cli.js')
      console.log('[api:agent] SDK cli.js path:', cliJsPath)

      // Use dynamic import() for the ESM module
      const { query } = await import('@anthropic-ai/claude-agent-sdk')


      // Permission gate is defined below

      const queryOptions: any = {
        prompt: messages[messages.length - 1]?.content || '',
        options: {
          abortController: agentAbortController,
          maxTurns: 20,
          cwd: workingDir,
          pathToClaudeCodeExecutable: cliJsPath,
          settingSources: ['project', 'local'] as const,

          // **CRITICAL FIX FOR ELECTRON TTY CRASH**
          // We MUST bypass the internal TTY permission prompt module because it crashes 
          // implicitly in the background process. 
          permissionMode: 'bypassPermissions',
          allowDangerouslySkipPermissions: true,
          includePartialMessages: true,

          // Force standard clean prompt to avoid node-pty hangs when user has zsh/starship
          env: { ...process.env, PROMPT: '$ ', PS1: '$ ' },

          // Instead of canUseTool, we hook into PreToolUse to pause and ask the UI for permission manually
          hooks: {
            PreToolUse: [
              {
                hooks: [
                  async (input: any, toolUseID: string) => {
                    const toolName = input.tool_name
                    const toolInput = input.tool_input

                    const requestId = `perm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
                    console.log('[api:agent] PreToolUse hook triggered:', toolName, requestId)

                    try {
                      sender.send('agent:permissionRequest', {
                        requestId,
                        toolName,
                        toolInput: toolInput as Record<string, string>,
                        toolUseID
                      })
                    } catch (e) {
                      console.error('[api:agent] Failed to send permissionRequest hook:', e)
                      return { async: true, hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: 'IPC Exception' }
                    }

                    const approvedPayload = await new Promise<any>((resolve) => {
                      pendingPermissions.set(requestId, { resolve })
                      setTimeout(() => {
                        if (pendingPermissions.has(requestId)) {
                          pendingPermissions.delete(requestId)
                          console.log('[api:agent] Permission request timed out:', requestId)
                          resolve({ behavior: 'deny', message: '权限请求超时' })
                        }
                      }, 5 * 60 * 1000)
                    })

                    console.log('[api:agent] Hook permission result from UI:', requestId, approvedPayload.behavior)

                    if (approvedPayload.behavior === 'allow') {
                      return { hookEventName: 'PreToolUse', permissionDecision: 'allow' }
                    } else {
                      return { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: approvedPayload.message || '用户拒绝了此操作' }
                    }
                  }
                ]
              }
            ]
          }
        },
      }

      const agentEnv: Record<string, string> = { ...process.env, PROMPT: '$ ', PS1: '$ ' }

      if (settings?.model) {
        queryOptions.options.model = settings.model
      }

      // Read API Key and Base URL from ~/.claude/settings.json because electron-store isn't readily available here
      try {
        const fsSync = require('fs')
        const configPath = path.join(app.getPath('home'), '.claude', 'settings.json')
        if (fsSync.existsSync(configPath)) {
          const configRaw = fsSync.readFileSync(configPath, 'utf-8')
          const config = JSON.parse(configRaw)
          const env = config.env || {}

          if (env.ANTHROPIC_BASE_URL) {
            agentEnv['ANTHROPIC_BASE_URL'] = env.ANTHROPIC_BASE_URL
          }
          if (env.ANTHROPIC_AUTH_TOKEN || env.ANTHROPIC_API_KEY) {
            agentEnv['ANTHROPIC_API_KEY'] = env.ANTHROPIC_AUTH_TOKEN || env.ANTHROPIC_API_KEY
          }
        }
      } catch (e) {
        console.error('[api:agent] Failed to read ~/.claude/settings.json strictly for env:', e)
      }

      queryOptions.options.env = agentEnv

      if (settings?.systemPrompt) {
        queryOptions.options.systemPrompt = settings.systemPrompt
      }

      let hasStreamedText = false

      // Stream all SDK messages
      for await (const sdkMessage of (query as any)(queryOptions)) {
        const msgType = sdkMessage.type

        if (msgType === 'stream_event') {
          const event = (sdkMessage as any).event
          if (event?.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
            hasStreamedText = true
            sender.send('agent:chunk', { streamId, type: 'text', text: event.delta.text })
          }
        } else if (msgType === 'assistant') {
          // stream_event already sent text, we only care about tool_use here
          const content = sdkMessage.message?.content || []
          for (const block of content) {
            if (block.type === 'tool_use') {
              sender.send('agent:chunk', { streamId, type: 'tool_running', toolName: block.name })
            }
          }
        } else if (msgType === 'tool_result') {
          const resultContent = sdkMessage.content
          const resultText = typeof resultContent === 'string'
            ? resultContent
            : JSON.stringify(resultContent)
          console.log('[api:agent] Tool Result for', sdkMessage.toolName, ':', resultText?.slice(0, 100))
          sender.send('agent:chunk', {
            streamId,
            type: 'tool_result',
            toolName: sdkMessage.toolName || '',
            result: resultText?.slice(0, 3000),
          })
        } else if (msgType === 'error') {
          console.error('[api:agent] SDK Error Message:', sdkMessage)
          sender.send('agent:chunk', { streamId, type: 'error', error: sdkMessage.error?.message || '未知错误' })
        } else if (msgType === 'result') {
          console.log('[api:agent] Session finished. Result payload:', sdkMessage)
          if ((sdkMessage as any).is_error) {
            console.error('[api:agent] SDK Session Error:', (sdkMessage as any).error)
            sender.send('agent:chunk', { streamId, type: 'error', error: (sdkMessage as any).error?.message || 'Agent 运行失败' })
          } else {
            const finalResultText = (sdkMessage as any).result
            if (!hasStreamedText && typeof finalResultText === 'string' && finalResultText) {
              sender.send('agent:chunk', { streamId, type: 'text', text: finalResultText })
            }
            sender.send('agent:chunk', { streamId, type: 'done' })
          }
        }
      }

      sender.send('agent:chunk', { streamId, type: 'done' })
      return { success: true }
    } catch (err: any) {
      console.error('[api:agent] Fatal error:', err)
      // 如果是用户主动取消产生的错误，则不向 UI 抛出红色异常
      if (err.name === 'AbortError' || (err.message && err.message.includes('aborted'))) {
        sender.send('agent:chunk', { streamId, type: 'done' })
        return { success: true, aborted: true }
      }
      sender.send('agent:chunk', { streamId, type: 'error', error: `Agent 错误: ${err.message}` })
      return { error: err.message }
    } finally {
      activeAgents.delete(streamId)
    }
  })

  // 保留旧的 api:fetch 作为备用
  ipcMain.handle('api:fetch', async (_, url: string, options: {
    method: string
    headers: Record<string, string>
    body: string
  }) => {
    const https = require('https')
    const http = require('http')
    const { URL } = require('url')

    return new Promise((resolve, reject) => {
      const parsed = new URL(url)
      const isHttps = parsed.protocol === 'https:'
      const lib = isHttps ? https : http

      const reqOptions = {
        hostname: parsed.hostname,
        port: parsed.port || (isHttps ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method: options.method,
        headers: {
          ...options.headers,
          'content-length': Buffer.byteLength(options.body || ''),
        },
      }

      const req = lib.request(reqOptions, (res: any) => {
        let data = ''
        res.on('data', (chunk: any) => { data += chunk })
        res.on('end', () => {
          resolve({ status: res.statusCode, body: data, headers: res.headers })
        })
      })

      req.on('error', (err: Error) => reject({ error: err.message }))

      if (options.body) req.write(options.body)
      req.end()
    })
  })

  // Scan local Skill directory
  ipcMain.handle('skill:scanLocal', async () => {
    const skillsDirs = [
      path.join(app.getPath('home'), '.claude', 'skills'),
      path.join(app.getPath('home'), '.agents', 'skills'),
    ]

    const allSkills: any[] = []

    for (const skillsDir of skillsDirs) {
      try {
        const entries = await fs.readdir(skillsDir, { withFileTypes: true })

        for (const entry of entries) {
          if (!entry.isDirectory()) continue
          const skillMdPath = path.join(skillsDir, entry.name, 'SKILL.md')
          try {
            await fs.access(skillMdPath)
            const content = await fs.readFile(skillMdPath, 'utf-8')

            let name = entry.name
            let description = ''

            // Try YAML frontmatter first (--- delimited)
            const yamlMatch = content.match(/^---\s*\n([\s\S]*?)\n---/)
            if (yamlMatch) {
              const frontmatter = yamlMatch[1]
              const nameMatch = frontmatter.match(/^name:\s*(.+)$/m)
              const descMatch = frontmatter.match(/^description:\s*(.+)$/m)
              if (nameMatch) name = nameMatch[1].trim()
              if (descMatch) description = descMatch[1].trim()
            } else {
              // Try JSON format
              try {
                const parsed = JSON.parse(content.split('\n').slice(0, 20).join('\n').match(/\{[\s\S]*\}/)?.[0] || '{}')
                if (parsed.name) name = parsed.name
                if (parsed.description) description = parsed.description
              } catch {
                // Fallback: try simple key matching
                const nameMatch = content.match(/"name"\s*:\s*"([^"]+)"/)
                const descMatch = content.match(/"description"\s*:\s*"([^"]+)"/)
                if (nameMatch) name = nameMatch[1]
                if (descMatch) description = descMatch[1]
              }
            }

            allSkills.push({
              id: entry.name,
              name,
              description,
              path: path.join(skillsDir, entry.name),
              prompt: content, // 传递真实的 SKILL.md 内容
              enabled: false,
            })
          } catch {
            // SKILL.md does not exist, skip
          }
        }
      } catch {
        // directory does not exist, skip
      }
    }

    console.log('[skill:scanLocal] Found', allSkills.length, 'skills:', allSkills.map((s: any) => s.name).join(', '))
    return allSkills
  })

  // 打开本地路径（供 Skills 打开目录使用）
  ipcMain.handle('system:openPath', async (_, targetPath: string) => {
    return shell.openPath(targetPath)
  })
}

// 应用准备就绪
app.whenReady().then(() => {
  createWindow()
  createTray()
  registerGlobalShortcuts()
  registerIpcHandlers()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    } else {
      mainWindow?.show()
    }
  })
})

// 所有窗口关闭
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// 退出前清理
app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  tray?.destroy()
  if (ptyProcess) {
    ptyProcess.kill()
  }
})
