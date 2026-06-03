'use client'

import { useMemo, useState } from 'react'
import {
  computeScenario,
  formatPct,
  formatUsd,
  PRESET_CONTROLS,
  PRESET_META,
  UBI_AI_AI_GRID,
  UBI_AI_DATA,
  UBI_AI_PARAMS,
  UBI_AI_UBI_GRID,
  utilityCurveFromSurface,
  type FinancingMode,
  type UbiAiPresetId,
} from '@/lib/ubi-ai'

type Tab = 'explore' | 'sources' | 'methods'

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div
      className="rounded-lg border p-4"
      style={{ backgroundColor: 'var(--ink-bg)', borderColor: 'var(--ink-border)' }}
    >
      <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--ink-muted)' }}>
        {label}
      </p>
      <p className="mt-1 font-lora text-2xl font-semibold" style={{ color: 'var(--ink-text)' }}>
        {value}
      </p>
      {hint && (
        <p className="mt-1 text-xs" style={{ color: 'var(--ink-muted)' }}>
          {hint}
        </p>
      )}
    </div>
  )
}

function LineChart({
  xs,
  ys,
  markerX,
  width = 320,
  height = 160,
  yLabel,
}: {
  xs: number[]
  ys: number[]
  markerX?: number
  width?: number
  height?: number
  yLabel: string
}) {
  const pad = { l: 36, r: 12, t: 12, b: 28 }
  const innerW = width - pad.l - pad.r
  const innerH = height - pad.t - pad.b
  const yMin = Math.min(...ys, 0)
  const yMax = Math.max(...ys, 1)
  const ySpan = yMax - yMin || 1
  const xMin = xs[0] ?? -1
  const xMax = xs[xs.length - 1] ?? 1
  const xSpan = xMax - xMin || 1

  const pts = xs.map((x, i) => {
    const yVal = ys[i] ?? 0
    const px = pad.l + ((x - xMin) / xSpan) * innerW
    const py = pad.t + innerH - ((yVal - yMin) / ySpan) * innerH
    return `${px},${py}`
  })
  const poly = pts.join(' ')

  let marker: { px: number; py: number } | null = null
  if (markerX != null) {
    const idx = xs.reduce((best, x, i) =>
      Math.abs(x - markerX) < Math.abs((xs[best] ?? 0) - markerX) ? i : best,
    0)
    const px = pad.l + (((xs[idx] ?? 0) - xMin) / xSpan) * innerW
    const py = pad.t + innerH - (((ys[idx] ?? 0) - yMin) / ySpan) * innerH
    marker = { px, py }
  }

  return (
    <svg width={width} height={height} className="mx-auto max-w-full" aria-label={yLabel}>
      <line
        x1={pad.l}
        y1={pad.t + innerH}
        x2={pad.l + innerW}
        y2={pad.t + innerH}
        stroke="var(--ink-border)"
        strokeWidth={1}
      />
      <line
        x1={pad.l}
        y1={pad.t}
        x2={pad.l}
        y2={pad.t + innerH}
        stroke="var(--ink-border)"
        strokeWidth={1}
      />
      <polyline
        points={poly}
        fill="none"
        stroke="var(--ink-accent)"
        strokeWidth={2}
        strokeLinejoin="round"
      />
      {marker && (
        <circle cx={marker.px} cy={marker.py} r={5} fill="var(--ink-accent)" stroke="var(--ink-paper)" strokeWidth={2} />
      )}
      <text x={pad.l} y={height - 6} className="text-[9px] fill-[var(--ink-muted)]">
        automation-heavy
      </text>
      <text x={pad.l + innerW - 52} y={height - 6} className="text-[9px] fill-[var(--ink-muted)]">
        augmentation-heavy
      </text>
      <text x={4} y={pad.t + 8} className="text-[9px] fill-[var(--ink-muted)]">
        {yLabel}
      </text>
    </svg>
  )
}

function GroupBarChart({ groups, showUbi }: { groups: ReturnType<typeof computeScenario>['groups']; showUbi: boolean }) {
  const w = 320
  const h = 180
  const pad = { l: 8, r: 8, t: 8, b: 36 }
  const maxInc = Math.max(...groups.map((g) => (showUbi ? g.netIncomeAfterUbi : g.incomeAfterAi)))
  const barW = (w - pad.l - pad.r) / groups.length - 6

  return (
    <svg width={w} height={h} className="mx-auto max-w-full" aria-label="Net income by income group">
      {groups.map((g, i) => {
        const val = showUbi ? g.netIncomeAfterUbi : g.incomeAfterAi
        const barH = ((val / maxInc) * (h - pad.t - pad.b)) | 0
        const x = pad.l + i * (barW + 6)
        const y = h - pad.b - barH
        return (
          <g key={g.label}>
            <rect
              x={x}
              y={y}
              width={barW}
              height={barH}
              fill="var(--ink-accent)"
              fillOpacity={0.75}
              rx={2}
            />
            <text
              x={x + barW / 2}
              y={h - 8}
              textAnchor="middle"
              className="text-[8px] fill-[var(--ink-muted)]"
            >
              Q{i + 1}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

function UbiSensitivityChart({
  aiIdx,
  finMode,
}: {
  aiIdx: number
  finMode: FinancingMode
}) {
  const ys = UBI_AI_UBI_GRID.map((u) => computeScenario(aiIdx, u, finMode).utilityDeltaPercent)

  const w = 320
  const h = 160
  const pad = { l: 40, r: 12, t: 12, b: 28 }
  const innerW = w - pad.l - pad.r
  const innerH = h - pad.t - pad.b
  const yMin = Math.min(...ys, 0)
  const yMax = Math.max(...ys, 1)
  const ySpan = yMax - yMin || 1

  const pts = UBI_AI_UBI_GRID.map((u, i) => {
    const px = pad.l + (i / (UBI_AI_UBI_GRID.length - 1)) * innerW
    const yVal = ys[i] ?? 0
    const py = pad.t + innerH - ((yVal - yMin) / ySpan) * innerH
    return `${px},${py}`
  })

  return (
    <svg width={w} height={h} className="mx-auto max-w-full" aria-label="Utility vs UBI amount">
      <polyline points={pts.join(' ')} fill="none" stroke="var(--ink-accent)" strokeWidth={2} />
      <text x={pad.l} y={h - 6} className="text-[9px] fill-[var(--ink-muted)]">
        $0/mo
      </text>
      <text x={pad.l + innerW - 40} y={h - 6} className="text-[9px] fill-[var(--ink-muted)]">
        $2000/mo
      </text>
      <text x={4} y={pad.t + 8} className="text-[9px] fill-[var(--ink-muted)]">
        Δ utility %
      </text>
      <text x={pad.l} y={12} className="text-[8px] fill-[var(--ink-muted)]">
        AI index {aiIdx.toFixed(2)}
      </text>
    </svg>
  )
}

export default function UbiAiDashboard() {
  const [tab, setTab] = useState<Tab>('explore')
  const [aiIdx, setAiIdx] = useState(0)
  const [ubiMo, setUbiMo] = useState(1000)
  const [finMode, setFinMode] = useState<FinancingMode>('progressive')

  const result = useMemo(() => computeScenario(aiIdx, ubiMo, finMode), [aiIdx, ubiMo, finMode])
  const utilCurve = useMemo(
    () => utilityCurveFromSurface(aiIdx, ubiMo, finMode),
    [aiIdx, ubiMo, finMode],
  )

  function applyPreset(id: UbiAiPresetId) {
    const c = PRESET_CONTROLS[id]
    setAiIdx(c.aiJobSecurityIndex)
    setUbiMo(c.ubiMonthlyUsd)
    setFinMode(c.financingMode)
  }

  const aiLabel =
    aiIdx > 0.25
      ? 'Augmentation-heavy'
      : aiIdx < -0.25
        ? 'Automation-heavy'
        : 'Transition (web / industrial-revolution style)'

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="space-y-2">
        <h1 className="font-lora text-3xl font-semibold sm:text-4xl" style={{ color: 'var(--ink-text)' }}>
          UBI × AI utility explorer
        </h1>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--ink-muted)' }}>
          Transparent scenario model (not causal national policy scoring): how universal basic income (UBI)
          changes population-weighted utility under variable artificial intelligence (AI) job-security assumptions.
          Parameters calibrated from IMF, Goldman Sachs, Acemoglu, pilot randomized controlled trials (RCTs), and
          Alaska Permanent Fund synthetic-control evidence.
        </p>
        <p className="text-xs italic" style={{ color: 'var(--ink-muted)' }}>
          {UBI_AI_DATA.meta.disclaimer} Generated {UBI_AI_DATA.meta.generatedAt}.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        {(['explore', 'sources', 'methods'] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className="rounded-lg border px-3 py-2 text-sm font-medium capitalize transition-opacity hover:opacity-90"
            style={{
              borderColor: 'var(--ink-border)',
              backgroundColor: tab === t ? 'var(--ink-accent)' : 'var(--ink-bg)',
              color: tab === t ? '#fff' : 'var(--ink-text)',
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'explore' && (
        <>
          <section
            className="space-y-4 rounded-lg border p-4"
            style={{ borderColor: 'var(--ink-border)', backgroundColor: 'var(--ink-paper)' }}
          >
            <h2 className="font-lora text-lg font-semibold">Baseline presets</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              {(Object.keys(PRESET_META) as UbiAiPresetId[]).map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => applyPreset(id)}
                  className="rounded-lg border p-3 text-left text-sm transition-opacity hover:opacity-90"
                  style={{ borderColor: 'var(--ink-border)', backgroundColor: 'var(--ink-bg)' }}
                >
                  <span className="font-semibold" style={{ color: 'var(--ink-text)' }}>
                    {PRESET_META[id].label}
                  </span>
                  <p className="mt-1 text-xs" style={{ color: 'var(--ink-muted)' }}>
                    {PRESET_META[id].description}
                  </p>
                </button>
              ))}
            </div>
          </section>

          <section
            className="space-y-5 rounded-lg border p-4"
            style={{ borderColor: 'var(--ink-border)', backgroundColor: 'var(--ink-paper)' }}
          >
            <h2 className="font-lora text-lg font-semibold">Controls</h2>

            <div>
              <label className="flex justify-between text-sm" style={{ color: 'var(--ink-text)' }}>
                <span>AI job security</span>
                <span style={{ color: 'var(--ink-muted)' }}>{aiLabel}</span>
              </label>
              <input
                type="range"
                min={-1}
                max={1}
                step={0.05}
                value={aiIdx}
                onChange={(e) => setAiIdx(parseFloat(e.target.value))}
                className="mt-2 w-full accent-[var(--ink-accent)]"
                aria-valuetext={aiLabel}
              />
              <div className="mt-1 flex justify-between text-xs" style={{ color: 'var(--ink-muted)' }}>
                <span>−1 misaligned automation</span>
                <span>0 transition</span>
                <span>+1 aligned augmentation</span>
              </div>
            </div>

            <div>
              <label className="flex justify-between text-sm" style={{ color: 'var(--ink-text)' }}>
                <span>UBI amount (per adult / month)</span>
                <span style={{ color: 'var(--ink-muted)' }}>{formatUsd(ubiMo)}</span>
              </label>
              <input
                type="range"
                min={0}
                max={2000}
                step={50}
                value={ubiMo}
                onChange={(e) => setUbiMo(parseInt(e.target.value, 10))}
                className="mt-2 w-full accent-[var(--ink-accent)]"
              />
            </div>

            <div>
              <label className="text-sm" style={{ color: 'var(--ink-text)' }}>
                Financing
              </label>
              <select
                value={finMode}
                onChange={(e) => setFinMode(e.target.value as FinancingMode)}
                className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"
                style={{
                  borderColor: 'var(--ink-border)',
                  backgroundColor: 'var(--ink-bg)',
                  color: 'var(--ink-text)',
                }}
              >
                <option value="unfunded">Unfunded thought experiment (no tax)</option>
                <option value="flat">Flat tax on earned income</option>
                <option value="progressive">Progressive tax on earned income</option>
              </select>
            </div>
          </section>

          <section className="grid gap-3 sm:grid-cols-2">
            <StatCard
              label="Social utility change"
              value={formatPct(result.utilityDeltaPercent)}
              hint="Population-weighted log utility (concave)"
            />
            <StatCard
              label="Consumption equivalent"
              value={formatPct(result.consumptionEquivalentPercent)}
              hint="Uniform % consumption boost matching post-policy utility"
            />
            <StatCard
              label="Gross fiscal cost"
              value={`$${result.fiscalCostGrossBn.toFixed(0)}B / yr`}
              hint={`~${UBI_AI_PARAMS.adultPopulationMillions}M adults × ${formatUsd(ubiMo)}/mo`}
            />
            <StatCard
              label="AI displacement (10y)"
              value={formatPct(result.displacementShare * 100, 1).replace('+', '')}
              hint={`Productivity +${(result.productivityGain10y * 100).toFixed(1)}% (10y); unemp +${(result.unemploymentRise * 100).toFixed(2)}pp`}
            />
            <StatCard
              label="Poverty share (below line)"
              value={`${(result.povertyShareAfter * 100).toFixed(1)}%`}
              hint={`Was ${(result.povertyShareBefore * 100).toFixed(1)}% after AI, before UBI tax`}
            />
            <StatCard
              label="UBI labor supply (est.)"
              value={`${result.employmentPpChange.toFixed(1)} pp emp`}
              hint={`${result.hoursPerWeekChange.toFixed(1)} hr/wk (ORUS-scaled at $1k/mo)`}
            />
          </section>

          <section
            className="grid gap-6 rounded-lg border p-4 md:grid-cols-2"
            style={{ borderColor: 'var(--ink-border)', backgroundColor: 'var(--ink-paper)' }}
          >
            <div>
              <h3 className="mb-2 text-sm font-semibold" style={{ color: 'var(--ink-text)' }}>
                Utility vs AI job security
              </h3>
              <LineChart
                xs={UBI_AI_AI_GRID}
                ys={utilCurve}
                markerX={aiIdx}
                yLabel="Δ utility %"
              />
              <p className="mt-2 text-xs" style={{ color: 'var(--ink-muted)' }}>
                At {formatUsd(ubiMo)}/mo, {finMode} financing.
              </p>
            </div>
            <div>
              <h3 className="mb-2 text-sm font-semibold" style={{ color: 'var(--ink-text)' }}>
                Net income by quintile (after AI + UBI)
              </h3>
              <GroupBarChart groups={result.groups} showUbi />
            </div>
            <div className="md:col-span-2">
              <h3 className="mb-2 text-sm font-semibold" style={{ color: 'var(--ink-text)' }}>
                Utility vs UBI amount (fixed AI index)
              </h3>
              <UbiSensitivityChart aiIdx={aiIdx} finMode={finMode} />
            </div>
          </section>
        </>
      )}

      {tab === 'sources' && (
        <section className="space-y-3">
          <ul className="list-none space-y-3 p-0">
            {UBI_AI_DATA.sources.map((s) => (
              <li
                key={s.id}
                className="rounded-lg border p-3 text-sm"
                style={{ borderColor: 'var(--ink-border)', backgroundColor: 'var(--ink-paper)' }}
              >
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold hover:underline"
                  style={{ color: 'var(--ink-accent)' }}
                >
                  {s.title}
                </a>
                <span style={{ color: 'var(--ink-muted)' }}>
                  {' '}
                  — {s.org} ({s.year})
                </span>
                <p className="mt-1 text-xs" style={{ color: 'var(--ink-muted)' }}>
                  Used for: {(s.usedFor as string[]).join(', ')}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {tab === 'methods' && (
        <section
          className="space-y-4 rounded-lg border p-4 text-sm leading-relaxed"
          style={{ borderColor: 'var(--ink-border)', backgroundColor: 'var(--ink-paper)', color: 'var(--ink-text)' }}
        >
          <div>
            <h2 className="font-lora text-lg font-semibold">Model</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5" style={{ color: 'var(--ink-muted)' }}>
              <li>Five stylized income quintiles; population-weighted log utility.</li>
              <li>
                AI index interpolates displacement (3–14%), 10-year productivity, volatility, and unemployment
                (Goldman / IMF / Acemoglu anchors).
              </li>
              <li>UBI adds transfers; financing modes tax earned income (flat or progressive) to fund payouts.</li>
              <li>Labor supply scales from OpenResearch ($1,000/mo ≈ −2 pp employment, −1.3 hr/wk).</li>
            </ul>
          </div>
          <div>
            <h2 className="font-lora text-lg font-semibold">Economics 50 / Chetty-style extensions (not estimated here)</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5" style={{ color: 'var(--ink-muted)' }}>
              <li>
                <strong>Synthetic control:</strong> {UBI_AI_DATA.methodsExtensions.syntheticControl}
              </li>
              <li>
                <strong>Difference-in-differences:</strong> {UBI_AI_DATA.methodsExtensions.differenceInDiff}
              </li>
              <li>
                <strong>Decision trees / ML:</strong> {UBI_AI_DATA.methodsExtensions.decisionTreesMl}
              </li>
            </ul>
          </div>
          <div>
            <h2 className="font-lora text-lg font-semibold">Limitations</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5" style={{ color: 'var(--ink-muted)' }}>
              <li>Pilots ≠ national UBI; Alaska dividend ≠ monthly UBI at scale.</li>
              <li>Financing and tax incidence assumptions dominate welfare rankings.</li>
              <li>AI labor forecasts are uncertain; treat outputs as sensitivity analysis.</li>
            </ul>
          </div>
          <p className="text-xs" style={{ color: 'var(--ink-muted)' }}>
            Rebuild artifacts: <code>Rscript analysis/ubi-ai/model.R</code>
          </p>
        </section>
      )}
    </div>
  )
}
