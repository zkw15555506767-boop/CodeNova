'use client'

import { useState, useEffect } from 'react'
import { FileCode2, PanelRight, Moon, Sun, Sparkles } from 'lucide-react'
import { Theme } from '@/hooks/use-theme'

interface TitleBarProps {
  theme: Theme
  onThemeChange: (theme: Theme) => void
  onToggleFilePanel: () => void
  showFilePanel: boolean
  onOpenSettings?: () => void
}

export function TitleBar({ theme, onThemeChange, onToggleFilePanel, showFilePanel, onOpenSettings }: TitleBarProps) {
  const [isMaximized, setIsMaximized] = useState(false)

  useEffect(() => {
    const checkMaximized = async () => {
      if (window.electronAPI) {
        const max = await window.electronAPI.isMaximized()
        setIsMaximized(max)
      }
    }
    checkMaximized()

    // 监听窗口变化
    const handleResize = () => {
      checkMaximized()
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const handleMinimize = () => {
    window.electronAPI?.minimizeWindow()
  }

  const handleMaximize = async () => {
    await window.electronAPI?.maximizeWindow()
    const max = await window.electronAPI?.isMaximized()
    setIsMaximized(max || false)
  }

  const handleClose = () => {
    window.electronAPI?.quitApp()
  }

  const cycleTheme = () => {
    const themes: Theme[] = ['light', 'dark', 'gradient']
    const currentIndex = themes.indexOf(theme)
    const nextIndex = (currentIndex + 1) % themes.length
    onThemeChange(themes[nextIndex])
  }

  const getThemeIcon = () => {
    switch (theme) {
      case 'light':
        return <Sun className="w-4 h-4" />
      case 'dark':
        return <Moon className="w-4 h-4" />
      case 'gradient':
        return <Sparkles className="w-4 h-4" />
    }
  }

  const getThemeLabel = () => {
    switch (theme) {
      case 'light':
        return '浅色'
      case 'dark':
        return '深色'
      case 'gradient':
        return '渐变'
    }
  }

  return (
    <div className="h-11 flex items-center justify-between bg-background/70 backdrop-blur border-b border-white/10 select-none shadow-[0_10px_30px_-25px_rgba(0,0,0,0.35)]"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* 左侧：Logo 和标题 */}
      <div className="flex items-center gap-2 px-4" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <div className="flex items-center gap-1.5">
          <FileCode2 className="w-5 h-5 text-primary" />
          <span className="font-semibold text-sm tracking-wide">CodeNova</span>
        </div>
      </div>

      {/* 中间：搜索栏 (可选) */}
      <div className="flex-1 max-w-md mx-4" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
        <div className="h-7 rounded-md bg-background/60 border border-white/10 flex items-center px-3 text-xs text-muted-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          搜索对话... (⌘K)
        </div>
      </div>

      {/* 右侧：操作按钮 */}
      <div className="flex items-center gap-1 pr-2" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        {/* 主题切换 */}
        <button
          onClick={cycleTheme}
          className="h-7 px-2 flex items-center gap-1.5 rounded-md bg-background/60 border border-white/10 hover:bg-background/80 text-xs text-muted-foreground transition-colors"
          title={`当前: ${getThemeLabel()} - 点击切换`}
        >
          {getThemeIcon()}
          <span className="hidden sm:inline">{getThemeLabel()}</span>
        </button>

        {/* 文件面板切换 */}
        <button
          onClick={onToggleFilePanel}
          className={`h-7 px-2 flex items-center gap-1.5 rounded-md text-xs transition-colors border ${showFilePanel ? 'bg-primary/15 text-primary border-primary/30' : 'hover:bg-background/70 text-muted-foreground border-white/10'
            }`}
          title="切换文件面板"
        >
          <PanelRight className="w-4 h-4" />
          <span className="hidden sm:inline">文件</span>
        </button>


      </div>
    </div>
  )
}
