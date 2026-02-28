'use client'

import { useState, useEffect, useRef } from 'react'
import { Terminal, Zap, BookOpen, Trash2, HelpCircle, DollarSign, FileCode, Wrench } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSkills } from '@/hooks/use-skills'

interface SlashCommandsProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (command: string, value?: string) => void
  inputValue: string
}

interface CommandItem {
  name: string
  description: string
  action: string
  icon: React.ReactNode
  type: 'builtin' | 'skill' | 'mcp'
}

// 内置命令
const builtinCommands: CommandItem[] = [
  { name: '/clear', description: '清除当前对话', action: 'clear', icon: <Trash2 className="w-4 h-4" />, type: 'builtin' },
  { name: '/help', description: '查看所有可用命令', action: 'help', icon: <HelpCircle className="w-4 h-4" />, type: 'builtin' },
  { name: '/cost', description: '查看 Token 消耗统计', action: 'cost', icon: <DollarSign className="w-4 h-4" />, type: 'builtin' },
  { name: '/compact', description: '压缩上下文', action: 'compact', icon: <FileCode className="w-4 h-4" />, type: 'builtin' },
  { name: '/new', description: '创建新对话', action: 'new', icon: <Terminal className="w-4 h-4" />, type: 'builtin' },
]

export function SlashCommands({ isOpen, onClose, onSelect, inputValue }: SlashCommandsProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)
  const { skills } = useSkills()

  // 将 skills 转成 CommandItem
  const skillCommands: CommandItem[] = skills
    .filter(s => s.enabled)
    .map(s => ({
      name: `/${s.name}`,
      description: s.description,
      action: `skill:${s.name}`,
      icon: <Zap className="w-4 h-4" />,
      type: 'skill' as const,
    }))

  // 所有命令
  const allCommands = [...builtinCommands, ...skillCommands]

  const searchTerm = inputValue.startsWith('/') ? inputValue.slice(1).toLowerCase() : ''
  const filteredCommands = searchTerm
    ? allCommands.filter(cmd =>
      cmd.name.toLowerCase().includes(searchTerm) ||
      (cmd.description && cmd.description.toLowerCase().includes(searchTerm))
    )
    : allCommands

  useEffect(() => {
    setSelectedIndex(0)
  }, [inputValue])

  useEffect(() => {
    if (!isOpen) {
      setSelectedIndex(0)
    }
  }, [isOpen])

  // 滚动选中项到视野中
  useEffect(() => {
    if (listRef.current) {
      const items = listRef.current.querySelectorAll('[data-cmd-item]')
      items[selectedIndex]?.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedIndex])

  if (!isOpen || filteredCommands.length === 0) return null

  return (
    <div className="absolute bottom-full left-0 right-0 mb-2 z-50 rounded-xl border border-white/10 bg-background/95 backdrop-blur-xl shadow-2xl shadow-black/30 overflow-hidden">
      {/* 标题 */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5">
        <BookOpen className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">命令和技能</span>
        <span className="text-[10px] text-muted-foreground/50 ml-auto">↑↓ 选择 · Enter 确认 · Esc 取消</span>
      </div>

      {/* 命令列表 */}
      <div ref={listRef} className="max-h-72 overflow-y-auto py-1">
        {/* 内置命令 */}
        {filteredCommands.some(c => c.type === 'builtin') && (
          <>
            <div className="px-3 py-1.5">
              <span className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider">内置命令</span>
            </div>
            {filteredCommands
              .filter(c => c.type === 'builtin')
              .map((cmd, i) => {
                const globalIndex = filteredCommands.indexOf(cmd)
                return (
                  <button
                    key={`${cmd.name}-${globalIndex}`}
                    data-cmd-item
                    onClick={() => onSelect(cmd.action)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 text-left transition-colors",
                      globalIndex === selectedIndex
                        ? "bg-primary/10 text-primary"
                        : "hover:bg-white/5"
                    )}
                  >
                    <span className="text-muted-foreground">{cmd.icon}</span>
                    <span className="font-mono text-sm font-medium">{cmd.name}</span>
                    <span className="text-xs text-muted-foreground flex-1">{cmd.description}</span>
                  </button>
                )
              })}
          </>
        )}

        {/* 技能 */}
        {filteredCommands.some(c => c.type === 'skill') && (
          <>
            <div className="px-3 py-1.5 mt-1">
              <span className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider">技能 Skills</span>
            </div>
            {filteredCommands
              .filter(c => c.type === 'skill')
              .map((cmd, i) => {
                return (
                  <button
                    key={`${cmd.name}-skill-${i}`}
                    data-cmd-item
                    onClick={() => onSelect(cmd.action)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 text-left transition-colors",
                      filteredCommands.indexOf(cmd) === selectedIndex
                        ? "bg-primary/10 text-primary"
                        : "hover:bg-white/5"
                    )}
                  >
                    <span className="text-blue-400">{cmd.icon}</span>
                    <span className="font-mono text-sm font-medium">{cmd.name}</span>
                    <span className="text-xs text-muted-foreground flex-1 truncate">{cmd.description}</span>
                  </button>
                )
              })}
          </>
        )}

        {/* MCP */}
        {filteredCommands.some(c => c.type === 'mcp') && (
          <>
            <div className="px-3 py-1.5 mt-1">
              <span className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider">MCP 工具</span>
            </div>
            {filteredCommands
              .filter(c => c.type === 'mcp')
              .map((cmd) => {
                const globalIndex = filteredCommands.indexOf(cmd)
                return (
                  <button
                    key={`${cmd.name}-${globalIndex}`}
                    data-cmd-item
                    onClick={() => onSelect(cmd.action)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 text-left transition-colors",
                      globalIndex === selectedIndex
                        ? "bg-primary/10 text-primary"
                        : "hover:bg-white/5"
                    )}
                  >
                    <span className="text-green-400">{cmd.icon}</span>
                    <span className="font-mono text-sm font-medium">{cmd.name}</span>
                    <span className="text-xs text-muted-foreground flex-1">{cmd.description}</span>
                  </button>
                )
              })}
          </>
        )}
      </div>
    </div>
  )
}

// 解析斜杠命令 — 支持 skill: 前缀
export function parseSlashCommand(input: string): { command: string; value: string } | null {
  if (!input.startsWith('/')) return null

  const parts = input.split(' ')
  const command = parts[0].slice(1)
  const value = parts.slice(1).join(' ')

  return { command, value }
}

// 获取选中命令（供 chat-view keyDown 使用）
export function getSelectedCommand(
  inputValue: string,
  selectedIndex: number,
  allCommands: CommandItem[]
): CommandItem | null {
  const searchTerm = inputValue.startsWith('/') ? inputValue.slice(1).toLowerCase() : ''
  const filtered = searchTerm
    ? allCommands.filter(cmd =>
      cmd.name.toLowerCase().includes(searchTerm) ||
      (cmd.description && cmd.description.toLowerCase().includes(searchTerm))
    )
    : allCommands
  return filtered[selectedIndex] || null
}
