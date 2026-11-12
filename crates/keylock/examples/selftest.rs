//! macOS self-test: proves the lock really drops keys before any app sees them.
//!
//! It posts synthetic F19 presses (a key almost nothing uses) at the hardware level and counts
//! how many reach a listen-only tap at the session level, where apps get their input:
//!   1. unlocked: every press should arrive (shows the listener works);
//!   2. locked:   none should arrive, and the lock should report each one as swallowed.
//!
//! Run: cargo run -p keylock --example selftest
//! Needs Accessibility access for the app you run it from (e.g. your terminal).

#[cfg(not(target_os = "macos"))]
fn main() {
    eprintln!("selftest is macOS only");
}

#[cfg(target_os = "macos")]
fn main() {
    mac::run();
}

#[cfg(target_os = "macos")]
mod mac {
    use core_foundation::base::TCFType;
    use core_foundation::mach_port::{CFMachPort, CFMachPortRef};
    use core_foundation::runloop::{kCFRunLoopCommonModes, kCFRunLoopDefaultMode, CFRunLoop};
    use std::ffi::c_void;
    use std::sync::atomic::{AtomicU64, Ordering};
    use std::sync::Arc;
    use std::time::Duration;

    const F19: u16 = 80;
    const PRESSES: u64 = 5;

    type CGEventRef = *mut c_void;
    type TapCallback = unsafe extern "C" fn(*mut c_void, u32, CGEventRef, *mut c_void) -> CGEventRef;

    #[link(name = "CoreGraphics", kind = "framework")]
    extern "C" {
        fn CGEventTapCreate(tap: u32, place: u32, options: u32, mask: u64, cb: TapCallback, info: *mut c_void) -> CFMachPortRef;
        fn CGEventCreateKeyboardEvent(source: *mut c_void, key: u16, down: bool) -> CGEventRef;
        fn CGEventPost(tap: u32, event: CGEventRef);
        fn CGEventGetIntegerValueField(event: CGEventRef, field: u32) -> i64;
    }
    #[link(name = "CoreFoundation", kind = "framework")]
    extern "C" {
        fn CFRelease(cf: *const c_void);
    }

    static SEEN_BY_APPS: AtomicU64 = AtomicU64::new(0);

    unsafe extern "C" fn listen(_p: *mut c_void, etype: u32, ev: CGEventRef, _i: *mut c_void) -> CGEventRef {
        if etype == 10 && CGEventGetIntegerValueField(ev, 9) == F19 as i64 {
            SEEN_BY_APPS.fetch_add(1, Ordering::SeqCst);
        }
        ev
    }

    fn post_f19() {
        unsafe {
            for down in [true, false] {
                let ev = CGEventCreateKeyboardEvent(std::ptr::null_mut(), F19, down);
                CGEventPost(0, ev); // kCGHIDEventTap: as if from the keyboard
                CFRelease(ev as *const c_void);
            }
        }
    }

    fn pump(ms: u64) {
        CFRunLoop::run_in_mode(unsafe { kCFRunLoopDefaultMode }, Duration::from_millis(ms), false);
    }

    fn round(label: &str) -> u64 {
        SEEN_BY_APPS.store(0, Ordering::SeqCst);
        for _ in 0..PRESSES {
            post_f19();
            pump(60);
        }
        pump(300);
        let seen = SEEN_BY_APPS.load(Ordering::SeqCst);
        println!("{label}: apps saw {seen} of {PRESSES} presses");
        seen
    }

    pub fn run() {
        let p = keylock::permissions();
        println!("permissions: accessibility={:?} input_monitoring={:?}", p.accessibility, p.input_monitoring);

        // Listen-only tap at the session level (kCGSessionEventTap, tail append, listen only).
        let raw = unsafe { CGEventTapCreate(1, 1, 1, 1 << 10, listen, std::ptr::null_mut()) };
        if raw.is_null() {
            println!("FAIL: could not create the listener tap (grant Accessibility to this terminal app)");
            std::process::exit(2);
        }
        let port = unsafe { CFMachPort::wrap_under_create_rule(raw) };
        let source = port.create_runloop_source(0).expect("run loop source");
        unsafe { CFRunLoop::get_current().add_source(&source, kCFRunLoopCommonModes) };

        let before = round("unlocked");

        let swallowed = Arc::new(AtomicU64::new(0));
        let s = swallowed.clone();
        let lock = match keylock::engage(&keylock::Options::default(), move |e| {
            if let keylock::Event::Swallowed { .. } = e {
                s.fetch_add(1, Ordering::SeqCst);
            }
        }) {
            Ok(l) => l,
            Err(e) => {
                println!("FAIL: could not lock: {e}");
                std::process::exit(2);
            }
        };
        pump(200);
        let during = round("locked");
        let caught = swallowed.load(Ordering::SeqCst);
        println!("locked: the lock caught {caught} of {PRESSES} presses");
        lock.release();

        let after = round("unlocked again");

        let ok = before == PRESSES && during == 0 && caught == PRESSES && after == PRESSES;
        println!("{}", if ok { "PASS: keys are dropped while locked and flow again after" } else { "FAIL" });
        std::process::exit(if ok { 0 } else { 1 });
    }
}
