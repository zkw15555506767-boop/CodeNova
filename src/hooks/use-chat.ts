'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { chat, ClaudeApiError, Message as ApiMessage } from '@/lib/claude-api'
import { useApiSettings } from './use-api-settings'

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: number
  isStreaming?: boolean
  tokenCount?: number
  error?: string
  toolApprovals?: Record<string, 'pending' | 'approved' | 'rejected'>
}

export interface TokenStats {
  inputTokens: number
  outputTokens: number
  totalCost: number
}

interface Attachment {
  name: string
  path: string
  type: string
}

const MESSAGES_KEY = 'codenova_messages_'

export function useChat(conversationId: string | null) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const isStreamingRef = useRef(false)  // guards against double-fire
  const messagesRef = useRef<Message[]>(messages)  // always-current snapshot
  const [mode, setMode] = useState<'chat' | 'code' | 'plan'>('chat')
  const [model, setModel] = useState('sonnet')
  const [tokenStats, setTokenStats] = useState<TokenStats>({ inputTokens: 0, outputTokens: 0, totalCost: 0 })
  const [isApiConfigured, setIsApiConfigured] = useState(false)

  const { settings: apiSettings, isLoaded: settingsLoaded } = useApiSettings()
  const abortControllerRef = useRef<AbortController | null>(null)
  const agentStreamIdRef = useRef<string | null>(null)

  const stopGenerating = useCallback(() => {
    // 停止普通的 Chat 流
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    // 停止 Agent 会话
    if (typeof window !== 'undefined' && (window as any).electronAPI?.stopAgent && agentStreamIdRef.current) {
      ; (window as any).electronAPI.stopAgent(agentStreamIdRef.current)
      agentStreamIdRef.current = null
    }

    setMessages(prev => prev.map(msg =>
      msg.isStreaming ? { ...msg, isStreaming: false, error: 'User aborted' } : msg
    ))
    setIsStreaming(false)
    isStreamingRef.current = false
  }, [])

  // Keep the ref current on every render
  useEffect(() => { messagesRef.current = messages }, [messages])

  // 检查 API 是否配置
  useEffect(() => {
    // 在 Electron 里有 apiChat，主进程直接读配置文件，不需要检查 React state
    const electronAPI = typeof window !== 'undefined' ? (window as any).electronAPI : null
    if (electronAPI?.apiChat) {
      setIsApiConfigured(true)
      return
    }
    // 浏览器回退：检查 localStorage
    if (apiSettings.providerType === 'claude-code') {
      setIsApiConfigured(!!apiSettings.apiKey)
    } else {
      setIsApiConfigured(!!apiSettings.apiKey)
    }
  }, [apiSettings.apiKey, apiSettings.providerType])

  // 加载消息
  useEffect(() => {
    if (!conversationId) {
      setMessages([])
      return
    }

    const stored = localStorage.getItem(MESSAGES_KEY + conversationId)
    if (stored) {
      try {
        setMessages(JSON.parse(stored))
      } catch (e) {
        console.error('Failed to parse messages:', e)
      }
    } else {
      setMessages([])
    }

    return () => {
      // 切换对话时，如果有正在生成的任务，自动终止
      if (isStreamingRef.current) {
        stopGenerating()
      }
    }
  }, [conversationId, settingsLoaded, stopGenerating])

  // 保存消息
  useEffect(() => {
    if (!conversationId || messages.length === 0) return
    localStorage.setItem(MESSAGES_KEY + conversationId, JSON.stringify(messages))
  }, [conversationId, messages])

  const sendMessage = useCallback(async (attachments: Attachment[] = []) => {
    if (!input.trim() && attachments.length === 0) return

    setIsStreaming(true) // 提早设为true，防止连续点击

    // 1. 读取附件内容
    let allAttachmentsContent = ''
    if (attachments.length > 0) {
      const electronAPI = typeof window !== 'undefined' ? (window as any).electronAPI : null
      if (electronAPI?.readFile) {
        const fileReads = await Promise.all(
          attachments.map(async (acc) => {
            // 目前跳过图片类型
            if (acc.type === 'image') {
              return `[图片文件附件暂不读取源码: ${acc.name}]`
            }
            try {
              const res = await electronAPI.readText(acc.path)
              if (res.success && res.content) {
                return `<file_context path="${acc.path}">\n${res.content}\n</file_context>`
              } else {
                return `[读取文件失败: ${acc.name} - ${res.error || '未知错误'}]`
              }
            } catch (err) {
              return `[读取文件异常: ${acc.name}]`
            }
          })
        )
        allAttachmentsContent = '\n\n' + fileReads.join('\n\n')
      } else {
        // Fallback，非桌面环境无法读取文件
        allAttachmentsContent = '\n\n[附件上传: ' + attachments.map(a => a.name).join(', ') + ']'
      }
    }

    const finalContent = input.trim() + allAttachmentsContent

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: finalContent,
      createdAt: Date.now(),
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')

    if (!isApiConfigured) {
      // 显示错误消息
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '',
        createdAt: Date.now(),
        error: apiSettings.providerType === 'claude-code'
          ? '请先在设置中导入 Claude Code 配置'
          : '请先在设置中配置 API Key',
      }
      setMessages(prev => [...prev, errorMsg])
      setIsStreaming(false)
      return
    }

    // 添加空的 assistant 消息用于流式输出
    const assistantMessageId = (Date.now() + 1).toString()
    setMessages(prev => [...prev, {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      createdAt: Date.now(),
      isStreaming: true,
    }])

    try {
      abortControllerRef.current = new AbortController()

      // 转换消息格式 (提取已有消息)
      const apiMessages: ApiMessage[] = messages.map(msg => ({
        id: msg.id,
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
        timestamp: msg.createdAt,
      }))

      // 添加用户新消息 (包含附件)
      apiMessages.push({
        id: userMessage.id,
        role: 'user',
        content: userMessage.content,
        timestamp: userMessage.createdAt,
      })

      // 计算输入 token (简单估算)
      const inputTokens = Math.ceil(finalContent.length / 4)
      setTokenStats(prev => ({
        ...prev,
        inputTokens: prev.inputTokens + inputTokens,
      }))

      // 调用 API — 通过主进程直接调用（支持流式输出）
      const electronAPI = typeof window !== 'undefined' ? (window as any).electronAPI : null

      if (electronAPI?.apiChat) {
        // 注册流式 chunk 监听
        let cleanup: (() => void) | null = null
        if (electronAPI.onChatChunk) {
          cleanup = electronAPI.onChatChunk((chunk: any) => {
            if (chunk.text) {
              // 逐步更新消息内容
              setMessages(prev => prev.map(msg =>
                msg.id === assistantMessageId
                  ? { ...msg, content: chunk.full || msg.content + chunk.text }
                  : msg
              ))
            }
            if (chunk.done) {
              // 流结束 — 更新 token 统计
              setMessages(prev => prev.map(msg =>
                msg.id === assistantMessageId
                  ? { ...msg, isStreaming: false, usage: chunk.usage }
                  : msg
              ))
              if (chunk.usage) {
                const inTokens = chunk.usage.input_tokens || 0
                const outTokens = chunk.usage.output_tokens || 0
                setTokenStats(prev => ({
                  inputTokens: prev.inputTokens + inTokens,
                  outputTokens: prev.outputTokens + outTokens,
                  totalCost: prev.totalCost + (inTokens / 1000000 * 3) + (outTokens / 1000000 * 15),
                }))
              }
            }
          })
        }

        // 发起请求（流式模式下，chunk 通过事件推送）
        const result = await electronAPI.apiChat(
          apiMessages.map((m: any) => ({ role: m.role, content: m.content })),
          { stream: true }
        )

        // 清理监听器
        if (cleanup) cleanup()

        if (result.error) {
          throw new Error(result.error)
        }

        // 如果不是流式（fallback），直接设置内容
        if (!result.streamed) {
          setMessages(prev => prev.map(msg =>
            msg.id === assistantMessageId
              ? { ...msg, content: result.content || '', isStreaming: false }
              : msg
          ))
          if (result.usage) {
            const inTokens = result.usage.input_tokens || 0
            const outTokens = result.usage.output_tokens || 0
            setTokenStats(prev => ({
              inputTokens: prev.inputTokens + inTokens,
              outputTokens: prev.outputTokens + outTokens,
              totalCost: prev.totalCost + (inTokens / 1000000 * 3) + (outTokens / 1000000 * 15),
            }))
          }
        }

        // 确保 isStreaming 是 false
        setMessages(prev => prev.map(msg =>
          msg.id === assistantMessageId
            ? { ...msg, isStreaming: false }
            : msg
        ))
      } else {
        // 浏览器回退方式（非 Electron 环境）
        const modelMap: Record<string, string> = {
          opus: 'claude-opus-4-5-20250514',
          sonnet: 'claude-sonnet-4-20250514',
          haiku: 'claude-haiku-3-5-20250520',
        }

        const response = await chat(
          {
            apiKey: apiSettings.apiKey,
            baseUrl: apiSettings.baseUrl || 'https://api.anthropic.com',
            defaultModel: modelMap[model] || apiSettings.defaultModel || model,
            providerType: apiSettings.providerType === 'thirdparty' ? 'thirdparty' : 'anthropic',
          },
          {
            messages: apiMessages,
            model: modelMap[model] || apiSettings.defaultModel || model,
            maxTokens: 4096,
            temperature: 1,
          }
        )

        const assistantMessage = response.content[0]?.text || ''
        setMessages(prev => prev.map(msg =>
          msg.id === assistantMessageId
            ? { ...msg, content: assistantMessage, isStreaming: false }
            : msg
        ))

        if (response.usage) {
          const { inputTokens: inTokens, outputTokens: outTokens } = response.usage
          const inputCost = (inTokens || 0) / 1000000 * 3
          const outputCost = (outTokens || 0) / 1000000 * 15
          setTokenStats(prev => ({
            inputTokens: prev.inputTokens + (inTokens || 0),
            outputTokens: prev.outputTokens + (outTokens || 0),
            totalCost: prev.totalCost + inputCost + outputCost,
          }))
        }
      }

    } catch (error) {
      console.error('Chat error:', error)

      let errorMessage = '发送消息失败'
      if (error instanceof ClaudeApiError) {
        const status = error.status ? ` (HTTP ${error.status})` : ''
        errorMessage = `${error.message}${status}`
      }

      setMessages(prev => prev.map(msg =>
        msg.id === assistantMessageId
          ? { ...msg, content: `错误: ${errorMessage}`, isStreaming: false, error: errorMessage }
          : msg
      ))
    } finally {
      setIsStreaming(false)
      abortControllerRef.current = null
    }
  }, [input, model, messages, apiSettings, isApiConfigured])

  const clearMessages = useCallback(() => {
    setMessages([])
    setTokenStats({ inputTokens: 0, outputTokens: 0, totalCost: 0 })
    if (conversationId) {
      localStorage.removeItem(MESSAGES_KEY + conversationId)
    }
  }, [conversationId])

  const addSystemMessage = useCallback((content: string) => {
    const systemMessage: Message = {
      id: Date.now().toString(),
      role: 'assistant',
      content,
      createdAt: Date.now(),
    }
    setMessages(prev => [...prev, systemMessage])
  }, [])

  const updateToolApproval = useCallback((messageId: string, toolId: string, status: 'pending' | 'approved' | 'rejected') => {
    setMessages(prev => prev.map(msg => {
      if (msg.id === messageId) {
        return {
          ...msg,
          toolApprovals: {
            ...(msg.toolApprovals || {}),
            [toolId]: status
          }
        }
      }
      return msg
    }))
  }, [])

  const sendAgentMessage = useCallback(async (
    userContent: string,
    workingDirectory?: string,
    onPermissionRequest?: (req: { requestId: string; toolName: string; toolInput: Record<string, string>; messageId: string }) => void
  ) => {
    if (!userContent.trim()) return
    // Guard: prevent concurrent agent sessions
    if (isStreamingRef.current) {
      console.warn('[sendAgentMessage] Already streaming, ignoring duplicate call')
      return
    }
    isStreamingRef.current = true
    setIsStreaming(true)

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: userContent,
      createdAt: Date.now(),
    }
    setMessages(prev => [...prev, userMessage])
    setInput('')

    const assistantMessageId = (Date.now() + 1).toString()
    setMessages(prev => [...prev, {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      createdAt: Date.now(),
      isStreaming: true,
    }])

    const electronAPI = typeof window !== 'undefined' ? (window as any).electronAPI : null
    if (!electronAPI?.startAgent) {
      setMessages(prev => prev.map(msg =>
        msg.id === assistantMessageId
          ? { ...msg, isStreaming: false, error: 'Agent 模式需要 Electron 环境' }
          : msg
      ))
      isStreamingRef.current = false
      setIsStreaming(false)
      return
    }

    // Generate a unique stream ID for this invocation to prevent crosstalk from aborted streams
    const streamId = `agent-stream-${Date.now()}`
    agentStreamIdRef.current = streamId

    // Subscribe to agent events
    const cleanupChunk = electronAPI.onAgentChunk((chunk: any) => {
      // Discard chunks from older / aborted streams
      if (chunk.streamId && chunk.streamId !== streamId) return

      if (chunk.type === 'text') {
        setMessages(prev => prev.map(msg =>
          msg.id === assistantMessageId
            ? { ...msg, content: msg.content + chunk.text }
            : msg
        ))
      } else if (chunk.type === 'done' || chunk.type === 'error') {
        setMessages(prev => prev.map(msg =>
          msg.id === assistantMessageId
            ? { ...msg, isStreaming: false, error: chunk.type === 'error' ? chunk.error : undefined }
            : msg
        ))
        isStreamingRef.current = false
        setIsStreaming(false)
        agentStreamIdRef.current = null
        cleanupChunk()
      } else if (chunk.type === 'tool_running') {
        setMessages(prev => prev.map(msg =>
          msg.id === assistantMessageId
            ? { ...msg, content: msg.content + `\n\n> ⚙️ 正在执行: \`${chunk.toolName}\`` }
            : msg
        ))
      } else if (chunk.type === 'tool_result') {
        setMessages(prev => prev.map(msg =>
          msg.id === assistantMessageId
            ? { ...msg, content: msg.content + `\n\`\`\`\n${chunk.result?.slice(0, 2000)}\n\`\`\`` }
            : msg
        ))
      }
    })

    const cleanupPermission = electronAPI.onAgentPermissionRequest((req: any) => {
      // (Preload and Main aren't presently sending streamId for permissions, 
      // but if we ever add it we can filter here too. For now, permissions are fully sync via main lock)
      onPermissionRequest?.({ ...req, messageId: assistantMessageId })
    })

    // Build conversation history from ref (avoids stale closure)
    const historyMessages = messagesRef.current
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => ({ role: m.role, content: typeof m.content === 'string' ? m.content : '' }))
    historyMessages.push({ role: 'user', content: userContent })

    try {
      await electronAPI.startAgent(historyMessages, { workingDirectory }, streamId)
    } catch (err: any) {
      setMessages(prev => prev.map(msg =>
        msg.id === assistantMessageId
          ? { ...msg, isStreaming: false, error: err.message }
          : msg
      ))
      isStreamingRef.current = false
      setIsStreaming(false)
    } finally {
      cleanupChunk?.()
      cleanupPermission?.()
    }
  }, [])  // no deps — uses refs for live values

  return {
    messages,
    input,
    setInput,
    isStreaming,
    mode,
    setMode,
    model,
    setModel,
    tokenStats,
    isApiConfigured,
    addSystemMessage,
    sendMessage,
    stopGenerating,
    clearMessages,
    updateToolApproval,
    sendAgentMessage,
  }
}
