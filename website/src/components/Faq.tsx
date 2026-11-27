import FaqSection, { type FaqData } from "@/components/ui/habit-faq-scroller";
import { links } from "@/content/site";

// Every answer here comes from the README. Keep about four cards per row so the loop never shows a gap.
const faqData: FaqData = {
  mainTitle: "Questions",
  mainSubtitle: (
    <>
      Short answers to what people ask before installing. Something else?{" "}
      <a className="text-ink underline decoration-line-strong underline-offset-4 hover:decoration-seal" href={`${links.repo}/issues`}>
        Open an issue
      </a>
      .
    </>
  ),
  rows: [
    {
      id: "row1",
      speed: "60s",
      direction: "left",
      faqItems: [
        {
          id: "stuck",
          question: "What if I get stuck?",
          answer:
            "The pointer never locks, so you can always click and hold the Hold to unlock button. Ctrl + Alt + U works too, and a timed lock ends after 10 minutes at most.",
        },
        {
          id: "record",
          question: "Does Hushboard record what I type?",
          answer:
            "No. The names of the keys you press show on screen and stay in memory. Nothing is saved to disk or sent anywhere.",
        },
        {
          id: "mouse",
          question: "Does my mouse still work?",
          answer: "Yes. Only the keyboard locks, so you can click, scroll and drag the whole time.",
        },
        {
          id: "length",
          question: "How long can a lock last?",
          answer:
            "Pick 30 seconds to 5 minutes, or keep it locked until you unlock it yourself. A 3-second countdown runs first, so you can change your mind.",
        },
      ],
    },
    {
      id: "row2",
      speed: "45s",
      direction: "right",
      faqItems: [
        {
          id: "macos",
          question: "What does macOS ask for?",
          answer:
            "Your password once, to install a small keyboard helper, then a switch under Input Monitoring. The app walks you through both, and it's signed and notarized by Apple.",
        },
        {
          id: "windows",
          question: "Why does Windows warn me?",
          answer:
            "The installer isn't signed by Microsoft yet, so SmartScreen warns you the first time. The install guide on GitHub shows how to get past it.",
        },
        {
          id: "linux",
          question: "What do I need on Linux?",
          answer:
            "Read access to your keyboards. Run sudo usermod -aG input $USER, then log out and back in. It works on X11 and Wayland.",
        },
        {
          id: "builtin",
          question: "Can I lock only my laptop's keyboard?",
          answer:
            "On macOS and Linux, yes. Lock the built-in keyboard and keep typing on an external one. On Windows every keyboard locks at once.",
        },
      ],
    },
    {
      id: "row3",
      speed: "70s",
      direction: "left",
      faqItems: [
        {
          id: "free",
          question: "Is it free?",
          answer: "Yes. Hushboard is MIT licensed and all of the code is on GitHub.",
        },
        {
          id: "where",
          question: "Where does Hushboard live?",
          answer:
            "In the menu bar on macOS, the system tray on Windows and the panel on Linux. While locked, a small island shows the time left.",
        },
        {
          id: "updates",
          question: "Does it update itself?",
          answer: "Yes. Once it's installed, new versions arrive on their own.",
        },
        {
          id: "brew",
          question: "Can I install it with Homebrew?",
          answer: "Yes, on a Mac: brew install --cask tekcify/tap/hushboard.",
        },
        {
          id: "help",
          question: "How can I help?",
          answer:
            "Report bugs on GitHub, or test it on your own hardware. Windows and Linux testers are especially welcome.",
        },
      ],
    },
  ],
};

export function Faq() {
  return (
    <section id="faq" aria-label="Frequently asked questions" className="flex justify-center py-16 sm:py-24">
      <FaqSection data={faqData} />
    </section>
  );
}
