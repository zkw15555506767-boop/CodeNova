'use client'

import { useState, useEffect, useRef } from 'react'
import { Search, X, FileCode2, MessageSquare, Settings, Plus, Trash2, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
}

interface Command {
  id: string
  name: string
  description: string
  icon: React.ReactNode
  shortcut?: string
  action: () => void
}

const defaultCommands: Command[] = [
  {
    id: 'new-chat',
    name: '新建对话',
    description: '创建一个新的对话',
    icon: <Plus className="w-4 h-4" />,
    shortcut: '⌘N',
    action: () => {},
  },
  {
    id: 'clear',
    name: '清除对话',
    description: '清除当前对话内容',
    icon: <Trash2 className="w-4 h-4" />,
    shortcut: '⌘L',
    action: () => {},
  },
  {
    id: 'cost',
    name: '查看用量',
    description: '查看 Token 消耗和费用',
    icon: <Zap className="w-4 h-4" />,
    action: () => {},
  },
  {
    id: 'settings',
    name: '打开设置',
    description: '打开设置面板',
    icon: <Settings className="w-4 h-4" />,
    shortcut: '⌘,',
    action: () => {},
  },
  {
    id: 'project',
    name: '选择项目',
    description: '选择项目目录',
    icon: <FileCode2 className="w-4 h-4" />,
    action: () => {},
  },
]

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const [search, setSearch] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const commands = search
    ? defaultCommands.filter(cmd =>
        cmd.name.toLowerCase().includes(search.toLowerCase()) ||
        cmd.description.includes(search)
      )
    : defaultCommands

  useEffect(() => {
    if (isOpen) {
      setSearch('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

  useEffect(() => {
    setSelectedIndex(0)
  }, [search])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(i => Math.min(i + 1, commands.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(i => Math.max(i - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        if (commands[selectedIndex]) {
          commands[selectedIndex].action()
          onClose()
        }
        break
      case 'Escape':
        e.preventDefault()
        onClose()
        break
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24">
      {/* 遮罩层 */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* 命令面板 */}
      <div className="relative w-full max-w-lg bg-background rounded-xl shadow-2xl border border-border overflow-hidden">
        {/* 搜索框 */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search className="w-5 h-5 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入命令或搜索..."
            className="flex-1 bg-transparent outline-none text-sm"
          />
          <button onClick={onClose}>
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* 命令列表 */}
        <div className="max-h-80 overflow-y-auto p-2">
          {commands.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground text-center">
              没有找到匹配的命令
            </div>
          ) : (
            commands.map((cmd, index) => (
              <button
                key={cmd.id}
                onClick={() => {
                  cmd.action()
                  onClose()
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors",
                  index === selectedIndex
                    ? "bg-primary/10 text-primary"
                    : "hover:bg-muted"
                )}
              >
                <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-muted">
                  {cmd.icon}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-sm">{cmd.name}</div>
                  <div className="text-xs text-muted-foreground">{cmd.description}</div>
                </div>
                {cmd.shortcut && (
                  <kbd className="px-2 py-0.5 bg-muted rounded text-xs font-mono">
                    {cmd.shortcut}
                  </kbd>
                )}
              </button>
            ))
          )}
        </div>

        {/* 底部提示 */}
        <div className="px-4 py-2 border-t border-border text-xs text-muted-foreground flex items-center gap-4">
          <span><kbd className="px-1 bg-muted rounded">↑↓</kbd> 导航</span>
          <span><kbd className="px-1 bg-muted rounded">↵</kbd> 执行</span>
          <span><kbd className="px-1 bg-muted rounded">esc</kbd> 关闭</span>
        </div>
      </div>
    </div>
  )
}
