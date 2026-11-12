//! macOS. Two ways to lock:
//! * Hardware (preferred): the root keyboard helper seizes the keyboards through IOKit
//!   (`mac_helper.rs`, `mac_hid.rs`). Works even while another process holds Secure Input, and
//!   can lock one keyboard at a time.
//! * Event tap (fallback, no helper): a HID-level CGEventTap whose callback returns NULL for key
//!   events. Blind while Secure Input is on. (The `core-graphics` crate's wrapper can't return
//!   NULL, so the tap is created through the C API directly.)

use crate::mac_helper::{self, HelperStatus};
use crate::{Error, Event, Helper, Keyboard, Kind, Options, Permissions, Sink, Status};
use core_foundation::base::TCFType;
use core_foundation::boolean::CFBoolean;
use core_foundation::dictionary::CFDictionary;
use core_foundation::mach_port::{CFMachPort, CFMachPortRef};
use core_foundation::runloop::{kCFRunLoopCommonModes, kCFRunLoopDefaultMode, CFRunLoop};
use core_foundation::string::CFString;
use std::ffi::c_void;
use std::sync::atomic::{AtomicBool, AtomicPtr, AtomicU64, Ordering};
use std::sync::{mpsc, Arc};
use std::thread::JoinHandle;
use std::time::Duration;

// CGEventTapLocation / Placement / Options
const K_CG_HID_EVENT_TAP: u32 = 0;
const K_CG_HEAD_INSERT_EVENT_TAP: u32 = 0;
const K_CG_EVENT_TAP_OPTION_DEFAULT: u32 = 0;
// CGEventType
const KEY_DOWN: u32 = 10;
const KEY_UP: u32 = 11;
const FLAGS_CHANGED: u32 = 12;
const TAP_DISABLED_BY_TIMEOUT: u32 = 0xFFFF_FFFE;
const TAP_DISABLED_BY_USER_INPUT: u32 = 0xFFFF_FFFF;
// CGEventField
const KEYBOARD_EVENT_AUTOREPEAT: u32 = 8;
const KEYBOARD_EVENT_KEYCODE: u32 = 9;
// CGEventFlags
const FLAG_CONTROL: u64 = 0x0004_0000;
const FLAG_ALTERNATE: u64 = 0x0008_0000;

const KEYCODE_U: i64 = 32;

type CGEventRef = *mut c_void;
type TapCallback =
    unsafe extern "C" fn(proxy: *mut c_void, etype: u32, event: CGEventRef, user_info: *mut c_void) -> CGEventRef;

#[link(name = "ApplicationServices", kind = "framework")]
extern "C" {
    fn AXIsProcessTrusted() -> bool;
    fn AXIsProcessTrustedWithOptions(options: *const c_void) -> bool;
}

#[link(name = "CoreGraphics", kind = "framework")]
extern "C" {
    fn CGPreflightListenEventAccess() -> bool;
    fn CGRequestListenEventAccess() -> bool;
    fn CGEventTapCreate(
        tap: u32,
        place: u32,
        options: u32,
        events_of_interest: u64,
        callback: TapCallback,
        user_info: *mut c_void,
    ) -> CFMachPortRef;
    fn CGEventTapEnable(tap: CFMachPortRef, enable: bool);
    fn CGEventGetIntegerValueField(event: CGEventRef, field: u32) -> i64;
    fn CGEventGetFlags(event: CGEventRef) -> u64;
}

#[link(name = "CoreFoundation", kind = "framework")]
extern "C" {
    fn CFMachPortInvalidate(port: CFMachPortRef);
}

#[link(name = "Carbon", kind = "framework")]
extern "C" {
    /// True while any app has Secure Event Input on (a focused password field, or a terminal's
    /// "Secure Keyboard Entry"). Event taps can't see keys then.
    fn IsSecureEventInputEnabled() -> u8;
}

/// Shared with the C callback through `user_info`. Freed after the tap is invalidated.
struct TapState {
    sink: Sink,
    port: AtomicPtr<c_void>,
    swallowed: AtomicU64,
}

unsafe extern "C" fn tap_callback(_proxy: *mut c_void, etype: u32, event: CGEventRef, user_info: *mut c_void) -> CGEventRef {
    let state = &*(user_info as *const TapState);
    match etype {
        TAP_DISABLED_BY_TIMEOUT | TAP_DISABLED_BY_USER_INPUT => {
            // macOS switches a slow tap off; switch it straight back on.
            let port = state.port.load(Ordering::SeqCst);
            if !port.is_null() {
                CGEventTapEnable(port as CFMachPortRef, true);
            }
            event
        }
        KEY_DOWN => {
            state.swallowed.fetch_add(1, Ordering::Relaxed);
            let code = CGEventGetIntegerValueField(event, KEYBOARD_EVENT_KEYCODE);
            let repeat = CGEventGetIntegerValueField(event, KEYBOARD_EVENT_AUTOREPEAT) != 0;
            let flags = CGEventGetFlags(event);
            if code == KEYCODE_U && flags & FLAG_CONTROL != 0 && flags & FLAG_ALTERNATE != 0 {
                (state.sink)(Event::Escape);
            } else if !repeat {
                (state.sink)(Event::Swallowed { label: label(code).to_string() });
            }
            std::ptr::null_mut() // delete the event
        }
        KEY_UP | FLAGS_CHANGED => std::ptr::null_mut(),
        _ => event,
    }
}

/// Fallback lock: an event tap in the app's own process.
pub struct TapLock {
    stop: Arc<AtomicBool>,
    thread: Option<JoinHandle<()>>,
}

impl TapLock {
    pub fn release(&mut self) {
        self.stop.store(true, Ordering::SeqCst);
        if let Some(t) = self.thread.take() {
            if t.thread().id() != std::thread::current().id() {
                let _ = t.join();
            }
        }
    }
}

/// The hardware lock (through the helper) when it's ready, otherwise the event tap.
pub enum Lock {
    Hardware(mac_helper::HelperLock),
    Tap(TapLock),
}

impl Lock {
    pub fn release(&mut self) {
        match self {
            Lock::Hardware(l) => l.release(),
            Lock::Tap(l) => l.release(),
        }
    }
}

pub fn keyboards() -> Vec<Keyboard> {
    snapshot(false).1
}

pub fn permissions() -> Permissions {
    snapshot(false).0
}

/// Permissions and keyboards from a single look at the helper. `thorough` also verifies the
/// helper's grant from the user's side, which is how a switched-off permission is noticed.
pub fn snapshot(thorough: bool) -> (Permissions, Vec<Keyboard>) {
    let flag = |b: bool| if b { Status::Granted } else { Status::Denied };
    let status = mac_helper::status_with(thorough);
    let helper = match &status {
        HelperStatus::Missing => Helper::Missing,
        HelperStatus::NeedsApproval => Helper::NeedsApproval,
        HelperStatus::Outdated => Helper::Outdated,
        HelperStatus::Ready(_) => Helper::Ready,
    };
    let keyboards = match status {
        HelperStatus::Ready(list) if !list.is_empty() => list,
        _ => vec![Keyboard { id: "all".into(), name: "All keyboards".into(), kind: Kind::All }],
    };
    let permissions = unsafe {
        Permissions {
            accessibility: flag(AXIsProcessTrusted()),
            input_monitoring: flag(CGPreflightListenEventAccess()),
            input_devices: Status::NotNeeded,
            helper,
        }
    };
    (permissions, keyboards)
}

/// The app holding Secure Input, when it's on ("loginwindow", "1Password"…). While it's on,
/// the event-tap fallback is blind. The hardware lock isn't affected.
pub fn secure_input_holder() -> Option<String> {
    if unsafe { IsSecureEventInputEnabled() } == 0 {
        return None;
    }
    let out = std::process::Command::new("/usr/sbin/ioreg").args(["-l", "-w", "0", "-d", "1"]).output().ok()?;
    let text = String::from_utf8_lossy(&out.stdout);
    let key = "\"kCGSSessionSecureInputPID\"=";
    let pid: String = text
        .find(key)
        .map(|i| text[i + key.len()..].chars().take_while(|c| c.is_ascii_digit()).collect())
        .unwrap_or_default();
    if pid.is_empty() {
        return Some("another app".into());
    }
    let ps = std::process::Command::new("/bin/ps").args(["-p", &pid, "-o", "comm="]).output().ok()?;
    let path = String::from_utf8_lossy(&ps.stdout).trim().to_string();
    let name = path.rsplit('/').next().unwrap_or("").to_string();
    Some(if name.is_empty() { "another app".into() } else { name })
}

pub fn install_helper() -> Result<(), Error> {
    mac_helper::install_from_app()
}

pub fn uninstall_helper() -> Result<(), Error> {
    mac_helper::uninstall_from_app()
}

pub fn open_helper_settings() {
    mac_helper::open_input_monitoring()
}

pub fn request_helper_access() {
    mac_helper::request_access_from_app()
}

pub fn engage(options: &Options, sink: Sink) -> Result<Lock, Error> {
    match mac_helper::status() {
        HelperStatus::Ready(_) => {
            // "all" is the placeholder id used when the helper's list isn't available.
            let ids: Vec<String> = options.device_ids.iter().filter(|id| *id != "all").cloned().collect();
            mac_helper::lock(&ids, sink).map(Lock::Hardware)
        }
        HelperStatus::NeedsApproval => Err(Error::PermissionDenied(
            "switch on Hushboard Keyboard Helper in System Settings → Privacy & Security → Input Monitoring".into(),
        )),
        HelperStatus::Outdated => Err(Error::Os("the keyboard helper needs an update (press Update helper)".into())),
        HelperStatus::Missing => engage_tap(sink).map(Lock::Tap),
    }
}

pub fn request_permissions() {
    unsafe {
        let key = CFString::new("AXTrustedCheckOptionPrompt");
        let opts = CFDictionary::from_CFType_pairs(&[(key.as_CFType(), CFBoolean::true_value().as_CFType())]);
        AXIsProcessTrustedWithOptions(opts.as_concrete_TypeRef() as *const c_void);
        CGRequestListenEventAccess();
    }
}

fn label(code: i64) -> &'static str {
    match code {
        0 => "A", 1 => "S", 2 => "D", 3 => "F", 4 => "H", 5 => "G", 6 => "Z", 7 => "X",
        8 => "C", 9 => "V", 11 => "B", 12 => "Q", 13 => "W", 14 => "E", 15 => "R", 16 => "Y",
        17 => "T", 18 => "1", 19 => "2", 20 => "3", 21 => "4", 22 => "6", 23 => "5", 25 => "9",
        26 => "7", 28 => "8", 29 => "0", 31 => "O", 32 => "U", 34 => "I", 35 => "P", 36 => "⏎",
        37 => "L", 38 => "J", 40 => "K", 45 => "N", 46 => "M", 48 => "Tab", 49 => "space",
        51 => "⌫", 53 => "Esc",
        _ => "·",
    }
}

fn engage_tap(sink: Sink) -> Result<TapLock, Error> {
    if !unsafe { AXIsProcessTrusted() } {
        return Err(Error::PermissionDenied("Accessibility access is not allowed".into()));
    }
    if unsafe { IsSecureEventInputEnabled() } != 0 {
        return Err(Error::Os(
            "another app has secure keyboard entry on (a password field, or a terminal's Secure Keyboard Entry). Close it or switch it off, then try again".into(),
        ));
    }

    let stop = Arc::new(AtomicBool::new(false));
    let stop_thread = stop.clone();
    let (ready_tx, ready_rx) = mpsc::channel::<Result<(), Error>>();

    let thread = std::thread::Builder::new()
        .name("keylock-tap".into())
        .spawn(move || unsafe {
            let state = Box::into_raw(Box::new(TapState {
                sink,
                port: AtomicPtr::new(std::ptr::null_mut()),
                swallowed: AtomicU64::new(0),
            }));
            let mask = (1u64 << KEY_DOWN) | (1u64 << KEY_UP) | (1u64 << FLAGS_CHANGED);
            let raw = CGEventTapCreate(
                K_CG_HID_EVENT_TAP,
                K_CG_HEAD_INSERT_EVENT_TAP,
                K_CG_EVENT_TAP_OPTION_DEFAULT,
                mask,
                tap_callback,
                state as *mut c_void,
            );
            if raw.is_null() {
                drop(Box::from_raw(state));
                let _ = ready_tx.send(Err(Error::PermissionDenied(
                    "macOS refused the event tap (check Accessibility and Input Monitoring)".into(),
                )));
                return;
            }
            (*state).port.store(raw as *mut c_void, Ordering::SeqCst);
            let port = CFMachPort::wrap_under_create_rule(raw);

            let source = match port.create_runloop_source(0) {
                Ok(s) => s,
                Err(()) => {
                    CFMachPortInvalidate(raw);
                    drop(port);
                    drop(Box::from_raw(state));
                    let _ = ready_tx.send(Err(Error::Os("could not create a run loop source".into())));
                    return;
                }
            };
            let run_loop = CFRunLoop::get_current();
            run_loop.add_source(&source, kCFRunLoopCommonModes);
            CGEventTapEnable(raw, true);
            eprintln!("keylock: event tap on");
            let _ = ready_tx.send(Ok(()));

            while !stop_thread.load(Ordering::SeqCst) {
                CFRunLoop::run_in_mode(kCFRunLoopDefaultMode, Duration::from_millis(200), false);
            }

            CGEventTapEnable(raw, false);
            run_loop.remove_source(&source, kCFRunLoopCommonModes);
            CFMachPortInvalidate(raw);
            drop(source);
            drop(port);
            let count = (*state).swallowed.load(Ordering::Relaxed);
            drop(Box::from_raw(state));
            eprintln!("keylock: event tap off, {count} key presses dropped");
        })
        .map_err(|e| Error::Os(e.to_string()))?;

    match ready_rx.recv_timeout(Duration::from_secs(3)) {
        Ok(Ok(())) => Ok(TapLock { stop, thread: Some(thread) }),
        Ok(Err(e)) => {
            let _ = thread.join();
            Err(e)
        }
        Err(_) => {
            stop.store(true, Ordering::SeqCst);
            Err(Error::Os("the event tap did not start in time".into()))
        }
    }
}

/// Test hook: true when Secure Event Input is on.
#[allow(dead_code)]
pub fn secure_input_enabled() -> bool {
    unsafe { IsSecureEventInputEnabled() != 0 }
}
