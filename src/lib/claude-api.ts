'use client'

import { ApiSettings, ApiProviderType } from '@/hooks/use-api-settings'

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
}

export interface ChatOptions {
  messages: Message[]
  model?: string
  maxTokens?: number
  temperature?: number
  onChunk?: (chunk: string) => void
}

export interface Usage {
  inputTokens: number
  outputTokens: number
  cacheReadTokens?: number
  cacheCreationTokens?: number
}

export interface ChatResponse {
  id: string
  type: string
  role: string
  content: Array<{
    type: string
    text: string
  }>
  model: string
  stopReason: string
  usage: Usage
}

export class ClaudeApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public type?: string
  ) {
    super(message)
    this.name = 'ClaudeApiError'
  }
}

interface ChatSettings {
  apiKey: string
  baseUrl: string
  defaultModel: string
  providerType?: ApiProviderType
}

// 判断 API 提供商类型
function getProviderType(model: string, baseUrl: string): ApiProviderType {
  if (baseUrl.includes('minimax')) return 'thirdparty'
  if (model.startsWith('claude-')) return 'anthropic'
  return 'thirdparty'
}

// 构建请求头
function buildHeaders(apiKey: string, providerType: ApiProviderType, baseUrl: string, isAnthropicCompatible: boolean): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (providerType === 'anthropic' || isAnthropicCompatible) {
    headers['x-api-key'] = apiKey
    headers['anthropic-version'] = '2023-06-01'
  } else if (providerType === 'thirdparty' && baseUrl.includes('minimax') && baseUrl.includes('/anthropic')) {
    // MiniMax Anthropic 兼容端点 - 使用 x-api-key
    headers['x-api-key'] = apiKey
    headers['anthropic-version'] = '2023-06-01'
  } else if (providerType === 'thirdparty' && baseUrl.includes('minimax')) {
    // MiniMax 非兼容端点使用 Bearer token
    headers['Authorization'] = `Bearer ${apiKey}`
  } else {
    // 其他第三方 API 通常使用 Bearer token
    headers['Authorization'] = `Bearer ${apiKey}`
  }

  return headers
}

// 简化的消息格式
interface SimpleMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

// 构建请求体
function buildRequestBody(model: string, messages: SimpleMessage[], options: ChatOptions, providerType: ApiProviderType): Record<string, unknown> {
  const baseBody = {
    model,
    messages: messages.map(msg => ({
      role: msg.role === 'assistant' ? 'assistant' : msg.role,
      content: msg.content,
    })),
    max_tokens: options.maxTokens || 4096,
    temperature: options.temperature ?? 1,
    stream: false, // Always non-streaming — IPC proxy can't handle SSE
  }

  // MiniMax 特定的请求格式
  if (providerType === 'thirdparty' && model.includes('MiniMax')) {
    return {
      model,
      messages: messages.map(msg => ({
        role: msg.role === 'assistant' ? 'assistant' : msg.role,
        content: msg.content,
      })),
      max_tokens: options.maxTokens || 4096,
      temperature: options.temperature ?? 0.7,
      stream: false, // Always non-streaming — IPC proxy can't handle SSE
    }
  }

  return baseBody
}

// 获取 API 端点
function getEndpoint(baseUrl: string, providerType: ApiProviderType, model: string): string {
  if (providerType === 'anthropic') {
    return `${baseUrl}/v1/messages`
  }

  // MiniMax - 使用 Anthropic 兼容端点
  if (baseUrl.includes('minimax') && baseUrl.includes('/anthropic')) {
    return `${baseUrl}/v1/messages`
  }

  // MiniMax 非兼容端点
  if (baseUrl.includes('minimax')) {
    return `${baseUrl}/v1/chat/completions`
  }

  // 其他第三方
  return `${baseUrl}/v1/chat/completions`
}

export async function chat(settings: ChatSettings, chatOptions: ChatOptions): Promise<ChatResponse> {
  const { apiKey, baseUrl, defaultModel, providerType: explicitProviderType } = settings
  const model = chatOptions.model || defaultModel || 'claude-sonnet-4-20250514'

  if (!apiKey) {
    throw new ClaudeApiError('API key is required')
  }

  if (!baseUrl) {
    throw new ClaudeApiError('Base URL is not configured. Please check your API settings.')
  }

  console.log('[claude-api] chat() called:', { model, baseUrl, providerType: explicitProviderType, apiKeyPresent: !!apiKey })

  const providerType = explicitProviderType || getProviderType(model, baseUrl)
  const isAnthropicCompatible =
    providerType === 'anthropic' ||
    baseUrl.includes('/anthropic') ||
    baseUrl.includes('api.anthropic.com')

  const messages: SimpleMessage[] = chatOptions.messages.map(msg => ({
    role: msg.role,
    content: msg.content,
  }))

  const requestBody = buildRequestBody(model, messages, chatOptions, providerType)
  const endpoint = getEndpoint(baseUrl, providerType, model)
  const headers = buildHeaders(apiKey, providerType, baseUrl, isAnthropicCompatible)

  // 流式处理
  if (chatOptions.onChunk) {
    return chatStream({ apiKey, baseUrl, defaultModel: model, providerType }, endpoint, headers, requestBody, chatOptions.onChunk)
  }

  // IPC proxy for non-streaming path too
  const electronAPI = typeof window !== 'undefined' ? (window as any).electronAPI : null
  if (electronAPI?.apiFetch) {
    const result = await electronAPI.apiFetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    })

    if (result.status < 200 || result.status >= 300) {
      let errData: any = {}
      try { errData = JSON.parse(result.body) } catch { }
      throw new ClaudeApiError(
        errData.error?.message || errData.message || `API request failed: ${result.status}`,
        result.status,
        errData.error?.type
      )
    }

    const data = JSON.parse(result.body)
    if (isAnthropicCompatible) {
      return {
        id: data.id || 'proxy',
        type: 'message',
        role: 'assistant',
        model: data.model || model,
        stopReason: data.stop_reason || 'end_turn',
        content: data.content || [{ type: 'text', text: '' }],
        usage: { inputTokens: data.usage?.input_tokens || 0, outputTokens: data.usage?.output_tokens || 0 },
      }
    } else {
      return formatResponse(data, model, providerType, isAnthropicCompatible)
    }
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(requestBody),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new ClaudeApiError(
      error.error?.message || error.message || `API request failed: ${response.status}`,
      response.status,
      error.error?.type
    )
  }

  const data = await response.json()

  // 统一响应格式
  return formatResponse(data, model, providerType, isAnthropicCompatible)
}

// 格式化响应
function formatResponse(data: any, model: string, providerType: ApiProviderType, isAnthropicCompatible: boolean): ChatResponse {
  if (providerType === 'anthropic' || isAnthropicCompatible) {
    return {
      id: data.id,
      type: data.type,
      role: data.role,
      content: data.content,
      model: data.model,
      stopReason: data.stop_reason,
      usage: {
        inputTokens: data.usage?.input_tokens || 0,
        outputTokens: data.usage?.output_tokens || 0,
      },
    }
  }

  // MiniMax / OpenAI 格式
  const choice = data.choices?.[0]
  return {
    id: data.id || `msg_${Date.now()}`,
    type: 'message',
    role: choice?.role || 'assistant',
    content: [{ type: 'text', text: choice?.message?.content || '' }],
    model: data.model || model,
    stopReason: choice?.finish_reason || 'stop',
    usage: {
      inputTokens: data.usage?.prompt_tokens || 0,
      outputTokens: data.usage?.completion_tokens || 0,
    },
  }
}

async function chatStream(
  settings: ChatSettings,
  endpoint: string,
  headers: Record<string, string>,
  requestBody: Record<string, unknown>,
  onChunk: (chunk: string) => void
): Promise<ChatResponse> {
  const { baseUrl, defaultModel, providerType = 'anthropic' } = settings
  const model = requestBody.model as string || defaultModel
  const isAnthropicCompatible =
    providerType === 'anthropic' ||
    baseUrl.includes('/anthropic') ||
    baseUrl.includes('api.anthropic.com')

  // 优先使用 Electron IPC 代理（彻底绕开 CORS），降级到普通 fetch
  const electronAPI = typeof window !== 'undefined' ? (window as any).electronAPI : null

  let response: Response
  if (electronAPI?.apiFetch) {
    const result = await electronAPI.apiFetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    })

    if (result.status < 200 || result.status >= 300) {
      let errData: any = {}
      try { errData = JSON.parse(result.body) } catch { }
      throw new ClaudeApiError(
        errData.error?.message || errData.message || `API request failed: ${result.status}`,
        result.status,
        errData.error?.type
      )
    }

    // IPC proxy 会返回完整响应体（非流式），直接解析
    const data = JSON.parse(result.body)
    const isAnthropicCompat = isAnthropicCompatible
    if (isAnthropicCompat) {
      const content = data.content?.[0]?.text || ''
      onChunk(content)
      return {
        id: data.id || 'ipc-proxy',
        type: 'message',
        role: 'assistant',
        model: data.model || (requestBody.model as string) || '',
        stopReason: data.stop_reason || 'end_turn',
        content: [{ type: 'text', text: content }],
        usage: { inputTokens: data.usage?.input_tokens || 0, outputTokens: data.usage?.output_tokens || 0 },
      }
    } else {
      const content = data.choices?.[0]?.message?.content || ''
      onChunk(content)
      return {
        id: data.id || 'ipc-proxy',
        type: 'message',
        role: 'assistant',
        model: data.model || (requestBody.model as string) || '',
        stopReason: data.choices?.[0]?.finish_reason || 'end_turn',
        content: [{ type: 'text', text: content }],
        usage: { inputTokens: data.usage?.prompt_tokens || 0, outputTokens: data.usage?.completion_tokens || 0 },
      }
    }

  }

  response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(requestBody),
  })


  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new ClaudeApiError(
      error.error?.message || error.message || `API request failed: ${response.status}`,
      response.status,
      error.error?.type
    )
  }

  if (!response.body) {
    throw new ClaudeApiError('No response body')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let fullContent = ''
  let usage: Usage = { inputTokens: 0, outputTokens: 0 }

  try {
    // Anthropic 兼容流
    if (isAnthropicCompatible) {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') continue

            try {
              const parsed = JSON.parse(data)
              if (parsed.type === 'content_block_delta') {
                const text = parsed.delta?.text || ''
                fullContent += text
                onChunk(text)
              } else if (parsed.type === 'message_delta') {
                usage = parsed.usage || usage
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      }
    } else if (baseUrl.includes('minimax')) {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]' || data === 'null') continue

            try {
              const parsed = JSON.parse(data)
              const content = parsed.choices?.[0]?.delta?.content || parsed.choices?.[0]?.message?.content || ''
              if (content) {
                fullContent += content
                onChunk(content)
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      }
    } else {
      // OpenAI 兼容流
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') continue

            try {
              const parsed = JSON.parse(data)
              const content = parsed.choices?.[0]?.delta?.content || parsed.choices?.[0]?.message?.content || ''
              if (content) {
                fullContent += content
                onChunk(content)
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      }
    }
  } finally {
    reader.releaseLock()
  }

  return {
    id: `msg_${Date.now()}`,
    type: 'message',
    role: 'assistant',
    content: [{ type: 'text', text: fullContent }],
    model,
    stopReason: 'end_turn',
    usage,
  }
}

// 可用模型列表
export const availableModels = [
  { id: 'claude-opus-4-5-20250514', name: 'Claude Opus 4', description: '最强大模型' },
  { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', description: '平衡性能与速度' },
  { id: 'claude-haiku-3-5-20250520', name: 'Claude Haiku 3', description: '快速响应' },
  { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', description: '稳定版本' },
  { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', description: '高性能' },
  { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', description: '快速便宜' },
]
