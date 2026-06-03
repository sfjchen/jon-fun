import scenarioData from '@/data/ubi-ai/ubi_ai_scenarios.json'

export type FinancingMode = 'unfunded' | 'flat' | 'progressive'

export type UbiAiPresetId = 'web_industrial' | 'aligned_augmentation' | 'misaligned_automation'

export type IncomeGroupRow = {
  label: string
  incomeBeforeAi: number
  incomeAfterAi: number
  netIncomeAfterUbi: number
  populationWeight: number
}

export type ScenarioResult = {
  aiJobSecurityIndex: number
  ubiMonthlyUsd: number
  financingMode: FinancingMode
  displacementShare: number
  productivityGain10y: number
  volatilityPenalty: number
  unemploymentRise: number
  employmentPpChange: number
  hoursPerWeekChange: number
  fiscalCostGrossBn: number
  utilityBaseline: number
  utilityWithPolicy: number
  utilityDelta: number
  utilityDeltaPercent: number
  consumptionEquivalentPercent: number
  povertyShareBefore: number
  povertyShareAfter: number
  povertyBufferPercent: number
  groups: IncomeGroupRow[]
}

export type CalibratedParams = {
  globalEmploymentExposedShare: number
  advancedEconomyExposedShare: number
  usTaskAutomatableShare: number
  displacementAtAiIndex0: number
  displacementAtAiIndexPlus1: number
  displacementAtAiIndexMinus1: number
  unemploymentRiseGradualAdoption: number
  productivityGain10yAtIndex0: number
  productivityGain10yAtIndexPlus1: number
  productivityGain10yAtIndexMinus1: number
  volatilityPenaltyAtIndexMinus1: number
  ubiEmploymentPpPer1000Monthly: number
  ubiHoursPerWeekPer1000Monthly: number
  stocktonVolatilityReductionYear1: number
  alaskaPartTimePp: number
  adultPopulationMillions: number
  povertyLineAnnualUsd: number
}

const GRP_LABS = ['Q1 (lowest)', 'Q2', 'Q3', 'Q4', 'Q5 (highest)'] as const
const BASE_INCOME = [15000, 35000, 65000, 110000, 250000]
const POP_WT = [0.2, 0.2, 0.2, 0.2, 0.2]
const MIN_C = 1200

export const UBI_AI_DATA = scenarioData
export const UBI_AI_PARAMS = scenarioData.parameters as CalibratedParams
export const UBI_AI_AI_GRID = scenarioData.aiGrid as number[]
export const UBI_AI_UBI_GRID = scenarioData.ubiGrid as number[]
export const UBI_AI_UTILITY_SURFACE = scenarioData.utilitySurface as Record<
  FinancingMode,
  Record<string, number[]>
>

function interpByAi(lo: number, mid: number, hi: number, aiIdx: number): number {
  if (aiIdx <= 0) return lo + (mid - lo) * (aiIdx + 1)
  return mid + (hi - mid) * aiIdx
}

function uLog(c: number): number {
  return Math.log(Math.max(c, MIN_C))
}

function aiFx(aiIdx: number, p: CalibratedParams) {
  return {
    displacement: interpByAi(
      p.displacementAtAiIndexMinus1,
      p.displacementAtAiIndex0,
      p.displacementAtAiIndexPlus1,
      aiIdx,
    ),
    productivity10y: interpByAi(
      p.productivityGain10yAtIndexMinus1,
      p.productivityGain10yAtIndex0,
      p.productivityGain10yAtIndexPlus1,
      aiIdx,
    ),
    volatility: aiIdx < 0 ? p.volatilityPenaltyAtIndexMinus1 * -aiIdx : 0,
    unemployment: p.unemploymentRiseGradualAdoption * (1 - aiIdx) * 0.5,
  }
}

function aiIncome(base: number, aiIdx: number, grpIdx: number, p: CalibratedParams): number {
  const fx = aiFx(aiIdx, p)
  const exposure = 0.5 + 0.1 * (grpIdx - 3)
  const prodMult = 1 + fx.productivity10y * (0.6 + 0.1 * grpIdx)
  const dispLoss = fx.displacement * exposure * base
  const volLoss = fx.volatility * base * 0.5
  const unempLoss = fx.unemployment * base * 0.3
  return Math.max(base * prodMult - dispLoss - volLoss - unempLoss, MIN_C)
}

function ubiLabor(ubiMo: number, p: CalibratedParams) {
  const scale = ubiMo / 1000
  return {
    empPp: -p.ubiEmploymentPpPer1000Monthly * scale,
    hoursWk: -p.ubiHoursPerWeekPer1000Monthly * scale,
  }
}

function fiscalGrossBn(ubiMo: number, p: CalibratedParams): number {
  return (ubiMo * 12 * p.adultPopulationMillions) / 1e9
}

function taxRates(finMode: FinancingMode, ubiMo: number, incomes: number[], p: CalibratedParams): number[] {
  const gross = fiscalGrossBn(ubiMo, p) * 1e9
  if (finMode === 'unfunded' || ubiMo <= 0) return incomes.map(() => 0)
  if (finMode === 'flat') {
    const rate = gross / incomes.reduce((s, inc, i) => s + inc * (POP_WT[i] ?? 0), 0)
    return incomes.map(() => rate)
  }
  const w = [1, 2, 3, 4, 5].map((n) => n / 15)
  const baseRate = gross / incomes.reduce((s, inc, i) => s + inc * (POP_WT[i] ?? 0) * (w[i] ?? 0), 0)
  return incomes.map((_, i) => baseRate * (i + 1))
}

function cePctSearch(pre: number[], targetU: number): number {
  let lo = -0.5
  let hi = 0.5
  for (let k = 0; k < 40; k++) {
    const mid = (lo + hi) / 2
    const uTrial = pre.reduce((s, c, i) => s + (POP_WT[i] ?? 0) * uLog(c * (1 + mid)), 0)
    if (uTrial < targetU) lo = mid
    else hi = mid
  }
  return ((lo + hi) / 2) * 100
}

/** Live scenario — mirrors analysis/ubi-ai/model.R */
export function computeScenario(
  aiIdx: number,
  ubiMo: number,
  finMode: FinancingMode,
  p: CalibratedParams = UBI_AI_PARAMS,
): ScenarioResult {
  const fx = aiFx(aiIdx, p)
  const lab = ubiLabor(ubiMo, p)
  const pre = BASE_INCOME.map((base, i) => aiIncome(base, aiIdx, i + 1, p))
  const taxes = taxRates(finMode, ubiMo, pre, p)
  const ubiAnnual = ubiMo * 12
  const post = pre.map((inc, i) => {
    const empMult = 1 + (lab.empPp / 100) * 0.5
    const hourMult = 1 + (lab.hoursWk / 40) * 0.15
    const earned = inc * empMult * hourMult
    const taxPaid = earned * (taxes[i] ?? 0)
    return Math.max(earned + ubiAnnual - taxPaid, MIN_C)
  })
  const uPre = pre.reduce((s, c, i) => s + (POP_WT[i] ?? 0) * uLog(c), 0)
  const uPost = post.reduce((s, c, i) => s + (POP_WT[i] ?? 0) * uLog(c), 0)
  const utilDelta = uPost - uPre
  const povLine = p.povertyLineAnnualUsd
  const povPre = pre.reduce((s, c, i) => s + (POP_WT[i] ?? 0) * (c < povLine ? 1 : 0), 0)
  const povPost = post.reduce((s, c, i) => s + (POP_WT[i] ?? 0) * (c < povLine ? 1 : 0), 0)

  return {
    aiJobSecurityIndex: aiIdx,
    ubiMonthlyUsd: ubiMo,
    financingMode: finMode,
    displacementShare: fx.displacement,
    productivityGain10y: fx.productivity10y,
    volatilityPenalty: fx.volatility,
    unemploymentRise: fx.unemployment,
    employmentPpChange: lab.empPp,
    hoursPerWeekChange: lab.hoursWk,
    fiscalCostGrossBn: fiscalGrossBn(ubiMo, p),
    utilityBaseline: uPre,
    utilityWithPolicy: uPost,
    utilityDelta: utilDelta,
    utilityDeltaPercent: uPre > 0 ? (utilDelta / uPre) * 100 : 0,
    consumptionEquivalentPercent: cePctSearch(pre, uPost),
    povertyShareBefore: povPre,
    povertyShareAfter: povPost,
    povertyBufferPercent: (povPre - povPost) * 100,
    groups: GRP_LABS.map((label, i) => ({
      label,
      incomeBeforeAi: BASE_INCOME[i]!,
      incomeAfterAi: pre[i]!,
      netIncomeAfterUbi: post[i]!,
      populationWeight: POP_WT[i]!,
    })),
  }
}

export function nearestUbiGridKey(ubiMo: number): string {
  const nearest = UBI_AI_UBI_GRID.reduce((best, v) =>
    Math.abs(v - ubiMo) < Math.abs(best - ubiMo) ? v : best,
  )
  return String(nearest)
}

export function utilityCurveFromSurface(
  aiIdx: number,
  ubiMo: number,
  finMode: FinancingMode,
): number[] {
  const key = nearestUbiGridKey(ubiMo)
  const surface = UBI_AI_UTILITY_SURFACE[finMode]?.[key]
  if (surface?.length === UBI_AI_AI_GRID.length) return surface
  return UBI_AI_AI_GRID.map((a) => computeScenario(a, ubiMo, finMode).utilityDeltaPercent)
}

export function formatUsd(n: number, compact = false): string {
  if (compact && Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(1)}B`
  if (compact && Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(1)}M`
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

export function formatPct(n: number, digits = 1): string {
  return `${n >= 0 ? '+' : ''}${n.toFixed(digits)}%`
}

export const PRESET_CONTROLS: Record<
  UbiAiPresetId,
  { aiJobSecurityIndex: number; ubiMonthlyUsd: number; financingMode: FinancingMode }
> = {
  web_industrial: { aiJobSecurityIndex: 0, ubiMonthlyUsd: 1000, financingMode: 'progressive' },
  aligned_augmentation: { aiJobSecurityIndex: 0.75, ubiMonthlyUsd: 500, financingMode: 'progressive' },
  misaligned_automation: { aiJobSecurityIndex: -0.75, ubiMonthlyUsd: 1500, financingMode: 'progressive' },
}

export const PRESET_META: Record<UbiAiPresetId, { label: string; description: string }> = {
  web_industrial: {
    label: 'Web / industrial-revolution style',
    description: 'Broad diffusion: moderate disruption, new tasks, partial productivity gains.',
  },
  aligned_augmentation: {
    label: 'Aligned augmentation',
    description: 'Human-AI complementarity: lower displacement, higher productivity.',
  },
  misaligned_automation: {
    label: 'Misaligned automation',
    description: 'Automation-heavy: higher displacement, volatility, insurance value of UBI.',
  },
}
