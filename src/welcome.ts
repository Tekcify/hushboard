import "./styles";
import "./welcome.css";
import { api, escapeKeys, type Permissions, type SystemState } from "./api";
import { markSvg } from "./brand";
import { icon } from "./icons";
import { DURATIONS, loadSettings, saveSettings } from "./settings";
import { playDone, playLaunch, playOn, playStep } from "./sound";
import { timingMs } from "./tokens";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const settings = loadSettings();
const HOLD_SECONDS = timingMs("hold-to-unlock") / 1000;

let perms: Permissions | null = null;
let autostart = false;
let platform = "macos";
let index = 0;
let stepEls: HTMLElement[] = [];
let steps: Step[] = [];

interface Step {
  id: string;
  html: () => string;
  next: () => { label: string; kind: "primary" | "secondary" };
  enter?: () => void;
}

const kbd = (keys: string[]) => `<span class="hb-kbd">${keys.map((k) => `<kbd>${k}</kbd>`).join("")}</span>`;
const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const CHECK = `<svg viewBox="0 0 24 24" aria-hidden="true"><path pathLength="1" d="M6.5 12.5l3.6 3.6 7.4-8"/></svg>`;
const CURSOR = `<svg class="wl__cursor" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3l14 8-6 1.6L10.4 19z" fill="currentColor" stroke="var(--surface-raised)" stroke-width="1.4" stroke-linejoin="round"/></svg>`;
const KEYBOARD_GLYPH = `<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.7"><path d="M14.5 7h-5c-3.287 0-4.931 0-6.038.908a4 4 0 0 0-.554.554C2 9.57 2 11.212 2 14.5s0 4.931.908 6.038a4 4 0 0 0 .554.554C4.57 22 6.212 22 9.5 22h5c3.288 0 4.931 0 6.038-.908q.304-.25.554-.554C22 19.43 22 17.788 22 14.5c0-3.287 0-4.931-.908-6.038a4 4 0 0 0-.554-.554C19.43 7 17.788 7 14.5 7Z"/><path stroke-linejoin="round" d="M12 7V5a1 1 0 0 1 1-1a1 1 0 0 0 1-1V2M7 12h1m3.5 0h1m3.5 0h1M7 17h10"/></g></svg>`;

const where = () => (platform === "windows" ? "system tray" : platform === "linux" ? "panel" : "menu bar");

function needsSetup(): boolean {
  return platform === "macos" || platform === "linux";
}

function ready(p: Permissions | null): boolean {
  if (!p) return false;
  if (p.platform === "macos") return p.helper === "ready";
  if (p.platform === "linux") return p.inputDevices === "granted";
  return true;
}

function introStep(): Step {
  return {
    id: "intro",
    html: () => `
      <div class="wl__art wl__hero" aria-hidden="true"><span class="wl__ring"></span><span class="wl__ring wl__ring--2"></span>${markSvg()}</div>
      <h1 class="wl__title" tabindex="-1">Welcome to Hushboard</h1>
      <p class="wl__text">Lock your keyboard while you clean it. Your mouse and trackpad keep working.</p>`,
    next: () => ({ label: "Get started", kind: "primary" }),
  };
}

function exitsStep(): Step {
  return {
    id: "exits",
    html: () => `
      <div class="wl__art wl__demo" aria-hidden="true">
        <div class="wl__demo-keys">${["H", "U", "S", "H", "B", "O"].map((k, i) => `<span class="wl__demo-key" style="--k:${i}">${k}</span>`).join("")}</div>
        <div class="wl__demo-hold"><span>Hold to unlock</span></div>
        ${CURSOR}
      </div>
      <h1 class="wl__title" tabindex="-1">Three ways out, always</h1>
      <ul class="wl__list">
        <li class="wl__row">${icon("square-unlock-02")}<span>Hold the unlock button for ${HOLD_SECONDS} seconds</span></li>
        <li class="wl__row">${icon("keyboard")}<span>Press ${kbd(escapeKeys(platform))}</span></li>
        <li class="wl__row">${icon("circle-arrow-reload-01")}<span>Wait for the timer to finish</span></li>
      </ul>`,
    next: () => ({ label: "Continue", kind: "primary" }),
  };
}

function setupStep(): Step {
  return {
    id: "setup",
    html: () => `
      <div class="wl__art wl__glyph" aria-hidden="true">${icon("square-lock-02")}</div>
      <h1 class="wl__title" id="setup-title" tabindex="-1"></h1>
      <p class="wl__text" id="setup-text"></p>
      <ul class="wl__list" id="setup-list"></ul>`,
    next: () => (ready(perms) ? { label: "Continue", kind: "primary" } : { label: "Skip for now", kind: "secondary" }),
    enter: () => renderSetup(),
  };
}

function defaultsStep(): Step {
  return {
    id: "defaults",
    html: () => `
      <h1 class="wl__title" tabindex="-1" style="margin-top:0">Your defaults</h1>
      <p class="wl__text">You can change any of these later from the panel.</p>
      <div class="wl__field">
        <div class="wl__label" id="dur-label">Unlock after</div>
        <div class="hb-seg wl__seg" role="radiogroup" aria-labelledby="dur-label" id="w-durations"></div>
      </div>
      <ul class="wl__list" id="w-switches"></ul>`,
    next: () => ({ label: "Continue", kind: "primary" }),
    enter: () => renderDefaults(),
  };
}

function doneStep(): Step {
  const title = `Hushboard lives in your ${where()}`;
  const text =
    platform === "windows"
      ? "Click the icon to open it, or right-click to lock in one step. If you don't see it, try the ^ arrow."
      : platform === "linux"
        ? "Use the keyboard icon for quick locks, or open the window for everything else."
        : "Click the icon to open it, or right-click to lock in one step.";
  return {
    id: "done",
    html: () => `
      <div class="wl__art wl__bar-stage" aria-hidden="true">
        <div class="wl__bar" data-platform="${platform}"><i class="dot"></i><i></i><span class="wl__bar-time">9:41</span><span class="wl__bar-icon">${KEYBOARD_GLYPH}</span></div>
        <div class="wl__mini"><b></b><b></b><em></em></div>
        ${CURSOR}
      </div>
      <h1 class="wl__title" tabindex="-1">${title}</h1>
      <p class="wl__text">${text}</p>`,
    next: () => ({ label: "Open Hushboard", kind: "primary" }),
  };
}

interface TaskView {
  key: string;
  state: "todo" | "active" | "done";
  title: string;
  meta: string;
  action: string;
}

function tasks(p: Permissions): TaskView[] {
  if (p.platform === "linux") {
    const done = p.inputDevices === "granted";
    return [
      {
        key: "input",
        state: done ? "done" : "active",
        title: "Allow access to your keyboards",
        meta: done
          ? "Hushboard can read your keyboards."
          : `Run this, then log out and back in.<code class="wl__cmd">sudo usermod -aG input $USER</code>`,
        action: done ? "" : `<button class="hb-btn hb-btn--secondary" type="button" data-action="copy-cmd">Copy</button>`,
      },
    ];
  }
  const installed = p.helper === "ready" || p.helper === "needs-approval";
  const approved = p.helper === "ready";
  return [
    {
      key: "install",
      state: installed ? "done" : "active",
      title: p.helper === "outdated" ? "Update the keyboard helper" : "Install the keyboard helper",
      meta: installed ? "Installed." : "Asks for your Mac password once.",
      action: installed
        ? ""
        : `<button class="hb-btn hb-btn--primary" type="button" data-action="install-helper">${p.helper === "outdated" ? "Update" : "Install"}</button>`,
    },
    {
      key: "allow",
      state: approved ? "done" : installed ? "active" : "todo",
      title: "Allow it in Input Monitoring",
      meta: approved ? "Allowed." : "Switch on Hushboard Keyboard Helper. Hushboard notices on its own.",
      action:
        installed && !approved
          ? `<button class="hb-btn hb-btn--primary" type="button" data-action="helper-settings">Open settings</button>`
          : "",
    },
  ];
}

function renderSetup() {
  if (stepEls[index]?.dataset.step !== "setup") {
    if (stepEls.length) updateFooter();
    return;
  }
  const list = document.getElementById("setup-list");
  if (!list || !perms) return;
  const views = tasks(perms);
  const firstRender = list.dataset.ready === undefined;
  const wasReady = list.dataset.ready === "true";
  const nowReady = ready(perms);
  let finished = false;
  for (const v of views) {
    let li = list.querySelector<HTMLElement>(`[data-key="${v.key}"]`);
    if (!li) {
      li = document.createElement("li");
      li.className = "wl__task";
      li.dataset.key = v.key;
      li.innerHTML = `<span class="wl__tick" aria-hidden="true">${CHECK}</span>
        <div><div class="wl__task-title"></div><div class="wl__task-meta"></div></div>
        <div class="wl__task-action"></div>`;
      li.dataset.state = "todo";
      list.append(li);
      void li.offsetWidth;
      li.dataset.state = v.state;
    } else if (li.dataset.state !== v.state) {
      if (v.state === "done") finished = true;
      li.dataset.state = v.state;
    }
    const title = li.querySelector<HTMLElement>(".wl__task-title")!;
    const meta = li.querySelector<HTMLElement>(".wl__task-meta")!;
    const action = li.querySelector<HTMLElement>(".wl__task-action")!;
    if (title.textContent !== v.title) title.textContent = v.title;
    if (meta.innerHTML !== v.meta) meta.innerHTML = v.meta;
    if (action.innerHTML !== v.action) action.innerHTML = v.action;
  }
  list.dataset.ready = String(nowReady);
  if (finished && !nowReady) void playOn();
  if (nowReady && !wasReady && !firstRender) void playDone();

  const title = $("setup-title");
  const text = $("setup-text");
  const t = nowReady ? "The keyboard lock is ready" : platform === "linux" ? "Allow keyboard access" : "Set up the keyboard lock";
  const x = nowReady
    ? "Nothing you type is recorded. You can change this later from the panel."
    : "Hushboard needs this once so the lock works everywhere. Nothing you type is recorded.";
  if (title.textContent !== t) title.textContent = t;
  if (text.textContent !== x) text.textContent = x;
  updateFooter();
}

function renderDefaults() {
  const seg = document.getElementById("w-durations");
  const list = document.getElementById("w-switches");
  if (!seg || !list) return;
  if (!seg.children.length) {
    seg.innerHTML = DURATIONS.map(
      (d, i) =>
        `<button type="button" role="radio" data-i="${i}" aria-checked="false" tabindex="-1">${d.label}</button>`,
    ).join("");
    list.innerHTML = [
      switchRow("autostart", "Open at login", "Start quietly in the " + where(), "login-03"),
      switchRow("sound", "Launch sound", "A soft sound when Hushboard opens", "sparkles"),
    ].join("");
  }
  for (const b of Array.from(seg.children) as HTMLButtonElement[]) {
    const on = DURATIONS[Number(b.dataset.i)].secs === settings.durationSecs;
    b.setAttribute("aria-checked", String(on));
    b.tabIndex = on ? 0 : -1;
  }
  list.querySelector('[data-key="autostart"]')?.setAttribute("aria-checked", String(autostart));
  list.querySelector('[data-key="sound"]')?.setAttribute("aria-checked", String(settings.sound));
}

function switchRow(key: string, label: string, meta: string, name: Parameters<typeof icon>[0]): string {
  return `<li class="wl__row wl__row--switch">${icon(name)}
    <label for="sw-${key}"><span>${label}</span><span class="wl__row-meta">${meta}</span></label>
    <button class="hb-switch" id="sw-${key}" type="button" role="switch" aria-checked="false" data-key="${key}"></button></li>`;
}

function updateFooter() {
  const step = steps[index];
  const next = step.next();
  const btn = $<HTMLButtonElement>("next");
  if (btn.textContent !== next.label) btn.textContent = next.label;
  btn.className = `hb-btn wl__next hb-btn--${next.kind}`;
  $("back").hidden = index === 0;
  document.querySelectorAll<HTMLElement>(".wl__dot").forEach((d, i) => {
    d.dataset.on = String(i === index);
    d.dataset.done = String(i < index);
  });
  $("dots").setAttribute("aria-label", `Step ${index + 1} of ${steps.length}`);
}

function go(to: number, sound = true) {
  if (to < 0 || to >= steps.length || to === index) return;
  stepEls[index].dataset.state = to > index ? "before" : "after";
  stepEls[index].setAttribute("aria-hidden", "true");
  index = to;
  const el = stepEls[index];
  el.dataset.state = "active";
  el.removeAttribute("aria-hidden");
  steps[index].enter?.();
  updateFooter();
  window.setTimeout(() => el.querySelector<HTMLElement>(".wl__title")?.focus({ preventScroll: true }), 60);
  if (sound) void playStep();
}

async function finish() {
  const btn = $<HTMLButtonElement>("next");
  btn.disabled = true;
  saveSettings(settings);
  void playDone();
  $("wl").dataset.leaving = "true";
  await sleep(240);
  await api.finishWelcome();
}

function advance() {
  if (index === steps.length - 1) void finish();
  else go(index + 1);
}

let toastTimer: number | undefined;
function toast(text: string) {
  const t = $("toast");
  t.innerHTML = `${icon("alert-02")}<span>${escapeHtml(text)}</span>`;
  t.hidden = false;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (t.hidden = true), 5000);
}

function applySystem(system: SystemState) {
  perms = system.permissions;
  renderSetup();
}

async function refresh(thorough: boolean) {
  applySystem(await api.refreshSystem(thorough));
}

$("stage").addEventListener("click", async (e) => {
  const target = e.target as HTMLElement;

  const seg = target.closest<HTMLButtonElement>("#w-durations button[data-i]");
  if (seg) {
    settings.durationSecs = DURATIONS[Number(seg.dataset.i)].secs;
    saveSettings(settings);
    renderDefaults();
    void playStep();
    return;
  }

  const sw = target.closest<HTMLButtonElement>("#w-switches button[data-key]");
  if (sw) {
    if (sw.dataset.key === "autostart") {
      autostart = await api.setAutostart(!autostart).catch(() => {
        toast("Couldn't change Open at login. Try again from the panel.");
        return autostart;
      });
      if (autostart) void playOn();
    } else {
      settings.sound = !settings.sound;
      saveSettings(settings);
      if (settings.sound) void playOn();
    }
    renderDefaults();
    return;
  }

  const b = target.closest<HTMLButtonElement>("button[data-action]");
  if (!b) return;
  const action = b.dataset.action;
  if (action === "install-helper") {
    b.disabled = true;
    b.textContent = "Waiting for password…";
    try {
      await api.installHelper();
    } catch (err) {
      const msg = String(err);
      if (!msg.includes("cancelled")) toast(`Couldn't install the keyboard helper. ${msg}`);
    }
    await refresh(true);
    const row = document.querySelector('[data-key="install"] .wl__task-action');
    if (row && perms?.helper === "missing") row.innerHTML = `<button class="hb-btn hb-btn--primary" type="button" data-action="install-helper">Install</button>`;
  }
  if (action === "helper-settings") await api.openHelperSettings();
  if (action === "copy-cmd") {
    try {
      await navigator.clipboard.writeText("sudo usermod -aG input $USER");
      b.textContent = "Copied";
    } catch {
      toast("Couldn't copy. Select the command and copy it by hand.");
    }
  }
});

$("next").addEventListener("click", advance);
$("back").addEventListener("click", () => go(index - 1));

window.addEventListener("keydown", (e) => {
  const target = e.target as HTMLElement;
  if (target.closest("#w-durations")) {
    if (!["ArrowLeft", "ArrowRight"].includes(e.key)) return;
    e.preventDefault();
    const i = DURATIONS.findIndex((d) => d.secs === settings.durationSecs);
    const step = e.key === "ArrowLeft" ? -1 : 1;
    settings.durationSecs = DURATIONS[(i + step + DURATIONS.length) % DURATIONS.length].secs;
    saveSettings(settings);
    renderDefaults();
    document.querySelector<HTMLButtonElement>('#w-durations [aria-checked="true"]')?.focus();
    return;
  }
  if ((e.key === "ArrowRight" || e.key === "Enter") && !(target instanceof HTMLButtonElement)) advance();
  if (e.key === "ArrowLeft" && !(target instanceof HTMLButtonElement)) go(index - 1);
});

window.addEventListener("focus", () => {
  if (needsSetup()) void refresh(true);
});

async function boot() {
  const [system, auto] = await Promise.all([api.refreshSystem(false), api.getAutostart().catch(() => false)]);
  perms = system.permissions;
  platform = perms.platform;
  autostart = auto;

  steps = [introStep(), exitsStep(), ...(needsSetup() ? [setupStep()] : []), defaultsStep(), doneStep()];
  const stage = $("stage");
  stepEls = steps.map((s, i) => {
    const el = document.createElement("section");
    el.className = "wl__step";
    el.dataset.step = s.id;
    el.dataset.state = i === 0 ? "active" : "after";
    if (i !== 0) el.setAttribute("aria-hidden", "true");
    el.innerHTML = s.html();
    stage.append(el);
    return el;
  });
  $("dots").innerHTML = steps.map(() => `<span class="wl__dot"></span>`).join("");
  updateFooter();
  await api.onSystem(applySystem);

  await Promise.race([document.fonts.ready, sleep(800)]);
  await sleep(60);
  await sleep(140);
  $("wl").dataset.live = "true";
  void playLaunch();
  stepEls[0].querySelector<HTMLElement>(".wl__title")?.focus({ preventScroll: true });
}

void boot();
