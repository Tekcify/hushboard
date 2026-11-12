//! Windows: a low-level keyboard hook (WH_KEYBOARD_LL) that swallows every key.
//!
//! Ctrl + Alt + Del and Win + L are handled by Windows itself and always get through, which is
//! a useful safety net. Without elevation the hook can't block keys while an elevated window
//! (e.g. Task Manager) has focus.

use crate::{Error, Event, Keyboard, Kind, Modifiers, Options, Permissions, Sink};
use std::sync::atomic::Ordering;
use std::sync::{mpsc, Mutex};
use std::thread::JoinHandle;
use std::time::Duration;
use windows::Win32::Foundation::{HINSTANCE, LPARAM, LRESULT, WPARAM};
use windows::Win32::System::LibraryLoader::GetModuleHandleW;
use windows::Win32::System::Threading::GetCurrentThreadId;
use windows::Win32::UI::WindowsAndMessaging::{
    CallNextHookEx, GetMessageW, PostThreadMessageW, SetWindowsHookExW, UnhookWindowsHookEx,
    HC_ACTION, KBDLLHOOKSTRUCT, MSG, WH_KEYBOARD_LL, WM_KEYDOWN, WM_QUIT, WM_SYSKEYDOWN,
};

static SINK: Mutex<Option<Sink>> = Mutex::new(None);
static MODS: Modifiers = Modifiers::new();

const VK_U: u32 = 0x55;

pub struct Lock {
    thread_id: u32,
    thread: Option<JoinHandle<()>>,
}

impl Lock {
    pub fn release(&mut self) {
        if let Some(t) = self.thread.take() {
            unsafe {
                let _ = PostThreadMessageW(self.thread_id, WM_QUIT, WPARAM(0), LPARAM(0));
            }
            if t.thread().id() != std::thread::current().id() {
                let _ = t.join();
            }
        }
        *SINK.lock().unwrap() = None;
    }
}

pub fn keyboards() -> Vec<Keyboard> {
    vec![Keyboard { id: "all".into(), name: "All keyboards".into(), kind: Kind::All }]
}

pub fn permissions() -> Permissions {
    Permissions::default()
}

pub fn request_permissions() {}

fn label(vk: u32) -> String {
    match vk {
        0x41..=0x5A | 0x30..=0x39 => char::from_u32(vk).map(String::from).unwrap_or_default(),
        0x20 => "space".into(),
        0x0D => "⏎".into(),
        0x08 => "⌫".into(),
        0x1B => "Esc".into(),
        0x09 => "Tab".into(),
        _ => "·".into(),
    }
}

unsafe extern "system" fn hook(code: i32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
    if code != HC_ACTION as i32 {
        return CallNextHookEx(None, code, wparam, lparam);
    }
    let info = &*(lparam.0 as *const KBDLLHOOKSTRUCT);
    let msg = wparam.0 as u32;
    let down = msg == WM_KEYDOWN || msg == WM_SYSKEYDOWN;
    match info.vkCode {
        0x11 | 0xA2 | 0xA3 => MODS.ctrl.store(down, Ordering::Relaxed),
        0x12 | 0xA4 | 0xA5 => MODS.alt.store(down, Ordering::Relaxed),
        vk if down => {
            if let Some(sink) = SINK.lock().ok().and_then(|g| g.clone()) {
                if vk == VK_U && MODS.both() {
                    sink(Event::Escape);
                } else {
                    sink(Event::Swallowed { label: label(vk) });
                }
            }
        }
        _ => {}
    }
    LRESULT(1) // swallow every key, key-ups included
}

pub fn engage(_options: &Options, sink: Sink) -> Result<Lock, Error> {
    *SINK.lock().unwrap() = Some(sink);
    MODS.ctrl.store(false, Ordering::Relaxed);
    MODS.alt.store(false, Ordering::Relaxed);

    let (tx, rx) = mpsc::channel::<Result<u32, Error>>();
    let thread = std::thread::Builder::new()
        .name("keylock-hook".into())
        .spawn(move || unsafe {
            let module = match GetModuleHandleW(None) {
                Ok(m) => m,
                Err(e) => {
                    let _ = tx.send(Err(Error::Os(e.to_string())));
                    return;
                }
            };
            let hhook = match SetWindowsHookExW(WH_KEYBOARD_LL, Some(hook), HINSTANCE(module.0), 0) {
                Ok(h) => h,
                Err(e) => {
                    let _ = tx.send(Err(Error::Os(e.to_string())));
                    return;
                }
            };
            let _ = tx.send(Ok(GetCurrentThreadId()));
            let mut msg = MSG::default();
            while GetMessageW(&mut msg, None, 0, 0).as_bool() {}
            let _ = UnhookWindowsHookEx(hhook);
        })
        .map_err(|e| Error::Os(e.to_string()))?;

    match rx.recv_timeout(Duration::from_secs(3)) {
        Ok(Ok(thread_id)) => Ok(Lock { thread_id, thread: Some(thread) }),
        Ok(Err(e)) => {
            let _ = thread.join();
            *SINK.lock().unwrap() = None;
            Err(e)
        }
        Err(_) => Err(Error::Os("the keyboard hook did not start in time".into())),
    }
}
