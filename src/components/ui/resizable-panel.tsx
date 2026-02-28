'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { cn } from '@/lib/utils'

interface ResizablePanelProps {
  direction: 'horizontal' | 'vertical'
  defaultSize?: number
  minSize?: number
  maxSize?: number
  children: React.ReactNode
  className?: string
}

export function ResizablePanel({
  direction,
  defaultSize = 250,
  minSize = 150,
  maxSize = 500,
  children,
  className,
}: ResizablePanelProps) {
  const [size, setSize] = useState(defaultSize)
  const [isResizing, setIsResizing] = useState(false)
  const startPosRef = useRef(0)
  const startSizeRef = useRef(0)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
    startPosRef.current = direction === 'horizontal' ? e.clientX : e.clientY
    startSizeRef.current = size
  }, [direction, size])

  useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (e: MouseEvent) => {
      const currentPos = direction === 'horizontal' ? e.clientX : e.clientY
      const delta = currentPos - startPosRef.current
      const newSize = Math.min(maxSize, Math.max(minSize, startSizeRef.current + delta))
      setSize(newSize)
    }

    const handleMouseUp = () => {
      setIsResizing(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing, direction, minSize, maxSize])

  return (
    <div
      className={cn("relative", className)}
      style={{
        [direction === 'horizontal' ? 'width' : 'height']: size,
      }}
    >
      {children}
      <div
        onMouseDown={handleMouseDown}
        className={cn(
          "absolute z-10 bg-transparent hover:bg-primary/20 transition-colors",
          direction === 'horizontal'
            ? "right-0 top-0 w-1 h-full cursor-col-resize"
            : "bottom-0 left-0 h-1 w-full cursor-row-resize"
        )}
      />
    </div>
  )
}
