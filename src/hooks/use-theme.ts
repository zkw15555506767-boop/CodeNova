'use client'

import { useState, useEffect, useCallback } from 'react'

export type Theme = 'light' | 'dark' | 'gradient'

interface UseThemeReturn {
  theme: Theme
  setTheme: (theme: Theme) => void
  themeClass: string
}

export function useTheme(): UseThemeReturn {
  const [theme, setThemeState] = useState<Theme>('light')

  useEffect(() => {
    // 从 localStorage 读取主题
    const savedTheme = localStorage.getItem('codenova-theme') as Theme | null
    if (savedTheme) {
      setThemeState(savedTheme)
    } else {
      // 默认为浅色主题
      setThemeState('light')
    }
  }, [])

  useEffect(() => {
    // 应用主题到 document
    const root = document.documentElement
    root.classList.remove('dark', 'gradient-aurora')

    if (theme === 'dark') {
      root.classList.add('dark')
    } else if (theme === 'gradient') {
      root.classList.add('gradient-aurora', 'dark')
    }

    // 保存到 localStorage
    localStorage.setItem('codenova-theme', theme)
  }, [theme])

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme)
  }, [])

  const themeClass = theme === 'gradient' ? 'gradient-aurora' : theme === 'dark' ? 'dark' : ''

  return {
    theme,
    setTheme,
    themeClass,
  }
}
