'use client'

import { useState } from 'react'
import { Plus, MessageSquare, Archive, Trash2, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SidebarProps {
  selectedId: string | null
  onSelect: (id: string) => void
  onOpenSettings?: () => void
}

interface Conversation {
  id: string
  title: string
  updatedAt: number
  archived: boolean
}

export function Sidebar({ selectedId, onSelect, onOpenSettings }: SidebarProps) {
  const [conversations, setConversations] = useState<Conversation[]>([
    { id: '1', title: '新建对话', updatedAt: Date.now(), archived: false },
  ])
  const [showArchived, setShowArchived] = useState(false)

  const activeConversations = conversations.filter(c => !c.archived)
  const archivedConversations = conversations.filter(c => c.archived)

  const handleNewConversation = () => {
    const newConv: Conversation = {
      id: Date.now().toString(),
      title: '新对话',
      updatedAt: Date.now(),
      archived: false,
    }
    setConversations([newConv, ...conversations])
    onSelect(newConv.id)
  }

  const handleArchive = (id: string) => {
    setConversations(conversations.map(c =>
      c.id === id ? { ...c, archived: true, updatedAt: Date.now() } : c
    ))
  }

  const handleDelete = (id: string) => {
    setConversations(conversations.filter(c => c.id !== id))
    if (selectedId === id) {
      onSelect(conversations[0]?.id || '')
    }
  }

  return (
    <div className="w-64 h-full flex flex-col bg-card border-r border-border">
      {/* 新建对话按钮 */}
      <div className="p-3">
        <button
          onClick={handleNewConversation}
          className="w-full h-9 flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          新建对话
        </button>
      </div>

      {/* 对话列表 */}
      <div className="flex-1 overflow-y-auto px-2">
        <div className="space-y-1">
          {activeConversations.map((conv) => (
            <ConversationItem
              key={conv.id}
              conversation={conv}
              isSelected={selectedId === conv.id}
              onSelect={() => onSelect(conv.id)}
              onArchive={() => handleArchive(conv.id)}
              onDelete={() => handleDelete(conv.id)}
            />
          ))}
        </div>

        {/* 归档对话 */}
        {archivedConversations.length > 0 && (
          <>
            <button
              onClick={() => setShowArchived(!showArchived)}
              className="flex items-center gap-2 px-2 py-1.5 mt-3 text-xs text-muted-foreground hover:text-foreground"
            >
              <Archive className="w-3 h-3" />
              归档 ({archivedConversations.length})
            </button>

            {showArchived && (
              <div className="space-y-1 mt-1">
                {archivedConversations.map((conv) => (
                  <ConversationItem
                    key={conv.id}
                    conversation={conv}
                    isSelected={selectedId === conv.id}
                    onSelect={() => onSelect(conv.id)}
                    onArchive={() => {
                      setConversations(conversations.map(c =>
                        c.id === conv.id ? { ...c, archived: false, updatedAt: Date.now() } : c
                      ))
                    }}
                    onDelete={() => handleDelete(conv.id)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* 底部设置 */}
      <div className="p-2 border-t border-border">
        <button
          onClick={onOpenSettings}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <Settings className="w-4 h-4" />
          设置
        </button>
      </div>
    </div>
  )
}

interface ConversationItemProps {
  conversation: Conversation
  isSelected: boolean
  onSelect: () => void
  onArchive: () => void
  onDelete: () => void
}

function ConversationItem({ conversation, isSelected, onSelect, onArchive, onDelete }: ConversationItemProps) {
  return (
    <div
      onClick={onSelect}
      className={cn(
        'group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors',
        isSelected
          ? 'bg-primary/10 text-primary'
          : 'hover:bg-muted text-foreground'
      )}
    >
      <MessageSquare className="w-4 h-4 flex-shrink-0" />
      <span className="flex-1 truncate text-sm">{conversation.title}</span>

      {/* 操作按钮 */}
      <div className="hidden group-hover:flex items-center gap-1">
        <button
          onClick={(e) => { e.stopPropagation(); onArchive(); }}
          className="p-1 rounded hover:bg-muted"
          title="归档"
        >
          <Archive className="w-3 h-3 text-muted-foreground" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="p-1 rounded hover:bg-destructive/10"
          title="删除"
        >
          <Trash2 className="w-3 h-3 text-destructive" />
        </button>
      </div>
    </div>
  )
}
