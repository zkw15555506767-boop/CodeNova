import { Terminal, FileCode, Check, X, ShieldAlert, Play, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ToolStatus = 'pending' | 'approved' | 'rejected'

export interface InteractiveToolBlockProps {
    toolId: string
    toolName: string
    parameters: Record<string, string>
    status: ToolStatus
    onApprove: () => void
    onReject: () => void
}

export function InteractiveToolBlock({
    toolId,
    toolName,
    parameters,
    status,
    onApprove,
    onReject,
}: InteractiveToolBlockProps) {
    const isCommand = toolName === 'execute_command' || toolName.includes('command')
    const isFile = toolName === 'write_to_file' || toolName === 'replace_file_content' || toolName.includes('file')

    return (
        <div className="my-3 rounded-xl border border-white/10 bg-black/40 overflow-hidden shadow-lg shadow-black/20 backdrop-blur-md">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-primary/20 to-transparent border-b border-white/5">
                <div className="flex items-center gap-2">
                    {isCommand ? (
                        <Terminal className="w-4 h-4 text-blue-400" />
                    ) : isFile ? (
                        <FileCode className="w-4 h-4 text-green-400" />
                    ) : (
                        <ShieldAlert className="w-4 h-4 text-orange-400" />
                    )}
                    <span className="text-xs font-semibold tracking-wide font-mono text-white/90">
                        {toolName}
                    </span>
                </div>

                {/* Status Badge */}
                {status === 'approved' && (
                    <div className="flex items-center gap-1 text-[10px] uppercase font-bold text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full border border-green-400/20 transition-all duration-300 animate-in fade-in zoom-in-95">
                        <Check className="w-3 h-3" />
                        已允许执行
                    </div>
                )}
                {status === 'rejected' && (
                    <div className="flex items-center gap-1 text-[10px] uppercase font-bold text-red-400 bg-red-400/10 px-2 py-0.5 rounded-full border border-red-400/20 transition-all duration-300 animate-in fade-in zoom-in-95">
                        <X className="w-3 h-3" />
                        已拦截
                    </div>
                )}
            </div>

            {/* Payload / Code Block */}
            <div className="p-3 text-xs font-mono text-muted-foreground bg-black/20 space-y-2 overflow-x-auto">
                {Object.entries(parameters).map(([key, value]) => (
                    <div key={key} className="flex flex-col gap-1.5">
                        <span className="text-[10px] text-white/40 uppercase tracking-widest select-none">{`// ${key}`}</span>
                        <span className="text-white/80 whitespace-pre-wrap leading-relaxed">{value}</span>
                    </div>
                ))}
            </div>

            {/* Actions */}
            {status === 'pending' && (
                <div className="flex items-center justify-end gap-2 px-3 py-2 bg-white/5 border-t border-white/5">
                    <button
                        onClick={onReject}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-md transition-all active:scale-95"
                    >
                        <XCircle className="w-3.5 h-3.5" />
                        拦截执行
                    </button>
                    <button
                        onClick={onApprove}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm shadow-primary/20 rounded-md transition-all active:scale-95"
                    >
                        <Play className="w-3.5 h-3.5" />
                        允许并执行
                    </button>
                </div>
            )}
        </div>
    )
}
