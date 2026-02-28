'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Square, Paperclip, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ChatMessage } from './chat-message'
import { ModeSelector } from './mode-selector'
import { ModelSelector } from './model-selector'
import { SlashCommands, parseSlashCommand } from './slash-commands'
import { useApiSettings } from '@/hooks/use-api-settings'

interface ChatProps {
  conversationId: string | null
  projectPath?: string
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: number
  isStreaming?: boolean
  tokenCount?: number
}

interface TokenStats {
  inputTokens: number
  outputTokens: number
  totalCost: number
}

const MESSAGES_STORAGE_KEY = 'codenova_messages_'

export function Chat({ conversationId, projectPath }: ChatProps) {
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [mode, setMode] = useState<'chat' | 'code' | 'plan'>('chat')
  const [model, setModel] = useState('sonnet')
  const [showSlashCommands, setShowSlashCommands] = useState(false)
  const [tokenStats, setTokenStats] = useState<TokenStats>({ inputTokens: 0, outputTokens: 0, totalCost: 0 })
  const [error, setError] = useState<string | null>(null)
  const [apiSettingsLoaded, setApiSettingsLoaded] = useState(false)

  const { settings, isLoaded: settingsLoaded } = useApiSettings()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // 加载对话消息
  useEffect(() => {
    if (conversationId && settingsLoaded) {
      setApiSettingsLoaded(true)
      const stored = localStorage.getItem(MESSAGES_STORAGE_KEY + conversationId)
      if (stored) {
        try {
          setMessages(JSON.parse(stored))
        } catch (e) {
          console.error('Failed to parse messages:', e)
        }
      } else {
        setMessages([])
      }
    }
  }, [conversationId, settingsLoaded])

  // 保存对话消息
  useEffect(() => {
    if (conversationId && messages.length > 0) {
      localStorage.setItem(MESSAGES_STORAGE_KEY + conversationId, JSON.stringify(messages))
    }
  }, [conversationId, messages])

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // 自动调整输入框高度
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px'
    }
  }, [input])

  // 处理斜杠命令检测
  useEffect(() => {
    // 检测是否输入了斜杠命令
    const match = input.match(/(^|\s)\/(\S*)$/)
    if (match) {
      setShowSlashCommands(true)
    } else if (showSlashCommands && !input.includes('/')) {
      setShowSlashCommands(false)
    }
  }, [input, showSlashCommands])

  const handleSend = async () => {
    if (!input.trim() || isStreaming) return

    // 检查 API 配置
    if (!settings.apiKey && settings.providerType !== 'claude-code') {
      setError('请先在设置中配置 API Key')
      return
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      createdAt: Date.now(),
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsStreaming(true)
    setError(null)

    // 添加空的 assistant 消息用于流式输出
    const assistantMessageId = (Date.now() + 1).toString()
    setMessages(prev => [...prev, {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      createdAt: Date.now(),
      isStreaming: true,
    }])

    // 调用 API
    await callApi(assistantMessageId, [...messages, userMessage])
  }

  const callApi = async (assistantMessageId: string, allMessages: Message[]) => {
    abortControllerRef.current = new AbortController()

    try {
      // 构建消息格式
      const apiMessages = allMessages.map(msg => ({
        role: msg.role,
        content: msg.content
      }))

      // 根据 provider type 构建请求
      let url = ''
      let headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }

      if (settings.providerType === 'anthropic') {
        url = `${settings.baseUrl}/v1/messages`
        headers['x-api-key'] = settings.apiKey
        headers['anthropic-version'] = '2023-06-01'
      } else if (settings.providerType === 'thirdparty') {
        url = `${settings.baseUrl}/v1/messages`
        headers['Authorization'] = `Bearer ${settings.apiKey}`
      } else if (settings.providerType === 'claude-code') {
        // Claude Code 模式 - 使用本地 API
        url = '/api/chat'
      }

      const requestBody = {
        model: settings.defaultModel,
        messages: apiMessages,
        max_tokens: 4096,
        stream: true,
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
        signal: abortControllerRef.current.signal,
      })

      if (!response.ok) {
        const errorData = await response.text()
        throw new Error(`API 请求失败: ${response.status} - ${errorData}`)
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('无法读取响应')
      }

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') continue

            try {
              const parsed = JSON.parse(data)
              if (parsed.type === 'content_block_delta') {
                const text = parsed.delta?.text || ''
                setMessages(prev => prev.map(msg =>
                  msg.id === assistantMessageId
                    ? { ...msg, content: (msg.content || '') + text }
                    : msg
                ))
              } else if (parsed.type === 'message_delta') {
                if (parsed.usage) {
                  setTokenStats(prev => ({
                    ...prev,
                    outputTokens: (prev.outputTokens || 0) + (parsed.usage.output_tokens || 0)
                  }))
                }
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      }

      // 流式结束
      setMessages(prev => prev.map(msg =>
        msg.id === assistantMessageId ? { ...msg, isStreaming: false } : msg
      ))
      setIsStreaming(false)

    } catch (err: any) {
      if (err.name === 'AbortError') {
        // 用户取消了请求
        setMessages(prev => prev.map(msg =>
          msg.id === assistantMessageId ? { ...msg, isStreaming: false } : msg
        ))
      } else {
        setError(err.message || '请求失败')
        setMessages(prev => prev.map(msg =>
          msg.id === assistantMessageId
            ? { ...msg, content: '抱歉，发生了错误：' + (err.message || '未知错误'), isStreaming: false }
            : msg
        ))
      }
      setIsStreaming(false)
    }
  }

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    setMessages(prev => prev.map(msg =>
      msg.isStreaming ? { ...msg, isStreaming: false } : msg
    ))
    setIsStreaming(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showSlashCommands) {
      if (e.key === 'Escape') {
        setShowSlashCommands(false)
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        return
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // 处理斜杠命令
  const handleSlashCommand = (command: string) => {
    switch (command) {
      case 'help':
        setInput('')
        addSystemMessage(`## 可用命令

- /help - 查看帮助
- /clear - 清除对话
- /cost - 查看 Token 消耗
- /compact - 压缩上下文
- /doctor - 诊断状态
- /review - 代码审查
- /new - 新建对话
- /project - 项目信息`)
        break
      case 'clear':
        setMessages([])
        setTokenStats({ inputTokens: 0, outputTokens: 0, totalCost: 0 })
        if (conversationId) {
          localStorage.removeItem(MESSAGES_STORAGE_KEY + conversationId)
        }
        break
      case 'cost':
        setInput('')
        addSystemMessage(`## Token 消耗统计

- 输入: ${tokenStats.inputTokens} tokens
- 输出: ${tokenStats.outputTokens} tokens
- 预估费用: $${tokenStats.totalCost.toFixed(4)}`)
        break
      case 'compact':
        setInput('')
        addSystemMessage('上下文已压缩')
        break
      case 'doctor':
        setInput('')
        addSystemMessage(`## 诊断信息

- API 提供商: ${settings.providerType}
- 模型: ${settings.defaultModel}
- 模式: ${mode}
- 项目路径: ${projectPath || '未选择'}`)
        break
      case 'review':
        setInput('')
        addSystemMessage('请选择要审查的代码文件')
        break
      case 'new':
        setMessages([])
        setTokenStats({ inputTokens: 0, outputTokens: 0, totalCost: 0 })
        if (conversationId) {
          localStorage.removeItem(MESSAGES_STORAGE_KEY + conversationId)
        }
        break
      case 'project':
        setInput('')
        addSystemMessage(`## 项目信息

项目路径: ${projectPath || '请在左侧面板选择项目目录'}`)
        break
      default:
        setInput('')
    }
    setShowSlashCommands(false)
  }

  const addSystemMessage = (content: string) => {
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: 'assistant',
      content,
      createdAt: Date.now(),
    }])
  }

  const handleFileSelect = async () => {
    const filePath = await window.electronAPI?.selectFile([
      { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] },
      { name: 'Documents', extensions: ['pdf', 'md', 'txt'] },
      { name: 'All Files', extensions: ['*'] },
    ])
    if (filePath) {
      setInput(prev => prev + `\n[文件: ${filePath}]`)
    }
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-background">
      {/* 错误提示 */}
      {error && (
        <div className="mx-4 mt-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="w-4 h-4" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto hover:text-destructive/80">
            ×
          </button>
        </div>
      )}

      {/* 顶部模式选择器 */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <ModeSelector mode={mode} onModeChange={setMode} />
        <ModelSelector model={model} onModelChange={setModel} />
      </div>

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <span className="text-3xl">✨</span>
            </div>
            <h2 className="text-xl font-semibold mb-2">你好，我是 CodeNova</h2>
            <p className="text-muted-foreground max-w-md">
              一个强大的桌面端 AI 编程助手，可以帮助你编写代码、分析项目、解决问题。
            </p>
            {!settings.apiKey && settings.providerType !== 'claude-code' && (
              <p className="text-sm text-amber-600 mt-4">
                请先在设置中配置 API Key
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* 输入区域 */}
      <div className="p-4 border-t border-border">
        {/* 斜杠命令面板 */}
        <SlashCommands
          isOpen={showSlashCommands}
          onClose={() => setShowSlashCommands(false)}
          onSelect={handleSlashCommand}
          inputValue={input}
        />

        <div className="relative flex items-end gap-2 p-2 rounded-xl border border-input bg-background focus-within:ring-2 focus-within:ring-ring">
          {/* 附件按钮 */}
          <button
            onClick={handleFileSelect}
            className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
            title="添加文件"
          >
            <Paperclip className="w-5 h-5" />
          </button>

          {/* 文本输入 */}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入消息... (Shift+Enter 换行, / 打开命令)"
            className="flex-1 max-h-[200px] resize-none bg-transparent outline-none text-sm min-h-[40px]"
            disabled={isStreaming}
          />

          {/* 发送/停止按钮 */}
          {isStreaming ? (
            <button
              onClick={handleStop}
              className="p-2 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
              title="停止生成"
            >
              <Square className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className={cn(
                "p-2 rounded-lg transition-colors",
                input.trim()
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "bg-muted text-muted-foreground"
              )}
              title="发送"
            >
              <Send className="w-5 h-5" />
            </button>
          )}
        </div>

        <p className="text-xs text-muted-foreground text-center mt-2">
          CodeNova 可能会产生错误信息，请核实重要内容。
        </p>
      </div>
    </div>
  )
}
