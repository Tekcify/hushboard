"use client";

// Adapted from the "testimonial-coverflow" component: restyled for Hushboard's dark clay palette,
// showing everyday moments instead of quotes, and set to play on its own. It advances every few
// seconds, with a countdown on the active dot, and holds while the pointer rests on the cards,
// while you drag, or while it's off screen. The arrows and dots move it and it keeps playing.

import * as React from "react";
import {
  animate,
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { Baby, Cat, ChevronLeft, ChevronRight, Droplets, Laptop, Sandwich, Video, type LucideIcon } from "lucide-react";
import type { Moment, MomentIcon } from "@/content/testimonials";
import { cn } from "@/lib/utils";

const ICONS: Record<MomentIcon, LucideIcon> = {
  lunch: Sandwich,
  call: Video,
  cat: Cat,
  spill: Droplets,
  laptop: Laptop,
  kids: Baby,
};

const CLAY = "linear-gradient(135deg, var(--seal-strong), var(--seal) 45%, var(--seal-edge))";
const AUTOPLAY_SECONDS = 5;

function Card({
  item,
  i,
  pos,
  w,
  reduce,
  active,
}: {
  item: Moment;
  i: number;
  pos: MotionValue<number>;
  w: number;
  reduce: boolean;
  active: boolean;
}) {
  const Icon = ICONS[item.icon];
  // How far this card is from the middle, in cards. Everything else follows from it.
  const d = useTransform(pos, (p) => i - p);
  const x = useTransform(d, (v) =>
    reduce ? v * (w + 16) : Math.sign(v) * Math.min(Math.abs(v), 1) * w * 0.64 + Math.max(0, Math.abs(v) - 1) * w * 0.3 * Math.sign(v),
  );
  const rotateY = useTransform(d, (v) => (reduce ? 0 : Math.max(-1.4, Math.min(1.4, v)) * -36));
  const scale = useTransform(d, (v) => (reduce ? 1 : 1 - Math.min(Math.abs(v), 2) * 0.11));
  const z = useTransform(d, (v) => (reduce ? 0 : -Math.min(Math.abs(v), 2) * 130));
  const opacity = useTransform(d, (v) => Math.max(0, 1 - Math.abs(v) * (reduce ? 1 : 0.4)));
  const zIndex = useTransform(d, (v) => 100 - Math.round(Math.abs(v) * 10));
  const filter = useTransform(d, (v) =>
    reduce ? "none" : `blur(${Math.min(Math.abs(v), 2) * 1.6}px) brightness(${1 - Math.min(Math.abs(v), 1.5) * 0.25})`,
  );
  // Parallax: the inner layers slide at different speeds as the card passes the middle.
  const slow = useTransform(d, (v) => (reduce ? 0 : v * -30));
  const mid = useTransform(d, (v) => (reduce ? 0 : v * -14));
  const fast = useTransform(d, (v) => (reduce ? 0 : v * 22));
  // The light on the card swings with it, like a reflection.
  const sheen = useTransform(d, (v) => `${50 - v * 60}%`);
  const shine = useMotionTemplate`radial-gradient(120% 80% at ${sheen} 0%, rgba(255,240,228,0.07), transparent 60%)`;

  const face = (
    <>
      <motion.div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: shine }} />
        <motion.div
          aria-hidden
          className="pointer-events-none absolute -right-12 -top-14 size-48 rounded-full blur-3xl"
          style={{ x: fast, background: "color-mix(in oklab, var(--seal) 16%, transparent)" }}
        />
        <motion.span
          style={{ x: mid, background: CLAY }}
          className="relative grid size-12 place-items-center rounded-2xl text-on-seal shadow-[0_4px_10px_-4px_rgba(240,138,93,0.45),inset_0_1px_rgba(255,255,255,0.35)]"
        >
          <Icon className="size-6" strokeWidth={1.9} aria-hidden />
        </motion.span>
        <motion.h3 style={{ x: slow }} className="relative mt-6 text-xl font-semibold tracking-[-0.02em] text-ink">
          {item.title}
        </motion.h3>
        <motion.p style={{ x: slow }} className="relative mt-2.5 text-[0.98rem] leading-relaxed text-ink-muted">
          {item.body}
        </motion.p>
        <motion.span
          style={{ x: fast }}
          className="relative mt-auto w-fit rounded-full border border-seal/30 bg-suds/60 px-3 py-1 font-mono text-[11px] text-on-suds"
        >
          {item.setting}
        </motion.span>
    </>
  );
  const frame = cn(
    "relative flex h-[21rem] flex-col overflow-hidden rounded-[28px] border bg-surface-raised p-7 transition-colors duration-500 min-[400px]:h-[19.5rem] sm:h-[18.25rem]",
    active ? "border-seal/35" : "border-line",
  );

  return (
    <motion.li
      aria-hidden={!active}
      aria-roledescription="slide"
      aria-label={`${i + 1}: ${item.title}`}
      className="absolute left-1/2 top-0 list-none"
      style={{ width: w, marginLeft: -w / 2, x, rotateY, scale, z, opacity, zIndex, filter, transformStyle: "preserve-3d" }}
    >
      <figure className={frame} style={{ boxShadow: "0 18px 40px -28px rgba(13,11,9,0.7), inset 0 1px rgba(255,255,255,0.05)" }}>
        {face}
      </figure>
      {/* The reflection on the glossy floor: the same card flipped, faint, and fading with distance. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-full mt-1.5"
        style={{
          maskImage: "linear-gradient(to bottom, rgba(0,0,0,0.16), transparent 40%)",
          WebkitMaskImage: "linear-gradient(to bottom, rgba(0,0,0,0.16), transparent 40%)",
        }}
      >
        <div className={cn(frame, "-scale-y-100 blur-[2px]")}>{face}</div>
      </div>
    </motion.li>
  );
}

export function TestimonialCoverflow({
  items,
  label = "Moments Hushboard is made for",
  defaultIndex = 0,
  className,
}: {
  items: Moment[];
  label?: string;
  defaultIndex?: number;
  className?: string;
}) {
  const reduce = !!useReducedMotion();
  const root = React.useRef<HTMLDivElement>(null);
  const stage = React.useRef<HTMLDivElement>(null);
  const [w, setW] = React.useState(400);
  const [index, setIndex] = React.useState(defaultIndex);
  const pos = useMotionValue(defaultIndex);
  // 0 to 1 while the current card waits its turn; fills the active dot.
  const tick = useMotionValue(0);
  const [grabbing, setGrabbing] = React.useState(false);
  const [hovering, setHovering] = React.useState(false);
  const [focused, setFocused] = React.useState(false);
  const [onScreen, setOnScreen] = React.useState(false);
  const down = React.useRef<{ x: number; p: number; t: number; v: number } | null>(null);

  React.useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const size = () => setW(Math.min(420, el.offsetWidth - 48));
    const ro = new ResizeObserver(size);
    ro.observe(el);
    size();
    return () => ro.disconnect();
  }, []);

  React.useEffect(() => {
    const el = root.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setOnScreen(e.isIntersecting), { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const goTo = React.useCallback(
    (n: number, velocity = 0) => {
      const t = Math.max(0, Math.min(items.length - 1, n));
      setIndex(t);
      tick.set(0);
      animate(pos, t, reduce ? { duration: 0.2 } : { type: "spring", stiffness: 140, damping: 19, velocity });
    },
    [items.length, pos, reduce, tick],
  );

  // Autoplay. It holds while the pointer rests on the cards (or keyboard focus is inside), picks
  // up where the countdown left off, and loops. Clicking the arrows or dots keeps it going.
  const running = !reduce && !hovering && !focused && !grabbing && onScreen;
  const step = (n: number) => goTo((index + n + items.length) % items.length);
  React.useEffect(() => {
    if (!running) return;
    const controls = animate(tick, 1, {
      duration: (1 - tick.get()) * AUTOPLAY_SECONDS,
      ease: "linear",
      onComplete: () => goTo((index + 1) % items.length),
    });
    return () => controls.stop();
  }, [running, index, items.length, goTo, tick]);

  // Drag with momentum: the cards follow the pointer, and letting go flings to the nearest card.
  const onDown = (e: React.PointerEvent) => {
    if (reduce || (e.target as HTMLElement).closest("button")) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pos.stop();
    down.current = { x: e.clientX, p: pos.get(), t: performance.now(), v: 0 };
    setGrabbing(true);
  };
  const onMove = (e: React.PointerEvent) => {
    const d = down.current;
    if (!d) return;
    const next = d.p - (e.clientX - d.x) / (w * 0.64);
    const now = performance.now();
    d.v = ((pos.get() - next) / Math.max(1, now - d.t)) * 1000;
    d.t = now;
    pos.set(Math.max(-0.4, Math.min(items.length - 0.6, next)));
  };
  const onUp = () => {
    const d = down.current;
    down.current = null;
    setGrabbing(false);
    if (!d) return;
    goTo(Math.round(pos.get() - d.v * 0.12), -d.v);
  };
  const onKey = (e: React.KeyboardEvent) => {
    const to = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: items.length - 1 }[e.key];
    if (to === undefined) return;
    e.preventDefault();
    goTo(to);
  };

  const fill = useTransform(tick, (t) => `${t * 100}%`);
  // The highlight on the glossy floor glides the opposite way to the cards, like a reflection.
  const sheenX = useTransform(pos, [0, Math.max(1, items.length - 1)], ["68%", "32%"]);

  return (
    <div
      ref={root}
      aria-roledescription="carousel"
      aria-label={label}
      className={cn("relative w-full", className)}
      // Only keyboard focus holds it; a mouse click on an arrow leaves it playing.
      onFocusCapture={(e) => {
        if ((e.target as HTMLElement).matches(":focus-visible")) setFocused(true);
      }}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setFocused(false);
      }}
    >
      <Stage sheenX={sheenX} index={index} reduce={reduce} />

      <div
        ref={stage}
        tabIndex={0}
        role="group"
        aria-label="Use the left and right arrow keys, or drag"
        onKeyDown={onKey}
        onPointerEnter={(e) => e.pointerType === "mouse" && setHovering(true)}
        onPointerLeave={() => setHovering(false)}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        className={cn(
          "relative h-[27.5rem] touch-pan-y min-[400px]:h-[26rem] sm:h-[24.75rem] select-none rounded-3xl outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink",
          grabbing ? "cursor-grabbing" : "cursor-grab",
        )}
        style={{ perspective: 1100 }}
      >
        <ul className="relative h-full" style={{ transformStyle: "preserve-3d" }} aria-live={running ? "off" : "polite"}>
          {items.map((it, i) => (
            <Card key={it.id} item={it} i={i} pos={pos} w={w} reduce={reduce} active={i === index} />
          ))}
        </ul>
      </div>

      <div className="relative mt-6 flex items-center justify-center gap-2 sm:gap-3">
        <RoundButton label="Previous moment" onClick={() => step(-1)} reduce={reduce}>
          <ChevronLeft className="size-4" aria-hidden />
        </RoundButton>

        <div className="flex items-center rounded-full border border-line bg-surface-raised/70 px-2 py-1.5">
          {items.map((it, i) => (
            <button
              key={it.id}
              type="button"
              aria-label={`Show ${it.title}, ${i + 1} of ${items.length}`}
              aria-current={i === index}
              onClick={() => goTo(i)}
              className="grid size-5 place-items-center outline-none focus-visible:outline-2 focus-visible:outline-ink sm:size-7"
            >
              <motion.span
                className="relative block h-1.5 overflow-hidden rounded-full bg-line-strong/70"
                animate={{ width: i === index ? 26 : 6 }}
                transition={{ type: "spring", stiffness: 400, damping: 26 }}
              >
                {i === index && (
                  <motion.span
                    className="absolute inset-y-0 left-0 rounded-full"
                    style={{ width: reduce ? "100%" : fill, background: CLAY }}
                  />
                )}
              </motion.span>
            </button>
          ))}
        </div>

        <RoundButton label="Next moment" onClick={() => step(1)} reduce={reduce}>
          <ChevronRight className="size-4" aria-hidden />
        </RoundButton>
      </div>
    </div>
  );
}

// The space the cards stand in: a faint spotlight from above, a horizon behind the cards, and a
// glossy dark floor in perspective that mirrors each card. A soft highlight glides across the
// floor as the cards move, and a pool of clay light under the middle card swells when one lands.
function Stage({ sheenX, index, reduce }: { sheenX: MotionValue<string>; index: number; reduce: boolean }) {
  const gloss = useMotionTemplate`radial-gradient(28% 18% at ${sheenX} 22%, rgba(255,236,220,0.12), transparent 70%), radial-gradient(55% 40% at 50% 0%, rgba(240,138,93,0.07), transparent 70%), linear-gradient(to bottom, rgba(255,240,228,0.075), rgba(255,240,228,0.02) 45%, transparent 85%)`;
  // Where the floor meets the back wall: a little above the bottom of the cards.
  const horizon = "top-[17.5rem] min-[400px]:top-[16rem] sm:top-[14.75rem]";
  return (
    <div aria-hidden className="pointer-events-none absolute -inset-x-[8%] top-0 h-[27.5rem] min-[400px]:h-[26rem] sm:h-[24.75rem]">
      <div className="absolute inset-x-[20%] -top-16 h-56 bg-[radial-gradient(50%_60%_at_50%_0%,rgba(241,233,224,0.07),transparent)]" />

      <div
        className={cn("absolute inset-x-0 bottom-0 overflow-hidden", horizon)}
        style={{
          perspective: 420,
          // Fade in from the top as well as out at the sides and front, so there's no hard edge
          // where the floor meets the back.
          maskImage: "linear-gradient(to bottom, transparent, #000 30%), radial-gradient(50% 110% at 50% 0%, #000 35%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(to bottom, transparent, #000 30%), radial-gradient(50% 110% at 50% 0%, #000 35%, transparent 100%)",
          maskComposite: "intersect",
          WebkitMaskComposite: "source-in",
        }}
      >
        <motion.div
          className="absolute -inset-x-1/2 top-0 h-[320%] origin-top"
          style={{ rotateX: 70, background: reduce ? undefined : gloss }}
        />
      </div>


      <motion.div
        key={index}
        className={cn(
          "absolute left-1/2 h-28 w-[min(72%,540px)] -translate-x-1/2 rounded-[50%] blur-2xl",
          "top-[19rem] min-[400px]:top-[17.5rem] sm:top-[16.25rem]",
        )}
        style={{ background: "radial-gradient(closest-side, color-mix(in oklab, var(--seal) 12%, transparent), transparent)" }}
        initial={reduce ? false : { opacity: 0.45, scaleX: 0.7 }}
        animate={{ opacity: 1, scaleX: 1 }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
      />
    </div>
  );
}

function RoundButton({
  label,
  onClick,
  reduce,
  children,
}: {
  label: string;
  onClick: () => void;
  reduce: boolean;
  children: React.ReactNode;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-label={label}
      whileTap={reduce ? undefined : { scale: 0.86 }}
      whileHover={reduce ? undefined : { scale: 1.06 }}
      className="grid size-11 place-items-center rounded-full border border-line bg-surface-raised text-ink outline-none transition-colors hover:border-line-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
    >
      {children}
    </motion.button>
  );
}
