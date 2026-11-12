// The small window shown while arming and locked: a notch island on macOS, a floating pill on
// Windows, a centred card on Linux. Rust opens one per monitor and sizes it per state; this page
// only draws the state it's told.
import "./styles";
import { api, escapeKeys, formatClock, inTauri, type LockState } from "./api";
import { wireHold } from "./hold";
import { icon } from "./icons";
import { loadSettings } from "./settings";
import { timingMs } from "./tokens";

declare global {
  interface Window {
    __HB_ISLAND?: { platform: string; notch: boolean };
  }
}

const $ = (id: string) => document.getElementById(id)!;
const CIRCUMFERENCE = 314.2;
const CAUTION_MS = timingMs("caution-window");
const MAX_KEYS = 4;

// Browser preview: island.html?platform=windows&state=locked
const params = new URLSearchParams(location.search);
const info = window.__HB_ISLAND ?? { platform: params.get("platform") ?? "macos", notch: params.get("notch") !== "0" };
const root = document.documentElement;
root.dataset.platform = info.platform;
root.dataset.notch = String(info.notch);
document.body.classList.add("island-body");

const settings = loadSettings();
const keys = $("keys");
keys.hidden = !settings.showKeys || info.platform === "windows";

$("arm-icon").outerHTML = icon("square-lock-02");
$("hold-icon").outerHTML = icon("square-unlock-02");
$("done-icon").outerHTML = icon("tick-02");
$("ring-icon").innerHTML = icon("square-lock-02");
// The Windows pill is short: a lock in the ring, the time in the text instead.
$("ring-icon").hidden = info.platform !== "windows";
$("time").hidden = info.platform === "windows";

const escape = escapeKeys(info.platform).join(info.platform === "macos" ? "" : " + ");
$("hint").textContent = `or ${escape}`;

let wasLocked = false;

function render(s: LockState) {
  const island = $("island");
  if (s.phase === "arming") {
    island.dataset.state = "arming";
    $("arm-count").textContent = String(Math.max(1, Math.ceil((s.armingMsLeft ?? 0) / 1000)));
  } else if (s.phase === "locked") {
    wasLocked = true;
    island.dataset.state = "locked";
    const timed = s.totalMs != null && s.remainingMs != null;
    const left = s.remainingMs ?? 0;
    const caution = timed && left <= CAUTION_MS;
    island.classList.toggle("island--caution", caution);
    $("arc").setAttribute("stroke-dashoffset", timed ? String(CIRCUMFERENCE * (1 - left / s.totalMs!)) : "0");
    $("time").textContent = timed ? formatClock(left) : "∞";
    $("ring").setAttribute("aria-label", timed ? `${formatClock(left)} left` : "No timer");
    $("sub").textContent = timed
      ? info.platform === "windows"
        ? `${formatClock(left)} left · ${escape}`
        : caution
          ? "Unlocking soon"
          : "Wipe away. The pointer still works."
      : "No timer. Unlock when you're done.";
  } else if (wasLocked && !s.error) {
    island.dataset.state = "done";
    const n = s.keysIgnored;
    $("done-count").textContent = n === 1 ? "1 key ignored" : `${n} keys ignored`;
  }
}

function swallowed(label: string) {
  if (keys.hidden) return;
  const cap = document.createElement("span");
  cap.className = `hb-key hb-key--swallowed hb-key--fresh${label === "space" ? " hb-key--wide" : label.length > 1 ? " hb-key--wide" : ""}`;
  cap.textContent = label;
  keys.append(cap);
  while (keys.children.length > MAX_KEYS) keys.firstElementChild!.remove();
  window.setTimeout(() => cap.classList.remove("hb-key--swallowed", "hb-key--fresh"), 600);
}

$("arming").addEventListener("click", () => api.unlock());
wireHold($("hold") as HTMLButtonElement, () => api.unlock(), $("hold-label"));

async function boot() {
  if (!inTauri) {
    // Static preview of each state for design work.
    const st = params.get("state") ?? "locked";
    const base = { armingMsLeft: 2400, remainingMs: 102_000, totalMs: 120_000, keysIgnored: 23, error: null };
    if (st === "done") {
      render({ ...base, phase: "locked" });
      render({ ...base, phase: "idle" });
    } else {
      render({ ...base, phase: st === "arming" ? "arming" : "locked" });
    }
    if (st === "locked") ["J", "K", "space"].forEach(swallowed);
    return;
  }
  render(await api.getState());
  await api.onState(render);
  await api.onKeySwallowed(swallowed);
}

boot();
