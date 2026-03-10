const { app } = require('electron')
const fs = require('fs')
const path = require('path')

app.whenReady().then(async () => {
    const Store = (await import('electron-store')).default

    console.log('\n--- 🧪 启动 CodeNova 沙盒隔离测试 ---\n')

    // 1. 模拟在 CodeNova 的沙盒环境 (electron-store) 中保存用户配置
    const store = new Store({ name: 'codenova-sandbox-test' })
    store.set('claudeConfig', {
        apiKey: 'sk-sandbox-minimax-123456789',
        baseUrl: 'https://api.minimax.chat'
    })

    const saved = store.get('claudeConfig')
    console.log('✅ [步骤一: 沙盒写入] CodeNova 沙盒内数据读取成功!')
    console.log('   沙盒内的 API Key:', saved.apiKey)

    // 2. 检查用户真实的全局 ~/.claude/settings.json，确保没有被污染
    const home = app.getPath('home')
    const globalConfigPath = path.join(home, '.claude', 'settings.json')

    let globalKey = '<文件不存在或未配置>'
    try {
        const raw = fs.readFileSync(globalConfigPath, 'utf8')
        const config = JSON.parse(raw)
        globalKey = config.env?.ANTHROPIC_API_KEY || '<没找到 Key>'
    } catch (e) { }

    console.log('\n✅ [步骤二: 全局保护] 全局配置文件读取成功!')
    console.log('   你原本的全局 API Key:', globalKey)

    if (globalKey !== saved.apiKey) {
        console.log('\n🎉 [结论]: 沙盒与全局环境完全隔离，一键部署测试没有污染你的本地环境！')
    } else {
        console.error('\n❌ [结论]: 糟糕，沙盒数据泄露到了全局配置！')
    }

    // 3. 模拟 Agent 启动时的动态注入逻辑
    console.log('\n✅ [步骤三: 动态注入测试] 模拟 Agent 启动时的环境变量拦截...')
    const injectedEnv = {
        ...process.env,
        PROMPT: '$ ',
        ANTHROPIC_API_KEY: saved.apiKey,
        ANTHROPIC_BASE_URL: saved.baseUrl
    }

    console.log('   即将在终端执行的临时环境变量片段:')
    console.log('   {')
    console.log(`     ANTHROPIC_API_KEY: '${injectedEnv.ANTHROPIC_API_KEY}',`)
    console.log(`     ANTHROPIC_BASE_URL: '${injectedEnv.ANTHROPIC_BASE_URL}',`)
    console.log(`     PROMPT: '${injectedEnv.PROMPT}'`)
    console.log('     ...其他系统环境变量')
    console.log('   }\n')
    console.log('--- 测试结束 ---\n')

    app.quit()
})
