'use client'

import { useState, useEffect, useCallback } from 'react'

export interface MCPServer {
  id: string
  name: string
  type: 'stdio' | 'sse' | 'http'
  command?: string
  args?: string[]
  env?: Record<string, string>
  url?: string
  headers?: Record<string, string>
  enabled: boolean
}

const STORAGE_KEY = 'codenova_mcp_servers'

export function useMCPServers() {
  const [servers, setServers] = useState<MCPServer[]>([])

  // 加载服务器
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        setServers(JSON.parse(stored))
      } catch (e) {
        console.error('Failed to parse MCP servers:', e)
      }
    }
  }, [])

  // 保存服务器
  const saveServers = useCallback((servers: MCPServer[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(servers))
    setServers(servers)
  }, [])

  const addServer = useCallback((server: Omit<MCPServer, 'id'>) => {
    const newServer: MCPServer = {
      ...server,
      id: Date.now().toString(),
    }
    saveServers([...servers, newServer])
    return newServer
  }, [servers, saveServers])

  const updateServer = useCallback((id: string, updates: Partial<MCPServer>) => {
    const updated = servers.map(s =>
      s.id === id ? { ...s, ...updates } : s
    )
    saveServers(updated)
  }, [servers, saveServers])

  const deleteServer = useCallback((id: string) => {
    const filtered = servers.filter(s => s.id !== id)
    saveServers(filtered)
  }, [servers, saveServers])

  const toggleServer = useCallback((id: string) => {
    const updated = servers.map(s =>
      s.id === id ? { ...s, enabled: !s.enabled } : s
    )
    saveServers(updated)
  }, [servers, saveServers])

  return {
    servers,
    addServer,
    updateServer,
    deleteServer,
    toggleServer,
  }
}
