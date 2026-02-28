'use client'

import { useState } from 'react'
import { ChevronDown, Check, Zap, Brain, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ModelSelectorProps {
  model: string
  onModelChange: (model: string) => void
}

const models = [
  { value: 'opus', label: 'Opus', description: '最强大', icon: Brain },
  { value: 'sonnet', label: 'Sonnet', description: '平衡', icon: Zap },
  { value: 'minimax', label: 'MiniMax', description: '免费快速', icon: Sparkles },
] as const

export function ModelSelector({ model, onModelChange }: ModelSelectorProps) {
  const [open, setOpen] = useState(false)

  const currentModel = models.find(m => m.value === model) || models[1]
  const CurrentIcon = currentModel.icon

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/10 bg-background/70 hover:bg-background/90 transition-colors text-sm backdrop-blur shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
      >
        <CurrentIcon className="w-4 h-4 text-primary" />
        <span>{currentModel.label}</span>
        <span className="text-xs text-muted-foreground">• {currentModel.description}</span>
        <ChevronDown className={cn(
          "w-4 h-4 text-muted-foreground transition-transform",
          open && "rotate-180"
        )} />
      </button>

      {open && (
        <>
          {/* 遮罩层 */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
          />

          {/* 下拉菜单 */}
          <div className="absolute right-0 top-full mt-1 w-48 py-1 rounded-lg border border-white/10 bg-background/80 backdrop-blur shadow-[0_20px_40px_-25px_rgba(0,0,0,0.6)] z-20">
            {models.map((m) => {
              const Icon = m.icon
              const isActive = model === m.value

              return (
                <button
                  key={m.value}
                  onClick={() => {
                    onModelChange(m.value)
                    setOpen(false)
                  }}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-background/60 transition-colors",
                    isActive && "bg-primary/10"
                  )}
                >
                  <Icon className="w-4 h-4 text-primary" />
                  <div className="flex-1 text-left">
                    <div className="font-medium">{m.label}</div>
                    <div className="text-xs text-muted-foreground">{m.description}</div>
                  </div>
                  {isActive && <Check className="w-4 h-4 text-primary" />}
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
