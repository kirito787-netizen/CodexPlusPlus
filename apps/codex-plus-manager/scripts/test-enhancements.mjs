// 精简版的产品回归集。供应商、多开、皮肤等旧功能测试保留在源码中供历史参考，
// 不作为本版本的功能契约；共享的数据层另由 cargo test 覆盖。
import { spawnSync } from "node:child_process";

const suites = [
  "capacity-auto-retry", "dictation-runtime", "dictation-settings",
  "enhancement-layout", "enhancement-navigation", "enhancement-settings",
  "enhancements-only", "launch-status", "native-browser-contract",
  "native-browser-helper", "native-browser-status", "popover-layer",
  "plugin-catalog-recovery", "renderer-inject", "session-action-layout",
  "session-delete-runtime", "session-share-runtime", "typing-effects-runtime",
  "typing-effects-settings", "usage-statusline", "whale-balance-settings", "whale-widget",
];
const result = spawnSync(process.execPath, ["--test", ...suites.map(name => `src/${name}.test.ts`)], { stdio: "inherit" });
process.exit(result.status ?? 1);
