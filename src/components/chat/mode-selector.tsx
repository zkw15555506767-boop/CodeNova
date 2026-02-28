'use client'

import { Code2, PenTool, MessageCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ModeSelectorProps {
  mode: 'chat' | 'code' | 'plan'
  onModeChange: (mode: 'chat' | 'code' | 'plan') => void
}

const modes = [
  { value: 'chat', label: '对话', icon: MessageCircle },
  { value: 'code', label: '代码', icon: Code2 },
  { value: 'plan', label: '规划', icon: PenTool },
] as const

export function ModeSelector({ mode, onModeChange }: ModeSelectorProps) {
  return (
    <div className="flex items-center gap-1 p-1 bg-background/70 border border-white/10 rounded-lg backdrop-blur shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
      {modes.map((m) => {
        const Icon = m.icon
        const isActive = mode === m.value

        return (
          <button
            key={m.value}
            onClick={() => onModeChange(m.value)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all",
              isActive
                ? "bg-primary/15 text-primary border border-primary/30 shadow-[0_6px_16px_-12px_rgba(0,0,0,0.5)]"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="w-4 h-4" />
            <span>{m.label}</span>
          </button>
        )
      })}
    </div>
  )
}
