import "./styles";
import { api, escapeKeys, type Keyboard, type LockState, type Permissions, type SystemState, type UpdateInfo } from "./api";
import { icon, type IconName } from "./icons";
import { loadSettings, saveSettings, type Settings } from "./settings";
import { timingMs } from "./tokens";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

declare global {
  interface Window {
    /** Set by Rust: "panel" (tray panel on macOS and Windows) or "window" (Linux). */
    __HB_SHELL?: "panel" | "window";
    /** Set by Rust on macOS: the panel sits on the system's frosted popover material. */
    __HB_MATERIAL?: "native";
  }
}
const params = new URLSearchParams(location.search);
const SHELL = window.__HB_SHELL ?? (params.get("shell") === "panel" ? "panel" : "window");
document.documentElement.dataset.shell = SHELL;
// In a browser, ?material=native previews the macOS panel (the material is faked in CSS).
const MATERIAL = window.__HB_MATERIAL ?? (params.get("material") === "native" ? "native" : null);
if (MATERIAL) document.documentElement.dataset.material = MATERIAL;
if (!window.__HB_MATERIAL && MATERIAL) document.documentElement.dataset.materialPreview = "true";

const DURATIONS: { secs: number | null; label: string }[] = [
  { secs: 30, label: "30 s" },
  { secs: 60, label: "1 min" },
  { secs: 120, label: "2 min" },
  { secs: 300, label: "5 min" },
  { secs: null, label: "Never" },
];

const ARM_DELAY_MS = timingMs("arm-delay");
/** How much shorter than its content the tray panel is kept, so its middle can bounce (boot). */
const BOUNCE_PX = 1;
const CIRCUMFERENCE = 628.3;

let settings: Settings = loadSettings();
let perms: Permissions | null = null;
let keyboards: Keyboard[] = [];
let state: LockState = { phase: "idle", armingMsLeft: null, remainingMs: null, totalMs: null, keysIgnored: 0, error: null };

const kbd = (keys: string[]) => `<span class="hb-kbd">${keys.map((k) => `<kbd>${k}</kbd>`).join("")}</span>`;
const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function persist() {
  saveSettings(settings);
  // Locks started from the tray menu use the same keyboards and screen choice.
  api.setPrefs(selectedIds(), settings.coverScreen);
}

// ---------- Duration ----------
function renderDurations() {
  const group = $("durations");
  group.innerHTML = DURATIONS.map(
    (d, i) =>
      `<button type="button" role="radio" data-i="${i}" aria-checked="${d.secs === settings.durationSecs}"
        tabindex="${d.secs === settings.durationSecs ? 0 : -1}">${d.label}</button>`,
  ).join("");
  // The footer already says how to unlock early; only "Never" needs a word of its own.
  const note = $("dur-note");
  const keys = kbd(escapeKeys(perms?.platform ?? "macos"));
  note.hidden = settings.durationSecs != null;
  note.innerHTML = `Stays locked until you hold the on-screen button or press ${keys}.`;
}

$("durations").addEventListener("click", (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-i]");
  if (!b) return;
  settings.durationSecs = DURATIONS[Number(b.dataset.i)].secs;
  persist();
  renderDurations();
  $("durations").querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus();
});

$("durations").addEventListener("keydown", (e) => {
  if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
  e.preventDefault();
  const i = DURATIONS.findIndex((d) => d.secs === settings.durationSecs);
  const step = e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 1;
  settings.durationSecs = DURATIONS[(i + step + DURATIONS.length) % DURATIONS.length].secs;
  persist();
  renderDurations();
  $("durations").querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus();
});

// ---------- Keyboards ----------
const KIND_ICON: Record<Keyboard["kind"], IconName> = {
  "built-in": "laptop",
  usb: "usb",
  bluetooth: "bluetooth",
  other: "keyboard",
  all: "keyboard",
};
const KIND_LABEL: Record<Keyboard["kind"], string> = {
  "built-in": "Built-in",
  usb: "USB",
  bluetooth: "Bluetooth",
  other: "Keyboard",
  all: "All keyboards",
};

function selectedIds(): string[] {
  if (keyboards.some((k) => k.kind === "all")) return [];
  return settings.deviceIds.filter((id) => keyboards.some((k) => k.id === id));
}

function renderKeyboards() {
  const box = $("devices");
  const note = $("devices-note");
  const allAtOnce = keyboards.length === 1 && keyboards[0].kind === "all";

  if (keyboards.length === 0) {
    box.innerHTML = `<div class="hb-device hb-device--static"><span class="hb-device__icon">${icon("keyboard")}</span>
      <span><span class="hb-device__name">No keyboards found</span><br><span class="hb-device__meta">Plug one in, or check input access.</span></span><span></span></div>`;
    note.hidden = true;
    return;
  }

  if (allAtOnce) {
    box.innerHTML = `<div class="hb-device hb-device--static"><span class="hb-device__icon">${icon("keyboard")}</span>
      <span><span class="hb-device__name">All keyboards</span><br><span class="hb-device__meta">Built-in and external, locked together</span></span><span></span></div>`;
    note.hidden = true;
    return;
  }

  // Linux: default to the built-in keyboard only, so an external one stays a way out.
  if (selectedIds().length === 0) {
    const builtIn = keyboards.filter((k) => k.kind === "built-in").map((k) => k.id);
    settings.deviceIds = builtIn.length ? builtIn : [keyboards[0].id];
    persist();
  }
  const sel = new Set(selectedIds());
  box.innerHTML = keyboards
    .map((k) => {
      const on = sel.has(k.id);
      const meta = on ? KIND_LABEL[k.kind] : `${KIND_LABEL[k.kind]} · stays on`;
      return `<button class="hb-device" type="button" role="checkbox" aria-checked="${on}" data-id="${escapeHtml(k.id)}">
        <span class="hb-device__icon">${icon(KIND_ICON[k.kind])}</span>
        <span><span class="hb-device__name">${escapeHtml(k.name)}</span><br><span class="hb-device__meta">${meta}</span></span>
        <span class="hb-switch" aria-hidden="true" aria-checked="${on}"></span></button>`;
    })
    .join("");
  // The switches already show which keyboards lock, so there's nothing to add here.
  note.hidden = true;
}

$("devices").addEventListener("click", (e) => {
  const row = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-id]");
  if (!row) return;
  const id = row.dataset.id!;
  const sel = new Set(selectedIds());
  if (sel.has(id)) sel.delete(id);
  else sel.add(id);
  settings.deviceIds = [...sel];
  persist();
  renderKeyboards();
  renderFooter();
});

// ---------- While locked ----------
const SETTINGS_ROWS: { key: "coverScreen" | "showKeys"; label: string; icon: IconName }[] = [
  { key: "coverScreen", label: "Cover the screen", icon: "moon-02" },
  { key: "showKeys", label: "Show the keys you press", icon: "keyboard" },
];

/** Start at login is the OS's setting, not ours: read and written through the app. */
let autostart = false;

function renderSettings() {
  const row = (key: string, label: string, name: IconName, on: boolean) =>
    `<label class="app__setting" for="set-${key}">${icon(name)}<span>${label}</span>
      <button class="hb-switch" id="set-${key}" type="button" role="switch" aria-checked="${on}" data-key="${key}"></button></label>`;
  $("settings").innerHTML =
    SETTINGS_ROWS.map((r) => row(r.key, r.label, r.icon, settings[r.key])).join("") +
    row("autostart", "Open at login", "login-03", autostart);
}

$("settings").addEventListener("click", async (e) => {
  const sw = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-key]");
  if (!sw) return;
  if (sw.dataset.key === "autostart") {
    autostart = await api.setAutostart(!autostart).catch(() => autostart);
    sw.setAttribute("aria-checked", String(autostart));
    return;
  }
  const key = sw.dataset.key as "coverScreen" | "showKeys";
  settings[key] = !settings[key];
  persist();
  sw.setAttribute("aria-checked", String(settings[key]));
});

// ---------- First-run welcome ----------
const WELCOMED_KEY = "hushboard.welcomed.v1";

function welcomed(): boolean {
  try {
    return localStorage.getItem(WELCOMED_KEY) === "1";
  } catch {
    return true; // no storage: don't nag on every launch
  }
}

function renderWelcome(platform: string) {
  const box = $("welcome");
  if (welcomed()) {
    box.hidden = true;
    return;
  }
  const where =
    platform === "macos"
      ? "Click the keyboard in the menu bar to open this panel, or right-click it to lock in one step."
      : platform === "windows"
        ? "Click the keyboard in the system tray to open this panel, or right-click it to lock in one step. If you don't see it, try the ^ arrow."
        : "Use the keyboard icon in your panel to lock in one step, or this window for everything else.";
  box.innerHTML = `
    <span class="hb-perm__icon">${icon("sparkles")}</span>
    <div class="hb-perm__body">
      <div class="hb-perm__title" id="welcome-title">Welcome to Hushboard</div>
      <p class="hb-perm__text">${where}</p>
      <div class="hb-row">
        ${
          // Already opening at login (the settings switch is on): just let them dismiss it.
          autostart
            ? `<button class="hb-btn hb-btn--secondary" type="button" id="welcome-done">Got it</button>`
            : `<button class="hb-btn hb-btn--primary" type="button" id="welcome-autostart">Open at login</button>
               <button class="hb-btn hb-btn--ghost" type="button" id="welcome-done">Not now</button>`
        }
      </div>
    </div>`;
  box.hidden = false;
  const done = () => {
    try {
      localStorage.setItem(WELCOMED_KEY, "1");
    } catch {
      /* storage unavailable */
    }
    box.hidden = true;
  };
  $("welcome-done").addEventListener("click", done);
  $("welcome-autostart")?.addEventListener("click", async () => {
    autostart = await api.setAutostart(true).catch(() => autostart);
    renderSettings();
    done();
  });
}

// ---------- Updates ----------
function renderUpdate(update: UpdateInfo | null, message?: string) {
  const box = $("update");
  if (!update && !message) {
    box.hidden = true;
    return;
  }
  box.innerHTML = update
    ? `<span class="hb-perm__icon">${icon("circle-arrow-reload-01")}</span>
      <div class="hb-perm__body">
        <div class="hb-perm__title">Update available <span class="hb-pill hb-pill--locked">${escapeHtml(update.version)}</span></div>
        <p class="hb-perm__text">You have ${escapeHtml(update.currentVersion)}.</p>
        <div class="hb-row">
          <button class="hb-btn hb-btn--primary" type="button" id="update-install">Install and restart</button>
          <button class="hb-btn hb-btn--ghost" type="button" id="update-later">Later</button>
        </div>
      </div>`
    : `<span class="hb-perm__icon">${icon("tick-02")}</span>
      <div class="hb-perm__body"><p class="hb-perm__text">${escapeHtml(message!)}</p></div>`;
  box.hidden = false;
  if (update) {
    $("update-later").addEventListener("click", () => (box.hidden = true));
    $<HTMLButtonElement>("update-install").addEventListener("click", async (e) => {
      const b = e.currentTarget as HTMLButtonElement;
      b.disabled = true;
      b.textContent = "Installing…";
      try {
        await api.installUpdate(); // restarts the app on success
      } catch (err) {
        state = { ...state, error: String(err) };
        renderError();
        renderUpdate(update);
      }
    });
  } else {
    window.setTimeout(() => (box.hidden = true), 4000);
  }
}

async function checkForUpdatesNow() {
  try {
    const update = await api.checkForUpdate();
    renderUpdate(update, update ? undefined : "Hushboard is up to date.");
  } catch (err) {
    renderUpdate(null, `Couldn't check for updates. ${String(err)}`);
  }
}

// ---------- Permissions ----------
function permissionCards(p: Permissions): string {
  const cards: string[] = [];
  const card = (title: string, text: string, granted: boolean, action: string) =>
    `<div class="hb-perm ${granted ? "hb-perm--granted" : "hb-perm--blocked"}">
      <span class="hb-perm__icon">${icon(granted ? "shield-check" : "shield-alert")}</span>
      <div class="hb-perm__body">
        <div class="hb-perm__title">${title} <span class="hb-pill ${granted ? "hb-pill--locked" : "hb-pill--error"}">${granted ? "Allowed" : "Off"}</span></div>
        <p class="hb-perm__text">${text}</p>
        ${granted ? "" : `<div class="hb-row">${action}<button class="hb-btn hb-btn--ghost" type="button" data-action="recheck">Check again</button></div>`}
      </div></div>`;

  if (p.platform === "macos") {
    cards.push(helperCard(p));
  }
  if (p.secureInputHolder) {
    cards.push(secureInputCard(p.secureInputHolder));
  }
  // Without the helper, macOS falls back to an event tap that needs these two.
  if (p.platform === "macos" && p.helper !== "ready") {
    const open = `<button class="hb-btn hb-btn--primary" type="button" data-action="request">Open Settings</button>`;
    if (p.accessibility === "denied")
      cards.push(card("Accessibility", "Lets Hushboard block key presses. Privacy &amp; Security → Accessibility.", false, open));
    if (p.inputMonitoring === "denied")
      cards.push(card("Input Monitoring", "Lets Hushboard see key presses to drop them. Nothing is recorded.", false, open));
  }
  if (p.platform === "linux" && p.inputDevices === "denied") {
    cards.push(
      card(
        "Input devices",
        "Add yourself to the <code>input</code> group, then log out and back in: <code>sudo usermod -aG input $USER</code>",
        false,
        "",
      ),
    );
  }
  return cards.join("");
}

/** macOS keyboard helper: the hardware lock. */
function helperCard(p: Permissions): string {
  const body = (pill: string, pillClass: string, text: string, actions: string, ok = false) =>
    `<div class="hb-perm ${ok ? "hb-perm--granted" : ""}">
      <span class="hb-perm__icon">${icon(ok ? "shield-check" : "keyboard")}</span>
      <div class="hb-perm__body">
        <div class="hb-perm__title">Keyboard helper <span class="hb-pill ${pillClass}">${pill}</span></div>
        <p class="hb-perm__text">${text}</p>
        ${actions ? `<div class="hb-row">${actions}</div>` : ""}
      </div></div>`;

  switch (p.helper) {
    case "ready":
      return body("Ready", "hb-pill--locked", "Locks the keyboard hardware, so no app can get in the way.", "", true);
    case "needs-approval":
      return body(
        "Turn on",
        "hb-pill--arming",
        "Switch on <b>Hushboard Keyboard Helper</b> in Input Monitoring. Hushboard notices on its own.",
        `<button class="hb-btn hb-btn--primary" type="button" data-action="helper-settings">Open Input Monitoring</button>
         <button class="hb-btn hb-btn--ghost" type="button" data-action="helper-prompt">Ask again</button>`,
      );
    case "outdated":
      return body(
        "Update",
        "hb-pill--arming",
        "This helper is from an older Hushboard. Updating asks for your password.",
        `<button class="hb-btn hb-btn--primary" type="button" data-action="install-helper">Update helper</button>`,
      );
    default:
      return body(
        "Not installed",
        "",
        "Locks the keyboard hardware, so it works with password fields open and can lock the built-in keyboard alone. Asks for your password once.",
        `<button class="hb-btn hb-btn--primary" type="button" data-action="install-helper">Install helper</button>`,
      );
  }
}

/** Shown while another app holds Secure Input and the helper isn't there to work around it. */
function secureInputCard(holder: string): string {
  const name = escapeHtml(holder);
  const text =
    holder === "loginwindow"
      ? "macOS is stuck in secure keyboard entry, which hides key presses. Lock the screen (⌃⌘Q) and log back in, or install the keyboard helper."
      : `<b>${name}</b> has secure keyboard entry on, usually from a focused password field. Close it or switch it off.`;
  return `<div class="hb-perm hb-perm--blocked">
      <span class="hb-perm__icon">${icon("alert-02")}</span>
      <div class="hb-perm__body">
        <div class="hb-perm__title">Secure keyboard entry <span class="hb-pill hb-pill--error">On</span></div>
        <p class="hb-perm__text">${text}</p>
      </div></div>`;
}

let permsHtml = "";
function renderPerms() {
  const box = $("perms");
  const helperPending = perms?.platform === "macos" && perms.helper !== "ready";
  const html = !perms || (perms.allGranted && !helperPending && !perms.secureInputHolder) ? "" : permissionCards(perms);
  // Only touch the DOM on a real change, so live updates never reset a button under the pointer.
  if (html === permsHtml) return;
  permsHtml = html;
  box.hidden = html === "";
  box.innerHTML = html;
}

$("perms").addEventListener("click", async (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-action]");
  if (!b) return;
  const action = b.dataset.action;
  if (action === "request") await api.requestPermissions();
  if (action === "helper-settings") await api.openHelperSettings();
  if (action === "helper-prompt") await api.requestHelperAccess();
  if (action === "install-helper") {
    b.disabled = true;
    b.textContent = "Waiting for password…";
    permsHtml = ""; // let the next update redraw the card even if nothing else changed
    try {
      await api.installHelper();
      state = { ...state, error: null };
    } catch (err) {
      const msg = String(err);
      if (!msg.includes("cancelled")) state = { ...state, error: `Couldn't install the keyboard helper: ${msg}` };
    }
    renderError();
  }
  await refreshPermissions();
});

/** Apply a system snapshot (from the live `system-changed` event or a refresh). */
function applySystem(system: SystemState) {
  const permsChanged = JSON.stringify(system.permissions) !== JSON.stringify(perms);
  const keyboardsChanged = JSON.stringify(system.keyboards) !== JSON.stringify(keyboards);
  perms = system.permissions;
  keyboards = system.keyboards;
  // A lock error about a permission is stale once everything is in place again.
  if (permsChanged && perms.allGranted && state.error) {
    state = { ...state, error: null };
    renderError();
  }
  if (permsChanged) {
    renderPerms();
    renderDurations();
    renderStatus();
  }
  if (keyboardsChanged) renderKeyboards();
  if (permsChanged || keyboardsChanged) renderFooter();
}

/** Thorough re-check now (button presses, window focus). Live updates arrive on their own. */
async function refreshPermissions() {
  applySystem(await api.refreshSystem(true));
}

// ---------- Status + footer ----------
function renderStatus() {
  const pill = $("status");
  const map: Record<LockState["phase"], [string, string]> = {
    idle: ["hb-pill", "Unlocked"],
    arming: ["hb-pill hb-pill--arming", `Locking in ${Math.ceil((state.armingMsLeft ?? 0) / 1000)} s`],
    locked: ["hb-pill hb-pill--locked", "Locked"],
  };
  let [cls, text] = map[state.phase];
  if (state.phase === "idle" && perms && !perms.allGranted) [cls, text] = ["hb-pill hb-pill--error", "Setup needed"];
  pill.className = cls;
  pill.textContent = text;
}

function renderError() {
  const box = $("error");
  box.hidden = !state.error;
  box.innerHTML = state.error ? `${icon("alert-02")}<span>${escapeHtml(state.error)}</span>` : "";
}

let footerPhase: string | null = null;

/** Why the Lock button is disabled, in one line, or null when it can lock. */
function lockBlockedReason(): string | null {
  if (!perms) return "Checking permissions…";
  if (perms.helper === "needs-approval") return "Turn on the keyboard helper to lock";
  if (perms.helper === "outdated") return "Update the keyboard helper to lock";
  // With the macOS helper ready, the helper does the locking: the app's own Accessibility and
  // Input Monitoring (and secure keyboard entry) only matter to the no-helper fallback. Gating
  // on them here blocked a fresh install whose helper was fully set up.
  if (perms.helper !== "ready") {
    const blocked = fallbackBlockedReason(perms);
    if (blocked) return blocked;
  }
  if (!keyboards.some((k) => k.kind === "all") && selectedIds().length === 0) return "Choose a keyboard to lock";
  return null;
}

/** What stops the lock when there's no helper doing it (Windows, Linux, macOS fallback). */
function fallbackBlockedReason(perms: Permissions): string | null {
  if (perms.secureInputHolder)
    return perms.secureInputHolder === "loginwindow"
      ? "macOS is stuck in secure keyboard entry"
      : `${perms.secureInputHolder} is holding secure keyboard entry`;
  if (perms.accessibility === "denied" || perms.inputMonitoring === "denied")
    return "Allow Accessibility and Input Monitoring to lock";
  if (perms.inputDevices === "denied") return "Allow input device access to lock";
  if (!perms.allGranted) return "Finish setup to lock";
  return null;
}

function renderFooter() {
  const footer = $("footer");
  const blocked = lockBlockedReason();
  const canLock = blocked === null;

  if (state.phase === "arming") {
    const left = state.armingMsLeft ?? 0;
    const offset = CIRCUMFERENCE * (1 - left / ARM_DELAY_MS);
    if (footerPhase !== "arming") {
      footer.innerHTML = `<div class="app__arming">
        <div class="hb-countdown hb-countdown--sm" role="timer" aria-label="Locking soon">
          <svg viewBox="0 0 220 220" aria-hidden="true"><circle class="hb-countdown__track" cx="110" cy="110" r="100"/>
          <circle class="hb-countdown__arc" id="arm-arc" cx="110" cy="110" r="100" stroke-dasharray="${CIRCUMFERENCE}" style="stroke:var(--caution)"/></svg>
          <div class="hb-countdown__center"><span class="hb-countdown__time" id="arm-time"></span></div>
        </div>
        <div class="app__arming-text"><span class="body-strong">Hands off the keyboard</span>
          <button class="hb-btn hb-btn--secondary" type="button" id="cancel">${icon("cancel-01")}Cancel</button></div>
      </div>`;
      $("cancel").addEventListener("click", () => api.unlock());
      $<HTMLButtonElement>("cancel").focus();
    }
    $("arm-time").textContent = String(Math.max(1, Math.ceil(left / 1000)));
    $("arm-arc").setAttribute("stroke-dashoffset", String(offset));
  } else if (state.phase === "locked") {
    if (footerPhase !== "locked") {
      const where = settings.coverScreen ? "the cover" : perms?.platform === "macos" ? "the island" : "the bar at the top";
      footer.innerHTML = `<p class="caption">Locked. Unlock from ${where} or press ${kbd(escapeKeys(perms?.platform ?? "macos"))}</p>`;
    }
  } else {
    const escape = escapeKeys(perms?.platform ?? "macos").join(perms?.platform === "macos" ? "" : " + ");
    footer.innerHTML = `<button class="hb-btn hb-btn--primary hb-btn--lg" type="button" id="lock" ${canLock ? "" : `disabled aria-describedby="lock-why"`}>
      ${icon("square-lock-02")}Lock keyboard</button>
      ${
        canLock
          ? `<p class="caption">Locks after ${ARM_DELAY_MS / 1000} s · ${escapeHtml(escape)} unlocks</p>`
          : `<p class="caption app__why" id="lock-why">${escapeHtml(blocked)}</p>`
      }
      <div class="app__links">
        <button class="hb-btn hb-btn--ghost" type="button" id="check-updates" title="Check for updates">Version ${escapeHtml(appVersion)}</button>
        <button class="hb-btn hb-btn--ghost app__quit" type="button" id="quit">Quit</button>
      </div>`;
    $("lock").addEventListener("click", startLock);
    $("check-updates").addEventListener("click", checkForUpdatesNow);
    $("quit").addEventListener("click", () => api.quit());
  }
  footerPhase = state.phase;
}

async function startLock() {
  try {
    state = await api.startLock({
      durationSecs: settings.durationSecs,
      armDelayMs: ARM_DELAY_MS,
      deviceIds: selectedIds(),
      coverScreen: settings.coverScreen,
    });
  } catch (err) {
    state = { ...state, error: String(err) };
  }
  render();
}

let toastTimer: number | undefined;
function toast(text: string, name: IconName) {
  const t = $("toast");
  t.innerHTML = `${icon(name)}<span>${text}</span>`;
  t.hidden = false;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (t.hidden = true), 2000);
}

function render() {
  renderStatus();
  renderError();
  renderFooter();
}

// ---------- Boot ----------
let appVersion = "";

async function boot() {
  $("brand").insertAdjacentHTML("afterbegin", icon("brush-cleaning"));
  [appVersion, autostart] = await Promise.all([api.version(), api.getAutostart()]);
  renderDurations();
  renderSettings();
  await api.onUpdateAvailable((u) => renderUpdate(u));
  // Live system updates: the app's watcher checks every 2 s while idle and sends only changes.
  await api.onSystem(applySystem);
  const [system, current] = await Promise.all([api.refreshSystem(false), api.getState()]);
  state = current;
  applySystem(system);
  renderWelcome(system.permissions.platform);
  renderDurations();
  render();

  // Tray-menu locks use the panel's keyboards and screen choice.
  api.setPrefs(selectedIds(), settings.coverScreen);

  await api.onState((next) => {
    const wasLocked = state.phase === "locked";
    state = next;
    // In the tray panel the island says "Unlocked"; the Linux window says it itself.
    if (SHELL === "window" && wasLocked && next.phase === "idle" && !next.error) toast("Keyboard unlocked", "tick-02");
    render();
  });

  // Coming back from System Settings: do the thorough check at once instead of waiting.
  window.addEventListener("focus", () => {
    if (state.phase === "idle") refreshPermissions();
  });

  if (SHELL === "panel") {
    // macOS: a caret at the top of the panel pointing at the menu bar icon, as menu bar apps do.
    const applyCaret = (x: number | null) => {
      const rootEl = document.documentElement;
      if (x != null) {
        rootEl.style.setProperty("--caret-x", `${x}px`);
        rootEl.dataset.caret = "top";
      } else {
        delete rootEl.dataset.caret;
      }
    };
    // Grow to fit the screen, not a fixed height: the card is capped at the room the screen has
    // (app.css), and only the middle section scrolls, and only when the screen is too short.
    const applyRoom = (height: number) => {
      document.documentElement.style.setProperty("--panel-room", `${Math.floor(height)}px`);
      window.dispatchEvent(new Event("hb-panel-room")); // re-fit (below) for the new room
    };
    await api.onPanelCaret((caret) => applyCaret(caret ? caret.x : null));
    await api.onPanelRoom(applyRoom);
    // The panel may have been placed before this page was listening (it opens at launch):
    // ask, so the content lines up with the frosted shape and its pointer from the start.
    const layout = await api.panelLayout().catch(() => null);
    if (layout) {
      applyCaret(layout.caret);
      applyRoom(layout.room);
    }
    // Open and close animations (app.css). Re-adding the attribute restarts the open animation
    // even if the previous one hadn't finished.
    const rootEl = document.documentElement;
    await api.onPanelOpen(() => {
      delete rootEl.dataset.panel;
      void rootEl.offsetWidth;
      rootEl.dataset.panel = "opening";
    });
    await api.onPanelClosing(() => {
      rootEl.dataset.panel = "closing";
    });
    document.body.addEventListener("animationend", (e) => {
      if (e.target === document.body && rootEl.dataset.panel === "opening") delete rootEl.dataset.panel;
    });
    // Scroll edges (app.css): flag when there's content hidden above or below the middle section.
    const card = $("app");
    const scroller = card.querySelector<HTMLElement>(".app__body")!;
    // The 1 px the window is kept short by (below) shouldn't count as "more to see".
    const markScroll = () => {
      const below = scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop > BOUNCE_PX + 1;
      card.toggleAttribute("data-scrolled", scroller.scrollTop > BOUNCE_PX + 1);
      card.toggleAttribute("data-more-below", below);
    };
    scroller.addEventListener("scroll", markScroll, { passive: true });

    // Size the window to the card. The middle section is the only thing that scrolls, and
    // macOS only gives a scroll area its elastic bounce when it has something to scroll, so the
    // window is kept BOUNCE_PX shorter than the content: the middle always scrolls by that much
    // (nothing visible is cut) and bounces inside its box, while the header, footer and frosted
    // frame stay put. The natural height comes from the content (scrollHeight), not the card's
    // current box, which is capped by the window and would otherwise never grow back.
    const fit = () => {
      markScroll();
      const style = getComputedStyle(card);
      const natural = card.offsetHeight - scroller.clientHeight + scroller.scrollHeight;
      const room = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--panel-room")) || 900;
      const cardHeight = Math.min(natural - BOUNCE_PX, room - 26);
      const height = Math.ceil(parseFloat(style.marginTop) + cardHeight + parseFloat(style.marginBottom));
      document.documentElement.style.setProperty("--panel-card", `${cardHeight}px`);
      if (height !== lastFit) {
        lastFit = height;
        api.fitPanel(height);
      }
    };
    let lastFit = 0;
    window.addEventListener("hb-panel-room", fit);
    fit();
    const sizes = new ResizeObserver(fit);
    sizes.observe(card);
    sizes.observe(scroller);
    // Each section in the middle: a card appearing changes the content's height.
    for (const child of Array.from(scroller.children)) sizes.observe(child);
    // Esc closes the panel, like any menu.
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") api.hidePanel();
    });
  }
}

boot();
