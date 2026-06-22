/**
 * Knowledge domain registry — domain packs tune AI context for Notes vault.
 */

export type KnowledgeDomainId =
  | 'uvimco-endowment'
  | 'portfolio-quant'
  | 'cfa-l1'
  | 'general'

export interface KnowledgeDomain {
  id: KnowledgeDomainId
  label: string
  /** Tags on notes that boost this domain */
  tagHints: string[]
  /** Keywords in body/query for inference */
  keywords: string[]
  /** Dense context block injected into system prompt */
  coreContext: string
  /** Label for "relevance" block in AI responses */
  angleLabel: string
  /** Priority when multiple domains match (higher wins ties) */
  priority: number
}

/** Default domain when nothing else matches */
export const FALLBACK_DOMAIN_ID: KnowledgeDomainId = 'general'

/**
 * Primary focus domain — UVIMCO internship (~10 weeks from Jun 2026).
 * Override per-note via metadata.domain or env NOTES_ACTIVE_DOMAIN.
 */
export const DEFAULT_ACTIVE_DOMAIN_ID: KnowledgeDomainId =
  (process.env.NOTES_ACTIVE_DOMAIN as KnowledgeDomainId | undefined) ?? 'uvimco-endowment'

export const KNOWLEDGE_DOMAINS: Record<KnowledgeDomainId, KnowledgeDomain> = {
  'uvimco-endowment': {
    id: 'uvimco-endowment',
    label: 'UVIMCO endowment',
    tagHints: ['IC', 'GP', 'endowment', 'UVIMCO', 'LTP', 'STP', 'IPS'],
    keywords: [
      'uvimco',
      'endowment',
      'investment committee',
      'long term pool',
      'general partner',
      'limited partner',
      'ips',
      'cio',
      'ltp',
      'stp',
    ],
    angleLabel: 'Endowment relevance',
    priority: 100,
    coreContext: `UVIMCO (University of Virginia Investment Management Company) — endowment allocator
Org: ~$14.5B AUM; external GPs only (no direct company investing); IC + CIO + IPS governance
Pools: LTP (long-term, growth/alts-heavy) vs STP (short-term, liquidity)
Policy benchmark: 75% MSCI ACWI + 25% US Treasury (blended return target)
Asset mix (approx): ~58% alternatives (PE, VC, RE, natural resources, absolute return), rest public equity/fixed income/cash

Key roles: LP (UVIMCO commits capital) | GP (manages fund) | IC (approves commitments) | IPS (investment policy statement)

Private markets metrics (formulas):
- DPI = distributions ÷ paid-in capital (cash back to LPs; liquidity signal)
- RVPI = residual value ÷ paid-in (unrealized NAV still in fund)
- TVPI = (distributions + residual value) ÷ paid-in = DPI + RVPI (total value multiple)
- MOIC = total value ÷ invested capital (often ≈ TVPI for PE)
- IRR = time-weighted return; sensitive to timing of calls/distributions
- Unfunded = committed − called (future capital calls)
- Pacing = annual calls/distributions vs plan (liquidity planning)

Typical ranges (PE fund life, rule-of-thumb):
- DPI early (yrs 1–4): ~0.1–0.4 | mature (yrs 8+): ~0.8–1.2+
- TVPI early: ~0.9–1.1 (mark-to-model) | top quartile mature: ~2.0–3.0x+
- IRR: net 15–25% often cited as strong PE; gross vs net (after fees/carry)

Fees: mgmt fee ~1.5–2% on committed/called; carry ~20% above preferred return (hurdle ~8%); fee offsets matter

Endowment ops: unfunded pacing, liquidity ladder, manager selection, re-ups, co-invest, ESG/DEI in IPS, benchmark vs policy mix`,
  },

  'portfolio-quant': {
    id: 'portfolio-quant',
    label: 'Portfolio management (quant)',
    tagHints: ['APM', 'PM', 'quant', 'alpha', 'IR', 'Grinold'],
    keywords: [
      'information ratio',
      'active share',
      'grinold',
      'kahn',
      'alpha',
      'beta',
      'tracking error',
      'fundamental law',
      'breadth',
      'transfer coefficient',
      'portfolio construction',
      'risk model',
      'pioneering',
    ],
    angleLabel: 'Portfolio math angle',
    priority: 80,
    coreContext: `Active Portfolio Management (Grinold & Kahn) + quantitative PM lens

Fundamental law of active management: IR ≈ IC × √BR
- IR (information ratio) = active return ÷ tracking error (risk-adjusted skill vs benchmark)
- IC (information coefficient) = correlation of forecasts with realized returns (~0.02–0.10 typical; 0.05+ strong)
- BR (breadth) = independent bets per year (more uncorrelated ideas → higher IR)

Alpha decomposition: α = IC × σ_residual × √BR × TC
- TC (transfer coefficient) = how fully ideas get into portfolio (constraints, turnover, costs shrink TC)

Active share: % of portfolio weight differing from benchmark (0% = closet index; 60%+ = truly active)
Tracking error (TE): std dev of active returns vs benchmark; typical active equity TE ~2–6%

Sharpe = (Rp − Rf) / σp | Sortino uses downside dev only
Beta = Cov(Rp, Rm) / Var(Rm) | Jensen alpha = Rp − [Rf + β(Rm − Rf)]

Risk budgeting: allocate risk (not dollars) across sleeves; marginal contribution to total risk
Factor exposure: separate skill (alpha) from style/factor tilts (value, momentum, size)

Portfolio construction pitfalls: transaction costs, capacity, alpha decay, crowding, constraint drag
Pioneering PM mindset: quantify edge, capacity, decay; hit rate × payoff ratio; compare gross vs net alpha`,
  },

  'cfa-l1': {
    id: 'cfa-l1',
    label: 'CFA Level I',
    tagHints: ['CFA', 'L1', 'ethics', 'FRA'],
    keywords: [
      'cfa',
      'gaap',
      'ifrs',
      'wacc',
      'npv',
      'duration',
      'convexity',
      'yield curve',
      'capm',
      'ethical',
      'standard of care',
      'fiduciary',
    ],
    angleLabel: 'CFA L1 link',
    priority: 60,
    coreContext: `CFA Level I — high-yield formulas and definitions

Ethics: fiduciary duty, loyalty, material nonpublic info (MNPI), soft dollars, suitability, CFA standards

Quant: TVM FV = PV(1+r)^n | NPV = Σ CF/(1+r)^t | BEY, EAR conversions
Stats: σ sample vs population | correlation ≠ causation | p-value, Type I/II error

Economics: GDP = C+I+G+(X−M) | elasticity | Phillips curve (short-run) | FX parity approximations

FRA ratios:
- Current = CA / CL | Quick = (CA − inventory) / CL
- Debt/equity = total debt / total equity | ROE = NI / avg equity | ROA = NI / avg assets
- Gross margin = gross profit / revenue | Operating = EBIT / revenue
Inventory: LIFO → higher COGS/lower tax in inflation (US GAAP); IFRS prohibits LIFO

Corp fin: WACC = (E/V)Re + (D/V)Rd(1−T) | CAPM E(Ri) = Rf + β(E(Rm) − Rf)
NPV rule: accept if NPV>0 | IRR pitfalls (non-conventional cash flows, scale)

Equity: Gordon DDM P0 = D1/(r−g) | P/E, P/B, EV/EBITDA comps | Porter five forces

Fixed income:
- Duration ≈ −ΔP/Δy (modified duration × price) | Convexity adds curvature
- YTM: discount rate equating price to PV of cash flows
- Spread = yield − benchmark (credit/liquidity premium)

Alts basics: PE same as LP metrics (DPI/TVPI); hedge fund = alpha + beta separation; RE cap rates

PM: IPS (objectives, constraints, benchmark) | SAA vs TAA | performance attribution (allocation/selection)`,
  },

  general: {
    id: 'general',
    label: 'General',
    tagHints: [],
    keywords: [],
    angleLabel: 'Practical relevance',
    priority: 0,
    coreContext: `General professional notes vault — finance, learning, meetings.
- Prefer precise definitions, numbers, and actionable follow-ups
- Cross-link to glossary terms and pasted sources when available`,
  },
}

export function getDomain(id: KnowledgeDomainId): KnowledgeDomain {
  return KNOWLEDGE_DOMAINS[id] ?? KNOWLEDGE_DOMAINS.general
}

export function listDomains(): KnowledgeDomain[] {
  return Object.values(KNOWLEDGE_DOMAINS).sort((a, b) => b.priority - a.priority)
}

export function resolveDomainOpts(partial: {
  explicitDomain?: KnowledgeDomainId
  tags?: string[]
  kind?: string
  notes?: string
  query?: string
}): Parameters<typeof resolveDomainsForNote>[0] {
  const o: Parameters<typeof resolveDomainsForNote>[0] = {}
  if (partial.explicitDomain) o.explicitDomain = partial.explicitDomain
  if (partial.tags?.length) o.tags = partial.tags
  if (partial.kind) o.kind = partial.kind
  if (partial.notes) o.notes = partial.notes
  if (partial.query) o.query = partial.query
  return o
}

/** Score domains for a note; returns best match + runners-up. */
export function resolveDomainsForNote(opts: {
  tags?: string[]
  kind?: string
  notes?: string
  query?: string
  explicitDomain?: KnowledgeDomainId
}): { primary: KnowledgeDomain; scores: { id: KnowledgeDomainId; score: number }[] } {
  if (opts.explicitDomain && KNOWLEDGE_DOMAINS[opts.explicitDomain]) {
    return {
      primary: getDomain(opts.explicitDomain),
      scores: [{ id: opts.explicitDomain, score: 999 }],
    }
  }

  const haystack = `${opts.tags?.join(' ') ?? ''} ${opts.kind ?? ''} ${opts.notes ?? ''} ${opts.query ?? ''}`.toLowerCase()
  const tagSet = new Set((opts.tags ?? []).map((t) => t.toLowerCase()))

  const scores = (Object.keys(KNOWLEDGE_DOMAINS) as KnowledgeDomainId[]).map((id) => {
    const d = KNOWLEDGE_DOMAINS[id]!
    let score = d.priority * 0.01
    for (const t of d.tagHints) {
      if (tagSet.has(t.toLowerCase())) score += 12
    }
    for (const kw of d.keywords) {
      if (haystack.includes(kw.toLowerCase())) score += kw.length > 6 ? 4 : 2
    }
    return { id, score }
  })

  scores.sort((a, b) => b.score - a.score)
  const best = scores[0]!
  const primary =
    best.score > 5 ? getDomain(best.id) : getDomain(DEFAULT_ACTIVE_DOMAIN_ID)

  return { primary, scores }
}
