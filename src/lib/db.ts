// 数据库操作 - 实际使用 better-sqlite3
// 注意：这是前端导入的 API 客户端，实际数据库操作在服务端进行

export interface Conversation {
  id: string
  title: string
  model: string
  mode: string
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

// API 函数
export async function getConversations(): Promise<Conversation[]> {
  const response = await fetch('/api/conversations')
  return response.json()
}

export async function createConversation(data: Partial<Conversation>): Promise<Conversation> {
  const response = await fetch('/api/conversations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  return response.json()
}

export async function updateConversation(id: string, data: Partial<Conversation>): Promise<void> {
  await fetch(`/api/conversations/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

export async function deleteConversation(id: string): Promise<void> {
  await fetch(`/api/conversations/${id}`, {
    method: 'DELETE',
  })
}

export async function getMessages(conversationId: string): Promise<Message[]> {
  const response = await fetch(`/api/conversations/${conversationId}/messages`)
  return response.json()
}

export async function saveMessage(message: Partial<Message>): Promise<Message> {
  const response = await fetch('/api/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(message),
  })
  return response.json()
}

export interface Settings {
  key: string
  value: string
}

export async function getSettings(): Promise<Settings[]> {
  const response = await fetch('/api/settings')
  return response.json()
}

export async function saveSetting(key: string, value: string): Promise<void> {
  await fetch('/api/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, value }),
  })
}
