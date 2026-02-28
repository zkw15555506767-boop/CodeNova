'use client'

import { useState, useEffect, useCallback } from 'react'

export interface Skill {
  id: string
  name: string
  description: string
  prompt: string
  enabled: boolean
  path?: string
}

let hasScannedLocal = false

const STORAGE_KEY = 'codenova_skills'

// 默认技能
const defaultSkills: Skill[] = [
  {
    id: 'review',
    name: 'review',
    description: '代码审查',
    prompt: '请审查以下代码，检查潜在的问题和改进建议：',
    enabled: true,
  },
  {
    id: 'explain',
    name: 'explain',
    description: '解释代码',
    prompt: '请详细解释以下代码的功能和工作原理：',
    enabled: true,
  },
  {
    id: 'refactor',
    name: 'refactor',
    description: '重构代码',
    prompt: '请重构以下代码，使其更加清晰和高效：',
    enabled: true,
  },
  {
    id: 'test',
    name: 'test',
    description: '生成测试',
    prompt: '请为以下代码生成单元测试：',
    enabled: true,
  },
  {
    id: 'docs',
    name: 'docs',
    description: '生成文档',
    prompt: '请为以下代码生成详细的文档注释：',
    enabled: true,
  },
]

export function useSkills() {
  const [skills, setSkills] = useState<Skill[]>([])

  // 加载技能
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as Skill[]

        // 自动修复旧版本中可能产生的存储重复问题
        const uniqueSkills: Skill[] = []
        const seenNames = new Set<string>()
        const seenIds = new Set<string>()

        parsed.forEach(s => {
          if (!seenNames.has(s.name) && !seenIds.has(s.id)) {
            seenNames.add(s.name)
            seenIds.add(s.id)
            uniqueSkills.push(s)
          }
        })

        if (uniqueSkills.length !== parsed.length) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(uniqueSkills))
        }

        setSkills(uniqueSkills)
      } catch (e) {
        console.error('Failed to parse skills:', e)
        setSkills(defaultSkills)
      }
    } else {
      setSkills(defaultSkills)
    }
  }, [])

  // 保存技能
  const saveSkills = useCallback((skills: Skill[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(skills))
    setSkills(skills)
  }, [])

  const addSkill = useCallback((skill: Omit<Skill, 'id'>) => {
    const newSkill: Skill = {
      ...skill,
      id: Date.now().toString(),
    }
    saveSkills([...skills, newSkill])
    return newSkill
  }, [skills, saveSkills])

  const updateSkill = useCallback((id: string, updates: Partial<Skill>) => {
    const updated = skills.map(s =>
      s.id === id ? { ...s, ...updates } : s
    )
    saveSkills(updated)
  }, [skills, saveSkills])

  const deleteSkill = useCallback((id: string) => {
    const filtered = skills.filter(s => s.id !== id)
    saveSkills(filtered)
  }, [skills, saveSkills])

  const toggleSkill = useCallback((id: string) => {
    const updated = skills.map(s =>
      s.id === id ? { ...s, enabled: !s.enabled } : s
    )
    saveSkills(updated)
  }, [skills, saveSkills])

  const getSkillPrompt = useCallback((name: string): string | null => {
    const skill = skills.find(s => s.name === name && s.enabled)
    return skill?.prompt || null
  }, [skills])

  // 批量添加技能（确保已存在的本地技能也被强制启用）
  const addSkillsBatch = useCallback((newSkills: Omit<Skill, 'id'>[]) => {
    setSkills(prev => {
      let changed = false
      const updatedPrev = prev.map(s => {
        const match = newSkills.find(ns => ns.name === s.name)
        // 更新逻辑：如果 prompt 也变了，或者未开启，或者有了新路径
        if (match && (!s.enabled || s.prompt !== match.prompt || s.path !== match.path)) {
          changed = true
          return { ...s, enabled: true, prompt: match.prompt, path: match.path }
        }
        return s
      })

      const existingNames = new Set(prev.map(s => s.name))
      const toAdd: Skill[] = []

      newSkills.forEach((s, i) => {
        if (!existingNames.has(s.name)) {
          existingNames.add(s.name) // 防止 newSkills 内部重名
          toAdd.push({ ...s, id: `local-${Date.now()}-${i}` } as Skill)
        }
      })

      if (toAdd.length === 0 && !changed) return prev

      const updated = [...updatedPrev, ...toAdd]
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
      } catch (err) {
        console.error('Failed to save to localStorage, likely QuotaExceeded:', err)
      }
      return updated
    })
  }, [])

  // useEffect 内部引用的自动扫描，转移到独立的 effect，确保 addSkillsBatch 最新
  useEffect(() => {
    if (!hasScannedLocal && window.electronAPI) {
      hasScannedLocal = true
      const api = (window as any).electronAPI
      if (api.scanLocalSkills) {
        api.scanLocalSkills().then((localSkills: any[]) => {
          if (localSkills.length > 0) {
            addSkillsBatch(
              localSkills.map((ls: any) => ({
                name: ls.name,
                description: ls.description || '本地 Skill',
                prompt: '', // 仅保留空串，真实内容由聊天窗口通过 path 读取
                path: ls.path,
                enabled: true,
              }))
            )
          }
        }).catch((err: any) => console.error('Auto scan failed:', err))
      }
    }
  }, [addSkillsBatch])

  return {
    skills,
    addSkill,
    addSkillsBatch,
    updateSkill,
    deleteSkill,
    toggleSkill,
    getSkillPrompt,
  }
}
