'use client'

/**
 * Renders the leaderboard: a game filter, a month calendar with play and win ticks, the picked day's
 * results, a standings table (games played, average, best, wins) and the player's own stats.
 */

import Link from 'next/link'
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Info } from '@/components/daily/DayNav'
import { HomeLink } from '@/components/HomeLink'
import PlayerName, { PencilIcon } from '@/components/PlayerName'
import {
  GAMES,
  GAME_IDS,
  PLAYER_CHANGED,
  PUBLIC_GROUP,
  RESULTS_CHANGED,
  bestGameScore,
  boardName,
  compareResults,
  flushResults,
  formatGameScore,
  formatScore,
  formatTime,
  getPlayer,
  localDay,
  resultLabel,
  setPlayer,
  type BoardRow,
  type GameId,
  type Player,
} from '@/lib/results'
import { DAILY_EPOCH, shiftDay, validDay } from '@/lib/daily'
import { average, overallDay, streaks, winners, winsByPlayer } from '@/lib/score-stats'

const card = 'rounded-2xl border border-[var(--ink-border)] bg-[var(--ink-bg)] p-3 shadow-sm sm:p-4'
const muted = 'text-[var(--ink-muted)]'
type Tab = GameId | 'all'

/**
 * Subscribes to changes of the saved player, made in this tab or another one.
 */
function subscribe(cb: () => void) {
  window.addEventListener(PLAYER_CHANGED, cb)
  window.addEventListener('storage', cb)
  return () => {
    window.removeEventListener(PLAYER_CHANGED, cb)
    window.removeEventListener('storage', cb)
  }
}

/**
 * Collects the name and, optionally, a private group code that results are filed under.
 */
function PlayerForm({ player, onDone }: { player: Player | null; onDone: () => void }) {
  const [name, setName] = useState(player?.name ?? '')
  const [group, setGroup] = useState(player && player.group !== PUBLIC_GROUP ? player.group : '')
  const code = group.trim().toLowerCase() || PUBLIC_GROUP
  const ok = name.trim().length > 0 && /^[a-z0-9-]{3,32}$/.test(code)
  const field = 'mt-1 block w-full rounded-lg border bg-[var(--ink-bg)] p-2'
  return (
    <form
      className={`${card} grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end`}
      onSubmit={(e) => {
        e.preventDefault()
        if (!ok) return
        setPlayer({ name: name.trim(), group: code })
        onDone()
      }}
    >
      <label className="text-sm">
        Your name
        <input className={field} value={name} maxLength={24} required onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="text-sm" title="Friends who type the same code share a private board. Leave empty for the public board.">
        Group code <span className={muted}>(optional)</span>
        <input
          className={field}
          value={group}
          maxLength={32}
          placeholder="public"
          autoCapitalize="none"
          autoCorrect="off"
          onChange={(e) => setGroup(e.target.value)}
        />
      </label>
      <button disabled={!ok} className="rounded-lg bg-[var(--ink-accent)] px-5 py-2 text-white disabled:opacity-40">
        Save
      </button>
    </form>
  )
}

/**
 * Draws one player's last 14 days for a game as a small line chart.
 */
function Trend({ rows: all, day }: { rows: BoardRow[]; day: string }) {
  const dates = Array.from({ length: 14 }, (_, i) => shiftDay(day, i - 13))
  // Connections plots solve time, so unfinished runs, which have no ranked time, stay off the chart.
  const rows = all.filter((r) => r.game !== 'connections' || (r.score === 4 && r.stats.seconds !== undefined))
  const value=(r:BoardRow)=>r.game==='connections'?r.stats.seconds??0:r.score
  const max = Math.max(1, ...rows.filter((r) => dates.includes(r.day)).map(value))
  const dots = dates.flatMap((d, i) => {
    const r = rows.find((x) => x.day === d)
    return r ? [{ x: 15 + i * 24, y: r.game==='connections'||r.game==='mini'?15+(value(r)/max)*65:85-(value(r)/max)*65, r }] : []
  })
  return (
    <svg viewBox="0 0 345 100" role="img" aria-label="Your last 14 days" className="w-full max-w-xl">
      <path d="M15 15V85H330" fill="none" stroke="var(--ink-border)" />
      {dots.map((d, i) => {
        const prev = dots[i - 1]
        return (
          <g key={d.r.day}>
            {prev && shiftDay(prev.r.day, 1) === d.r.day && (
              <line x1={prev.x} y1={prev.y} x2={d.x} y2={d.y} stroke="var(--ink-accent)" strokeWidth="2" />
            )}
            <circle cx={d.x} cy={d.y} r="4" fill="var(--ink-accent)">
              <title>
                {d.r.day}: {resultLabel(d.r)}
              </title>
            </circle>
          </g>
        )
      })}
      <text x="15" y="98" fontSize="9" fill="currentColor">
        {dates[0]!.slice(5)}
      </text>
      <text x="305" y="98" fontSize="9" fill="currentColor">
        {day.slice(5)}
      </text>
    </svg>
  )
}

/**
 * Renders the month calendar. Each day shows ★ for a win, ✓ for a day you played and · for a day only others played.
 */
function Calendar({
  rows,
  me,
  day,
  onPick,
}: {
  rows: BoardRow[]
  me: string
  day: string
  onPick: (d: string) => void
}) {
  const [month, setMonth] = useState(day.slice(0, 7))
  const [shown, setShown] = useState(day)
  if (shown !== day) {
    setShown(day)
    setMonth(day.slice(0, 7))
  }
  const first = `${month}-01`
  const count = new Date(Number(month.slice(0, 4)), Number(month.slice(5)), 0).getDate()
  const offset = new Date(`${first}T12:00:00Z`).getUTCDay()
  const today = localDay()
  return (
    <section className={card} aria-label="Calendar">
      <div className="mb-2 flex items-center justify-between">
        <button
          aria-label="Previous month"
          className="h-9 w-9 rounded-full hover:bg-[var(--ink-border)]/40 disabled:opacity-30"
          disabled={month <= '2014-08'}
          onClick={() => setMonth(shiftDay(first, -1).slice(0, 7))}
        >
          ‹
        </button>
        <h2 className="font-semibold">
          {new Date(`${first}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })}
        </h2>
        <button
          aria-label="Next month"
          className="h-9 w-9 rounded-full hover:bg-[var(--ink-border)]/40 disabled:opacity-30"
          disabled={month >= today.slice(0, 7)}
          onClick={() => setMonth(shiftDay(`${month}-${count}`, 1).slice(0, 7))}
        >
          ›
        </button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center text-sm">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <span key={i} className={`py-1 text-xs ${muted}`}>
            {d}
          </span>
        ))}
        {Array.from({ length: offset }, (_, i) => (
          <span key={`b${i}`} />
        ))}
        {Array.from({ length: count }, (_, i) => {
          const d = `${month}-${String(i + 1).padStart(2, '0')}`
          const dayRows = rows.filter((r) => r.day === d)
          const played = dayRows.some((r) => r.name === me)
          const won = GAME_IDS.some((g) => winners(dayRows.filter((r) => r.game === g)).includes(me))
          const mark = won ? '★' : played ? '✓' : dayRows.length ? '·' : ''
          const what = won ? 'you won' : played ? 'you played' : dayRows.length ? 'others played' : 'no scores'
          return (
            <button
              key={d}
              title={`${d}: ${what}`}
              aria-label={`${d}, ${what}`}
              aria-pressed={day === d}
              disabled={d < '2014-08-21' || d > today}
              onClick={() => onPick(d)}
              className={`flex aspect-square flex-col items-center justify-center rounded-lg leading-none disabled:opacity-30 ${
                day === d ? 'bg-[var(--ink-accent)] text-white' : d === today ? 'ring-1 ring-[var(--ink-accent)]' : 'hover:bg-[var(--ink-border)]/40'
              }`}
            >
              {i + 1}
              <span className="mt-0.5 h-3 text-[10px]">{mark}</span>
            </button>
          )
        })}
      </div>
      <p className={`mt-2 text-xs ${muted}`}>★ you won · ✓ you played · · others played</p>
    </section>
  )
}

/**
 * Renders the leaderboard page.
 */
export function ScoresHub() {
  const params = useSearchParams()
  const router = useRouter()
  const raw = useSyncExternalStore(subscribe, () => JSON.stringify(getPlayer()), () => 'null')
  const player = useMemo(() => JSON.parse(raw) as Player | null, [raw])
  const me = player?.name ?? ''
  const [editing, setEditing] = useState(false)
  const asked = params.get('d')
  const day = asked && validDay(asked) && asked >= '2014-08-21' ? asked : localDay()
  const [tab, setTab] = useState<Tab>('all')
  const [view, setView] = useState<'day' | 'standings' | 'stats'>('day')
  const [span, setSpan] = useState<30 | 0>(30)
  const [response, setResponse] = useState<{ group: string; rows: BoardRow[]; legacyRows: BoardRow[] } | null>(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const group = player?.group ?? PUBLIC_GROUP

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    const load = async () => {
      try {
        await flushResults()
        const r = await fetch(`/api/results?group=${encodeURIComponent(group)}&days=6000`, { signal: controller.signal })
        if (!r.ok) throw new Error('Could not load scores. Saved scores retry on their own.')
        const data = (await r.json()) as { rows: BoardRow[]; legacyRows?: BoardRow[] }
        if (cancelled) return
        setResponse({ group, rows: data.rows.filter((x) => GAME_IDS.includes(x.game)), legacyRows: data.legacyRows ?? [] })
        setError('')
      } catch (e) {
        if (!cancelled && !controller.signal.aborted) setError(e instanceof Error ? e.message : 'Could not load scores')
      }
    }
    void load()
    const reload = () => void load()
    const timer = setInterval(reload, 15000)
    window.addEventListener('focus', reload)
    window.addEventListener(RESULTS_CHANGED, reload)
    return () => {
      cancelled = true
      controller.abort()
      clearInterval(timer)
      window.removeEventListener('focus', reload)
      window.removeEventListener(RESULTS_CHANGED, reload)
    }
  }, [group])

  const rows = response?.group === group ? response.rows : []
  const games = tab === 'all' ? GAME_IDS : [tab]
  const shown = rows.filter((r) => games.includes(r.game))
  const picked = shown.filter((r) => r.day === day)
  const since = span ? shiftDay(day, 1 - span) : DAILY_EPOCH
  const windowRows = shown.filter((r) => r.day >= since && r.day <= day)
  const pick = (d: string) => {
    router.push(`/leaderboards?d=${d}`, { scroll: false })
    setCopied(false)
  }

  const table = (() => {
    const wins = winsByPlayer(windowRows)
    return [...new Set(windowRows.map((r) => r.name))]
      .map((name) => {
        const own = windowRows.filter((r) => r.name === name)
        const scores = (tab === 'connections' ? own.filter(r => r.score === 4 && r.stats.seconds !== undefined).map(r => r.stats.seconds!) : tab === 'fivefold' ? own.filter(r => r.score > 0).map(r => r.score) : own.map(r => r.score))
        return {
          name,
          played: tab === 'all' ? new Set(own.map((r) => r.day)).size : own.length,
          avg: tab === 'all' || !scores.length ? null : average(scores),
          best: tab === 'all' || !scores.length ? null : tab === 'connections' ? Math.min(...scores) : bestGameScore(tab, scores),
          wins: wins.get(name) ?? 0,
        }
      })
      .sort((a, b) => b.wins - a.wins || b.played - a.played || a.name.localeCompare(b.name))
  })()

  const mine = shown.filter((r) => r.name === me && r.day <= day)
  const mineToday = rows.filter((r) => r.name === me && r.day === day)
  const streak = streaks(mine, day)
  const overall = overallDay(rows.filter((r) => r.day === day))
  const dayLabel = day === localDay() ? 'Today' : new Date(`${day}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

  const metricLabel = tab === 'connections' || tab === 'mini' ? 'Solve time' : tab === 'fivefold' ? 'Guesses' : 'Points'
  const metric = (value: number | null) => value === null ? '—' : tab === 'connections' ? formatTime(Math.round(value)) : tab === 'all' ? String(value) : formatGameScore(tab, value)
  const ranking = (g: GameId, values: BoardRow[], compact = false) => {
    const ranked = [...values].sort(compareResults), top = winners(values)
    return ranked.length ? <ol className="divide-y divide-[var(--ink-border)]">{(compact ? ranked.slice(0,3) : ranked).map(r => {
      const rank = ranked.findIndex(other => compareResults(other,r) === 0)+1
      return <li key={r.name} className={`flex items-center gap-3 rounded-lg px-2 py-3 text-sm ${r.name===me?'bg-[var(--ink-border)]/30':''}`}>
        <span className={`w-5 text-right tabular-nums ${muted}`}>{rank}</span>
        <span className="min-w-0 flex-1 truncate font-medium">{r.name}{r.name===me&&<span className={`ml-1 text-xs font-normal ${muted}`}>(you)</span>}</span>
        {top.includes(r.name)&&<span className="text-xs text-amber-700" title="Daily winner" aria-label="Daily winner">★</span>}
        <span className="text-right tabular-nums">{resultLabel(r)}</span>
      </li>
    })}</ol> : <p className={`py-5 text-sm ${muted}`}>No results yet. <Link href={`${GAMES[g].url}?d=${day}`} className="underline">Play {GAMES[g].title} →</Link></p>
  }
  return <div className="scores-hub mx-auto max-w-4xl space-y-5" data-testid="scores-hub">
    <header className="flex flex-wrap items-center gap-x-2 gap-y-1"><HomeLink className="inline-flex h-10 w-10 shrink-0 items-center justify-center"/><div className="mr-auto"><h1 className="text-2xl font-semibold tracking-tight">Leaderboard</h1><p className={`flex items-center gap-1 text-xs ${muted}`}>{boardName(group)}<button aria-label="Edit leaderboard group" title="Edit leaderboard group" className="-my-2 h-8 w-8 rounded-full p-2 hover:bg-[var(--ink-border)]/40" onClick={()=>setEditing(v=>!v)}><PencilIcon/></button></p></div><PlayerName/><Info><ul className="space-y-2">{GAME_IDS.map(g=><li key={g}><strong>{GAMES[g].title}:</strong> {GAMES[g].rules}</li>)}</ul><p>Daily wins require two players. Equal results share the rank.</p></Info></header>
    {editing&&<PlayerForm key={raw} player={player} onDone={()=>setEditing(false)}/>}
    <div className="flex flex-wrap items-end gap-3 border-y border-[var(--ink-border)] py-4">
      <label className="mr-auto min-w-40 text-xs text-[var(--ink-muted)]">Game<select aria-label="Game" value={tab} onChange={e=>setTab(e.target.value as Tab)} className="mt-1 block w-full rounded-lg border border-[var(--ink-border)] bg-[var(--ink-paper)] px-3 py-2 text-sm text-[var(--ink-text)]"><option value="all">All games</option>{GAME_IDS.map(g=><option key={g} value={g}>{GAMES[g].title}</option>)}</select></label>
      <div className="flex items-center gap-1"><button aria-label="Previous day" onClick={()=>pick(shiftDay(day,-1))} className="h-10 w-8">‹</button><label className="sr-only" htmlFor="scores-date">Results date</label><input id="scores-date" type="date" value={day} max={localDay()} min="2014-08-21" onChange={e=>validDay(e.target.value)&&pick(e.target.value)} className="rounded-lg border border-[var(--ink-border)] bg-transparent px-2 py-2 text-sm"/><button aria-label="Next day" disabled={day>=localDay()} onClick={()=>pick(shiftDay(day,1))} className="h-10 w-8 disabled:opacity-30">›</button>{day!==localDay()&&<button className="px-2 text-xs underline" onClick={()=>pick(localDay())}>Today</button>}</div>
    </div>
    <nav aria-label="Leaderboard views" className="flex gap-5 border-b border-[var(--ink-border)] text-sm">{([['day','Daily results'],['standings','Standings'],['stats','Your stats']] as const).map(([id,label])=><button key={id} aria-pressed={view===id} onClick={()=>setView(id)} className={`border-b-2 pb-3 ${view===id?'border-[var(--ink-accent)] font-semibold':'border-transparent text-[var(--ink-muted)]'}`}>{label}</button>)}</nav>
    {error&&<p role="alert" className="rounded-lg border border-red-200 p-3 text-sm">{error}</p>}
    {!response&&!error&&<p role="status" className={`py-8 text-center text-sm ${muted}`}>Loading results…</p>}
    {view==='day'&&<section aria-label="Day results" className="space-y-4"><div className="flex items-center justify-between"><h2 className="text-lg font-semibold">{dayLabel}</h2>{tab==='all'&&overall.names.length>0&&<span className={`text-xs ${muted}`}>Most wins: {overall.names.join(' & ')}</span>}</div>
      {tab==='all'?<div className="grid gap-x-7 gap-y-5 sm:grid-cols-2">{GAME_IDS.map(g=><section key={g} className="min-w-0 rounded-xl border border-[var(--ink-border)] p-4"><Link href={`${GAMES[g].url}?d=${day}`} className="flex items-center justify-between text-sm font-semibold">{GAMES[g].title}<span className={muted}>↗</span></Link>{ranking(g,picked.filter(r=>r.game===g),true)}</section>)}</div>:<div className="rounded-xl border border-[var(--ink-border)] p-4"><p className={`mb-2 text-xs ${muted}`}>{GAMES[tab].rules}</p>{ranking(tab,picked)}</div>}
      {mineToday.length>0&&<button className={`text-xs underline ${muted}`} onClick={()=>void navigator.clipboard.writeText([`sfjc.dev · ${day}`,...mineToday.map(r=>`${GAMES[r.game].title}: ${resultLabel(r)}`)].join('\n')).then(()=>setCopied(true))}>{copied?'Copied':'Copy my results'}</button>}
    </section>}
    {view==='standings'&&<section aria-label="Standings" data-testid={tab==='all'?'standings':`board-${tab}`} className="space-y-4"><div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Standings</h2><div className="flex rounded-lg bg-[var(--ink-border)]/35 p-1 text-xs">{([30,0]as const).map(n=><button key={n} aria-pressed={span===n} onClick={()=>setSpan(n)} className={`rounded-md px-3 py-1.5 ${span===n?'bg-[var(--ink-paper)] shadow-sm':''}`}>{n?'30 days':'All time'}</button>)}</div></div><p className={`text-xs ${muted}`}>Ranked by daily game wins. Each day compares the same puzzle.</p>
      {table.length?<div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className={`border-b border-[var(--ink-border)] text-xs ${muted}`}><tr><th className="py-3 font-normal">Player</th><th className="p-3 text-right font-normal">Played</th><th className="p-3 text-right font-normal">Wins</th>{tab!=='all'&&<><th className="p-3 text-right font-normal">Avg {metricLabel.toLowerCase()}</th><th className="p-3 text-right font-normal">Best</th></>}</tr></thead><tbody>{table.map(p=><tr key={p.name} className={`border-b border-[var(--ink-border)] ${p.name===me?'font-semibold':''}`}><td className="py-4">{p.name}</td><td className="p-3 text-right tabular-nums">{p.played}</td><td className="p-3 text-right tabular-nums">{p.wins}</td>{tab!=='all'&&<><td className="p-3 text-right tabular-nums">{metric(p.avg)}</td><td className="p-3 text-right tabular-nums">{metric(p.best)}</td></>}</tr>)}</tbody></table></div>:<p className={`py-8 text-center text-sm ${muted}`}>No results in this period yet.</p>}
    </section>}
    {view==='stats'&&<section aria-label="Your stats" className="space-y-5">{me?<><h2 className="text-lg font-semibold">Your progress</h2><div className="grid grid-cols-3 gap-3 rounded-xl border border-[var(--ink-border)] py-6 text-center">{[['Days played',new Set(mine.map(r=>r.day)).size],['Current streak',streak.current],['Longest streak',streak.longest]].map(([label,value])=><div key={label}><p className="text-3xl font-semibold tabular-nums tracking-tight">{value}</p><p className={`mt-2 text-xs ${muted}`}>{label}</p></div>)}</div>{tab!=='all'&&<div><h3 className={`mb-3 text-xs ${muted}`}>Last 14 days · {metricLabel.toLowerCase()}</h3><Trend rows={mine} day={day}/></div>}<Calendar rows={shown} me={me} day={day} onPick={pick}/></>:<p className={`py-8 text-sm ${muted}`}>Add your name above to track your progress and streaks.</p>}</section>}
    {!!response?.legacyRows.length&&<details className={`border-t border-[var(--ink-border)] pt-3 text-xs ${muted}`}><summary className="cursor-pointer">Earlier scoring versions ({response.legacyRows.length})</summary><ul className="mt-2 space-y-1">{response.legacyRows.map(r=><li key={`${r.game}:${r.day}:${r.name}`}>{r.day} · {r.name} · {GAMES[r.game].title}: {formatScore(r.score)}</li>)}</ul></details>}
  </div>
}
