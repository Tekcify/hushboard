// Everyday moments Hushboard is made for. These describe situations, not people: there are no
// names or quotes here because nobody has sent us feedback yet. When real quotes arrive (with
// the person's okay), they can sit alongside these or replace them.
// Every detail below matches what the app does today; see the README before adding new claims.

export type MomentIcon = "lunch" | "call" | "cat" | "spill" | "laptop" | "kids";

export type Moment = {
  id: string;
  icon: MomentIcon;
  /** The situation, shown as the card's title. */
  title: string;
  /** What Hushboard does for you in that moment. */
  body: string;
  /** The lock setting that fits, shown as a small tag. */
  setting: string;
};

export const moments: Moment[] = [
  {
    id: "lunch",
    icon: "lunch",
    title: "Lunch at your desk",
    body: "Crumbs end up between the keys. Lock for a minute and wipe them out, and nothing gets typed into the document you left open.",
    setting: "1 min lock",
  },
  {
    id: "call",
    icon: "call",
    title: "Right before a call",
    body: "Give the keys a wipe while the meeting loads. Your pointer keeps working, so you can still click Join the second it's ready.",
    setting: "30 s lock",
  },
  {
    id: "cat",
    icon: "cat",
    title: "A cat on the keyboard",
    body: "Lock it until you unlock it yourself and let the cat walk across. Every key it presses shows up on screen and goes nowhere.",
    setting: "Until I unlock",
  },
  {
    id: "spill",
    icon: "spill",
    title: "Cleaning up a spill",
    body: "Take your time with a damp cloth. Hold to unlock stays on screen the whole time, and a timed lock ends on its own.",
    setting: "5 min lock",
  },
  {
    id: "laptop",
    icon: "laptop",
    title: "Laptop on a stand",
    body: "On macOS and Linux, lock just the built-in keyboard and keep typing on the one you plugged in.",
    setting: "Built-in only",
  },
  {
    id: "kids",
    icon: "kids",
    title: "Little hands on the keys",
    body: "Let them press every key they like. Nothing gets typed, deleted or sent, and the pointer stays yours.",
    setting: "Until I unlock",
  },
];
