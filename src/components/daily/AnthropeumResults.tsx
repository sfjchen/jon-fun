'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { artifactScore, ARTIFACT_TIME_WINDOW, historicalYear, type Artifact, type Pin } from '@/lib/artifact-scoring'
import { ANTHROPEUM_BUCKET_SIZE, anthropeumPlacement, type AnthropeumDistribution } from '@/lib/daily/anthropeum-stats'
import { shiftDay, siteDay } from '@/lib/daily'
import { usePlayer } from '@/lib/use-player'
import {
  boardUrl,
  formatScore,
  isPracticeResult,
  onLiveRefresh,
  PUBLIC_GROUP,
  RESULTS_CHANGED,
  type BoardRow,
} from '@/lib/results'

export type ArtifactGuess = { pin: Pin; year: number; total: number }

function PlayerBoard({ day, score }: { day: string; score: number }) {
  const player = usePlayer()
  const group = player?.group ?? PUBLIC_GROUP
  const [board, setBoard] = useState<{ group: string; day: string; rows: BoardRow[] | null }>()
  useEffect(() => {
    let request: AbortController | undefined
    const reload = () => {
      request?.abort()
      const controller = new AbortController()
      request = controller
      fetch(boardUrl({ group, game: 'anthropeum', day }), { signal: controller.signal })
        .then(async (r) => (r.ok ? ((await r.json()) as { rows: BoardRow[] }).rows : null))
        .catch(() => null)
        .then((rows) => {
          if (!controller.signal.aborted)
            setBoard((previous) =>
              rows || previous?.group !== group || previous.day !== day ? { group, day, rows } : previous,
            )
        })
    }
    reload()
    const stop = onLiveRefresh(reload)
    window.addEventListener(RESULTS_CHANGED, reload)
    return () => {
      stop()
      request?.abort()
      window.removeEventListener(RESULTS_CHANGED, reload)
    }
  }, [day, group])

  const rows = board?.group === group && board.day === day ? board.rows : undefined
  const ranked = rows?.filter((r) => r.game === 'anthropeum' && r.day === day).sort((a, b) => b.score - a.score)
  const mine = ranked?.find((r) => player?.name.toLowerCase() === r.name.toLowerCase())
  const rank = (points: number) => 1 + (ranked?.filter((r) => r.score > points).length ?? 0)
  return (
    <div className="space-y-3 border-t pt-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-lora text-xl">{group === PUBLIC_GROUP ? 'sfjc.dev public board' : `Group ${group}`}</h3>
        <Link className="text-sm underline" href={`/leaderboards?d=${day}&game=anthropeum`}>
          Full leaderboard
        </Link>
      </div>
      {ranked?.length ? (
        <>
          <p className="text-sm">
            {mine
              ? `Your ranked score is #${rank(mine.score)} of ${ranked.length}.`
              : 'Your score will appear after it syncs.'}{' '}
            Board average {formatScore(ranked.reduce((sum, r) => sum + r.score, 0) / ranked.length)}.
          </p>
          {mine && mine.score !== score && (
            <p className="text-sm">The board keeps your first finished score of {formatScore(mine.score)}.</p>
          )}
          <table className="w-full text-left text-sm tabular-nums">
            <thead>
              <tr>
                <th scope="col">Rank</th>
                <th scope="col">Player</th>
                <th scope="col" className="text-right">
                  Score
                </th>
              </tr>
            </thead>
            <tbody>
              {ranked.slice(0, 5).map((r) => (
                <tr key={r.name} className="border-t">
                  <td className="py-1">{rank(r.score)}</td>
                  <th scope="row" className={r === mine ? 'font-semibold' : 'font-normal'}>
                    {r.name}
                    {r === mine && ' (you)'}
                  </th>
                  <td className="text-right">{formatScore(r.score)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : (
        <p className="text-sm">
          {ranked
            ? 'No saved scores for this day yet.'
            : rows === null
              ? 'Board scores are temporarily unavailable.'
              : 'Loading board scores…'}
        </p>
      )}
    </div>
  )
}

function PersonalScores() {
  const days = new Map<string, number>()
  const today = siteDay()
  try {
    for (const key of Object.keys(localStorage)) {
      const match = /^anthropeum:v2:(\d{4}-\d{2}-\d{2}):\1$/.exec(key)
      const day = match?.[1]
      if (!day || day > today || isPracticeResult('anthropeum', day)) continue
      const guesses: unknown = JSON.parse(localStorage.getItem(key) ?? 'null')
      if (!Array.isArray(guesses) || guesses.length !== 10 || !guesses.every((g) => Number.isFinite(g?.total))) continue
      days.set(
        day,
        guesses.reduce((sum, guess) => sum + guess.total, 0),
      )
    }
  } catch {}
  const scores = [...days.values()]
  if (!scores.length) return null
  let streak = 0
  for (let day = days.has(today) ? today : shiftDay(today, -1); days.has(day); day = shiftDay(day, -1)) streak++
  return (
    <div className="space-y-2 border-t pt-5">
      <h3 className="font-lora text-xl">Your scores on this device</h3>
      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        {[
          ['Games played', scores.length],
          ['Current streak', streak + (streak === 1 ? ' day' : ' days')],
          ['Average score', formatScore(scores.reduce((sum, score) => sum + score, 0) / scores.length)],
          ['Best score', formatScore(Math.max(...scores))],
        ].map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd className="text-lg font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

function OriginalChart({ distribution, score }: { distribution: AnthropeumDistribution; score: number }) {
  const placement = anthropeumPlacement(distribution, score)
  const [focused, setFocused] = useState<number>()
  if (!placement) return <p>No scores have been reported by Anthropeum for this day yet.</p>
  const { buckets, totalPlayers } = distribution
  const peak = Math.max(...buckets)
  const selected = focused ?? placement.bucket
  const range = (i: number) =>
    `${formatScore(i * ANTHROPEUM_BUCKET_SIZE)}–${formatScore((i + 1) * ANTHROPEUM_BUCKET_SIZE - Number(i < buckets.length - 1))}`
  return (
    <figure className="space-y-3">
      <div className="grid grid-cols-3 gap-2 text-sm">
        <p>
          <strong className="block text-xl">Top {placement.top}%</strong>Estimated placement
        </p>
        <p>
          <strong className="block text-xl">{formatScore(totalPlayers)}</strong>Original players
        </p>
        <p>
          <strong className="block text-xl">{formatScore(placement.mean)}</strong>Estimated average
        </p>
      </div>
      <div
        className="flex h-28 items-end gap-px border-b border-current sm:gap-0.5"
        role="group"
        aria-label="Original Anthropeum player score distribution"
        onPointerLeave={() => setFocused(undefined)}
      >
        {buckets.map((count, i) => (
          <button
            key={i}
            type="button"
            aria-label={`${range(i)} points, ${count} players${i === placement.bucket ? ', your score range' : ''}`}
            tabIndex={i === selected ? 0 : -1}
            onPointerEnter={() => setFocused(i)}
            onClick={() => setFocused(i)}
            onFocus={() => setFocused(i)}
            onKeyDown={(e) => {
              const next = i + (e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0)
              if (next === i || next < 0 || next >= buckets.length) return
              e.preventDefault()
              const sibling = next > i ? e.currentTarget.nextElementSibling : e.currentTarget.previousElementSibling
              ;(sibling as HTMLElement | null)?.focus()
            }}
            className="flex h-full min-w-0 flex-1 items-end focus-visible:outline focus-visible:outline-2"
          >
            <span
              className={`w-full ${i === placement.bucket ? 'bg-[#7a1f1a]' : i === selected ? 'bg-[#856753]' : 'bg-[#bdad96]'}`}
              style={{ height: `${Math.max(i === placement.bucket ? 3 : 0, (count / peak) * 100)}%` }}
            />
          </button>
        ))}
      </div>
      <div className="flex justify-between text-xs tabular-nums">
        <span>0</span>
        <span>25,000</span>
        <span>50,000</span>
        <span>75,000</span>
        <span>100,000</span>
      </div>
      <figcaption className="text-sm tabular-nums">
        {selected === placement.bucket ? 'Your range · ' : ''}
        {range(selected)} points · {formatScore(buckets[selected]!)} players
      </figcaption>
    </figure>
  )
}

export default function AnthropeumResults({
  day,
  sourceDate,
  score,
  artifacts,
  guesses,
  practice,
  share,
  copied,
}: {
  day: string
  sourceDate: string
  score: number
  artifacts: Artifact[]
  guesses: ArtifactGuess[]
  practice: boolean
  share: (placement?: number) => void
  copied: boolean
}) {
  const [distribution, setDistribution] = useState<AnthropeumDistribution | null>()
  useEffect(() => {
    if (practice) return
    let request: AbortController | undefined
    const reload = () => {
      request?.abort()
      const controller = new AbortController()
      request = controller
      fetch(`/api/anthropeum/distribution?d=${sourceDate}`, { signal: controller.signal })
        .then(async (r) => (r.ok ? ((await r.json()) as AnthropeumDistribution) : null))
        .catch(() => null)
        .then((value) => {
          if (!controller.signal.aborted) setDistribution((previous) => value ?? previous ?? null)
        })
    }
    reload()
    const stop = onLiveRefresh(reload)
    return () => {
      stop()
      request?.abort()
    }
  }, [sourceDate, practice])

  const rounds = artifacts.map((artifact, i) => {
    const { pin, year } = guesses[i]!
    return { artifact, pin, year, ...artifactScore(artifact, pin, year) }
  })
  const points = (part: 'location' | 'time') => formatScore(rounds.reduce((sum, round) => sum + round[part], 0))
  const placement = distribution ? anthropeumPlacement(distribution, score) : null
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-5xl tabular-nums">
          {formatScore(score)} <span className="text-lg text-[var(--ink-muted)]">/ 100,000</span>
        </p>
        <button className="anthro-button" data-hotkey="s" onClick={() => share(placement?.top)}>
          {copied ? 'Copied' : 'Share result'}
        </button>
      </div>
      <p className="text-sm tabular-nums">
        Location <strong>{points('location')} / 50,000</strong> · Time <strong>{points('time')} / 50,000</strong>
      </p>
      {!practice && (
        <>
          <div className="space-y-3 border-t pt-5">
            <h3 className="font-lora text-xl">How you compare on Anthropeum</h3>
            {distribution ? (
              <OriginalChart distribution={distribution} score={score} />
            ) : (
              <p className="text-sm">
                {distribution === null
                  ? 'Original player statistics are temporarily unavailable.'
                  : 'Loading original player statistics…'}
              </p>
            )}
          </div>
          <PlayerBoard day={day} score={score} />
          <PersonalScores />
        </>
      )}
      <div className="space-y-3 border-t pt-5">
        <h3 className="font-lora text-xl">Artifact review</h3>
        {!!distribution?.roundPlayers && (
          <p className="text-sm">
            Artifact averages use {formatScore(distribution.roundPlayers)} original players with round scores.
          </p>
        )}
        <ol className="grid gap-x-6 sm:grid-cols-2">
          {rounds.map(({ artifact, pin, year, location, time, total, km, years }) => {
            const sum = distribution?.roundSums[String(artifact.id)]
            const average = distribution?.roundPlayers && sum !== undefined ? sum / distribution.roundPlayers : null
            return (
              <li key={artifact.id} className="space-y-1 border-b py-3 text-sm">
                <h4 className="font-lora text-base">{artifact.title}</h4>
                <p>{[artifact.culture, artifact.objectDate].filter(Boolean).join(' · ')}</p>
                <p className="tabular-nums">
                  <strong>{formatScore(total)} / 10,000</strong>
                  {average !== null && ` · Player average ${formatScore(average)}`}
                </p>
                <p className="tabular-nums">
                  Location {formatScore(location)} · Time {formatScore(time)}
                </p>
                <p>
                  {artifact.polygons?.length
                    ? km
                      ? `${formatScore(km)} km from the region`
                      : 'Inside the region'
                    : 'No mapped region'}{' '}
                  · {years ? `${formatScore(years)} years outside the range` : 'Within the date range'}
                </p>
                <details>
                  <summary className="cursor-pointer underline">Review guess and artifact</summary>
                  <p className="mt-2">
                    Your guess was {Math.abs(pin.lat).toFixed(1)}° {pin.lat < 0 ? 'S' : 'N'},{' '}
                    {Math.abs(pin.lon).toFixed(1)}° {pin.lon < 0 ? 'W' : 'E'} and {historicalYear(year)} –{' '}
                    {historicalYear(year + ARTIFACT_TIME_WINDOW)}.
                  </p>
                  {artifact.civilization && <p>Historical region · {artifact.civilization.polity}</p>}
                  {artifact.description && <p className="my-2">{artifact.description}</p>}
                  <a href={artifact.metUrl} target="_blank" rel="noreferrer" className="underline">
                    Museum record ↗
                  </a>
                </details>
              </li>
            )
          })}
        </ol>
      </div>
    </>
  )
}
