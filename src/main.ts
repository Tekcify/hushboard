import "./styles";
import { api, escapeKeys, type Keyboard, type LockState, type Permissions, type SystemState } from "./api";
import { icon, type IconName } from "./icons";
import { loadSettings, saveSettings, type Settings } from "./settings";
import { timingMs } from "./tokens";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

declare global {
  interface Window {
    /** Set by Rust: "panel" (tray panel on macOS and Windows) or "window" (Linux). */
    __HB_SHELL?: "panel" | "window";
  }
}
const SHELL = window.__HB_SHELL ?? (new URLSearchParams(location.search).get("shell") === "panel" ? "panel" : "window");
document.documentElement.dataset.shell = SHELL;

const DURATIONS: { secs: number | null; label: string }[] = [
  { secs: 30, label: "30 s" },
  { secs: 60, label: "1 min" },
  { secs: 120, label: "2 min" },
  { secs: 300, label: "5 min" },
  { secs: null, label: "Never" },
];

const ARM_DELAY_MS = timingMs("arm-delay");
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
  const note = $("dur-note");
  const keys = kbd(escapeKeys(perms?.platform ?? "macos"));
  note.innerHTML =
    settings.durationSecs == null
      ? `Unlock with the button on screen or ${keys}`
      : `The keyboard unlocks by itself. You can also hold the button on screen or press ${keys}`;
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
  all: "Every connected keyboard",
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
      <span><span class="hb-device__name">No keyboards found</span><br><span class="hb-device__meta">Plug one in or check input device access</span></span><span></span></div>`;
    note.hidden = true;
    return;
  }

  if (allAtOnce) {
    box.innerHTML = `<div class="hb-device hb-device--static"><span class="hb-device__icon">${icon("keyboard")}</span>
      <span><span class="hb-device__name">All keyboards</span><br><span class="hb-device__meta">Built-in and external</span></span><span></span></div>`;
    note.hidden = false;
    note.textContent = "This system locks every keyboard at once.";
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
      const meta = `${KIND_LABEL[k.kind]} · ${on ? "will be locked" : "stays active"}`;
      return `<button class="hb-device" type="button" role="checkbox" aria-checked="${on}" data-id="${escapeHtml(k.id)}">
        <span class="hb-device__icon">${icon(KIND_ICON[k.kind])}</span>
        <span><span class="hb-device__name">${escapeHtml(k.name)}</span><br><span class="hb-device__meta">${meta}</span></span>
        <span class="hb-switch" aria-hidden="true" aria-checked="${on}"></span></button>`;
    })
    .join("");
  note.hidden = sel.size !== keyboards.length;
  note.textContent = "Every keyboard will be locked. Unlock with the mouse or trackpad.";
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
  { key: "coverScreen", label: "Cover the screen while locked", icon: "moon-02" },
  { key: "showKeys", label: "Show keys I press while locked", icon: "keyboard" },
];

function renderSettings() {
  $("settings").innerHTML = SETTINGS_ROWS.map(
    (r) => `<label class="app__setting" for="set-${r.key}">${icon(r.icon)}<span>${r.label}</span>
      <button class="hb-switch" id="set-${r.key}" type="button" role="switch" aria-checked="${settings[r.key]}" data-key="${r.key}"></button></label>`,
  ).join("");
}

$("settings").addEventListener("click", (e) => {
  const sw = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-key]");
  if (!sw) return;
  const key = sw.dataset.key as "coverScreen" | "showKeys";
  settings[key] = !settings[key];
  persist();
  sw.setAttribute("aria-checked", String(settings[key]));
});

// ---------- Permissions ----------
function permissionCards(p: Permissions): string {
  const cards: string[] = [];
  const card = (title: string, text: string, granted: boolean, action: string) =>
    `<div class="hb-perm ${granted ? "hb-perm--granted" : "hb-perm--blocked"}">
      <span class="hb-perm__icon">${icon(granted ? "shield-check" : "shield-alert")}</span>
      <div class="hb-perm__body">
        <div class="hb-perm__title">${title} <span class="hb-pill ${granted ? "hb-pill--locked" : "hb-pill--error"}">${granted ? "Allowed" : "Not allowed"}</span></div>
        <p class="hb-perm__text">${text}</p>
        ${granted ? "" : `<div class="hb-row">${action}<button class="hb-btn hb-btn--ghost" type="button" data-action="recheck">${icon("circle-arrow-reload-01")}Check again</button></div>`}
      </div></div>`;

  if (p.platform === "macos") {
    cards.push(helperCard(p));
  }
  if (p.secureInputHolder) {
    cards.push(secureInputCard(p.secureInputHolder));
  }
  // Without the helper, macOS falls back to an event tap that needs these two.
  if (p.platform === "macos" && p.helper !== "ready") {
    const open = `<button class="hb-btn hb-btn--primary" type="button" data-action="request">Open System Settings</button>`;
    if (p.accessibility === "denied")
      cards.push(card("Accessibility access", "macOS only lets an app block key presses after you allow it in System Settings → Privacy &amp; Security → Accessibility.", false, open));
    if (p.inputMonitoring === "denied")
      cards.push(card("Input Monitoring", "Hushboard sees key presses so it can drop them while you clean. Nothing is recorded.", false, open));
  }
  if (p.platform === "linux" && p.inputDevices === "denied") {
    cards.push(
      card(
        "Input device access",
        "Hushboard locks keyboards directly through the input device. Add yourself to the <code>input</code> group (<code>sudo usermod -aG input $USER</code>), then log out and back in.",
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
      return body("Ready", "hb-pill--locked", "Hushboard locks the keyboard hardware itself, so other apps can't get in the way.", "", true);
    case "needs-approval":
      return body(
        "Needs approval",
        "hb-pill--arming",
        "One more step: in System Settings → Privacy &amp; Security → Input Monitoring, switch on <b>Hushboard Keyboard Helper</b>. Hushboard notices on its own once you do.",
        `<button class="hb-btn hb-btn--primary" type="button" data-action="helper-settings">Open Input Monitoring</button>
         <button class="hb-btn hb-btn--ghost" type="button" data-action="helper-prompt">Show the prompt again</button>`,
      );
    case "outdated":
      return body(
        "Update needed",
        "hb-pill--arming",
        "The installed helper is from an older version of Hushboard. Updating asks for your Mac password.",
        `<button class="hb-btn hb-btn--primary" type="button" data-action="install-helper">Update helper</button>`,
      );
    default:
      return body(
        "Not installed",
        "",
        "Locks the keyboard hardware itself, so it works even when macOS or another app is holding secure keyboard entry, and lets you lock just the built-in keyboard. Installing asks for your Mac password once.",
        `<button class="hb-btn hb-btn--primary" type="button" data-action="install-helper">Install helper</button>`,
      );
  }
}

/** Shown while another app holds Secure Input and the helper isn't there to work around it. */
function secureInputCard(holder: string): string {
  const name = escapeHtml(holder);
  const text =
    holder === "loginwindow"
      ? "macOS is stuck in secure keyboard entry, which hides key presses from Hushboard. Lock the screen with <b>Ctrl + Cmd + Q</b> and log back in (or log out and in). Installing the keyboard helper avoids this."
      : `<b>${name}</b> has secure keyboard entry on (usually a focused password field), which hides key presses from Hushboard. Close it or switch it off; Hushboard notices on its own.`;
  return `<div class="hb-perm hb-perm--blocked">
      <span class="hb-perm__icon">${icon("alert-02")}</span>
      <div class="hb-perm__body">
        <div class="hb-perm__title">Secure keyboard entry <span class="hb-pill hb-pill--error">Blocking</span></div>
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
    b.textContent = "Waiting for your password…";
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
    locked: ["hb-pill hb-pill--locked", "Keyboard locked"],
  };
  let [cls, text] = map[state.phase];
  if (state.phase === "idle" && perms && !perms.allGranted) [cls, text] = ["hb-pill hb-pill--error", "Needs permission"];
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
  if (!perms) return "Checking what this Mac allows…";
  if (perms.helper === "needs-approval") return "Switch on Hushboard Keyboard Helper in Input Monitoring to lock";
  if (perms.helper === "outdated") return "Update the keyboard helper to lock";
  if (perms.secureInputHolder)
    return perms.secureInputHolder === "loginwindow"
      ? "macOS is stuck in secure keyboard entry"
      : `${perms.secureInputHolder} is holding secure keyboard entry`;
  if (perms.accessibility === "denied" || perms.inputMonitoring === "denied")
    return "Allow Accessibility and Input Monitoring to lock";
  if (perms.inputDevices === "denied") return "Hushboard needs access to input devices to lock";
  if (!perms.allGranted) return "A permission is missing";
  if (!keyboards.some((k) => k.kind === "all") && selectedIds().length === 0) return "Choose at least one keyboard to lock";
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
        <div class="app__arming-text"><span class="body-strong">Lift your hands from the keyboard</span>
          <button class="hb-btn hb-btn--secondary" type="button" id="cancel">${icon("cancel-01")}Cancel</button></div>
      </div>`;
      $("cancel").addEventListener("click", () => api.unlock());
      $<HTMLButtonElement>("cancel").focus();
    }
    $("arm-time").textContent = String(Math.max(1, Math.ceil(left / 1000)));
    $("arm-arc").setAttribute("stroke-dashoffset", String(offset));
  } else if (state.phase === "locked") {
    if (footerPhase !== "locked") {
      const where = settings.coverScreen ? "the full-screen view" : "the island at the top of the screen";
      footer.innerHTML = `<p class="caption">The keyboard is locked. Unlock from ${where}, or press ${kbd(escapeKeys(perms?.platform ?? "macos"))}</p>`;
    }
  } else {
    const escape = escapeKeys(perms?.platform ?? "macos").join(perms?.platform === "macos" ? "" : " + ");
    footer.innerHTML = `<button class="hb-btn hb-btn--primary hb-btn--lg" type="button" id="lock" ${canLock ? "" : `disabled aria-describedby="lock-why"`}>
      ${icon("square-lock-02")}Lock keyboard</button>
      ${
        canLock
          ? `<p class="caption">Starts after ${ARM_DELAY_MS / 1000} s · ${escapeHtml(escape)} always unlocks</p>`
          : `<p class="caption app__why" id="lock-why">${escapeHtml(blocked)}</p>`
      }
      <div class="app__panel-links">
        <span></span>
        <button class="hb-btn hb-btn--ghost" type="button" id="quit">Quit Hushboard</button>
      </div>`;
    $("lock").addEventListener("click", startLock);
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
async function boot() {
  $("brand").insertAdjacentHTML("afterbegin", icon("brush-cleaning"));
  renderDurations();
  renderSettings();
  // Live system updates: the app's watcher checks every 2 s while idle and sends only changes.
  await api.onSystem(applySystem);
  const [system, current] = await Promise.all([api.refreshSystem(false), api.getState()]);
  state = current;
  applySystem(system);
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
    await api.onPanelCaret((caret) => {
      const rootEl = document.documentElement;
      if (caret) {
        rootEl.style.setProperty("--caret-x", `${caret.x}px`);
        rootEl.dataset.caret = "top";
      } else {
        delete rootEl.dataset.caret;
      }
    });
    // Size the panel window to its card, whenever the content changes height.
    const card = $("app");
    let last = 0;
    new ResizeObserver(() => {
      const height = Math.ceil(card.getBoundingClientRect().height) + 20; // + shadow margin
      if (height !== last) {
        last = height;
        api.fitPanel(height);
      }
    }).observe(card);
    // Esc closes the panel, like any menu.
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") api.hidePanel();
    });
  }
}

boot();
