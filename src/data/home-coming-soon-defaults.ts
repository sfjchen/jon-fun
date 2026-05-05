/** Defaults for `/` Coming Soon tile + modal; API falls back when DB row missing. */
export type HomeComingSoonCopy = {
  headline: string
  intro: string
  bullets: string[]
}

export const HOME_COMING_SOON_DEFAULTS: HomeComingSoonCopy = {
  headline: 'Coming Soon',
  intro: "We're working hard to bring you these exciting new features:",
  bullets: [
    'Deeper Web E-Reader polish: cleaner imports, smoother offline reading, and sharper reading UX',
    'Small, repeatable local-first drills: typing speed, Zetamac-style arithmetic, and logic puzzles',
    'A few stronger experiments instead of a wider account/chat/friend-system surface',
    'Selective multiplayer polish only where it clearly improves actual game nights',
  ],
}
