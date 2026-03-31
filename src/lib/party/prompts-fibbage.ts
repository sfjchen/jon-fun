export type FibbagePrompt = {
  category: string
  template: string
  truth: string
}

export const FIBBAGE_BANK: FibbagePrompt[] = [
  {
    category: 'Science',
    template: 'The planet ___ was named after the Roman god of war.',
    truth: 'Mars',
  },
  {
    category: 'Animals',
    template: 'A group of crows is called a ___.',
    truth: 'murder',
  },
  {
    category: 'Food',
    template: 'The sandwich was supposedly invented by the Earl of ___.',
    truth: 'Sandwich',
  },
  {
    category: 'History',
    template: 'The Great Fire of London started in a ___.',
    truth: 'bakery',
  },
  {
    category: 'Space',
    template: 'The first human-made object to leave the solar system was ___.',
    truth: 'Voyager 1',
  },
]

export const FIBBAGE_SUGGESTED_LIES: string[] = [
  'waffles',
  'Tuesday',
  'a very small horse',
  'Bluetooth',
  'the moon',
  'taxes',
  'soup',
  'regret',
]
