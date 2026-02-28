'use client'

import { useState, useEffect, useCallback } from 'react'

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

const STORAGE_KEY = 'codenova_conversations'

export function useConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([])

  // 从 localStorage 加载
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        setConversations(JSON.parse(stored))
      } catch (e) {
        console.error('Failed to parse conversations:', e)
      }
    }
  }, [])

  // 保存到 localStorage
  const saveConversations = useCallback((convs: Conversation[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(convs))
    setConversations(convs)
  }, [])

  const createConversation = useCallback((title?: string): Conversation => {
    const newConv: Conversation = {
      id: Date.now().toString(),
      title: title || '新对话',
      model: 'sonnet',
      mode: 'chat',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      archived: false,
    }
    saveConversations([newConv, ...conversations])
    return newConv
  }, [conversations, saveConversations])

  const updateConversation = useCallback((id: string, updates: Partial<Conversation>) => {
    setConversations(prev => {
      const updated = prev.map(c =>
        c.id === id ? { ...c, ...updates, updatedAt: Date.now() } : c
      )
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
      return updated
    })
  }, [])

  const archiveConversation = useCallback((id: string) => {
    const updated = conversations.map(c =>
      c.id === id ? { ...c, archived: !c.archived, updatedAt: Date.now() } : c
    )
    saveConversations(updated)
  }, [conversations, saveConversations])

  const deleteConversation = useCallback((id: string) => {
    const filtered = conversations.filter(c => c.id !== id)
    saveConversations(filtered)
    // 同时删除消息
    localStorage.removeItem(`codenova_messages_${id}`)
  }, [conversations, saveConversations])

  return {
    conversations,
    createConversation,
    updateConversation,
    archiveConversation,
    deleteConversation,
  }
}
