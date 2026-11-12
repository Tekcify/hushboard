//! Hushboard's app shell: the lock state machine and the commands the UI calls. Where it shows
//! up on each platform (tray, panel, island) is `shell.rs`; the keyboard itself is the
//! `keylock` crate.
//!
//! Phases: Idle → Arming (arm delay, cancellable) → Locked (until the timer, the hold-to-unlock
//! button or Ctrl + Alt + U) → Idle.

mod shell;
mod updates;

use serde::Serialize;
use shell::IslandState;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager, State, WebviewUrl, WebviewWindowBuilder};

/// Longest lock the UI may ask for. Matches the design system's 10-minute cap.
const MAX_LOCK: Duration = Duration::from_secs(10 * 60);
const TICK: Duration = Duration::from_millis(200);
/// The design system's `arm-delay` token, for locks started from the tray menu.
const ARM_DELAY_MS: u64 = 3000;
/// How long the island shows "Unlocked" before folding away.
const DONE_FOR: Duration = Duration::from_secs(2);

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub(crate) enum Phase {
    Idle,
    Arming,
    Locked,
}

/// What the main window last chose, so the tray menu can lock the same way.
#[derive(Clone, Default)]
struct Prefs {
    device_ids: Vec<String>,
    cover_screen: bool,
}

struct Inner {
    phase: Phase,
    /// Bumped on every transition so stale ticker threads stop.
    generation: u64,
    arm_until: Option<Instant>,
    locked_at: Option<Instant>,
    duration: Option<Duration>,
    device_ids: Vec<String>,
    /// This lock covers the screen (full-screen overlay) instead of showing the island.
    cover_screen: bool,
    /// Key presses dropped during this lock (count only; nothing typed is kept).
    keys_ignored: u64,
    lock: Option<keylock::Lock>,
    error: Option<String>,
    prefs: Prefs,
    /// Phase the tray icon last showed.
    tray_phase: Phase,
}

pub struct AppState(Mutex<Inner>);

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct StatePayload {
    /// "idle" | "arming" | "locked"
    phase: &'static str,
    arming_ms_left: Option<u64>,
    remaining_ms: Option<u64>,
    total_ms: Option<u64>,
    keys_ignored: u64,
    error: Option<String>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct KeyboardDto {
    id: String,
    name: String,
    kind: &'static str,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PermissionsDto {
    platform: &'static str,
    accessibility: &'static str,
    input_monitoring: &'static str,
    input_devices: &'static str,
    /// macOS keyboard helper: "not-needed" | "missing" | "needs-approval" | "outdated" | "ready".
    helper: &'static str,
    /// macOS: the app holding Secure Input while it blocks the no-helper fallback.
    secure_input_holder: Option<String>,
    all_granted: bool,
}

/// Everything the main window shows about the system. Sent as a `system-changed` event whenever
/// any of it changes.
#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SystemDto {
    permissions: PermissionsDto,
    keyboards: Vec<KeyboardDto>,
}

#[derive(Serialize, Clone)]
struct SwallowedPayload {
    label: String,
}

fn snapshot(inner: &Inner) -> StatePayload {
    let now = Instant::now();
    let ms = |d: Duration| d.as_millis() as u64;
    StatePayload {
        phase: match inner.phase {
            Phase::Idle => "idle",
            Phase::Arming => "arming",
            Phase::Locked => "locked",
        },
        arming_ms_left: inner.arm_until.map(|t| ms(t.saturating_duration_since(now))),
        remaining_ms: match (inner.locked_at, inner.duration) {
            (Some(at), Some(d)) => Some(ms(d.saturating_sub(now - at))),
            _ => None,
        },
        total_ms: inner.duration.map(ms),
        keys_ignored: inner.keys_ignored,
        error: inner.error.clone(),
    }
}

fn emit_state(app: &AppHandle, inner: &mut Inner) {
    let _ = app.emit("lock-state", snapshot(inner));
    if inner.tray_phase != inner.phase {
        inner.tray_phase = inner.phase;
        shell::set_tray_phase(app, inner.phase);
    }
}

fn open_overlays(app: &AppHandle) {
    let monitors = app.available_monitors().unwrap_or_default();
    for (i, m) in monitors.iter().enumerate() {
        let scale = m.scale_factor();
        let pos = m.position().to_logical::<f64>(scale);
        let size = m.size().to_logical::<f64>(scale);
        let built = WebviewWindowBuilder::new(app, format!("overlay-{i}"), WebviewUrl::App("overlay.html".into()))
            .title("Hushboard: keyboard locked")
            .position(pos.x, pos.y)
            .inner_size(size.width, size.height)
            .decorations(false)
            .resizable(false)
            .always_on_top(true)
            .skip_taskbar(true)
            .visible_on_all_workspaces(true)
            .focused(i == 0)
            .build();
        if let Err(e) = built {
            eprintln!("could not open overlay on monitor {i}: {e}");
        }
    }
}

fn close_overlays(app: &AppHandle) {
    for (label, w) in app.webview_windows() {
        if label.starts_with("overlay-") {
            let _ = w.close();
        }
    }
}

/// End a lock or an arming countdown. Safe to call from any thread except the keylock thread.
fn finish(app: &AppHandle, error: Option<String>) {
    let state = app.state::<AppState>();
    let (lock, was_locked, generation) = {
        let mut inner = state.0.lock().unwrap();
        let was_locked = inner.phase == Phase::Locked;
        inner.generation += 1;
        inner.phase = Phase::Idle;
        inner.arm_until = None;
        inner.locked_at = None;
        if error.is_some() {
            // A failed lock often means a permission changed: re-check right away.
            FORCE_THOROUGH.store(true, Ordering::SeqCst);
        }
        inner.error = error.clone();
        let lock = inner.lock.take();
        emit_state(app, &mut inner);
        (lock, was_locked, inner.generation)
    };
    // Release outside the mutex: on macOS this joins the event-tap thread.
    drop(lock);
    close_overlays(app);

    if error.is_some() {
        // Show what went wrong where the user starts locks.
        shell::close_islands(app);
        shell::show_panel(app);
    } else if was_locked {
        // A short "Unlocked" on the island, then it folds away (unless a new lock started).
        shell::show_islands(app, IslandState::Done);
        let app = app.clone();
        std::thread::spawn(move || {
            std::thread::sleep(DONE_FOR);
            let still_idle = {
                let state = app.state::<AppState>();
                let inner = state.0.lock().unwrap();
                inner.generation == generation && inner.phase == Phase::Idle
            };
            if still_idle {
                shell::close_islands(&app);
            }
        });
    } else {
        // Cancelled while arming.
        shell::close_islands(app);
    }
    if !shell::uses_panel() {
        if let Some(main) = app.get_webview_window("main") {
            let _ = main.show();
            let _ = main.set_focus();
        }
    }
}

fn engage(app: &AppHandle) {
    let state = app.state::<AppState>();
    let options = {
        let mut inner = state.0.lock().unwrap();
        inner.keys_ignored = 0;
        keylock::Options { device_ids: inner.device_ids.clone() }
    };
    let handle = app.clone();
    let result = keylock::engage(&options, move |event| match event {
        keylock::Event::Swallowed { label } => {
            handle.state::<AppState>().0.lock().unwrap().keys_ignored += 1;
            let _ = handle.emit("key-swallowed", SwallowedPayload { label });
        }
        keylock::Event::Escape => {
            // Never release the lock on the keylock thread itself.
            let h = handle.clone();
            std::thread::spawn(move || finish(&h, None));
        }
    });

    match result {
        Ok(lock) => {
            let mut inner = state.0.lock().unwrap();
            if inner.phase != Phase::Arming {
                return; // cancelled while engaging; `lock` drops and releases
            }
            inner.lock = Some(lock);
            inner.phase = Phase::Locked;
            inner.arm_until = None;
            inner.locked_at = Some(Instant::now());
            let cover = inner.cover_screen;
            emit_state(app, &mut inner);
            drop(inner);
            if cover {
                shell::close_islands(app);
                open_overlays(app);
            } else {
                shell::show_islands(app, IslandState::Locked);
            }
        }
        Err(e) => finish(app, Some(format!("Couldn't lock the keyboard: {e}"))),
    }
}

/// One ticker per lock: emits state for the countdowns and moves between phases.
fn spawn_ticker(app: AppHandle, generation: u64) {
    std::thread::spawn(move || loop {
        std::thread::sleep(TICK);
        let state = app.state::<AppState>();
        let mut inner = state.0.lock().unwrap();
        if inner.generation != generation {
            return;
        }
        let now = Instant::now();
        match inner.phase {
            Phase::Idle => return,
            Phase::Arming => {
                if inner.arm_until.is_some_and(|t| now >= t) {
                    drop(inner);
                    engage(&app);
                    continue;
                }
                emit_state(&app, &mut inner);
            }
            Phase::Locked => {
                let expired = matches!((inner.locked_at, inner.duration), (Some(at), Some(d)) if now - at >= d);
                if expired {
                    drop(inner);
                    finish(&app, None);
                    return;
                }
                emit_state(&app, &mut inner);
            }
        }
    });
}

#[tauri::command]
fn get_state(state: State<AppState>) -> StatePayload {
    snapshot(&state.0.lock().unwrap())
}

// ---------------------------------------------------------------------------------------------
// Live system state: a watcher reads permissions, keyboards and Secure Input every 2 s while
// idle (thoroughly every 6 s, or right away when asked) and emits `system-changed` on change.
// ---------------------------------------------------------------------------------------------

const WATCH_EVERY: Duration = Duration::from_secs(2);
const THOROUGH_EVERY: Duration = Duration::from_secs(6);

/// Set to make the watcher do a thorough read on its next step (after a failed lock, an install…).
static FORCE_THOROUGH: AtomicBool = AtomicBool::new(false);
/// The last `system-changed` payload, to emit only changes.
static LAST_SYSTEM: Mutex<String> = Mutex::new(String::new());

fn read_system(thorough: bool) -> SystemDto {
    let s = keylock::snapshot(thorough);
    let p = s.permissions;
    // The fallback (no helper) is blind while Secure Input is held, so it can't lock then.
    let usable = p.all_granted() && (p.helper == keylock::Helper::Ready || s.secure_input_holder.is_none());
    SystemDto {
        permissions: PermissionsDto {
            platform: std::env::consts::OS,
            accessibility: p.accessibility.as_str(),
            input_monitoring: p.input_monitoring.as_str(),
            input_devices: p.input_devices.as_str(),
            helper: p.helper.as_str(),
            secure_input_holder: s.secure_input_holder,
            all_granted: usable,
        },
        keyboards: s
            .keyboards
            .into_iter()
            .map(|k| KeyboardDto { id: k.id, name: k.name, kind: k.kind.as_str() })
            .collect(),
    }
}

/// Emit `system-changed` if anything differs from the last emitted state.
fn publish_system(app: &AppHandle, system: &SystemDto) {
    let json = serde_json::to_string(system).unwrap_or_default();
    let mut last = LAST_SYSTEM.lock().unwrap();
    if *last != json {
        *last = json;
        let _ = app.emit("system-changed", system.clone());
    }
}

fn spawn_system_watcher(app: AppHandle) {
    std::thread::Builder::new()
        .name("system-watcher".into())
        .spawn(move || {
            let mut last_thorough = Instant::now() - THOROUGH_EVERY;
            let mut last_quick = Instant::now() - WATCH_EVERY;
            loop {
                std::thread::sleep(Duration::from_millis(250));
                let idle = app.state::<AppState>().0.lock().unwrap().phase == Phase::Idle;
                if !idle {
                    continue; // nothing to show while arming or locked, and no checks during a lock
                }
                let forced = FORCE_THOROUGH.swap(false, Ordering::SeqCst);
                let thorough = forced || last_thorough.elapsed() >= THOROUGH_EVERY;
                if !thorough && last_quick.elapsed() < WATCH_EVERY {
                    continue;
                }
                let system = read_system(thorough);
                last_quick = Instant::now();
                if thorough {
                    last_thorough = Instant::now();
                }
                publish_system(&app, &system);
            }
        })
        .expect("start the system watcher");
}

/// Read the system now (and tell every window if it changed). `thorough` when the window has
/// just come back into focus, e.g. from System Settings.
#[tauri::command]
async fn refresh_system(app: AppHandle, thorough: bool) -> SystemDto {
    let system = read_system(thorough);
    publish_system(&app, &system);
    system
}

#[tauri::command]
async fn list_keyboards() -> Vec<KeyboardDto> {
    read_system(false).keyboards
}

// Async so the socket round-trip to the keyboard helper never blocks the UI thread.
#[tauri::command]
async fn permissions() -> PermissionsDto {
    read_system(false).permissions
}

#[tauri::command]
fn request_permissions() {
    keylock::request_permissions();
}

/// macOS: install the keyboard helper (shows the admin-password prompt). It then asks for
/// Input Monitoring itself, which shows macOS's own prompt.
#[tauri::command]
async fn install_helper() -> Result<(), String> {
    let result = keylock::install_helper().map_err(|e| e.to_string());
    FORCE_THOROUGH.store(true, Ordering::SeqCst);
    result
}

#[tauri::command]
async fn request_helper_access() {
    keylock::request_helper_access();
}

#[tauri::command]
async fn uninstall_helper() -> Result<(), String> {
    let result = keylock::uninstall_helper().map_err(|e| e.to_string());
    FORCE_THOROUGH.store(true, Ordering::SeqCst);
    result
}

#[tauri::command]
fn open_helper_settings() {
    keylock::open_helper_settings();
}

/// Begin arming: the panel closes and the island shows the countdown.
fn begin_lock(
    app: &AppHandle,
    duration_secs: Option<u64>,
    arm_delay_ms: u64,
    device_ids: Vec<String>,
    cover_screen: bool,
) -> Result<StatePayload, String> {
    let state = app.state::<AppState>();
    let mut inner = state.0.lock().unwrap();
    if inner.phase != Phase::Idle {
        return Err("A lock is already running".into());
    }
    inner.generation += 1;
    inner.phase = Phase::Arming;
    inner.error = None;
    inner.keys_ignored = 0;
    inner.arm_until = Some(Instant::now() + Duration::from_millis(arm_delay_ms.min(10_000)));
    inner.duration = duration_secs.map(|s| Duration::from_secs(s).min(MAX_LOCK));
    inner.device_ids = device_ids;
    inner.cover_screen = cover_screen;
    let generation = inner.generation;
    let payload = snapshot(&inner);
    emit_state(app, &mut inner);
    drop(inner);
    shell::hide_panel(app);
    shell::show_islands(app, IslandState::Arming);
    spawn_ticker(app.clone(), generation);
    Ok(payload)
}

/// A lock chosen from the tray menu, with the keyboards and screen choice last set in the panel.
pub(crate) fn lock_from_tray(app: &AppHandle, duration_secs: Option<u64>) {
    let prefs = app.state::<AppState>().0.lock().unwrap().prefs.clone();
    if let Err(e) = begin_lock(app, duration_secs, ARM_DELAY_MS, prefs.device_ids, prefs.cover_screen) {
        eprintln!("tray lock: {e}");
    }
}

/// Start the arming countdown. `duration_secs: None` locks until the user unlocks.
#[tauri::command]
fn start_lock(
    app: AppHandle,
    duration_secs: Option<u64>,
    arm_delay_ms: u64,
    device_ids: Vec<String>,
    cover_screen: Option<bool>,
) -> Result<StatePayload, String> {
    begin_lock(&app, duration_secs, arm_delay_ms, device_ids, cover_screen.unwrap_or(false))
}

/// Cancel arming, or end a lock (the hold-to-unlock button).
#[tauri::command]
fn unlock(app: AppHandle) {
    std::thread::spawn(move || finish(&app, None));
}

/// The panel's keyboard and screen choices, so tray-menu locks match them.
#[tauri::command]
fn set_prefs(state: State<AppState>, device_ids: Vec<String>, cover_screen: bool) {
    state.0.lock().unwrap().prefs = Prefs { device_ids, cover_screen };
}

/// The panel's content height changed (logical px, shadow margin included).
#[tauri::command]
fn fit_panel(app: AppHandle, height: f64) {
    shell::fit_panel(&app, height);
}

#[tauri::command]
fn hide_panel(app: AppHandle) {
    shell::hide_panel(&app);
}

#[tauri::command]
fn quit_app(app: AppHandle) {
    app.exit(0);
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec![updates::AUTOSTART_ARG]),
        ))
        .manage(AppState(Mutex::new(Inner {
            phase: Phase::Idle,
            generation: 0,
            arm_until: None,
            locked_at: None,
            duration: None,
            device_ids: Vec::new(),
            cover_screen: false,
            keys_ignored: 0,
            lock: None,
            error: None,
            prefs: Prefs::default(),
            tray_phase: Phase::Idle,
        })))
        .setup(|app| {
            shell::init_platform(app);
            shell::create_main_window(app.handle())?;
            shell::create_tray(app.handle())?;
            // Open the panel at launch so it's clear where Hushboard lives, except when it was
            // started at login, where it should stay quietly in the menu bar or tray.
            if !updates::launched_at_login() {
                shell::show_panel(app.handle());
            }
            updates::spawn_checker(app.handle().clone());
            spawn_system_watcher(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_state,
            refresh_system,
            list_keyboards,
            permissions,
            request_permissions,
            install_helper,
            uninstall_helper,
            open_helper_settings,
            request_helper_access,
            start_lock,
            unlock,
            set_prefs,
            fit_panel,
            hide_panel,
            quit_app,
            updates::check_for_update,
            updates::install_update,
            updates::get_autostart,
            updates::set_autostart
        ])
        .run(tauri::generate_context!())
        .expect("error while running Hushboard");
}
