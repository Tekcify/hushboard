// SAMPLE QUOTES. These are written by us to fill the design and are not from real users.
// Replace each one with a real quote (and the person's okay) and set `placeholder: false`.
// Cards with `placeholder: true` show a "Sample" tag so they can't pass for real reviews.
export type Testimonial = {
  quote: string;
  name: string;
  role: string;
  placeholder: boolean;
};

export const testimonials: Testimonial[] = [
  {
    quote:
      "I used to shut the lid to clean my MacBook and then wait for it to wake up again. Now I press Lock, wipe it, and I'm back in under a minute.",
    name: "Name goes here",
    role: "Role goes here",
    placeholder: true,
  },
  {
    quote:
      "Seeing each key show up on screen while I cleaned is what sold me. I knew nothing was going into the Slack message I had open.",
    name: "Name goes here",
    role: "Role goes here",
    placeholder: true,
  },
  {
    quote:
      "Ctrl+Alt+U is easy to remember, so I never worried about getting stuck with a dead keyboard.",
    name: "Name goes here",
    role: "Role goes here",
    placeholder: true,
  },
  {
    quote:
      "My cat sleeps on my keyboard. I set it to stay locked until I unlock it, and now she can stay there as long as she likes.",
    name: "Name goes here",
    role: "Role goes here",
    placeholder: true,
  },
];
