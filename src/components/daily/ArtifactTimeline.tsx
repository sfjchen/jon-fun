'use client'
import { historicalYear } from '@/lib/artifact-scoring'
export default function ArtifactTimeline({
  value,
  truth,
  onChange,
}: {
  value: number | null
  truth?: { beginYear: number; endYear: number } | undefined
  onChange: (year: number) => void
}) {
  // The axis spans 3000 BCE to 2000 CE across 3%-97% of the track; the slider picks period starts up to 1750 CE, so it covers 4750/5000 of it.
  // HTML positioned in percent keeps the pills round and the labels on their ticks at any width.
  const pct = (year: number) => 3 + ((Math.max(-3000, Math.min(2000, year)) + 3000) / 5000) * 94
  const span = (from: number, to: number, min: number) => ({
    left: `${pct(from)}%`,
    width: `max(${min}px,${pct(to) - pct(from)}%)`,
  })
  return (
    <div className="anthro-timeline">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <label htmlFor="anthro-year" className="anthro-eyebrow">
          Timeline selection
        </label>
        <span className="text-sm">
          {truth && (
            <span className="mr-4 text-emerald-800">
              Truth: {historicalYear(truth.beginYear)}–{historicalYear(truth.endYear)}
            </span>
          )}
          {value === null ? 'Choose a 250-year period' : `${historicalYear(value)} – ${historicalYear(value + 250)}`}
        </span>
      </div>
      <div className="relative h-14 rounded has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[#7a1f1a]">
        <div className="absolute inset-x-[3%] top-[17px] h-px bg-[#aa9c7d]" aria-hidden="true" />
        {[-3000, -2000, -1000, 0, 1000, 2000].map((year) => (
          <div
            key={year}
            className="absolute top-[24px] flex -translate-x-1/2 flex-col items-center text-[10px] text-[#4a4337] sm:text-xs"
            style={{ left: `${pct(year)}%` }}
            aria-hidden="true"
          >
            <span className="h-2 w-px bg-[#8a795b]" />
            <span className="mt-1 whitespace-nowrap">{historicalYear(year)}</span>
          </div>
        ))}
        {truth && (
          <div
            className="absolute top-[7px] h-[22px] rounded-full bg-[#237351]"
            style={span(truth.beginYear, truth.endYear, 6)}
            aria-hidden="true"
          />
        )}
        {value !== null && (
          <div
            className="absolute top-[4px] h-[28px] rounded-full border-2 border-[#f7f3ea] bg-[#7a1f1a]"
            style={span(value, value + 250, 8)}
            aria-hidden="true"
          />
        )}
        <input
          id="anthro-year"
          aria-label="Year slider"
          aria-valuetext={
            value === null ? 'No period selected' : `${historicalYear(value)} to ${historicalYear(value + 250)}`
          }
          type="range"
          min={-3000}
          max={1750}
          step={125}
          disabled={!!truth}
          value={value ?? 0}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute top-0 left-[3%] h-10 w-[89.3%] cursor-crosshair opacity-0"
        />
      </div>
    </div>
  )
}
