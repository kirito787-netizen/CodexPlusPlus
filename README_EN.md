# Codex++ · Enhancements-only edition

This fork of [BigPizzaV3/CodexPlusPlus](https://github.com/BigPizzaV3/CodexPlusPlus) keeps every feature under **Codex enhancements**, together with the launch and settings tools required to use them.

Retained: general enhancements, native plugin/model unlocks, session deletion/undo and Markdown export, paste and reading improvements, retry and typing effects, usage status, the full widget/pet configuration, dictation (including local speech models), next-step suggestions and answer outlines.

The manager opens directly to enhancements. Its only other page is launch/settings: app path, extra arguments, launch/restart, automatic takeover, theme and language. Existing Codex login and model settings are used without replaying saved provider profiles.

Provider management, multiple instances, standalone session/MCP/Skill administration, WeChat, skins, extension and standalone plugin marketplaces, ads, other agents and cache cleanup are unavailable. Older provider and authentication snapshots are preserved on disk but cannot reactivate these services. The native plugin unlock adapter remains available. Automatic upstream full-edition updates are disabled.

See the [Chinese README](README.md) for build commands and implementation scope. `npm test` runs the enhancements regression suite; `npm run test:legacy` also includes historical contracts for removed pages.

Licensed under [GNU AGPL v3.0](LICENSE). Original authors: BigPizzaV3 and contributors; fork maintained by kirito787-netizen. Third-party widget code and assets retain their [license](assets/inject/upstream/whale-widget/LICENSE) and [provenance](assets/inject/upstream/whale-widget/PROVENANCE.md).
