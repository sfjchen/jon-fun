/**
 * Ships a ready-to-play board styled after Jeopardy!'s best-known recurring categories (Potent Potables,
 * Rhyme Time, Before & After) so a first-time visitor can play without writing clues.
 * Clues are written in the show's answer-first style, and responses are phrased as questions.
 */

import type { JeopardyBoard } from '@/lib/jeopardy-core'

const CATS: [string, [string, string][]][] = [
  ['Potent Potables', [
    ['This Mexican spirit is distilled from the blue agave plant', 'What is tequila?'],
    ['A mimosa mixes orange juice with this bubbly wine', 'What is champagne?'],
    ['Japan\'s sake is brewed from this grain', 'What is rice?'],
    ['Gin gets its signature flavor from the berries of this evergreen shrub', 'What is juniper?'],
    ['A Moscow Mule is traditionally served in a mug made of this metal', 'What is copper?'],
  ]],
  ['Rhyme Time', [
    ['A plump kitty', 'What is a fat cat?'],
    ['An amusing rabbit', 'What is a funny bunny?'],
    ['A very lengthy tune', 'What is a long song?'],
    ['An author with a higher IQ', 'What is a brighter writer?'],
    ['A large hog\'s hairpiece', 'What is a big pig wig?'],
  ]],
  ['Before & After', [
    ['A sandwich spread meets an insect that used to be a caterpillar', 'What is peanut butterfly?'],
    ['The Footloose star meets a classic diner breakfast', 'What is Kevin Bacon and eggs?'],
    ['Simba\'s coming-of-age story meets the giant ape atop the Empire State Building', 'What is The Lion King Kong?'],
    ['Disney\'s sky-is-falling bird meets Louisa May Alcott\'s March sisters', 'What is Chicken Little Women?'],
    ['Leonardo\'s smiling portrait meets Bart\'s saxophone-playing sister', 'What is Mona Lisa Simpson?'],
  ]],
  ['Famous Firsts', [
    ['In 1969 he became the first person to walk on the Moon', 'Who is Neil Armstrong?'],
    ['In 1961 this Soviet cosmonaut became the first human in space', 'Who is Yuri Gagarin?'],
    ['The Wright brothers first flew a powered airplane in 1903 near this North Carolina town', 'What is Kitty Hawk?'],
    ['In 1903 she became the first woman to win a Nobel Prize', 'Who is Marie Curie?'],
    ['In 1844 he sent the first long-distance telegraph message: "What hath God wrought"', 'Who is Samuel Morse?'],
  ]],
  ['Science', [
    ['Its chemical formula is H2O', 'What is water?'],
    ['This planet is famous for its bright rings', 'What is Saturn?'],
    ['Au is the chemical symbol for this metal', 'What is gold?'],
    ['An adult human skeleton has this many bones', 'What is 206?'],
    ['An octopus has this many hearts', 'What is 3?'],
  ]],
]

export const SAMPLE_BOARD: JeopardyBoard = {
  id: 'sample-classic',
  version: 1,
  title: 'Classic Jeopardy',
  categories: CATS.map(([title, clues]) => ({ title, clues: clues.map(([question, answer]) => ({ question, answer })) })),
  baseValue: 200,
  increment: 200,
}
