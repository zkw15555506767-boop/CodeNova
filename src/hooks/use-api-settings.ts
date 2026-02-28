'use client'

import { useState, useEffect, useCallback } from 'react'

export type ApiProviderType = 'anthropic' | 'thirdparty' | 'claude-code'

export interface ApiSettings {
  providerType: ApiProviderType
  apiKey: string
  baseUrl: string
  defaultModel: string
  // 第三方代理额外配置
  thirdPartyName?: string
  // Claude Code 配置
  claudeCodePath?: string
  claudeCodeConfigPath?: string
}

const STORAGE_KEY = 'codenova_api_settings'

const defaultSettings: ApiSettings = {
  providerType: 'anthropic',
  apiKey: '',
  baseUrl: 'https://api.anthropic.com',
  defaultModel: 'claude-sonnet-4-20250514',
}

// 常用的第三方 API (兼容 Claude Code 格式)
export const thirdPartyProviders = [
  { id: 'custom', name: '自定义', baseUrl: '' },
  { id: 'anysphere', name: 'Anysphere', baseUrl: 'https://api.anysphere.ai' },
  { id: 'openrouter', name: 'OpenRouter', baseUrl: 'https://openrouter.ai/api' },
  { id: 'cloudflare', name: 'Cloudflare Workers AI', baseUrl: 'https://gateway.ai.cloudflare.com' },
  { id: 'together', name: 'Together AI', baseUrl: 'https://api.together.ai' },
  { id: 'azure', name: 'Azure OpenAI', baseUrl: 'https://your-resource.openai.azure.com' },
  { id: 'ollama', name: 'Ollama (本地)', baseUrl: 'http://localhost:11434' },
  // 国内大模型 (Claude Code 兼容格式)
  { id: 'minimax', name: 'MiniMax (API)', baseUrl: 'https://api.minimaxi.com/anthropic' },
  { id: 'minimax-chat', name: 'MiniMax (对话)', baseUrl: 'https://api.minimax.chat/v1' },
  { id: 'moonshot', name: '月之暗面 (Moonshot)', baseUrl: 'https://api.moonshot.cn/anthropic' },
  { id: 'zhipu', name: '智谱 AI (GLM)', baseUrl: 'https://open.bigmodel.cn/api/anthropic' },
  { id: 'feiai', name: 'Feiai (中转)', baseUrl: 'https://feiai.chat' },
  { id: 'anyrouter', name: 'AnyRouter (中转)', baseUrl: 'https://anyrouter.top' },
]

// 支持的模型列表
export const availableModels = [
  // Claude 模型
  { id: 'claude-opus-4-5-20250514', name: 'Claude Opus 4', provider: 'anthropic' },
  { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', provider: 'anthropic' },
  { id: 'claude-haiku-3-5-20250520', name: 'Claude Haiku 3', provider: 'anthropic' },
  { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', provider: 'anthropic' },
  { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', provider: 'anthropic' },
  { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', provider: 'anthropic' },
  // MiniMax 模型 (使用 /anthropic 端点时用 Claude 模型名)
  { id: 'MiniMax-M2.5', name: 'MiniMax M2.5', provider: 'minimax' },
  { id: 'MiniMax-M2', name: 'MiniMax M2', provider: 'minimax' },
  { id: 'MiniMax-M1.2', name: 'MiniMax M1.2', provider: 'minimax' },
  // Moonshot 模型
  { id: 'moonshot-v1-8k', name: 'Moonshot V1 8K', provider: 'moonshot' },
  { id: 'moonshot-v1-32k', name: 'Moonshot V1 32K', provider: 'moonshot' },
  { id: 'moonshot-v1-128k', name: 'Moonshot V1 128K', provider: 'moonshot' },
  // 智谱 GLM 模型
  { id: 'glm-4', name: 'GLM-4', provider: 'zhipu' },
  { id: 'glm-4-flash', name: 'GLM-4 Flash', provider: 'zhipu' },
  { id: 'glm-3-turbo', name: 'GLM-3 Turbo', provider: 'zhipu' },
  // 其他模型
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai' },
  { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'openai' },
  { id: 'llama-3.1-405b', name: 'Llama 3.1 405B', provider: 'meta' },
  { id: 'llama-3.1-70b', name: 'Llama 3.1 70B', provider: 'meta' },
  { id: 'mixtral-8x22b', name: 'Mixtral 8x22B', provider: 'mistral' },
]

export function useApiSettings() {
  const [settings, setSettings] = useState<ApiSettings>(defaultSettings)
  const [isLoaded, setIsLoaded] = useState(false)

  // 加载设置
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        setSettings({ ...defaultSettings, ...JSON.parse(stored) })
      } catch (e) {
        console.error('Failed to parse API settings:', e)
      }
    }
    setIsLoaded(true)
  }, [])

  // 保存设置
  const saveSettings = useCallback((newSettings: Partial<ApiSettings>) => {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
      return updated
    })
  }, [])

  const clearSettings = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setSettings(defaultSettings)
  }, [])

  // 检测本地 Claude Code
  const checkClaudeCode = useCallback(async (): Promise<{ exists: boolean; path: string | null }> => {
    if (window.electronAPI) {
      try {
        const path = await window.electronAPI.getClaudePath()
        return { exists: !!path, path }
      } catch {
        return { exists: false, path: null }
      }
    }
    return { exists: false, path: null }
  }, [])

  const loadClaudeCodeConfig = useCallback(async (): Promise<{ exists: boolean; path: string | null; env: Record<string, string> | null }> => {
    if (window.electronAPI) {
      try {
        const result = await window.electronAPI.getClaudeConfig()
        if (result?.env) {
          const env = result.env
          const apiKey = env.ANTHROPIC_AUTH_TOKEN || env.ANTHROPIC_API_KEY || ''
          const baseUrl = env.ANTHROPIC_BASE_URL || ''
          const defaultModel =
            env.ANTHROPIC_MODEL ||
            env.ANTHROPIC_DEFAULT_SONNET_MODEL ||
            env.ANTHROPIC_DEFAULT_OPUS_MODEL ||
            env.ANTHROPIC_DEFAULT_HAIKU_MODEL ||
            settings.defaultModel

          // Detect provider type: minimax or other thirdparty endpoints get 'thirdparty'
          const isThirdParty = baseUrl && !baseUrl.includes('api.anthropic.com')
          const providerType: ApiProviderType = isThirdParty ? 'thirdparty' : 'anthropic'

          saveSettings({
            providerType,
            apiKey,
            baseUrl,
            defaultModel,
            claudeCodeConfigPath: result.path || undefined,
          })
        }
        return result
      } catch {
        return { exists: false, path: null, env: null }
      }
    }
    return { exists: false, path: null, env: null }
  }, [saveSettings, settings.defaultModel])

  return {
    settings,
    saveSettings,
    clearSettings,
    checkClaudeCode,
    loadClaudeCodeConfig,
    isLoaded,
  }
}
