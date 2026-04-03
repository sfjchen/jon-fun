# Cost and Model Tuning

Budget target: **$50/month**

## Routing strategy

- Use primary model only for:
  - orchestrator final decisions
  - high-risk drafting and nuanced planning
- Use lower-cost fallback for:
  - polling/summaries
  - routine queue processing
  - non-critical reformats

## Practical controls

1. Keep webhook prompts short (single task objective, no long history).
2. Use isolated cron sessions for background jobs.
3. Keep important-email alert summaries compact.
4. Use dedupe to reduce repeated alert sends.
5. Cap automated retries and inspect errors quickly.

## Suggested budget envelope

- High-quality reasoning calls: 60-70%
- Routine/background calls: 20-30%
- Buffer for spikes: 10%

With your expected low volume (0-4 iMessages/day, 0-2 emails/day), this should stay under budget unless heavy browser research is frequent.

## Weekly review checklist

1. Count outbound queue actions by status.
2. Count important-email notifications triggered.
3. Check model usage/cost in OpenRouter dashboard.
4. Tighten policies if false positives are high.

## Fallback behavior

- If primary model errors or exceeds budget threshold:
  - automatically route to balanced fallback
- If fallback also fails:
  - route to low-cost fallback
- Always preserve approval gate for high-risk sends regardless of model.
