# Codex++ · Codex 增强专用版

本分支只提供「Codex 增强」及其必要的启动与设置功能。基于 [BigPizzaV3/CodexPlusPlus](https://github.com/BigPizzaV3/CodexPlusPlus) 修改，保留 GNU AGPL v3.0 许可与第三方素材声明。

## 保留的功能

- **常用增强**：增强总开关、独立额度解锁、插件市场解锁、模型白名单解锁、Fast 按钮、会话删除与撤销、Markdown 导出、粘贴修复、中文界面、容量错误自动重试、打字特效、会话 ID、对话宽度、滚动位置恢复、用量状态栏。
- **挂件与桌宠**：用量挂件、角色与泡泡配置、音效和提醒、余额服务配置、活动进度条布局，以及 Windows 的 V2 桌宠鼠标跟随。
- **语音输入**：全部原有服务配置、本地 SenseVoice 模型状态与手动下载、API 语音服务。
- **下一步建议**：建议生成、回答大纲、自动/手动模式、直接发送及全部服务参数与连接测试。
- **启动与设置**：应用路径、额外启动参数、启动/重启、状态显示、自动接管、明暗主题和语言切换。

供应商与模型管理、多开、独立会话/MCP/Skill 管理、微信连接、皮肤、拓展市场、独立插件市场、广告推荐、其他 Agent 和缓存清理入口不再提供。原生插件市场解锁所需的适配能力仍然保留。

## 使用

先安装官方 Codex 桌面应用，打开本版本管理器后直接进入「Codex 增强」，保存设置，再点击「启动 Codex」。需要自定义安装路径时进入「启动与设置」。

沿用 Codex 本身的登录、模型和 API 配置；本版本不会在启动时重放旧供应商档案。旧配置中的供应商与认证快照保留在磁盘中，不能通过本版本启用供应商切换、微信服务或皮肤。增强保存只接受增强与启动字段。

本版本不自动安装上游完整版更新。上游安装包不能视为此精简版的构建产物。

## 开发与检查

```powershell
cd apps/codex-plus-manager
npm ci
npm test
npm run check
npm run vite:build
cd ../..
cargo test -p codex-plus-core enhancements_only --lib
cargo build --release -p codex-plus-manager
```

Windows 可执行文件：`target/release/codex-plus-plus.exe`。首次构建需要 Rust、Visual Studio C++ 工具及 Windows SDK。

`npm test` 运行增强专用回归集；`npm run test:legacy` 包含已移除功能的历史用例，其旧页面契约不适用于此版本。修改 renderer 分片后运行 `node scripts/assemble-renderer-inject.mjs`；`manifest.json` 的行数元数据也应同步更新。

增强控件位于 `apps/codex-plus-manager/src/EnhancementUI.tsx`，专用管理器位于 `EnhancementsApp.tsx`，后端范围约束位于 `crates/codex-plus-core/src/enhancements_only.rs`。共享库中仍保留增强依赖及旧配置兼容结构，旧业务不注册到管理器命令入口。

## 许可与来源

本项目自身代码遵循 [GNU AGPL v3.0](LICENSE)。原项目作者：BigPizzaV3 及贡献者。本分支：kirito787-netizen。

挂件的原始功能、界面引擎、鲸鱼角色及内置音效/动图来自 [MeteorNOX/DeepSeek-Balance-Whale-Widget](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget)，桌面版技术路线另参考 [Yang-huai406/Codex-Whale-Public](https://github.com/Yang-huai406/Codex-Whale-Public)。保留的声明见 [LICENSE](assets/inject/upstream/whale-widget/LICENSE) 与 [PROVENANCE.md](assets/inject/upstream/whale-widget/PROVENANCE.md)。第三方素材遵循各自许可，不重新声明为本分支原创。
