//! In-app updates and "Start at login".
//!
//! Updates come from GitHub Releases. Each one is signed with Hushboard's update key (separate
//! from Apple and Microsoft code signing) and the app refuses anything the key didn't sign. The
//! feed is `latest.json` on the rolling `updater` release, which the release workflow refreshes
//! when a release is published (see docs/releasing.md).
//!
//! The app checks shortly after launch and every 6 hours, never during a lock, and tells the
//! panel with an `update-available` event. Installing restarts the app.

use crate::{AppState, Phase};
use serde::Serialize;
use std::sync::Mutex;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_autostart::ManagerExt;
use tauri_plugin_updater::{Update, UpdaterExt};

const FIRST_CHECK_AFTER: Duration = Duration::from_secs(20);
const CHECK_EVERY: Duration = Duration::from_secs(6 * 60 * 60);

/// The update found by the last check, ready to install.
static PENDING: Mutex<Option<Update>> = Mutex::new(None);

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct UpdateInfo {
    version: String,
    current_version: String,
    notes: Option<String>,
}

fn idle(app: &AppHandle) -> bool {
    app.state::<AppState>().0.lock().unwrap().phase == Phase::Idle
}

async fn check(app: &AppHandle) -> Result<Option<UpdateInfo>, String> {
    let found = app.updater().map_err(|e| e.to_string())?.check().await.map_err(|e| e.to_string())?;
    let info = found.as_ref().map(|u| UpdateInfo {
        version: u.version.clone(),
        current_version: u.current_version.clone(),
        notes: u.body.clone(),
    });
    *PENDING.lock().unwrap() = found;
    if let Some(info) = &info {
        let _ = app.emit("update-available", info.clone());
    }
    Ok(info)
}

/// Background checks: shortly after launch, then every 6 hours, skipped while locked.
pub fn spawn_checker(app: AppHandle) {
    if cfg!(debug_assertions) {
        return; // development builds don't update themselves
    }
    std::thread::Builder::new()
        .name("update-checker".into())
        .spawn(move || {
            std::thread::sleep(FIRST_CHECK_AFTER);
            loop {
                if idle(&app) {
                    if let Err(e) = tauri::async_runtime::block_on(check(&app)) {
                        eprintln!("update check failed: {e}");
                    }
                }
                std::thread::sleep(CHECK_EVERY);
            }
        })
        .expect("start the update checker");
}

/// Check now (the panel's "Check for updates").
#[tauri::command]
pub async fn check_for_update(app: AppHandle) -> Result<Option<UpdateInfo>, String> {
    check(&app).await
}

/// Download and install the update found by the last check, then restart.
#[tauri::command]
pub async fn install_update(app: AppHandle) -> Result<(), String> {
    if !idle(&app) {
        return Err("Unlock the keyboard before updating".into());
    }
    let update = PENDING.lock().unwrap().take().ok_or("No update is ready to install")?;
    update
        .download_and_install(|_, _| {}, || {})
        .await
        .map_err(|e| format!("Couldn't install the update: {e}"))?;
    app.restart();
}

/// Whether Hushboard starts at login.
#[tauri::command]
pub fn get_autostart(app: AppHandle) -> bool {
    app.autolaunch().is_enabled().unwrap_or(false)
}

#[tauri::command]
pub fn set_autostart(app: AppHandle, enabled: bool) -> Result<bool, String> {
    let launcher = app.autolaunch();
    let result = if enabled { launcher.enable() } else { launcher.disable() };
    result.map_err(|e| e.to_string())?;
    Ok(launcher.is_enabled().unwrap_or(enabled))
}

/// Launched by "Start at login": stay quietly in the menu bar or tray.
pub const AUTOSTART_ARG: &str = "--autostart";

pub fn launched_at_login() -> bool {
    std::env::args().any(|a| a == AUTOSTART_ARG)
}
