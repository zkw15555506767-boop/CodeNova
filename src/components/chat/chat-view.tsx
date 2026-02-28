import { useState, useRef, useEffect } from 'react'
import { Send, Square, Paperclip, Bot, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ChatMessage } from './chat-message'
import { ModeSelector } from './mode-selector'
import { ModelSelector } from './model-selector'
import { SlashCommands, parseSlashCommand } from './slash-commands'
import { FilePreview } from './file-preview'
import { InteractiveToolBlock } from './interactive-tool-block'
import { Message, useChat } from '@/hooks/use-chat'

interface ChatViewProps {
  conversationId: string | null
  projectPath: string
}

export function ChatView({ conversationId, projectPath }: ChatViewProps) {
  const {
    messages,
    input,
    setInput,
    isStreaming,
    mode,
    setMode,
    model,
    setModel,
    tokenStats,
    addSystemMessage,
    sendMessage,
    stopGenerating,
    clearMessages,
    updateToolApproval,
    sendAgentMessage,
  } = useChat(conversationId)

  // Pending live permission requests from the Agent loop
  const [pendingPermissions, setPendingPermissions] = useState<{
    requestId: string; toolName: string; toolInput: Record<string, string>; messageId: string
  }[]>([])

  const [showSlashCommands, setShowSlashCommands] = useState(false)
  const [attachments, setAttachments] = useState<{ name: string; path: string; type: string }[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const resizeTextarea = () => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    const next = Math.min(el.scrollHeight, 220)
    el.style.height = `${next}px`
  }

  // 自动滚动到底部
  // Auto-scroll when messages OR pending permissions change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, pendingPermissions])

  // 自动调整输入框高度
  useEffect(() => {
    resizeTextarea()
  }, [input])

  // 监听来自文件树的 "添加到上下文" 自定义事件
  useEffect(() => {
    const handleFileAdd = (e: Event) => {
      const customEvent = e as CustomEvent<{ path: string; name: string }>;
      const { path, name } = customEvent.detail;

      setAttachments(prev => {
        // 去重检查
        if (prev.some(a => a.path === path)) return prev;
        return [...prev, {
          name,
          path,
          type: name.split('.').pop() || 'file'
        }];
      });
    };

    window.addEventListener('file-add-to-chat', handleFileAdd);
    return () => window.removeEventListener('file-add-to-chat', handleFileAdd);
  }, []);

  const [isDragging, setIsDragging] = useState(false)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    // 处理原生文件拖拽
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const newFiles = Array.from(e.dataTransfer.files).map(file => ({
        name: file.name,
        path: (file as any).path || file.name,
        type: file.type || file.name.split('.').pop() || 'file'
      }))

      setAttachments(prev => {
        const existingPaths = new Set(prev.map(a => a.path))
        const toAdd = newFiles.filter(f => !existingPaths.has(f.path))
        return [...prev, ...toAdd]
      })
      return
    }

    // 处理从 FileTree 组件拖拽的节点
    const nodeData = e.dataTransfer.getData('application/json')
    if (nodeData) {
      try {
        const node = JSON.parse(nodeData)
        if (!node.isDirectory) {
          setAttachments(prev => {
            if (prev.some(a => a.path === node.path)) return prev
            return [...prev, {
              name: node.name,
              path: node.path,
              type: node.name.split('.').pop() || 'file'
            }]
          })
        }
      } catch (err) {
        console.error('Failed to parse dropped node data:', err)
      }
    }
  }

  const handleSend = () => {
    if (!input.trim() && attachments.length === 0) return
    if (input.trim().startsWith('/')) {
      const parsed = parseSlashCommand(input.trim())
      if (parsed) {
        handleSlashCommand(parsed.command)
        return
      }
    }

    // Code / Plan modes → use the real Agent tool loop
    if (mode === 'code' || mode === 'plan') {
      const content = input.trim()
      sendAgentMessage(content, projectPath || undefined, (req) => {
        setPendingPermissions(prev => [...prev, req])
      })
      setAttachments([])
      return
    }

    // Ask mode → use regular Minimax chat
    sendMessage(attachments)
    setAttachments([])
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // 检测斜杠命令 - 支持输入 / 后弹出命令面板
    if (input.startsWith('/') || (e.key === '/' && !input)) {
      setShowSlashCommands(true)
    }

    if (showSlashCommands) {
      if (e.key === 'Escape') {
        setShowSlashCommands(false)
        return
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        const parsed = parseSlashCommand(input.trim())
        if (parsed) {
          handleSlashCommand(parsed.command)
        }
        return
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // 监听输入变化来显示/隐藏斜杠命令面板
  useEffect(() => {
    if (input.startsWith('/')) {
      setShowSlashCommands(true)
    } else if (input === '') {
      setShowSlashCommands(false)
    }
  }, [input])

  const handleSlashCommand = (command: string) => {
    // 处理技能命令（以 skill: 开头）
    if (command.startsWith('skill:')) {
      const skillName = command.slice(6)

      const stored = localStorage.getItem('codenova_skills')
      if (stored) {
        try {
          const skills = JSON.parse(stored)
          const skill = skills.find((s: any) => s.name === skillName && s.enabled)
          if (skill) {
            if (skill.path && window.electronAPI?.readText) {
              // 动态读取内容，防止 localStorage 被塞爆
              window.electronAPI.readText(`${skill.path}/SKILL.md`).then((res: any) => {
                if (res.success && res.content) {
                  setInput(res.content + ' \n')
                } else {
                  setInput((skill.prompt || `/${skillName}`) + ' ')
                }
              }).catch(() => {
                setInput((skill.prompt || `/${skillName}`) + ' ')
              })
            } else {
              setInput((skill.prompt || `/${skillName}`) + ' ')
            }
            setShowSlashCommands(false)
            return
          }
        } catch { }
      }
      setInput(`/${skillName} `)
      setShowSlashCommands(false)
      return
    }

    switch (command) {
      case 'help':
        addSystemMessage(`## 可用命令

- /help - 查看帮助
- /clear - 清除对话
- /cost - 查看 Token 消耗
- /compact - 压缩上下文
- /new - 新建对话
- /project - 项目信息

**技能命令**：输入 / 可以看到所有已启用的技能，选择后自动插入提示词模板。`)
        break
      case 'clear':
        clearMessages()
        break
      case 'cost':
        addSystemMessage(`## Token 消耗统计

- 输入: ${tokenStats.inputTokens} tokens
- 输出: ${tokenStats.outputTokens} tokens
- 预估费用: $${tokenStats.totalCost.toFixed(4)}`)
        break
      case 'compact':
        addSystemMessage('上下文已压缩')
        break
      case 'doctor':
        addSystemMessage(`## 诊断信息

- API 提供商: ${conversationId ? '已选择对话' : '未选择对话'}
- 模型: ${model}
- 模式: ${mode}
- 项目路径: ${projectPath || '未选择'}`)
        break
      case 'review':
        addSystemMessage('请选择要审查的代码文件')
        break
      case 'new':
        clearMessages()
        break
      case 'project':
        addSystemMessage(`## 项目信息

项目路径: ${projectPath || '请在左侧面板选择项目目录'}`)
        break
      default:
        break
    }
    setInput('')
    setShowSlashCommands(false)
  }

  const handleFileSelect = async () => {
    // 检查是否在 Electron 环境中
    if (!window.electronAPI) {
      alert('文件选择功能仅在桌面应用中可用')
      return
    }

    const filePath = await window.electronAPI.selectFile([
      { name: 'All Files', extensions: ['*'] },
      { name: 'Code & Text', extensions: ['txt', 'md', 'js', 'jsx', 'ts', 'tsx', 'json', 'yaml', 'yml', 'css', 'html', 'py', 'go', 'java', 'c', 'cpp', 'rs', 'php', 'rb'] },
      { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] },
    ])
    if (filePath) {
      const name = filePath.split('/').pop() || 'file'
      const ext = name.split('.').pop() || ''
      const type = ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext) ? 'image' : 'file'
      setAttachments(prev => [...prev, { name, path: filePath, type }])
    }
  }

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index))
  }

  return (
    <div
      className={cn(
        "flex-1 flex flex-col h-full bg-background/40 transition-colors relative",
        isDragging && "bg-primary/5"
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* 拖拽遮罩 */}
      {isDragging && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm border-2 border-dashed border-primary/50 rounded-lg m-2 pointer-events-none">
          <div className="flex flex-col items-center gap-4 text-primary">
            <div className="p-4 rounded-full bg-primary/10">
              <Paperclip className="w-8 h-8" />
            </div>
            <p className="text-lg font-medium">释放以上传文件或添加代码上下文</p>
          </div>
        </div>
      )}

      {/* 顶部状态栏 */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-background/60 backdrop-blur">
        <div className="text-sm text-muted-foreground">
          {conversationId ? '新对话' : '选择或创建对话开始使用'}
        </div>
        {/* 当前模式 badge */}
        <div className={cn(
          "flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border",
          mode === 'code' ? "text-blue-400 bg-blue-400/10 border-blue-400/20" :
            mode === 'plan' ? "text-violet-400 bg-violet-400/10 border-violet-400/20" :
              "text-muted-foreground bg-muted/50 border-white/10"
        )}>
          {mode === 'code' ? '⚡ Code 模式' : mode === 'plan' ? '📋 Plan 模式' : '💬 Ask 模式'}
        </div>
      </div>

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/90 to-accent/90 flex items-center justify-center mb-4 shadow-[0_20px_40px_-25px_rgba(0,0,0,0.6)]">
              <span className="text-3xl text-white font-bold tracking-wide">N</span>
            </div>
            <h2 className="text-xl font-semibold mb-2">CodeNova</h2>
            <p className="text-muted-foreground max-w-md">
              开始新对话，或按 <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">⌘K</kbd> 打开命令面板
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <ChatMessage
                key={message.id}
                message={message}
                usage={(message as any).usage}
                onToolApproval={(toolId, approved) => updateToolApproval(message.id, toolId, approved ? 'approved' : 'rejected')}
              />
            ))}
            {/* Live Agent Permission Request blocks – shown at the bottom of the chat while loop is suspended */}
            {pendingPermissions.map((req) => (
              <div key={req.requestId} className="ml-11">
                <InteractiveToolBlock
                  toolId={req.requestId}
                  toolName={req.toolName}
                  parameters={req.toolInput}
                  status="pending"
                  onApprove={() => {
                    const api = (window as any).electronAPI
                    api?.resolveAgentPermission(req.requestId, { behavior: 'allow' })
                    setPendingPermissions(prev => prev.filter(p => p.requestId !== req.requestId))
                  }}
                  onReject={() => {
                    const api = (window as any).electronAPI
                    api?.resolveAgentPermission(req.requestId, { behavior: 'deny', message: 'User rejected the permission request' })
                    setPendingPermissions(prev => prev.filter(p => p.requestId !== req.requestId))
                  }}
                />
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>


      {/* 附件预览 */}
      {attachments.length > 0 && (
        <div className="px-4 pb-2 flex gap-2 flex-wrap">
          {attachments.map((file, index) => (
            <FilePreview
              key={index}
              file={file}
              onRemove={() => removeAttachment(index)}
            />
          ))}
        </div>
      )}

      {/* 输入区域 */}
      <div className="p-4 border-t border-white/10 relative bg-background/60 backdrop-blur">
        {/* 斜杠命令面板 */}
        <SlashCommands
          isOpen={showSlashCommands}
          onClose={() => setShowSlashCommands(false)}
          onSelect={handleSlashCommand}
          inputValue={input}
        />

        {/* 模式切换 */}
        <div className="flex items-center mb-2">
          <ModeSelector mode={mode} onModeChange={setMode} />
        </div>

        <div className="relative flex items-center gap-2 p-2 rounded-xl border border-white/10 bg-background/70 focus-within:ring-2 focus-within:ring-ring shadow-[0_10px_30px_-25px_rgba(0,0,0,0.5)]">
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
            className="flex-1 max-h-[220px] resize-none bg-transparent outline-none text-sm min-h-[44px] leading-5 py-2"
            disabled={isStreaming}
          />

          {/* 发送/停止按钮 */}
          {isStreaming ? (
            <button
              onClick={stopGenerating}
              className="p-2 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
              title="停止生成"
            >
              <Square className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim() && attachments.length === 0}
              className={cn(
                "p-2 rounded-lg transition-colors",
                input.trim() || attachments.length > 0
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "bg-muted text-muted-foreground"
              )}
              title="发送"
            >
              <Send className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Token 使用量 */}
        {tokenStats.inputTokens > 0 || tokenStats.outputTokens > 0 ? (
          <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground mt-2">
            <span>输入: {tokenStats.inputTokens.toLocaleString()} tokens</span>
            <span>输出: {tokenStats.outputTokens.toLocaleString()} tokens</span>
            <span className="flex items-center gap-1">
              $
              {tokenStats.totalCost.toFixed(4)}
            </span>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground text-center mt-2">
            CodeNova 可能会产生错误信息，请核实重要内容。
          </p>
        )}
      </div>
    </div>
  )
}
