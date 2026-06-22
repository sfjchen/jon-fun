/**
 * Knowledge domain registry — Notes vault is domain-agnostic; active packs tune AI context.
 * Code paths still use `uvimco-notes` internally (legacy); user-facing name is **Notes**.
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
    coreContext: `UVIMCO (University of Virginia Investment Management Company)
- ~$14.5B endowment; ~58% alternatives (PE, VC, RE, NR, absolute return)
- External GPs only — no direct company investing
- Pools: LTP (long-term), STP (short-term)
- Benchmark: 75% MSCI ACWI + 25% US Treasury
- Common acronyms: IC, IPS, CIO, DPI, TVPI, MOIC, basis risk, pacing, unfunded commitments`,
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
    coreContext: `Active Portfolio Management (Grinold & Kahn) + pioneering PM lens
- Alpha = skill × √breadth (information transfer); IR ≈ IC × √BR (fundamental law of active mgmt)
- Active share, tracking error, risk budgeting; separate alpha from factor exposure
- Portfolio construction: constraints, turnover, transaction costs eat alpha
- Pioneering PM: numbers-first — quantify edge, capacity, decay; compare to benchmark and peers
- Key metrics: IR, Sharpe, TE, active risk, realized vs expected alpha, hit rate, payoff ratio`,
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
    coreContext: `CFA Level I core (concise)
- Ethics: fiduciary duty, material nonpublic info, soft dollars, loyalty
- Quant: TVM, probability, hypothesis testing, regression, sampling bias
- Economics: supply/demand, FX, fiscal/monetary policy, trade
- FRA: IS/BS/CF, ratios, inventory/LIFO-FIFO, leases, revenue recognition
- Corp fin: WACC, capital structure, dividend policy, NPV/IRR
- Equity: DDM, multi-stage, P/E, Porter, industry analysis
- Fixed income: YTM, duration, convexity, credit spreads, term structure
- Alts: PE/RE/commodities/hedge fund basics; fee structures
- PM: IPS, strategic vs tactical asset allocation, performance attribution`,
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
