'use client'

import { useSearchParams } from 'next/navigation'
import { useRef, useState, type KeyboardEvent } from 'react'
import { action } from '@/components/daily/DayNav'
import { NYT_FIRST_DAY, playableDay } from '@/lib/daily'
import { useSiteDay } from '@/lib/play-day'
import {
  cellEntry,
  cleanCellEntry,
  type CrosswordBoard,
  type CrosswordClue,
  type RoomEdit,
} from '@/lib/puzzle-rooms/types'
import RoomHeader from './RoomHeader'
import RoomLobby, { type RoomBoardProps } from './RoomLobby'

export default function Crossword({ hasDailyFeed }: { hasDailyFeed: boolean }) {
  const params = useSearchParams()
  const today = useSiteDay()
  const id = params.get('room') ?? ''
  const selected = params.get('d')
  const mini = params.get('edition') === 'mini'
  const [draft, setDraft] = useState('')
  const day = draft || (playableDay('mini', selected) && selected <= today ? selected : today)
  return (
    <div className="mx-auto w-full max-w-5xl">
      <RoomHeader title="Crossword Together" />
      {!id && (
        <div className="mb-5 space-y-3">
          <p>
            Solve the {hasDailyFeed && !mini ? 'daily crossword' : 'daily Mini Crossword'} with friends on one grid.
          </p>
          <label className="flex flex-wrap items-center gap-2 text-sm">
            Puzzle date
            <input
              className="rounded-md border border-[var(--ink-border)] bg-[var(--ink-bg)] p-2"
              type="date"
              min={NYT_FIRST_DAY.mini}
              max={today}
              value={day}
              onChange={(event) => setDraft(event.target.value)}
            />
          </label>
        </div>
      )}
      <RoomLobby game="crossword" id={id} day={day} mini={mini} board={SharedCrossword} />
    </div>
  )
}

function SharedCrossword({ room, edit, controls }: RoomBoardProps) {
  if (room.puzzle.game !== 'crossword') return null
  return (
    <>
      {controls}
      <CrosswordGrid puzzle={room.puzzle.board} entries={room.entries} solved={room.solved} edit={edit} />
    </>
  )
}

const directions = ['Across', 'Down'] as const

function CrosswordGrid({
  puzzle,
  entries,
  solved,
  edit,
}: {
  puzzle: CrosswordBoard
  entries: Record<number, string>
  solved: boolean
  edit: (edit: RoomEdit) => void
}) {
  const { width, height, clues, blocks } = puzzle
  const [active, setActive] = useState(() => blocks.indexOf(false))
  const [direction, setDirection] = useState<CrosswordClue['direction']>('Across')
  const [rebus, setRebus] = useState(false)
  const [rebusValue, setRebusValue] = useState('')
  const inputs = useRef<(HTMLInputElement | null)[]>([])
  const numbers = new Map(clues.map((clue) => [clue.cells[0], clue.number]))
  const crossing = clues.filter((clue) => clue.cells.includes(active))
  const selected = crossing.find((clue) => clue.direction === direction) ?? crossing[0]
  const highlighted = new Set(selected?.cells)
  const filled = Object.keys(entries).length
  const total = blocks.filter((block) => !block).length

  function focus(cell: number) {
    setActive(cell)
    const input = inputs.current[cell]
    input?.focus({ preventScroll: true })
    input?.select()
  }

  function pick(clue: CrosswordClue) {
    setDirection(clue.direction)
    focus(clue.cells.find((cell) => !entries[cell]) ?? clue.cells[0]!)
  }

  /**
   * Writes entries into consecutive squares of the selected word, then moves past the last one written, stopping at
   * the word's end.
   */
  function fill(cell: number, values: string[]) {
    if (solved) return
    const cells = selected?.cells.includes(cell) ? selected.cells : [cell]
    const start = cells.indexOf(cell)
    const written = values.slice(0, cells.length - start)
    written.forEach((value, offset) => edit({ cell: cells[start + offset]!, value }))
    if (written.at(-1)) focus(cells[Math.min(start + written.length, cells.length - 1)]!)
  }

  function clear(cell: number, back: boolean) {
    if (solved) return
    if (back && !entries[cell]) {
      const previous = selected?.cells[(selected.cells.indexOf(cell) ?? 0) - 1]
      if (previous !== undefined) {
        focus(previous)
        edit({ cell: previous, value: '' })
      }
    } else edit({ cell, value: '' })
  }

  function onKey(event: KeyboardEvent<HTMLInputElement>, cell: number) {
    if (event.altKey || event.metaKey || event.ctrlKey || event.nativeEvent.isComposing) return
    const key = event.key
    if (key.length === 1 && cellEntry.test(key.toUpperCase())) {
      event.preventDefault()
      fill(cell, [key.toUpperCase()])
      return
    }
    if (key === 'Backspace' || key === 'Delete') {
      event.preventDefault()
      clear(cell, key === 'Backspace')
    } else if (key === ' ' || key === 'Enter') {
      event.preventDefault()
      const other = crossing.find((clue) => clue !== selected)
      if (other) setDirection(other.direction)
    } else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(key)) {
      event.preventDefault()
      const horizontal = key === 'ArrowLeft' || key === 'ArrowRight'
      const nextDirection = horizontal ? 'Across' : 'Down'
      setDirection(nextDirection)
      const step = (horizontal ? 1 : width) * (key === 'ArrowLeft' || key === 'ArrowUp' ? -1 : 1)
      for (let next = cell + step; next >= 0 && next < blocks.length; next += step) {
        if (horizontal && Math.floor(cell / width) !== Math.floor(next / width)) break
        if (!blocks[next]) {
          focus(next)
          break
        }
      }
    }
  }

  return (
    <>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-1">
        <div>
          <h2 className="font-lora text-lg font-semibold">
            {puzzle.title} · <time dateTime={puzzle.date}>{puzzle.date}</time>
          </h2>
          <p className="text-xs text-[var(--ink-muted)]">{puzzle.credit}</p>
        </div>
        <p className="text-sm font-semibold" role="status">
          {solved
            ? 'Solved together!'
            : filled === total
              ? 'Grid filled. Check your answers.'
              : `${filled} / ${total} squares filled`}
        </p>
      </div>
      <div className="grid items-start gap-4 md:grid-cols-[minmax(0,1fr)_minmax(16rem,0.85fr)]">
        <section aria-label="Crossword board">
          <div className="mb-2 flex min-h-12 items-center justify-between gap-2 rounded-md bg-[var(--ink-paper)] px-3 py-2">
            {selected && (
              <p className="text-sm">
                <strong>
                  {selected.number} {selected.direction}
                </strong>{' '}
                {selected.text}
              </p>
            )}
            {crossing.length > 1 && (
              <button
                type="button"
                className={action}
                onClick={() => {
                  const other = crossing.find((clue) => clue !== selected)
                  if (other) setDirection(other.direction)
                  focus(active)
                }}
              >
                Switch
              </button>
            )}
          </div>
          <div
            className="[container-type:inline-size] grid w-full overflow-hidden border border-[#445161] bg-[#445161]"
            style={{
              gridTemplateColumns: `repeat(${width}, minmax(0, 1fr))`,
              aspectRatio: `${width} / ${height}`,
              gap: 1,
            }}
          >
            {blocks.map((block, cell) =>
              block ? (
                <span key={cell} className="bg-[#253241]" aria-hidden="true" />
              ) : (
                <div
                  key={cell}
                  className="relative min-h-0 min-w-0"
                  style={{ background: active === cell ? '#f5d278' : highlighted.has(cell) ? '#dbeafb' : '#fff' }}
                >
                  {numbers.has(cell) && (
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute top-0 left-[8%] leading-none font-medium text-[#243548]"
                      style={{ fontSize: `clamp(6px, ${34 / width}cqw, 13px)` }}
                    >
                      {numbers.get(cell)}
                    </span>
                  )}
                  <input
                    ref={(node) => {
                      inputs.current[cell] = node
                    }}
                    aria-label={`Row ${Math.floor(cell / width) + 1}, column ${(cell % width) + 1}`}
                    tabIndex={active === cell ? 0 : -1}
                    className="absolute inset-0 size-full min-w-0 bg-transparent pt-[12%] text-center leading-none font-bold text-[#142231] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#255081]"
                    style={{
                      fontSize: `clamp(10px, ${((entries[cell]?.length ?? 0) > 1 ? 28 : 55) / width}cqw, 36px)`,
                    }}
                    value={entries[cell] ?? ''}
                    autoCapitalize="characters"
                    autoComplete="off"
                    spellCheck={false}
                    readOnly={solved}
                    onFocus={(event) => {
                      setActive(cell)
                      event.currentTarget.select()
                    }}
                    onClick={(event) => {
                      event.currentTarget.select()
                    }}
                    onKeyDown={(event) => onKey(event, cell)}
                    autoFocus={active === cell}
                    onChange={(event) => {
                      // Phone keyboards, swipe typing and dictation send no key events, so their text arrives here:
                      // only the newly typed letters count, 1 per square. A paste fills the square as a rebus.
                      const { inputType, data } = event.nativeEvent as InputEvent
                      const value = cleanCellEntry(event.target.value)
                      const typed = inputType === 'insertFromPaste' ? '' : cleanCellEntry(data ?? '')
                      if (typed) fill(cell, [...typed])
                      else if (!value) clear(cell, false)
                      else if (inputType === 'insertFromPaste') fill(cell, [value])
                    }}
                  />
                </div>
              ),
            )}
          </div>
          {!solved && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <p className="mr-auto text-xs text-[var(--ink-muted)]">Arrow keys move · Space switches direction</p>
              <button
                type="button"
                className={action}
                onClick={() => {
                  setRebusValue(entries[active] ?? '')
                  setRebus((open) => !open)
                }}
                aria-expanded={rebus}
              >
                Rebus
              </button>
              {rebus && (
                <form
                  className="flex flex-wrap items-center gap-2 text-sm"
                  onSubmit={(event) => {
                    event.preventDefault()
                    fill(active, [rebusValue])
                    setRebus(false)
                    if (!rebusValue) focus(active)
                  }}
                >
                  <label>
                    Square entry{' '}
                    <input
                      className="w-24 rounded border p-1"
                      maxLength={16}
                      value={rebusValue}
                      onChange={(event) => setRebusValue(cleanCellEntry(event.target.value))}
                    />
                  </label>
                  <button className={action}>Apply</button>
                </form>
              )}
            </div>
          )}
        </section>
        <div className="grid gap-3 sm:grid-cols-2 md:max-h-[min(70vh,42rem)] md:overflow-y-auto">
          {directions.map((axis) => (
            <section key={axis} aria-label={axis}>
              <h3 className="border-b border-[var(--ink-border)] pb-1 font-semibold">{axis}</h3>
              <ol className="mt-1">
                {clues
                  .filter((clue) => clue.direction === axis)
                  .map((clue) => (
                    <li key={clue.number}>
                      <button
                        type="button"
                        aria-pressed={clue === selected}
                        onClick={() => pick(clue)}
                        className="flex min-h-9 w-full gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-[var(--ink-paper)] aria-pressed:bg-[#dbeafb] aria-pressed:text-[#142231]"
                      >
                        <strong className="w-6 shrink-0 tabular-nums">{clue.number}</strong>
                        <span>{clue.text}</span>
                      </button>
                    </li>
                  ))}
              </ol>
            </section>
          ))}
        </div>
      </div>
    </>
  )
}
