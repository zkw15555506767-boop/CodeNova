'use client'

import { useState, useEffect } from 'react'
import { X, User, Palette, Key, Globe, Terminal, Info, Plus, Trash2, Play, Pause, Check, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useMCPServers, MCPServer } from '@/hooks/use-mcp-servers'
import { useSkills, Skill } from '@/hooks/use-skills'
import { useApiSettings, thirdPartyProviders, availableModels, ApiProviderType } from '@/hooks/use-api-settings'

interface SettingsPanelProps {
  isOpen: boolean
  onClose: () => void
}

type Tab = 'appearance' | 'api' | 'shortcuts' | 'mcp' | 'skills' | 'about'

export function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>('appearance')

  if (!isOpen) return null

  const tabs = [
    { id: 'appearance', label: '外观', icon: Palette },
    { id: 'api', label: 'API', icon: Key },
    { id: 'shortcuts', label: '快捷键', icon: Terminal },
    { id: 'mcp', label: 'MCP', icon: Globe },
    { id: 'skills', label: '技能', icon: Terminal },
    { id: 'about', label: '关于', icon: Info },
  ] as const

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      {/* 遮罩层 */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* 设置面板 */}
      <div className="relative w-[900px] h-[650px] bg-background rounded-xl shadow-2xl flex overflow-hidden">
        {/* 左侧标签 */}
        <div className="w-48 bg-muted/30 border-r border-border p-2">
          <div className="flex items-center justify-between px-2 py-2 mb-2">
            <span className="font-semibold">设置</span>
            <button onClick={onClose} className="p-1 rounded hover:bg-muted">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-1">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors",
                    activeTab === tab.id
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-muted text-muted-foreground"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* 右侧内容 */}
        <div className="flex-1 p-6 overflow-y-auto">
          {activeTab === 'appearance' && <AppearanceSettings />}
          {activeTab === 'api' && <APISettings />}
          {activeTab === 'shortcuts' && <ShortcutsSettings />}
          {activeTab === 'mcp' && <MCPSettings />}
          {activeTab === 'skills' && <SkillsSettings />}
          {activeTab === 'about' && <AboutSettings />}
          {/* account tab removed */}
        </div>
      </div>
    </div>
  )
}

function AppearanceSettings() {
  const [theme, setTheme] = useState('light')
  const [fontSize, setFontSize] = useState('14')
  const [codeFont, setCodeFont] = useState('JetBrains Mono')

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-4">外观设置</h2>
      </div>

      {/* 主题 */}
      <div className="space-y-3">
        <label className="text-sm font-medium">主题</label>
        <div className="flex gap-3">
          {[
            { value: 'light', label: '浅色', bg: 'bg-white', border: 'border-gray-200' },
            { value: 'dark', label: '深色', bg: 'bg-gray-900', border: 'border-gray-700' },
            { value: 'gradient', label: '渐变', bg: 'bg-gradient-to-br from-purple-500 to-pink-500', border: 'border-transparent' },
          ].map((t) => (
            <button
              key={t.value}
              onClick={() => setTheme(t.value)}
              className={cn(
                "w-24 h-16 rounded-lg border-2 flex items-center justify-center text-sm font-medium transition-all",
                t.bg,
                t.border,
                theme === t.value ? "ring-2 ring-primary" : "",
                t.value === 'light' ? "text-gray-900" : "text-white"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* 字体大小 */}
      <div className="space-y-3">
        <label className="text-sm font-medium">字体大小</label>
        <select
          value={fontSize}
          onChange={(e) => setFontSize(e.target.value)}
          className="w-full p-2 rounded-lg border border-border bg-background"
        >
          <option value="12">12px</option>
          <option value="14">14px</option>
          <option value="16">16px</option>
          <option value="18">18px</option>
        </select>
      </div>

      {/* 代码字体 */}
      <div className="space-y-3">
        <label className="text-sm font-medium">代码字体</label>
        <select
          value={codeFont}
          onChange={(e) => setCodeFont(e.target.value)}
          className="w-full p-2 rounded-lg border border-border bg-background"
        >
          <option value="JetBrains Mono">JetBrains Mono</option>
          <option value="Fira Code">Fira Code</option>
          <option value="Monaco">Monaco</option>
          <option value="SF Mono">SF Mono</option>
        </select>
      </div>
    </div>
  )
}

function APISettings() {
  const { settings, saveSettings, checkClaudeCode, loadClaudeCodeConfig, isLoaded } = useApiSettings()
  const [saved, setSaved] = useState(false)
  const [checkingClaudeCode, setCheckingClaudeCode] = useState(false)
  const [claudeCodeStatus, setClaudeCodeStatus] = useState<{ exists: boolean; path: string | null }>({ exists: false, path: null })
  const [claudeConfigStatus, setClaudeConfigStatus] = useState<{ exists: boolean; path: string | null }>({ exists: false, path: null })

  // 自动尝试读取本地配置
  useEffect(() => {
    if (!isLoaded) return
    if (settings.providerType === 'claude-code' && !settings.apiKey) {
      loadClaudeCodeConfig().then((result) => {
        setClaudeConfigStatus({ exists: result.exists, path: result.path })
      }).catch(() => {
        setClaudeConfigStatus({ exists: false, path: null })
      })
    }
  }, [settings.providerType, settings.apiKey, loadClaudeCodeConfig, isLoaded])

  if (!isLoaded) return null

  const handleSave = () => {
    saveSettings({
      providerType: settings.providerType,
      apiKey: settings.apiKey,
      baseUrl: settings.baseUrl,
      defaultModel: settings.defaultModel,
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleProviderChange = (type: ApiProviderType) => {
    const defaults = {
      anthropic: { baseUrl: 'https://api.anthropic.com', defaultModel: 'claude-sonnet-4-20250514' },
      thirdparty: { baseUrl: '', defaultModel: 'claude-sonnet-4-20250514' },
      'claude-code': { baseUrl: '', defaultModel: 'claude-sonnet-4-20250514' },
    }
    saveSettings({
      providerType: type,
      ...defaults[type],
    })
  }

  const handleCheckClaudeCode = async () => {
    setCheckingClaudeCode(true)
    try {
      const result = await checkClaudeCode()
      setClaudeCodeStatus(result)
      if (result.exists) {
        saveSettings({ claudeCodePath: result.path || undefined })
      }
      const configResult = await loadClaudeCodeConfig()
      setClaudeConfigStatus({ exists: configResult.exists, path: configResult.path })
    } catch (error) {
      console.error('Failed to check Claude Code:', error)
      setClaudeCodeStatus({ exists: false, path: null })
      setClaudeConfigStatus({ exists: false, path: null })
    } finally {
      setCheckingClaudeCode(false)
    }
  }

  const providerTypes = [
    { id: 'anthropic', label: '官方 Anthropic API', icon: Key },
    { id: 'thirdparty', label: '第三方代理 API', icon: Globe },
    { id: 'claude-code', label: 'Claude Code (本地)', icon: Terminal },
  ] as const

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-4">API 设置</h2>
      </div>

      {/* API 提供商类型 */}
      <div className="space-y-3">
        <label className="text-sm font-medium">API 来源</label>
        <div className="grid grid-cols-3 gap-2">
          {providerTypes.map((type) => {
            const Icon = type.icon
            return (
              <button
                key={type.id}
                onClick={() => handleProviderChange(type.id)}
                className={cn(
                  "flex flex-col items-center gap-2 p-3 rounded-lg border transition-colors",
                  settings.providerType === type.id
                    ? "border-primary bg-primary/10"
                    : "border-border hover:bg-muted"
                )}
              >
                <Icon className={cn(
                  "w-5 h-5",
                  settings.providerType === type.id ? "text-primary" : "text-muted-foreground"
                )} />
                <span className={cn(
                  "text-xs",
                  settings.providerType === type.id ? "text-primary font-medium" : "text-muted-foreground"
                )}>{type.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Claude Code 特殊处理 */}
      {settings.providerType === 'claude-code' && (
        <div className="p-4 rounded-lg border border-border bg-muted/30 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">连接本地 Claude Code</p>
              <p className="text-xs text-muted-foreground">使用已安装的 Claude Code CLI 配置</p>
            </div>
            <button
              onClick={handleCheckClaudeCode}
              disabled={checkingClaudeCode}
              className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm flex items-center gap-2"
            >
              {checkingClaudeCode && <Loader2 className="w-3 h-3 animate-spin" />}
              {claudeCodeStatus.exists ? '重新检测' : '检测 Claude Code'}
            </button>
          </div>
          {claudeCodeStatus.exists && (
            <div className="flex items-center gap-2 text-xs text-green-600">
              <Check className="w-3 h-3" />
              <span>已找到: {claudeCodeStatus.path}</span>
            </div>
          )}
          {claudeConfigStatus.exists && (
            <div className="flex items-center gap-2 text-xs text-green-600">
              <Check className="w-3 h-3" />
              <span>已导入配置: {claudeConfigStatus.path}</span>
            </div>
          )}
          {!claudeCodeStatus.exists && !checkingClaudeCode && (
            <p className="text-xs text-muted-foreground">
              请确保已安装 Claude Code: npm install -g @anthropic-ai/claude-code
            </p>
          )}
        </div>
      )}

      {/* 第三方代理 */}
      {settings.providerType === 'thirdparty' && (
        <div className="space-y-4">
          <div className="space-y-3">
            <label className="text-sm font-medium">第三方服务商模板</label>
            <select
              value={settings.thirdPartyName || 'custom'}
              onChange={(e) => {
                const provider = thirdPartyProviders.find(p => p.id === e.target.value)
                saveSettings({
                  thirdPartyName: e.target.value,
                  baseUrl: provider?.baseUrl || '',
                })
              }}
              className="w-full p-2 rounded-lg border border-border bg-background"
            >
              {thirdPartyProviders.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
              <option value="custom">自定义 (Custom)</option>
            </select>
          </div>

          <div className="space-y-3">
            <label className="text-sm font-medium">自定义 Base URL</label>
            <input
              type="text"
              value={settings.baseUrl}
              onChange={(e) => saveSettings({ baseUrl: e.target.value })}
              placeholder="https://api.minimax.chat/v1"
              className="w-full p-2 rounded-lg border border-border bg-background"
            />
          </div>

          <div className="space-y-3">
            <label className="text-sm font-medium">第三方 API Key</label>
            <input
              type="password"
              value={settings.apiKey}
              onChange={(e) => saveSettings({ apiKey: e.target.value })}
              placeholder="sk-..."
              className="w-full p-2 rounded-lg border border-border bg-background"
            />
          </div>
        </div>
      )}

      {/* API 地址 - 官方模式下显示 */}
      {settings.providerType === 'anthropic' && (
        <div className="space-y-3">
          <label className="text-sm font-medium">API 地址</label>
          <input
            type="text"
            value={settings.baseUrl}
            onChange={(e) => saveSettings({ baseUrl: e.target.value })}
            placeholder="https://api.anthropic.com"
            className="w-full p-2 rounded-lg border border-border bg-background"
          />
          <p className="text-xs text-muted-foreground">官方 API 地址</p>
        </div>
      )}

      {/* API Key - 官方模式下显示 */}
      {settings.providerType === 'anthropic' && (
        <div className="space-y-3">
          <label className="text-sm font-medium">Anthropic API Key</label>
          <input
            type="password"
            value={settings.apiKey}
            onChange={(e) => saveSettings({ apiKey: e.target.value })}
            placeholder="sk-ant-..."
            className="w-full p-2 rounded-lg border border-border bg-background"
          />
        </div>
      )}

      {/* 模型选择 */}
      <div className="space-y-3">
        <label className="text-sm font-medium">默认模型</label>
        <select
          value={settings.defaultModel}
          onChange={(e) => saveSettings({ defaultModel: e.target.value })}
          className="w-full p-2 rounded-lg border border-border bg-background"
        >
          {availableModels.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
      </div>

      <button
        onClick={handleSave}
        className="px-4 py-2 bg-primary text-primary-foreground rounded-lg"
      >
        {saved ? '已保存 ✓' : '保存设置'}
      </button>
    </div>
  )
}

function ShortcutsSettings() {
  const shortcuts = [
    { action: '新建对话', keys: '⌘ + N' },
    { action: '快速命令', keys: '⌘ + K' },
    { action: "停止生成", keys: '⌘ + .' },
    { action: '清除对话', keys: '⌘ + L' },
    { action: '设置', keys: '⌘ + ,' },
    { action: '切换面板', keys: '⌘ + B' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-4">快捷键设置</h2>
      </div>

      <div className="space-y-2">
        {shortcuts.map((s) => (
          <div key={s.action} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
            <span>{s.action}</span>
            <kbd className="px-2 py-1 bg-background rounded border text-sm font-mono">
              {s.keys}
            </kbd>
          </div>
        ))}
      </div>
    </div>
  )
}

function MCPSettings() {
  const { servers, addServer, deleteServer, toggleServer } = useMCPServers()
  const [showAdd, setShowAdd] = useState(false)
  const [newServer, setNewServer] = useState<Partial<MCPServer>>({
    name: '',
    type: 'stdio',
    command: '',
    enabled: true,
  })

  const handleAdd = () => {
    if (newServer.name && newServer.type) {
      addServer(newServer as Omit<MCPServer, 'id'>)
      setNewServer({ name: '', type: 'stdio', command: '', enabled: true })
      setShowAdd(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">MCP 服务器</h2>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm"
        >
          {showAdd ? '取消' : '+ 添加服务器'}
        </button>
      </div>

      {/* 添加表单 */}
      {showAdd && (
        <div className="p-4 rounded-lg border border-border bg-muted/30 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              value={newServer.name || ''}
              onChange={(e) => setNewServer({ ...newServer, name: e.target.value })}
              placeholder="服务器名称"
              className="p-2 rounded-lg border border-border bg-background"
            />
            <select
              value={newServer.type}
              onChange={(e) => setNewServer({ ...newServer, type: e.target.value as any })}
              className="p-2 rounded-lg border border-border bg-background"
            >
              <option value="stdio">stdio</option>
              <option value="sse">SSE</option>
              <option value="http">HTTP</option>
            </select>
          </div>
          {newServer.type === 'stdio' && (
            <input
              type="text"
              value={newServer.command || ''}
              onChange={(e) => setNewServer({ ...newServer, command: e.target.value })}
              placeholder="命令 (如 npx)"
              className="w-full p-2 rounded-lg border border-border bg-background"
            />
          )}
          {(newServer.type === 'sse' || newServer.type === 'http') && (
            <input
              type="text"
              value={newServer.url || ''}
              onChange={(e) => setNewServer({ ...newServer, url: e.target.value })}
              placeholder="服务器 URL"
              className="w-full p-2 rounded-lg border border-border bg-background"
            />
          )}
          <button onClick={handleAdd} className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-lg">
            添加
          </button>
        </div>
      )}

      {/* 服务器列表 */}
      <div className="space-y-3">
        {servers.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            暂无 MCP 服务器
          </div>
        ) : (
          servers.map((server) => (
            <div key={server.id} className="p-4 rounded-lg border border-border">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{server.name}</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-muted">{server.type}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleServer(server.id)}
                    className={cn(
                      "5 rounded",
                      server.enabled ? "text-greenp-1.-500" : "text-muted-foreground"
                    )}
                  >
                    {server.enabled ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => deleteServer(server.id)}
                    className="p-1.5 rounded text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              {server.command && (
                <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                  {server.command}
                </pre>
              )}
              {server.url && (
                <p className="text-xs text-muted-foreground">{server.url}</p>
              )}
            </div>
          ))
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        MCP (Model Context Protocol) 服务器可以扩展 Claude 的能力，如文件系统访问、数据库连接等。
      </p>
    </div>
  )
}

function SkillsSettings() {
  const { skills, addSkill, addSkillsBatch, deleteSkill, toggleSkill, updateSkill } = useSkills()
  const [editingSkillId, setEditingSkillId] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [editForm, setEditForm] = useState<Partial<Skill>>({
    name: '',
    description: '',
    prompt: '',
    enabled: true,
  })
  const [isRefreshing, setIsRefreshing] = useState(false)

  const { RefreshCw, FolderOpen, Pencil, ArrowLeft, ExternalLink, Trash2, User, Plus } = require('lucide-react')

  const loadLocal = async () => {
    setIsRefreshing(true)
    const api = (window as any).electronAPI
    if (!api?.scanLocalSkills) {
      setIsRefreshing(false)
      return
    }
    try {
      const localSkills = await api.scanLocalSkills()
      console.log('[SkillsSettings] Got local skills:', localSkills.length)
      if (localSkills.length > 0) {
        // 更新现有本地技能或添加新的
        addSkillsBatch(
          localSkills.map((ls: any) => ({
            name: ls.name,
            description: ls.description || '本地 Skill',
            prompt: ls.prompt || `返回路径 ${ls.path} 中的 SKILL.md 指令`,
            enabled: true,
          }))
        )
      }
    } catch (e) {
      console.error('[SkillsSettings] Failed to scan local skills:', e)
    } finally {
      setIsRefreshing(false)
    }
  }

  // 组件挂载时自动扫描一次
  useEffect(() => {
    loadLocal()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleOpenFolder = async () => {
    const api = (window as any).electronAPI
    if (api?.getPath && api?.systemOpenPath) {
      try {
        const home = await api.getPath('home')
        await api.systemOpenPath(`${home}/.claude/skills`)
      } catch (e) {
        console.error('Failed to open skills folder:', e)
      }
    }
  }

  const startEdit = (skill: Skill) => {
    setEditingSkillId(skill.id)
    setIsCreating(false)
    setEditForm({ ...skill })
  }

  const startCreate = () => {
    setEditingSkillId('new')
    setIsCreating(true)
    setEditForm({ name: '', description: '', prompt: '', enabled: true })
  }

  const handleSave = () => {
    if (!editForm.name || !editForm.prompt) return

    if (isCreating) {
      addSkill(editForm as Omit<Skill, 'id'>)
    } else if (editingSkillId) {
      updateSkill(editingSkillId, editForm)
    }
    setEditingSkillId(null)
  }

  // ---------------- 编辑视图 ----------------
  if (editingSkillId) {
    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => setEditingSkillId(null)}
            className="p-1.5 rounded-full hover:bg-white/10 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-xl font-bold">{isCreating ? '新建技能' : '编辑技能'}</h2>
        </div>

        {!isCreating && (
          <button className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 text-xs text-muted-foreground hover:bg-white/5 transition-colors w-fit mb-6">
            Edit in VSCode <ExternalLink className="w-3 h-3" />
          </button>
        )}

        <div className="space-y-5">
          <div>
            <label className="block text-sm text-muted-foreground mb-1.5">名称</label>
            <input
              type="text"
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              className="w-full p-3 rounded-xl border border-white/10 bg-[#1e1e1e] focus:border-primary/50 focus:ring-1 focus:ring-primary/50 outline-none transition-all"
              placeholder="e.g. ui-ux-pro-max"
            />
          </div>

          <div>
            <label className="block text-sm text-muted-foreground mb-1.5">描述</label>
            <textarea
              value={editForm.description}
              onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              className="w-full p-3 rounded-xl border border-white/10 bg-[#1e1e1e] focus:border-primary/50 focus:ring-1 focus:ring-primary/50 outline-none transition-all min-h-[80px]"
              placeholder="一句话简短描述这个技能的作用..."
            />
          </div>

          <div>
            <label className="block text-sm text-muted-foreground mb-1.5">详情</label>
            <textarea
              value={editForm.prompt}
              onChange={(e) => setEditForm({ ...editForm, prompt: e.target.value })}
              className="w-full p-4 rounded-xl border border-white/10 bg-[#1e1e1e] font-mono text-sm focus:border-primary/50 focus:ring-1 focus:ring-primary/50 outline-none transition-all min-h-[200px]"
              placeholder="输入完整的 Markdown 提示词模板..."
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10 mt-6">
          <button
            onClick={() => setEditingSkillId(null)}
            className="px-6 py-2 rounded-xl text-sm border border-white/10 hover:bg-white/5 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={!editForm.name || !editForm.prompt}
            className="px-6 py-2 rounded-xl text-sm bg-white text-black font-medium hover:bg-white/90 disabled:opacity-50 transition-colors"
          >
            保存
          </button>
        </div>
      </div>
    )
  }

  // ---------------- 列表视图 ----------------
  return (
    <div className="space-y-6">
      {/* 头部说明 */}
      <div>
        <h2 className="text-2xl font-bold mb-2">技能</h2>
        <p className="text-sm text-muted-foreground">
          技能是教 Claude 如何完成特定任务的 Markdown 文件。
        </p>
      </div>

      <div className="border-b border-white/10 pt-2" />

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <User className="w-5 h-5 text-muted-foreground" />
          <span className="font-medium text-[15px]">用户技能</span>
          <span className="text-muted-foreground/50 text-sm">· {skills.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadLocal}
            disabled={isRefreshing}
            className="p-2 rounded-lg border border-white/10 hover:bg-white/5 transition-colors disabled:opacity-50"
            title="刷新本地技能"
          >
            <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
          </button>
          <button
            onClick={handleOpenFolder}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 hover:bg-white/5 transition-colors text-sm"
          >
            <FolderOpen className="w-4 h-4" />
            Open Folder
          </button>
        </div>
      </div>

      {/* 添加按钮 */}
      <button
        onClick={startCreate}
        className="w-full py-4 flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-[#1e1e1e]/50 hover:bg-[#1e1e1e] transition-colors text-sm text-foreground/80"
      >
        <Plus className="w-4 h-4" />
        添加用户技能
      </button>

      {/* 技能卡片列表 */}
      <div className="space-y-4 pb-8">
        {skills.map(skill => (
          <div
            key={skill.id}
            className="p-5 rounded-xl border border-white/10 bg-[#1e1e1e]/80 flex items-start gap-4 hover:border-white/20 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-semibold mb-1.5">{skill.name}</h3>
              <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed text-balance">
                {skill.description || '无描述'}
              </p>
            </div>

            <div className="flex items-center gap-4 pl-4 pt-1">
              {/* Toggle Switch */}
              <button
                onClick={() => toggleSkill(skill.id)}
                className={cn(
                  "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors duration-200 ease-in-out focus:outline-none",
                  skill.enabled ? "bg-[#0ea5e9]" : "bg-white/20"
                )}
              >
                <span
                  className={cn(
                    "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                    skill.enabled ? "translate-x-4" : "-translate-x-0.5"
                  )}
                />
              </button>

              <button
                onClick={() => startEdit(skill)}
                className="text-muted-foreground hover:text-white transition-colors"
              >
                <Pencil className="w-4 h-4" />
              </button>

              <button
                onClick={() => deleteSkill(skill.id)}
                className="text-muted-foreground hover:text-red-400 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function AboutSettings() {
  return (
    <div className="space-y-6">
      <div className="text-center py-8">
        <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-3xl text-white font-bold">
          N
        </div>
        <h2 className="text-2xl font-bold mb-2">CodeNova</h2>
        <p className="text-muted-foreground mb-4">版本 1.0.1</p>
        <p className="text-sm text-muted-foreground mb-8">桌面端 AI 编程助手</p>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between p-3 rounded-lg bg-muted/30">
          <span>Electron</span>
          <span className="text-muted-foreground">33.x</span>
        </div>
        <div className="flex justify-between p-3 rounded-lg bg-muted/30">
          <span>Next.js</span>
          <span className="text-muted-foreground">15.x</span>
        </div>
        <div className="flex justify-between p-3 rounded-lg bg-muted/30">
          <span>Node.js</span>
          <span className="text-muted-foreground">20.x</span>
        </div>
      </div>
    </div>
  )
}

function AccountSettings() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-4">账户设置</h2>
      </div>

      <div className="p-4 rounded-lg border border-border">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-2xl font-bold">
            U
          </div>
          <div>
            <div className="font-medium">用户</div>
            <div className="text-sm text-muted-foreground">未登录</div>
          </div>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        登录后可同步设置和对话记录
      </p>

      <button className="px-4 py-2 bg-primary text-primary-foreground rounded-lg">
        登录账户
      </button>
    </div>
  )
}
