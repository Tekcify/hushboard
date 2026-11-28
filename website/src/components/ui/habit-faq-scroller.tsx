import type { CSSProperties, ReactNode } from "react";
import { Reveal } from "@/components/Reveal";

// Adapted from the "habit-faq-scroller" component: typed, and restyled for Hushboard's dark palette.

export type FaqItem = { id: string; question: string; answer: string };

export type FaqRow = {
  id: string;
  speed: string;
  direction: "left" | "right";
  faqItems: FaqItem[];
};

export type FaqData = {
  mainTitle: string;
  mainSubtitle: ReactNode;
  rows: FaqRow[];
};

/**
 * FaqCard
 * Reusable card for a single FAQ item.
 */
export const FaqCard = ({ question, answer }: { question: string; answer: string }) => {
  return (
    <div className="faq-card flex w-80 flex-shrink-0 flex-col items-start gap-3 rounded-2xl border border-line bg-surface-raised p-6 transition-colors hover:border-line-strong sm:w-96">
      <h3 className="faq-title text-lg font-semibold tracking-tight text-ink">{question}</h3>
      <p className="faq-answer leading-relaxed text-ink-muted">{answer}</p>
    </div>
  );
};

/**
 * HorizontalScroller
 * Wraps children and creates a seamless horizontal looping animation.
 * Hovering a row pauses it so a card can be read.
 */
export const HorizontalScroller = ({
  children,
  speed = "40s",
  direction = "left",
}: {
  children: ReactNode;
  speed?: string;
  direction?: "left" | "right";
}) => {
  const animationClass =
    direction === "right" ? "animate-scroll-horizontal-reverse" : "animate-scroll-horizontal";

  // Inline style to set the CSS custom property for scroll duration.
  const style = { "--scroll-duration": speed } as CSSProperties;

  return (
    <div className="scroller-mask group relative w-full overflow-hidden">
      <div className={`scroller-track flex w-max ${animationClass} group-hover:[animation-play-state:paused]`} style={style}>
        <div className="flex flex-shrink-0 items-stretch justify-center gap-6 px-3">{children}</div>
        {/* duplicate for seamless loop */}
        <div className="flex flex-shrink-0 items-stretch justify-center gap-6 px-3" aria-hidden="true">
          {children}
        </div>
      </div>
    </div>
  );
};

/**
 * FaqSection
 * Assembles title, subtitle, and multiple horizontal rows.
 */
const FaqSection = ({ data }: { data: FaqData }) => {
  return (
    <div className="relative flex w-full max-w-6xl flex-col items-center gap-12">
      <div className="z-10 flex max-w-2xl flex-col items-center gap-5 px-5 text-center">
        <Reveal as="h2" className="text-[clamp(2rem,4.6vw,3.4rem)] font-semibold leading-tight tracking-[-0.045em] text-ink">
          {data.mainTitle}
        </Reveal>
        <Reveal as="p" variant="soft" delay={120} className="text-lg text-ink-muted">
          {data.mainSubtitle}
        </Reveal>
      </div>

      <div className="z-10 flex w-full flex-col gap-6">
        {data.rows.map((row, i) => (
          <Reveal key={row.id} delay={i * 110}>
            <HorizontalScroller speed={row.speed} direction={row.direction}>
              {row.faqItems.map((item) => (
                <FaqCard key={item.id} question={item.question} answer={item.answer} />
              ))}
            </HorizontalScroller>
          </Reveal>
        ))}
      </div>
    </div>
  );
};

export default FaqSection;
