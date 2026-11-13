// Per-machine preferences, shared by the panel, the island and the overlays (same origin).
export interface Settings {
  durationSecs: number | null; // null = until I unlock
  deviceIds: string[];
  /** Cover every screen while locked (the full-screen view) instead of the small island. */
  coverScreen: boolean;
  showKeys: boolean;
  sound: boolean;
}

export const DURATIONS: { secs: number | null; label: string }[] = [
  { secs: 30, label: "30 s" },
  { secs: 60, label: "1 min" },
  { secs: 120, label: "2 min" },
  { secs: 300, label: "5 min" },
  { secs: null, label: "Never" },
];

const KEY = "hushboard.settings.v1";
const DEFAULTS: Settings = { durationSecs: 120, deviceIds: [], coverScreen: false, showKeys: true, sound: true };

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // Storage unavailable: settings last for this session only.
  }
}
