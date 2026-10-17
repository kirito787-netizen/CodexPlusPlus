import { invoke } from "@tauri-apps/api/core";

import { CheckCircle2, ChevronDown, Download, Info, Save } from "lucide-react";

import { createPortal } from "react-dom";

import { useEffect, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { Input } from "@/components/ui/input";

import { Label } from "@/components/ui/label";

import { NativeBrowserStatusView, nativeBrowserConsent } from "./native-browser-settings";

import { ENHANCEMENT_SECTION_IDS, type EnhancementTab } from "./enhancement-navigation";

import { defaultWhaleBalanceSettings, normalizeWhaleBalanceSettings, whaleBalanceSettingsIssue, type WhaleBalanceIssue, type WhaleBalanceProtocol, type WhaleBalanceSettings } from "./whale-settings";

import { applyDictationPreset, defaultDictationSettings, dictationPreset, dictationSettingsIssue, normalizeDictationSettings, type DictationSettings, type DictationSettingsIssue, type DictationPreset } from "./dictation-settings";

import { normalizeRelayModelRoutes, PROTOCOL_PROXY_BASE_URL, type RelayModelRoute } from "./model-routes";

import { clampAggregateRoutePriority, normalizeAggregateRoutes } from "./aggregate-routes";

import { aggregateMemberCandidates, normalizeAggregateMembers, isAggregateProfile, normalizeAggregateDefaultRelayId } from "./aggregate-members";

import { relayProfileWithNormalizedApiKeys, relayProfileWithUpdatedApiKey, type RelayApiKey } from "./provider-api-keys";

import { usePopoverLayer } from "./use-popover-layer";

import { defaultDreamSkinTheme, normalizeDreamSkinTheme, type DreamSkinThemeConfig } from "./dream-skin";

import { t } from "@/i18n";

const isWindowsPlatform = /\bWindows\b/i.test(navigator.userAgent);

type Status = "ok" | "failed" | "not_implemented" | "not_checked" | string;

type CommandResult<T> = T & {
  status: Status;
  message: string;
};

type PathState = {
  status: string;
  path: string | null;
};

type LaunchStatus = {
  status: string;
  message: string;
  started_at_ms: number;
  debug_port: number | null;
  helper_port: number | null;
  codex_app: string | null;
  aumid: string | null;
};

type RuntimeServiceState = { status: string; address: string | null; message: string };

type OverviewResult = CommandResult<{
  codex_app: PathState;
  codex_version: string | null;
  silent_shortcut: PathState;
  management_shortcut: PathState;
  latest_launch: LaunchStatus | null;
  runtime_health: { codex_app: RuntimeServiceState; local_server: RuntimeServiceState; debugger: RuntimeServiceState; protocol_conversion_enabled: boolean | null };
  current_version: string;
  update_status: string;
  settings_path: string;
  logs_path: string;
}>;

type LaunchCommandResult = CommandResult<{
  launchStartedAtMs?: number;
  nativeBrowserRestoreFailed?: boolean;
}>;

type BackendSettings = WhaleBalanceSettings & {
  codexAppPath: string;
  /** 自动接管官方 App（与 Rust `codex_app_auto_takeover` 对应）。 */
  codexAppAutoTakeover: boolean;
  codexAppAutoTakeoverWhenActive: string;
  codexExtraArgs: string[];
  dictation: DictationSettings;
  providerSyncEnabled: boolean;
  ccsDbPath: string;
  providerSyncSavedProviders: string[];
  providerSyncManualProviders: string[];
  providerSyncLastSelectedProvider: string;
  relayProfilesEnabled: boolean;
  localConfigProviderImported: boolean;
  enhancementsEnabled: boolean;
  codexAppStandaloneQuotaUnlock: boolean;
  codexAppPluginMarketplaceUnlock: boolean;
  codexAppModelWhitelistUnlock: boolean;
  codexAppSessionDelete: boolean;
  codexAppMarkdownExport: boolean;
  codexAppUsageStatusLine: boolean;
  codexAppPasteFix: boolean;
  codexAppForceChineseLocale: boolean;
  codexAppTypingEffect: TypingEffect;
  codexAppThreadIdBadge: boolean;
  codexAppConversationView: boolean;
  codexAppThreadScrollRestore: boolean;
  codexAppNativeMenuPlacement: boolean;
  codexAppNativeBrowserRequireIdentification: boolean;
  codexAppServiceTierControls: boolean;
  codexAppPetRealMouseLook: boolean;
  codexAppActivityOverlayRight: boolean;
  codexAppCapacityAutoRetry: boolean;
  codexAppStepwiseEnabled: boolean;
  codexAppAnswerOutlineEnabled: boolean;
  codexAppStepwiseDirectSend: boolean;
  codexAppStepwiseProtocol: StepwiseProtocol;
  codexAppStepwiseGenerationMode: StepwiseGenerationMode;
  codexAppStepwiseBaseUrl: string;
  codexAppStepwiseApiKey: string;
  codexAppStepwiseApiKeyEnv: string;
  codexAppStepwiseModel: string;
  codexAppStepwiseMaxItems: number;
  codexAppStepwiseMaxInputChars: number;
  codexAppStepwiseMaxOutputTokens: number;
  codexAppStepwiseTimeoutMs: number;
  codexAppImageOverlayEnabled: boolean;
  codexAppImageOverlayPath: string;
  codexAppImageOverlayOpacity: number;
  codexAppImageOverlayFitMode: ImageOverlayFitMode;
  codexAppDreamSkinEnabled: boolean;
  codexAppDreamSkinPaused: boolean;
  codexAppDreamSkinTheme: string;
  codexAppDreamSkinThemeConfig: DreamSkinThemeConfig;
  codexAppDreamSkinImagePath: string;
  codexGoalsEnabled: boolean;
  weixinConnectEnabled: boolean;
  weixinConnectBaseUrl: string;
  weixinConnectToken: string;
  weixinConnectAccountId: string;
  weixinConnectAllowFrom: string;
  weixinConnectRouteTag: string;
  weixinConnectWorkDir: string;
  weixinConnectModel: string;
  weixinConnectSandbox: "read-only" | "workspace-write" | "danger-full-access";
  weixinConnectCodexPath: string;
  relayBaseUrl: string;
  relayApiKey: string;
  relayProfiles: RelayProfile[];
  aggregateRelayProfiles: AggregateRelayProfile[];
  activeAggregateRelayId: string;
  relayCommonConfigContents: string;
  relayContextConfigContents: string;
  activeRelayId: string;
  relayTestModel: string;
  /** 按工具分区的配置镜像，键为工具 id（codex / grok / …）。 */
  tools?: Record<string, ToolShard>;
  /** 侧栏当前聚焦的工具。只影响管理器的展示，不影响 Codex 的启动配置。 */
  activeTool?: string;
};

/** settings.json 里单个工具的配置分片。Codex 分片由后端从扁平字段镜像生成。 */
type ToolShard = {
  relayProfiles?: RelayProfile[];
  activeRelayId?: string;
  aggregateRelayProfiles?: AggregateRelayProfile[];
  activeAggregateRelayId?: string;
  relayCommonConfigContents?: string;
  relayContextConfigContents?: string;
  relayTestModel?: string;
};

type ImageOverlayFitMode = "fill" | "fit" | "stretch" | "tile" | "center";

type TypingEffect = "off" | "rainbow" | "fireworks" | "stars";

export type RelayProfile = {
  id: string;
  name: string;
  model: string;
  baseUrl: string;
  upstreamBaseUrl: string;
  apiKey: string;
  apiKeys?: RelayApiKey[];
  activeApiKeyId?: string;
  protocol: RelayProtocol;
  relayMode: RelayMode;
  sessionProvider?: RelaySessionProvider;
  officialMixApiKey: boolean;
  hideOfficialUsageAlert: boolean;
  testModel: string;
  configContents: string;
  authContents: string;
  useCommonConfig: boolean;
  contextSelection: RelayContextSelection;
  contextSelectionInitialized: boolean;
  contextWindow: string;
  autoCompactLimit: string;
  modelList: string;
  modelWindows: string;
  modelAutoCompact: string;
  modelMetadata: string;
  modelVlm: string;
  vlmApiKey: string;
  vlmModel: string;
  vlmBaseUrl: string;
  userAgent: string;
  customHeaders: { key: string; value: string }[];
  sub2apiEnabled: boolean;
  sub2apiMultiplier: string;
  noAuth: boolean;
  modelRoutes?: RelayModelRoute[];
  standardOpenaiProtocol: boolean;
  webSearchHistoryCompat: boolean;
  /** Anthropic 上游的认证字段：`x-api-key`（默认）或 `authorization`。 */
  anthropicAuthHeader?: string;
  /** Anthropic 的 `max_tokens` 兜底值，0/缺省表示用内置 8192；填了则优先于请求值。 */
  anthropicMaxTokens?: number;
  /** 注入 Anthropic 提示缓存断点，默认开启。 */
  anthropicPromptCache?: boolean;
  /** 伪装 Claude Code 客户端（仅网关限制「只能通过 Claude Code 使用」时需要）。 */
  anthropicImpersonateClaudeCode?: boolean;
  /** 思考模式：空/auto、adaptive（等级透传）、budget（经典预算）、off。 */
  anthropicThinkingMode?: string;
  aggregate?: RelayAggregateConfig | null;
};

type RelayAggregateStrategy = "failover" | "conversationRoundRobin" | "requestRoundRobin" | "weightedRoundRobin";

type RelayAggregateMember = {
  profileId: string;
  weight: number;
};

type RelayAggregateRoute = {
  pattern: string;
  profileId: string;
  priority: number;
};

type RelayAggregateConfig = {
  strategy: RelayAggregateStrategy;
  members: RelayAggregateMember[];
  routes?: RelayAggregateRoute[];
  modelAggregationEnabled?: boolean;
  /** 默认供应商：解析不到成员的普通模型请求交给该成员转发；空串表示未设置。 */
  defaultRelayId?: string;
  /** 把默认成员的官方登录同步进 Codex（写 auth.json 的 tokens 段）。默认关。 */
  syncDefaultMemberLogin?: boolean;
};

type AggregateRelayMember = {
  relayId: string;
  weight: number;
};

type AggregateRelayProfile = {
  id: string;
  name: string;
  sessionProvider?: RelaySessionProvider;
  modelAggregationEnabled?: boolean;
  strategy: RelayAggregateStrategy;
  members: AggregateRelayMember[];
  routes?: { pattern: string; relayId: string; priority: number }[];
  defaultRelayId?: string;
  /** 把默认成员的官方登录同步进 Codex（auth.json 的 tokens 段）。默认关。 */
  syncDefaultMemberLogin?: boolean;
};

type RelayContextSelection = {
  mcpServers: string[];
  skills: string[];
  plugins: string[];
};

type ContextKind = "mcp" | "skill" | "plugin";

type CodexContextEntry = {
  id: string;
  kind: ContextKind;
  title: string;
  summary: string;
  tomlBody: string;
  enabled: boolean;
};

type CodexContextEntries = {
  mcpServers: CodexContextEntry[];
  skills: CodexContextEntry[];
  plugins: CodexContextEntry[];
};

type RelayProtocol = "responses" | "chatCompletions" | "anthropicMessages";

type StepwiseProtocol = "auto" | "chat_completions" | "responses" | "anthropic_messages";

type StepwiseGenerationMode = "auto" | "manual";

type RelayMode = "official" | "mixedApi" | "pureApi" | "aggregate";

type RelaySessionProvider = "custom" | "openai";

const CHAT_UPSTREAM_BASE_URL_KEY = "codex_plus_chat_base_url";

const emptyContextSelection = (): RelayContextSelection => ({
  mcpServers: [],
  skills: [],
  plugins: [],
});

type UserScriptInventory = {
  enabled?: boolean;
  scripts?: Array<{
    key: string;
    name: string;
    source: string;
    enabled: boolean;
    status: string;
    error: string;
    market_id?: string;
    version?: string;
    installed?: boolean;
    source_url?: string;
    homepage?: string;
  }>;
};

type SettingsResult = CommandResult<{
  settings: BackendSettings;
  settings_path: string;
  user_scripts: UserScriptInventory;
}>;

type StepwiseTestResult = CommandResult<{
  itemCount: number;
  error: string;
}>;

const defaultSettings: BackendSettings = {
  ...defaultWhaleBalanceSettings(),
  codexAppPath: "",
  codexAppAutoTakeover: false,
  codexAppAutoTakeoverWhenActive: "defer",
  codexExtraArgs: [],
  dictation: defaultDictationSettings(),
  providerSyncEnabled: false,
  ccsDbPath: "",
  providerSyncSavedProviders: [],
  providerSyncManualProviders: [],
  providerSyncLastSelectedProvider: "",
  relayProfilesEnabled: false,
  localConfigProviderImported: false,
  enhancementsEnabled: true,
  codexAppStandaloneQuotaUnlock: false,
  codexAppPluginMarketplaceUnlock: true,
  codexAppModelWhitelistUnlock: true,
  codexAppSessionDelete: true,
  codexAppMarkdownExport: true,
  codexAppUsageStatusLine: true,
  codexAppPasteFix: false,
  codexAppForceChineseLocale: false,
  codexAppTypingEffect: "off",
  codexAppThreadIdBadge: false,
  codexAppConversationView: false,
  codexAppThreadScrollRestore: true,
  codexAppNativeMenuPlacement: true,
  codexAppNativeBrowserRequireIdentification: false,
  codexAppServiceTierControls: false,
  codexAppPetRealMouseLook: false,
  codexAppActivityOverlayRight: false,
  codexAppCapacityAutoRetry: false,
  codexAppStepwiseEnabled: false,
  codexAppAnswerOutlineEnabled: false,
  codexAppStepwiseDirectSend: false,
  codexAppStepwiseProtocol: "chat_completions",
  codexAppStepwiseGenerationMode: "auto",
  codexAppStepwiseBaseUrl: "",
  codexAppStepwiseApiKey: "",
  codexAppStepwiseApiKeyEnv: "CODEX_STEPWISE_API_KEY",
  codexAppStepwiseModel: "",
  codexAppStepwiseMaxItems: 4,
  codexAppStepwiseMaxInputChars: 6000,
  codexAppStepwiseMaxOutputTokens: 500,
  codexAppStepwiseTimeoutMs: 8000,
  codexAppImageOverlayEnabled: false,
  codexAppImageOverlayPath: "",
  codexAppImageOverlayOpacity: 35,
  codexAppImageOverlayFitMode: "fit",
  codexAppDreamSkinEnabled: false,
  codexAppDreamSkinPaused: false,
  codexAppDreamSkinTheme: "pink",
  codexAppDreamSkinThemeConfig: defaultDreamSkinTheme(),
  codexAppDreamSkinImagePath: "",
  codexGoalsEnabled: false,
  weixinConnectEnabled: false,
  weixinConnectBaseUrl: "https://ilinkai.weixin.qq.com",
  weixinConnectToken: "",
  weixinConnectAccountId: "",
  weixinConnectAllowFrom: "",
  weixinConnectRouteTag: "",
  weixinConnectWorkDir: "",
  weixinConnectModel: "",
  weixinConnectSandbox: "read-only",
  weixinConnectCodexPath: "",
  relayBaseUrl: "",
  relayApiKey: "",
  relayProfiles: [
    {
      id: "default",
      name: t("默认中转"),
      model: "",
      baseUrl: "",
      upstreamBaseUrl: "",
      apiKey: "",
      protocol: "responses",
      relayMode: "official",
      officialMixApiKey: false,
      hideOfficialUsageAlert: false,
      testModel: "",
      configContents: "",
      authContents: "",
      useCommonConfig: true,
      contextSelection: emptyContextSelection(),
      contextSelectionInitialized: true,
      contextWindow: "",
      autoCompactLimit: "",
      modelList: "",
      modelWindows: "",
      modelAutoCompact: "",
      modelMetadata: "",
      modelVlm: "",
      vlmApiKey: "",
      vlmModel: "",
      vlmBaseUrl: "",
      userAgent: "",
      customHeaders: [],
      sub2apiEnabled: false,
      noAuth: false,
      sub2apiMultiplier: "",
      standardOpenaiProtocol: false,
      webSearchHistoryCompat: false,
    },
  ],
  relayCommonConfigContents: "",
  relayContextConfigContents: "",
  activeRelayId: "default",
  aggregateRelayProfiles: [],
  activeAggregateRelayId: "",
  relayTestModel: "gpt-5.4-mini",
  tools: {},
  activeTool: "codex",
};

function whaleBalanceValidationMessage(issue: WhaleBalanceIssue | null): string | null {
  if (issue === "path") return t("请填写供应商同域下的余额接口路径，不包含网址、查询参数或片段。");
  if (issue === "field") return t("请填写余额字段路径，例如 data.balance 或 data.accounts[0].balance。");
  if (issue === "currency") return t("币种请使用三位代码，例如 USD 或 CNY。");
  if (issue === "scale") return t("金额倍率必须是大于 0 且不超过 1e12 的有限数值。");
  return null;
}

function WhaleBalanceSettingsFields({ form, onFormChange }: {
  form: BackendSettings;
  onFormChange: (value: BackendSettings) => void;
}) {
  if (!form.codexAppWhaleWidgetEnabled) return null;
  const update = (patch: Partial<WhaleBalanceSettings>) => onFormChange({ ...form, ...patch });
  const issue = whaleBalanceValidationMessage(whaleBalanceSettingsIssue(normalizeWhaleBalanceSettings(form)));
  const disabled = !form.enhancementsEnabled;
  return (
    <details className="settings-block">
      <summary>{t("API 余额（可选）")}</summary>
      <p className="field-hint">{t("跟随 Codex++ 当前供应商查询余额；Codex 订阅额度和本地 token 无需配置此项。")}</p>
      <Field label={t("余额查询方式")}>
        <AppSelect<WhaleBalanceProtocol>
          value={form.codexAppWhaleBalanceProtocol}
          disabled={disabled}
          onChange={(value) => update({ codexAppWhaleBalanceProtocol: value })}
          options={[
            { value: "auto", label: t("自动识别已支持的接口") },
            { value: "off", label: t("仅显示 Codex 用量") },
            { value: "custom", label: t("自定义供应商余额接口") },
          ]}
        />
      </Field>
      {form.codexAppWhaleBalanceProtocol === "custom" ? <>
        <p className="field-hint">{t("按供应商文档填写 GET 接口和返回字段，复用当前供应商的 API Key。币种和倍率应与供应商账单一致。")}</p>
        <Field label={t("余额接口路径")}>
          <Input disabled={disabled} value={form.codexAppWhaleBalancePath} placeholder="/api/balance" onChange={(event) => update({ codexAppWhaleBalancePath: event.currentTarget.value })} />
        </Field>
        <Field label={t("余额字段路径")}>
          <Input disabled={disabled} value={form.codexAppWhaleBalanceField} placeholder="data.balance" onChange={(event) => update({ codexAppWhaleBalanceField: event.currentTarget.value })} />
        </Field>
        <div className="form-row">
          <Field label={t("余额币种")}>
            <Input disabled={disabled} maxLength={3} value={form.codexAppWhaleBalanceCurrency} placeholder="USD" onChange={(event) => update({ codexAppWhaleBalanceCurrency: event.currentTarget.value.toUpperCase() })} />
          </Field>
          <Field label={t("金额倍率")}>
            <Input disabled={disabled} type="number" step="any" min={0} value={Number.isFinite(form.codexAppWhaleBalanceScale) ? form.codexAppWhaleBalanceScale : ""} onChange={(event) => update({ codexAppWhaleBalanceScale: event.currentTarget.valueAsNumber })} />
          </Field>
        </div>
        <p className="field-hint">{t("显示金额 = 接口数值 × 倍率；例如接口返回分时，倍率填 0.01。")}</p>
        {issue ? <p className="field-hint" role="alert">{issue}</p> : null}
      </> : null}
    </details>
  );
}

type DictationLocalModelState = {
  phase: string;
  modelReady: boolean;
  completedBytes?: number;
  totalBytes: number;
  message?: string;
};

function DictationSettingsPanel({ form, onFormChange }: {
  form: BackendSettings;
  onFormChange: (value: BackendSettings) => void;
}) {
  const [dictationPresetSelection, setDictationPresetSelection] = useState<DictationPreset>(() => dictationPreset(form.dictation));
  useEffect(() => setDictationPresetSelection(dictationPreset(form.dictation)), [form.dictation.baseUrl]);
  const [localModelState, setLocalModelState] = useState<DictationLocalModelState | null>(null);
  const [localModelDownloading, setLocalModelDownloading] = useState(false);
  const [localModelError, setLocalModelError] = useState("");
  useEffect(() => {
    if (form.dictation.provider !== "sensevoice") return;
    let active = true;
    const refresh = () => invoke<DictationLocalModelState>("dictation_local_model_status")
      .then((state) => { if (active) { setLocalModelState(state); } })
      .catch(() => { if (active) setLocalModelError(t("无法读取本地模型状态，请重试。")); });
    void refresh();
    const timer = window.setInterval(() => { void refresh(); }, 1000);
    return () => { active = false; window.clearInterval(timer); };
  }, [form.dictation.provider]);
  const downloadLocalModel = async () => {
    setLocalModelDownloading(true);
    setLocalModelError("");
    try {
      const result = await invoke<CommandResult<DictationLocalModelState>>("download_dictation_local_model");
      if (result.status !== "ok") setLocalModelError(result.message);
      else setLocalModelState(result);
    } catch {
      setLocalModelError(t("本地模型下载失败，请重试。"));
    } finally {
      setLocalModelDownloading(false);
    }
  };
  const downloading = localModelDownloading || localModelState?.phase === "downloading";
  const updateDictation = (patch: Partial<DictationSettings>) => onFormChange({
    ...form,
    dictation: { ...form.dictation, ...patch },
  });
  const dictationIssue = dictationSettingsValidationMessage(dictationSettingsIssue(form.dictation));
  return (
    <Panel className="enhance-service-panel">
      <CardHead title={t("语音输入")} detail={t("独立的语音转文字服务，与代码模型和供应商配置无关。")} />
      <CardContent className="settings-content">
        <div className="settings-block enhance-service-block" id={ENHANCEMENT_SECTION_IDS.dictation}>
          <FeatureToggle
            title={t("启用语音输入")}
            detail={t("停止录音后，可将转写文字插入或发送到当前会话。")}
            disabled={!form.enhancementsEnabled}
            checked={form.dictation.enabled}
            onChange={(enabled) => updateDictation({ enabled })}
          />
          <div className="form-row">
            <Field label={t("语音服务预设")}>
              <AppSelect
                value={dictationPresetSelection}
                onChange={(value) => {
                  setDictationPresetSelection(value);
                  onFormChange({ ...form, dictation: applyDictationPreset(form.dictation, value) });
                }}
                options={[
                  { value: "sensevoice", label: t("本地 SenseVoice（离线）") },
                  { value: "groq", label: "Groq" },
                  { value: "openai", label: t("OpenAI 兼容") },
                  { value: "local", label: t("本地服务") },
                  { value: "custom", label: t("自定义") },
                ]}
              />
            </Field>
            <Field label={t("语音模型")}>
              <Input
                value={form.dictation.model}
                onChange={(event) => updateDictation({ model: event.currentTarget.value })}
                placeholder="whisper-large-v3-turbo"
                spellCheck={false}
              />
            </Field>
          </div>
          {form.dictation.provider === "sensevoice" ? <>
            <p className="field-hint">{t("SenseVoiceSmall 在本机 CPU 上运行。请手动下载约 229 MiB 模型，下载并校验完成后才可录音转写；音频不会离开本机。")}</p>
            <div className="form-row">
              <Button type="button" disabled={downloading} onClick={() => { void downloadLocalModel(); }}>
                <Download className="h-4 w-4" />
                {downloading ? t("正在下载并校验…") : localModelState?.modelReady ? t("校验或重新下载模型") : t("下载本地模型")}
              </Button>
              <span className="field-hint" role="status">
                {downloading
                  ? `${Math.min(100, Math.floor((localModelState?.completedBytes || 0) / (localModelState?.totalBytes || 239549735) * 100))}%`
                  : localModelState?.modelReady ? t("本地模型已下载") : t("本地模型尚未下载")}
              </span>
            </div>
            {localModelError || localModelState?.phase === "failed" ? <p className="field-hint" role="alert">{localModelError || localModelState?.message}</p> : null}
          </> : <>
            <Field label="Base URL">
              <Input
                value={form.dictation.baseUrl}
                onChange={(event) => updateDictation({ baseUrl: event.currentTarget.value })}
                placeholder="https://api.groq.com/openai/v1"
                spellCheck={false}
              />
            </Field>
            <p className="field-hint">{t("填写服务的 API 基础地址，转写请求会发送到 /audio/transcriptions。可修改预设地址和模型。")}</p>
            <Field label="API Key">
              <Input
                type="password"
                autoComplete="off"
                value={form.dictation.apiKey}
                onChange={(event) => updateDictation({ apiKey: event.currentTarget.value })}
              />
            </Field>
            <p className="field-hint">{t("可填写 API Key 或环境变量名称。本地服务不要求认证时可留空。")}</p>
          </>}
          <details className="stepwise-advanced enhance-service-advanced">
            <summary>{t("高级参数")}</summary>
            <Field label={t("API Key 环境变量")}>
              <Input
                value={form.dictation.apiKeyEnv}
                onChange={(event) => updateDictation({ apiKeyEnv: event.currentTarget.value })}
                placeholder="GROQ_API_KEY"
                spellCheck={false}
              />
            </Field>
            <div className="form-row">
              <Field label={t("语音语言")}>
                <Input
                  value={form.dictation.language}
                  onChange={(event) => updateDictation({ language: event.currentTarget.value })}
                  placeholder={t("留空自动识别，例如 zh 或 en")}
                  spellCheck={false}
                />
              </Field>
              <Field label={t("转写超时（秒）")}>
                <Input
                  type="number"
                  min={1}
                  max={600}
                  value={form.dictation.timeoutSeconds}
                  onChange={(event) => updateDictation({ timeoutSeconds: clampNumber(Number(event.currentTarget.value), 1, 600) })}
                />
              </Field>
            </div>
          </details>
          {dictationIssue ? <p className="field-hint" role="alert">{dictationIssue}</p> : null}
          <div className="hint-line enhance-service-note">
            <Info className="h-4 w-4" />
            <span>{form.dictation.provider === "sensevoice"
              ? t("下载模型并保存配置后，可在 Codex 输入框录音，停止后在本机转写并插入文字。")
              : t("保存后 Codex 输入框底部会显示麦克风图标，停止录音后可插入或发送文字。录音会发送到上面填写的服务地址，无需重启。")}</span>
          </div>
        </div>
      </CardContent>
    </Panel>
  );
}

function StepwiseSettingsPanel({ form, onFormChange, actions }: {
  form: BackendSettings;
  onFormChange: (value: BackendSettings) => void;
  actions: EnhancementActions;
}) {
  return (
    <Panel className="enhance-service-panel">
      <CardHead title={t("下一步建议")} detail={t("控制下一步建议与回答大纲。")} />
      <CardContent className="settings-content">
        <div className="settings-block stepwise-settings-block" id={ENHANCEMENT_SECTION_IDS.stepwise}>
          <div className="enhance-service-toggles">
            <FeatureToggle title={t("下一步建议")} detail={t("根据当前回答生成下一步建议。")} checked={form.codexAppStepwiseEnabled} disabled={!form.enhancementsEnabled} onChange={(value) => onFormChange({ ...form, codexAppStepwiseEnabled: value })} />
            <FeatureToggle title={t("回答大纲")} detail={t("整理当前回答的结构。")} checked={form.codexAppAnswerOutlineEnabled} disabled={!form.enhancementsEnabled} onChange={(value) => onFormChange({ ...form, codexAppAnswerOutlineEnabled: value })} />
            <FeatureToggle title={t("建议直接发送")} detail={t("点击建议后直接发送到当前会话。")} checked={form.codexAppStepwiseDirectSend} disabled={!form.enhancementsEnabled} onChange={(value) => onFormChange({ ...form, codexAppStepwiseDirectSend: value })} />
          </div>
          <div className="stepwise-settings-section">{t("连接")}</div>
          <div className="form-row">
            <Field label="Base URL">
              <Input
                value={form.codexAppStepwiseBaseUrl}
                onChange={(event) => onFormChange({ ...form, codexAppStepwiseBaseUrl: event.currentTarget.value })}
                placeholder="https://api.example.com/v1"
              />
            </Field>
            <Field label="Model">
              <Input
                value={form.codexAppStepwiseModel}
                onChange={(event) => onFormChange({ ...form, codexAppStepwiseModel: event.currentTarget.value })}
                placeholder={t("例如 gpt-5.4-mini")}
              />
            </Field>
          </div>
          <div className="form-row">
            <Field label={t("协议")}>
              <AppSelect
                value={form.codexAppStepwiseProtocol}
                onChange={(value) => onFormChange({ ...form, codexAppStepwiseProtocol: value })}
                options={[
                  { value: "auto", label: t("自动兼容") },
                  { value: "chat_completions", label: "Chat Completions" },
                  { value: "responses", label: "Responses API" },
                  { value: "anthropic_messages", label: "Anthropic Messages" },
                ]}
              />
            </Field>
            <Field label={t("模式")}>
              <AppSelect
                value={form.codexAppStepwiseGenerationMode}
                onChange={(value) => onFormChange({ ...form, codexAppStepwiseGenerationMode: value })}
                options={[
                  { value: "auto", label: t("自动生成") },
                  { value: "manual", label: t("手动刷新") },
                ]}
              />
            </Field>
          </div>
          <Field label="API Key">
            <Input
              type="password"
              value={form.codexAppStepwiseApiKey}
              onChange={(event) => onFormChange({ ...form, codexAppStepwiseApiKey: event.currentTarget.value })}
            />
          </Field>
          <details className="stepwise-advanced">
            <summary>{t("高级参数")}</summary>
            <div className="form-row">
              <Field label={t("API Key 环境变量")}>
                <Input
                  value={form.codexAppStepwiseApiKeyEnv}
                  onChange={(event) => onFormChange({ ...form, codexAppStepwiseApiKeyEnv: event.currentTarget.value })}
                />
              </Field>
              <Field label={t("最多建议数")}>
                <Input
                  max={6}
                  min={0}
                  type="number"
                  value={form.codexAppStepwiseMaxItems}
                  onChange={(event) =>
                    onFormChange({ ...form, codexAppStepwiseMaxItems: clampNumber(Number(event.currentTarget.value), 0, 6) })
                  }
                />
              </Field>
            </div>
            <div className="form-row">
              <Field label={t("超时毫秒")}>
                <Input
                  min={1000}
                  type="number"
                  value={form.codexAppStepwiseTimeoutMs}
                  onChange={(event) =>
                    onFormChange({ ...form, codexAppStepwiseTimeoutMs: clampNumber(Number(event.currentTarget.value), 1000, 60000) })
                  }
                />
              </Field>
              <Field label={t("最大输入字符")}>
                <Input
                  min={1000}
                  type="number"
                  value={form.codexAppStepwiseMaxInputChars}
                  onChange={(event) =>
                    onFormChange({ ...form, codexAppStepwiseMaxInputChars: clampNumber(Number(event.currentTarget.value), 1000, 24000) })
                  }
                />
              </Field>
            </div>
            <Field label={t("最大输出 tokens")}>
              <Input
                min={100}
                type="number"
                value={form.codexAppStepwiseMaxOutputTokens}
                onChange={(event) =>
                  onFormChange({ ...form, codexAppStepwiseMaxOutputTokens: clampNumber(Number(event.currentTarget.value), 100, 4000) })
                }
              />
            </Field>
          </details>
          <div className="toolbar stepwise-settings-actions">
            <Button variant="secondary" onClick={() => void actions.testStepwiseSettings(form)}>{t("测试连接")}</Button>
          </div>
        </div>
      </CardContent>
    </Panel>
  );
}

function EnhanceScreen({
  dirty,
  activeTab,
  onTabChange,
  form,
  onFormChange,
  actions,
}: {
  dirty: boolean;
  activeTab: EnhancementTab;
  onTabChange: (tab: EnhancementTab) => void;
  form: BackendSettings;
  onFormChange: (value: BackendSettings) => void;
  actions: EnhancementActions;
}) {
  const setEnhanceFlag = (key: keyof BackendSettings, value: boolean) => onFormChange({ ...form, [key]: value });
  const setPersistedEnhanceFlag = (key: keyof BackendSettings, value: boolean) => {
    const next = { ...form, [key]: value };
    onFormChange(next);
    void actions.saveSettingsValue(next, true);
  };
  const masterEnabled = form.enhancementsEnabled;
  const tabs: Array<{ value: EnhancementTab; label: string }> = [
    { value: "general", label: t("常用增强") },
    { value: "dictation", label: t("语音输入") },
    { value: "stepwise", label: t("下一步建议") },
  ];
  const selectTab = (tab: EnhancementTab) => {
    onTabChange(tab);
    document.getElementById("enhance-page-controls")?.scrollIntoView({ block: "start" });
  };
  return (
    <div className="settings-page enhance-page">
      <div className="enhance-page-controls" id="enhance-page-controls">
        <div className="enhance-page-toolbar">
          <div className="enhance-primary-switches">
            <label className="switch-row compact enhance-master-switch">
              <input
                checked={form.enhancementsEnabled}
                onChange={(event) => onFormChange({ ...form, enhancementsEnabled: event.currentTarget.checked })}
                type="checkbox"
              />
              <span>
                <strong>{t("启用 Codex增强")}</strong>
                <small>{t("关闭后暂停增强功能，服务配置会保留。")}</small>
              </span>
              <ToggleVisual />
            </label>
            <label className="switch-row compact enhance-master-switch">
              <input
                checked={form.codexAppStandaloneQuotaUnlock}
                onChange={(event) => setEnhanceFlag("codexAppStandaloneQuotaUnlock", event.currentTarget.checked)}
                type="checkbox"
              />
              <span>
                <strong>{t("独立额度解锁")}</strong>
                <small>{t("官方登录 + 混入 API Key")}</small>
              </span>
              <ToggleVisual />
            </label>
          </div>
          <div className="enhance-save-actions">
            <span className={dirty ? "is-dirty" : ""} role="status">{dirty ? t("有未保存修改") : t("已保存")}</span>
            <Button disabled={!dirty} onClick={() => void actions.saveSettings()}>
              <Save className="h-4 w-4" />
              {t("保存增强设置")}
            </Button>
          </div>
        </div>
        <div className="enhance-tabs" role="tablist" aria-label={t("Codex增强")}>
          {tabs.map((tab, index) => (
            <button
              key={tab.value}
              id={`enhance-tab-${tab.value}`}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.value}
              aria-controls={`enhance-pane-${tab.value}`}
              tabIndex={activeTab === tab.value ? 0 : -1}
              onClick={() => selectTab(tab.value)}
              onKeyDown={(event) => {
                const nextIndex = event.key === "ArrowRight" ? (index + 1) % tabs.length
                  : event.key === "ArrowLeft" ? (index + tabs.length - 1) % tabs.length
                    : event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : null;
                if (nextIndex === null) return;
                event.preventDefault();
                const nextTab = tabs[nextIndex].value;
                selectTab(nextTab);
                document.getElementById(`enhance-tab-${nextTab}`)?.focus();
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      <div className="enhance-tab-panel" id="enhance-pane-general" role="tabpanel" aria-labelledby="enhance-tab-general" hidden={activeTab !== "general"}>
        <Panel className="enhance-panel">
          <CardContent className="enhance-content">
            <div className="enhance-feature-groups">
              <FeatureGroup title={t("插件与模型")} detail={t("管理插件市场、模型列表和服务档位相关增强。")}>
                {isWindowsPlatform ? <>
                  <FeatureToggle
                    title={t("原生 Edge / Chrome 请求标识兼容（实验）")}
                    detail={t("此兼容补丁仅适配 Windows 上的 Edge / Chrome；下次启动 Codex 时应用。扩展可能保留请求标识设置。")}
                    checked={form.codexAppNativeBrowserRequireIdentification}
                    disabled={!masterEnabled}
                    onChange={(value) => {
                      if (value && !window.confirm(nativeBrowserConsent)) return;
                      setEnhanceFlag("codexAppNativeBrowserRequireIdentification", value);
                    }}
                  />
                  <NativeBrowserStatusView />
                </> : null}
                <FeatureToggle title={t("插件市场解锁")} detail={t("API Key 模式下扩展插件市场请求，尽量显示完整插件列表；官方/混合模式通常不需要。")} checked={form.codexAppPluginMarketplaceUnlock} disabled={!masterEnabled} onChange={(value) => setEnhanceFlag("codexAppPluginMarketplaceUnlock", value)} />
                <FeatureToggle title={t("模型白名单解锁")} detail={t("从环境变量和 config.toml 的 /v1/models 拉取模型并补进模型列表。")} checked={form.codexAppModelWhitelistUnlock} disabled={!masterEnabled} onChange={(value) => setEnhanceFlag("codexAppModelWhitelistUnlock", value)} />
                <FeatureToggle title={t("Fast 按钮")} detail={t("显示服务模式切换按钮；Fast 仅支持 gpt-5.4 / gpt-5.5，其他模型按 Standard 发送。")} checked={form.codexAppServiceTierControls} disabled={!masterEnabled} onChange={(value) => setEnhanceFlag("codexAppServiceTierControls", value)} />
              </FeatureGroup>
              <FeatureGroup title={t("对话与输入")} detail={t("调整会话管理、输入行为和对话阅读体验。")}>
                <FeatureToggle title={t("会话删除")} detail={t("在会话列表悬停显示删除按钮，并支持撤销。")} checked={form.codexAppSessionDelete} disabled={!masterEnabled} onChange={(value) => setEnhanceFlag("codexAppSessionDelete", value)} />
                <FeatureToggle title={t("Markdown 导出")} detail={t("在会话列表显示导出按钮，导出带时间戳的 Markdown。")} checked={form.codexAppMarkdownExport} disabled={!masterEnabled} onChange={(value) => setEnhanceFlag("codexAppMarkdownExport", value)} />
                <FeatureToggle title={t("粘贴修复")} detail={t("从 Word 等富文本粘贴到 Codex composer 时只保留纯文本，避免被识别为图片/文件附件。需重启 Codex 才生效。")} checked={form.codexAppPasteFix} disabled={!masterEnabled} onChange={(value) => setEnhanceFlag("codexAppPasteFix", value)} />
                <FeatureToggle title={t("强制中文界面")} detail={t("强制启用 Codex App 内置 zh-CN 语言包，避免 Statsig/VPN 不通时回退英文。需重启 Codex 才能完整生效。")} checked={form.codexAppForceChineseLocale} disabled={!masterEnabled} onChange={(value) => setEnhanceFlag("codexAppForceChineseLocale", value)} />
                <FeatureToggle title={t("容量错误自动重试")} detail={t("模型容量不足（Selected model is at capacity）时自动点「重试」。Codex 原生只会自动重试 4 次且带 10/30/120/300 秒倒计时，之后只剩手动按钮；开启后由 Codex++ 立刻接管，原生倒计时也不等。间隔与次数上限在 Codex 应用内的 Codex++ 设置里调整。")} checked={form.codexAppCapacityAutoRetry} disabled={!masterEnabled} onChange={(value) => setEnhanceFlag("codexAppCapacityAutoRetry", value)} />
                <div className={`feature-toggle ${!masterEnabled ? "disabled" : ""}`}>
                  <span>
                    <strong>{t("打字特效（彩虹 P）")}</strong>
                    <small>{t("在 Codex 输入框的光标附近显示特效，保存后生效；系统减少动态效果时暂停。")}</small>
                  </span>
                  <AppSelect<TypingEffect>
                    ariaLabel={t("打字特效（彩虹 P）")}
                    value={form.codexAppTypingEffect}
                    disabled={!masterEnabled}
                    onChange={(value) => onFormChange({ ...form, codexAppTypingEffect: value })}
                    options={[
                      { value: "off", label: t("关闭") },
                      { value: "rainbow", label: t("彩虹粒子") },
                      { value: "fireworks", label: t("烟花") },
                      { value: "stars", label: t("星光") },
                    ]}
                  />
                </div>
                <FeatureToggle title={t("会话 ID 标识")} detail={t("在侧边栏会话标题前显示短 ID 和 UUIDv7 创建时间，方便定位历史会话。")} checked={form.codexAppThreadIdBadge} disabled={!masterEnabled} onChange={(value) => setEnhanceFlag("codexAppThreadIdBadge", value)} />
                <FeatureToggle title={t("对话居中宽度")} detail={t("把主对话和输入框限制到固定最大宽度，适合大屏阅读。")} checked={form.codexAppConversationView} disabled={!masterEnabled} onChange={(value) => setEnhanceFlag("codexAppConversationView", value)} />
                <FeatureToggle title={t("切换对话保留位置")} detail={t("切换 thread 时恢复上一次浏览位置。")} checked={form.codexAppThreadScrollRestore} disabled={!masterEnabled} onChange={(value) => setEnhanceFlag("codexAppThreadScrollRestore", value)} />
                <FeatureToggle title={t("用量状态栏")} detail={t("在输入框下方显示生成速度、缓存命中率和上下文占用。数据来自本机 Codex 会话记录，不改变请求内容。")} checked={form.codexAppUsageStatusLine} disabled={!masterEnabled} onChange={(value) => setEnhanceFlag("codexAppUsageStatusLine", value)} />
              </FeatureGroup>
              <FeatureGroup title={t("挂件与桌宠")} detail={t("在 Codex 中查看用量，设置自己的角色和互动方式。")}>
                <FeatureToggle
                  title={t("Codex 用量挂件")}
                  detail={t("原版角色、泡泡编辑器、音效库和提醒，显示 Codex 会话与全机用量。点击角色旁的菜单配置。")}
                  checked={form.codexAppWhaleWidgetEnabled}
                  disabled={!masterEnabled}
                  onChange={(value) => setEnhanceFlag("codexAppWhaleWidgetEnabled", value)}
                />
                <FeatureToggle title={t("活动进度条右侧布局")} detail={t("把 Codex 原生活动进度条、状态波形和活动悬浮框移到右侧，并镜像波形方向。")} checked={form.codexAppActivityOverlayRight} disabled={!masterEnabled} onChange={(value) => setEnhanceFlag("codexAppActivityOverlayRight", value)} />
                {isWindowsPlatform ? <FeatureToggle title={t("桌宠跟随真实鼠标")} detail={t("仅支持 V2 桌宠；不会修改宠物文件。将 V2 的 Computer Use 光标朝向动作映射到真实鼠标，V1 开启后安全不生效；拖拽、原生悬停或 Computer Use 活跃时自动让步。")} checked={form.codexAppPetRealMouseLook} disabled={!masterEnabled} onChange={(value) => setPersistedEnhanceFlag("codexAppPetRealMouseLook", value)} /> : null}
                {/* 余额配置独占一整行（CSS: > .settings-block），展开时不会牵动上面的开关卡。 */}
                <WhaleBalanceSettingsFields form={form} onFormChange={onFormChange} />
              </FeatureGroup>
            </div>
            <div className="hint-line enhance-footer-hint">
              <Info className="h-4 w-4" />
              <span>{t("如果使用官方模式或官方混入 API 模式，通常不需要开启插件市场解锁。")}</span>
            </div>
          </CardContent>
        </Panel>
      </div>
      <div className="enhance-tab-panel" id="enhance-pane-dictation" role="tabpanel" aria-labelledby="enhance-tab-dictation" hidden={activeTab !== "dictation"}>
        <DictationSettingsPanel form={form} onFormChange={onFormChange} />
      </div>
      <div className="enhance-tab-panel" id="enhance-pane-stepwise" role="tabpanel" aria-labelledby="enhance-tab-stepwise" hidden={activeTab !== "stepwise"}>
        <StepwiseSettingsPanel form={form} onFormChange={onFormChange} actions={actions} />
      </div>
    </div>
  );
}

function FeatureGroup({ title, detail, children }: { title: string; detail: string; children: ReactNode }) {
  return (
    <section className="feature-group">
      <div className="feature-group-head">
        <strong>{title}</strong>
        <small>{detail}</small>
      </div>
      <div className="feature-switch-grid">{children}</div>
    </section>
  );
}

function FeatureToggle({
  title,
  detail,
  checked,
  disabled = false,
  onChange,
}: {
  title: string;
  detail: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className={`feature-toggle ${disabled ? "disabled" : ""}`}>
      <input
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.currentTarget.checked)}
        type="checkbox"
      />
      <span>
        <strong>{title}</strong>
        <small>{detail}</small>
      </span>
      <ToggleVisual />
    </label>
  );
}

function ToggleVisual() {
  return (
    <span aria-hidden="true" className="toggle-switch-visual">
      <span className="toggle-switch-thumb" />
    </span>
  );
}

function Panel({ children, fill = false, className = "" }: { children: React.ReactNode; fill?: boolean; className?: string }) {
  return (
    <Card className={`panel ${fill ? "fill" : ""} ${className}`}>
      {children}
    </Card>
  );
}

function CardHead({ title, detail }: { title: string; detail: string }) {
  return (
    <CardHeader className="panel-head">
      <CardTitle>{title}</CardTitle>
      <CardDescription>{detail}</CardDescription>
    </CardHeader>
  );
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <Label className={`field ${className}`}>
      <span>{label}</span>
      {children}
    </Label>
  );
}

type AppSelectOption<T extends string> = {
  value: T;
  label: ReactNode;
  disabled?: boolean;
  title?: string;
};

function AppSelect<T extends string>({
  value,
  options,
  onChange,
  disabled = false,
  className = "",
  title = "",
  ariaLabel,
}: {
  value: T;
  options: AppSelectOption<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
  className?: string;
  title?: string;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value) || options[0];
  const selectOption = (option: AppSelectOption<T>) => {
    if (option.disabled) return;
    onChange(option.value);
    setOpen(false);
  };
  const { rootRef, menuRef, menuStyle } = usePopoverLayer({
    open: open && !disabled,
    onOpenChange: setOpen,
    minWidth: 180,
    maxHeight: 260,
  });
  return (
    <div
      className={`app-select ${open ? "open" : ""} ${disabled ? "disabled" : ""} ${className}`.trim()}
      ref={rootRef}
    >
      <button
        aria-expanded={open}
        aria-label={ariaLabel}
        className="app-select-trigger"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        title={title}
        type="button"
      >
        <span>{selected?.label ?? value}</span>
        <ChevronDown className="h-4 w-4" />
      </button>
      {open && !disabled ? createPortal(
        <div
          className={`app-select-menu app-select-menu-portal ${className}`.trim()}
          ref={menuRef}
          role="listbox"
          style={menuStyle}
        >
          {options.map((option) => (
            <button
              aria-selected={option.value === value}
              className={`app-select-option ${option.value === value ? "selected" : ""}`}
              disabled={option.disabled}
              key={option.value}
              onClick={() => selectOption(option)}
              onMouseDown={(event) => {
                event.preventDefault();
                selectOption(option);
              }}
              title={option.title}
              type="button"
            >
              {option.value === value ? <CheckCircle2 className="h-4 w-4" /> : <span className="app-select-option-spacer" />}
              <span>{option.label}</span>
            </button>
          ))}
        </div>,
        document.body,
      ) : null}
    </div>
  );
}

const contextKindOptions: Array<{ kind: ContextKind; label: string; tableName: string }> = [
  { kind: "mcp", label: "MCP", tableName: "mcp_servers" },
  { kind: "skill", label: "Skills", tableName: "skills" },
  { kind: "plugin", label: t("插件"), tableName: "plugins" },
];

function contextEntriesFromSettings(settings: BackendSettings): CodexContextEntries {
  const commonConfig = normalizeDuplicateTomlTables(settings.relayContextConfigContents || "");
  return {
    mcpServers: parseContextEntries(commonConfig, "mcp", "mcp_servers"),
    skills: parseContextEntries(commonConfig, "skill", "skills"),
    plugins: parseContextEntries(commonConfig, "plugin", "plugins"),
  };
}

function contextEntriesFromConfig(configContents: string): CodexContextEntries {
  return {
    mcpServers: parseContextEntries(configContents, "mcp", "mcp_servers"),
    skills: parseContextEntries(configContents, "skill", "skills"),
    plugins: parseContextEntries(configContents, "plugin", "plugins"),
  };
}

function dedupeContextEntryList(entries: CodexContextEntry[]): CodexContextEntry[] {
  const byId = new Map<string, CodexContextEntry>();
  for (const entry of entries) {
    byId.set(entry.id, entry);
  }
  return Array.from(byId.values());
}

function parseContextEntries(commonConfig: string, kind: ContextKind, tableName: string): CodexContextEntry[] {
  const anyHeaderPattern = /^\s*\[[^\]]+\]\s*$/;
  const entries = new Map<string, CodexContextEntry>();
  let currentId: string | null = null;
  let body: string[] = [];

  const flush = () => {
    if (!currentId) return;
    const tomlBody = ensureTrailingNewline(body.join("\n").trimEnd());
    entries.set(currentId, {
      id: currentId,
      kind,
      title: currentId,
      summary: contextEntrySummary(tomlBody),
      tomlBody,
      enabled: contextEntryEnabled(tomlBody),
    });
  };

  for (const line of commonConfig.split(/\r?\n/)) {
    const path = tomlTablePathFromLine(line);
    if (path?.[0] === tableName && path.length >= 2) {
      const id = path[1];
      if (currentId === id && path.length > 2) {
        body.push(`[${path.slice(2).map(tomlKey).join(".")}]`);
        continue;
      }
      flush();
      currentId = id;
      body = [];
      continue;
    }
    if (currentId && anyHeaderPattern.test(line)) {
      flush();
      currentId = null;
      body = [];
      continue;
    }
    if (currentId) body.push(line);
  }
  flush();

  return Array.from(entries.values());
}

function tomlTablePathFromLine(line: string): string[] | null {
  const match = /^\s*\[([^\]]+)\]\s*$/.exec(line);
  if (!match) return null;
  return parseTomlDottedPath(match[1].trim());
}

function parseTomlDottedPath(path: string): string[] | null {
  const parts: string[] = [];
  let current = "";
  let quote: '"' | "'" | null = null;
  let escaping = false;

  for (const char of path) {
    if (quote) {
      if (quote === '"' && escaping) {
        current += char;
        escaping = false;
      } else if (quote === '"' && char === "\\") {
        escaping = true;
      } else if (char === quote) {
        quote = null;
      } else {
        current += char;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === ".") {
      if (!current.trim()) return null;
      parts.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }

  if (quote || escaping || !current.trim()) return null;
  parts.push(current.trim());
  return parts;
}

function contextEntrySummary(tomlBody: string) {
  return tomlBody
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith("#") && !/^enabled\s*=/.test(line))
    ?.slice(0, 96) ?? "";
}

function contextEntryEnabled(tomlBody: string) {
  return !tomlBody.split(/\r?\n/).some((line) => /^\s*enabled\s*=\s*false\s*(#.*)?$/i.test(line));
}

function ensureTrailingNewline(value: string) {
  return value.trim() ? `${value}\n` : "";
}

function contextEntriesByKind(entries: CodexContextEntries, kind: ContextKind): CodexContextEntry[] {
  if (kind === "mcp") return dedupeContextEntryList(entries.mcpServers);
  if (kind === "skill") return dedupeContextEntryList(entries.skills);
  return dedupeContextEntryList(entries.plugins);
}

function allContextConfigToml(entries: CodexContextEntries): string {
  const sections: string[] = [];
  for (const option of contextKindOptions) {
    for (const entry of dedupeContextEntryList(contextEntriesByKind(entries, option.kind))) {
      sections.push(contextEntryToTomlSection(option.tableName, entry));
    }
  }
  return ensureTrailingNewline(sections.join("\n\n"));
}

function contextEntryToTomlSection(tableName: string, entry: CodexContextEntry): string {
  const parentHeader = `[${tableName}.${tomlKey(entry.id)}]`;
  const body = entry.tomlBody
    .trimEnd()
    .split(/\r?\n/)
    .map((line) => relativeContextSubtableToAbsolute(line, tableName, entry.id))
    .join("\n");
  return `${parentHeader}\n${body}`;
}

function relativeContextSubtableToAbsolute(line: string, tableName: string, id: string): string {
  const match = /^\s*\[([^\]]+)\]\s*$/.exec(line);
  if (!match) return line;
  const subtable = match[1].trim();
  if (!subtable || subtable.includes(".")) return line;
  return `[${tableName}.${tomlKey(id)}.${tomlKey(subtable)}]`;
}

function splitContextConfigText(configContents: string): { common: string; context: string } {
  const entries = contextEntriesFromConfig(configContents);
  return {
    common: stripContextEntriesFromConfig(configContents, entries),
    context: allContextConfigToml(entries),
  };
}

function stripContextEntriesFromConfig(configContents: string, entries: CodexContextEntries): string {
  const knownIds: Record<ContextKind, Set<string>> = {
    mcp: new Set(entries.mcpServers.map((entry) => entry.id)),
    skill: new Set(entries.skills.map((entry) => entry.id)),
    plugin: new Set(entries.plugins.map((entry) => entry.id)),
  };
  const lines = configContents.split(/\r?\n/);
  const kept: string[] = [];
  let skipping = false;

  for (const line of lines) {
    const contextHeader = contextHeaderFromLine(line);
    if (contextHeader) {
      skipping = knownIds[contextHeader.kind].has(contextHeader.id);
    } else if (/^\s*\[[^\]]+\]\s*$/.test(line)) {
      skipping = false;
    }
    if (!skipping) kept.push(line);
  }

  return ensureTrailingNewline(kept.join("\n").trimEnd());
}

function tomlRootKeyFromLine(line: string): string | null {
  if (!line || line.startsWith("#")) return null;
  const index = line.indexOf("=");
  if (index < 0) return null;
  const key = line.slice(0, index).trim();
  return key || null;
}

function contextHeaderFromLine(line: string): { kind: ContextKind; id: string } | null {
  const path = tomlTablePathFromLine(line);
  if (!path || path.length !== 2) return null;
  const option = contextKindOptions.find((item) => item.tableName === path[0]);
  return option ? { kind: option.kind, id: path[1] } : null;
}

function removeRootTomlKey(contents: string, key: string): string {
  const lines: string[] = [];
  let inRoot = true;
  const sourceLines = contents.split(/\r?\n/);
  const structural = tomlStructureMask(sourceLines);
  for (const [index, line] of sourceLines.entries()) {
    if (structural[index] && tomlSectionName(line) !== null) inRoot = false;
    const assignment = tomlKeyAssignment(line);
    if (structural[index] && inRoot && assignment?.path.length === 1 && assignment.path[0] === key) continue;
    lines.push(line);
  }
  return ensureTrailingNewline(lines.join("\n").trimEnd());
}

function joinTomlSections(sections: string[]): string {
  return ensureTrailingNewline(
    sections
      .map((section) => section.trim())
      .filter(Boolean)
      .join("\n\n"),
  );
}

function joinTomlSectionsRootFirst(sections: string[]): string {
  const rootParts: string[] = [];
  const tableParts: string[] = [];

  for (const section of sections) {
    const { root, tables } = splitTomlRootAndTables(section);
    if (root.trim()) rootParts.push(root.trim());
    if (tables.trim()) tableParts.push(tables.trim());
  }

  return normalizeDuplicateTomlTables(joinTomlSections([...dedupeTomlRootLines(rootParts), ...tableParts]));
}

function normalizeDuplicateTomlTables(contents: string): string {
  const seenHeaders = new Set<string>();
  const kept: string[] = [];
  let skipping = false;

  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (/^\[[^\]]+\]$/.test(trimmed)) {
      skipping = seenHeaders.has(trimmed);
      seenHeaders.add(trimmed);
      if (skipping) continue;
    }
    if (!skipping) kept.push(line);
  }

  return ensureTrailingNewline(kept.join("\n").trimEnd());
}

function dedupeTomlRootLines(rootParts: string[]): string[] {
  const rootLines = rootParts
    .join("\n")
    .split(/\r?\n/)
    .map((line) => line.trimEnd());
  const rootSeen = new Set<string>();
  const kept: string[] = [];

  for (let index = rootLines.length - 1; index >= 0; index -= 1) {
    const line = rootLines[index];
    const key = tomlRootKeyFromLine(line.trim());
    if (key) {
      if (rootSeen.has(key)) continue;
      rootSeen.add(key);
    }
    kept.push(line);
  }

  const normalized = kept.reverse().join("\n").trim();
  return normalized ? [normalized] : [];
}

function splitTomlRootAndTables(section: string): { root: string; tables: string } {
  const lines = section.trim().split(/\r?\n/);
  const structural = tomlStructureMask(lines);
  const firstTable = lines.findIndex((line, index) => structural[index] && tomlSectionName(line) !== null);
  if (firstTable < 0) return { root: lines.join("\n"), tables: "" };
  return {
    root: lines.slice(0, firstTable).join("\n"),
    tables: lines.slice(firstTable).join("\n"),
  };
}

function tomlKey(key: string): string {
  return /^[A-Za-z0-9_-]+$/.test(key) ? key : `"${tomlString(key)}"`;
}

function contextSelectionForAllEntries(settings: BackendSettings): RelayContextSelection {
  const entries = contextEntriesFromSettings(settings);
  return {
    mcpServers: entries.mcpServers.map((entry) => entry.id),
    skills: entries.skills.map((entry) => entry.id),
    plugins: entries.plugins.map((entry) => entry.id),
  };
}

function normalizeTypingEffect(value: unknown): TypingEffect {
  return value === "rainbow" || value === "fireworks" || value === "stars" ? value : "off";
}

function normalizeSettings(settings: BackendSettings): BackendSettings {
  const backendAggregates = new Map(
    (settings.aggregateRelayProfiles ?? []).map((aggregate) => [aggregate.id, aggregate] as const),
  );
  const splitCommon = splitContextConfigText(settings.relayCommonConfigContents || "");
  const relayCommonConfigContents = splitCommon.common;
  const relayContextConfigContents = joinTomlSectionsRootFirst([
    settings.relayContextConfigContents || "",
    splitCommon.context,
  ]);
  const defaultContextSelection = contextSelectionForAllEntries({
    ...settings,
    relayCommonConfigContents,
    relayContextConfigContents,
  });
  const profiles =
    settings.relayProfiles?.length
      ? settings.relayProfiles.map((profile) =>
          normalizeRelayProfile(hydrateAggregateRelayProfile(profile, backendAggregates.get(profile.id)), defaultContextSelection),
        )
      : [
          {
            id: settings.activeRelayId || "default",
            name: t("默认中转"),
            model: "",
            baseUrl: settings.relayBaseUrl || defaultSettings.relayBaseUrl,
            upstreamBaseUrl: settings.relayBaseUrl || defaultSettings.relayBaseUrl,
            apiKey: settings.relayApiKey || "",
            protocol: "responses" as RelayProtocol,
            relayMode: "official" as RelayMode,
            sessionProvider: "custom" as RelaySessionProvider,
            officialMixApiKey: false,
            hideOfficialUsageAlert: false,
            testModel: "",
            configContents: "",
            authContents: "",
            useCommonConfig: true,
            contextSelection: defaultContextSelection,
            contextSelectionInitialized: true,
            contextWindow: "",
            autoCompactLimit: "",
            modelList: "",
            modelWindows: "",
            modelAutoCompact: "",
            modelMetadata: "",
            modelVlm: "",
            vlmApiKey: "",
            vlmModel: "",
            vlmBaseUrl: "",
            userAgent: "",
            customHeaders: [],
            sub2apiEnabled: false,
            noAuth: false,
            sub2apiMultiplier: "",
            standardOpenaiProtocol: false,
            webSearchHistoryCompat: false,
          },
        ];
  const activeRelayId = profiles.some((profile) => profile.id === settings.activeRelayId)
    ? settings.activeRelayId
    : profiles[0]?.id || "default";
  return syncLegacyRelayFields({
    ...defaultSettings,
    ...settings,
    ...normalizeWhaleBalanceSettings(settings),
    ccsDbPath: (settings.ccsDbPath || "").trim(),
    dictation: normalizeDictationSettings(settings.dictation),
    codexAppTypingEffect: normalizeTypingEffect(settings.codexAppTypingEffect),
    relayProfilesEnabled: settings.relayProfilesEnabled !== false,
    codexAppImageOverlayOpacity: clampNumber(settings.codexAppImageOverlayOpacity || 35, 1, 100),
    codexAppImageOverlayFitMode: normalizeImageOverlayFitMode(settings.codexAppImageOverlayFitMode),
    codexAppDreamSkinPaused: settings.codexAppDreamSkinPaused === true,
    codexAppDreamSkinThemeConfig: normalizeDreamSkinTheme(settings.codexAppDreamSkinThemeConfig),
    codexAppDreamSkinImagePath: (settings.codexAppDreamSkinImagePath || "").trim(),
    codexAppStepwiseProtocol: normalizeStepwiseProtocol(settings.codexAppStepwiseProtocol),
    codexAppStepwiseGenerationMode: normalizeStepwiseGenerationMode(settings.codexAppStepwiseGenerationMode),
    codexAppStepwiseMaxItems: clampNumber(settings.codexAppStepwiseMaxItems ?? 4, 0, 6),
    codexAppStepwiseMaxInputChars: clampNumber(settings.codexAppStepwiseMaxInputChars || 6000, 1000, 24000),
    codexAppStepwiseMaxOutputTokens: clampNumber(settings.codexAppStepwiseMaxOutputTokens || 500, 100, 4000),
    codexAppStepwiseTimeoutMs: clampNumber(settings.codexAppStepwiseTimeoutMs || 8000, 1000, 60000),
    relayCommonConfigContents,
    relayContextConfigContents,
    relayProfiles: profiles,
    activeRelayId,
  });
}

function dictationSettingsValidationMessage(issue: DictationSettingsIssue | null): string | null {
  if (issue === "baseUrl") return t("语音 Base URL 必须是 HTTP(S) 基础地址，不能包含账号密码、查询参数或片段。");
  if (issue === "model") return t("启用语音输入时需要填写语音模型。");
  if (issue === "apiKeyEnv") return t("语音 API Key 环境变量名称只能包含字母、数字和下划线，且不能以数字开头。");
  return null;
}

function normalizeStepwiseProtocol(value: StepwiseProtocol | undefined): StepwiseProtocol {
  return value === "auto"
    || value === "responses"
    || value === "anthropic_messages"
    ? value
    : "chat_completions";
}

function backendSettingsEqual(left: BackendSettings, right: BackendSettings): boolean {
  return JSON.stringify(normalizeSettings(left)) === JSON.stringify(normalizeSettings(right));
}

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function normalizeStepwiseGenerationMode(value: StepwiseGenerationMode | undefined): StepwiseGenerationMode {
  return value === "manual" ? "manual" : "auto";
}

function normalizeImageOverlayFitMode(value: string | undefined): ImageOverlayFitMode {
  return value === "fill" || value === "fit" || value === "stretch" || value === "tile" || value === "center"
    ? value
    : "fit";
}

function normalizeRelayProfile(profile: RelayProfile, defaultContextSelection = emptyContextSelection()): RelayProfile {
  const legacyMixedApi = profile.relayMode === "mixedApi";
  if (profile.relayMode === "aggregate" || profile.aggregate) {
    return normalizeAggregateRelayProfile(
      {
        ...profile,
        model: profile.model || "",
        baseUrl: "",
        upstreamBaseUrl: "",
        apiKey: "",
        protocol: "responses",
        relayMode: "aggregate",
        sessionProvider: normalizeRelaySessionProvider(profile.sessionProvider),
        officialMixApiKey: false,
        hideOfficialUsageAlert: false,
        testModel: profile.testModel || "",
        configContents: "",
        authContents: "",
        useCommonConfig: profile.useCommonConfig !== false,
        contextSelection: profile.contextSelectionInitialized
          ? normalizeContextSelection(profile.contextSelection)
          : normalizeContextSelection(undefined, defaultContextSelection),
        contextSelectionInitialized: true,
        contextWindow: "",
        autoCompactLimit: "",
        modelList: "",
        modelWindows: "",
        modelAutoCompact: "",
        modelMetadata: "",
        modelRoutes: [],
        sub2apiEnabled: false,
        noAuth: false,
        sub2apiMultiplier: "",
        standardOpenaiProtocol: false,
        webSearchHistoryCompat: false,
      },
      null,
    );
  }
  const relayMode = normalizeRelayMode(profile.relayMode);
  const officialMixApiKey = profile.officialMixApiKey === true || legacyMixedApi;
  let normalized: RelayProfile = {
    ...profile,
    model: profile.model || "",
    baseUrl: profile.baseUrl || defaultSettings.relayBaseUrl,
    upstreamBaseUrl: profile.upstreamBaseUrl || profile.baseUrl || "",
    apiKey: profile.apiKey || "",
    protocol: normalizeRelayProtocol(profile.protocol),
    relayMode,
    sessionProvider: relaySessionProvider(profile),
    officialMixApiKey,
    hideOfficialUsageAlert: profile.hideOfficialUsageAlert === true,
    testModel: profile.testModel || "",
    configContents: profile.configContents || "",
    authContents: relayMode === "official" && !officialMixApiKey ? buildOfficialRelayAuthJson(profile.authContents || "") : profile.authContents || "",
    useCommonConfig: profile.useCommonConfig !== false,
    contextSelection: profile.contextSelectionInitialized
      ? normalizeContextSelection(profile.contextSelection)
      : normalizeContextSelection(undefined, defaultContextSelection),
    contextSelectionInitialized: true,
    contextWindow: profile.contextWindow || "",
    autoCompactLimit: profile.autoCompactLimit || "",
    modelList: profile.modelList || "",
    modelWindows: profile.modelWindows || "",
    modelAutoCompact: profile.modelAutoCompact || "",
    modelMetadata: profile.modelMetadata || "",
    modelRoutes: relayMode === "official" && !officialMixApiKey ? [] : normalizeRelayModelRoutes(profile.modelRoutes),
    userAgent: profile.userAgent || "",
    customHeaders: profile.customHeaders || [],
    sub2apiEnabled: profile.noAuth ? false : profile.sub2apiEnabled === true,
    sub2apiMultiplier: !profile.noAuth && profile.sub2apiEnabled === true ? profile.sub2apiMultiplier || "" : "",
    standardOpenaiProtocol: profile.standardOpenaiProtocol === true,
    webSearchHistoryCompat: profile.webSearchHistoryCompat === true,
    anthropicAuthHeader: normalizeAnthropicAuthHeader(profile.anthropicAuthHeader),
    anthropicMaxTokens: normalizeAnthropicMaxTokens(profile.anthropicMaxTokens),
    anthropicPromptCache: profile.anthropicPromptCache !== false,
    anthropicImpersonateClaudeCode: profile.anthropicImpersonateClaudeCode === true,
    anthropicThinkingMode: normalizeAnthropicThinkingMode(profile.anthropicThinkingMode),
  };
  const derived = relayProfileUsesLiveFiles(normalized) ? deriveRelayProfileFromFiles(normalized) : normalized;
  return derived.noAuth || (derived.relayMode === "official" && !derived.officialMixApiKey)
    ? derived : relayProfileWithNormalizedApiKeys(derived);
}

function hydrateAggregateRelayProfile(profile: RelayProfile, aggregate: AggregateRelayProfile | undefined): RelayProfile {
  if (!aggregate) return profile;
  return {
    ...profile,
    name: profile.name || aggregate.name,
    relayMode: "aggregate",
    sessionProvider: normalizeRelaySessionProvider(aggregate.sessionProvider),
    aggregate: {
      strategy: aggregate.strategy,
      modelAggregationEnabled: aggregate.modelAggregationEnabled === true,
      members: aggregate.members.map((member) => ({
        profileId: member.relayId,
        weight: clampAggregateWeight(member.weight),
      })),
      routes: normalizeAggregateRoutes(aggregate.routes ?? []),
      defaultRelayId: aggregate.defaultRelayId ?? "",
      syncDefaultMemberLogin: aggregate.syncDefaultMemberLogin === true,
    },
  };
}

function activeRelayProfile(settings: BackendSettings): RelayProfile {
  return (
    settings.relayProfiles.find((profile) => profile.id === settings.activeRelayId) ||
    settings.relayProfiles[0] ||
    defaultSettings.relayProfiles[0]
  );
}

/** 协议取值归一化：认不出的值一律回退 Responses，避免脏数据把上游写成直连。 */
function normalizeRelayProtocol(value: RelayProtocol | undefined): RelayProtocol {
  if (value === "chatCompletions" || value === "anthropicMessages") return value;
  return "responses";
}

/** Anthropic 认证字段：只允许 `x-api-key` 与 `authorization`，缺省用前者。 */
function normalizeAnthropicAuthHeader(value: string | undefined): string {
  const normalized = (value ?? "").trim().toLowerCase();
  if (normalized === "authorization" || normalized === "bearer") return "authorization";
  if (normalized === "x-api-key" || normalized === "x_api_key" || normalized === "api_key") return "x-api-key";
  return "";
}

/** 思考模式：只认四个取值，其余（含空串）按 auto。 */
function normalizeAnthropicThinkingMode(value: string | undefined): string {
  const normalized = (value ?? "").trim().toLowerCase();
  if (normalized === "adaptive" || normalized === "budget" || normalized === "off") {
    return normalized;
  }
  return "";
}

/** Anthropic 的 `max_tokens` 兜底值：空/非法按 0（用内置 8192），上限 200000。 */
function normalizeAnthropicMaxTokens(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return 0;
  return Math.min(200000, Math.round(value));
}

function normalizeRelayMode(mode: RelayMode | undefined): RelayMode {
  if (mode === "aggregate") return mode;
  if (mode === "pureApi") return mode;
  return "official";
}

function normalizeRelaySessionProvider(value: string | undefined): RelaySessionProvider {
  return value === "openai" ? "openai" : "custom";
}

function relaySessionProviderFromConfig(contents: string): RelaySessionProvider {
  return normalizeRelaySessionProvider(rootTomlStringValue(contents, "model_provider"));
}

function relaySessionProvider(profile: Pick<RelayProfile, "configContents" | "sessionProvider">): RelaySessionProvider {
  const fromConfig = relaySessionProviderFromConfig(profile.configContents);
  return fromConfig === "openai" || profile.sessionProvider === "openai" ? "openai" : "custom";
}

function normalizeContextSelection(
  selection?: Partial<RelayContextSelection>,
  fallback: RelayContextSelection = emptyContextSelection(),
): RelayContextSelection {
  if (!selection) {
    return {
      mcpServers: [...fallback.mcpServers],
      skills: [...fallback.skills],
      plugins: [...fallback.plugins],
    };
  }
  return {
    mcpServers: Array.isArray(selection?.mcpServers) ? selection.mcpServers.map(String) : [],
    skills: Array.isArray(selection?.skills) ? selection.skills.map(String) : [],
    plugins: Array.isArray(selection?.plugins) ? selection.plugins.map(String) : [],
  };
}

function buildOfficialRelayAuthJson(contents: string): string {
  const trimmed = contents.trim();
  if (!trimmed) return "";
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return "";
    delete parsed.OPENAI_API_KEY;
    return `${JSON.stringify(parsed, null, 2)}\n`;
  } catch {
    return "";
  }
}

function deriveRelayProfileFromFiles(profile: RelayProfile, editedFile?: "config" | "auth"): RelayProfile {
  if (isAggregateRelayProfile(profile)) {
    return normalizeAggregateRelayProfile(profile, null);
  }
  if (editedFile === "auth") {
    try {
      JSON.parse(profile.authContents || "{}");
    } catch {
      return profile;
    }
  }
  let configContents = profile.configContents || "";
  let authContents = profile.relayMode === "official" ? buildOfficialRelayAuthJson(profile.authContents || "") : profile.authContents || "";
  const configBaseUrl = codexBaseUrlFromConfig(configContents);
  const chatUpstreamBaseUrl = rootTomlStringValue(configContents, CHAT_UPSTREAM_BASE_URL_KEY);
  const isProxyConfig = configBaseUrl === PROTOCOL_PROXY_BASE_URL;
  const upstreamBaseUrl = profile.upstreamBaseUrl || chatUpstreamBaseUrl || (configBaseUrl && !isProxyConfig ? configBaseUrl : profile.baseUrl || "");
  const configApiKey = codexExperimentalBearerTokenFromConfig(configContents);
  const apiKey = editedFile === "config" ? configApiKey
    : editedFile === "auth" && profile.relayMode === "pureApi" ? codexApiKeyFromAuth(authContents)
    : profile.relayMode === "official"
    ? configApiKey || profile.apiKey || ""
    : codexApiKeyFromAuth(authContents) || configApiKey || "";
  if (profile.relayMode === "pureApi") {
    // 旧 false/缺省模板也需要显式 provider 认证；保留用户已有的 true/false。
    configContents = profile.noAuth
      ? removeCodexExperimentalBearerToken(configContents)
      : apiKey && configContents.trim()
        ? setCodexExperimentalBearerToken(configContents, apiKey, { requiresOpenAiAuth: false })
        : configContents;
    if (editedFile && !profile.noAuth) {
      if (editedFile === "config") authContents = setAuthOpenAiApiKey(authContents, apiKey);
      if (!apiKey) configContents = removeCodexExperimentalBearerToken(configContents);
    }
  }
  const configModel = codexModelFromConfig(configContents);
  // 如果用户输入了带后缀的模型名，优先保留在界面的「配置模型」字段中；
  // config.toml 里实际写的是剥离后缀的 slug（由 applyRelayProfilePatchToFiles 处理）。
  const model = /\[.+\]$/.test(profile.model.trim()) ? profile.model.trim() : configModel;
  const derived = {
    ...profile,
    model,
    sessionProvider: relaySessionProviderFromConfig(configContents),
    baseUrl: upstreamBaseUrl,
    upstreamBaseUrl,
    apiKey,
    contextWindow: codexTopLevelIntFromConfig(configContents, "model_context_window"),
    autoCompactLimit: codexTopLevelIntFromConfig(configContents, "model_auto_compact_token_limit"),
    configContents,
    authContents,
  };
  return editedFile ? relayProfileWithUpdatedApiKey(derived, apiKey) : derived;
}

function codexModelFromConfig(contents: string): string {
  const lines = contents.split(/\r?\n/);
  const structural = tomlStructureMask(lines);
  for (const [index, line] of lines.entries()) {
    if (!structural[index]) continue;
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    if (trimmed.startsWith("[")) break;
    const match = /^model\s*=\s*(["'])(.*)\1\s*$/.exec(trimmed);
    if (match) return match[2].replace(/\\(["'\\])/g, "$1");
  }
  return "";
}

function codexBaseUrlFromConfig(contents: string): string {
  return codexProviderStringFromConfig(contents, "base_url");
}

function codexExperimentalBearerTokenFromConfig(contents: string): string {
  return codexProviderStringFromConfig(contents, "experimental_bearer_token");
}

function codexProviderStringFromConfig(contents: string, key: string): string {
  const provider = rootTomlStringValue(contents, "model_provider");
  const targetSection = codexProviderSectionName(provider || "custom");
  const fallbackSection = provider === "openai" && rootTomlStringValue(contents, "openai_base_url") === PROTOCOL_PROXY_BASE_URL
    ? codexProviderSectionName("custom") : "";
  const lines = contents.split(/\r?\n/);
  const structural = tomlStructureMask(lines);
  let currentSection = "";
  let rootValue = "";
  let fallbackValue = "";

  for (const [index, line] of lines.entries()) {
    if (!structural[index]) continue;
    const section = tomlSectionName(line);
    if (section !== null) {
      currentSection = section;
      continue;
    }
    const value = tomlStringAssignmentValue(line, key);
    if (value === null) continue;
    if (currentSection === targetSection) return value;
    if (fallbackSection && currentSection === fallbackSection) fallbackValue = value;
    if (!provider && currentSection === "") rootValue = value;
  }

  // 不借用 inactive provider 的 Key；仅托管 OpenAI 会话允许回落 custom transport。
  return fallbackValue || rootValue;
}

function codexApiKeyFromAuth(contents: string): string {
  try {
    const parsed = JSON.parse(contents || "{}") as { OPENAI_API_KEY?: unknown };
    return typeof parsed.OPENAI_API_KEY === "string" ? parsed.OPENAI_API_KEY : "";
  } catch {
    return "";
  }
}

function codexTopLevelIntFromConfig(contents: string, key: string): string {
  const topLevel = splitTomlRootAndTables(contents).root;
  const pattern = new RegExp(`^\\s*${key}\\s*=\\s*(\\d+)\\s*(?:#.*)?$`);
  const lines = topLevel.split(/\r?\n/);
  const structural = tomlStructureMask(lines);
  for (const [index, line] of lines.entries()) {
    if (!structural[index]) continue;
    const match = pattern.exec(line);
    if (match) return match[1];
  }
  return "";
}

function rootTomlStringValue(contents: string, key: string): string {
  const topLevel = splitTomlRootAndTables(contents).root;
  const lines = topLevel.split(/\r?\n/);
  const structural = tomlStructureMask(lines);
  for (const [index, line] of lines.entries()) {
    if (!structural[index]) continue;
    const value = tomlStringAssignmentValue(line, key);
    if (value !== null) return value;
  }
  return "";
}

function tomlStructureMask(lines: string[]): boolean[] {
  // 提示词里的伪表头/赋值只是字符串正文，不能参与 provider 鉴权读写。
  let multiline: string | null = null;
  return lines.map((line) => {
    const structural = multiline === null;
    for (let index = 0; index < line.length; index += 1) {
      if (multiline !== null) {
        if (multiline === '"' && line[index] === "\\") {
          index += 1;
        } else if (line[index] === multiline) {
          let end = index;
          while (line[end] === multiline) end += 1;
          if (end - index >= 3) multiline = null;
          index = end - 1;
        }
      } else if (line[index] === "#") {
        break;
      } else if (line[index] === '"' || line[index] === "'") {
        if (line[index + 1] === line[index] && line[index + 2] === line[index]) {
          multiline = line[index];
          index += 2;
        } else {
          const quoted = tomlQuotedValue(line, index);
          if (!quoted) break;
          index = quoted.end - 1;
        }
      }
    }
    return structural;
  });
}

function tomlSectionName(line: string): string | null {
  const text = line.trim();
  if (!text.startsWith("[")) return null;
  const array = text.startsWith("[[");
  const start = array ? 2 : 1;
  for (let index = start; index < text.length; index += 1) {
    if (text[index] === '"' || text[index] === "'") {
      const quoted = tomlQuotedValue(text, index);
      if (!quoted) return null;
      index = quoted.end - 1;
    } else if (text[index] === "]") {
      const end = index + (array ? 2 : 1);
      if (array && text[index + 1] !== "]") return null;
      const rest = text.slice(end).trim();
      if (rest && !rest.startsWith("#")) return null;
      const path = tomlDottedKeyPath(text.slice(start, index));
      // 数组表也是前一个表的边界，但不能与同名普通表混为一谈。
      return path ? (array ? "[]" : "") + tomlKeyPathName(path) : null;
    }
  }
  return null;
}

function tomlQuotedValue(text: string, start: number): { value: string; end: number } | null {
  const quote = text[start];
  if (quote !== '"' && quote !== "'") return null;
  let value = "";
  for (let index = start + 1; index < text.length; index += 1) {
    const character = text[index];
    if (character === quote) return { value, end: index + 1 };
    if ((character.charCodeAt(0) < 32 && character !== "\t") || character.charCodeAt(0) === 127) return null;
    if (quote === '"' && character === "\\") {
      const escape = text[++index];
      const escapes: Record<string, string> = { '"': '"', "\\": "\\", b: "\b", t: "\t", n: "\n", f: "\f", r: "\r" };
      if (Object.prototype.hasOwnProperty.call(escapes, escape)) value += escapes[escape];
      else if (escape === "u" || escape === "U") {
        const length = escape === "u" ? 4 : 8;
        const digits = text.slice(index + 1, index + 1 + length);
        if (digits.length !== length || !/^[0-9a-f]+$/i.test(digits)) return null;
        const codepoint = Number.parseInt(digits, 16);
        if (codepoint > 0x10ffff || (codepoint >= 0xd800 && codepoint <= 0xdfff)) return null;
        value += String.fromCodePoint(codepoint);
        index += length;
      } else return null;
    } else value += character;
  }
  return null;
}

function tomlDottedKeyPath(text: string): string[] | null {
  const path: string[] = [];
  let index = 0;
  while (index < text.length) {
    while (text[index] === " " || text[index] === "\t") index += 1;
    if (text[index] === '"' || text[index] === "'") {
      const quoted = tomlQuotedValue(text, index);
      if (!quoted) return null;
      path.push(quoted.value);
      index = quoted.end;
    } else {
      const bare = /^[A-Za-z0-9_-]+/.exec(text.slice(index));
      if (!bare) return null;
      path.push(bare[0]);
      index += bare[0].length;
    }
    while (text[index] === " " || text[index] === "\t") index += 1;
    if (index === text.length) return path;
    if (text[index] !== ".") return null;
    index += 1;
  }
  return null;
}

function tomlKeyPathName(path: string[]): string {
  return path.map((part) => /^[A-Za-z0-9_-]+$/.test(part) ? part : JSON.stringify(part)).join(".");
}

function codexProviderSectionName(provider: string): string {
  return tomlKeyPathName(["model_providers", provider]);
}

function tomlKeyAssignment(line: string): { path: string[]; valueStart: number } | null {
  for (let index = 0; index < line.length; index += 1) {
    if (line[index] === '"' || line[index] === "'") {
      const quoted = tomlQuotedValue(line, index);
      if (!quoted) return null;
      index = quoted.end - 1;
    } else if (line[index] === "#") return null;
    else if (line[index] === "=") {
      const path = tomlDottedKeyPath(line.slice(0, index));
      return path ? { path, valueStart: index + 1 } : null;
    }
  }
  return null;
}

function tomlInlineComment(line: string, start: number): string {
  for (let index = start; index < line.length; index += 1) {
    if (line[index] === '"' || line[index] === "'") {
      const quoted = tomlQuotedValue(line, index);
      if (!quoted) return "";
      index = quoted.end - 1;
    } else if (line[index] === "#") {
      const spacing = /[ \t]*$/.exec(line.slice(start, index))?.[0] || "";
      return spacing + line.slice(index);
    }
  }
  return "";
}

function tomlStringAssignmentValue(line: string, key: string): string | null {
  const assignment = tomlKeyAssignment(line);
  if (!assignment || assignment.path.length !== 1 || assignment.path[0] !== key) return null;
  const text = line.slice(assignment.valueStart).trimStart();
  const quoted = tomlQuotedValue(text, 0);
  if (!quoted) return null;
  const rest = text.slice(quoted.end).trimStart();
  return !rest || rest.startsWith("#") ? quoted.value : null;
}

function setAuthOpenAiApiKey(contents: string, apiKey: string): string {
  let parsed: Record<string, unknown> = {};
  try {
    const value = JSON.parse(contents || "{}");
    if (value && typeof value === "object" && !Array.isArray(value)) parsed = value as Record<string, unknown>;
  } catch {
    parsed = {};
  }
  parsed.OPENAI_API_KEY = apiKey.trim();
  return `${JSON.stringify(parsed, null, 2)}\n`;
}

function setRootTomlStringKey(contents: string, key: string, value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return removeRootTomlKey(contents, key);
  return setRootTomlLine(contents, key, `${key} = "${tomlString(trimmed)}"`);
}

function setRootTomlLine(contents: string, key: string, lineText: string): string {
  const lines = contents.split(/\r?\n/);
  const structural = tomlStructureMask(lines);
  const firstTable = lines.findIndex((line, index) => structural[index] && tomlSectionName(line) !== null);
  const rootEnd = firstTable >= 0 ? firstTable : lines.length;
  for (let index = 0; index < rootEnd; index += 1) {
    if (!structural[index]) continue;
    const assignment = tomlKeyAssignment(lines[index]);
    if (assignment?.path.length === 1 && assignment.path[0] === key) {
      const replacement = tomlKeyAssignment(lineText);
      lines[index] = replacement
        ? lines[index].slice(0, assignment.valueStart) + " " + lineText.slice(replacement.valueStart).trimStart() + tomlInlineComment(lines[index], assignment.valueStart)
        : lineText;
      return ensureTrailingNewline(lines.join("\n").trimEnd());
    }
  }
  const insertAt = key === "model" ? 0 : rootEnd;
  lines.splice(insertAt, 0, lineText);
  return ensureTrailingNewline(lines.join("\n").trimEnd());
}

function setCodexProviderStringKey(
  contents: string,
  key: string,
  value: string,
  options: { requiresOpenAiAuth?: boolean } = {},
): string {
  const sessionProvider = rootTomlStringValue(contents, "model_provider") || "custom";
  const provider = sessionProvider === "openai" ? "custom" : sessionProvider;
  let next = contents;
  if (!rootTomlStringValue(next, "model_provider")) {
    next = setRootTomlStringKey(next, "model_provider", sessionProvider);
  }
  next = ensureCodexProviderDefaults(next, provider, { requiresOpenAiAuth: options.requiresOpenAiAuth !== false });
  return setTomlSectionStringKey(next, codexProviderSectionName(provider), key, value);
}

function setCodexExperimentalBearerToken(contents: string, apiKey: string, options: { requiresOpenAiAuth?: boolean } = {}): string {
  const trimmed = apiKey.trim();
  if (trimmed && options.requiresOpenAiAuth === false) {
    // 补纯 API 鉴权时只改目标字段，不覆盖导入模板的名称、协议或登录要求。
    const sessionProvider = rootTomlStringValue(contents, "model_provider") || "custom";
    const provider = sessionProvider === "openai" ? "custom" : sessionProvider;
    const next = rootTomlStringValue(contents, "model_provider")
      ? contents
      : setRootTomlStringKey(contents, "model_provider", sessionProvider);
    return setTomlSectionStringKey(next, codexProviderSectionName(provider), "experimental_bearer_token", trimmed);
  }
  return trimmed
    ? setCodexProviderStringKey(contents, "experimental_bearer_token", trimmed, options)
    : removeCodexExperimentalBearerToken(contents);
}

function removeCodexExperimentalBearerToken(contents: string): string {
  const sessionProvider = rootTomlStringValue(contents, "model_provider") || "custom";
  const provider = sessionProvider === "openai" ? "custom" : sessionProvider;
  return removeTomlSectionKey(contents, codexProviderSectionName(provider), "experimental_bearer_token");
}

function ensureCodexProviderDefaults(
  contents: string,
  provider: string,
  options: { requiresOpenAiAuth?: boolean } = {},
): string {
  let next = contents;
  const section = codexProviderSectionName(provider);
  next = setTomlSectionStringKey(next, section, "name", provider);
  next = setTomlSectionStringKey(next, section, "wire_api", "responses");
  return options.requiresOpenAiAuth === false ? next : setTomlSectionBoolKey(next, section, "requires_openai_auth", true);
}

function setTomlSectionBoolKey(contents: string, sectionName: string, key: string, value: boolean): string {
  return setTomlSectionRawKey(contents, sectionName, key, value ? "true" : "false");
}

function setTomlSectionStringKey(contents: string, sectionName: string, key: string, value: string): string {
  return setTomlSectionRawKey(contents, sectionName, key, `"${tomlString(value.trim())}"`);
}

function setTomlSectionRawKey(contents: string, sectionName: string, key: string, value: string): string {
  const lines = contents.split(/\r?\n/);
  const structural = tomlStructureMask(lines);
  let sectionStart = -1;
  let sectionEnd = lines.length;
  for (let index = 0; index < lines.length; index += 1) {
    if (!structural[index]) continue;
    const section = tomlSectionName(lines[index]);
    if (section === null) continue;
    if (sectionStart >= 0) {
      sectionEnd = index;
      break;
    }
    if (section === sectionName) sectionStart = index;
  }
  if (sectionStart < 0) {
    const prefix = ensureTrailingNewline(lines.join("\n").trimEnd()).trimEnd();
    return joinTomlSections([prefix, `[${sectionName}]\n${key} = ${value}`]);
  }
  const replacement = `${key} = ${value}`;
  for (let index = sectionStart + 1; index < sectionEnd; index += 1) {
    if (!structural[index]) continue;
    const assignment = tomlKeyAssignment(lines[index]);
    if (assignment?.path.length === 1 && assignment.path[0] === key) {
      lines[index] = lines[index].slice(0, assignment.valueStart) + " " + value + tomlInlineComment(lines[index], assignment.valueStart);
      return ensureTrailingNewline(lines.join("\n").trimEnd());
    }
  }
  let insertAt = sectionEnd;
  while (insertAt > sectionStart + 1 && lines[insertAt - 1].trim() === "") insertAt -= 1;
  lines.splice(insertAt, 0, replacement);
  return ensureTrailingNewline(lines.join("\n").trimEnd());
}

function removeTomlSectionKey(contents: string, sectionName: string, key: string): string {
  const lines = contents.split(/\r?\n/);
  const structural = tomlStructureMask(lines);
  let sectionStart = -1;
  let sectionEnd = lines.length;
  for (let index = 0; index < lines.length; index += 1) {
    if (!structural[index]) continue;
    const section = tomlSectionName(lines[index]);
    if (section === null) continue;
    if (sectionStart >= 0) {
      sectionEnd = index;
      break;
    }
    if (section === sectionName) sectionStart = index;
  }
  if (sectionStart < 0) return contents;
  const next = lines.filter((line, index) => {
    if (index <= sectionStart || index >= sectionEnd || !structural[index]) return true;
    const assignment = tomlKeyAssignment(line);
    return assignment?.path.length !== 1 || assignment.path[0] !== key;
  });
  return ensureTrailingNewline(next.join("\n").trimEnd());
}

function relayProfileUsesLiveFiles(profile: RelayProfile): boolean {
  return profile.relayMode !== "official" || profile.officialMixApiKey || !!profile.configContents.trim();
}

function tomlString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function syncLegacyRelayFields(settings: BackendSettings): BackendSettings {
  // 先规范化非聚合供应商：聚合成员的"存在性"要用**规范化后仍然在列表里**的那些 id，
  // 否则同一批 profile 里排在聚合后面的成员会被当成不存在而丢掉（顺序相关的老问题）。
  const nonAggregate = settings.relayProfiles
    .filter((profile) => !isAggregateRelayProfile(profile))
    .map((profile) => deriveRelayProfileFromFiles(profile));
  const relayProfiles = settings.relayProfiles.map((profile) =>
    isAggregateRelayProfile(profile)
      ? normalizeAggregateRelayProfile(profile, { ...settings, relayProfiles: [...nonAggregate, ...settings.relayProfiles.filter(isAggregateRelayProfile)] })
      : deriveRelayProfileFromFiles(profile),
  );
  const active = activeRelayProfile({ ...settings, relayProfiles });
  const aggregateRelayProfiles = normalizeAggregateProfilesFromRelayProfiles(relayProfiles);
  const activeAggregateRelayId = isAggregateRelayProfile(active) ? active.id : "";
  return {
    ...settings,
    relayProfiles,
    activeRelayId: active.id,
    relayBaseUrl: isAggregateRelayProfile(active) ? PROTOCOL_PROXY_BASE_URL : active.baseUrl,
    relayApiKey: active.apiKey,
    aggregateRelayProfiles,
    activeAggregateRelayId,
  };
}

function normalizeAggregateProfilesFromRelayProfiles(profiles: RelayProfile[]): AggregateRelayProfile[] {
  const candidates = profiles.filter((profile) => !isAggregateRelayProfile(profile));
  return profiles.filter(isAggregateRelayProfile).map((profile) => {
    const aggregate = normalizeAggregateConfig(profile.aggregate, candidates);
    const memberIds = new Set(aggregate.members.map((member) => member.profileId));
    return {
      id: profile.id,
      name: profile.name || t("聚合供应商"),
      sessionProvider: normalizeRelaySessionProvider(profile.sessionProvider),
      modelAggregationEnabled: aggregate.modelAggregationEnabled === true,
      strategy: aggregate.strategy,
      members: aggregate.members.map((member) => ({
        relayId: member.profileId,
        weight: clampAggregateWeight(member.weight),
      })),
      routes: normalizeAggregateRoutes(aggregate.routes ?? [], { dropEmptyPattern: true, memberIds }).map((route) => ({
        pattern: route.pattern,
        relayId: route.profileId,
        priority: route.priority,
      })),
      defaultRelayId: aggregate.defaultRelayId ?? "",
      syncDefaultMemberLogin: aggregate.syncDefaultMemberLogin === true,
    };
  });
}

const aggregateStrategyOptions: Array<{ value: RelayAggregateStrategy; label: string; description: string }> = [
  {
    value: "failover",
    label: t("失败切换"),
    description: t("按成员顺序请求，失败后切到下一个供应商。"),
  },
  {
    value: "conversationRoundRobin",
    label: t("按对话轮转"),
    description: t("同一对话保持一个成员，不同对话依次分配。"),
  },
  {
    value: "requestRoundRobin",
    label: t("按请求轮转"),
    description: t("每次请求按成员顺序切换，适合均匀摊请求量。"),
  },
  {
    value: "weightedRoundRobin",
    label: t("权重轮转"),
    description: t("按成员权重分配请求，权重越高承担越多。"),
  },
];

function isAggregateRelayProfile(profile: Pick<RelayProfile, "relayMode" | "aggregate">): boolean {
  return isAggregateProfile(profile);
}

function normalizeAggregateRelayProfile(profile: RelayProfile, settings: BackendSettings | null): RelayProfile {
  const candidates = settings ? aggregateMemberCandidates(settings.relayProfiles, profile.id) : [];
  // 传"全部供应商 id"而不是候选：成员的存在性判定不能受"当前是否就绪"影响。
  const existingProfileIds = settings ? new Set(settings.relayProfiles.map((item) => item.id)) : null;
  const aggregate = normalizeAggregateConfig(profile.aggregate, candidates, existingProfileIds);
  return {
    ...profile,
    baseUrl: "",
    upstreamBaseUrl: "",
    apiKey: "",
    protocol: "responses",
    relayMode: "aggregate",
    sessionProvider: normalizeRelaySessionProvider(profile.sessionProvider),
    officialMixApiKey: false,
    hideOfficialUsageAlert: false,
    configContents: "",
    authContents: "",
    sub2apiEnabled: false,
    noAuth: false,
    sub2apiMultiplier: "",
    standardOpenaiProtocol: false,
    webSearchHistoryCompat: false,
    aggregate,
  };
}

function normalizeAggregateConfig(
  aggregate: RelayAggregateConfig | null | undefined,
  candidates: RelayProfile[],
  /**
   * 当前快照里**全部**供应商 id（不只是可勾选候选）。传了才判定成员的存在性；不传
   * （分页子集、拿不到完整快照）则一律保留成员——宁可留着让用户自己取消勾选，
   * 也不能替用户删配置。
   */
  existingProfileIds: ReadonlySet<string> | null = null,
): RelayAggregateConfig {
  const candidateIds = new Set(candidates.map((profile) => profile.id));
  const seen = new Set<string>();
  const strategy: RelayAggregateStrategy =
    aggregate?.strategy && aggregateStrategyOptions.some((option) => option.value === aggregate.strategy)
      ? aggregate.strategy
      : "failover";
  const modelAggregationEnabled = aggregate?.modelAggregationEnabled === true;
  // 成员去留只看"这家供应商还在不在"：候选集合只决定 UI 能勾选什么，不能用来删掉
  // 已经在聚合里的成员（供应商编辑中缺 Key 时判定会翻转，见 normalizeAggregateMembers）。
  const members = normalizeAggregateMembers(aggregate?.members ?? [], existingProfileIds)
    .map((member) => {
      seen.add(member.profileId);
      return { profileId: member.profileId, weight: modelAggregationEnabled ? 1 : clampAggregateWeight(member.weight) };
    });
  // 路由目标同样只按"供应商还在不在"去留：路由早就配好了，目标一时不就绪（或同一批
  // settings 里排在聚合后面）不代表用户想删掉这条路由。
  const routes = modelAggregationEnabled ? [] : (aggregate?.routes ?? [])
    .filter((route) => route.pattern.trim() !== "" || route.profileId.trim() !== "")
    .filter((route) => !existingProfileIds || !route.profileId.trim() || existingProfileIds.has(route.profileId.trim()))
    .map((route) => ({
      pattern: route.pattern.trim(),
      profileId: route.profileId,
      priority: clampAggregateRoutePriority(route.priority),
    }));
  // 默认供应商必须是当前成员；成员被移出（或值不再合法）时自动清空为「未设置」。
  const defaultRelayId = normalizeAggregateDefaultRelayId(
    aggregate?.defaultRelayId,
    new Set(members.map((member) => member.profileId)),
  );
  return {
    strategy: modelAggregationEnabled ? "failover" : strategy,
    modelAggregationEnabled,
    members,
    routes,
    defaultRelayId,
    syncDefaultMemberLogin: aggregate?.syncDefaultMemberLogin === true,
  };
}

function clampAggregateWeight(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.min(999, Math.round(value)));
}

type EnhancementActions = { saveSettings: () => Promise<void>; saveSettingsValue: (settings: BackendSettings, silent?: boolean) => Promise<BackendSettings | null>; testStepwiseSettings: (settings: BackendSettings) => Promise<void>; };

export { EnhanceScreen, defaultSettings, normalizeSettings, backendSettingsEqual, whaleBalanceValidationMessage, dictationSettingsValidationMessage };

export type { BackendSettings, SettingsResult, OverviewResult, LaunchCommandResult, StepwiseTestResult, EnhancementActions };
