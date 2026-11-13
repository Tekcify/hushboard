// Thin wrapper over the Rust commands. Outside Tauri (plain `npm run dev` in a browser) it falls
// back to an in-page simulation, so the UI can be designed and reviewed without locking anything.
import type { UnlistenFn } from "@tauri-apps/api/event";

export type Phase = "idle" | "arming" | "locked";

export interface LockState {
  phase: Phase;
  armingMsLeft: number | null;
  remainingMs: number | null;
  totalMs: number | null;
  /** Key presses dropped during the current or last lock (a count; nothing typed is kept). */
  keysIgnored: number;
  error: string | null;
}

export type PermissionStatus = "granted" | "denied" | "not-needed";

export interface Permissions {
  platform: string;
  accessibility: PermissionStatus;
  inputMonitoring: PermissionStatus;
  inputDevices: PermissionStatus;
  /** macOS keyboard helper (hardware lock). */
  helper: "not-needed" | "missing" | "needs-approval" | "outdated" | "ready";
  /** macOS: the app holding Secure Input while it blocks the no-helper fallback. */
  secureInputHolder: string | null;
  /** Everything needed to lock right now is in place. */
  allGranted: boolean;
}

export interface SystemState {
  permissions: Permissions;
  keyboards: Keyboard[];
}

export interface UpdateInfo {
  version: string;
  currentVersion: string;
  notes: string | null;
}

// Browser preview: ?update=1 shows the update card.
const simUpdate: UpdateInfo | null =
  typeof location !== "undefined" && new URLSearchParams(location.search).has("update")
    ? { version: "0.1.0-beta.2", currentVersion: "0.1.0-beta.1", notes: "Fixes and improvements." }
    : null;

export interface Keyboard {
  id: string;
  name: string;
  kind: "built-in" | "usb" | "bluetooth" | "other" | "all";
}

export interface StartOptions {
  durationSecs: number | null;
  armDelayMs: number;
  deviceIds: string[];
  /** Cover every screen while locked instead of showing the small island. */
  coverScreen: boolean;
}

export const inTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

async function call<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(cmd, args);
}

async function on<T>(event: string, cb: (payload: T) => void): Promise<UnlistenFn> {
  const { listen } = await import("@tauri-apps/api/event");
  return listen<T>(event, (e) => cb(e.payload));
}

// ---------- browser simulation ----------
const sim = (() => {
  const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("hushboard-sim") : null;
  const listeners = new Set<(s: LockState) => void>();
  const keyListeners = new Set<(label: string) => void>();
  let state: LockState = { phase: "idle", armingMsLeft: null, remainingMs: null, totalMs: null, keysIgnored: 0, error: null };
  let timer: number | undefined;
  let armUntil = 0;
  let lockedAt = 0;

  const SAVED = "hushboard.sim.v1";
  const publish = (s: LockState, broadcast = true) => {
    // Keep the simulated lock across page loads, so overlay.html opened alone still counts down.
    try {
      if (s.phase === "locked") localStorage.setItem(SAVED, JSON.stringify({ totalMs: s.totalMs, lockedAt }));
      else localStorage.removeItem(SAVED);
    } catch {
      /* storage unavailable */
    }
    state = s;
    listeners.forEach((l) => l(s));
    if (broadcast) channel?.postMessage({ type: "state", state: s });
  };
  channel?.addEventListener("message", (e) => {
    if (e.data?.type === "state") publish(e.data.state, false);
    if (e.data?.type === "unlock") stop();
  });

  const tick = () => {
    const now = Date.now();
    if (state.phase === "arming") {
      if (now >= armUntil) {
        lockedAt = now;
        publish({ ...state, phase: "locked", armingMsLeft: null, remainingMs: state.totalMs });
        window.open("overlay.html", "hushboard-overlay");
      } else publish({ ...state, armingMsLeft: armUntil - now });
    } else if (state.phase === "locked" && state.totalMs != null) {
      const left = state.totalMs - (now - lockedAt);
      if (left <= 0) stop();
      else publish({ ...state, remainingMs: left });
    }
  };
  function stop() {
    window.clearInterval(timer);
    publish({ phase: "idle", armingMsLeft: null, remainingMs: null, totalMs: null, keysIgnored: state.keysIgnored, error: null });
  }

  if (!inTauri && typeof window !== "undefined") {
    try {
      const saved = JSON.parse(localStorage.getItem(SAVED) ?? "null") as { totalMs: number | null; lockedAt: number } | null;
      if (saved && (saved.totalMs == null || Date.now() - saved.lockedAt < saved.totalMs)) {
        lockedAt = saved.lockedAt;
        state = { phase: "locked", armingMsLeft: null, totalMs: saved.totalMs, keysIgnored: 0, error: null,
          remainingMs: saved.totalMs == null ? null : saved.totalMs - (Date.now() - lockedAt) };
        timer = window.setInterval(tick, 200);
      }
    } catch {
      /* storage unavailable */
    }
  }

  // Simulated swallowed keys: real key presses in the overlay page.
  if (typeof window !== "undefined") {
    window.addEventListener("keydown", (e) => {
      if (state.phase !== "locked") return;
      e.preventDefault();
      if (e.ctrlKey && e.altKey && e.code === "KeyU") return channel?.postMessage({ type: "unlock" }), stop();
      const label = e.key === " " ? "space" : e.key === "Enter" ? "⏎" : e.key.length === 1 ? e.key.toUpperCase() : "·";
      keyListeners.forEach((l) => l(label));
    });
  }

  return {
    get: () => state,
    start(o: StartOptions) {
      armUntil = Date.now() + o.armDelayMs;
      const totalMs = o.durationSecs == null ? null : o.durationSecs * 1000;
      publish({ phase: "arming", armingMsLeft: o.armDelayMs, remainingMs: null, totalMs, keysIgnored: 0, error: null });
      window.clearInterval(timer);
      timer = window.setInterval(tick, 200);
      return state;
    },
    unlock() {
      channel?.postMessage({ type: "unlock" });
      stop();
    },
    onState(cb: (s: LockState) => void) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    onKey(cb: (label: string) => void) {
      keyListeners.add(cb);
      return () => keyListeners.delete(cb);
    },
  };
})();

// Browser simulation's system state. Append ?helper=needs-approval (or missing, outdated, ready)
// and/or &secure=loginwindow to the URL to preview each card. &app=denied takes away the app's
// own Accessibility and Input Monitoring (a fresh install that only set up the helper).
const simParams = typeof location !== "undefined" ? new URLSearchParams(location.search) : new URLSearchParams();
const simHelper = (simParams.get("helper") as Permissions["helper"] | null) ?? "ready";
const simSecure = simParams.get("secure");
const simApp = simParams.get("app") === "denied" ? "denied" : "granted";
const simSystem: SystemState = {
  permissions: {
    platform: "macos",
    accessibility: simApp,
    inputMonitoring: simApp,
    inputDevices: "not-needed",
    helper: simHelper,
    secureInputHolder: simHelper === "ready" ? null : simSecure,
    allGranted: simHelper === "ready" || (simHelper === "missing" && !simSecure && simApp === "granted"),
  },
  keyboards:
    simHelper === "ready"
      ? [
          { id: "hid:05ac:0341:0000002b", name: "Apple Internal Keyboard", kind: "built-in" },
          { id: "hid:046d:b36a:00000000", name: "MX Keys", kind: "bluetooth" },
        ]
      : [{ id: "all", name: "All keyboards", kind: "all" }],
};

// ---------- public API ----------
export const api = {
  getState: (): Promise<LockState> => (inTauri ? call("get_state") : Promise.resolve(sim.get())),

  /** Permissions + keyboards now. `thorough` also re-verifies the helper's permission (slower). */
  refreshSystem: (thorough: boolean): Promise<SystemState> =>
    inTauri ? call("refresh_system", { thorough }) : Promise.resolve(simSystem),

  /** Fires whenever permissions, keyboards or Secure Input change (checked every 2 s while idle). */
  onSystem: async (cb: (s: SystemState) => void): Promise<() => void> =>
    inTauri ? on<SystemState>("system-changed", cb) : () => {},

  permissions: (): Promise<Permissions> =>
    inTauri ? call("permissions") : Promise.resolve(simSystem.permissions),

  requestPermissions: (): Promise<void> => (inTauri ? call("request_permissions") : Promise.resolve()),

  /** Shows the macOS admin-password prompt; rejects with "cancelled" if the user cancels. */
  installHelper: (): Promise<void> => (inTauri ? call("install_helper") : Promise.resolve()),

  uninstallHelper: (): Promise<void> => (inTauri ? call("uninstall_helper") : Promise.resolve()),

  openHelperSettings: (): Promise<void> => (inTauri ? call("open_helper_settings") : Promise.resolve()),

  /** Shows macOS's Input Monitoring prompt for the helper again. */
  requestHelperAccess: (): Promise<void> => (inTauri ? call("request_helper_access") : Promise.resolve()),

  keyboards: (): Promise<Keyboard[]> => (inTauri ? call("list_keyboards") : Promise.resolve(simSystem.keyboards)),

  startLock: (o: StartOptions): Promise<LockState> => (inTauri ? call("start_lock", { ...o }) : Promise.resolve(sim.start(o))),

  unlock: (): Promise<void> => (inTauri ? call("unlock") : Promise.resolve(sim.unlock())),

  /** Keyboards and screen choice for locks started from the tray menu. */
  setPrefs: (deviceIds: string[], coverScreen: boolean): Promise<void> =>
    inTauri ? call("set_prefs", { deviceIds, coverScreen }) : Promise.resolve(),

  /** Tray panel: size the window to its content (logical px). */
  fitPanel: (height: number): Promise<void> => (inTauri ? call("fit_panel", { height }) : Promise.resolve()),

  hidePanel: (): Promise<void> => (inTauri ? call("hide_panel") : Promise.resolve()),

  /** macOS tray panel: where the menu bar icon is (x inside the panel), or null for no caret. */
  onPanelCaret: async (cb: (caret: { x: number } | null) => void): Promise<() => void> =>
    inTauri ? on<{ x: number } | null>("panel-caret", cb) : () => {},

  /** Tray panel: where it was last placed (pointer x or null, and room), or null before the first
   *  placement. The page asks on load, since the placement events may have gone out before it listened. */
  panelLayout: (): Promise<{ caret: number | null; room: number } | null> =>
    inTauri ? call("panel_layout") : Promise.resolve(null),

  /** Tray panel: the most height the screen has room for (logical px), sent each time it's placed. */
  onPanelRoom: async (cb: (height: number) => void): Promise<() => void> =>
    inTauri ? on<number>("panel-room", cb) : () => {},

  /** Tray panel: it was just shown (play the open animation) or is about to hide (play the close). */
  onPanelOpen: async (cb: () => void): Promise<() => void> => (inTauri ? on<null>("panel-open", cb) : () => {}),
  onPanelClosing: async (cb: () => void): Promise<() => void> =>
    inTauri ? on<null>("panel-closing", cb) : () => {},

  quit: (): Promise<void> => (inTauri ? call("quit_app") : Promise.resolve()),

  /** The app's version, e.g. "0.1.0-beta.1". */
  version: async (): Promise<string> => {
    if (!inTauri) return "0.1.0-beta.1";
    const { getVersion } = await import("@tauri-apps/api/app");
    return getVersion();
  },

  /** Look for a newer release now. Resolves to null when up to date. */
  checkForUpdate: (): Promise<UpdateInfo | null> =>
    inTauri ? call("check_for_update") : Promise.resolve(simUpdate),

  /** Download, install and restart. Refused while the keyboard is locked. */
  installUpdate: (): Promise<void> => (inTauri ? call("install_update") : Promise.resolve()),

  /** Fires when the background check (shortly after launch, then every 6 h) finds an update. */
  onUpdateAvailable: async (cb: (u: UpdateInfo) => void): Promise<() => void> =>
    inTauri ? on<UpdateInfo>("update-available", cb) : () => {},

  getAutostart: (): Promise<boolean> => (inTauri ? call("get_autostart") : Promise.resolve(false)),

  setAutostart: (enabled: boolean): Promise<boolean> =>
    inTauri ? call("set_autostart", { enabled }) : Promise.resolve(enabled),

  onState: async (cb: (s: LockState) => void): Promise<() => void> =>
    inTauri ? on<LockState>("lock-state", cb) : sim.onState(cb),

  onKeySwallowed: async (cb: (label: string) => void): Promise<() => void> =>
    inTauri ? on<{ label: string }>("key-swallowed", (p) => cb(p.label)) : sim.onKey(cb),
};

/** "1:42" from one minute up, "0:08" below it. */
export function formatClock(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** The escape shortcut as the OS writes it. */
export function escapeKeys(platform: string): string[] {
  return platform === "macos" ? ["⌃", "⌥", "U"] : ["Ctrl", "Alt", "U"];
}
