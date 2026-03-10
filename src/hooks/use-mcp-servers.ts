'use client'

import { useState, useEffect, useCallback } from 'react'

export interface MCPServer {
  id: string // 使用对象 key 作为 id
  name: string // 名字
  type: 'stdio' | 'sse' | 'http'
  command?: string
  args?: string[]
  env?: Record<string, string>
  url?: string
  headers?: Record<string, string>
  enabled: boolean
}

export function useMCPServers() {
  const [servers, setServers] = useState<MCPServer[]>([])

  const loadServers = useCallback(async () => {
    const api = (window as any).electronAPI
    if (!api?.getMcpConfig) return

    try {
      const config = await api.getMcpConfig()
      const mcpServers = config?.mcpServers || {}

      const serverList: MCPServer[] = Object.entries(mcpServers).map(([key, val]: [string, any]) => ({
        id: key,
        name: key,
        type: val.url ? (val.url.startsWith('http') ? 'sse' : 'stdio') : 'stdio',
        command: val.command,
        args: val.args,
        env: val.env,
        url: val.url,
        enabled: !val.disabled
      }))
      setServers(serverList)
    } catch (e) {
      console.error('Failed to load MCP servers:', e)
    }
  }, [])

  useEffect(() => {
    loadServers()
  }, [loadServers])

  const saveServers = async (newServers: MCPServer[]) => {
    const api = (window as any).electronAPI
    if (!api?.saveMcpConfig) return

    const mcpServersMap: Record<string, any> = {}
    newServers.forEach(s => {
      mcpServersMap[s.id] = {
        command: s.command,
        args: Array.isArray(s.args) ? s.args : (s.args ? (s.args as string).split(' ').filter(Boolean) : undefined),
        env: s.env,
        url: s.url,
        disabled: !s.enabled
      }

      // Cleanup undefined to keep JSON clean
      if (!mcpServersMap[s.id].command) delete mcpServersMap[s.id].command
      if (!mcpServersMap[s.id].url) delete mcpServersMap[s.id].url
      if (!mcpServersMap[s.id].args || mcpServersMap[s.id].args.length === 0) delete mcpServersMap[s.id].args
      if (!mcpServersMap[s.id].env || Object.keys(mcpServersMap[s.id].env).length === 0) delete mcpServersMap[s.id].env
    })

    try {
      await api.saveMcpConfig({ mcpServers: mcpServersMap })
      setServers(newServers)
    } catch (e) {
      console.error('Failed to save MCP servers:', e)
    }
  }

  const addServer = (server: Omit<MCPServer, 'id'>) => {
    saveServers([...servers, { ...server, id: server.name }])
  }

  const updateServer = (id: string, updates: Partial<MCPServer>) => {
    saveServers(servers.map(s => s.id === id ? { ...s, ...updates } : s))
  }

  const deleteServer = (id: string) => {
    saveServers(servers.filter(s => s.id !== id))
  }

  const toggleServer = (id: string) => {
    saveServers(servers.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s))
  }

  return {
    servers,
    addServer,
    updateServer,
    deleteServer,
    toggleServer,
    refresh: loadServers
  }
}
