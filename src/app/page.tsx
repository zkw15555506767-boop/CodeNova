'use client'

import { useState, useEffect } from 'react'
import { useTheme } from '@/hooks/use-theme'
import { useConversations } from '@/hooks/use-conversations'
import { useApiSettings } from '@/hooks/use-api-settings'
import { ChatView } from '@/components/chat/chat-view'
import { ConversationList } from '@/components/sidebar/conversation-list'
import { FileTree } from '@/components/sidebar/file-tree'
import { TitleBar } from '@/components/ui/title-bar'
import { SettingsPanel } from '@/components/settings/settings-panel'
import { CommandPalette } from '@/components/chat/command-palette'
import { TerminalPanel } from '@/components/chat/terminal-panel'

export default function Home() {
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null)
  const [showFilePanel, setShowFilePanel] = useState(true)
  const [showTerminal, setShowTerminal] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showCommandPalette, setShowCommandPalette] = useState(false)
  const [projectPath, setProjectPath] = useState<string>('')

  const { conversations, createConversation, updateConversation, archiveConversation, deleteConversation } = useConversations()
  const { loadClaudeCodeConfig, saveSettings, isLoaded } = useApiSettings()

  // 启动时自动加载 Claude Code 配置（Minimax）
  useEffect(() => {
    if (!isLoaded) return
    if (typeof window !== 'undefined' && window.electronAPI) {
      loadClaudeCodeConfig().catch(() => { })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded])

  // 如果没有对话，自动创廻一个
  useEffect(() => {
    if (conversations.length === 0) {
      const conv = createConversation('MiniMax 对话')
      setSelectedConversation(conv.id)
    } else if (!selectedConversation) {
      setSelectedConversation(conversations[0].id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversations.length])

  // 面板宽度及高度
  const [leftPanelWidth, setLeftPanelWidth] = useState(260)
  const [rightPanelWidth, setRightPanelWidth] = useState(280)
  const [terminalHeight, setTerminalHeight] = useState(240)

  const { theme, setTheme, themeClass } = useTheme()

  // 检测窗口最大化状态
  useEffect(() => {
    const checkMaximized = async () => {
      if (window.electronAPI) {
        await window.electronAPI.isMaximized()
      }
    }
    checkMaximized()
  }, [])

  // 监听键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setShowCommandPalette(true)
      }
      if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault()
        setShowSettings(true)
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault()
        setShowFilePanel(!showFilePanel)
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'j') {
        e.preventDefault()
        setShowTerminal(!showTerminal)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showFilePanel])

  // 加载项目路径
  useEffect(() => {
    const loadDefaultPath = async () => {
      if (window.electronAPI) {
        const homePath = await window.electronAPI.getPath('home')
        setProjectPath(homePath)
      }
    }
    loadDefaultPath()
  }, [])

  return (
    <div className={`h-screen flex flex-col ${themeClass} gradient-bg app-shell`}>
      {/* 标题栏 */}
      <div className="relative z-10">
        <TitleBar
          theme={theme}
          onThemeChange={setTheme}
          onToggleFilePanel={() => setShowFilePanel(!showFilePanel)}
          showFilePanel={showFilePanel}
          onOpenSettings={() => setShowSettings(true)}
        />
      </div>

      {/* 主内容区 */}
      <div className="flex-1 flex overflow-hidden relative z-10">
        {/* 左侧文件树 */}
        {showFilePanel && (
          <>
            <div style={{ width: leftPanelWidth }} className="flex-shrink-0 border-r border-white/10 panel-soft">
              <FileTree
                rootPath={projectPath}
                onPathChange={setProjectPath}
              />
            </div>
            {/* 左侧调节把手 */}
            <div
              className="w-1 hover:bg-primary/30 cursor-col-resize transition-colors flex-shrink-0"
              onMouseDown={(e) => {
                const startX = e.clientX
                const startWidth = leftPanelWidth
                const onMouseMove = (e: MouseEvent) => {
                  const newWidth = Math.min(500, Math.max(180, startWidth + e.clientX - startX))
                  setLeftPanelWidth(newWidth)
                }
                const onMouseUp = () => {
                  document.removeEventListener('mousemove', onMouseMove)
                  document.removeEventListener('mouseup', onMouseUp)
                }
                document.addEventListener('mousemove', onMouseMove)
                document.addEventListener('mouseup', onMouseUp)
              }}
            />
          </>
        )}

        {/* 中间：聊天区域 + 终端区域 */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 flex flex-col min-h-0">
            <ChatView
              conversationId={selectedConversation}
              projectPath={projectPath}
            />
          </div>

          {/* 上下调节把手 */}
          {showTerminal && (
            <div
              className="h-1 hover:bg-primary/30 cursor-row-resize transition-colors shrink-0"
              onMouseDown={(e) => {
                const startY = e.clientY
                const startHeight = terminalHeight
                const onMouseMove = (e: MouseEvent) => {
                  const newHeight = Math.min(800, Math.max(100, startHeight - (e.clientY - startY)))
                  setTerminalHeight(newHeight)
                }
                const onMouseUp = () => {
                  document.removeEventListener('mousemove', onMouseMove)
                  document.removeEventListener('mouseup', onMouseUp)
                }
                document.addEventListener('mousemove', onMouseMove)
                document.addEventListener('mouseup', onMouseUp)
              }}
            />
          )}

          {/* 底部：终端面板 */}
          {showTerminal && (
            <div style={{ height: terminalHeight }} className="shrink-0 flex flex-col">
              <TerminalPanel
                isExpanded={showTerminal}
                onToggleExpand={() => setShowTerminal(!showTerminal)}
              />
            </div>
          )}
        </div>

        {/* 右侧：会话列表 */}
        <div style={{ width: rightPanelWidth }} className="flex-shrink-0 border-l border-white/10 panel-soft">
          <ConversationList
            conversations={conversations}
            selectedId={selectedConversation}
            onSelect={(id) => setSelectedConversation(id)}
            onNewConversation={() => {
              const newConv = createConversation('新对话')
              setSelectedConversation(newConv.id)
            }}
            onOpenSettings={() => setShowSettings(true)}
            onArchive={(id) => archiveConversation(id)}
            onDelete={(id) => deleteConversation(id)}
            onRename={(id, newTitle) => {
              updateConversation(id, { title: newTitle })
            }}
          />
        </div>
      </div>

      {/* 设置面板 */}
      <SettingsPanel
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />

      {/* 命令面板 */}
      <CommandPalette
        isOpen={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
      />
    </div>
  )
}
