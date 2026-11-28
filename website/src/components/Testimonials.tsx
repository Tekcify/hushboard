import { testimonials } from "@/content/testimonials";
import { Reveal } from "./Reveal";

export function Testimonials() {
  return (
    <section aria-labelledby="testimonials-title" className="mx-auto max-w-6xl px-5 py-16 sm:py-24">
      <Reveal as="h2" id="testimonials-title" className="text-center text-[clamp(2rem,4.6vw,3.4rem)] font-semibold tracking-[-0.045em]">
        What people say
      </Reveal>
      <div className="mt-12 grid gap-4 md:grid-cols-2">
        {testimonials.map((t, i) => (
          <Reveal
            as="figure"
            key={i}
            variant="scale"
            delay={i * 110}
            className="relative flex flex-col justify-between gap-8 rounded-3xl border border-line bg-surface-raised p-7 sm:p-9"
          >
            <blockquote className="text-[1.08rem] leading-relaxed text-pretty">
              <span className="text-seal">“</span>
              {t.quote}
              <span className="text-seal">”</span>
            </blockquote>
            <figcaption className="flex items-center gap-3 text-sm">
              <span aria-hidden className="grid size-9 place-items-center rounded-full bg-suds font-semibold text-on-suds">
                {t.name.charAt(0)}
              </span>
              <span>
                <span className="block font-semibold">{t.name}</span>
                <span className="block text-ink-muted">{t.role}</span>
              </span>
              {t.placeholder && (
                <span className="ml-auto rounded-full border border-caution/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-caution">
                  Sample
                </span>
              )}
            </figcaption>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
