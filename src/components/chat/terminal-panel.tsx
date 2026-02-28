'use client'

import { useEffect, useRef, useState } from 'react'
import { Terminal as TerminalIcon, Maximize2, Minimize2, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TerminalPanelProps {
    isExpanded?: boolean
    onToggleExpand?: () => void
}

export function TerminalPanel({ isExpanded, onToggleExpand }: TerminalPanelProps) {
    const terminalRef = useRef<HTMLDivElement>(null)
    const xtermRef = useRef<any>(null)
    const fitAddonRef = useRef<any>(null)
    const [isReady, setIsReady] = useState(false)
    const [isClient, setIsClient] = useState(false)

    // Mark client-side
    useEffect(() => {
        setIsClient(true)
    }, [])

    // Dynamically import xterm only on the client
    useEffect(() => {
        if (!isClient || !terminalRef.current || xtermRef.current) return

        let disposed = false

        const initTerminal = async () => {
            // Dynamic import to avoid SSR issues
            const { Terminal } = await import('xterm')
            const { FitAddon } = await import('xterm-addon-fit')
            // @ts-expect-error type missing
            await import('xterm/css/xterm.css')

            if (disposed || !terminalRef.current) return

            const xterm = new Terminal({
                theme: {
                    background: 'transparent',
                    foreground: '#e5e7eb',
                    cursor: '#e5e7eb',
                    selectionBackground: 'rgba(255,255,255,0.2)',
                    black: '#000000', red: '#ef4444', green: '#22c55e',
                    yellow: '#eab308', blue: '#3b82f6', magenta: '#d946ef',
                    cyan: '#06b6d4', white: '#ffffff',
                    brightBlack: '#6b7280', brightRed: '#f87171', brightGreen: '#4ade80',
                    brightYellow: '#fde047', brightBlue: '#60a5fa', brightMagenta: '#e879f9',
                    brightCyan: '#22d3ee', brightWhite: '#ffffff',
                },
                fontFamily: 'JetBrains Mono, Menlo, Monaco, Consolas, monospace',
                fontSize: 13,
                lineHeight: 1.2,
                cursorBlink: true,
                allowTransparency: true,
            })

            const fitAddon = new FitAddon()
            xterm.loadAddon(fitAddon)
            xterm.open(terminalRef.current)

            // Wait a tick before fitting to ensure layout is calculated
            setTimeout(() => fitAddon.fit(), 100)

            xtermRef.current = xterm
            fitAddonRef.current = fitAddon

            xterm.writeln('\x1b[1;36mCodeNova Terminal\x1b[0m')
            xterm.writeln('\x1b[38;5;244mConnected to local environment.\x1b[0m')
            xterm.write('\r\n$ ')

            // Hook into Electron IPC if available
            const api = (window as any).electronAPI
            if (api?.createTerminal) {
                api.createTerminal()
                xterm.onData((data: string) => api.sendTerminalData(data))
                api.onTerminalData((data: string) => xtermRef.current?.write(data))
            } else {
                // fallback echo mode
                xterm.onData((data: string) => {
                    if (data === '\r') xterm.write('\r\n$ ')
                    else if (data === '\x7f') xterm.write('\b \b')
                    else xterm.write(data)
                })
            }

            setIsReady(true)

            const handleResize = () => {
                try { fitAddonRef.current?.fit() } catch { }
            }
            window.addEventListener('resize', handleResize)

            return () => window.removeEventListener('resize', handleResize)
        }

        initTerminal()

        return () => {
            disposed = true
            if (xtermRef.current) {
                xtermRef.current.dispose()
                xtermRef.current = null
            }
        }
    }, [isClient])

    // Re-fit when expand state changes
    useEffect(() => {
        if (isReady) {
            setTimeout(() => {
                try { fitAddonRef.current?.fit() } catch { }
            }, 100)
        }
    }, [isExpanded, isReady])

    const clearTerminal = () => {
        if (xtermRef.current) {
            xtermRef.current.clear()
        }
    }

    if (!isClient) return null

    return (
        <div className={cn(
            "flex flex-col h-full border-t border-white/10 overflow-hidden",
            "bg-[#0d0d0d]/80 backdrop-blur"
        )}>
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-1.5 bg-black/30 border-b border-white/10 shrink-0">
                <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
                    <TerminalIcon className="w-3.5 h-3.5" />
                    <span>Terminal</span>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={clearTerminal}
                        className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors"
                        title="Clear"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    {onToggleExpand && (
                        <button
                            onClick={onToggleExpand}
                            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors"
                            title={isExpanded ? 'Collapse' : 'Expand'}
                        >
                            {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                        </button>
                    )}
                </div>
            </div>

            {/* Xterm mount point */}
            <div className="flex-1 overflow-hidden relative">
                <div ref={terminalRef} className="absolute inset-0 p-1" />
            </div>
        </div>
    )
}
