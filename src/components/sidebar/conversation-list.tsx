'use client'

import { useState, useEffect, useRef } from 'react'
import { Plus, MessageSquare, Archive, Trash2, Settings, Search, Pencil } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Conversation } from '@/hooks/use-conversations'

interface ConversationListProps {
  conversations: Conversation[]
  selectedId: string | null
  onSelect: (id: string) => void
  onNewConversation: () => void
  onOpenSettings: () => void
  onArchive: (id: string) => void
  onDelete: (id: string) => void
  onRename: (id: string, newTitle: string) => void
}

export function ConversationList({
  conversations,
  selectedId,
  onSelect,
  onNewConversation,
  onOpenSettings,
  onArchive,
  onDelete,
  onRename,
}: ConversationListProps) {
  const [showArchived, setShowArchived] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const activeConversations = conversations.filter(c => !c.archived)
  const archivedConversations = conversations.filter(c => c.archived)

  const filteredActive = searchQuery
    ? activeConversations.filter(c => c.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : activeConversations

  return (
    <div className="h-full flex flex-col bg-card/60 backdrop-blur">
      {/* 搜索栏 */}
      <div className="p-2 border-b border-border">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索对话..."
            className="w-full pl-8 pr-3 py-1.5 text-sm rounded-md bg-background/60 border border-white/10 focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {/* 新建对话按钮 */}
      <div className="p-2">
        <button
          onClick={onNewConversation}
          className="w-full h-9 flex items-center justify-center gap-2 rounded-lg bg-primary/90 text-primary-foreground hover:bg-primary transition-colors text-sm font-medium shadow-[0_10px_20px_-15px_rgba(0,0,0,0.6)]"
        >
          <Plus className="w-4 h-4" />
          新建对话
        </button>
      </div>

      {/* 对话列表 */}
      <div className="flex-1 overflow-y-auto px-2">
        <div className="space-y-1">
          {filteredActive.map((conv) => (
            <ConversationItem
              key={conv.id}
              conversation={conv}
              isSelected={selectedId === conv.id}
              onSelect={() => onSelect(conv.id)}
              onArchive={() => onArchive(conv.id)}
              onDelete={() => onDelete(conv.id)}
              onRename={(id, title) => onRename(id, title)}
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
                  onArchive={() => onArchive(conv.id)}
                  onDelete={() => onDelete(conv.id)}
                  onRename={(id, title) => onRename(id, title)}
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
  onRename: (id: string, newTitle: string) => void
}

function ConversationItem({ conversation, isSelected, onSelect, onArchive, onDelete, onRename }: ConversationItemProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(conversation.title)
  const inputRef = useRef<HTMLInputElement>(null)

  // Sync editTitle when conversation.title changes
  useEffect(() => {
    setEditTitle(conversation.title)
  }, [conversation.title])

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  const handleRename = () => {
    if (editTitle.trim() && editTitle !== conversation.title) {
      onRename(conversation.id, editTitle.trim())
    }
    setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRename()
    } else if (e.key === 'Escape') {
      setEditTitle(conversation.title)
      setIsEditing(false)
    }
  }

  return (
    <div
      onClick={onSelect}
      className={cn(
        'group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors',
        isSelected
          ? 'bg-primary/12 text-primary border border-primary/20 shadow-[0_10px_25px_-20px_rgba(0,0,0,0.6)]'
          : 'hover:bg-background/60 text-foreground'
      )}
    >
      <MessageSquare className="w-4 h-4 flex-shrink-0" />
      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          onBlur={handleRename}
          onKeyDown={handleKeyDown}
          onClick={(e) => e.stopPropagation()}
          className="flex-1 bg-background border border-primary rounded px-1 text-sm outline-none"
        />
      ) : (
        <span className="flex-1 truncate text-sm">{conversation.title}</span>
      )}

      {/* 操作按钮 */}
      <div className="hidden group-hover:flex items-center gap-1">
        <button
          onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
          className="p-1 rounded hover:bg-muted"
          title="重命名"
        >
          <Pencil className="w-3 h-3 text-muted-foreground" />
        </button>
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
