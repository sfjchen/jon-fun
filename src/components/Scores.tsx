'use client'
import Link from 'next/link'
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { GAMES, GAME_IDS, PLAYER_CHANGED, RESULTS_CHANGED, flushResults, formatScore, formatTime, getPlayer, localDay, setPlayer, PUBLIC_GROUP, boardName, type BoardRow, type GameId, type Player } from '@/lib/results'
import { DAILY_EPOCH, shiftDay, validDay } from '@/lib/daily'
import { average, overallDay, streaks, winners, winsByPlayer } from '@/lib/score-stats'
const field = 'w-full rounded-lg border bg-[var(--ink-paper)] p-2'
const card = 'rounded-xl border border-[var(--ink-border)] bg-[var(--ink-paper)] p-4'
const muted = 'text-sm text-[var(--ink-muted)]'
function subscribe(cb: () => void) {
  window.addEventListener(PLAYER_CHANGED, cb); window.addEventListener('storage', cb)
  return () => { window.removeEventListener(PLAYER_CHANGED, cb); window.removeEventListener('storage', cb) }
}
function PlayerForm({ player, onDone }: { player: Player | null; onDone: () => void }) {
  const [name, setName] = useState(player?.name ?? ''), [group, setGroup] = useState(player?.group ?? PUBLIC_GROUP)
  const [privateBoard, setPrivateBoard] = useState(!!player && player.group !== PUBLIC_GROUP)
  return <form className={`${card} space-y-3`} onSubmit={e => { e.preventDefault(); if (name.trim() && /^[a-z0-9-]{3,32}$/.test(group.trim().toLowerCase())) { setPlayer({ name: name.trim(), group: group.trim().toLowerCase() }); onDone() } }}>
    <label className="block text-sm">Your name<input className={field} value={name} maxLength={24} required onChange={e => setName(e.target.value)} /></label>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={privateBoard} onChange={e => { setPrivateBoard(e.target.checked); setGroup(e.target.checked ? '' : PUBLIC_GROUP) }} />Use a private group</label>
    {privateBoard && <label className="block text-sm">Group code<input className={field} value={group} minLength={3} maxLength={32} pattern="[A-Za-z0-9-]{3,32}" required autoCapitalize="none" onChange={e => setGroup(e.target.value)} /></label>}
    <p className={muted}>Pick a unique name for the public board, or use a private group code with friends. Use the same name and group on your other devices.</p>
    <button className="rounded-lg bg-[var(--ink-accent)] px-5 py-2 text-white">Save</button>
  </form>
}
function Trend({ rows, day }: { rows: BoardRow[]; day: string }) {
  const dates = Array.from({ length: 14 }, (_, i) => shiftDay(day, i - 13))
  const max = Math.max(1, ...rows.filter(r => dates.includes(r.day)).map(r => r.score))
  const dots = dates.flatMap((d, i) => { const r = rows.find(r => r.day === d); return r ? [{ x: 15 + i * 24, y: 85 - r.score / max * 65, r }] : [] })
  return <figure className="space-y-1"><figcaption className={muted}>Your last 14 days · gaps mean unplayed</figcaption>
    <svg viewBox="0 0 345 105" role="img" aria-label="Your daily score trend over the last fourteen days" className="w-full max-w-xl">
      <path d="M15 15V85H330" fill="none" stroke="var(--ink-border)" />
      {dots.map((d, i) => { const prev = dots[i - 1]; return <g key={d.r.day}>{prev && shiftDay(prev.r.day, 1) === d.r.day && <line x1={prev.x} y1={prev.y} x2={d.x} y2={d.y} stroke="var(--ink-accent)" strokeWidth="2" />}<circle cx={d.x} cy={d.y} r="3.5" fill="var(--ink-accent)"><title>{d.r.day}: {d.r.score}</title></circle></g> })}
      <text x="15" y="101" fontSize="9" fill="currentColor">{dates[0]}</text><text x="270" y="101" fontSize="9" fill="currentColor">{day}</text>
    </svg>
  </figure>
}
export function ScoresHub() {
  const params = useSearchParams()
  const router = useRouter()
  const raw = useSyncExternalStore(subscribe, () => JSON.stringify(getPlayer()), () => 'null')
  const player = useMemo(() => JSON.parse(raw) as Player | null, [raw])
  const [editing, setEditing] = useState(false)
  const initial = params.get('d')
  const day = initial && validDay(initial) && initial >= DAILY_EPOCH ? initial : localDay()
  const [calendar, setCalendar] = useState({ day, month: day.slice(0, 7) })
  const month = calendar.day === day ? calendar.month : day.slice(0, 7)
  const setMonth = (month: string) => setCalendar({ day, month })
  const [game, setGame] = useState<GameId | 'all'>('all')
  const [response, setResponse] = useState<{ group: string; rows: BoardRow[] } | null>(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const group = player?.group ?? PUBLIC_GROUP
  useEffect(() => {
    if (!group) return
    let cancelled = false
    const controller = new AbortController()
    const load = async () => {
      try {
        await flushResults()
        const r = await fetch(`/api/results?group=${encodeURIComponent(group)}&days=4000`, { signal: controller.signal })
        if (!r.ok) throw new Error('Could not load your group. Your saved scores will retry syncing automatically.')
        const data = await r.json() as { rows: BoardRow[] }
        if (!cancelled) { setResponse({ group, rows: data.rows.filter(r => GAME_IDS.includes(r.game)) }); setError('') }
      } catch (e) { if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load scores') }
    }
    void load()
    const onChange = () => { void load() }
    const timer = setInterval(onChange, 15000)
    window.addEventListener('focus', onChange); window.addEventListener(RESULTS_CHANGED, onChange)
    return () => { cancelled = true; controller.abort(); clearInterval(timer); window.removeEventListener('focus', onChange); window.removeEventListener(RESULTS_CHANGED, onChange) }
  }, [group])
  const rows = response?.group === group ? response!.rows : []
  const filtered = rows.filter(r => game === 'all' || r.game === game)
  const selected = filtered.filter(r => r.day === day)
  const mine = filtered.filter(r => r.name === player?.name && r.day <= day)
  const winCounts = winsByPlayer(filtered.filter(r => r.day <= day))
  const overall = overallDay(rows.filter(r => r.day === day))
  const dailyHistory = [...new Set(rows.filter(r => r.day <= day).map(r => r.day))].sort().reverse().map(d => ({ day: d, ...overallDay(rows.filter(r => r.day === d)) })).filter(d => d.names.length)
  const overallTally = new Map<string, number>()
  for (const d of dailyHistory) if (d.names.length === 1) overallTally.set(d.names[0]!, (overallTally.get(d.names[0]!) ?? 0) + 1)
  const monthStart = `${month}-01`
  const count = new Date(Number(month.slice(0, 4)), Number(month.slice(5)), 0).getDate()
  const offset = new Date(`${monthStart}T12:00:00Z`).getUTCDay()
  const available = new Set(filtered.map(r => r.day))
  const personal = new Set(filtered.filter(r => r.name === player?.name).map(r => r.day))
  const choose = (d: string) => { router.push(`/leaderboards?d=${d}`, { scroll: false }); setCopied(false) }
  return <div className="mx-auto max-w-4xl space-y-5" data-testid="scores-hub">
    <header className="space-y-2"><h1 className="font-lora text-3xl font-semibold">Leaderboard</h1><p className={muted}>One puzzle per game each day. Your best unassisted daily score syncs automatically. Calendar: Pacific time.</p></header>
    {!player || editing ? <PlayerForm key={raw} player={player} onDone={() => setEditing(false)} /> : <p className={muted}>{player.name} · {boardName(player.group)} · <button className="underline" onClick={() => setEditing(true)}>change</button></p>}
    <nav aria-label="Daily games" className="flex flex-wrap gap-2">{GAME_IDS.map(g => <Link key={g} className="rounded-full border px-4 py-2 text-sm" href={`${GAMES[g].url}?d=${day}`}>{GAMES[g].title}</Link>)}</nav>
    {error && <p role="alert" className="rounded border border-red-300 p-3">{error}</p>}
    {player && response?.group !== group && !error && <p>Loading group scores…</p>}
    <div className="flex flex-wrap items-center gap-3"><label>Game <select aria-label="Leaderboard game" className="rounded border bg-[var(--ink-paper)] p-2" value={game} onChange={e => setGame(e.target.value as GameId | 'all')}><option value="all">All games</option>{GAME_IDS.map(g => <option value={g} key={g}>{GAMES[g].title}</option>)}</select></label><button className="underline" onClick={() => choose(localDay())}>Today</button><span className={muted}>Wins include ties and require at least two players.</span></div>
    <div className="grid gap-5 md:grid-cols-[1fr_1fr]">
      <section className={card} aria-label="Score calendar">
        <div className="mb-4 flex items-center justify-between"><button aria-label="Previous month" className="rounded border px-3 py-1" disabled={month <= DAILY_EPOCH.slice(0, 7)} onClick={() => setMonth(shiftDay(monthStart, -1).slice(0, 7))}>←</button><h2 className="font-semibold">{new Date(`${monthStart}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })}</h2><button aria-label="Next month" className="rounded border px-3 py-1" onClick={() => setMonth(shiftDay(`${month}-${count}`, 1).slice(0, 7))}>→</button></div>
        <div className="grid grid-cols-7 gap-1 text-center text-sm">{['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => <span className="py-1 text-xs" key={d}>{d}</span>)}{Array.from({length: offset}, (_, i) => <span key={`blank-${i}`} />)}{Array.from({length: count}, (_, i) => {
          const d = `${month}-${String(i + 1).padStart(2, '0')}`
          const won = GAME_IDS.some(g => winners(filtered.filter(r => r.day === d && r.game === g)).includes(player?.name ?? ''))
          return <button key={d} aria-label={`${d}${personal.has(d) ? ', played' : ''}${won ? ', winner' : ''}`} aria-pressed={day === d} className={`aspect-square rounded-lg border ${day === d ? 'border-[var(--ink-accent)] font-bold ring-1 ring-[var(--ink-accent)]' : 'border-transparent'}`} onClick={() => choose(d)} disabled={d < DAILY_EPOCH}><span>{i + 1}</span><span className="block h-3 text-[9px] text-[var(--ink-accent)]">{won ? '★' : personal.has(d) ? '●' : available.has(d) ? '○' : ''}</span></button>
        })}</div><p className={`${muted} mt-3`}>★ Your win · ● You played · ○ Group played</p>
      </section>
      <section className={`${card} space-y-3`}><h2 className="font-lora text-xl">{day === localDay() ? 'Today' : day} · winners</h2>
        <p className="text-sm font-semibold">Overall: {overall.names.length === 1 ? overall.names[0] : overall.names.length ? `Tie — ${overall.names.join(' & ')}` : 'Waiting for competition'}</p>
        {dailyHistory.length > 0 && <section className={`${card} space-y-3`} data-testid="scores-day-by-day">
      <h2 className="font-lora text-xl">Day by day</h2><p className={muted}>Overall winner = most game wins that day. Tied overall days have no outright winner.</p>
      <p className="text-sm">Days won overall: {[...overallTally].sort((a,b) => b[1]-a[1]).map(([name,n]) => `${name} ${n}`).join(' · ') || 'No outright winners yet'}</p>
      <div className="space-y-2">{dailyHistory.slice(0,14).map(d => <div key={d.day} className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--ink-border)] pt-2 text-sm"><button className="underline" onClick={() => choose(d.day)}>{d.day}</button><strong>{d.names.length === 1 ? d.names[0] : `Tie — ${d.names.join(' & ')}`}</strong><span className={muted}>{[...d.gameWins].sort((a,b) => b[1]-a[1]).map(([name,n]) => `${name}: ${n} game ${n===1?'win':'wins'}`).join(' · ')}</span></div>)}</div>
    </section>}
    {(game === 'all' ? GAME_IDS : [game]).map(g => { const games = selected.filter(r => r.game === g); const names = winners(games); return <div key={g} className="flex items-start justify-between gap-2 border-b border-[var(--ink-border)] pb-2"><Link className="underline" href={`${GAMES[g].url}?d=${day}`}>{GAMES[g].title}</Link><span className="text-right text-sm">{names.length ? `${names.join(' & ')} · ${formatScore(Math.max(...games.map(r => r.score)))}` : games.length ? `${games[0]!.name} · waiting for a challenger` : day > localDay() ? 'Future practice' : 'No scores yet'}</span></div> })}
        <p className={muted}>Each game has its own scoring. Scores from different games are kept separate.</p>
        {mine.some(r => r.day === day) && <button className="underline text-sm" onClick={() => { void navigator.clipboard.writeText([`sfjc.dev · ${day}`, ...mine.filter(r => r.day === day).map(r => `${GAMES[r.game].title}: ${formatScore(r.score)}`)].join('\n')).then(() => setCopied(true)) }}>{copied ? 'Copied' : 'Copy results to share'}</button>}
      </section>
    </div>
    {dailyHistory.length > 0 && <section className={`${card} space-y-3`} data-testid="scores-day-by-day">
      <h2 className="font-lora text-xl">Day by day</h2><p className={muted}>Overall winner = most game wins that day. Tied overall days have no outright winner.</p>
      <p className="text-sm">Days won overall: {[...overallTally].sort((a,b) => b[1]-a[1]).map(([name,n]) => `${name} ${n}`).join(' · ') || 'No outright winners yet'}</p>
      <div className="space-y-2">{dailyHistory.slice(0,14).map(d => <div key={d.day} className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--ink-border)] pt-2 text-sm"><button className="underline" onClick={() => choose(d.day)}>{d.day}</button><strong>{d.names.length === 1 ? d.names[0] : `Tie — ${d.names.join(' & ')}`}</strong><span className={muted}>{[...d.gameWins].sort((a,b) => b[1]-a[1]).map(([name,n]) => `${name}: ${n} game ${n===1?'win':'wins'}`).join(' · ')}</span></div>)}</div>
    </section>}
    {(game === 'all' ? GAME_IDS : [game]).map(g => {
      const gameRows = rows.filter(r => r.game === g && r.day <= day)
      const own = gameRows.filter(r => r.name === player?.name)
      const streak = streaks(own, day)
      const week = gameRows.filter(r => r.day >= shiftDay(day, -6))
      const names = [...new Set(gameRows.map(r => r.name))].sort((a, b) => (selected.find(r => r.game === g && r.name === b)?.score ?? -1) - (selected.find(r => r.game === g && r.name === a)?.score ?? -1) || a.localeCompare(b))
      const wins = winsByPlayer(gameRows)
      const seconds = own.flatMap(r => r.stats.seconds === undefined ? [] : [r.stats.seconds])
      const facts = [['Days played',String(own.length)], ['Current streak',String(streak.current)], ['Longest streak',String(streak.longest)], ['Best score',own.length ? formatScore(Math.max(...own.map(r => r.score))) : '—'], ['Average score',own.length ? formatScore(average(own.map(r => r.score))) : '—'], ['Days won',String(wins.get(player?.name ?? '') ?? 0)], ...(seconds.length ? [['Best time',formatTime(Math.min(...seconds))],['Average time',formatTime(Math.round(average(seconds)))]] : []), ...(g === 'bee' && own.length ? [['Most words',String(Math.max(...own.map(r => r.stats.n ?? 0)))]] : []), ...(g === 'connections' && own.length ? [['Solves',String(own.filter(r => r.stats.solved).length)],['Avg mistakes',average(own.map(r => r.stats.mistakes ?? 0)).toFixed(1)]] : [])]
      return <section key={g} className={`${card} space-y-4`} data-testid={`board-${g}`}><div><h2 className="font-lora text-xl">{GAMES[g].title}</h2><p className={`${muted} mt-1`}>{GAMES[g].rules}</p></div>
        {names.length ? <div className="overflow-x-auto"><table className="w-full min-w-[420px] text-left text-sm"><thead className="text-[var(--ink-muted)]"><tr><th className="py-2">Player</th><th className="text-right">Selected day</th><th className="text-right">7-day avg*</th><th className="text-right">Wins</th></tr></thead><tbody>{names.map(name => { const r = selected.find(r => r.game === g && r.name === name); const w = week.filter(r => r.name === name); return <tr key={name} className="border-t border-[var(--ink-border)]"><th className="py-2 font-medium">{name}</th><td className="text-right tabular-nums">{r ? `${formatScore(r.score)}${r.stats.seconds === undefined ? '' : ` · ${formatTime(r.stats.seconds)}`}` : '—'}</td><td className="text-right tabular-nums">{w.length ? formatScore(average(w.map(r => r.score))) : '—'}</td><td className="text-right">{wins.get(name) ?? 0}</td></tr> })}</tbody></table><p className={`${muted} mt-2`}>*Average over played days in the seven-day window.</p></div> : <p className={muted}>No scores yet. <Link className="underline" href={`${GAMES[g].url}?d=${day}`}>Play {GAMES[g].title}</Link> to start.</p>}
        {own.length > 0 && <><Trend rows={own} day={day} /><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{facts.map(([label,value]) => <div key={label}><p className="text-xl font-semibold tabular-nums">{value}</p><p className={muted}>{label}</p></div>)}</div></>}
      </section>
    })}
    {player && <p className={muted}>Group: {new Set(rows.map(r => r.name)).size} players · {rows.length} game results · {winCounts.get(player.name) ?? 0} shared or outright daily wins.</p>}
  </div>
}
