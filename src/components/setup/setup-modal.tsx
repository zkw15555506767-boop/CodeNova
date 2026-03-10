'use client'

import React, { useState, useEffect } from 'react'
import { X, Sparkles, CheckCircle2, Circle, Loader2, Rocket, ArrowRight, ShieldCheck, Cpu, Search } from 'lucide-react'

interface SetupModalProps {
    isOpen: boolean
    onClose: () => void
}

type SetupPhase = 'checking' | 'provider' | 'config' | 'processing' | 'done'

interface Provider {
    id: string
    name: string
    description: string
    baseUrl: string
    icon: string
    isPopular?: boolean
    defaultModel?: string
}

const PROVIDERS: Provider[] = [
    { id: 'minimax', name: 'MiniMax API', description: '国内顶尖大模型，极致响应速度', baseUrl: 'https://api.minimaxi.com/anthropic', defaultModel: 'MiniMax-M2.5', icon: 'M', isPopular: true },
    { id: 'zhipu', name: '智谱 GLM', description: '全能国产之光，超长上下文支持', baseUrl: 'https://open.bigmodel.cn/api/anthropic', defaultModel: 'glm-4', icon: 'G' },
    { id: 'anthropic', name: 'Anthropic 官方', description: '原汁原味的 Claude 3.5 体验', baseUrl: 'https://api.anthropic.com', icon: 'A' },
]

export function SetupModal({ isOpen, onClose }: SetupModalProps) {
    const [phase, setPhase] = useState<SetupPhase>('checking')
    const [selectedProvider, setSelectedProvider] = useState<Provider>(PROVIDERS[0])
    const [apiKey, setApiKey] = useState('')
    const [syncGlobal, setSyncGlobal] = useState(false)
    const [progress, setProgress] = useState(0)
    const [statusMessage, setStatusMessage] = useState('正在初始化...')
    const [error, setError] = useState<string | null>(null)
    const [envStatus, setEnvStatus] = useState<{ node: boolean; claude: boolean; nodeVersion?: string } | null>(null)

    useEffect(() => {
        if (isOpen) {
            performInitialCheck()
        } else {
            // Reset state when closed
            setPhase('checking')
            setProgress(0)
            setError(null)
            setEnvStatus(null)
        }
    }, [isOpen])

    const performInitialCheck = async () => {
        setPhase('checking')
        setStatusMessage('由于是一键部署，正在为您秒速检测本地环境...')
        setProgress(30)

        try {
            if (!window.electronAPI) return

            const env = await window.electronAPI.checkEnv()
            setEnvStatus({ node: env.node, claude: env.claude, nodeVersion: env.nodeVersion })

            if (env.node && env.claude) {
                setStatusMessage(`成功检测到 Node.js (${env.nodeVersion}) 与 Claude CLI！`)
            } else if (env.node) {
                setStatusMessage(`Node.js (${env.nodeVersion}) 已就绪，但尚未发现 Claude CLI。`)
            }

            setProgress(100)

            // Delay slightly to show the check completed
            await new Promise(r => setTimeout(r, 1200))

            if (!env.node) {
                throw new Error('未检测到 Node.js 环境，本工具需要 Node.js 才能运行。')
            }

            setPhase('provider')
        } catch (e: any) {
            setError(e.message)
        }
    }

    const startAutomatedSetup = async () => {
        setPhase('processing')
        setError(null)

        try {
            if (!window.electronAPI) return

            // Step 2: CLI Installation (Using cached envStatus)
            if (envStatus?.claude) {
                setStatusMessage('根据刚才的扫描，您的系统已具备 Claude CLI，正在直接同步配置...')
                setProgress(60)
                await new Promise(r => setTimeout(r, 1000))
            } else {
                setStatusMessage('正在为您自动安装必备组件 (CLI)...')
                setProgress(40)
                const installResult = await window.electronAPI.installClaude()
                if (!installResult.success) throw new Error(installResult.error || '安装 CLI 失败')
                setProgress(70)
            }

            // Step 3: Write Config
            setStatusMessage('正在写入 API 密钥与路由定向规则...')
            setProgress(85)

            const configResult = await window.electronAPI.saveClaudeConfig({
                apiKey: apiKey.trim(),
                baseUrl: selectedProvider.baseUrl,
                defaultModel: selectedProvider.defaultModel,
                syncGlobal
            })

            if (!configResult.success) throw new Error(configResult.error || '写入配置文件失败')

            setProgress(100)
            setPhase('done')
        } catch (e: any) {
            console.error('Setup phase failed:', e)
            setError(e.message)
            setProgress(0)
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md animate-in fade-in duration-300">
            <div className="relative w-full max-w-xl overflow-hidden rounded-[24px] border border-white/10 bg-[#0f111a]/90 p-8 shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] backdrop-blur-2xl animate-in zoom-in-95 duration-300">

                {/* Glow Effects */}
                <div className="absolute -left-20 -top-20 h-64 w-64 rounded-full bg-purple-600/10 blur-[90px]" />
                <div className="absolute -bottom-20 -right-20 h-64 w-64 rounded-full bg-blue-600/10 blur-[90px]" />

                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute right-6 top-6 rounded-full p-2 text-white/30 hover:bg-white/10 hover:text-white transition-all"
                >
                    <X size={20} />
                </button>

                {/* Header Section */}
                <div className="mb-10 flex flex-col items-center text-center">
                    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 to-blue-600 text-white shadow-xl shadow-purple-500/20">
                        <Rocket size={28} className={`${phase === 'checking' || phase === 'processing' ? 'animate-bounce' : 'animate-pulse'}`} />
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-full bg-white/5 border border-white/10 px-3 py-1 mb-2">
                        <div className={`h-1.5 w-1.5 rounded-full ${phase === 'done' ? 'bg-green-400' : 'bg-purple-400 animate-pulse'}`} />
                        <span className="text-[10px] font-bold text-white/60 tracking-wider uppercase">One-Click Setup v2</span>
                    </div>
                    <h2 className="text-2xl font-bold tracking-tight text-white">
                        {phase === 'checking' && '正在扫描环境'}
                        {phase === 'provider' && '选择一个 AI 大脑'}
                        {phase === 'config' && '配置你的密钥'}
                        {phase === 'processing' && '正在一键部署'}
                        {phase === 'done' && '一切就绪！'}
                    </h2>
                    <p className="mt-2 text-sm text-white/40 max-w-sm">
                        {phase === 'checking' && 'CodeNova 正在检测本地 Node.js 与 CLI 指令集...'}
                        {phase === 'provider' && '环境就绪！现在请选择一个您偏好的 AI 提供商。'}
                        {phase === 'config' && '我们将通过加密隧道同步您的 API 凭证。'}
                        {phase === 'processing' && '正在为您处理最后的一点收尾工作。'}
                        {phase === 'done' && '您的 AI 编程环境已成功搭建完成，即刻开始。'}
                    </p>
                </div>

                {/* Dynamic Phases */}
                <div className="min-h-[280px]">
                    {phase === 'checking' && (
                        <div className="flex flex-col items-center justify-center animate-in zoom-in-95 duration-500 py-10">
                            <div className="relative mb-8 h-24 w-24">
                                <Loader2 className="h-full w-full animate-spin text-purple-500/30" strokeWidth={1} />
                                <div className="absolute inset-4 flex items-center justify-center rounded-full bg-purple-500/5 backdrop-blur-sm">
                                    <Search className="text-purple-400 animate-pulse" size={32} />
                                </div>
                            </div>

                            <div className="w-full space-y-4 px-10">
                                <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-white/30 truncate max-w-[320px]">
                                    <span>{statusMessage}</span>
                                    <span>{progress}%</span>
                                </div>
                                <div className="h-2 w-full overflow-hidden rounded-full bg-white/5 border border-white/5">
                                    <div
                                        className="h-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-700 ease-out"
                                        style={{ width: `${progress}%` }}
                                    />
                                </div>
                            </div>

                            {error && (
                                <div className="mt-8 rounded-lg bg-red-500/10 border border-red-500/20 p-4 text-xs text-red-400 text-center max-w-sm">
                                    ⚠️ 环境组件缺失：{error}
                                    <button onClick={performInitialCheck} className="ml-2 underline font-bold">重新检测</button>
                                </div>
                            )}
                        </div>
                    )}

                    {phase === 'provider' && (
                        <div className="grid gap-4 animate-in slide-in-from-bottom-4 duration-500">
                            {PROVIDERS.map((p) => (
                                <button
                                    key={p.id}
                                    onClick={() => setSelectedProvider(p)}
                                    className={`group relative flex items-center justify-between rounded-2xl border p-5 transition-all duration-300 ${selectedProvider.id === p.id
                                        ? 'border-purple-500/50 bg-white/5 shadow-[inset_0_0_20px_rgba(168,85,247,0.05)]'
                                        : 'border-white/5 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]'
                                        }`}
                                >
                                    <div className="flex items-center gap-4 text-left">
                                        <div className={`flex h-12 w-12 items-center justify-center rounded-xl font-bold text-xl ${selectedProvider.id === p.id
                                            ? 'bg-gradient-to-br from-purple-500 to-blue-500 text-white'
                                            : 'bg-white/5 text-white/20'
                                            }`}>
                                            {p.icon}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-semibold text-white">{p.name}</span>
                                                {p.isPopular && <span className="rounded-full bg-purple-500/20 px-1.5 py-0.5 text-[8px] font-bold text-purple-400 border border-purple-500/30">推荐</span>}
                                            </div>
                                            <p className="text-xs text-white/30">{p.description}</p>
                                        </div>
                                    </div>
                                    {selectedProvider.id === p.id && <CheckCircle2 className="text-purple-400" size={20} />}
                                </button>
                            ))}

                            <button
                                onClick={() => setPhase('config')}
                                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-white text-black py-4 font-bold text-sm tracking-wide hover:bg-white/90 transition-all active:scale-[0.98]"
                            >
                                准备好了，下一步 <ArrowRight size={16} />
                            </button>
                        </div>
                    )}

                    {phase === 'config' && (
                        <div className="animate-in fade-in duration-500 space-y-6">
                            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-6">
                                <label className="mb-2 block text-xs font-bold text-white/40 uppercase tracking-widest">
                                    API Key (密钥)
                                </label>
                                <input
                                    type="password"
                                    value={apiKey}
                                    onChange={(e) => setApiKey(e.target.value)}
                                    placeholder="请输入您的 sk-..."
                                    className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/10 focus:border-purple-500/50 focus:outline-none focus:ring-1 focus:ring-purple-500/50"
                                    autoFocus
                                />
                                <div className="mt-4 flex items-start gap-2 rounded-lg bg-blue-500/10 border border-blue-500/20 p-3">
                                    <ShieldCheck size={16} className="text-blue-400 shrink-0 mt-0.5" />
                                    <p className="text-[10px] text-blue-300 leading-relaxed">
                                        您的密钥默认将仅在 CodeNova 内部以沙盒模式安全调用，绝不会污染系统。
                                    </p>
                                </div>
                                <div className="mt-4">
                                    <label className="flex items-center gap-3 cursor-pointer group">
                                        <div className="relative flex items-center justify-center">
                                            <input
                                                type="checkbox"
                                                className="peer sr-only"
                                                checked={syncGlobal}
                                                onChange={(e) => setSyncGlobal(e.target.checked)}
                                            />
                                            <div className="h-5 w-5 rounded border border-white/20 bg-black/40 peer-checked:bg-purple-500 peer-checked:border-purple-500 transition-all flex items-center justify-center">
                                                <CheckCircle2 size={14} className="text-white opacity-0 peer-checked:opacity-100 transition-opacity" />
                                            </div>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-sm font-semibold text-white/90 group-hover:text-white transition-colors">同步修改本机全局终端配置 (极客选项)</span>
                                            <span className="text-[10px] text-white/30">勾选后，您的原生 Terminal 中的 claude 将同样自动走此设定路线。</span>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            <div className="flex gap-4">
                                <button
                                    onClick={() => setPhase('provider')}
                                    className="flex-1 rounded-xl border border-white/10 py-4 font-bold text-sm text-white hover:bg-white/5 transition-all"
                                >
                                    返回
                                </button>
                                <button
                                    onClick={startAutomatedSetup}
                                    disabled={!apiKey}
                                    className="flex-[2] rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 py-4 font-bold text-sm text-white shadow-lg shadow-purple-600/20 hover:opacity-90 transition-all active:scale-[0.98] disabled:opacity-30 disabled:grayscale"
                                >
                                    点击确认一键部署
                                </button>
                            </div>
                        </div>
                    )}

                    {phase === 'processing' && (
                        <div className="flex flex-col items-center justify-center animate-in zoom-in-95 duration-500 py-10">
                            <div className="relative mb-8 h-24 w-24">
                                <Loader2 className="h-full w-full animate-spin text-purple-500/50" strokeWidth={1} />
                                <div className="absolute inset-4 flex items-center justify-center rounded-full bg-purple-500/10 backdrop-blur-sm">
                                    <Cpu className="text-purple-400 animate-pulse" size={32} />
                                </div>
                            </div>

                            <div className="w-full space-y-4 px-10">
                                <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-white/30 truncate max-w-[250px]">
                                    <span>{statusMessage}</span>
                                    <span>{progress}%</span>
                                </div>
                                <div className="h-2 w-full overflow-hidden rounded-full bg-white/5 border border-white/5">
                                    <div
                                        className="h-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-700 ease-out"
                                        style={{ width: `${progress}%` }}
                                    />
                                </div>
                            </div>

                            {error && (
                                <div className="mt-8 rounded-lg bg-red-500/10 border border-red-500/20 p-4 text-xs text-red-400 text-center max-w-sm">
                                    ⚠️ 部署遇到了一点阻碍：{error}
                                    <button onClick={() => setPhase('config')} className="ml-2 underline font-bold">重试</button>
                                </div>
                            )}
                        </div>
                    )}

                    {phase === 'done' && (
                        <div className="flex flex-col items-center justify-center animate-in slide-in-from-top-4 duration-500 py-6 text-center">
                            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-500/20 text-green-400 border border-green-500/30">
                                <CheckCircle2 size={40} />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">部署成功！</h3>
                            <p className="text-sm text-white/40 mb-10 max-w-sm px-6 leading-relaxed">
                                环境与配置已准备就绪。您的 AI 编程伙伴已接入 **{selectedProvider.name}** 并静默更新了配置文件。
                            </p>

                            <button
                                onClick={onClose}
                                className="w-full flex items-center justify-center gap-2 rounded-xl bg-white text-black py-4 font-bold text-sm hover:scale-[1.02] transition-all active:scale-[0.98]"
                            >
                                立刻进入 AI 编程世界 <Sparkles size={18} className="text-purple-500" />
                            </button>
                        </div>
                    )}
                </div>

                {/* Footer Info */}
                <div className="mt-10 border-t border-white/5 pt-6 text-center">
                    <p className="text-[10px] font-medium text-white/20 uppercase tracking-[0.2em]">
                        CodeNova Intelligent Setup Experience
                    </p>
                </div>
            </div>
        </div>
    )
}
