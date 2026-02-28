// 简单的本地存储 - 使用 localStorage 模拟 SQLite
// 实际项目中可以替换为 better-sqlite3

export interface Conversation {
  id: string
  title: string
  model: string
  mode: string
  directory?: string
  createdAt: number
  updatedAt: number
  archived: boolean
}

export interface Message {
  id: string
  conversationId: string
  role: 'user' | 'assistant'
  content: string
  toolCalls?: string
  toolResults?: string
  tokenCount?: number
  createdAt: number
}

const STORAGE_KEYS = {
  CONVERSATIONS: 'codenova_conversations',
  MESSAGES: 'codenova_messages',
  SETTINGS: 'codenova_settings',
}

// Conversations
export function getConversations(): Conversation[] {
  const data = localStorage.getItem(STORAGE_KEYS.CONVERSATIONS)
  return data ? JSON.parse(data) : []
}

export function saveConversation(conversation: Conversation): void {
  const conversations = getConversations()
  const index = conversations.findIndex(c => c.id === conversation.id)

  if (index >= 0) {
    conversations[index] = conversation
  } else {
    conversations.unshift(conversation)
  }

  localStorage.setItem(STORAGE_KEYS.CONVERSATIONS, JSON.stringify(conversations))
}

export function deleteConversation(id: string): void {
  const conversations = getConversations().filter(c => c.id !== id)
  localStorage.setItem(STORAGE_KEYS.CONVERSATIONS, JSON.stringify(conversations))

  // 同时删除相关的消息
  const messages = getMessages(id)
  messages.forEach(m => deleteMessage(m.id))
}

export function archiveConversation(id: string): void {
  const conversations = getConversations()
  const conversation = conversations.find(c => c.id === id)
  if (conversation) {
    conversation.archived = !conversation.archived
    conversation.updatedAt = Date.now()
    saveConversation(conversation)
  }
}

// Messages
export function getMessages(conversationId: string): Message[] {
  const data = localStorage.getItem(`${STORAGE_KEYS.MESSAGES}_${conversationId}`)
  return data ? JSON.parse(data) : []
}

export function saveMessage(message: Message): void {
  const messages = getMessages(message.conversationId)
  messages.push(message)
  localStorage.setItem(
    `${STORAGE_KEYS.MESSAGES}_${message.conversationId}`,
    JSON.stringify(messages)
  )
}

export function deleteMessage(id: string): void {
  // 需要遍历所有会话的消息
  const conversations = getConversations()
  conversations.forEach(conv => {
    const messages = getMessages(conv.id).filter(m => m.id !== id)
    localStorage.setItem(
      `${STORAGE_KEYS.MESSAGES}_${conv.id}`,
      JSON.stringify(messages)
    )
  })
}

export function clearMessages(conversationId: string): void {
  localStorage.removeItem(`${STORAGE_KEYS.MESSAGES}_${conversationId}`)
}

// Settings
export interface Settings {
  apiKey?: string
  baseUrl?: string
  defaultModel?: string
  theme?: 'light' | 'dark' | 'gradient'
  fontSize?: number
  codeFont?: string
}

export function getSettings(): Settings {
  const data = localStorage.getItem(STORAGE_KEYS.SETTINGS)
  return data ? JSON.parse(data) : {
    defaultModel: 'sonnet',
    theme: 'light',
    fontSize: 14,
    codeFont: 'JetBrains Mono',
  }
}

export function saveSettings(settings: Partial<Settings>): void {
  const current = getSettings()
  const updated = { ...current, ...settings }
  localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(updated))
}

// Token 统计
export interface TokenStats {
  conversationId: string
  inputTokens: number
  outputTokens: number
  totalCost: number
}

export function saveTokenStats(conversationId: string, stats: TokenStats): void {
  const key = `codenova_tokens_${conversationId}`
  localStorage.setItem(key, JSON.stringify(stats))
}

export function getTokenStats(conversationId: string): TokenStats | null {
  const key = `codenova_tokens_${conversationId}`
  const data = localStorage.getItem(key)
  return data ? JSON.parse(data) : null
}
