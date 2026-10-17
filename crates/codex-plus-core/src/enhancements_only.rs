//! 精简版的运行边界。保留旧配置数据，但不启用已移除的业务。
use crate::settings::BackendSettings;

pub fn runtime_settings(mut settings: BackendSettings) -> BackendSettings {
    settings.provider_sync_enabled = false;
    settings.relay_profiles_enabled = false;
    settings.weixin_connect_enabled = false;
    settings.codex_app_dream_skin_enabled = false;
    settings.codex_app_image_overlay_enabled = false;
    settings.active_tool = crate::tools::ToolId::Codex;
    settings
}

/// 只接受增强与启动设置；旧供应商、认证快照等数据从磁盘保留。
pub fn merge_settings(
    mut previous: BackendSettings,
    incoming: BackendSettings,
) -> anyhow::Result<BackendSettings> {
    // 逐字段更新，避免 serde 的 skip_serializing 丢失旧供应商的运行凭据。
    previous.dictation = incoming.dictation;
    previous.codex_app_path = incoming.codex_app_path;
    previous.codex_app_auto_takeover = incoming.codex_app_auto_takeover;
    previous.codex_app_auto_takeover_when_active = incoming.codex_app_auto_takeover_when_active;
    previous.codex_extra_args = incoming.codex_extra_args;
    previous.enhancements_enabled = incoming.enhancements_enabled;
    previous.codex_app_standalone_quota_unlock = incoming.codex_app_standalone_quota_unlock;
    previous.codex_app_plugin_marketplace_unlock = incoming.codex_app_plugin_marketplace_unlock;
    previous.codex_app_model_whitelist_unlock = incoming.codex_app_model_whitelist_unlock;
    previous.codex_app_session_delete = incoming.codex_app_session_delete;
    previous.codex_app_markdown_export = incoming.codex_app_markdown_export;
    previous.codex_app_session_share = incoming.codex_app_session_share;
    previous.codex_app_usage_status_line = incoming.codex_app_usage_status_line;
    previous.codex_app_paste_fix = incoming.codex_app_paste_fix;
    previous.codex_app_force_chinese_locale = incoming.codex_app_force_chinese_locale;
    previous.codex_app_typing_effect = incoming.codex_app_typing_effect;
    previous.codex_app_thread_id_badge = incoming.codex_app_thread_id_badge;
    previous.codex_app_conversation_view = incoming.codex_app_conversation_view;
    previous.codex_app_thread_scroll_restore = incoming.codex_app_thread_scroll_restore;
    previous.codex_app_native_menu_placement = incoming.codex_app_native_menu_placement;
    previous.codex_app_native_browser_require_identification =
        incoming.codex_app_native_browser_require_identification;
    previous.codex_app_service_tier_controls = incoming.codex_app_service_tier_controls;
    previous.codex_app_pet_real_mouse_look = incoming.codex_app_pet_real_mouse_look;
    previous.codex_app_activity_overlay_right = incoming.codex_app_activity_overlay_right;
    previous.codex_app_capacity_auto_retry = incoming.codex_app_capacity_auto_retry;
    previous.codex_app_whale_widget_enabled = incoming.codex_app_whale_widget_enabled;
    previous.codex_app_whale_balance_protocol = incoming.codex_app_whale_balance_protocol;
    previous.codex_app_whale_balance_path = incoming.codex_app_whale_balance_path;
    previous.codex_app_whale_balance_field = incoming.codex_app_whale_balance_field;
    previous.codex_app_whale_balance_currency = incoming.codex_app_whale_balance_currency;
    previous.codex_app_whale_balance_scale = incoming.codex_app_whale_balance_scale;
    previous.codex_app_stepwise_enabled = incoming.codex_app_stepwise_enabled;
    previous.codex_app_stepwise_generation_mode = incoming.codex_app_stepwise_generation_mode;
    previous.codex_app_answer_outline_enabled = incoming.codex_app_answer_outline_enabled;
    previous.codex_app_stepwise_direct_send = incoming.codex_app_stepwise_direct_send;
    previous.codex_app_stepwise_base_url = incoming.codex_app_stepwise_base_url;
    previous.codex_app_stepwise_api_key = incoming.codex_app_stepwise_api_key;
    previous.codex_app_stepwise_api_key_env = incoming.codex_app_stepwise_api_key_env;
    previous.codex_app_stepwise_protocol = incoming.codex_app_stepwise_protocol;
    previous.codex_app_stepwise_model = incoming.codex_app_stepwise_model;
    previous.codex_app_stepwise_max_items = incoming.codex_app_stepwise_max_items;
    previous.codex_app_stepwise_max_input_chars = incoming.codex_app_stepwise_max_input_chars;
    previous.codex_app_stepwise_max_output_tokens = incoming.codex_app_stepwise_max_output_tokens;
    previous.codex_app_stepwise_timeout_ms = incoming.codex_app_stepwise_timeout_ms;
    Ok(runtime_settings(previous))
}

pub fn setting_enabled(key: &str) -> bool {
    key == "enhancementsEnabled"
        || key == "dictation"
        || key == "codexExtraArgs"
        || key.starts_with("codexApp")
            && !key.starts_with("codexAppDreamSkin")
            && !key.starts_with("codexAppImageOverlay")
}

pub fn bridge_route_enabled(path: &str) -> bool {
    !path.starts_with("/user-scripts/")
        && !path.starts_with("/script-market/")
        && !matches!(
            path,
            "/ads"
                | "/plugin-market/list"
                | "/plugin-market/install"
                | "/plugin-market/install-status"
        )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn old_configuration_cannot_reactivate_removed_services() {
        let mut settings = BackendSettings::default();
        settings.provider_sync_enabled = true;
        settings.relay_profiles_enabled = true;
        settings.weixin_connect_enabled = true;
        settings.codex_app_dream_skin_enabled = true;
        settings.codex_app_image_overlay_enabled = true;
        settings.codex_app_whale_widget_enabled = true;
        settings.codex_app_stepwise_enabled = true;
        let settings = runtime_settings(settings);
        assert!(
            !settings.provider_sync_enabled
                && !settings.relay_profiles_enabled
                && !settings.weixin_connect_enabled
        );
        assert!(
            !settings.codex_app_dream_skin_enabled && !settings.codex_app_image_overlay_enabled
        );
        assert!(settings.codex_app_whale_widget_enabled && settings.codex_app_stepwise_enabled);
    }

    #[test]
    fn removed_provider_profiles_do_not_start_a_protocol_proxy() {
        let mut settings = BackendSettings::default();
        settings.relay_profiles[0].relay_mode = crate::settings::RelayMode::Official;
        settings.relay_profiles[0].official_mix_api_key = true;
        let settings = runtime_settings(settings);
        assert_eq!(crate::launcher::required_fixed_helper_port(&settings), None);
    }

    #[test]
    fn saving_enhancements_preserves_provider_data() {
        let mut previous = BackendSettings::default();
        previous.relay_profiles[0].name = "Existing provider".into();
        previous.relay_profiles[0].api_key = "existing-test-key".into();
        let mut incoming = BackendSettings::default();
        incoming.relay_profiles[0].name = "Unwanted replacement".into();
        incoming.codex_app_whale_widget_enabled = true;
        let saved = merge_settings(previous, incoming).unwrap();
        assert_eq!(saved.relay_profiles[0].name, "Existing provider");
        assert_eq!(saved.relay_profiles[0].api_key, "existing-test-key");
        assert!(saved.codex_app_whale_widget_enabled);
        assert!(!saved.relay_profiles_enabled);
    }

    #[test]
    fn runtime_loading_does_not_rewrite_the_original_settings() {
        let temp = tempfile::tempdir().unwrap();
        let path = temp.path().join("settings.json");
        let store = crate::settings::SettingsStore::new(path.clone());
        let mut settings = BackendSettings::default();
        settings.provider_sync_enabled = true;
        settings.weixin_connect_enabled = true;
        store.save(&settings).unwrap();
        let before = std::fs::read(&path).unwrap();
        let loaded = store.load_for_enhancements().unwrap();
        assert!(!loaded.provider_sync_enabled && !loaded.weixin_connect_enabled);
        assert_eq!(before, std::fs::read(path).unwrap());
    }

    #[test]
    fn native_enhancements_keep_their_backend_routes() {
        for path in [
            "/settings/get",
            "/settings/set",
            "/delete",
            "/undo",
            "/export-markdown",
            "/dictation/transcribe",
            "/stepwise/generate",
            "/plugin-market/native",
            "/whale/history",
        ] {
            assert!(bridge_route_enabled(path), "{path}");
        }
        for path in [
            "/ads",
            "/user-scripts/load",
            "/script-market/install",
            "/plugin-market/install",
        ] {
            assert!(!bridge_route_enabled(path), "{path}");
        }
    }
}
