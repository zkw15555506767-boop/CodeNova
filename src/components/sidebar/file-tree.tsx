'use client'

import { useState, useEffect, useCallback } from 'react'
import { FolderOpen, File, ChevronRight, ChevronDown, RefreshCw, Home, Search, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FileNode {
  name: string
  isDirectory: boolean
  path: string
  children?: FileNode[]
  expanded?: boolean
  loading?: boolean
}

interface FileTreeProps {
  rootPath: string
  onPathChange: (path: string) => void
}

export function FileTree({ rootPath, onPathChange }: FileTreeProps) {
  const [files, setFiles] = useState<FileNode[]>([])
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    if (!rootPath) return
    loadFiles(rootPath)
  }, [rootPath])

  const loadFiles = async (dirPath: string) => {
    if (!window.electronAPI) return

    const entries = await window.electronAPI.readDir(dirPath)
    const fileNodes: FileNode[] = entries
      .filter(entry => !entry.name.startsWith('.'))
      .sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1
        if (!a.isDirectory && b.isDirectory) return 1
        return a.name.localeCompare(b.name)
      })
      .map(entry => ({
        name: entry.name,
        isDirectory: entry.isDirectory,
        path: entry.path,
        expanded: false,
        children: [],
      }))
    setFiles(fileNodes)
  }

  const toggleDirectory = async (node: FileNode) => {
    if (!node.isDirectory) return

    // 如果未加载子目录，则加载
    if (!node.children || node.children.length === 0) {
      const entries = await window.electronAPI?.readDir(node.path)
      if (entries) {
        const children: FileNode[] = entries
          .filter(entry => !entry.name.startsWith('.'))
          .sort((a, b) => {
            if (a.isDirectory && !b.isDirectory) return -1
            if (!a.isDirectory && b.isDirectory) return 1
            return a.name.localeCompare(b.name)
          })
          .map(entry => ({
            name: entry.name,
            isDirectory: entry.isDirectory,
            path: entry.path,
            expanded: false,
            children: [],
          }))

        const updateWithChildren = (nodes: FileNode[]): FileNode[] => {
          return nodes.map(n => {
            if (n.path === node.path) {
              return { ...n, expanded: !n.expanded, children }
            }
            if (n.children) {
              return { ...n, children: updateWithChildren(n.children) }
            }
            return n
          })
        }
        setFiles(prev => updateWithChildren(prev))
      }
    } else {
      // 切换展开状态
      const updateNodes = (nodes: FileNode[]): FileNode[] => {
        return nodes.map(n => {
          if (n.path === node.path) {
            return { ...n, expanded: !n.expanded }
          }
          if (n.children) {
            return { ...n, children: updateNodes(n.children) }
          }
          return n
        })
      }
      setFiles(prev => updateNodes(prev))
    }
  }

  const handleSelectFile = (node: FileNode) => {
    if (node.isDirectory) {
      toggleDirectory(node)
    } else {
      setSelectedFile(node.path)
    }
  }

  const getFileIcon = (name: string, isDirectory: boolean) => {
    if (isDirectory) {
      return <FolderOpen className="w-4 h-4 text-yellow-500" />
    }

    const ext = name.split('.').pop()?.toLowerCase()

    switch (ext) {
      case 'js':
      case 'jsx':
      case 'ts':
      case 'tsx':
        return <span className="text-xs font-bold text-yellow-500">JS</span>
      case 'json':
        return <span className="text-xs font-bold text-green-500">{ }</span>
      case 'md':
        return <span className="text-xs font-bold text-blue-500">MD</span>
      case 'css':
      case 'scss':
        return <span className="text-xs font-bold text-purple-500">CSS</span>
      case 'html':
        return <span className="text-xs font-bold text-orange-500">HTML</span>
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'gif':
      case 'webp':
        return <span className="text-xs font-bold text-pink-500">IMG</span>
      case 'pdf':
        return <span className="text-xs font-bold text-red-500">PDF</span>
      default:
        return <File className="w-4 h-4 text-muted-foreground" />
    }
  }

  const filteredFiles = searchQuery
    ? filterFiles(files, searchQuery.toLowerCase())
    : files

  const handleOpenFolder = async () => {
    if (!window.electronAPI) {
      alert('此功能仅在桌面应用中可用')
      return
    }
    const dirPath = await window.electronAPI.selectDirectory()
    if (dirPath) {
      onPathChange(dirPath)
    }
  }

  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, node: FileNode | null } | null>(null)

  useEffect(() => {
    const handleClickOutside = () => setContextMenu(null)
    window.addEventListener('click', handleClickOutside)
    return () => window.removeEventListener('click', handleClickOutside)
  }, [])

  const handleContextMenu = (e: React.MouseEvent, node: FileNode) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY, node })
  }

  const handleCopyPath = () => {
    if (contextMenu?.node) {
      navigator.clipboard.writeText(contextMenu.node.path)
    }
  }

  const handleDelete = async () => {
    if (contextMenu?.node && window.electronAPI?.deletePath) {
      if (confirm(`确定要删除 ${contextMenu.node.name} 吗？\n警告：删除后无法恢复！`)) {
        const res = await window.electronAPI.deletePath(contextMenu.node.path)
        if (res.success) {
          loadFiles(rootPath) // 刷新当前根目录（或者优化为局部刷新）
        } else {
          alert(`删除失败: ${res.error}`)
        }
      }
    }
  }

  return (
    <div className="h-full flex flex-col bg-card relative">
      {/* 头部 */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="font-medium text-sm">文件</span>
        <div className="flex items-center gap-1">
          <button
            onClick={handleOpenFolder}
            className="p-1.5 rounded hover:bg-primary/10 text-primary"
            title="打开文件夹"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            onClick={() => loadFiles(rootPath)}
            className="p-1 rounded hover:bg-muted"
            title="刷新"
          >
            <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* 搜索 */}
      <div className="px-2 py-2 border-b border-border">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索文件..."
            className="w-full pl-7 pr-2 py-1 text-xs rounded bg-muted/50 border-0 focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {/* 当前路径 */}
      <div className="px-3 py-2 text-xs text-muted-foreground truncate border-b border-border" title={rootPath}>
        {rootPath}
      </div>

      {/* 文件树 */}
      <div className="flex-1 overflow-y-auto p-2" onContextMenu={(e) => e.preventDefault()}>
        <FileTreeNodes
          nodes={filteredFiles}
          selectedPath={selectedFile}
          onSelect={handleSelectFile}
          onContextMenu={handleContextMenu}
          level={0}
        />
      </div>

      {/* 右键菜单 */}
      {contextMenu && (
        <div
          className="fixed z-50 min-w-[150px] bg-background/95 backdrop-blur shadow-xl border border-white/10 rounded-md py-1 text-sm overflow-hidden"
          style={{
            left: Math.min(contextMenu.x, window.innerWidth - 160),
            top: Math.min(contextMenu.y, window.innerHeight - 100)
          }}
        >
          <div className="px-3 py-1.5 text-xs text-muted-foreground/50 font-mono truncate border-b border-white/5 mb-1">
            {contextMenu.node?.name}
          </div>
          <button
            className="w-full text-left px-4 py-1.5 hover:bg-primary/10 transition-colors"
            onClick={handleCopyPath}
          >
            复制完整路径
          </button>
          <button
            className="w-full text-left px-4 py-1.5 hover:bg-destructive/10 text-destructive transition-colors"
            onClick={handleDelete}
          >
            删除
          </button>
        </div>
      )}
    </div>
  )
}

interface FileTreeNodesProps {
  nodes: FileNode[]
  selectedPath: string | null
  onSelect: (node: FileNode) => void
  onContextMenu: (e: React.MouseEvent, node: FileNode) => void
  level: number
}

function FileTreeNodes({ nodes, selectedPath, onSelect, onContextMenu, level }: FileTreeNodesProps) {
  return (
    <div className="space-y-0.5">
      {nodes.map((node) => (
        <div key={node.path}>
          <div
            draggable={!node.isDirectory}
            onDragStart={(e) => {
              if (!node.isDirectory) {
                e.dataTransfer.setData('application/json', JSON.stringify(node))
                e.dataTransfer.effectAllowed = 'copy'
              }
            }}
            onClick={() => {
              onSelect(node)
              if (!node.isDirectory) {
                window.dispatchEvent(
                  new CustomEvent('file-add-to-chat', { detail: { path: node.path, name: node.name } })
                )
              }
            }}
            onContextMenu={(e) => onContextMenu(e, node)}
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded cursor-pointer text-sm hover:bg-muted transition-colors select-none",
              selectedPath === node.path && "bg-primary/10 text-primary",
              level > 0 && "ml-3"
            )}
          >
            {node.isDirectory ? (
              node.expanded ? (
                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
              )
            ) : (
              <span className="w-3.5" />
            )}
            {getFileIcon(node.name, node.isDirectory)}
            <span className="truncate">{node.name}</span>
          </div>

          {node.isDirectory && node.expanded && node.children && (
            <FileTreeNodes
              nodes={node.children}
              selectedPath={selectedPath}
              onSelect={onSelect}
              onContextMenu={onContextMenu}
              level={level + 1}
            />
          )}
        </div>
      ))}
    </div>
  )
}

function getFileIcon(name: string, isDirectory: boolean) {
  if (isDirectory) {
    return <FolderOpen className="w-4 h-4 text-yellow-500" />
  }

  const ext = name.split('.').pop()?.toLowerCase()

  switch (ext) {
    case 'js':
    case 'jsx':
    case 'ts':
    case 'tsx':
      return <span className="text-xs font-bold text-yellow-500">JS</span>
    case 'json':
      return <span className="text-xs font-bold text-green-500">{ }</span>
    case 'md':
      return <span className="text-xs font-bold text-blue-500">MD</span>
    default:
      return <File className="w-4 h-4 text-muted-foreground" />
  }
}

function filterFiles(nodes: FileNode[], query: string): FileNode[] {
  const result: FileNode[] = []

  for (const node of nodes) {
    if (node.name.toLowerCase().includes(query)) {
      result.push(node)
    } else if (node.isDirectory && node.children) {
      const filteredChildren = filterFiles(node.children, query)
      if (filteredChildren.length > 0) {
        result.push({ ...node, children: filteredChildren, expanded: true })
      }
    }
  }

  return result
}
