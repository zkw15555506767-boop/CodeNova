'use client'

import { useState, useEffect } from 'react'
import { FolderOpen, File, ChevronRight, ChevronDown, RefreshCw, Home, Eye, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FileNode {
  name: string
  isDirectory: boolean
  path: string
  children?: FileNode[]
  expanded?: boolean
}

export function FilePanel() {
  const [rootPath, setRootPath] = useState<string>('')
  const [files, setFiles] = useState<FileNode[]>([])
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [previewContent, setPreviewContent] = useState<{ name: string; content: string; type: string } | null>(null)

  useEffect(() => {
    // 默认打开用户主目录
    const loadDefaultPath = async () => {
      if (window.electronAPI) {
        const homePath = await window.electronAPI.getPath('home')
        setRootPath(homePath)
        loadFiles(homePath)
      }
    }
    loadDefaultPath()
  }, [])

  const loadFiles = async (dirPath: string) => {
    if (!window.electronAPI || !dirPath) return

    const entries = await window.electronAPI.readDir(dirPath)
    const fileNodes: FileNode[] = entries
      .filter(entry => !entry.name.startsWith('.')) // 过滤隐藏文件
      .sort((a, b) => {
        // 文件夹在前
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

    // 找到节点并切换展开状态
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
      setFiles(prev => updateNodes(prev))
    }
  }

  const handleSelectFile = async (node: FileNode) => {
    if (node.isDirectory) {
      toggleDirectory(node)
    } else {
      setSelectedFile(node.path)

      // 读取文件内容用于预览
      const result = await window.electronAPI?.readFile(node.path)
      if (result?.success && result.content) {
        const ext = node.name.split('.').pop() || ''
        const content = atob(result.content)
        setPreviewContent({
          name: node.name,
          content,
          type: ext,
        })
      }
    }
  }

  const handleSelectDirectory = async () => {
    const dirPath = await window.electronAPI?.selectDirectory()
    if (dirPath) {
      setRootPath(dirPath)
      loadFiles(dirPath)
      setPreviewContent(null)
    }
  }

  const getFileIcon = (name: string, isDirectory: boolean) => {
    if (isDirectory) {
      return <FolderOpen className="w-4 h-4 text-yellow-500" />
    }

    // 根据扩展名返回不同图标
    const ext = name.split('.').pop()?.toLowerCase()
    const iconClass = "w-4 h-4"

    switch (ext) {
      case 'js':
      case 'jsx':
      case 'ts':
      case 'tsx':
        return <span className="text-xs font-bold text-yellow-500">JS</span>
      case 'json':
        return <span className="text-xs font-bold text-green-500">{}</span>
      case 'md':
        return <span className="text-xs font-bold text-blue-500">M↓</span>
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
        return <File className={iconClass} />
    }
  }

  return (
    <div className="w-72 h-full flex flex-col bg-card border-l border-border">
      {/* 头部 */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">文件</span>
          <button
            onClick={() => loadFiles(rootPath)}
            className="p-1 rounded hover:bg-muted"
            title="刷新"
          >
            <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
          <button
            onClick={handleSelectDirectory}
            className="p-1 rounded hover:bg-muted"
            title="选择目录"
          >
            <Home className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* 当前路径 */}
      <div className="px-3 py-2 text-xs text-muted-foreground truncate border-b border-border" title={rootPath}>
        {rootPath}
      </div>

      {/* 文件树 */}
      <div className="flex-1 overflow-y-auto p-2">
        <FileTree
          nodes={files}
          selectedPath={selectedFile}
          onSelect={handleSelectFile}
        />
      </div>

      {/* 文件预览 */}
      {previewContent && (
        <div className="border-t border-border">
          <div className="flex items-center justify-between px-3 py-2 bg-muted/30">
            <span className="text-xs font-medium truncate">{previewContent.name}</span>
            <button
              onClick={() => setPreviewContent(null)}
              className="p-1 rounded hover:bg-muted"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
          <div className="h-48 overflow-auto p-2 bg-background">
            <pre className="text-xs whitespace-pre-wrap font-mono">{previewContent.content.slice(0, 2000)}</pre>
            {previewContent.content.length > 2000 && (
              <p className="text-xs text-muted-foreground mt-2">... (还有 {previewContent.content.length - 2000} 字符)</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

interface FileTreeProps {
  nodes: FileNode[]
  selectedPath: string | null
  onSelect: (node: FileNode) => void
  level?: number
}

function FileTree({ nodes, selectedPath, onSelect, level = 0 }: FileTreeProps) {
  return (
    <div className="space-y-0.5">
      {nodes.map((node) => (
        <div key={node.path}>
          <div
            onClick={() => onSelect(node)}
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded cursor-pointer text-sm hover:bg-muted transition-colors",
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
            <FileTree
              nodes={node.children}
              selectedPath={selectedPath}
              onSelect={onSelect}
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
      return <span className="text-xs font-bold text-green-500">{}</span>
    case 'md':
      return <span className="text-xs font-bold text-blue-500">M↓</span>
    case 'css':
    case 'scss':
      return <span className="text-xs font-bold text-purple-500">CSS</span>
    default:
      return <File className="w-4 h-4 text-muted-foreground" />
  }
}
