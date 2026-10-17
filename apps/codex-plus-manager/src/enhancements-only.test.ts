import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const shell = read("./EnhancementsApp.tsx");
const ui = read("./EnhancementUI.tsx");
const handler = read("../src-tauri/src/lib.rs");

test("the manager starts in enhancements and does not initialize retired services", () => {
  assert.match(shell, /useState<Page>\("enhance"\)/);
  for (const command of ["load_ads", "list_tools", "weixin_connect_start", "switch_relay_profile", "load_pending_provider_import", "refresh_script_market", "perform_update"]) {
    assert.ok(!shell.includes(`"${command}"`), command);
    assert.ok(!handler.includes(`commands::${command},`), command);
  }
  assert.ok(!handler.includes("commands::start_weixin_connect_from_saved_settings()"));
  assert.ok(!shell.includes("checkUpdate("), "must not replace the fork with an upstream full build");
});

test("all enhancement services retain their commands and configuration", () => {
  for (const command of ["launch_codex_plus", "restart_codex_plus", "load_settings", "save_settings", "dictation_local_model_status", "download_dictation_local_model", "test_stepwise_settings", "native_browser_status"]) {
    assert.ok(handler.includes(`commands::${command},`), command);
  }
  for (const field of ["codexAppWhaleWidgetEnabled", "codexAppPetRealMouseLook", "codexAppActivityOverlayRight", "codexAppUsageStatusLine", "codexAppStandaloneQuotaUnlock", "codexAppStepwiseEnabled", "codexAppAnswerOutlineEnabled", "dictation"]) assert.ok(ui.includes(field), field);
  assert.match(shell, /syncActiveRelay: false/);
  assert.match(shell, /if \(dirty && !await saveSettingsValue\(form\)\) return/);
});

test("injected navigation contains only the enhancement entry and no sponsor panels", () => {
  const renderer = read("../../../assets/inject/renderer-inject/40-backend-settings.js");
  const specs = renderer.slice(renderer.indexOf("    const specs = ["), renderer.indexOf("    const anchor = codexPlusRailPrimaryAnchor"));
  assert.ok(specs.includes("codexPlusRailNavId"));
  assert.ok(!specs.includes("codexPlusRailSponsorId"));
  assert.ok(!specs.includes("codexPlusRailExtensionsId"));
  assert.ok(!renderer.includes('data-codex-plus-panel="sponsor" hidden>'));
});
