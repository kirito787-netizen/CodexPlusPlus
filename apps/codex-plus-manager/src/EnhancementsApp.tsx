import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { Hammer, Settings, Sun, Moon, Rocket, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { t, toggleLanguage } from "@/i18n";
import { dictationSettingsIssue } from "./dictation-settings";
import { whaleBalanceSettingsIssue } from "./whale-settings";
import { managerNavigationDestination, type EnhancementTab, type ManagerNavigationIntent } from "./enhancement-navigation";
import {
  EnhanceScreen, defaultSettings, normalizeSettings, backendSettingsEqual,
  dictationSettingsValidationMessage, whaleBalanceValidationMessage,
  type BackendSettings, type SettingsResult, type OverviewResult,
  type LaunchCommandResult, type StepwiseTestResult, type EnhancementActions,
} from "./EnhancementUI";

type Page = "enhance" | "settings";

/** 增强专用管理器：仅加载增强配置和启动状态，不初始化其他业务。 */
export function App() {
  const [page, setPage] = useState<Page>("enhance");
  const [tab, setTab] = useState<EnhancementTab>("general");
  const [theme, setTheme] = useState(() => localStorage.getItem("codex-plus-theme") === "light" ? "light" : "dark");
  const [form, setForm] = useState<BackendSettings>(defaultSettings);
  const [saved, setSaved] = useState<BackendSettings | null>(null);
  const [overview, setOverview] = useState<OverviewResult | null>(null);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const dirty = saved !== null && !backendSettingsEqual(form, saved);
  const running = overview?.runtime_health?.codex_app?.status === "running";

  function notify(text: string, error = false) {
    setMessage(text);
    setFailed(error);
  }

  async function request<T>(command: string, args?: Record<string, unknown>): Promise<T | null> {
    try { return await invoke<T>(command, args); }
    catch (error) { notify(String(error), true); return null; }
  }

  async function refreshOverview() {
    const result = await request<OverviewResult>("load_overview");
    if (result) setOverview(result);
    return result;
  }

  async function loadSettings() {
    const result = await request<SettingsResult>("load_settings");
    if (result?.status !== "ok") {
      if (result) notify(result.message, true);
      return;
    }
    const settings = normalizeSettings(result.settings);
    setForm(settings);
    setSaved(settings);
  }

  async function saveSettingsValue(next: BackendSettings, silent = true) {
    if (!saved) return null;
    const normalized = normalizeSettings(next);
    const issue = dictationSettingsValidationMessage(dictationSettingsIssue(normalized.dictation))
      ?? whaleBalanceValidationMessage(whaleBalanceSettingsIssue(normalized));
    if (issue) { notify(issue, true); return null; }
    const result = await request<SettingsResult>("save_settings", { settings: normalized });
    if (!result) return null;
    if (result.status !== "ok") { notify(result.message, true); return null; }
    const settings = normalizeSettings(result.settings);
    setSaved(settings);
    setForm(settings);
    if (!silent) notify(result.message);
    return settings;
  }

  const actions: EnhancementActions = {
    saveSettings: async () => { await saveSettingsValue(form, false); },
    saveSettingsValue,
    testStepwiseSettings: async settings => {
      const result = await request<StepwiseTestResult>("test_stepwise_settings", { settings });
      if (result) notify(result.message, result.status !== "ok");
    },
  };

  async function launch() {
    if (busyRef.current || !saved) return;
    busyRef.current = true;
    setBusy(true);
    try {
      if (dirty && !await saveSettingsValue(form)) return;
      const result = await request<LaunchCommandResult>(running ? "restart_codex_plus" : "launch_codex_plus", {
        request: { appPath: form.codexAppPath, debugPort: 9229, helperPort: 57321, syncActiveRelay: false },
      });
      if (!result) return;
      notify(result.message, !["ok", "accepted"].includes(result.status));
      if (result.status !== "accepted") return;
      const deadline = Date.now() + 90_000;
      while (Date.now() < deadline) {
        const state = await refreshOverview();
        const status = state?.latest_launch;
        if (status && status.started_at_ms >= (result.launchStartedAtMs ?? 0)
          && ["running", "running_degraded", "failed", "crashed", "stopped"].includes(status.status)) {
          notify(status.message, !["running", "running_degraded"].includes(status.status));
          return;
        }
        await new Promise(resolve => window.setTimeout(resolve, 750));
      }
      notify(t("启动仍在进行，请稍后刷新状态。"));
    } finally { busyRef.current = false; setBusy(false); }
  }

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;
    const navigation = async () => {
      const intent = await request<ManagerNavigationIntent | null>("consume_pending_manager_navigation");
      if (!intent || disposed) return;
      const destination = managerNavigationDestination(intent);
      setTab(destination.section ?? "general");
      setPage(destination.route);
    };
    void loadSettings();
    void refreshOverview();
    void (async () => {
      const stop = await listen("manager-navigation-requested", () => void navigation());
      if (disposed) { stop(); return; }
      unlisten = stop;
      await navigation();
    })();
    const timer = window.setInterval(() => void refreshOverview(), 5000);
    return () => { disposed = true; unlisten?.(); window.clearInterval(timer); };
  }, []);

  useEffect(() => {
    localStorage.setItem("codex-plus-theme", theme);
    document.documentElement.dataset.theme = theme;
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  async function chooseApp() {
    try {
      const selected = await open({ directory: !/Windows/i.test(navigator.userAgent), multiple: false });
      if (typeof selected === "string") setForm(current => ({ ...current, codexAppPath: selected }));
    } catch (error) { notify(String(error), true); }
  }

  return <div className={`shell ${theme} enhancements-only-shell`}>
    <aside className="sidebar">
      <div className="nav-section-label">Codex++ · {t("Codex增强")}</div>
      <nav className="nav" aria-label={t("主导航")}>
        <button type="button" className={`nav-item ${page === "enhance" ? "active" : ""}`} onClick={() => setPage("enhance")}><Hammer className="h-4 w-4" />{t("Codex增强")}</button>
        <button type="button" className={`nav-item ${page === "settings" ? "active" : ""}`} onClick={() => setPage("settings")}><Settings className="h-4 w-4" />{t("启动与设置")}</button>
      </nav>
      <div className="toolbar">
        <Button variant="secondary" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label={t("切换主题")}>{theme === "dark" ? <Sun /> : <Moon />}</Button>
        <Button variant="secondary" onClick={toggleLanguage}>中文 / EN</Button>
      </div>
    </aside>
    <main className="workspace">
      <header className="topbar">
        <div><h1>{page === "enhance" ? t("Codex增强") : t("启动与设置")}</h1><p>{t("常用增强、语音输入与下一步建议")}</p></div>
        <div className="topbar-actions">
          <span role="status">Codex {running ? t("运行中") : t("未运行")}</span>
          <Button disabled={busy || !saved || !overview} onClick={() => void launch()}><Rocket className="h-4 w-4" />{busy ? t("正在启动…") : running ? t("重启 Codex") : t("启动 Codex")}</Button>
        </div>
      </header>
      {message ? <div className={`enhancement-notice ${failed ? "is-error" : ""}`} role={failed ? "alert" : "status"}>{message}<Button variant="secondary" onClick={() => setMessage("")}>{t("关闭")}</Button></div> : null}
      <section className="screen">
        {!saved ? <div className="empty"><p>{t("正在加载增强设置…")}</p><Button onClick={() => void loadSettings()}>{t("重试")}</Button></div>
          : page === "enhance" ? <EnhanceScreen dirty={dirty} activeTab={tab} onTabChange={setTab} form={form} onFormChange={setForm} actions={actions} />
            : <div className="settings-page">
              <label>{t("Codex 应用路径")}<Input value={form.codexAppPath} onChange={event => setForm({ ...form, codexAppPath: event.currentTarget.value })} placeholder={t("留空自动检测")} /></label>
              <div className="toolbar"><Button variant="secondary" onClick={() => void chooseApp()}>{t("选择应用")}</Button><Button variant="secondary" onClick={() => void refreshOverview()}>{t("刷新状态")}</Button></div>
              <label>{t("额外启动参数（每行一个）")}<textarea className="launch-args-input" value={form.codexExtraArgs.join("\n")} onChange={event => setForm({ ...form, codexExtraArgs: event.currentTarget.value.split(/\r?\n/).map(value => value.trim()).filter(Boolean) })} /></label>
              <label className="check-row"><input type="checkbox" checked={form.codexAppAutoTakeover} onChange={event => setForm({ ...form, codexAppAutoTakeover: event.currentTarget.checked })} />{t("自动接管 Codex 并加载增强")}</label>
              <Button disabled={!dirty} onClick={() => void actions.saveSettings()}><Save className="h-4 w-4" />{t("保存设置")}</Button>
              <p>{t("增强配置保存在本机，启动时沿用 Codex 当前登录与模型配置。")}</p>
            </div>}
      </section>
    </main>
  </div>;
}
