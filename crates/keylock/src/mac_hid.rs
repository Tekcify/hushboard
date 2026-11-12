//! macOS hardware lock: IOKit HID "seize" gives one process exclusive access to a keyboard, so
//! no key reaches macOS or any app. Secure Input can't get in the way, because this sits below
//! the event system. Needs root and Input Monitoring, so it runs inside the keyboard helper
//! (see `mac_helper.rs`), never in the app itself.

use crate::{Error, Event, Keyboard, Kind, Modifiers, Sink};
use core_foundation::base::{CFType, CFTypeRef, TCFType};
use core_foundation::boolean::CFBoolean;
use core_foundation::dictionary::CFDictionary;
use core_foundation::number::CFNumber;
use core_foundation::runloop::{kCFRunLoopDefaultMode, CFRunLoop, CFRunLoopRef};
use core_foundation::string::{CFString, CFStringRef};
use std::ffi::c_void;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{mpsc, Arc};
use std::thread::JoinHandle;
use std::time::Duration;

type IOHIDManagerRef = *mut c_void;
type IOHIDDeviceRef = *mut c_void;
type IOHIDValueRef = *mut c_void;
type IOHIDElementRef = *mut c_void;
type IOReturn = i32;
type ValueCallback = unsafe extern "C" fn(context: *mut c_void, result: IOReturn, sender: *mut c_void, value: IOHIDValueRef);

const SEIZE: u32 = 1; // kIOHIDOptionsTypeSeizeDevice
const K_IO_RETURN_NOT_PERMITTED: IOReturn = 0xE000_02E2_u32 as i32;
const K_IO_RETURN_NOT_PRIVILEGED: IOReturn = 0xE000_02C1_u32 as i32;
const K_IO_RETURN_EXCLUSIVE_ACCESS: IOReturn = 0xE000_02C5_u32 as i32;
const LISTEN_EVENT: u32 = 1; // kIOHIDRequestTypeListenEvent

#[link(name = "IOKit", kind = "framework")]
extern "C" {
    fn IOHIDManagerCreate(alloc: *const c_void, options: u32) -> IOHIDManagerRef;
    fn IOHIDManagerSetDeviceMatching(manager: IOHIDManagerRef, matching: *const c_void);
    fn IOHIDManagerCopyDevices(manager: IOHIDManagerRef) -> *const c_void;
    fn IOHIDDeviceGetProperty(device: IOHIDDeviceRef, key: CFStringRef) -> CFTypeRef;
    fn IOHIDDeviceOpen(device: IOHIDDeviceRef, options: u32) -> IOReturn;
    fn IOHIDDeviceClose(device: IOHIDDeviceRef, options: u32) -> IOReturn;
    fn IOHIDDeviceRegisterInputValueCallback(device: IOHIDDeviceRef, callback: Option<ValueCallback>, context: *mut c_void);
    fn IOHIDDeviceScheduleWithRunLoop(device: IOHIDDeviceRef, run_loop: CFRunLoopRef, mode: CFStringRef);
    fn IOHIDDeviceUnscheduleFromRunLoop(device: IOHIDDeviceRef, run_loop: CFRunLoopRef, mode: CFStringRef);
    fn IOHIDValueGetElement(value: IOHIDValueRef) -> IOHIDElementRef;
    fn IOHIDValueGetIntegerValue(value: IOHIDValueRef) -> isize;
    fn IOHIDElementGetUsagePage(element: IOHIDElementRef) -> u32;
    fn IOHIDElementGetUsage(element: IOHIDElementRef) -> u32;
    fn IOHIDCheckAccess(request: u32) -> u32;
    fn IOHIDRequestAccess(request: u32) -> bool;
}

#[link(name = "CoreFoundation", kind = "framework")]
extern "C" {
    fn CFSetGetCount(set: *const c_void) -> isize;
    fn CFSetGetValues(set: *const c_void, values: *mut *const c_void);
    fn CFRelease(cf: *const c_void);
}

/// Input Monitoring status for this process: "granted", "denied" or "unknown".
pub fn access() -> &'static str {
    match unsafe { IOHIDCheckAccess(LISTEN_EVENT) } {
        0 => "granted",
        1 => "denied",
        _ => "unknown",
    }
}

/// Adds this process to System Settings → Input Monitoring so the user can switch it on.
pub fn request_access() {
    unsafe {
        IOHIDRequestAccess(LISTEN_EVENT);
    }
}

/// Owns an IOHIDManager and the CFSet of keyboard devices it matched.
struct DeviceSet {
    manager: IOHIDManagerRef,
    set: *const c_void,
    devices: Vec<IOHIDDeviceRef>,
}

impl DeviceSet {
    fn keyboards() -> Option<Self> {
        unsafe {
            let manager = IOHIDManagerCreate(std::ptr::null(), 0);
            if manager.is_null() {
                return None;
            }
            let matching = CFDictionary::from_CFType_pairs(&[
                (CFString::new("DeviceUsagePage").as_CFType(), CFNumber::from(1i32).as_CFType()),
                (CFString::new("DeviceUsage").as_CFType(), CFNumber::from(6i32).as_CFType()),
            ]);
            IOHIDManagerSetDeviceMatching(manager, matching.as_concrete_TypeRef() as *const c_void);
            let set = IOHIDManagerCopyDevices(manager);
            let mut devices = Vec::new();
            if !set.is_null() {
                let n = CFSetGetCount(set).max(0) as usize;
                let mut raw: Vec<*const c_void> = vec![std::ptr::null(); n];
                CFSetGetValues(set, raw.as_mut_ptr());
                devices = raw.into_iter().map(|d| d as IOHIDDeviceRef).collect();
            }
            Some(DeviceSet { manager, set, devices })
        }
    }
}

impl Drop for DeviceSet {
    fn drop(&mut self) {
        unsafe {
            if !self.set.is_null() {
                CFRelease(self.set);
            }
            CFRelease(self.manager as *const c_void);
        }
    }
}

fn property(device: IOHIDDeviceRef, key: &str) -> Option<CFType> {
    let key = CFString::new(key);
    let value = unsafe { IOHIDDeviceGetProperty(device, key.as_concrete_TypeRef()) };
    if value.is_null() {
        None
    } else {
        Some(unsafe { CFType::wrap_under_get_rule(value) })
    }
}

fn string_prop(device: IOHIDDeviceRef, key: &str) -> Option<String> {
    property(device, key)?.downcast::<CFString>().map(|s| s.to_string())
}

fn number_prop(device: IOHIDDeviceRef, key: &str) -> Option<i64> {
    property(device, key)?.downcast::<CFNumber>().and_then(|n| n.to_i64())
}

fn bool_prop(device: IOHIDDeviceRef, key: &str) -> Option<bool> {
    property(device, key)?.downcast::<CFBoolean>().map(bool::from)
}

fn describe(device: IOHIDDeviceRef) -> Keyboard {
    let transport = string_prop(device, "Transport").unwrap_or_default();
    let built_in = bool_prop(device, "Built-In").unwrap_or(false)
        || matches!(transport.as_str(), "SPI" | "FIFO" | "I2C" | "AID");
    let kind = if built_in {
        Kind::BuiltIn
    } else if transport.starts_with("Bluetooth") {
        Kind::Bluetooth
    } else if transport == "USB" {
        Kind::Usb
    } else {
        Kind::Other
    };
    let vendor = number_prop(device, "VendorID").unwrap_or(0);
    let product = number_prop(device, "ProductID").unwrap_or(0);
    let location = number_prop(device, "LocationID").unwrap_or(0);
    let name = string_prop(device, "Product")
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| if built_in { "Built-in keyboard".into() } else { "Keyboard".into() });
    Keyboard { id: format!("hid:{vendor:04x}:{product:04x}:{location:08x}"), name, kind }
}

/// Every keyboard IOKit can see, built-in first.
pub fn keyboards() -> Vec<Keyboard> {
    let Some(set) = DeviceSet::keyboards() else { return Vec::new() };
    let mut list: Vec<Keyboard> = set.devices.iter().map(|d| describe(*d)).collect();
    list.sort_by_key(|k| (k.kind != Kind::BuiltIn, k.name.clone()));
    list.dedup_by(|a, b| a.id == b.id);
    list
}

struct CallbackState {
    sink: Sink,
    mods: Modifiers,
}

fn label(usage: u32) -> String {
    match usage {
        0x04..=0x1D => char::from(b'A' + (usage - 0x04) as u8).to_string(),
        0x1E..=0x26 => char::from(b'1' + (usage - 0x1E) as u8).to_string(),
        0x27 => "0".into(),
        0x28 => "⏎".into(),
        0x29 => "Esc".into(),
        0x2A => "⌫".into(),
        0x2B => "Tab".into(),
        0x2C => "space".into(),
        _ => "·".into(),
    }
}

unsafe extern "C" fn on_value(context: *mut c_void, _r: IOReturn, _sender: *mut c_void, value: IOHIDValueRef) {
    let state = &*(context as *const CallbackState);
    let element = IOHIDValueGetElement(value);
    if element.is_null() || IOHIDElementGetUsagePage(element) != 0x07 {
        return; // not a keyboard key (e.g. LEDs, consumer keys)
    }
    let usage = IOHIDElementGetUsage(element);
    let pressed = IOHIDValueGetIntegerValue(value) != 0;
    match usage {
        0xE0 | 0xE4 => state.mods.ctrl.store(pressed, Ordering::Relaxed),
        0xE2 | 0xE6 => state.mods.alt.store(pressed, Ordering::Relaxed),
        0x18 if pressed && state.mods.both() => (state.sink)(Event::Escape), // U
        0x04..=0xE7 if pressed => (state.sink)(Event::Swallowed { label: label(usage) }),
        _ => {}
    }
}

/// Keyboards seized for as long as this lives.
pub struct HidLock {
    stop: Arc<AtomicBool>,
    thread: Option<JoinHandle<()>>,
}

impl HidLock {
    pub fn release(&mut self) {
        self.stop.store(true, Ordering::SeqCst);
        if let Some(t) = self.thread.take() {
            if t.thread().id() != std::thread::current().id() {
                let _ = t.join();
            }
        }
    }
}

impl Drop for HidLock {
    fn drop(&mut self) {
        self.release();
    }
}

fn open_error(code: IOReturn, name: &str) -> Error {
    match code {
        K_IO_RETURN_NOT_PERMITTED | K_IO_RETURN_NOT_PRIVILEGED => Error::PermissionDenied(
            "the keyboard helper isn't allowed in Input Monitoring yet".into(),
        ),
        K_IO_RETURN_EXCLUSIVE_ACCESS => Error::Os(format!("another app already has exclusive use of {name}")),
        other => Error::Os(format!("couldn't take over {name} (IOKit error {other:#x})")),
    }
}

/// Seize the keyboards whose ids are listed (empty = every keyboard). All or nothing: if one
/// can't be seized, none stay seized.
pub fn seize(ids: &[String], sink: Sink) -> Result<HidLock, Error> {
    let ids = ids.to_vec();
    let stop = Arc::new(AtomicBool::new(false));
    let stop_thread = stop.clone();
    let (ready_tx, ready_rx) = mpsc::channel::<Result<usize, Error>>();

    let thread = std::thread::Builder::new()
        .name("keylock-hid".into())
        .spawn(move || unsafe {
            let Some(set) = DeviceSet::keyboards() else {
                let _ = ready_tx.send(Err(Error::Os("IOKit is unavailable".into())));
                return;
            };
            let targets: Vec<(IOHIDDeviceRef, Keyboard)> = set
                .devices
                .iter()
                .map(|d| (*d, describe(*d)))
                .filter(|(_, k)| ids.is_empty() || ids.contains(&k.id))
                .collect();
            if targets.is_empty() {
                let _ = ready_tx.send(Err(Error::NoKeyboards));
                return;
            }

            let state = Box::into_raw(Box::new(CallbackState { sink, mods: Modifiers::new() }));
            let run_loop = CFRunLoop::get_current();
            let mut opened: Vec<IOHIDDeviceRef> = Vec::new();
            let mut failure = None;
            for (device, info) in &targets {
                let code = IOHIDDeviceOpen(*device, SEIZE);
                if code != 0 {
                    failure = Some(open_error(code, &info.name));
                    break;
                }
                IOHIDDeviceRegisterInputValueCallback(*device, Some(on_value), state as *mut c_void);
                IOHIDDeviceScheduleWithRunLoop(*device, run_loop.as_concrete_TypeRef(), kCFRunLoopDefaultMode);
                opened.push(*device);
            }

            if failure.is_none() {
                let _ = ready_tx.send(Ok(opened.len()));
                while !stop_thread.load(Ordering::SeqCst) {
                    CFRunLoop::run_in_mode(kCFRunLoopDefaultMode, Duration::from_millis(200), false);
                }
            }

            for device in &opened {
                IOHIDDeviceUnscheduleFromRunLoop(*device, run_loop.as_concrete_TypeRef(), kCFRunLoopDefaultMode);
                IOHIDDeviceRegisterInputValueCallback(*device, None, std::ptr::null_mut());
                IOHIDDeviceClose(*device, 0);
            }
            drop(set);
            drop(Box::from_raw(state));
            if let Some(e) = failure {
                let _ = ready_tx.send(Err(e));
            }
        })
        .map_err(|e| Error::Os(e.to_string()))?;

    match ready_rx.recv_timeout(Duration::from_secs(5)) {
        Ok(Ok(_)) => Ok(HidLock { stop, thread: Some(thread) }),
        Ok(Err(e)) => {
            let _ = thread.join();
            Err(e)
        }
        Err(_) => {
            stop.store(true, Ordering::SeqCst);
            Err(Error::Os("taking over the keyboard timed out".into()))
        }
    }
}
