import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  trailingSlash: false,
  output: 'export',
  basePath: '',
  // 确保静态资源使用相对路径
  assetPrefix: './',
}

export default nextConfig
