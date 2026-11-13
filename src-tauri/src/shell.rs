//! Where Hushboard lives on each platform:
//!
//! * macOS: menu bar only (no Dock icon). Clicking the icon opens the panel under it; while
//!   arming and locked, a black "island" grows out of the camera notch (or hangs from the top
//!   centre on Macs without one).
//! * Windows: a tray icon whose flyout is the panel, above the taskbar; while locked, a pill
//!   floats at the top centre of every monitor.
//! * Linux: a panel indicator with a desktop-drawn menu (tray clicks don't reach apps there),
//!   plus the ordinary window; while locked, a card centred on each monitor (Wayland can't
//!   place windows at an edge).
//!
//! The panel and island are plain webview windows (index.html and island.html); this module
//! only creates, places, sizes and shows them.

use crate::Phase;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Mutex;
use tauri::image::Image;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, LogicalSize, Manager, PhysicalPosition, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

const TRAY_ID: &str = "main";
/// Panel window width in logical px (the visible card is 20 px narrower: room for its shadow).
pub const PANEL_W: f64 = 380.0;

/// macOS and Windows get the tray panel; Linux keeps an ordinary window (many Linux desktops
/// don't deliver tray clicks to apps, and stock GNOME hides tray icons altogether).
pub fn uses_panel() -> bool {
    cfg!(any(target_os = "macos", windows))
}

/// Physical rect of the tray icon from its last click, to put the panel next to it.
static TRAY_RECT: Mutex<Option<(f64, f64, f64, f64)>> = Mutex::new(None);
/// macOS: the main screen has a camera notch.
static HAS_NOTCH: AtomicBool = AtomicBool::new(false);
/// How long the panel's close animation gets before the window hides (app.css: 130 ms + slack).
const PANEL_CLOSE_MS: u64 = 150;
/// Bumped on every open and close, so a pending hide knows whether it's been overtaken.
static PANEL_GEN: AtomicU64 = AtomicU64::new(0);
static PANEL_CLOSING: AtomicBool = AtomicBool::new(false);

// ---------------------------------------------------------------------------------------------
// Tray
// ---------------------------------------------------------------------------------------------

fn tray_image(locked: bool) -> Image<'static> {
    let bytes: &'static [u8] = match (cfg!(target_os = "macos"), locked) {
        (true, false) => include_bytes!("../icons/tray/idle-template.png"),
        (true, true) => include_bytes!("../icons/tray/locked-template.png"),
        (false, false) => include_bytes!("../icons/tray/idle.png"),
        (false, true) => include_bytes!("../icons/tray/locked.png"),
    };
    Image::from_bytes(bytes).expect("tray icons are valid PNGs")
}

pub fn create_tray(app: &AppHandle) -> tauri::Result<()> {
    let menu = Menu::with_items(
        app,
        &[
            &MenuItem::with_id(app, "lock-60", "Lock for 1 minute", true, None::<&str>)?,
            &MenuItem::with_id(app, "lock-120", "Lock for 2 minutes", true, None::<&str>)?,
            &MenuItem::with_id(app, "lock-300", "Lock for 5 minutes", true, None::<&str>)?,
            &MenuItem::with_id(app, "lock-forever", "Lock until I unlock", true, None::<&str>)?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(app, "open", "Open Hushboard…", true, None::<&str>)?,
            &MenuItem::with_id(app, "quit", "Quit Hushboard", true, None::<&str>)?,
        ],
    )?;

    TrayIconBuilder::with_id(TRAY_ID)
        .icon(tray_image(false))
        .icon_as_template(cfg!(target_os = "macos"))
        .tooltip("Hushboard: keyboard unlocked")
        .menu(&menu)
        // Left click opens the panel; the menu is on right click (on Linux, any click).
        .show_menu_on_left_click(!uses_panel())
        .on_menu_event(|app, event| match event.id().as_ref() {
            "lock-60" => crate::lock_from_tray(app, Some(60)),
            "lock-120" => crate::lock_from_tray(app, Some(120)),
            "lock-300" => crate::lock_from_tray(app, Some(300)),
            "lock-forever" => crate::lock_from_tray(app, None),
            "open" => show_panel(app),
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, rect, .. } = event {
                let scale = tray
                    .app_handle()
                    .get_webview_window("main")
                    .and_then(|w| w.scale_factor().ok())
                    .unwrap_or(1.0);
                let p = rect.position.to_physical::<f64>(scale);
                let s = rect.size.to_physical::<f64>(scale);
                *TRAY_RECT.lock().unwrap() = Some((p.x, p.y, s.width, s.height));
                toggle_panel(tray.app_handle());
            }
        })
        .build(app)?;
    Ok(())
}

/// Swap the tray icon and tooltip for the lock phase.
pub fn set_tray_phase(app: &AppHandle, phase: Phase) {
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        let locked = phase != Phase::Idle;
        let _ = tray.set_icon(Some(tray_image(locked)));
        let _ = tray.set_icon_as_template(cfg!(target_os = "macos"));
        let _ = tray.set_tooltip(Some(match phase {
            Phase::Idle => "Hushboard: keyboard unlocked",
            Phase::Arming => "Hushboard: locking…",
            Phase::Locked => "Hushboard: keyboard locked",
        }));
    }
}

// ---------------------------------------------------------------------------------------------
// Main window: the tray panel (macOS, Windows) or an ordinary window (Linux)
// ---------------------------------------------------------------------------------------------

pub fn create_main_window(app: &AppHandle) -> tauri::Result<()> {
    if uses_panel() {
        let window = WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
            .title("Hushboard")
            .initialization_script("window.__HB_SHELL = 'panel';")
            .inner_size(PANEL_W, 560.0)
            .decorations(false)
            .transparent(true)
            .shadow(false)
            .resizable(false)
            .skip_taskbar(true)
            .always_on_top(true)
            .visible(false)
            .build()?;
        // A tray panel closes when you click anywhere else.
        let handle = app.clone();
        window.on_window_event(move |event| {
            if let tauri::WindowEvent::Focused(false) = event {
                hide_panel(&handle);
            }
        });
    } else {
        WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
            .title("Hushboard")
            .initialization_script("window.__HB_SHELL = 'window';")
            .inner_size(420.0, 640.0)
            .min_inner_size(380.0, 520.0)
            .build()?;
    }
    Ok(())
}

/// Where the tray icon is (physical px): from its last click, else asked from the system, which
/// works before the first click too (e.g. the panel shown at launch).
fn tray_rect(app: &AppHandle, scale: f64) -> Option<(f64, f64, f64, f64)> {
    if let Some(r) = *TRAY_RECT.lock().unwrap() {
        return Some(r);
    }
    let rect = app.tray_by_id(TRAY_ID)?.rect().ok().flatten()?;
    let p = rect.position.to_physical::<f64>(scale);
    let s = rect.size.to_physical::<f64>(scale);
    (s.width > 0.0).then_some((p.x, p.y, s.width, s.height))
}

#[derive(Clone, serde::Serialize)]
struct Caret {
    /// Horizontal position of the icon's centre inside the panel window, logical px.
    x: f64,
}

/// Put the panel under the tray icon (macOS menu bar, like Blip and other menu bar apps) or
/// above it (Windows taskbar), centred on the icon and kept inside the screen's usable area,
/// so the Dock or taskbar never covers it. On macOS the panel also gets a caret pointing at
/// the icon.
fn place_panel(app: &AppHandle, window: &WebviewWindow) {
    let Ok(size) = window.outer_size() else { return };
    let (pw, ph) = (size.width as f64, size.height as f64);
    let scale = window.scale_factor().unwrap_or(1.0);
    let margin = 8.0 * scale;

    let tray = tray_rect(app, scale);
    let monitor = match tray {
        Some((x, y, _, _)) => app.monitor_from_point(x, y).ok().flatten(),
        None => None,
    }
    .or_else(|| app.primary_monitor().ok().flatten());
    let Some(monitor) = monitor else { return };
    let area = monitor.work_area();
    let (ax, ay) = (area.position.x as f64, area.position.y as f64);
    let (aw, ah) = (area.size.width as f64, area.size.height as f64);

    let (x, y, caret) = match tray {
        Some((tx, ty, tw, th)) => {
            let icon_x = tx + tw / 2.0;
            let x = (icon_x - pw / 2.0).clamp(ax + margin, ax + aw - pw - margin);
            let at_top = ty < ay + ah / 2.0;
            // On macOS the window's top 16 px hold the pointer (2 px gap + 14 px pointer), so it
            // starts right under the menu bar; elsewhere that space is the shadow margin.
            let y = if at_top { ty + th } else { ty - ph };
            let caret = (at_top && cfg!(target_os = "macos")).then_some((icon_x - x) / scale);
            (x, y, caret)
        }
        None => (ax + aw - pw - margin, ay, None),
    };
    let y = y.clamp(ay, (ay + ah - ph).max(ay));
    let _ = window.set_position(PhysicalPosition::new(x, y));
    let _ = app.emit_to("main", "panel-caret", caret.map(|x| Caret { x }));
}

pub fn show_panel(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        if uses_panel() {
            // Cancel a close that's still animating.
            PANEL_GEN.fetch_add(1, Ordering::SeqCst);
            PANEL_CLOSING.store(false, Ordering::SeqCst);
            place_panel(app, &window);
        }
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
        if uses_panel() {
            let _ = app.emit_to("main", "panel-open", ());
        }
    }
}

/// Close the tray panel: the page plays its close animation, then the window hides. Opening it
/// again before then cancels the hide.
pub fn hide_panel(app: &AppHandle) {
    if !uses_panel() {
        return;
    }
    let Some(window) = app.get_webview_window("main") else { return };
    if !window.is_visible().unwrap_or(false) || PANEL_CLOSING.swap(true, Ordering::SeqCst) {
        return;
    }
    let generation = PANEL_GEN.fetch_add(1, Ordering::SeqCst) + 1;
    let _ = app.emit_to("main", "panel-closing", ());
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_millis(PANEL_CLOSE_MS));
        if PANEL_GEN.load(Ordering::SeqCst) == generation {
            let _ = window.hide();
            PANEL_CLOSING.store(false, Ordering::SeqCst);
        }
    });
}

/// Clicking the tray icon while the panel is open (or still closing, because that click took
/// focus from it) closes it; otherwise it opens.
fn toggle_panel(app: &AppHandle) {
    let visible = app
        .get_webview_window("main")
        .and_then(|w| w.is_visible().ok())
        .unwrap_or(false);
    if visible {
        hide_panel(app);
    } else {
        show_panel(app);
    }
}

/// The panel's content changed height: resize the window to fit and keep it by the icon.
pub fn fit_panel(app: &AppHandle, height: f64) {
    if !uses_panel() {
        return;
    }
    if let Some(window) = app.get_webview_window("main") {
        let height = height.clamp(200.0, 760.0);
        let _ = window.set_size(LogicalSize::new(PANEL_W, height));
        if window.is_visible().unwrap_or(false) {
            place_panel(app, &window);
        }
    }
}

// ---------------------------------------------------------------------------------------------
// Island (macOS) / pill (Windows) / card (Linux): one per monitor while arming and locked
// ---------------------------------------------------------------------------------------------

/// The island's look for each phase. "done" is the 2-second "Unlocked" confirmation.
#[derive(Clone, Copy, PartialEq, Eq)]
pub enum IslandState {
    Arming,
    Locked,
    Done,
}

/// Logical size of the island window for a state, per platform.
fn island_size(state: IslandState) -> (f64, f64) {
    match (cfg!(target_os = "macos"), cfg!(windows), state) {
        // macOS: wings either side of the notch, then a card that drops below it.
        (true, _, IslandState::Locked) => (540.0, 212.0),
        (true, _, _) => (440.0, 40.0),
        // Windows: a pill with room for its shadow.
        (_, true, IslandState::Locked) => (480.0, 96.0),
        (_, true, _) => (380.0, 80.0),
        // Linux: a card in the middle of the screen.
        (_, _, IslandState::Locked) => (580.0, 240.0),
        _ => (380.0, 80.0),
    }
}

fn place_island(window: &WebviewWindow, index: usize, app: &AppHandle, w: f64, h: f64) {
    let monitors = app.available_monitors().unwrap_or_default();
    let Some(monitor) = monitors.get(index) else { return };
    let scale = monitor.scale_factor();
    let pos = monitor.position().to_logical::<f64>(scale);
    let size = monitor.size().to_logical::<f64>(scale);
    let x = pos.x + (size.width - w) / 2.0;
    let y = if cfg!(target_os = "macos") {
        pos.y // hangs from the very top, over the notch
    } else if cfg!(windows) {
        pos.y + 8.0
    } else {
        pos.y + (size.height - h) / 2.0
    };
    let _ = window.set_size(LogicalSize::new(w, h));
    let _ = window.set_position(tauri::LogicalPosition::new(x, y));
}

/// Open (or update) an island on every monitor in the given state.
pub fn show_islands(app: &AppHandle, state: IslandState) {
    let (w, h) = island_size(state);
    let monitors = app.available_monitors().unwrap_or_default();
    let notch = HAS_NOTCH.load(Ordering::Relaxed);
    for (i, _) in monitors.iter().enumerate() {
        let label = format!("island-{i}");
        let window = match app.get_webview_window(&label) {
            Some(w) => w,
            None => {
                // Only the first (main) screen of a notched Mac has the notch.
                let script = format!(
                    "window.__HB_ISLAND = {{ platform: '{}', notch: {} }};",
                    std::env::consts::OS,
                    notch && i == 0
                );
                let built = WebviewWindowBuilder::new(app, &label, WebviewUrl::App("island.html".into()))
                    .title("Hushboard")
                    .initialization_script(&script)
                    .inner_size(w, h)
                    .decorations(false)
                    .transparent(true)
                    .shadow(false)
                    .resizable(false)
                    .skip_taskbar(true)
                    .always_on_top(true)
                    .visible_on_all_workspaces(true)
                    .focused(false)
                    .build();
                match built {
                    Ok(window) => {
                        raise_above_menu_bar(app, &window);
                        window
                    }
                    Err(e) => {
                        eprintln!("could not open the island on monitor {i}: {e}");
                        continue;
                    }
                }
            }
        };
        place_island(&window, i, app, w, h);
        let _ = window.show();
    }
}

pub fn close_islands(app: &AppHandle) {
    for (label, window) in app.webview_windows() {
        if label.starts_with("island-") {
            let _ = window.close();
        }
    }
}

// ---------------------------------------------------------------------------------------------
// macOS specifics
// ---------------------------------------------------------------------------------------------

/// Call once from `setup` (main thread): no Dock icon, and remember whether there's a notch.
pub fn init_platform(app: &mut tauri::App) {
    #[cfg(target_os = "macos")]
    {
        app.set_activation_policy(tauri::ActivationPolicy::Accessory);
        HAS_NOTCH.store(mac::main_screen_has_notch(), Ordering::Relaxed);
    }
    #[cfg(not(target_os = "macos"))]
    let _ = app;
}

/// macOS: float the island above the menu bar (normal "always on top" sits below it) and keep
/// it on every Space, including full-screen apps. Elsewhere: nothing to do.
fn raise_above_menu_bar(app: &AppHandle, window: &WebviewWindow) {
    #[cfg(target_os = "macos")]
    {
        let window = window.clone();
        let _ = app.run_on_main_thread(move || {
            if let Ok(ns_window) = window.ns_window() {
                mac::float_above_menu_bar(ns_window);
            }
        });
    }
    #[cfg(not(target_os = "macos"))]
    let _ = (app, window);
}

#[cfg(target_os = "macos")]
mod mac {
    use objc2::runtime::AnyObject;
    use objc2::{class, msg_send};
    use objc2_foundation::NSEdgeInsets;
    use std::ffi::c_void;

    /// NSPopUpMenuWindowLevel: above the menu bar (NSMainMenuWindowLevel = 24).
    const POP_UP_MENU_LEVEL: isize = 101;
    // NSWindowCollectionBehavior: CanJoinAllSpaces | Stationary | IgnoresCycle | FullScreenAuxiliary
    const COLLECTION: usize = (1 << 0) | (1 << 4) | (1 << 6) | (1 << 8);

    pub fn float_above_menu_bar(ns_window: *mut c_void) {
        let window = ns_window as *mut AnyObject;
        if window.is_null() {
            return;
        }
        unsafe {
            let _: () = msg_send![window, setLevel: POP_UP_MENU_LEVEL];
            let _: () = msg_send![window, setCollectionBehavior: COLLECTION];
            let _: () = msg_send![window, setHidesOnDeactivate: false];
        }
    }

    /// The main screen reports a top safe-area inset only when it has a camera notch (macOS 12+).
    pub fn main_screen_has_notch() -> bool {
        unsafe {
            let screen: *mut AnyObject = msg_send![class!(NSScreen), mainScreen];
            if screen.is_null() {
                return false;
            }
            let responds: bool = msg_send![screen, respondsToSelector: objc2::sel!(safeAreaInsets)];
            if !responds {
                return false;
            }
            let insets: NSEdgeInsets = msg_send![screen, safeAreaInsets];
            insets.top > 0.0
        }
    }
}
