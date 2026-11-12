//! Temporarily swallow keyboard input so a keyboard can be cleaned.
//!
//! * macOS: preferably a hardware lock: a root helper (installed once with the admin password,
//!   then allowed in Input Monitoring) seizes the keyboards through IOKit. Without the helper, a
//!   HID-level `CGEventTap` that deletes key events (needs Accessibility and Input Monitoring;
//!   blind while another process holds Secure Input).
//! * Windows: a `WH_KEYBOARD_LL` hook that returns 1 for every key (no permission needed).
//! * Linux: an exclusive `EVIOCGRAB` on each selected `/dev/input/event*` keyboard (needs read
//!   access to the device, e.g. membership of the `input` group). Works on X11 and Wayland.
//!
//! On every platform the escape shortcut **Ctrl + Alt + U** is still detected while locked and
//! reported as [`Event::Escape`]. The pointer is never touched. Nothing typed is stored.

use std::fmt;
use std::sync::Arc;

#[cfg(target_os = "linux")]
mod linux;
#[cfg(target_os = "macos")]
mod mac_helper;
#[cfg(target_os = "macos")]
mod mac_hid;
#[cfg(target_os = "macos")]
mod macos;
// Named `win` so it doesn't clash with the `windows` crate.
#[cfg(windows)]
#[path = "windows.rs"]
mod win;

#[cfg(target_os = "linux")]
use linux as platform;
#[cfg(target_os = "macos")]
use macos as platform;
#[cfg(windows)]
use win as platform;

#[cfg(not(any(target_os = "linux", target_os = "macos", windows)))]
mod platform {
    use super::*;
    pub struct Lock;
    pub fn keyboards() -> Vec<Keyboard> {
        Vec::new()
    }
    pub fn permissions() -> Permissions {
        Permissions::default()
    }
    pub fn request_permissions() {}
    pub fn engage(_: &Options, _: Sink) -> Result<Lock, Error> {
        Err(Error::Unsupported("this operating system is not supported".into()))
    }
    impl Lock {
        pub fn release(&mut self) {}
    }
}

/// Where a keyboard is connected.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Kind {
    BuiltIn,
    Usb,
    Bluetooth,
    Other,
    /// The platform locks every keyboard at once (macOS, Windows).
    All,
}

impl Kind {
    pub fn as_str(self) -> &'static str {
        match self {
            Kind::BuiltIn => "built-in",
            Kind::Usb => "usb",
            Kind::Bluetooth => "bluetooth",
            Kind::Other => "other",
            Kind::All => "all",
        }
    }
}

#[derive(Debug, Clone)]
pub struct Keyboard {
    /// Stable id to pass back in [`Options::device_ids`].
    pub id: String,
    pub name: String,
    pub kind: Kind,
}

/// What the lock reports while it is engaged.
#[derive(Debug, Clone)]
pub enum Event {
    /// A key press was dropped. `label` is a short legend ("A", "space", "⏎") for the on-screen
    /// keycap, or "·" when there is no simple legend. It is never logged or stored.
    Swallowed { label: String },
    /// The escape shortcut (Ctrl + Alt + U) was pressed.
    Escape,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum Status {
    Granted,
    Denied,
    /// This permission does not exist on this platform.
    #[default]
    NotNeeded,
}

impl Status {
    pub fn as_str(self) -> &'static str {
        match self {
            Status::Granted => "granted",
            Status::Denied => "denied",
            Status::NotNeeded => "not-needed",
        }
    }
}

/// The macOS keyboard helper (hardware lock).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum Helper {
    /// Not part of this platform.
    #[default]
    NotNeeded,
    Missing,
    /// Installed, but not yet switched on in Input Monitoring.
    NeedsApproval,
    /// Installed from an older version of the app.
    Outdated,
    Ready,
}

impl Helper {
    pub fn as_str(self) -> &'static str {
        match self {
            Helper::NotNeeded => "not-needed",
            Helper::Missing => "missing",
            Helper::NeedsApproval => "needs-approval",
            Helper::Outdated => "outdated",
            Helper::Ready => "ready",
        }
    }
}

#[derive(Debug, Clone, Copy, Default)]
pub struct Permissions {
    /// macOS: System Settings → Privacy & Security → Accessibility.
    pub accessibility: Status,
    /// macOS: System Settings → Privacy & Security → Input Monitoring.
    pub input_monitoring: Status,
    /// Linux: read access to `/dev/input/event*`.
    pub input_devices: Status,
    /// macOS: the keyboard helper. When it is ready, the other macOS permissions aren't needed.
    pub helper: Helper,
}

impl Permissions {
    /// Everything the lock needs is in place. With the macOS helper installed, that means the
    /// helper is ready (an installed helper is never silently bypassed); without it, the
    /// fallback's own permissions.
    pub fn all_granted(&self) -> bool {
        match self.helper {
            Helper::Ready => true,
            Helper::NeedsApproval | Helper::Outdated => false,
            Helper::NotNeeded | Helper::Missing => [self.accessibility, self.input_monitoring, self.input_devices]
                .iter()
                .all(|s| *s != Status::Denied),
        }
    }
}

/// Everything the UI shows about the system, read together.
#[derive(Debug, Clone)]
pub struct Snapshot {
    pub permissions: Permissions,
    pub keyboards: Vec<Keyboard>,
    /// macOS: the app holding Secure Input, which blinds the no-helper fallback.
    pub secure_input_holder: Option<String>,
}

/// Read permissions, keyboards and Secure Input in one go. `thorough` (macOS) also verifies the
/// helper's permission from the user's side, which catches a permission switched off since the
/// helper started; it launches a short-lived process, so call it every few seconds, not more.
pub fn snapshot(thorough: bool) -> Snapshot {
    #[cfg(target_os = "macos")]
    {
        let (permissions, keyboards) = macos::snapshot(thorough);
        let secure_input_holder =
            if permissions.helper == Helper::Ready { None } else { macos::secure_input_holder() };
        Snapshot { permissions, keyboards, secure_input_holder }
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = thorough;
        Snapshot { permissions: platform::permissions(), keyboards: platform::keyboards(), secure_input_holder: None }
    }
}

#[derive(Debug, Clone, Default)]
pub struct Options {
    /// Keyboards to lock (ids from [`keyboards`]). Empty means every keyboard.
    /// Linux, and macOS with the keyboard helper, lock one keyboard at a time; otherwise every
    /// keyboard is locked.
    pub device_ids: Vec<String>,
}

#[derive(Debug, Clone)]
pub enum Error {
    PermissionDenied(String),
    NoKeyboards,
    Unsupported(String),
    Os(String),
}

impl fmt::Display for Error {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Error::PermissionDenied(m) => write!(f, "permission denied: {m}"),
            Error::NoKeyboards => write!(f, "no keyboards found to lock"),
            Error::Unsupported(m) => write!(f, "unsupported: {m}"),
            Error::Os(m) => write!(f, "{m}"),
        }
    }
}

impl std::error::Error for Error {}

pub(crate) type Sink = Arc<dyn Fn(Event) + Send + Sync + 'static>;

/// An engaged keyboard lock. The keyboard is released when this is dropped.
pub struct Lock {
    inner: platform::Lock,
}

impl Lock {
    /// Release the keyboard now. Dropping the lock does the same.
    pub fn release(mut self) {
        self.inner.release();
    }
}

impl Drop for Lock {
    fn drop(&mut self) {
        self.inner.release();
    }
}

/// Keyboards this platform can lock. macOS and Windows return one "All keyboards" entry.
pub fn keyboards() -> Vec<Keyboard> {
    platform::keyboards()
}

pub fn permissions() -> Permissions {
    platform::permissions()
}

/// Ask the OS for the permissions the lock needs (macOS shows its prompts; elsewhere a no-op).
pub fn request_permissions() {
    platform::request_permissions()
}

/// macOS: install the keyboard helper. Shows the system admin-password prompt and blocks until
/// the user answers. Elsewhere: unsupported.
pub fn install_helper() -> Result<(), Error> {
    #[cfg(target_os = "macos")]
    return macos::install_helper();
    #[cfg(not(target_os = "macos"))]
    Err(Error::Unsupported("the keyboard helper is macOS only".into()))
}

/// macOS: remove the keyboard helper (asks for the admin password).
pub fn uninstall_helper() -> Result<(), Error> {
    #[cfg(target_os = "macos")]
    return macos::uninstall_helper();
    #[cfg(not(target_os = "macos"))]
    Err(Error::Unsupported("the keyboard helper is macOS only".into()))
}

/// macOS: open System Settings at Input Monitoring, where the helper is switched on.
pub fn open_helper_settings() {
    #[cfg(target_os = "macos")]
    macos::open_helper_settings();
}

/// macOS: show the system's Input Monitoring prompt for the keyboard helper (also lists it in
/// System Settings). Install already does this once.
pub fn request_helper_access() {
    #[cfg(target_os = "macos")]
    macos::request_helper_access();
}

/// Call first thing in `main`. When the executable was started as the keyboard helper
/// (`--keyhelper`, `--keyhelper-install`, `--keyhelper-uninstall`), runs that and returns the
/// exit code; otherwise returns `None` and the app starts normally.
pub fn helper_main() -> Option<i32> {
    #[cfg(target_os = "macos")]
    return mac_helper::main_from_args();
    #[cfg(not(target_os = "macos"))]
    None
}

/// Start swallowing key presses. `on_event` runs on the lock's own thread: keep it short, and
/// never drop the returned [`Lock`] from inside it (hand off to another thread instead).
pub fn engage<F>(options: &Options, on_event: F) -> Result<Lock, Error>
where
    F: Fn(Event) + Send + Sync + 'static,
{
    let inner = platform::engage(options, Arc::new(on_event))?;
    Ok(Lock { inner })
}

/// Tracks Ctrl and Alt so the escape shortcut can be recognised from raw key events.
#[allow(dead_code)]
#[derive(Default)]
pub(crate) struct Modifiers {
    pub ctrl: std::sync::atomic::AtomicBool,
    pub alt: std::sync::atomic::AtomicBool,
}

#[allow(dead_code)]
impl Modifiers {
    pub const fn new() -> Self {
        Self {
            ctrl: std::sync::atomic::AtomicBool::new(false),
            alt: std::sync::atomic::AtomicBool::new(false),
        }
    }
    pub fn both(&self) -> bool {
        use std::sync::atomic::Ordering::Relaxed;
        self.ctrl.load(Relaxed) && self.alt.load(Relaxed)
    }
}
