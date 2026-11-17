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
    'Notes: meeting shorthand with ? AI lookups in a side panel',
    'Web E-Reader: cleaner imports, smoother offline reading and sharper reading UX',
    'Quip Clash: answer prompts head-to-head and vote for the funnier one',
    'Fib It: bluff-the-truth trivia where your fake answers fool friends',
    'Enough About You: bluff about each other, then spot the truth in the final round',
    'Scores: log daily results and compare with friends on group boards',
    'Mental Obstacle Course: 6-round brain benchmark with a radar chart',
    '5 Can Sorting: swap cans and deduce the hidden order',
    'Small, repeatable local-first drills: typing speed, Zetamac-style arithmetic, and logic puzzles',
  ],
}
