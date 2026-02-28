import * as esbuild from 'esbuild'
import * as path from 'path'
import * as fs from 'fs'

const electronDir = path.join(process.cwd(), 'electron')
const distDir = path.join(process.cwd(), 'dist-electron')

// 确保输出目录存在
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true })
}

// 构建主进程
await esbuild.build({
  entryPoints: [path.join(electronDir, 'main.ts')],
  bundle: true,
  platform: 'node',
  target: 'node20',
  outfile: path.join(distDir, 'main.js'),
  external: ['electron', 'node-pty', 'better-sqlite3'],
  format: 'cjs',
})

// 构建预加载脚本
await esbuild.build({
  entryPoints: [path.join(electronDir, 'preload.ts')],
  bundle: true,
  platform: 'node',
  target: 'node20',
  outfile: path.join(distDir, 'preload.js'),
  external: ['electron', 'node-pty', 'better-sqlite3'],
  format: 'cjs',
})

console.log('Electron build complete!')
