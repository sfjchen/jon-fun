/**
 * Smoke-test POST /api/reader/suggest-chapter-structure.
 * Run `npm run dev` (or set SMOKE_BASE_URL) so the Next.js server loads server env keys.
 *
 * Usage: npx tsx scripts/smoke-reader-suggest-chapter.ts
 */

const smokeBase = (process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:3000').replace(/\/$/, '')

const body = {
  bookTitle: 'Smoke Test Book',
  sourceType: 'epub' as const,
  originalFileName: 'smoke.epub',
  chapters: [
    {
      index: 0,
      title: 'Copyright',
      wordCount: 40,
      paragraphCount: 2,
      excerptHead: 'All rights reserved. First edition 2020. No part of this book may be reproduced.',
    },
    {
      index: 1,
      title: 'Half-title',
      wordCount: 12,
      paragraphCount: 1,
      excerptHead: 'Smoke Test Book',
    },
    {
      index: 2,
      title: 'Book One — The Journey',
      wordCount: 8200,
      paragraphCount: 52,
      excerptHead: 'The morning air tasted of salt.\n\nChapter Eighteen — The Harbor\n\nThey waited until dusk.',
      excerptTail: '…and the lighthouse went dark.',
    },
  ],
}

async function main() {
  const url = `${smokeBase}/api/reader/suggest-chapter-structure`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  console.log('POST', url)
  console.log('status', res.status)
  try {
    console.log(JSON.stringify(JSON.parse(text), null, 2))
  } catch {
    console.log(text.slice(0, 1200))
  }
  if (!res.ok) process.exitCode = 1
}

void main()

export {}
