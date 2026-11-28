import { moments } from "@/content/testimonials";
import { Reveal } from "./Reveal";
import { TestimonialCoverflow } from "./ui/testimonial-coverflow";

// Where testimonials would sit. Hushboard is new and has no reviews yet, so this shows the
// everyday moments it's made for instead. No names, no made-up quotes.
export function Testimonials() {
  return (
    <section aria-labelledby="moments-title" className="mx-auto max-w-6xl overflow-x-clip px-5 py-16 sm:py-24">
      <div className="text-center">
        <Reveal as="p" variant="soft" className="text-xs font-semibold uppercase tracking-[0.14em] text-seal">
          When it comes in handy
        </Reveal>
        <Reveal
          as="h2"
          id="moments-title"
          delay={80}
          className="mt-4 text-[clamp(2rem,4.6vw,3.4rem)] font-semibold tracking-[-0.045em]"
        >
          Made for moments like these
        </Reveal>
        <Reveal as="p" variant="soft" delay={160} className="mx-auto mt-4 max-w-md text-ink-muted">
          A few everyday reasons to lock the keyboard for a minute.
        </Reveal>
      </div>
      <Reveal variant="scale" delay={240} className="mx-auto mt-12 max-w-4xl">
        <TestimonialCoverflow items={moments} defaultIndex={1} />
      </Reveal>
    </section>
  );
}
