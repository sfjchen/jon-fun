#!/usr/bin/env Rscript
# UBI x AI transparent scenario model — generates dashboard JSON/CSV artifacts.

suppressPackageStartupMessages({
  if (!requireNamespace("jsonlite", quietly = TRUE)) {
    stop("Install jsonlite: install.packages('jsonlite')")
  }
})

`%||%` <- function(x, y) if (is.null(x)) y else x

args <- commandArgs(trailingOnly = FALSE)
fileArg <- grep("^--file=", args, value = TRUE)
if (length(fileArg)) {
  scriptPath <- sub("^--file=", "", fileArg[1])
  root <- normalizePath(file.path(dirname(scriptPath), "..", ".."), winslash = "/")
} else {
  root <- getwd()
}
if (!file.exists(file.path(root, "analysis", "ubi-ai", "sources.json"))) {
  root <- normalizePath(getwd(), winslash = "/")
}

srcDir <- file.path(root, "analysis", "ubi-ai")
outDir <- file.path(srcDir, "output")
dir.create(outDir, recursive = TRUE, showWarnings = FALSE)

sourcesPath <- file.path(srcDir, "sources.json")
sourcesRaw <- jsonlite::fromJSON(sourcesPath, simplifyVector = FALSE)
params <- sourcesRaw$calibratedParameters

# Stylized US income distribution (5 quintile groups)
grpLabs <- c("Q1 (lowest)", "Q2", "Q3", "Q4", "Q5 (highest)")
baseIncome <- c(15000, 35000, 65000, 110000, 250000)
popWt <- rep(0.2, 5)
minC <- 1200

interpByAi <- function(lo, mid, hi, aiIdx) {
  if (aiIdx <= 0) {
    t <- aiIdx + 1
    lo + (mid - lo) * t
  } else {
    mid + (hi - mid) * aiIdx
  }
}

uLog <- function(c) log(pmax(c, minC))

# AI index effects
aiFx <- function(aiIdx) {
  list(
    displacement = interpByAi(
      params$displacementAtAiIndexMinus1,
      params$displacementAtAiIndex0,
      params$displacementAtAiIndexPlus1,
      aiIdx
    ),
    productivity10y = interpByAi(
      params$productivityGain10yAtIndexMinus1,
      params$productivityGain10yAtIndex0,
      params$productivityGain10yAtIndexPlus1,
      aiIdx
    ),
    volatility = if (aiIdx < 0) {
      params$volatilityPenaltyAtIndexMinus1 * (-aiIdx)
    } else {
      0
    },
    unemployment = params$unemploymentRiseGradualAdoption * (1 - aiIdx) * 0.5
  )
}

# Income after AI shock (pre-UBI)
aiIncome <- function(base, aiIdx, grpIdx) {
  fx <- aiFx(aiIdx)
  exposure <- 0.5 + 0.1 * (grpIdx - 3) # middle quintiles slightly more exposed
  prodMult <- 1 + fx$productivity10y * (0.6 + 0.1 * grpIdx)
  dispLoss <- fx$displacement * exposure * base
  volLoss <- fx$volatility * base * 0.5
  unempLoss <- fx$unemployment * base * 0.3
  pmax(base * prodMult - dispLoss - volLoss - unempLoss, minC)
}

# UBI labor supply (OpenResearch-scaled)
ubiLabor <- function(ubiMo) {
  scale <- ubiMo / 1000
  list(
    empPp = -params$ubiEmploymentPpPer1000Monthly * scale,
    hoursWk = -params$ubiHoursPerWeekPer1000Monthly * scale
  )
}

fiscalGrossBn <- function(ubiMo) {
  (ubiMo * 12 * params$adultPopulationMillions) / 1e9
}

taxRates <- function(finMode, ubiMo, incomes) {
  gross <- fiscalGrossBn(ubiMo) * 1e9
  if (finMode == "unfunded" || ubiMo <= 0) {
    return(rep(0, length(incomes)))
  }
  if (finMode == "flat") {
    rate <- gross / sum(incomes * popWt)
    return(rep(rate, length(incomes)))
  }
  w <- (1:5) / sum(1:5)
  baseRate <- gross / sum(incomes * popWt * w)
  baseRate * (1:5)
}

scenario <- function(aiIdx, ubiMo, finMode) {
  fx <- aiFx(aiIdx)
  lab <- ubiLabor(ubiMo)
  pre <- numeric(5)
  post <- numeric(5)
  for (i in seq_along(pre)) {
    pre[i] <- aiIncome(baseIncome[i], aiIdx, i)
  }
  taxes <- taxRates(finMode, ubiMo, pre)
  ubiAnnual <- ubiMo * 12
  for (i in seq_along(post)) {
    inc <- pre[i]
    empMult <- 1 + (lab$empPp / 100) * 0.5
    hourMult <- 1 + (lab$hoursWk / 40) * 0.15
    earned <- inc * empMult * hourMult
    transfer <- ubiAnnual
    taxPaid <- earned * taxes[i]
    post[i] <- pmax(earned + transfer - taxPaid, minC)
  }
  uPre <- sum(popWt * uLog(pre))
  uPost <- sum(popWt * uLog(post))
  utilDelta <- uPost - uPre
  utilPct <- if (uPre > 0) (utilDelta / uPre) * 100 else 0

  # Consumption-equivalent variation (aggregate)
  ceSearch <- function(target) {
    lo <- -0.5
    hi <- 0.5
    for (k in 1:40) {
      mid <- (lo + hi) / 2
      uTrial <- sum(popWt * uLog(pre * (1 + mid)))
      if (uTrial < target) lo <- mid else hi <- mid
    }
    ((lo + hi) / 2) * 100
  }
  cePct <- ceSearch(uPost)

  povLine <- params$povertyLineAnnualUsd
  povPre <- sum(popWt * (pre < povLine))
  povPost <- sum(popWt * (post < povLine))

  list(
    aiJobSecurityIndex = aiIdx,
    ubiMonthlyUsd = ubiMo,
    financingMode = finMode,
    displacementShare = fx$displacement,
    productivityGain10y = fx$productivity10y,
    volatilityPenalty = fx$volatility,
    unemploymentRise = fx$unemployment,
    employmentPpChange = lab$empPp,
    hoursPerWeekChange = lab$hoursWk,
    fiscalCostGrossBn = fiscalGrossBn(ubiMo),
    utilityBaseline = uPre,
    utilityWithPolicy = uPost,
    utilityDelta = utilDelta,
    utilityDeltaPercent = utilPct,
    consumptionEquivalentPercent = cePct,
    povertyShareBefore = povPre,
    povertyShareAfter = povPost,
    povertyBufferPercent = (povPre - povPost) * 100,
    groups = lapply(seq_along(grpLabs), function(i) {
      list(
        label = grpLabs[i],
        incomeBeforeAi = baseIncome[i],
        incomeAfterAi = pre[i],
        netIncomeAfterUbi = post[i],
        populationWeight = popWt[i]
      )
    })
  )
}

aiGrid <- seq(-1, 1, by = 0.1)
ubiGrid <- c(0, 250, 500, 750, 1000, 1250, 1500, 1750, 2000)
finModes <- c("unfunded", "flat", "progressive")

utilitySurface <- list()
for (fm in finModes) {
  utilitySurface[[fm]] <- list()
  for (u in ubiGrid) {
    utilitySurface[[fm]][[as.character(u)]] <- vapply(aiGrid, function(a) {
      scenario(a, u, fm)$utilityDeltaPercent
    }, numeric(1))
  }
}

presets <- list(
  web_industrial = list(
    id = "web_industrial",
    label = "Web / industrial-revolution style",
    description = "Broad diffusion: moderate disruption, new tasks, partial productivity gains.",
    aiJobSecurityIndex = 0,
    ubiMonthlyUsd = 1000,
    financingMode = "progressive"
  ),
  aligned_augmentation = list(
    id = "aligned_augmentation",
    label = "Aligned augmentation",
    description = "Human-AI complementarity: lower displacement, higher productivity.",
    aiJobSecurityIndex = 0.75,
    ubiMonthlyUsd = 500,
    financingMode = "progressive"
  ),
  misaligned_automation = list(
    id = "misaligned_automation",
    label = "Misaligned automation",
    description = "Automation-heavy: higher displacement, volatility, insurance value of UBI.",
    aiJobSecurityIndex = -0.75,
    ubiMonthlyUsd = 1500,
    financingMode = "progressive"
  )
)

presetResults <- lapply(presets, function(p) {
  res <- scenario(p$aiJobSecurityIndex, p$ubiMonthlyUsd, p$financingMode)
  c(p, list(results = res))
})

defaultScenario <- scenario(0, 1000, "progressive")

payload <- list(
  meta = list(
    version = 1,
    generatedAt = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
    model = "transparent_scenario",
    disclaimer = sourcesRaw$disclaimer
  ),
  sources = sourcesRaw$sources,
  parameters = params,
  incomeGroups = grpLabs,
  financingModes = finModes,
  aiGrid = aiGrid,
  ubiGrid = ubiGrid,
  presets = presets,
  presetResults = presetResults,
  defaultScenario = defaultScenario,
  utilitySurface = utilitySurface,
  methodsExtensions = list(
    syntheticControl = "Alaska Permanent Fund dividend vs synthetic US states (Jones & Marinescu).",
    differenceInDiff = "High vs low AI-exposure occupations pre/post ChatGPT (HBS gen-AI labor paper).",
    decisionTreesMl = "Predict displacement risk from occupation, education, age, income features (Economics 50 / Chetty course framing)."
  )
)

outJson <- file.path(outDir, "ubi_ai_scenarios.json")
jsonlite::write_json(payload, outJson, pretty = TRUE, auto_unbox = TRUE, null = "null")

# CSV sensitivity slice (UBI x AI at progressive financing)
rows <- expand.grid(
  aiIdx = aiGrid,
  ubiMo = ubiGrid,
  stringsAsFactors = FALSE
)
rows$utilityDeltaPct <- NA
rows$cePct <- NA
rows$fiscalBn <- NA
for (i in seq_len(nrow(rows))) {
  s <- scenario(rows$aiIdx[i], rows$ubiMo[i], "progressive")
  rows$utilityDeltaPct[i] <- s$utilityDeltaPercent
  rows$cePct[i] <- s$consumptionEquivalentPercent
  rows$fiscalBn[i] <- s$fiscalCostGrossBn
}
write.csv(rows, file.path(outDir, "ubi_ai_sensitivity.csv"), row.names = FALSE)

# Copy into Next bundle path
dataDir <- file.path(root, "src", "data", "ubi-ai")
dir.create(dataDir, recursive = TRUE, showWarnings = FALSE)
file.copy(outJson, file.path(dataDir, "ubi_ai_scenarios.json"), overwrite = TRUE)

message("Wrote ", outJson)
message("Copied to src/data/ubi-ai/ubi_ai_scenarios.json")
