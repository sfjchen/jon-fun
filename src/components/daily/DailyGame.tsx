'use client'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import DayNav from '@/components/daily/DayNav'
import ScoreSync from '@/components/daily/ScoreSync'
import MiniPlay, { type MiniPuzzle } from '@/components/mini/MiniPlay'
import ConnectionsPlay from '@/components/connections/ConnectionsPlay'
import { DAILY_EPOCH, siteDay, validDay } from '@/lib/daily'
import { GAMES, isPracticeResult, type GameId } from '@/lib/results'
import type { ConnectionsPuzzle } from '@/lib/connections'
import AnthropeumPlay, { type ArtifactDay } from '@/components/daily/AnthropeumPlay'
import KrillionPlay, { type KrillionPuzzle } from '@/components/daily/KrillionPlay'
type Daily = { day: string; sourceDate: string; puzzle: unknown }
export default function DailyGame({ game }: { game: Exclude<GameId, 'bee'> }) {
  const params = useSearchParams()
  const raw = params.get('d')
  const day = validDay(raw) && raw >= DAILY_EPOCH && raw <= '2100-12-31' ? raw : siteDay()
  const [response, setResponse] = useState<{ key: string; data?: Daily; error?: string } | null>(null)
  const key = `${game}:${day}`
  useEffect(() => {
    const controller = new AbortController()
    fetch(`/api/daily/${game}?d=${day}`, { signal: controller.signal }).then(async r => {
      const data = await r.json()
      if (!r.ok) throw new Error(data.error ?? 'Could not load puzzle')
      setResponse({ key, data })
    }).catch(e => { if (!controller.signal.aborted) setResponse({ key, error: e instanceof Error ? e.message : 'Could not load puzzle' }) })
    return () => controller.abort()
  }, [key, game, day])
  const data = response?.key === key ? response.data : undefined
  const error = response?.key === key ? response.error : undefined
  return <div className="mx-auto w-full max-w-3xl space-y-5" data-testid={`daily-${game}`}>
    <div className="flex flex-wrap items-center justify-between gap-2"><h1 className="font-lora text-3xl font-semibold">{GAMES[game].title}</h1><Link className="text-sm underline" href="/leaderboards">Scores & friends</Link></div>
    <DayNav day={day} path={GAMES[game].url} sourceDate={data?.sourceDate} />
    <ScoreSync />
    {data && day <= siteDay() && isPracticeResult(game, day) && <p className="text-sm">Started as a future preview · this run remains unranked.</p>}
    {error && <p role="alert" className="rounded-lg border p-4">{error}</p>}
    {!data && !error && <p>Loading the daily puzzle…</p>}
    {data && game === 'mini' && <MiniPlay key={key} puzzle={data.puzzle as MiniPuzzle} dailyDay={day} />}
    {data && game === 'connections' && <ConnectionsPlay key={key} basePath="/games/connections" idOrSlug={(data.puzzle as ConnectionsPuzzle).slug} initialPuzzle={data.puzzle as ConnectionsPuzzle} dailyDay={day} />}
    {data && game === 'anthropeum' && <AnthropeumPlay key={key} puzzle={data.puzzle as ArtifactDay} dailyDay={day} />}
    {data && game === 'krillion' && <KrillionPlay key={key} puzzle={data.puzzle as KrillionPuzzle} dailyDay={day} />}
    <p className="text-xs text-[var(--ink-muted)]">{GAMES[game].rules}</p>
    {(game === 'mini' || game === 'connections') && <Link className="text-sm underline" href="/games/archives">Browse original puzzle archives →</Link>}
  </div>
}
