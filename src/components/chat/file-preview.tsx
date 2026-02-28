'use client'

import { X, File, Image as ImageIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FilePreviewProps {
  file: {
    name: string
    path: string
    type: string
  }
  onRemove: () => void
}

export function FilePreview({ file, onRemove }: FilePreviewProps) {
  const isImage = file.type === 'image'

  return (
    <div className="relative group">
      {isImage ? (
        <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
          <ImageIcon className="w-8 h-8 text-muted-foreground" />
        </div>
      ) : (
        <div className="w-16 h-16 rounded-lg bg-muted flex flex-col items-center justify-center p-1">
          <File className="w-6 h-6 text-primary" />
          <span className="text-[10px] text-muted-foreground truncate w-full text-center">
            {file.name.split('.').pop()?.toUpperCase()}
          </span>
        </div>
      )}

      {/* 文件名 */}
      <p className="text-xs text-center mt-1 truncate max-w-[64px]">
        {file.name}
      </p>

      {/* 删除按钮 */}
      <button
        onClick={onRemove}
        className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  )
}
