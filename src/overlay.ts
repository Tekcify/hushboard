import "./styles";
import { api, escapeKeys, formatClock, type LockState } from "./api";
import { icon } from "./icons";
import { wireHold } from "./hold";
import { loadSettings } from "./settings";
import { timingMs } from "./tokens";

const $ = (id: string) => document.getElementById(id)!;

const CIRCUMFERENCE = 628.3;
const CAUTION_MS = timingMs("caution-window");
const MAX_KEYS = 6;

const settings = loadSettings();

$("hold-icon").outerHTML = icon("square-unlock-02");
$("forever-icon").outerHTML = icon("sparkles");

// ---------- Countdown ----------
let lastAnnounced = 0;
function renderState(s: LockState) {
  if (s.phase !== "locked") return;
  const timed = s.totalMs != null && s.remainingMs != null;
  $("countdown").hidden = !timed;
  $("forever").hidden = timed;
  if (!timed) return;

  const left = s.remainingMs!;
  const caution = left <= CAUTION_MS;
  $("countdown").classList.toggle("hb-countdown--caution", caution);
  $("time").textContent = formatClock(left);
  $("time-sub").textContent = caution ? "unlocking soon" : "until unlock";
  $("arc").setAttribute("stroke-dashoffset", String(CIRCUMFERENCE * (1 - left / s.totalMs!)));

  // Screen readers: every 10 s, every second in the caution window.
  const step = caution ? 1000 : 10_000;
  const bucket = Math.ceil(left / step);
  if (bucket !== lastAnnounced) {
    lastAnnounced = bucket;
    $("countdown").setAttribute("aria-label", `${formatClock(left)} left`);
  }
}

// ---------- Swallowed keys ----------
const keys = $("keys");
keys.hidden = !settings.showKeys;
function swallowed(label: string) {
  if (!settings.showKeys) return;
  const cap = document.createElement("span");
  cap.className = `hb-key hb-key--swallowed hb-key--fresh${label === "space" ? " hb-key--space" : label.length > 1 ? " hb-key--wide" : ""}`;
  cap.textContent = label;
  keys.append(cap);
  while (keys.children.length > MAX_KEYS) keys.firstElementChild!.remove();
  window.setTimeout(() => cap.classList.remove("hb-key--swallowed", "hb-key--fresh"), 600);
}

// ---------- Hold to unlock ----------
wireHold($("hold") as HTMLButtonElement, () => api.unlock(), $("hold-label"));

// ---------- Boot ----------
async function boot() {
  const p = await api.permissions();
  $("escape-keys").innerHTML = escapeKeys(p.platform).map((k) => `<kbd>${k}</kbd>`).join("");
  renderState(await api.getState());
  await api.onState((s) => {
    // Browser simulation only; in the app, Rust closes the overlay windows.
    if (s.phase === "idle" && !("__TAURI_INTERNALS__" in window)) location.href = "index.html";
    renderState(s);
  });
  await api.onKeySwallowed(swallowed);
}

boot();
