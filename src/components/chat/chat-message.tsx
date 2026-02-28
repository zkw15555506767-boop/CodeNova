'use client'

import { useState, memo, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { Copy, Check, ThumbsUp, ThumbsDown, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { InteractiveToolBlock, ToolStatus } from './interactive-tool-block'

/** A single parsed tool call, extracted from <minimax:tool_call> XML */
interface ParsedTool {
  toolId: string
  toolName: string
  parameters: Record<string, string>
}

/**
 * Parse all <minimax:tool_call> blocks from a message string.
 * Returns the clean text (with XML blocks stripped) and the extracted tools.
 */
function parseToolCalls(content: string): { cleanText: string; tools: ParsedTool[] } {
  const tools: ParsedTool[] = []
  let idx = 0

  const cleanText = content.replace(
    /<minimax:tool_call>([\s\S]*?)<\/minimax:tool_call>/g,
    (match) => {
      const toolNameMatch = match.match(/<invoke name="([^"]+)"/)
      const toolName = toolNameMatch ? toolNameMatch[1] : 'unknown_tool'

      const parameters: Record<string, string> = {}
      const paramRegex = /<parameter name="([^"]+)">([^<]*)<\/parameter>/g
      let paramMatch: RegExpExecArray | null
      while ((paramMatch = paramRegex.exec(match)) !== null) {
        parameters[paramMatch[1]] = paramMatch[2].trim()
      }

      const toolId = `tool-${idx++}-${toolName}`
      tools.push({ toolId, toolName, parameters })

      return '' // strip from text
    }
  )

  return { cleanText: cleanText.trim(), tools }
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: number
  isStreaming?: boolean
  tokenCount?: number
  error?: string
  toolApprovals?: Record<string, ToolStatus>
}

interface ChatMessageProps {
  message: Message
  usage?: { input_tokens?: number; output_tokens?: number }
  onToolApproval?: (toolId: string, approved: boolean) => void
}

export const ChatMessage = memo(function ChatMessage({ message, usage, onToolApproval }: ChatMessageProps) {
  const [copied, setCopied] = useState(false)

  const isUser = message.role === 'user'

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleCopyCode = async (code: string) => {
    await navigator.clipboard.writeText(code)
  }

  // 处理显示内容：隐藏用户消息中用于传递给大模型的 <file_context> 大段文件源码，避免撑爆 UI
  const displayContent = isUser
    ? message.content.replace(/<file_context path="([^"]+)">[\s\S]*?<\/file_context>/g, '> 📎 附加了文件上下文: `$1`\n')
    : message.content

  // Parse tool calls from assistant messages
  const { cleanText, tools } = isUser || message.isStreaming
    ? { cleanText: displayContent, tools: [] }
    : parseToolCalls(displayContent)

  const handleApprove = useCallback(async (tool: ParsedTool) => {
    const api = (window as any).electronAPI
    if (!api) return

    const toolName = tool.toolName
    const params = tool.parameters

    // Execute based on tool type
    if (toolName === 'execute_command' || toolName === 'run_terminal_cmd' || toolName === 'bash') {
      const cmd = params.command || params.cmd || Object.values(params)[0] || ''
      if (cmd && api.sendTerminalData) {
        api.sendTerminalData(cmd + '\r')
      }
    } else if (toolName === 'write_to_file' || toolName === 'create_file') {
      const path = params.path || params.file_path || ''
      const content = params.content || ''
      if (path && content && api.writeFile) {
        await api.writeFile(path, content)
      }
    }
    // Notify parent
    onToolApproval?.(tool.toolId, true)
  }, [onToolApproval])

  const handleReject = useCallback((toolId: string) => {
    onToolApproval?.(toolId, false)
  }, [onToolApproval])

  return (
    <div className={cn(
      "group flex gap-3",
      isUser ? "flex-row-reverse" : "flex-row"
    )}>
      {/* 头像 */}
      <div className={cn(
        "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-medium",
        isUser
          ? "bg-primary text-primary-foreground"
          : "bg-gradient-to-br from-blue-500 to-violet-600 text-white shadow-lg shadow-blue-500/20"
      )}>
        {isUser ? '你' : 'N'}
      </div>

      {/* 消息内容 */}
      <div className={cn(
        "flex-1 max-w-[85%]",
        isUser ? "items-end" : "items-start"
      )}>
        <div className={cn(
          "rounded-2xl px-4 py-3",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted/80 border border-white/5"
        )}>
          {/* 错误状态 */}
          {message.error && (
            <div className="text-red-400 text-sm mb-2 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
              {message.error}
            </div>
          )}

          {/* Markdown 渲染 */}
          <div className={cn(
            "prose prose-sm max-w-none",
            isUser ? "prose-invert" : "dark:prose-invert",
            "[&_p]:mb-2 [&_p:last-child]:mb-0",
            "[&_ul]:my-1 [&_ol]:my-1",
            "[&_li]:my-0.5",
            "[&_h1]:text-lg [&_h2]:text-base [&_h3]:text-sm",
            "[&_h1]:mt-3 [&_h2]:mt-2 [&_h3]:mt-1.5",
            "[&_blockquote]:border-l-primary/50 [&_blockquote]:text-muted-foreground",
            "[&_a]:text-blue-400 [&_a]:no-underline hover:[&_a]:underline",
            "[&_table]:text-xs [&_th]:px-2 [&_td]:px-2",
          )}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code({ className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || '')
                  const codeString = String(children).replace(/\n$/, '')

                  if (!match) {
                    return (
                      <code className="px-1.5 py-0.5 rounded bg-black/20 dark:bg-white/10 text-sm font-mono" {...props}>
                        {children}
                      </code>
                    )
                  }

                  return (
                    <div className="relative group/code my-3 rounded-lg overflow-hidden border border-white/10">
                      <div className="flex items-center justify-between px-3 py-1.5 bg-black/30 border-b border-white/10">
                        <span className="text-xs text-muted-foreground uppercase tracking-wider">{match[1]}</span>
                        <button
                          onClick={() => handleCopyCode(codeString)}
                          className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                        >
                          <Copy className="w-3 h-3" />
                          复制
                        </button>
                      </div>
                      <SyntaxHighlighter
                        style={oneDark}
                        language={match[1]}
                        PreTag="div"
                        customStyle={{
                          margin: 0,
                          padding: '12px 16px',
                          background: 'rgba(0,0,0,0.4)',
                          fontSize: '13px',
                          lineHeight: '1.5',
                        }}
                      >
                        {codeString}
                      </SyntaxHighlighter>
                    </div>
                  )
                },
                pre({ children }) {
                  return <>{children}</>
                },
                table({ children }) {
                  return (
                    <div className="overflow-x-auto my-2 rounded-lg border border-white/10">
                      <table className="w-full">{children}</table>
                    </div>
                  )
                },
                th({ children }) {
                  return <th className="bg-black/20 px-3 py-1.5 text-left text-xs font-medium">{children}</th>
                },
                td({ children }) {
                  return <td className="px-3 py-1.5 border-t border-white/5 text-xs">{children}</td>
                },
              }}
            >
              {cleanText || (message.isStreaming ? '' : '')}
            </ReactMarkdown>
          </div>

          {/* 流式输出指示器 */}
          {message.isStreaming && !message.content && (
            <div className="flex items-center gap-1.5 py-1">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-blue-400/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-violet-400/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-blue-400/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span className="text-xs text-muted-foreground">思考中...</span>
            </div>
          )}

          {/* 流式输出时的光标 */}
          {message.isStreaming && message.content && (
            <span className="inline-block w-2 h-4 bg-primary/60 animate-pulse ml-0.5" />
          )}
        </div>

        {/* Interactive Tool Blocks - shown beneath message bubble */}
        {tools.length > 0 && (
          <div className="mt-2 space-y-2">
            {tools.map((tool) => {
              const status: ToolStatus = message.toolApprovals?.[tool.toolId] ?? 'pending'
              return (
                <InteractiveToolBlock
                  key={tool.toolId}
                  toolId={tool.toolId}
                  toolName={tool.toolName}
                  parameters={tool.parameters}
                  status={status}
                  onApprove={() => handleApprove(tool)}
                  onReject={() => handleReject(tool.toolId)}
                />
              )
            })}
          </div>
        )}

        {/* 操作按钮 + Token 统计 (仅 assistant) */}
        {!isUser && !message.isStreaming && message.content && (
          <div className="flex items-center gap-2 mt-1.5 ml-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="flex items-center gap-0.5">
              <button
                onClick={handleCopy}
                className="p-1.5 rounded-md hover:bg-muted text-muted-foreground transition-colors"
                title="复制"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
              <button
                className="p-1.5 rounded-md hover:bg-muted text-muted-foreground transition-colors"
                title="重新生成"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                className="p-1.5 rounded-md hover:bg-muted text-muted-foreground transition-colors"
                title="点赞"
              >
                <ThumbsUp className="w-3.5 h-3.5" />
              </button>
              <button
                className="p-1.5 rounded-md hover:bg-muted text-muted-foreground transition-colors"
                title="点踩"
              >
                <ThumbsDown className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Token 统计 */}
            {usage && (
              <div className="text-[10px] text-muted-foreground flex items-center gap-2 ml-2 px-2 py-0.5 rounded-full bg-muted/50">
                <span>↑{usage.input_tokens || 0}</span>
                <span>↓{usage.output_tokens || 0}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
})
