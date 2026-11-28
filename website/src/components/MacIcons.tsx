import type { ReactNode } from "react";

// macOS-style icons for the hero MacBook, drawn here. They follow the look of the Dock and
// menu bar (rounded tiles, soft gradients, thin line glyphs) without copying Apple's artwork.

function Tile({ id, from, to, children }: { id: string; from: string; to: string; children: ReactNode }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden>
      <defs>
        <linearGradient id={`g-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={from} />
          <stop offset="1" stopColor={to} />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="14" fill={`url(#g-${id})`} />
      <rect x="2.5" y="2.5" width="59" height="59" rx="13.5" fill="none" stroke="#ffffff" strokeOpacity="0.18" />
      {children}
    </svg>
  );
}

export const DOCK: { name: string; running?: boolean; icon: ReactNode }[] = [
  {
    name: "Files",
    icon: (
      <Tile id="files" from="#7cc4ff" to="#1e74e8">
        <path d="M32 2h16c7.7 0 14 6.3 14 14v32c0 7.7-6.3 14-14 14H32Z" fill="#eef4fb" />
        <path d="M33 2c-3 9-4.6 19-3.4 30H36c-1.2 10.5.4 20.6 2.6 30" fill="none" stroke="#1b2a3a" strokeWidth="2.4" strokeLinecap="round" />
        <circle cx="20" cy="24" r="2.6" fill="#1b2a3a" />
        <circle cx="46" cy="24" r="2.6" fill="#1b2a3a" />
        <path d="M18 42c8 6 20 6 28 0" fill="none" stroke="#1b2a3a" strokeWidth="2.6" strokeLinecap="round" />
      </Tile>
    ),
  },
  {
    name: "Browser",
    icon: (
      <Tile id="web" from="#ffffff" to="#dfe3e8">
        <circle cx="32" cy="32" r="22" fill="#2a8cf0" />
        <circle cx="32" cy="32" r="22" fill="none" stroke="#1767c4" strokeWidth="1.5" />
        {Array.from({ length: 12 }, (_, i) => (
          <path key={i} d="M32 12v4" stroke="#ffffffaa" strokeWidth="1.4" transform={`rotate(${i * 30} 32 32)`} />
        ))}
        <path d="M44 20 35 35 20 44 29 29Z" fill="#ffffff" />
        <path d="M44 20 35 35 29 29Z" fill="#ff4d4d" />
      </Tile>
    ),
  },
  {
    name: "Mail",
    icon: (
      <Tile id="mail" from="#5fb8ff" to="#1673e6">
        <rect x="13" y="19" width="38" height="26" rx="4" fill="#ffffff" />
        <path d="M14 21 32 35l18-14" fill="none" stroke="#1673e6" strokeOpacity="0.35" strokeWidth="2.4" strokeLinejoin="round" />
      </Tile>
    ),
  },
  {
    name: "Messages",
    icon: (
      <Tile id="msg" from="#6be37a" to="#20b23a">
        <path d="M32 15c-11 0-19.5 7-19.5 16 0 5.2 2.9 9.6 7.3 12.4L18 50l7.7-3.8c2 .5 4.1.8 6.3.8 11 0 19.5-7 19.5-16S43 15 32 15Z" fill="#ffffff" />
      </Tile>
    ),
  },
  {
    name: "Calendar",
    icon: (
      <Tile id="cal" from="#ffffff" to="#eceef1">
        <text x="32" y="22" textAnchor="middle" fontSize="10" fontWeight="700" fill="#f2433a" fontFamily="system-ui, sans-serif">
          FRI
        </text>
        <text x="32" y="49" textAnchor="middle" fontSize="27" fontWeight="300" fill="#1d1d1f" fontFamily="system-ui, sans-serif">
          28
        </text>
      </Tile>
    ),
  },
  {
    name: "Notes",
    running: true,
    icon: (
      <Tile id="notes" from="#ffffff" to="#f1efe8">
        <path d="M2 16C2 8.3 8.3 2 16 2h32c7.7 0 14 6.3 14 14v4H2Z" fill="#ffd23f" />
        <path d="M12 31h40M12 40h40M12 49h28" stroke="#c9c5bb" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M12 23h40" stroke="#ffffff" strokeOpacity="0.9" strokeWidth="1" strokeDasharray="1 2.2" />
      </Tile>
    ),
  },
  {
    name: "Music",
    icon: (
      <Tile id="music" from="#ff6b81" to="#f0284a">
        <path d="M27 42V20l17-4v22" fill="none" stroke="#ffffff" strokeWidth="3.2" strokeLinejoin="round" />
        <ellipse cx="23" cy="43" rx="5" ry="4" fill="#ffffff" />
        <ellipse cx="40" cy="39" rx="5" ry="4" fill="#ffffff" />
      </Tile>
    ),
  },
  {
    name: "Settings",
    icon: (
      <Tile id="set" from="#a7abb1" to="#6a6e75">
        <g transform="translate(32 32)">
          {Array.from({ length: 10 }, (_, i) => (
            <rect key={i} x="-3" y="-21" width="6" height="8" rx="1.5" fill="#3d4046" transform={`rotate(${i * 36})`} />
          ))}
          <circle r="15" fill="#3d4046" />
          <circle r="11" fill="#c9ccd1" />
          <circle r="5" fill="#3d4046" />
        </g>
      </Tile>
    ),
  },
];

export function TrashIcon() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden>
      <path d="M14 14h36l-3.5 44a4 4 0 0 1-4 3.7H21.5a4 4 0 0 1-4-3.7Z" fill="#ffffff22" stroke="#ffffff66" strokeWidth="1.4" />
      {[22, 28, 34, 40].map((x) => (
        <path key={x} d={`M${x + 1} 18l-.6 39`} stroke="#ffffff40" strokeWidth="1.2" />
      ))}
      <rect x="11" y="9" width="42" height="6" rx="3" fill="#ffffff55" />
    </svg>
  );
}

/* ---------- Menu bar glyphs, drawn like the system's line icons ---------- */

export function WifiGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M12 19.6 15.1 16a4.6 4.6 0 0 0-6.2 0Z" fill="currentColor" />
      <path d="M5.6 12.6a9.2 9.2 0 0 1 12.8 0M2.4 9.2a13.8 13.8 0 0 1 19.2 0" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" />
    </svg>
  );
}

export function BatteryGlyph() {
  return (
    <svg viewBox="0 0 30 24" aria-hidden>
      <rect x="1.5" y="6.5" width="23" height="11" rx="3.2" fill="none" stroke="currentColor" strokeOpacity="0.55" strokeWidth="1.3" />
      <rect x="3.4" y="8.4" width="15.5" height="7.2" rx="1.7" fill="currentColor" />
      <path d="M26.6 10.2v3.6" stroke="currentColor" strokeOpacity="0.55" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function SearchGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <circle cx="10.5" cy="10.5" r="6.2" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="m15.2 15.2 5.2 5.2" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

export function ControlCentreGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <rect x="2.5" y="4.5" width="19" height="6" rx="3" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="18.5" cy="7.5" r="1.8" fill="currentColor" />
      <rect x="2.5" y="13.5" width="19" height="6" rx="3" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="5.5" cy="16.5" r="1.8" fill="currentColor" />
    </svg>
  );
}
