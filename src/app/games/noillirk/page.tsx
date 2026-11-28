import Link from 'next/link'
import { siteDay, validDay } from '@/lib/daily'

export const metadata = { title: 'Crowdict' }

const firstDay = '2026-10-15'
const publisher = 'https://crowdict.com'
const dayMs = 86400000

/** Crowdict numbers its consecutive daily editions from October 15, 2026. */
function editionNumber(day: string) {
  return 1 + (Date.parse(day) - Date.parse(firstDay)) / dayMs
}

export default async function Page({ searchParams }: { searchParams: Promise<{ d?: string | string[] }> }) {
  const { d } = await searchParams
  const today = siteDay()
  const day = validDay(d) && d >= firstDay && d <= today ? d : undefined
  const source = day ? publisher + '/archive/' + editionNumber(day) : publisher
  const invalid = d !== undefined && day === undefined

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-lora text-2xl font-bold">Crowdict</h1>
        <Link className="text-sm underline" href="/games/daily-collection">
          Daily games
        </Link>
      </div>
      <form action="/games/noillirk" method="get" className="flex flex-wrap items-center gap-2 text-sm">
        <label htmlFor="crowdict-date">Puzzle date</label>
        <input
          id="crowdict-date"
          name="d"
          type="date"
          required
          defaultValue={day ?? today}
          min={firstDay}
          max={today}
          className="rounded border border-[var(--ink-border)] bg-[var(--ink-paper)] p-2"
        />
        <button className="rounded border border-[var(--ink-border)] px-3 py-2">Open edition</button>
        <Link className="px-2 underline" href="/games/noillirk">
          Today
        </Link>
      </form>
      {invalid ? (
        <p role="alert">Choose a published date from October 15, 2026 through today.</p>
      ) : (
        <>
          <p className="text-sm text-[var(--ink-muted)]">
            To sign in or access progress saved on the publisher’s site,{' '}
            <a className="underline" href={source} target="_blank" rel="noreferrer">
              open this edition on Crowdict
            </a>
            .
          </p>
          <iframe
            title={day ? 'Crowdict puzzle for ' + day : 'Crowdict daily puzzle'}
            src={source}
            sandbox="allow-same-origin allow-scripts allow-forms"
            className="min-h-[42rem] w-full rounded-xl border border-[var(--ink-border)] bg-white"
          />
        </>
      )}
    </div>
  )
}
