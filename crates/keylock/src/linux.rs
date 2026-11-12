//! Linux: exclusive EVIOCGRAB on keyboard event devices. Works on X11 and Wayland, and can
//! lock the built-in keyboard alone. Needs read access to /dev/input/event* (the `input` group).

use crate::{Error, Event, Keyboard, Kind, Modifiers, Options, Permissions, Sink, Status};
use evdev::{BusType, Device, InputEventKind, Key};
use std::os::fd::AsRawFd;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread::JoinHandle;
use std::time::Duration;

pub struct Lock {
    stop: Arc<AtomicBool>,
    threads: Vec<JoinHandle<()>>,
}

impl Lock {
    pub fn release(&mut self) {
        self.stop.store(true, Ordering::SeqCst);
        let me = std::thread::current().id();
        for t in self.threads.drain(..) {
            if t.thread().id() != me {
                let _ = t.join();
            }
        }
    }
}

fn is_keyboard(d: &Device) -> bool {
    d.supported_keys()
        .map(|k| k.contains(Key::KEY_A) && k.contains(Key::KEY_SPACE) && k.contains(Key::KEY_ENTER))
        .unwrap_or(false)
}

fn kind_of(d: &Device) -> Kind {
    match d.input_id().bus_type() {
        BusType::BUS_I8042 => Kind::BuiltIn,
        BusType::BUS_USB => Kind::Usb,
        BusType::BUS_BLUETOOTH => Kind::Bluetooth,
        _ => Kind::Other,
    }
}

pub fn keyboards() -> Vec<Keyboard> {
    let mut list: Vec<Keyboard> = evdev::enumerate()
        .filter(|(_, d)| is_keyboard(d))
        .map(|(path, d)| Keyboard {
            id: path.to_string_lossy().into_owned(),
            name: d.name().unwrap_or("Keyboard").to_string(),
            kind: kind_of(&d),
        })
        .collect();
    list.sort_by_key(|k| (k.kind != Kind::BuiltIn, k.name.clone()));
    list
}

pub fn permissions() -> Permissions {
    let readable = std::fs::read_dir("/dev/input")
        .map(|dir| {
            dir.flatten().any(|e| {
                e.file_name().to_string_lossy().starts_with("event")
                    && std::fs::File::open(e.path()).is_ok()
            })
        })
        .unwrap_or(false);
    Permissions {
        accessibility: Status::NotNeeded,
        input_monitoring: Status::NotNeeded,
        input_devices: if readable { Status::Granted } else { Status::Denied },
        ..Permissions::default()
    }
}

pub fn request_permissions() {}

fn label(key: Key) -> String {
    let name = format!("{key:?}");
    let short = name.strip_prefix("KEY_").unwrap_or(&name);
    match short {
        "SPACE" => "space".into(),
        "ENTER" => "⏎".into(),
        "BACKSPACE" => "⌫".into(),
        "ESC" => "Esc".into(),
        "TAB" => "Tab".into(),
        s if s.chars().count() == 1 => s.to_string(),
        _ => "·".into(),
    }
}

pub fn engage(options: &Options, sink: Sink) -> Result<Lock, Error> {
    if permissions().input_devices == Status::Denied {
        return Err(Error::PermissionDenied("no read access to /dev/input".into()));
    }
    let wanted = |path: &str| options.device_ids.is_empty() || options.device_ids.iter().any(|id| id == path);
    let mut devices: Vec<Device> = evdev::enumerate()
        .filter(|(path, d)| is_keyboard(d) && wanted(&path.to_string_lossy()))
        .map(|(_, d)| d)
        .collect();
    if devices.is_empty() {
        return Err(Error::NoKeyboards);
    }

    for d in devices.iter_mut() {
        d.grab().map_err(|e| Error::Os(format!("could not grab {}: {e}", d.name().unwrap_or("keyboard"))))?;
        unsafe {
            let fd = d.as_raw_fd();
            let flags = libc::fcntl(fd, libc::F_GETFL);
            libc::fcntl(fd, libc::F_SETFL, flags | libc::O_NONBLOCK);
        }
    }

    let stop = Arc::new(AtomicBool::new(false));
    let mods = Arc::new(Modifiers::default());
    let threads = devices
        .into_iter()
        .map(|mut dev| {
            let stop = stop.clone();
            let sink = sink.clone();
            let mods = mods.clone();
            std::thread::spawn(move || {
                while !stop.load(Ordering::SeqCst) {
                    match dev.fetch_events() {
                        Ok(events) => {
                            for ev in events {
                                if let InputEventKind::Key(key) = ev.kind() {
                                    let down = ev.value() == 1;
                                    let held = ev.value() != 0;
                                    match key {
                                        Key::KEY_LEFTCTRL | Key::KEY_RIGHTCTRL => mods.ctrl.store(held, Ordering::Relaxed),
                                        Key::KEY_LEFTALT | Key::KEY_RIGHTALT => mods.alt.store(held, Ordering::Relaxed),
                                        Key::KEY_U if down && mods.both() => sink(Event::Escape),
                                        k if down => sink(Event::Swallowed { label: label(k) }),
                                        _ => {}
                                    }
                                }
                            }
                        }
                        Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                            std::thread::sleep(Duration::from_millis(10));
                        }
                        Err(_) => break, // device unplugged
                    }
                }
                let _ = dev.ungrab();
            })
        })
        .collect();

    Ok(Lock { stop, threads })
}
