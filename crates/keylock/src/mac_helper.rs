//! The macOS keyboard helper: a small root daemon that seizes keyboards on the app's behalf.
//!
//! Modelled on Karabiner-Elements' Core-Service (Unlicense):
//! * The helper is an app bundle, "Hushboard Keyboard Helper.app", signed with the identifier
//!   `app.hushboard.keyhelper`, so System Settings lists it by name. Release builds ship it
//!   pre-signed with the Developer ID inside the app (`Contents/Helpers`); other builds sign a
//!   copy of the app's own executable when installing.
//! * The same executable runs in two roles: as the root LaunchDaemon (`--keyhelper`) that seizes
//!   keyboards, and briefly as the logged-in user (`--keyhelper-request-access`, launched with
//!   `open`) to ask for Input Monitoring. Asking from the user's session is what makes macOS show
//!   its own prompt and list the helper; a root daemon can't prompt. The grant belongs to the
//!   bundle, so the daemon gets it too.
//! * The daemon watches for the grant and restarts itself once it arrives (launchd brings it
//!   back), so the user never has to restart anything.
//! * Installed once with the user's admin password (`--keyhelper-install`).
//! * Listens on a Unix socket. Only root and the user logged in at the console may connect.
//! * Speaks newline-delimited JSON. Requests: `status`, `lock {devices}`, `unlock`.
//!   Messages back: replies with `ok`, then events `key {label}`, `escape`, `released {reason}`.
//! * Safety: a lock lives only as long as the connection that made it (an app crash releases
//!   it), Ctrl + Alt + U releases it inside the helper, and no lock outlasts `MAX_LOCK`.

use crate::mac_hid::{self, HidLock};
use crate::{Error, Event, Keyboard, Kind};
use serde_json::{json, Value};
use std::io::{BufRead, BufReader, Write};
use std::os::unix::fs::PermissionsExt;
use std::os::unix::io::AsRawFd;
use std::os::unix::net::{UnixListener, UnixStream};
use std::path::Path;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

pub const LABEL: &str = "app.hushboard.keyhelper";
pub const SOCKET: &str = "/var/run/app.hushboard.keyhelper.sock";
pub const BUNDLE_PATH: &str = "/Library/PrivilegedHelperTools/Hushboard Keyboard Helper.app";
pub const BUNDLE_EXE: &str =
    "/Library/PrivilegedHelperTools/Hushboard Keyboard Helper.app/Contents/MacOS/hushboard-keyhelper";
/// Where version 1 and 2 installed a bare executable; removed on install.
const LEGACY_PATH: &str = "/Library/PrivilegedHelperTools/app.hushboard.keyhelper";
pub const PLIST_PATH: &str = "/Library/LaunchDaemons/app.hushboard.keyhelper.plist";
const EMBEDDED: &str = "Helpers/Hushboard Keyboard Helper.app";
/// Bump when the protocol or the helper's behaviour changes; the app then asks to update it.
/// 3: signed app bundle, prompts as the user, restarts on grant.
/// 4: user-side access check, `restart` command, refuses to lock without Input Monitoring.
/// 5: bundle built and signed by the app (stable "Hushboard Dev" identity when available).
/// 6: Developer ID signed helper shipped inside release builds.
pub const VERSION: u64 = 6;
const MAX_LOCK: Duration = Duration::from_secs(30 * 60);

/// One lock at a time across all connections.
static ACTIVE: AtomicBool = AtomicBool::new(false);
static GENERATION: AtomicU64 = AtomicU64::new(0);

// ---------------------------------------------------------------------------------------------
// Entry points (called from the app's main before anything else starts)
// ---------------------------------------------------------------------------------------------

pub fn main_from_args() -> Option<i32> {
    let args: Vec<String> = std::env::args().collect();
    let code = match args.get(1)?.as_str() {
        "--keyhelper" => run_daemon(),
        "--keyhelper-install" => match (args.get(2), args.get(3)) {
            (Some(src), Some(digest)) => report(install(src, digest)),
            _ => report(Err("usage: --keyhelper-install <staged bundle> <digest>".into())),
        },
        "--keyhelper-uninstall" => report(uninstall()),
        "--keyhelper-write-bundle" => match args.get(2) {
            Some(path) => report(write_bundle(Path::new(path)).map_err(|e| e.to_string())),
            None => report(Err("usage: --keyhelper-write-bundle <bundle path>".into())),
        },
        "--keyhelper-request-access" => {
            // Runs as the logged-in user inside the helper bundle: macOS shows its Input
            // Monitoring prompt and adds "Hushboard Keyboard Helper" to the list.
            mac_hid::request_access();
            std::thread::sleep(Duration::from_secs(2));
            0
        }
        "--keyhelper-check-access" => {
            // Runs as the logged-in user inside the helper bundle (launched with `open`), so the
            // answer is about the bundle's own grant. A root daemon can get "unknown" here.
            match args.get(2) {
                Some(path) => match std::fs::write(path, mac_hid::access()) {
                    Ok(()) => 0,
                    Err(_) => 1,
                },
                None => 1,
            }
        }
        _ => return None,
    };
    Some(code)
}

fn report(r: Result<(), String>) -> i32 {
    match r {
        Ok(()) => 0,
        Err(e) => {
            eprintln!("hushboard keyhelper: {e}");
            1
        }
    }
}

fn require_root() -> Result<(), String> {
    if unsafe { libc::geteuid() } == 0 {
        Ok(())
    } else {
        Err("must run as root".into())
    }
}

fn plist(program: &str) -> String {
    format!(
        r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>{LABEL}</string>
  <key>ProgramArguments</key>
  <array><string>{program}</string><string>--keyhelper</string></array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ProcessType</key><string>Interactive</string>
  <key>ThrottleInterval</key><integer>1</integer>
  <key>StandardErrorPath</key><string>/var/log/{LABEL}.log</string>
</dict>
</plist>
"#
    )
}

fn info_plist() -> String {
    format!(
        r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleIdentifier</key><string>{LABEL}</string>
  <key>CFBundleName</key><string>Hushboard Keyboard Helper</string>
  <key>CFBundleDisplayName</key><string>Hushboard Keyboard Helper</string>
  <key>CFBundleExecutable</key><string>hushboard-keyhelper</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>{VERSION}</string>
  <key>CFBundleVersion</key><string>{VERSION}</string>
  <key>LSUIElement</key><true/>
  <key>LSMinimumSystemVersion</key><string>11.0</string>
</dict>
</plist>
"#
    )
}

fn root_own(path: &Path, mode: u32) -> Result<(), String> {
    std::os::unix::fs::chown(path, Some(0), Some(0)).map_err(|e| format!("chown {}: {e}", path.display()))?;
    std::fs::set_permissions(path, std::fs::Permissions::from_mode(mode)).map_err(|e| e.to_string())
}

fn launchctl(args: &[&str]) -> std::process::Output {
    std::process::Command::new("/bin/launchctl")
        .args(args)
        .output()
        .expect("launchctl is part of macOS")
}

fn sha256_hex(path: &Path) -> Result<String, String> {
    use sha2::{Digest, Sha256};
    let mut file = std::fs::File::open(path).map_err(|e| format!("read {}: {e}", path.display()))?;
    let mut hasher = Sha256::new();
    std::io::copy(&mut file, &mut hasher).map_err(|e| e.to_string())?;
    Ok(hasher.finalize().iter().map(|b| format!("{b:02x}")).collect())
}

/// Every file in a bundle, as paths relative to it, sorted.
fn bundle_files(root: &Path) -> Result<Vec<std::path::PathBuf>, String> {
    fn walk(root: &Path, dir: &Path, out: &mut Vec<std::path::PathBuf>) -> Result<(), String> {
        for entry in std::fs::read_dir(dir).map_err(|e| format!("read {}: {e}", dir.display()))? {
            let entry = entry.map_err(|e| e.to_string())?;
            let kind = entry.file_type().map_err(|e| e.to_string())?;
            if kind.is_symlink() {
                return Err(format!("unexpected link in helper bundle: {}", entry.path().display()));
            } else if kind.is_dir() {
                walk(root, &entry.path(), out)?;
            } else {
                out.push(entry.path().strip_prefix(root).map_err(|e| e.to_string())?.to_path_buf());
            }
        }
        Ok(())
    }
    let mut out = Vec::new();
    walk(root, root, &mut out)?;
    out.sort();
    Ok(out)
}

/// One SHA-256 over every file's path and contents, so any change to the bundle shows.
fn bundle_digest(root: &Path) -> Result<String, String> {
    use sha2::{Digest, Sha256};
    let mut total = Sha256::new();
    for rel in bundle_files(root)? {
        total.update(rel.to_string_lossy().as_bytes());
        total.update([0]);
        total.update(sha256_hex(&root.join(&rel))?.as_bytes());
        total.update([0]);
    }
    Ok(total.finalize().iter().map(|b| format!("{b:02x}")).collect())
}

/// Runs as root. `src` is the signed helper bundle the app built in its temp folder (root
/// can't read the app where it lives if that's a protected folder such as Desktop). The bundle
/// is copied into a root-only folder and only installed if its digest there matches the one the
/// app computed and its signature verifies, so a swapped staging folder can't be installed.
fn install(src: &str, expected_digest: &str) -> Result<(), String> {
    require_root()?;
    let src = Path::new(src);
    let _ = launchctl(&["bootout", &format!("system/{LABEL}")]);
    std::thread::sleep(Duration::from_millis(300));

    std::fs::create_dir_all("/Library/PrivilegedHelperTools").map_err(|e| e.to_string())?;
    let building = Path::new("/Library/PrivilegedHelperTools/.hushboard-keyhelper-build");
    let _ = std::fs::remove_dir_all(building);
    std::fs::create_dir(building).map_err(|e| e.to_string())?;
    root_own(building, 0o700)?;
    let bundle = building.join("Hushboard Keyboard Helper.app");

    let fail = |msg: String| {
        let _ = std::fs::remove_dir_all(building);
        Err(msg)
    };

    // Copy file by file, owned by root (copies otherwise keep the user as owner).
    for rel in bundle_files(src)? {
        let to = bundle.join(&rel);
        if let Some(parent) = to.parent() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        std::fs::copy(src.join(&rel), &to).map_err(|e| format!("copy {}: {e}", rel.display()))?;
        let exec = rel.starts_with("Contents/MacOS");
        root_own(&to, if exec { 0o755 } else { 0o644 })?;
    }
    for dir in bundle_files(&bundle)?.iter().filter_map(|f| f.parent().map(Path::to_path_buf)) {
        let mut d = bundle.join(&dir);
        while d.starts_with(&bundle) {
            root_own(&d, 0o755)?;
            if !d.pop() {
                break;
            }
        }
    }

    if !bundle_digest(&bundle)?.eq_ignore_ascii_case(expected_digest) {
        return fail("the staged helper doesn't match what the app built; nothing was installed".into());
    }
    let verified = std::process::Command::new("/usr/bin/codesign")
        .args(["--verify", "--strict"])
        .arg(&bundle)
        .output()
        .map_err(|e| format!("codesign: {e}"))?;
    if !verified.status.success() {
        return fail(format!("the helper's signature didn't verify: {}", String::from_utf8_lossy(&verified.stderr).trim()));
    }

    let _ = std::fs::remove_dir_all(BUNDLE_PATH);
    std::fs::rename(&bundle, BUNDLE_PATH).map_err(|e| e.to_string())?;
    let _ = std::fs::remove_dir_all(building);
    let _ = std::fs::remove_file(LEGACY_PATH);

    std::fs::write(PLIST_PATH, plist(BUNDLE_EXE)).map_err(|e| format!("write plist: {e}"))?;
    root_own(Path::new(PLIST_PATH), 0o644)?;

    let out = launchctl(&["bootstrap", "system", PLIST_PATH]);
    if !out.status.success() {
        return Err(format!("launchctl bootstrap failed: {}", String::from_utf8_lossy(&out.stderr).trim()));
    }
    Ok(())
}

fn uninstall() -> Result<(), String> {
    require_root()?;
    let _ = launchctl(&["bootout", &format!("system/{LABEL}")]);
    for p in [PLIST_PATH, LEGACY_PATH, SOCKET] {
        if Path::new(p).exists() {
            std::fs::remove_file(p).map_err(|e| format!("remove {p}: {e}"))?;
        }
    }
    if Path::new(BUNDLE_PATH).exists() {
        std::fs::remove_dir_all(BUNDLE_PATH).map_err(|e| format!("remove {BUNDLE_PATH}: {e}"))?;
    }
    Ok(())
}

// ---------------------------------------------------------------------------------------------
// Daemon
// ---------------------------------------------------------------------------------------------

fn run_daemon() -> i32 {
    if let Err(e) = require_root() {
        eprintln!("hushboard keyhelper: {e}");
        return 1;
    }
    // Not allowed yet? Watch for the grant and restart when it lands, so seizing starts from a
    // clean process (as Karabiner does). launchd's KeepAlive starts us again within a second.
    if mac_hid::access() != "granted" {
        std::thread::spawn(|| loop {
            std::thread::sleep(Duration::from_secs(1));
            if mac_hid::access() == "granted" {
                eprintln!("hushboard keyhelper: Input Monitoring granted, restarting");
                std::process::exit(0);
            }
        });
    }

    let _ = std::fs::remove_file(SOCKET);
    let listener = match UnixListener::bind(SOCKET) {
        Ok(l) => l,
        Err(e) => {
            eprintln!("hushboard keyhelper: bind {SOCKET}: {e}");
            return 1;
        }
    };
    // Anyone may connect; each connection is then checked against the console user.
    let _ = std::fs::set_permissions(SOCKET, std::fs::Permissions::from_mode(0o666));
    eprintln!("hushboard keyhelper v{VERSION} listening on {SOCKET}");

    for stream in listener.incoming().flatten() {
        std::thread::spawn(move || {
            if let Err(e) = serve(stream) {
                eprintln!("hushboard keyhelper: connection ended: {e}");
            }
        });
    }
    0
}

fn console_uid() -> Option<u32> {
    let mut st: libc::stat = unsafe { std::mem::zeroed() };
    let path = c"/dev/console";
    (unsafe { libc::stat(path.as_ptr(), &mut st) } == 0).then_some(st.st_uid)
}

fn peer_allowed(stream: &UnixStream) -> bool {
    let (mut uid, mut gid) = (0 as libc::uid_t, 0 as libc::gid_t);
    if unsafe { libc::getpeereid(stream.as_raw_fd(), &mut uid, &mut gid) } != 0 {
        return false;
    }
    uid == 0 || Some(uid) == console_uid()
}

type Writer = Arc<Mutex<UnixStream>>;

fn send(writer: &Writer, msg: Value) {
    if let Ok(mut w) = writer.lock() {
        let _ = writeln!(w, "{msg}");
    }
}

/// A seized lock that clears the global flag when released.
struct Active {
    _lock: HidLock,
}

impl Drop for Active {
    fn drop(&mut self) {
        ACTIVE.store(false, Ordering::SeqCst);
    }
}

type Slot = Arc<Mutex<Option<Active>>>;

/// Release on a fresh thread: the HID thread can't join itself.
fn release_async(slot: &Slot, writer: &Writer, reason: &'static str) {
    let slot = slot.clone();
    let writer = writer.clone();
    std::thread::spawn(move || {
        let had = slot.lock().map(|mut s| s.take().is_some()).unwrap_or(false);
        if had {
            send(&writer, json!({ "event": "released", "reason": reason }));
        }
    });
}

fn keyboards_json() -> Value {
    Value::Array(
        mac_hid::keyboards()
            .into_iter()
            .map(|k| json!({ "id": k.id, "name": k.name, "kind": k.kind.as_str() }))
            .collect(),
    )
}

fn serve(stream: UnixStream) -> std::io::Result<()> {
    let writer: Writer = Arc::new(Mutex::new(stream.try_clone()?));
    if !peer_allowed(&stream) {
        send(&writer, json!({ "ok": false, "code": "forbidden", "error": "only the logged-in user may use the keyboard helper" }));
        return Ok(());
    }
    let slot: Slot = Arc::new(Mutex::new(None));
    let reader = BufReader::new(stream);

    for line in reader.lines() {
        let line = line?;
        let req: Value = match serde_json::from_str(&line) {
            Ok(v) => v,
            Err(_) => {
                send(&writer, json!({ "ok": false, "error": "bad request" }));
                continue;
            }
        };
        match req["cmd"].as_str().unwrap_or("") {
            "status" => send(
                &writer,
                json!({ "ok": true, "version": VERSION, "access": mac_hid::access(), "keyboards": keyboards_json() }),
            ),
            "restart" => {
                // Asked by the app when the user has granted Input Monitoring but this process
                // started before that. launchd starts us again within a second.
                if ACTIVE.load(Ordering::SeqCst) {
                    send(&writer, json!({ "ok": false, "code": "busy", "error": "the keyboard is locked" }));
                } else {
                    send(&writer, json!({ "ok": true }));
                    eprintln!("hushboard keyhelper: restart requested");
                    std::thread::spawn(|| {
                        std::thread::sleep(Duration::from_millis(100));
                        std::process::exit(0);
                    });
                }
            }
            "lock" => {
                // Without Input Monitoring, IOKit can accept a seize that then holds nothing, and
                // keys keep flowing. Refuse instead of pretending, and restart to pick up a grant
                // that arrived after this process started.
                if mac_hid::access() != "granted" {
                    send(&writer, json!({
                        "ok": false,
                        "code": "permission",
                        "error": "the keyboard helper isn't allowed in Input Monitoring yet (if you just switched it on, try again in a few seconds)"
                    }));
                    if !ACTIVE.load(Ordering::SeqCst) {
                        std::thread::spawn(|| {
                            std::thread::sleep(Duration::from_millis(200));
                            std::process::exit(0);
                        });
                    }
                    continue;
                }
                if ACTIVE.swap(true, Ordering::SeqCst) {
                    send(&writer, json!({ "ok": false, "code": "busy", "error": "the keyboard is already locked" }));
                    continue;
                }
                let devices: Vec<String> = req["devices"]
                    .as_array()
                    .map(|a| a.iter().filter_map(|v| v.as_str().map(String::from)).collect())
                    .unwrap_or_default();
                let (w, s) = (writer.clone(), slot.clone());
                let sink = Arc::new(move |event: Event| match event {
                    Event::Swallowed { label } => send(&w, json!({ "event": "key", "label": label })),
                    Event::Escape => {
                        send(&w, json!({ "event": "escape" }));
                        release_async(&s, &w, "escape");
                    }
                });
                match mac_hid::seize(&devices, sink) {
                    Ok(lock) => {
                        let generation = GENERATION.fetch_add(1, Ordering::SeqCst) + 1;
                        *slot.lock().unwrap() = Some(Active { _lock: lock });
                        send(&writer, json!({ "ok": true, "event": "locked" }));
                        // Hard cap, whatever the app asked for.
                        let (s, w) = (slot.clone(), writer.clone());
                        std::thread::spawn(move || {
                            std::thread::sleep(MAX_LOCK);
                            if GENERATION.load(Ordering::SeqCst) == generation {
                                release_async(&s, &w, "time limit");
                            }
                        });
                    }
                    Err(e) => {
                        ACTIVE.store(false, Ordering::SeqCst);
                        let code = if matches!(e, Error::PermissionDenied(_)) { "permission" } else { "error" };
                        send(&writer, json!({ "ok": false, "code": code, "error": e.to_string() }));
                    }
                }
            }
            "unlock" => {
                let had = slot.lock().unwrap().take().is_some();
                send(&writer, json!({ "ok": true, "event": if had { "released" } else { "idle" } }));
            }
            _ => send(&writer, json!({ "ok": false, "error": "unknown command" })),
        }
    }
    // Connection closed (app quit or crashed): release.
    slot.lock().unwrap().take();
    Ok(())
}

// ---------------------------------------------------------------------------------------------
// Client (used by the app)
// ---------------------------------------------------------------------------------------------

#[derive(Debug, Clone)]
pub enum HelperStatus {
    Missing,
    NeedsApproval,
    Outdated,
    Ready(Vec<Keyboard>),
}

fn connect() -> Option<UnixStream> {
    let s = UnixStream::connect(SOCKET).ok()?;
    s.set_read_timeout(Some(Duration::from_secs(3))).ok()?;
    Some(s)
}

fn request(stream: &mut UnixStream, msg: Value) -> Result<Value, Error> {
    writeln!(stream, "{msg}").map_err(|e| Error::Os(format!("keyboard helper: {e}")))?;
    let mut line = String::new();
    BufReader::new(stream.try_clone().map_err(|e| Error::Os(e.to_string()))?)
        .read_line(&mut line)
        .map_err(|e| Error::Os(format!("keyboard helper didn't answer: {e}")))?;
    serde_json::from_str(&line).map_err(|_| Error::Os("keyboard helper sent a bad reply".into()))
}

/// Connect, waiting up to ~2 s when the helper is installed but mid-restart (it restarts once
/// Input Monitoring is granted).
fn connect_installed() -> Option<UnixStream> {
    if let Some(s) = connect() {
        return Some(s);
    }
    if !Path::new(PLIST_PATH).exists() {
        return None;
    }
    for _ in 0..10 {
        std::thread::sleep(Duration::from_millis(200));
        if let Some(s) = connect() {
            return Some(s);
        }
    }
    None
}

/// Ask macOS, as the logged-in user and under the helper bundle's identity, whether Input
/// Monitoring is granted. Launches the bundle with `open` (so it is its own responsible process)
/// and reads back what it wrote. `None` if the check couldn't run.
fn user_side_access() -> Option<String> {
    static COUNTER: AtomicU64 = AtomicU64::new(0);
    let path = std::env::temp_dir().join(format!(
        "hushboard-access-{}-{}.txt",
        std::process::id(),
        COUNTER.fetch_add(1, Ordering::Relaxed)
    ));
    let _ = std::fs::remove_file(&path);
    // Don't use `open -W`: the check exits so fast that `open` loses track of it. Like
    // Karabiner, launch it and wait (up to 5 s) for the result file instead.
    let launched = std::process::Command::new("/usr/bin/open")
        .args(["-n", "-g", "-a", BUNDLE_PATH, "--args", "--keyhelper-check-access"])
        .arg(&path)
        .status()
        .ok()?;
    if !launched.success() {
        return None;
    }
    for _ in 0..50 {
        std::thread::sleep(Duration::from_millis(100));
        if let Ok(answer) = std::fs::read_to_string(&path) {
            if !answer.trim().is_empty() {
                let _ = std::fs::remove_file(&path);
                return Some(answer.trim().to_string());
            }
        }
    }
    let _ = std::fs::remove_file(&path);
    None
}

/// Ask the daemon to restart, at most once every 10 s. Returns whether it agreed.
fn restart_daemon(stream: &mut UnixStream) -> bool {
    static LAST: Mutex<Option<std::time::Instant>> = Mutex::new(None);
    {
        let mut last = LAST.lock().unwrap();
        if last.is_some_and(|t| t.elapsed() < Duration::from_secs(10)) {
            return false;
        }
        *last = Some(std::time::Instant::now());
    }
    let ok = matches!(request(stream, json!({ "cmd": "restart" })), Ok(r) if r["ok"] == true);
    if ok {
        // Let the old process exit before connect_installed() waits for the new one.
        std::thread::sleep(Duration::from_millis(400));
    }
    ok
}

/// Quick check: one round-trip to the daemon (plus a user-side check only while the daemon
/// doesn't report a grant).
pub fn status() -> HelperStatus {
    status_with(false)
}

/// `thorough` also asks from the user's side when the daemon says "granted". A long-running
/// root process can keep reporting a grant the user has since switched off (Karabiner restarts
/// its agent for the same reason), so this is how a revoked permission is noticed.
pub fn status_with(thorough: bool) -> HelperStatus {
    let Some(mut s) = connect_installed() else { return HelperStatus::Missing };
    let Ok(mut reply) = request(&mut s, json!({ "cmd": "status" })) else { return HelperStatus::Missing };
    if reply["version"].as_u64() != Some(VERSION) {
        return HelperStatus::Outdated;
    }
    let daemon_granted = reply["access"].as_str() == Some("granted");

    if daemon_granted {
        if thorough {
            // Some("denied"/"unknown"): switched off since the daemon started. Restart it so it
            // stops believing otherwise. None: the check couldn't run, trust the daemon.
            if let Some(user) = user_side_access() {
                if user != "granted" {
                    restart_daemon(&mut s);
                    return HelperStatus::NeedsApproval;
                }
            }
        }
    } else {
        // Before a grant, a root process can get "unknown" even after the user switched it on,
        // so ask from the user's side (as Karabiner does). If the user has granted it but the
        // daemon hasn't caught up, restart the daemon so a fresh process picks the grant up.
        if user_side_access().as_deref() != Some("granted") {
            return HelperStatus::NeedsApproval;
        }
        if !restart_daemon(&mut s) {
            return HelperStatus::NeedsApproval;
        }
        let Some(mut fresh) = connect_installed() else { return HelperStatus::NeedsApproval };
        match request(&mut fresh, json!({ "cmd": "status" })) {
            Ok(r) if r["access"].as_str() == Some("granted") => reply = r,
            _ => return HelperStatus::NeedsApproval,
        }
    }
    let keyboards = reply["keyboards"]
        .as_array()
        .map(|a| {
            a.iter()
                .map(|k| Keyboard {
                    id: k["id"].as_str().unwrap_or_default().to_string(),
                    name: k["name"].as_str().unwrap_or("Keyboard").to_string(),
                    kind: match k["kind"].as_str() {
                        Some("built-in") => Kind::BuiltIn,
                        Some("usb") => Kind::Usb,
                        Some("bluetooth") => Kind::Bluetooth,
                        _ => Kind::Other,
                    },
                })
                .collect()
        })
        .unwrap_or_default();
    HelperStatus::Ready(keyboards)
}

/// A lock held through the helper. Dropping the connection releases it.
pub struct HelperLock {
    stream: Option<UnixStream>,
    reader: Option<std::thread::JoinHandle<()>>,
}

impl HelperLock {
    pub fn release(&mut self) {
        if let Some(mut s) = self.stream.take() {
            let _ = writeln!(s, "{}", json!({ "cmd": "unlock" }));
            let _ = s.shutdown(std::net::Shutdown::Both);
        }
        if let Some(t) = self.reader.take() {
            if t.thread().id() != std::thread::current().id() {
                let _ = t.join();
            }
        }
    }
}

pub fn lock(device_ids: &[String], sink: crate::Sink) -> Result<HelperLock, Error> {
    let mut stream = connect_installed().ok_or_else(|| Error::Os("the keyboard helper isn't running".into()))?;
    let reply = request(&mut stream, json!({ "cmd": "lock", "devices": device_ids }))?;
    if reply["ok"].as_bool() != Some(true) {
        let msg = reply["error"].as_str().unwrap_or("the keyboard helper refused").to_string();
        return Err(if reply["code"] == "permission" { Error::PermissionDenied(msg) } else { Error::Os(msg) });
    }
    // Events can take as long as the lock lasts.
    stream.set_read_timeout(None).map_err(|e| Error::Os(e.to_string()))?;
    let read_half = stream.try_clone().map_err(|e| Error::Os(e.to_string()))?;
    let reader = std::thread::Builder::new()
        .name("keylock-helper".into())
        .spawn(move || {
            for line in BufReader::new(read_half).lines() {
                let Ok(line) = line else { break };
                let Ok(msg) = serde_json::from_str::<Value>(&line) else { continue };
                match msg["event"].as_str() {
                    Some("key") => sink(Event::Swallowed { label: msg["label"].as_str().unwrap_or("·").into() }),
                    Some("escape") => sink(Event::Escape),
                    // The helper let go on its own (time limit): end the lock in the app too.
                    Some("released") if msg["reason"] == "time limit" => sink(Event::Escape),
                    _ => {}
                }
            }
        })
        .map_err(|e| Error::Os(e.to_string()))?;
    Ok(HelperLock { stream: Some(stream), reader: Some(reader) })
}

// ---------------------------------------------------------------------------------------------
// Install / uninstall from the app (asks for the admin password)
// ---------------------------------------------------------------------------------------------

fn sh_quote(s: &str) -> String {
    format!("'{}'", s.replace('\'', r"'\''"))
}

fn applescript_string(s: &str) -> String {
    s.replace('\\', r"\\").replace('"', "\\\"")
}

fn run_as_admin(args: &[&str], prompt: &str) -> Result<(), Error> {
    let exe = std::env::current_exe().map_err(|e| Error::Os(e.to_string()))?;
    let mut shell = sh_quote(&exe.to_string_lossy());
    for a in args {
        shell.push(' ');
        shell.push_str(&sh_quote(a));
    }
    let script = format!(
        "do shell script \"{}\" with administrator privileges with prompt \"{}\"",
        applescript_string(&shell),
        applescript_string(prompt)
    );
    let out = std::process::Command::new("/usr/bin/osascript")
        .args(["-e", &script])
        .output()
        .map_err(|e| Error::Os(e.to_string()))?;
    if out.status.success() {
        return Ok(());
    }
    let err = String::from_utf8_lossy(&out.stderr);
    if err.contains("-128") || err.contains("User canceled") {
        Err(Error::Os("cancelled".into()))
    } else {
        Err(Error::Os(err.trim().to_string()))
    }
}

/// The signing identity for the helper bundle, in order of preference:
/// `HUSHBOARD_SIGN_IDENTITY` (e.g. a Developer ID for releases), then a local "Hushboard Dev"
/// certificate, then ad-hoc ("-"). A real certificate gives the helper a designated requirement
/// that survives rebuilds, so macOS keeps the Input Monitoring grant across updates; ad-hoc
/// signatures change with every build and macOS asks again.
fn signing_identity() -> String {
    if let Ok(id) = std::env::var("HUSHBOARD_SIGN_IDENTITY") {
        if !id.trim().is_empty() {
            return id;
        }
    }
    let found = std::process::Command::new("/usr/bin/security")
        .args(["find-identity", "-p", "codesigning"])
        .output()
        .map(|o| String::from_utf8_lossy(&o.stdout).contains("\"Hushboard Dev\""))
        .unwrap_or(false);
    if found { "Hushboard Dev".into() } else { "-".into() }
}

fn write_bundle(bundle: &Path) -> std::io::Result<()> {
    let exe = std::env::current_exe()?;
    let _ = std::fs::remove_dir_all(bundle);
    std::fs::create_dir_all(bundle.join("Contents/MacOS"))?;
    std::fs::copy(&exe, bundle.join("Contents/MacOS/hushboard-keyhelper"))?;
    std::fs::write(bundle.join("Contents/Info.plist"), info_plist())
}

fn embedded_bundle_for(exe: &Path) -> Option<std::path::PathBuf> {
    let bundle = exe.parent()?.parent()?.join(EMBEDDED);
    bundle.is_dir().then_some(bundle)
}

fn developer_signed(bundle: &Path) -> bool {
    std::process::Command::new("/usr/bin/codesign")
        .args(["--verify", "--strict", &format!("-R=anchor apple generic and identifier \"{LABEL}\"")])
        .arg(bundle)
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

fn copy_bundle(src: &Path, dst: &Path) -> Result<(), String> {
    for rel in bundle_files(src)? {
        let to = dst.join(&rel);
        if let Some(parent) = to.parent() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        std::fs::copy(src.join(&rel), &to).map_err(|e| format!("copy {}: {e}", rel.display()))?;
    }
    Ok(())
}

fn stage_bundle(staging_root: &Path) -> Result<std::path::PathBuf, Error> {
    let _ = std::fs::remove_dir_all(staging_root);
    let bundle = staging_root.join("Hushboard Keyboard Helper.app");
    let embedded = std::env::current_exe()
        .ok()
        .and_then(|exe| embedded_bundle_for(&exe))
        .filter(|b| developer_signed(b));
    if let Some(embedded) = embedded {
        copy_bundle(&embedded, &bundle).map_err(Error::Os)?;
        return Ok(bundle);
    }
    build_signed_bundle(&bundle)?;
    Ok(bundle)
}

/// Build and sign a helper bundle from the running executable (as the user, who has the signing
/// key).
fn build_signed_bundle(bundle: &Path) -> Result<(), Error> {
    let os = |e: std::io::Error| Error::Os(e.to_string());
    write_bundle(bundle).map_err(os)?;

    let identity = signing_identity();
    let signed = std::process::Command::new("/usr/bin/codesign")
        .args(["--force", "--sign", &identity, "--identifier", LABEL])
        .arg(bundle)
        .output()
        .map_err(os)?;
    if !signed.status.success() {
        return Err(Error::Os(format!(
            "couldn't sign the helper with \"{identity}\": {}",
            String::from_utf8_lossy(&signed.stderr).trim()
        )));
    }
    Ok(())
}

pub fn install_from_app() -> Result<(), Error> {
    let staging_root = std::env::temp_dir().join(format!("hushboard-keyhelper-{}", std::process::id()));
    let result = stage_bundle(&staging_root).and_then(|bundle| {
        let digest = bundle_digest(&bundle).map_err(Error::Os)?;
        run_as_admin(
            &["--keyhelper-install", &bundle.to_string_lossy(), &digest],
            "Hushboard wants to install its keyboard helper so it can lock the keyboard hardware.",
        )
    });
    let _ = std::fs::remove_dir_all(&staging_root);
    result?;
    // Give launchd a moment to start it.
    for _ in 0..20 {
        if connect().is_some() {
            if !matches!(status(), HelperStatus::Ready(_)) {
                request_access_from_app();
            }
            return Ok(());
        }
        std::thread::sleep(Duration::from_millis(150));
    }
    Err(Error::Os("the keyboard helper was installed but didn't start".into()))
}

/// Launch the helper bundle as the logged-in user to ask for Input Monitoring. macOS then shows
/// its own prompt ("Hushboard Keyboard Helper would like to receive keystrokes…") and lists the
/// helper in System Settings, ready to switch on.
pub fn request_access_from_app() {
    let _ = std::process::Command::new("/usr/bin/open")
        .args(["-n", "-g", "-a", BUNDLE_PATH, "--args", "--keyhelper-request-access"])
        .status();
}

pub fn uninstall_from_app() -> Result<(), Error> {
    run_as_admin(&["--keyhelper-uninstall"], "Hushboard wants to remove its keyboard helper.")
}

pub fn open_input_monitoring() {
    let _ = std::process::Command::new("/usr/bin/open")
        .arg("x-apple.systempreferences:com.apple.preference.security?Privacy_ListenEvent")
        .status();
}

#[cfg(test)]
mod tests {
    use super::*;

    fn scratch(name: &str) -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!("keylock-test-{name}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn finds_the_embedded_helper_next_to_the_app_executable() {
        let root = scratch("embedded");
        let contents = root.join("Hushboard.app/Contents");
        std::fs::create_dir_all(contents.join("MacOS")).unwrap();
        let exe = contents.join("MacOS/hushboard");
        assert_eq!(embedded_bundle_for(&exe), None);

        std::fs::create_dir_all(contents.join(EMBEDDED)).unwrap();
        assert_eq!(embedded_bundle_for(&exe), Some(contents.join(EMBEDDED)));
        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn copied_bundle_keeps_every_file_and_the_executable_bit() {
        let root = scratch("copy");
        let src = root.join("src.app");
        std::fs::create_dir_all(src.join("Contents/MacOS")).unwrap();
        std::fs::create_dir_all(src.join("Contents/_CodeSignature")).unwrap();
        std::fs::write(src.join("Contents/Info.plist"), info_plist()).unwrap();
        std::fs::write(src.join("Contents/_CodeSignature/CodeResources"), "seal").unwrap();
        let exe = src.join("Contents/MacOS/hushboard-keyhelper");
        std::fs::write(&exe, "binary").unwrap();
        std::fs::set_permissions(&exe, std::fs::Permissions::from_mode(0o755)).unwrap();

        let dst = root.join("dst.app");
        copy_bundle(&src, &dst).unwrap();
        assert_eq!(bundle_digest(&src).unwrap(), bundle_digest(&dst).unwrap());
        let mode = std::fs::metadata(dst.join("Contents/MacOS/hushboard-keyhelper")).unwrap().permissions().mode();
        assert_eq!(mode & 0o111, 0o111);
        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn ad_hoc_bundles_are_not_treated_as_developer_signed() {
        let root = scratch("adhoc");
        let bundle = root.join("Hushboard Keyboard Helper.app");
        std::fs::create_dir_all(bundle.join("Contents/MacOS")).unwrap();
        std::fs::copy("/usr/bin/true", bundle.join("Contents/MacOS/hushboard-keyhelper")).unwrap();
        std::fs::write(bundle.join("Contents/Info.plist"), info_plist()).unwrap();
        let signed = std::process::Command::new("/usr/bin/codesign")
            .args(["--force", "--sign", "-", "--identifier", LABEL])
            .arg(&bundle)
            .status()
            .unwrap();
        assert!(signed.success());
        assert!(!developer_signed(&bundle));
        let _ = std::fs::remove_dir_all(root);
    }
}
