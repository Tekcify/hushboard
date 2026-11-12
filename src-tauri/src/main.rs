// Hide the console window on Windows release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // macOS: the same executable doubles as the root keyboard helper (`--keyhelper…`).
    if let Some(code) = keylock::helper_main() {
        std::process::exit(code);
    }
    hushboard_lib::run()
}
